import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '@acquire/shared';

interface SocketContextType {
  socket: Socket | null;
  gameState: GameState | null;
  connected: boolean;
  createGame: (username: string) => Promise<string>;
  joinGame: (gameId: string, username: string) => Promise<boolean>;
  addBot: (gameId: string) => void;
  startGame: (gameId: string) => void;
  playTile: (gameId: string, tileId: string) => void;
  foundCorporation: (gameId: string, corpName: string) => void;
  buyStock: (gameId: string, corpName: string) => void;
  endTurn: (gameId: string) => void;
  rejoinGame: (gameId: string) => void;
  playerId: string;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerId] = useState(() => {
    let localPlayerId = localStorage.getItem('acquire_player_id');
    if (!localPlayerId) {
      localPlayerId = `p-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('acquire_player_id', localPlayerId);
    }
    return localPlayerId;
  });

  useEffect(() => {
    const newSocket = io(window.location.origin.replace('3000', '3001'), {
      auth: { playerId }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createGame = (username: string): Promise<string> => {
    return new Promise((resolve) => {
      socket?.emit('createGame', { username }, (response: { gameId: string }) => {
        resolve(response.gameId);
      });
    });
  };

  const joinGame = (gameId: string, username: string): Promise<boolean> => {
    return new Promise((resolve) => {
      socket?.emit('joinGame', { gameId, username }, (response: { success?: boolean, error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          alert(response.error);
          resolve(false);
        }
      });
    });
  };

  const addBot = (gameId: string) => {
    socket?.emit('addBot', { gameId });
  };

  const startGame = (gameId: string) => {
    socket?.emit('startGame', { gameId });
  };

  const playTile = (gameId: string, tileId: string) => {
    socket?.emit('playTile', { gameId, tileId });
  };

  const foundCorporation = (gameId: string, corpName: string) => {
    socket?.emit('foundCorporation', { gameId, corpName });
  };

  const buyStock = (gameId: string, corpName: string) => {
    socket?.emit('buyStock', { gameId, corpName });
  };

  const endTurn = (gameId: string) => {
    socket?.emit('endTurn', { gameId });
  };

  const rejoinGame = (gameId: string) => {
    socket?.emit('rejoinGame', { gameId });
  };

  return (
    <SocketContext.Provider value={{
      socket, gameState, connected, createGame, joinGame, addBot, startGame, playTile, foundCorporation, buyStock, endTurn, rejoinGame, playerId
    }}>
      {children}
    </SocketContext.Provider>
  );
};
