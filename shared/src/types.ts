export type Corporation =
  | 'Tower'
  | 'Luxor'
  | 'American'
  | 'Worldwide'
  | 'Festival'
  | 'Imperial'
  | 'Continental';

export type TileId = `${number}${string}`; // e.g., '1A', '9L'

export interface Tile {
  id: TileId;
  row: number; // 0-8 (for 1-9)
  col: number; // 0-11 (for A-L)
}

export type BoardCell = Corporation | 'Unincorporated' | null;

export interface Player {
  id: string;
  name: string;
  money: number;
  tiles: Tile[];
  stocks: Record<Corporation, number>;
  isBot: boolean;
}

export interface CorporationState {
  name: Corporation;
  size: number; // Number of tiles
  stockPrice: number;
  majorityBonus: number;
  minorityBonus: number;
  availableStocks: number;
  isSafe: boolean; // Size >= 11
  isActive: boolean; // Has been founded
}

export type GamePhase =
  | 'Lobby'
  | 'PlayTile'
  | 'FoundCorporation'
  | 'BuyStocks'
  | 'ChooseMergeSurvivor'
  | 'MergeResolution'
  | 'DrawTile'
  | 'GameOver';

export interface GameState {
  id: string;
  players: Player[];
  currentPlayerIndex: number;
  board: BoardCell[][]; // 9x12 grid
  corporations: Record<Corporation, CorporationState>;
  availableTiles: Tile[];
  phase: GamePhase;
  sharesBoughtThisTurn: number; // Max 3
  turnOrder: string[]; // Player IDs
  logs: string[];
  history: { turn: number, netWorths: Record<string, number> }[];
  
  // Pending state for merges
  pendingMerge?: {
    mergerId: string; // Player who caused it
    acquirer: Corporation;
    defunct: Corporation[];
    currentDefunctIndex: number;
    playerResolutionIndex: number; // Which player is currently resolving their stocks
    playersResolved: string[]; // Players who have resolved this defunct corp
  };

  // Pending state for survivor choice
  pendingSurvivorChoice?: {
    playerId: string;
    tileId: TileId;
    tiedCorps: Corporation[];
    allCorpsInvolved: Corporation[];
  };
  pendingFounding?: {
    playerId: string;
    tileId: TileId;
    availableCorps: Corporation[];
    size: number;
  };
}

export interface GameAction {
  type: string;
  playerId: string;
  payload?: any;
}
