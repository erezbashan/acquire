"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBotTurn = processBotTurn;
const shared_1 = require("@acquire/shared");
// Helper to evaluate a tile play score
function evaluateTile(state, playerId, tileId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return -10000;
    const match = tileId.match(/^(\d+)([A-Z])$/);
    if (!match)
        return -10000;
    const row = parseInt(match[1]) - 1;
    const col = match[2].charCodeAt(0) - 65;
    const neighbors = (0, shared_1.getAdjacentCells)(state.board, row, col);
    const adjacentCorps = Array.from(new Set(neighbors.map(n => n.val).filter(val => val !== null && val !== 'Unincorporated')));
    const adjacentUnincorporated = neighbors.filter(n => n.val === 'Unincorporated');
    // Check if unplayable
    if (adjacentCorps.length > 1) {
        const safeCorps = adjacentCorps.filter(c => state.corporations[c].isSafe);
        if (safeCorps.length > 1)
            return -10000; // Illegal merger
    }
    if (adjacentCorps.length === 0 && adjacentUnincorporated.length > 0) {
        const availableCorps = shared_1.CORPORATIONS.filter(c => !state.corporations[c].isActive);
        if (availableCorps.length === 0)
            return -10000; // Illegal founding
    }
    // Scoring
    if (adjacentCorps.length > 1) {
        // Merger
        const sortedCorps = [...adjacentCorps].sort((a, b) => state.corporations[b].size - state.corporations[a].size);
        const defunctCorps = sortedCorps.slice(1);
        // Check if we hold stocks in defunct corps
        let mergerScore = 0;
        for (const dCorp of defunctCorps) {
            const myStocks = player.stocks[dCorp] || 0;
            if (myStocks > 0) {
                // Are we majority or minority?
                const holders = state.players.map(p => ({ id: p.id, count: p.stocks[dCorp] || 0 })).filter(h => h.count > 0).sort((a, b) => b.count - a.count);
                if (holders.length > 0 && holders[0].id === playerId) {
                    mergerScore += 1000; // Majority!
                }
                else if (holders.length > 1 && holders[1].id === playerId) {
                    mergerScore += 500; // Minority!
                }
                else {
                    mergerScore += 200; // Just some cash
                }
            }
        }
        if (mergerScore > 0)
            return mergerScore;
        return -200; // Causing a merger we don't benefit from
    }
    if (adjacentCorps.length === 0 && adjacentUnincorporated.length > 0) {
        // Founding
        return 500;
    }
    if (adjacentCorps.length === 1) {
        // Growing
        const corp = adjacentCorps[0];
        const myStocks = player.stocks[corp] || 0;
        const holders = state.players.map(p => ({ id: p.id, count: p.stocks[corp] || 0 })).filter(h => h.count > 0).sort((a, b) => b.count - a.count);
        if (holders.length > 0 && holders[0].id === playerId) {
            return 200; // We are majority, grow it
        }
        if (myStocks === 0 && state.corporations[corp].size >= 8) {
            return -500; // Helping opponents make it safe
        }
        return 50; // Generic grow
    }
    return 0; // Isolated tile
}
function processBotTurn(state, emitNewState) {
    const currentPlayerId = state.phase === 'MergeResolution' && state.pendingMerge
        ? state.turnOrder[state.pendingMerge.playerResolutionIndex]
        : state.turnOrder[state.currentPlayerIndex];
    const currentPlayer = state.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer || !currentPlayer.isBot) {
        return;
    }
    const BOT_CHATS = [
        "Just buying some cheap stocks.",
        "You're going down!",
        "Hmm...",
        "I should have bought Luxor.",
        "Why is everyone targeting me?",
        "I love this game.",
        "Are we merging soon?",
        "My tiles are terrible.",
        "I'm feeling lucky today.",
        "This board is getting crowded."
    ];
    const hasHumanChatted = state.chat && state.chat.some(msg => {
        const senderPlayer = state.players.find(p => p.name === msg.sender || p.name.replace('🤖 ', '') === msg.sender);
        return senderPlayer && !senderPlayer.isBot;
    });
    const lastChat = state.lastBotChatAt || 0;
    const timeSinceLastChat = Date.now() - lastChat;
    if (!hasHumanChatted && timeSinceLastChat > 60000) { // At least 1 minute
        const chatInterval = Math.random() * 4 * 60 * 1000 + 60 * 1000; // 1 to 5 minutes
        if (timeSinceLastChat > chatInterval) {
            if (!state.chat)
                state.chat = [];
            const allBots = state.players.filter(p => p.isBot);
            const randomBot = allBots.length > 0 ? allBots[Math.floor(Math.random() * allBots.length)] : currentPlayer;
            state.chat.push({
                sender: randomBot.name.replace('🤖 ', ''),
                text: BOT_CHATS[Math.floor(Math.random() * BOT_CHATS.length)],
                timestamp: Date.now()
            });
            if (state.chat.length > 50)
                state.chat = state.chat.slice(state.chat.length - 50);
            state.lastBotChatAt = Date.now();
        }
    }
    if (state.phase === 'PlayTile') {
        // Find the best tile to play
        let bestTile = currentPlayer.tiles[0];
        let bestScore = -Infinity;
        const playableTiles = currentPlayer.tiles.filter(t => evaluateTile(state, currentPlayerId, t.id) > -9000);
        if (playableTiles.length > 0) {
            for (const tile of playableTiles) {
                const score = evaluateTile(state, currentPlayerId, tile.id);
                if (score > bestScore) {
                    bestScore = score;
                    bestTile = tile;
                }
                else if (score === bestScore && Math.random() > 0.5) {
                    bestTile = tile;
                }
            }
            const newState = (0, shared_1.playTile)(state, currentPlayerId, bestTile.id);
            emitNewState(newState);
        }
        else {
            // No playable tiles? Just play the first one, engine will discard it
            const newState = (0, shared_1.playTile)(state, currentPlayerId, currentPlayer.tiles[0].id);
            emitNewState(newState);
        }
    }
    else if (state.phase === 'FoundCorporation' && state.pendingFounding?.playerId === currentPlayerId) {
        // Found cheapest corporation to save cash for stocks
        // In Acquire, lower tier = cheaper (Tower, Luxor < American, Worldwide, Festival < Imperial, Continental)
        const tierMap = {
            'Tower': 1, 'Luxor': 1,
            'American': 2, 'Worldwide': 2, 'Festival': 2,
            'Imperial': 3, 'Continental': 3
        };
        let bestCorp = state.pendingFounding.availableCorps[0];
        let bestTier = 4;
        for (const corp of state.pendingFounding.availableCorps) {
            // If we already hold stocks from a previous defunct state, prioritize it!
            if ((currentPlayer.stocks[corp] || 0) > 0) {
                bestCorp = corp;
                break;
            }
            if (tierMap[corp] < bestTier) {
                bestTier = tierMap[corp];
                bestCorp = corp;
            }
        }
        const newState = (0, shared_1.foundCorporation)(state, currentPlayerId, bestCorp);
        emitNewState(newState);
    }
    else if (state.phase === 'ChooseMergeSurvivor' && state.pendingSurvivorChoice?.playerId === currentPlayerId) {
        // If tied, the bot picks the one it holds more stocks in
        const tiedCorps = state.pendingSurvivorChoice.tiedCorps;
        let bestCorp = tiedCorps[0];
        let maxStocks = -1;
        for (const corp of tiedCorps) {
            const myStocks = currentPlayer.stocks[corp] || 0;
            if (myStocks > maxStocks) {
                maxStocks = myStocks;
                bestCorp = corp;
            }
        }
        const { chooseMergeSurvivor } = require('@acquire/shared');
        const newState = chooseMergeSurvivor(state, currentPlayerId, bestCorp);
        emitNewState(newState);
    }
    else if (state.phase === 'MergeResolution' && state.pendingMerge && state.turnOrder[state.pendingMerge.playerResolutionIndex] === currentPlayerId) {
        const pm = state.pendingMerge;
        const dCorp = pm.defunct[pm.currentDefunctIndex];
        const aCorp = pm.acquirer;
        const currentStocks = currentPlayer.stocks[dCorp] || 0;
        // Bot strategy: Trade as much as possible for the better chain, sell the rest
        const acquirerAvailable = state.corporations[aCorp].availableStocks;
        const maxPossibleTrades = Math.floor(currentStocks / 2) * 2;
        const actualTrades = Math.min(maxPossibleTrades, acquirerAvailable * 2);
        const tradeCount = actualTrades;
        const sellCount = currentStocks - tradeCount;
        const keepCount = 0;
        const newState = (0, shared_1.resolveMergeStocks)(state, currentPlayerId, sellCount, tradeCount, keepCount);
        emitNewState(newState);
    }
    else if (state.phase === 'BuyStocks') {
        let tempState = { ...state };
        let remainingCash = currentPlayer.money;
        let boughtThisTurn = 0;
        const activeCorps = shared_1.CORPORATIONS.filter(c => tempState.corporations[c].isActive && tempState.corporations[c].availableStocks > 0);
        while (boughtThisTurn < 3 && remainingCash > 0 && activeCorps.length > 0) {
            // Score active corps
            let bestCorp = null;
            let bestScore = -Infinity;
            for (const corp of activeCorps) {
                if (tempState.corporations[corp].availableStocks <= 0)
                    continue;
                if (tempState.corporations[corp].stockPrice > remainingCash)
                    continue;
                let score = 0;
                const corpData = tempState.corporations[corp];
                // Priority 1: Close to safe
                if (corpData.size >= 8 && !corpData.isSafe)
                    score += 100;
                // Priority 2: Securing majority/minority
                const myStocks = (tempState.players.find(p => p.id === currentPlayerId)?.stocks[corp] || 0) + 1; // if we buy it
                const holders = tempState.players.map(p => ({ id: p.id, count: p.id === currentPlayerId ? myStocks : (p.stocks[corp] || 0) })).sort((a, b) => b.count - a.count);
                if (holders[0].id === currentPlayerId)
                    score += 50; // Maintain majority
                else if (holders[1]?.id === currentPlayerId)
                    score += 30; // Maintain minority
                // Priority 3: Cheaper is slightly better for volume
                score -= corpData.stockPrice / 100;
                if (score > bestScore) {
                    bestScore = score;
                    bestCorp = corp;
                }
            }
            if (bestCorp) {
                tempState = (0, shared_1.buyStock)(tempState, currentPlayerId, bestCorp);
                remainingCash -= tempState.corporations[bestCorp].stockPrice;
                boughtThisTurn++;
                if (tempState.phase !== 'BuyStocks') {
                    break; // Engine auto-ended turn
                }
            }
            else {
                break; // Cannot afford anything else
            }
        }
        const finalState = tempState.phase === 'BuyStocks' ? (0, shared_1.endTurn)(tempState) : tempState;
        emitNewState(finalState);
    }
}
//# sourceMappingURL=bot.js.map