import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { db, functions } from './firebase';
import type { GameState } from '@acquire/shared';

interface SocketContextType {
  connected: boolean;
  gameState: GameState | null;
  openGames: GameState[];
  createGame: (username: string) => Promise<string>;
  joinGame: (gameId: string, username: string) => Promise<boolean>;
  quitGame: (gameId: string) => Promise<void>;
  rejoinGame: (gameId: string) => void;
  addBot: (gameId: string) => void;
  playTile: (gameId: string, tileId: string) => Promise<void>;
  foundCorporation: (gameId: string, corpName: string) => Promise<void>;
  addChatMessage: (gameId: string, text: string) => Promise<void>;
  chooseMergeSurvivor: (gameId: string, corpName: string) => Promise<void>;
  resolveMergeStocks: (gameId: string, sell: number, trade: number, keep: number) => void;
  startGame: (gameId: string) => void;
  buyStock: (gameId: string, corpName: string) => void;
  endTurn: (gameId: string) => void;
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
  const [openGames, setOpenGames] = useState<GameState[]>([]);
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

  useEffect(() => {
    const q = query(collection(db, 'games'), where('phase', '==', 'Lobby'), limit(15));
    const unsub = onSnapshot(q, (snapshot) => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      setOpenGames(
        snapshot.docs
          .map(d => d.data() as GameState)
          .filter(g => g.players.some(p => !p.isBot) && (g.updatedAt || 0) > oneHourAgo)
      );
    });
    return () => unsub();
  }, []);

  const withLoading = async <T,>(action: () => Promise<T>): Promise<T> => {
    let timeout: any;
    let completed = false;
    
    timeout = setTimeout(() => {
      if (!completed) {
        document.body.classList.add('global-loading');
      }
    }, 100);

    try {
      return await action();
    } finally {
      completed = true;
      clearTimeout(timeout);
      document.body.classList.remove('global-loading');
    }
  };

  const createGame = async (username: string): Promise<string> => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'createGame');
      const result = await fn({ username, playerId });
      const data = result.data as { gameId: string };
      setActiveGameId(data.gameId);
      localStorage.setItem('acquire_username', username);
      return data.gameId;
    });
  };

  const joinGame = async (gameId: string, username: string): Promise<boolean> => {
    return withLoading(async () => {
      try {
        const fn = httpsCallable(functions, 'joinGame');
        await fn({ gameId, username, playerId });
        setActiveGameId(gameId);
        localStorage.setItem('acquire_username', username);
        return true;
      } catch (e: any) {
        alert(e.message);
        return false;
      }
    });
  };

  const quitGame = async (gameId: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'quitGame');
      await fn({ gameId, playerId });
    });
  };

  const addBot = async (gameId: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'addBot');
      await fn({ gameId });
    });
  };

  const startGame = async (gameId: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'startGame');
      await fn({ gameId });
    });
  };

  const playTile = async (gameId: string, tileId: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'playTile');
      await fn({ gameId, tileId, playerId });
    });
  };

  const foundCorporation = async (gameId: string, corpName: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'foundCorporation');
      await fn({ gameId, corpName, playerId });
    });
  };

  const addChatMessage = async (gameId: string, text: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'addChatMessage');
      await fn({ gameId, playerId, text });
    });
  };

  const chooseMergeSurvivor = async (gameId: string, corpName: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'chooseMergeSurvivor');
      await fn({ gameId, corpName, playerId });
    });
  };

  const resolveMergeStocks = async (gameId: string, sell: number, trade: number, keep: number) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'resolveMergeStocks');
      await fn({ gameId, sell, trade, keep, playerId });
    });
  };

  const buyStock = async (gameId: string, corpName: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'buyStock');
      await fn({ gameId, corpName, playerId });
    });
  };

  const endTurn = async (gameId: string) => {
    return withLoading(async () => {
      const fn = httpsCallable(functions, 'endTurn');
      await fn({ gameId, playerId });
    });
  };

  const rejoinGame = (gameId: string) => {
    setActiveGameId(gameId);
  };

  return (
    <SocketContext.Provider value={{
      gameState,
      openGames,
      connected,
      createGame,
      joinGame,
      quitGame,
      addBot,
      startGame,
      playTile,
      foundCorporation,
      addChatMessage,
      chooseMergeSurvivor,
      resolveMergeStocks,
      buyStock,
      endTurn,
      rejoinGame,
      playerId
    }}>
      {children}
    </SocketContext.Provider>
  );
};
