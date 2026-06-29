"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const shared_1 = require("@acquire/shared");
const bot_1 = require("./bot");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});
const games = {};
const PLAYER_COLORS = ['#f97316', '#9333ea', '#84cc16', '#14b8a6', '#d97706', '#475569'];
function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    const playerId = socket.handshake.auth?.playerId || socket.id;
    socket.on('createGame', ({ username }, callback) => {
        const gameId = generateGameId();
        const state = (0, shared_1.createInitialGameState)(gameId);
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
        games[gameId] = newState;
        socket.join(gameId);
        callback({ gameId });
        io.to(gameId).emit('gameState', newState);
    });
    socket.on('joinGame', ({ gameId, username }, callback) => {
        const state = games[gameId];
        if (!state) {
            return callback({ error: 'Game not found' });
        }
        if (state.phase !== 'Lobby') {
            return callback({ error: 'Game already started' });
        }
        const colorIndex = state.players.length % PLAYER_COLORS.length;
        const newState = (0, shared_1.addPlayer)(state, {
            id: playerId,
            name: username,
            color: PLAYER_COLORS[colorIndex],
            money: 6000,
            tiles: [],
            stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
            isBot: false,
            stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
        });
        games[gameId] = newState;
        socket.join(gameId);
        callback({ success: true });
        io.to(gameId).emit('gameState', newState);
    });
    socket.on('addBot', ({ gameId }) => {
        const state = games[gameId];
        if (state && state.phase === 'Lobby') {
            const botNames = ['HAL', 'EVE', 'ZIM', 'GIR', 'BOB', 'TOM', 'LEO', 'MAX', 'SAM', 'ROY', 'BEN', 'DAN', 'RAY', 'JON'];
            const usedNames = state.players.map(p => p.name.replace('🤖 ', ''));
            const availableNames = botNames.filter(n => !usedNames.includes(n));
            const botName = availableNames.length > 0
                ? availableNames[Math.floor(Math.random() * availableNames.length)]
                : `Bot${state.players.length}`;
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
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
        }
    });
    socket.on('rejoinGame', ({ gameId }) => {
        const state = games[gameId];
        if (state) {
            socket.join(gameId);
            socket.emit('gameState', state);
        }
    });
    socket.on('startGame', ({ gameId }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.startGame)(state);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('playTile', ({ gameId, tileId }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.playTile)(state, playerId, tileId);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('foundCorporation', ({ gameId, corpName }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.foundCorporation)(state, playerId, corpName);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('buyStock', ({ gameId, corpName }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.buyStock)(state, playerId, corpName);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('endTurn', ({ gameId }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.endTurn)(state);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('chooseMergeSurvivor', ({ gameId, survivorName }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.chooseMergeSurvivor)(state, playerId, survivorName);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    socket.on('resolveMergeStocks', ({ gameId, sellCount, tradeCount, keepCount }) => {
        const state = games[gameId];
        if (state) {
            const newState = (0, shared_1.resolveMergeStocks)(state, playerId, sellCount, tradeCount, keepCount);
            games[gameId] = newState;
            io.to(gameId).emit('gameState', newState);
            (0, bot_1.processBotTurn)(newState, (s) => emitStateAndProcessBots(gameId, s));
        }
    });
    function emitStateAndProcessBots(gameId, state) {
        games[gameId] = state;
        io.to(gameId).emit('gameState', state);
        (0, bot_1.processBotTurn)(state, (s) => emitStateAndProcessBots(gameId, s));
    }
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Handle disconnects (e.g., set player to inactive or remove if in lobby)
    });
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
