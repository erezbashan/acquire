import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from './firebase';
import type { GameState } from '@acquire/shared';

interface SocketContextType {
  socket: null;
  gameState: GameState | null;
  connected: boolean;
  createGame: (username: string) => Promise<string>;
  joinGame: (gameId: string, username: string) => Promise<boolean>;
  addBot: (gameId: string) => void;
  startGame: (gameId: string) => void;
  playTile: (gameId: string, tileId: string) => void;
  foundCorporation: (gameId: string, corpName: string) => void;
  chooseMergeSurvivor: (gameId: string, corpName: string) => void;
  resolveMergeStocks: (gameId: string, sell: number, trade: number, keep: number) => void;
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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected] = useState(true); // Always connected in serverless
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const [playerId] = useState(() => {
    let localPlayerId = localStorage.getItem('acquire_player_id');
    if (!localPlayerId) {
      localPlayerId = `p-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('acquire_player_id', localPlayerId);
    }
    return localPlayerId;
  });

  useEffect(() => {
    if (!activeGameId) return;

    const unsub = onSnapshot(doc(db, 'games', activeGameId), (doc) => {
      if (doc.exists()) {
        setGameState(doc.data() as GameState);
      }
    });

    return () => unsub();
  }, [activeGameId]);

  const createGame = async (username: string): Promise<string> => {
    const fn = httpsCallable(functions, 'createGame');
    const result = await fn({ username, playerId });
    const data = result.data as { gameId: string };
    setActiveGameId(data.gameId);
    return data.gameId;
  };

  const joinGame = async (gameId: string, username: string): Promise<boolean> => {
    try {
      const fn = httpsCallable(functions, 'joinGame');
      await fn({ gameId, username, playerId });
      setActiveGameId(gameId);
      return true;
    } catch (e: any) {
      alert(e.message);
      return false;
    }
  };

  const addBot = async (gameId: string) => {
    const fn = httpsCallable(functions, 'addBot');
    await fn({ gameId });
  };

  const startGame = async (gameId: string) => {
    const fn = httpsCallable(functions, 'startGame');
    await fn({ gameId });
  };

  const playTile = async (gameId: string, tileId: string) => {
    const fn = httpsCallable(functions, 'playTile');
    await fn({ gameId, tileId, playerId });
  };

  const foundCorporation = async (gameId: string, corpName: string) => {
    const fn = httpsCallable(functions, 'foundCorporation');
    await fn({ gameId, corpName, playerId });
  };

  const chooseMergeSurvivor = async (gameId: string, corpName: string) => {
    const fn = httpsCallable(functions, 'chooseMergeSurvivor');
    await fn({ gameId, corpName, playerId });
  };

  const resolveMergeStocks = async (gameId: string, sell: number, trade: number, keep: number) => {
    const fn = httpsCallable(functions, 'resolveMergeStocks');
    await fn({ gameId, sell, trade, keep, playerId });
  };

  const buyStock = async (gameId: string, corpName: string) => {
    const fn = httpsCallable(functions, 'buyStock');
    await fn({ gameId, corpName, playerId });
  };

  const endTurn = async (gameId: string) => {
    const fn = httpsCallable(functions, 'endTurn');
    await fn({ gameId, playerId });
  };

  const rejoinGame = (gameId: string) => {
    setActiveGameId(gameId);
  };

  return (
    <SocketContext.Provider value={{
      socket: null, gameState, connected, createGame, joinGame, addBot, startGame, playTile, 
      foundCorporation, chooseMergeSurvivor, resolveMergeStocks, buyStock, endTurn, rejoinGame, playerId
    }}>
      {children}
    </SocketContext.Provider>
  );
};
