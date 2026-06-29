import { BoardCell, Corporation, GameState, Player, Tile, TileId } from './types';
export declare const CORPORATIONS: Corporation[];
export declare function createInitialTiles(): Tile[];
export declare function createInitialGameState(id: string): GameState;
export declare function addPlayer(state: GameState, player: Player): GameState;
export declare function startGame(state: GameState): GameState;
export declare function playTile(state: GameState, playerId: string, tileId: TileId): GameState;
export declare function chooseMergeSurvivor(state: GameState, playerId: string, survivorName: Corporation): GameState;
export declare function resolveMergeStocks(state: GameState, playerId: string, sellCount: number, tradeCount: number, keepCount: number): GameState;
export declare function foundCorporation(state: GameState, playerId: string, corpName: Corporation): GameState;
export declare function getAdjacentCells(board: BoardCell[][], row: number, col: number): {
    r: number;
    c: number;
    val: BoardCell;
}[];
export declare function getStockPrice(corpName: Corporation, size: number): number;
export declare function fillCorporation(board: BoardCell[][], row: number, col: number, corpName: Corporation): {
    board: BoardCell[][];
    count: number;
};
export declare function buyStock(state: GameState, playerId: string, corpName: Corporation): GameState;
export declare function isTileUnplayable(state: GameState, tile: Tile): boolean;
export declare function endTurn(state: GameState): GameState;
export interface PlayerFinancials {
    cash: number;
    stockValue: number;
    bonusValue: number;
    netWorth: number;
}
export declare function getPlayerFinancials(state: GameState, playerId: string): PlayerFinancials;
export declare function calculateNetWorth(state: GameState, playerId: string): number;
