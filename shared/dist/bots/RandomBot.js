"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RandomBot = void 0;
const engine_1 = require("../engine");
const index_1 = require("../index");
class RandomBot {
    name = 'RandomBot';
    takeTurn(state, playerId) {
        const player = state.players.find(p => p.id === playerId);
        if (!player)
            return null;
        if (state.phase === 'PlayTile') {
            if (player.tiles.length === 0)
                return null;
            // Play a random tile
            const randomTile = player.tiles[Math.floor(Math.random() * player.tiles.length)];
            return (0, engine_1.playTile)(state, playerId, randomTile.id);
        }
        if (state.phase === 'FoundCorporation' && state.pendingFounding) {
            const availableCorps = index_1.CORPORATIONS.filter(c => !state.corporations[c].isActive);
            if (availableCorps.length > 0) {
                const randomCorp = availableCorps[Math.floor(Math.random() * availableCorps.length)];
                return (0, engine_1.foundCorporation)(state, playerId, randomCorp);
            }
        }
        if (state.phase === 'BuyStocks') {
            // Just end turn without buying for random bot, to keep it simple and safe.
            // Or maybe buy random stocks if we have money
            const activeCorps = index_1.CORPORATIONS.filter(c => state.corporations[c].isActive && state.corporations[c].availableStocks > 0);
            if (activeCorps.length > 0 && Math.random() > 0.5) {
                // Try to buy 1 stock
                const randomCorp = activeCorps[Math.floor(Math.random() * activeCorps.length)];
                // Let engine validation handle if player lacks money
                try {
                    return (0, engine_1.buyStock)(state, playerId, randomCorp);
                }
                catch (e) {
                    return (0, engine_1.endTurn)(state);
                }
            }
            return (0, engine_1.endTurn)(state);
        }
        if (state.phase === 'ChooseMergeSurvivor' && state.pendingSurvivorChoice) {
            const tiedCorps = state.pendingSurvivorChoice.tiedCorps;
            const randomCorp = tiedCorps[Math.floor(Math.random() * tiedCorps.length)];
            return (0, engine_1.chooseMergeSurvivor)(state, playerId, randomCorp);
        }
        if (state.phase === 'MergeResolution' && state.pendingMerge) {
            const defunct = state.pendingMerge.defunct[state.pendingMerge.currentDefunctIndex];
            const myStocks = player.stocks[defunct] || 0;
            if (myStocks === 0) {
                return (0, engine_1.resolveMergeStocks)(state, playerId, 0, 0, 0);
            }
            // Randomly decide how to resolve
            // Let's just sell everything to be safe
            return (0, engine_1.resolveMergeStocks)(state, playerId, myStocks, 0, 0);
        }
        return null;
    }
}
exports.RandomBot = RandomBot;
