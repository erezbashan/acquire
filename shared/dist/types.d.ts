export type Corporation = 'Tower' | 'Luxor' | 'American' | 'Worldwide' | 'Festival' | 'Imperial' | 'Continental';
export type TileId = `${number}${string}`;
export interface Tile {
    id: TileId;
    row: number;
    col: number;
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
    size: number;
    stockPrice: number;
    majorityBonus: number;
    minorityBonus: number;
    availableStocks: number;
    isSafe: boolean;
    isActive: boolean;
}
export type GamePhase = 'Lobby' | 'PlayTile' | 'FoundCorporation' | 'BuyStocks' | 'MergeResolution' | 'DrawTile' | 'GameOver';
export interface GameState {
    id: string;
    players: Player[];
    currentPlayerIndex: number;
    board: BoardCell[][];
    corporations: Record<Corporation, CorporationState>;
    availableTiles: Tile[];
    phase: GamePhase;
    turnOrder: string[];
    logs: string[];
    pendingMerge?: {
        mergerId: string;
        acquirer: Corporation;
        defunct: Corporation[];
        currentDefunctIndex: number;
        playerResolutionIndex: number;
    };
    pendingFounding?: {
        playerId: string;
        tileId: TileId;
        availableCorps: Corporation[];
    };
}
export interface GameAction {
    type: string;
    playerId: string;
    payload?: any;
}
