import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { 
  GameState, 
  createInitialGameState, 
  addPlayer, 
  startGame, 
  playTile,
  foundCorporation,
  buyStock,
  chooseMergeSurvivor,
  endTurn,
  resolveMergeStocks
} from '@acquire/shared';
import { processBotTurn } from './bot';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

const games: Record<string, GameState> = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('createGame', ({ username }, callback) => {
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const state = createInitialGameState(gameId);
    const newState = addPlayer(state, {
      id: socket.id,
      name: username,
      money: 0,
      tiles: [],
      stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
      isBot: false
    });
    
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

    const newState = addPlayer(state, {
      id: socket.id,
      name: username,
      money: 0,
      tiles: [],
      stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
      isBot: false
    });

    games[gameId] = newState;
    socket.join(gameId);
    callback({ success: true });
    io.to(gameId).emit('gameState', newState);
  });

  socket.on('addBot', ({ gameId }) => {
    const state = games[gameId];
    if (state && state.phase === 'Lobby') {
      const botNumber = state.players.filter(p => p.isBot).length + 1;
      const botId = `bot-${botNumber}-${Math.random().toString(36).substr(2, 5)}`;
      const newState = addPlayer(state, {
        id: botId,
        name: `Bot ${botNumber}`,
        money: 0,
        tiles: [],
        stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true
      });
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
    }
  });

  socket.on('startGame', ({ gameId }) => {
    const state = games[gameId];
    if (state) {
      const newState = startGame(state);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('playTile', ({ gameId, tileId }) => {
    const state = games[gameId];
    if (state) {
      const newState = playTile(state, socket.id, tileId);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('foundCorporation', ({ gameId, corpName }) => {
    const state = games[gameId];
    if (state) {
      const newState = foundCorporation(state, socket.id, corpName);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('buyStock', ({ gameId, corpName }) => {
    const state = games[gameId];
    if (state) {
      const newState = buyStock(state, socket.id, corpName);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('endTurn', ({ gameId }) => {
    const state = games[gameId];
    if (state) {
      const newState = endTurn(state);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('chooseMergeSurvivor', ({ gameId, survivorName }) => {
    let state = games[gameId];
    if (state) {
      state = chooseMergeSurvivor(state, socket.id, survivorName);
      games[gameId] = state;
      io.to(gameId).emit('gameState', state);
      processBotTurn(state, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  socket.on('resolveMergeStocks', ({ gameId, sellCount, tradeCount, keepCount }) => {
    const state = games[gameId];
    if (state) {
      const newState = resolveMergeStocks(state, socket.id, sellCount, tradeCount, keepCount);
      games[gameId] = newState;
      io.to(gameId).emit('gameState', newState);
      processBotTurn(newState, (s) => emitStateAndProcessBots(gameId, s));
    }
  });

  function emitStateAndProcessBots(gameId: string, state: GameState) {
    games[gameId] = state;
    io.to(gameId).emit('gameState', state);
    processBotTurn(state, (s) => emitStateAndProcessBots(gameId, s));
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
