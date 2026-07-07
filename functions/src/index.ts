import * as functions from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { 
  GameState,
  Player,
  createInitialGameState,
  addPlayer, 
  startGame as engineStartGame, 
  playTile as enginePlayTile,
  foundCorporation as engineFoundCorporation,
  buyStock as engineBuyStock,
  chooseMergeSurvivor as engineChooseMergeSurvivor,
  endTurn as engineEndTurn,
  resolveMergeStocks as engineResolveMergeStocks
} from '@acquire/shared';
import { processBotTurn } from './bot';

admin.initializeApp();
const db = admin.firestore();

const PLAYER_COLORS = ['#FF3366', '#33CCFF', '#FFCC00', '#00FF66', '#CC99FF', '#FF9933', '#FFFFFF', '#FF66B2', '#99CC00', '#6699FF'];

function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getGameState(gameId: string): Promise<GameState> {
  const doc = await db.collection('games').doc(gameId).get();
  if (!doc.exists) {
    throw new functions.HttpsError('not-found', 'Game not found');
  }
  return doc.data() as GameState;
}

async function saveGameState(gameId: string, state: GameState) {
  state.updatedAt = Date.now();
  await db.collection('games').doc(gameId).set(state);
}

async function emitStateAndProcessBots(gameId: string, state: GameState) {
  let currentState = state;
  let isBotTurnPending = true;

  while (isBotTurnPending) {
    await saveGameState(gameId, currentState);
    isBotTurnPending = false;
    
    // Evaluate if a bot should move
    processBotTurn(currentState, (newState) => {
      currentState = newState;
      isBotTurnPending = true; // Loop will continue and save this new state, then process the next turn
    });
    
    if (isBotTurnPending) {
      // Add a 1.5 second delay so the frontend has time to render the intermediate state
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

export const createGame = functions.onCall(async (request) => {
  const data = request.data as { username: string, playerId: string };
  const playerId = data.playerId;
  const username = data.username;
  if (!username || !playerId) throw new functions.HttpsError('invalid-argument', 'Missing username or playerId');
  
  const gameId = generateGameId();
  const state = createInitialGameState(gameId);
  state.hostId = playerId;
  const newPlayer: Player = {
    id: playerId,
    name: username,
    color: PLAYER_COLORS[0],
    money: 6000,
    tiles: [],
    stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
    isBot: false,
    stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
  };
  const newState = addPlayer(state, newPlayer);
  
  await saveGameState(gameId, newState);
  return { gameId };
});

export const joinGame = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, username: string, playerId: string };
  const state = await getGameState(data.gameId);
  
  const existingName = state.players.find(p => p.name.replace('🤖 ', '').toLowerCase() === data.username.trim().toLowerCase());

  if (existingName) {
    if (existingName.id === data.playerId || existingName.isBot) {
      existingName.id = data.playerId;
      existingName.isBot = false;
      existingName.name = data.username;
      
      if (!state.chat) state.chat = [];
      state.chat.push({
        sender: 'System',
        text: `${data.username} has rejoined the game!`,
        timestamp: Date.now()
      });
      if (state.chat.length > 50) state.chat = state.chat.slice(state.chat.length - 50);

      await saveGameState(data.gameId, state);
      return { gameId: data.gameId };
    } else {
      throw new functions.HttpsError('already-exists', 'Username already taken in this game.');
    }
  }

  if (state.phase !== 'Lobby') {
    throw new functions.HttpsError('failed-precondition', 'Game already started');
  }

  const colorIndex = state.players.length % PLAYER_COLORS.length;
  const newState = addPlayer(state, {
    id: data.playerId,
    name: data.username,
    color: PLAYER_COLORS[colorIndex],
    money: 6000,
    tiles: [],
    stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
    isBot: false,
    stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
  });
  
  await saveGameState(data.gameId, newState);
  return { gameId: data.gameId };
});

export const quitGame = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, playerId: string };
  const state = await getGameState(data.gameId);
  
  if (state.phase === 'Lobby') {
    state.players = state.players.filter(p => p.id !== data.playerId);
    if (state.players.length === 0 || !state.players.some(p => !p.isBot)) {
      state.phase = 'GameOver';
    } else if (state.hostId === data.playerId) {
      state.hostId = state.players.find(p => !p.isBot)?.id || state.players[0].id;
    }
    await saveGameState(data.gameId, state);
  } else {
    const playerIndex = state.players.findIndex(p => p.id === data.playerId);
    if (playerIndex >= 0) {
      const p = state.players[playerIndex];
      const originalName = p.name;
      p.isBot = true;
      if (!p.name.startsWith('🤖')) {
        p.name = `🤖 ${p.name}`;
      }
      
      if (!state.chat) state.chat = [];
      state.chat.push({
        sender: 'System',
        text: `${originalName.replace('🤖 ', '')} has left the game. A bot has taken over.`,
        timestamp: Date.now()
      });
      if (state.chat.length > 50) state.chat = state.chat.slice(state.chat.length - 50);

      if (!state.players.some(player => !player.isBot)) {
        state.phase = 'GameOver';
        await saveGameState(data.gameId, state);
      } else {
        await emitStateAndProcessBots(data.gameId, state);
      }
    }
  }
  return { success: true };
});

export const addBot = functions.onCall(async (request) => {
  const data = request.data as { gameId: string };
  const state = await getGameState(data.gameId);
  
  if (state.phase !== 'Lobby') {
    throw new functions.HttpsError('failed-precondition', 'Game already started');
  }

  const botNames = ['HAL', 'EVE', 'ZIM', 'GIR', 'BOB', 'TOM', 'LEO', 'MAX', 'SAM', 'ROY', 'BEN', 'DAN', 'RAY', 'JON'];
  const usedNames = state.players.map(p => p.name.replace('🤖 ', '').toLowerCase());
  const availableNames = botNames.filter(n => !usedNames.includes(n.toLowerCase()));
  
  let botName = '';
  if (availableNames.length > 0) {
    botName = availableNames[Math.floor(Math.random() * availableNames.length)];
  } else {
    let i = state.players.length;
    while (true) {
      if (!usedNames.includes(`bot${i}`)) {
        botName = `Bot${i}`;
        break;
      }
      i++;
    }
  }

  const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const colorIndex = state.players.length % PLAYER_COLORS.length;
  
  const newBot: Player = {
    id: botId,
    name: `🤖 ${botName}`,
    color: PLAYER_COLORS[colorIndex],
    money: 6000,
    tiles: [],
    stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
    isBot: true,
    stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
  };
  const newState = addPlayer(state, newBot);
  await saveGameState(data.gameId, newState);
  return { success: true };
});

export const startGame = functions.onCall(async (request) => {
  const data = request.data as { gameId: string };
  const state = await getGameState(data.gameId);
  const newState = engineStartGame(state);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const playTile = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, tileId: string, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = enginePlayTile(state, data.playerId, data.tileId as any);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const foundCorporation = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, corpName: string, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = engineFoundCorporation(state, data.playerId, data.corpName as any);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const chooseMergeSurvivor = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, corpName: string, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = engineChooseMergeSurvivor(state, data.playerId, data.corpName as any);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const resolveMergeStocks = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, sell: number, trade: number, keep: number, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = engineResolveMergeStocks(state, data.playerId, data.sell, data.trade, data.keep);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const buyStock = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, corpName: string, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = engineBuyStock(state, data.playerId, data.corpName as any);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const endTurn = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, playerId: string };
  const state = await getGameState(data.gameId);
  const newState = engineEndTurn(state);
  await emitStateAndProcessBots(data.gameId, newState);
  return { success: true };
});

export const addChatMessage = functions.onCall(async (request) => {
  const data = request.data as { gameId: string, playerId: string, text: string };
  const state = await getGameState(data.gameId);
  const player = state.players.find(p => p.id === data.playerId);
  if (!player || !data.text || data.text.trim() === '') return { success: false };
  
  if (!state.chat) state.chat = [];
  state.chat.push({ sender: player.name.replace('🤖 ', ''), text: data.text.trim(), timestamp: Date.now() });
  
  if (state.chat.length > 50) {
    state.chat = state.chat.slice(state.chat.length - 50);
  }
  
  await saveGameState(data.gameId, state);
  return { success: true };
});

export const cleanupInactiveGames = onSchedule('every 15 minutes', async (event) => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  const snapshot = await db.collection('games')
    .where('updatedAt', '<', oneHourAgo)
    .get();
    
  if (snapshot.empty) return;
  
  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    const state = doc.data() as GameState;
    if (state.phase !== 'GameOver') {
      state.phase = 'GameOver';
      state.logs.push('---');
      state.logs.push('Game ended due to inactivity.');
      state.updatedAt = Date.now();
      batch.set(doc.ref, state);
      count++;
    }
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Cleaned up ${count} inactive games.`);
  }
});
