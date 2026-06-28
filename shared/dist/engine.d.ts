import { GameState, Player, Tile, TileId } from './types';
export declare function createInitialTiles(): Tile[];
export declare function createInitialGameState(id: string): GameState;
export declare function addPlayer(state: GameState, player: Player): GameState;
export declare function startGame(state: GameState): GameState;
export declare function playTile(state: GameState, playerId: string, tileId: TileId): GameState;
export declare function endTurn(state: GameState): GameState;
export declare function calculateNetWorth(state: GameState, playerId: string): number;
