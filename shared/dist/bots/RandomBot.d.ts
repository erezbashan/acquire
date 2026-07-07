import { GameState } from '../types';
import { Bot } from './Bot';
export declare class RandomBot implements Bot {
    name: string;
    takeTurn(state: GameState, playerId: string): GameState | null;
}
