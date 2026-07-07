"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupInactiveGames = exports.addChatMessage = exports.endTurn = exports.buyStock = exports.resolveMergeStocks = exports.chooseMergeSurvivor = exports.foundCorporation = exports.playTile = exports.startGame = exports.addBot = exports.quitGame = exports.joinGame = exports.createGame = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const shared_1 = require("@acquire/shared");
const bot_1 = require("./bot");
admin.initializeApp();
const db = admin.firestore();
const PLAYER_COLORS = ['#FF3366', '#33CCFF', '#FFCC00', '#00FF66', '#CC99FF', '#FF9933', '#FFFFFF', '#FF66B2', '#99CC00', '#6699FF'];
function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
async function getGameState(gameId) {
    const doc = await db.collection('games').doc(gameId).get();
    if (!doc.exists) {
        throw new functions.HttpsError('not-found', 'Game not found');
    }
    return doc.data();
}
async function saveGameState(gameId, state) {
    state.updatedAt = Date.now();
    await db.collection('games').doc(gameId).set(state);
}
async function emitStateAndProcessBots(gameId, state) {
    let currentState = state;
    let isBotTurnPending = true;
    while (isBotTurnPending) {
        await saveGameState(gameId, currentState);
        isBotTurnPending = false;
        // Evaluate if a bot should move
        (0, bot_1.processBotTurn)(currentState, (newState) => {
            currentState = newState;
            isBotTurnPending = true; // Loop will continue and save this new state, then process the next turn
        });
        if (isBotTurnPending) {
            // Add a 1.5 second delay so the frontend has time to render the intermediate state
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
}
exports.createGame = functions.onCall(async (request) => {
    const data = request.data;
    const playerId = data.playerId;
    const username = data.username;
    if (!username || !playerId)
        throw new functions.HttpsError('invalid-argument', 'Missing username or playerId');
    const gameId = generateGameId();
    const state = (0, shared_1.createInitialGameState)(gameId);
    state.hostId = playerId;
    const newPlayer = {
        id: playerId,
        name: username,
        color: PLAYER_COLORS[0],
        money: 6000,
        tiles: [],
        stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: false,
        stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    };
    const newState = (0, shared_1.addPlayer)(state, newPlayer);
    await saveGameState(gameId, newState);
    return { gameId };
});
exports.joinGame = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const existingName = state.players.find(p => p.name.replace('🤖 ', '').toLowerCase() === data.username.trim().toLowerCase());
    if (existingName) {
        if (existingName.id === data.playerId || existingName.isBot) {
            existingName.id = data.playerId;
            existingName.isBot = false;
            existingName.name = data.username;
            if (!state.chat)
                state.chat = [];
            state.chat.push({
                sender: 'System',
                text: `${data.username} has rejoined the game!`,
                timestamp: Date.now()
            });
            if (state.chat.length > 50)
                state.chat = state.chat.slice(state.chat.length - 50);
            await saveGameState(data.gameId, state);
            return { gameId: data.gameId };
        }
        else {
            throw new functions.HttpsError('already-exists', 'Username already taken in this game.');
        }
    }
    if (state.phase !== 'Lobby') {
        throw new functions.HttpsError('failed-precondition', 'Game already started');
    }
    const colorIndex = state.players.length % PLAYER_COLORS.length;
    const newState = (0, shared_1.addPlayer)(state, {
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
exports.quitGame = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    if (state.phase === 'Lobby') {
        state.players = state.players.filter(p => p.id !== data.playerId);
        if (state.players.length === 0 || !state.players.some(p => !p.isBot)) {
            state.phase = 'GameOver';
        }
        else if (state.hostId === data.playerId) {
            state.hostId = state.players.find(p => !p.isBot)?.id || state.players[0].id;
        }
        await saveGameState(data.gameId, state);
    }
    else {
        const playerIndex = state.players.findIndex(p => p.id === data.playerId);
        if (playerIndex >= 0) {
            const p = state.players[playerIndex];
            const originalName = p.name;
            p.isBot = true;
            if (!p.name.startsWith('🤖')) {
                p.name = `🤖 ${p.name}`;
            }
            if (!state.chat)
                state.chat = [];
            state.chat.push({
                sender: 'System',
                text: `${originalName.replace('🤖 ', '')} has left the game. A bot has taken over.`,
                timestamp: Date.now()
            });
            if (state.chat.length > 50)
                state.chat = state.chat.slice(state.chat.length - 50);
            if (!state.players.some(player => !player.isBot)) {
                state.phase = 'GameOver';
                await saveGameState(data.gameId, state);
            }
            else {
                await emitStateAndProcessBots(data.gameId, state);
            }
        }
    }
    return { success: true };
});
exports.addBot = functions.onCall(async (request) => {
    const data = request.data;
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
    }
    else {
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
    const newBot = {
        id: botId,
        name: `🤖 ${botName}`,
        color: PLAYER_COLORS[colorIndex],
        money: 6000,
        tiles: [],
        stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true,
        stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    };
    const newState = (0, shared_1.addPlayer)(state, newBot);
    await saveGameState(data.gameId, newState);
    return { success: true };
});
exports.startGame = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.startGame)(state);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.playTile = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.playTile)(state, data.playerId, data.tileId);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.foundCorporation = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.foundCorporation)(state, data.playerId, data.corpName);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.chooseMergeSurvivor = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.chooseMergeSurvivor)(state, data.playerId, data.corpName);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.resolveMergeStocks = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.resolveMergeStocks)(state, data.playerId, data.sell, data.trade, data.keep);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.buyStock = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.buyStock)(state, data.playerId, data.corpName);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.endTurn = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const newState = (0, shared_1.endTurn)(state);
    await emitStateAndProcessBots(data.gameId, newState);
    return { success: true };
});
exports.addChatMessage = functions.onCall(async (request) => {
    const data = request.data;
    const state = await getGameState(data.gameId);
    const player = state.players.find(p => p.id === data.playerId);
    if (!player || !data.text || data.text.trim() === '')
        return { success: false };
    if (!state.chat)
        state.chat = [];
    state.chat.push({ sender: player.name.replace('🤖 ', ''), text: data.text.trim(), timestamp: Date.now() });
    if (state.chat.length > 50) {
        state.chat = state.chat.slice(state.chat.length - 50);
    }
    await saveGameState(data.gameId, state);
    return { success: true };
});
exports.cleanupInactiveGames = (0, scheduler_1.onSchedule)('every 15 minutes', async (event) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const snapshot = await db.collection('games')
        .where('updatedAt', '<', oneHourAgo)
        .get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    let count = 0;
    snapshot.docs.forEach((doc) => {
        const state = doc.data();
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
//# sourceMappingURL=index.js.map