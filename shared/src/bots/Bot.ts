import { GameState } from '../types';

export interface Bot {
  name: string;
  takeTurn(state: GameState, playerId: string): GameState | null;
}
