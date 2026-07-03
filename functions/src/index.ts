import * as functions from 'firebase-functions/v2/https';
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
  }
}

export const createGame = functions.onCall(async (request) => {
  const data = request.data as { username: string, playerId: string };
  const playerId = data.playerId;
  const username = data.username;
  if (!username || !playerId) throw new functions.HttpsError('invalid-argument', 'Missing username or playerId');
  
  const gameId = generateGameId();
  const state = createInitialGameState(gameId);
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
  return { success: true };
});

export const addBot = functions.onCall(async (request) => {
  const data = request.data as { gameId: string };
  const state = await getGameState(data.gameId);
  
  if (state.phase !== 'Lobby') {
    throw new functions.HttpsError('failed-precondition', 'Game already started');
  }

  const botNames = ['HAL', 'EVE', 'ZIM', 'GIR', 'BOB', 'TOM', 'LEO', 'MAX', 'SAM', 'ROY', 'BEN', 'DAN', 'RAY', 'JON'];
  const usedNames = state.players.map(p => p.name.replace('🤖 ', ''));
  const availableNames = botNames.filter(n => !usedNames.includes(n));
  const botName = availableNames.length > 0 
    ? availableNames[Math.floor(Math.random() * availableNames.length)] 
    : `Bot${state.players.length}`;

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
