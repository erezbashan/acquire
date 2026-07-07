import { GameState, Corporation } from '../types';
import { playTile, foundCorporation, endTurn, resolveMergeStocks, buyStock, chooseMergeSurvivor } from '../engine';
import { CORPORATIONS } from '../index';
import { Bot } from './Bot';

export class RandomBot implements Bot {
  name = 'RandomBot';

  takeTurn(state: GameState, playerId: string): GameState | null {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return null;

    if (state.phase === 'PlayTile') {
      if (player.tiles.length === 0) return null;
      // Play a random tile
      const randomTile = player.tiles[Math.floor(Math.random() * player.tiles.length)];
      return playTile(state, playerId, randomTile.id);
    }

    if (state.phase === 'FoundCorporation' && state.pendingFounding) {
      const availableCorps = CORPORATIONS.filter(c => !state.corporations[c].isActive);
      if (availableCorps.length > 0) {
        const randomCorp = availableCorps[Math.floor(Math.random() * availableCorps.length)];
        return foundCorporation(state, playerId, randomCorp);
      }
    }

    if (state.phase === 'BuyStocks') {
      // Just end turn without buying for random bot, to keep it simple and safe.
      // Or maybe buy random stocks if we have money
      const activeCorps = CORPORATIONS.filter(c => state.corporations[c].isActive && state.corporations[c].availableStocks > 0);
      if (activeCorps.length > 0 && Math.random() > 0.5) {
        // Try to buy 1 stock
        const randomCorp = activeCorps[Math.floor(Math.random() * activeCorps.length)];
        // Let engine validation handle if player lacks money
        try {
          return buyStock(state, playerId, randomCorp);
        } catch (e) {
          return endTurn(state);
        }
      }
      return endTurn(state);
    }

    if (state.phase === 'ChooseMergeSurvivor' && state.pendingSurvivorChoice) {
      const tiedCorps = state.pendingSurvivorChoice.tiedCorps;
      const randomCorp = tiedCorps[Math.floor(Math.random() * tiedCorps.length)];
      return chooseMergeSurvivor(state, playerId, randomCorp);
    }

    if (state.phase === 'MergeResolution' && state.pendingMerge) {
      const defunct = state.pendingMerge.defunct[state.pendingMerge.currentDefunctIndex];
      const myStocks = player.stocks[defunct] || 0;
      if (myStocks === 0) {
        return resolveMergeStocks(state, playerId, 0, 0, 0);
      }
      
      // Randomly decide how to resolve
      // Let's just sell everything to be safe
      return resolveMergeStocks(state, playerId, myStocks, 0, 0);
    }

    return null;
  }
}
