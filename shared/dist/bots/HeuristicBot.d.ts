import { GameState } from '../types';
import { Bot } from './Bot';
export declare class HeuristicBot implements Bot {
    name: string;
    private evaluateTile;
    takeTurn(state: GameState, playerId: string): GameState | null;
}
