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
    color: string;
    money: number;
    tiles: Tile[];
    stocks: Record<Corporation, number>;
    isBot: boolean;
    stats: {
        chainsFounded: number;
        mergesCaused: number;
        firstBonuses: number;
        secondBonuses: number;
        sharesBought: number;
    };
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
export type GamePhase = 'Lobby' | 'PlayTile' | 'FoundCorporation' | 'BuyStocks' | 'ChooseMergeSurvivor' | 'MergeResolution' | 'DrawTile' | 'GameOver';
export interface GameState {
    id: string;
    players: Player[];
    currentPlayerIndex: number;
    board: Record<number, BoardCell[]>;
    corporations: Record<Corporation, CorporationState>;
    availableTiles: Tile[];
    phase: GamePhase;
    sharesBoughtThisTurn: number;
    turnOrder: string[];
    logs: string[];
    history: {
        turn: number;
        netWorths: Record<string, number>;
    }[];
    pendingMerge?: {
        mergerId: string;
        acquirer: Corporation;
        defunct: Corporation[];
        currentDefunctIndex: number;
        playerResolutionIndex: number;
        playersResolved: string[];
        defunctTiles: {
            row: number;
            col: number;
            corp: Corporation;
        }[];
    };
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
