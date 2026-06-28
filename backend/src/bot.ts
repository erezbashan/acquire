import { GameState, playTile, foundCorporation, endTurn, resolveMergeStocks } from '@acquire/shared';

// Very basic bot logic: just play the first available tile
export function processBotTurn(state: GameState, emitNewState: (state: GameState) => void) {
  const currentPlayerId = state.phase === 'MergeResolution' && state.pendingMerge 
    ? state.turnOrder[state.pendingMerge.playerResolutionIndex]
    : state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);

  if (!currentPlayer || !currentPlayer.isBot) {
    return;
  }

  // Simulate thinking time
  setTimeout(() => {
    if (state.phase === 'PlayTile') {
      const tileToPlay = currentPlayer.tiles[0];
      if (tileToPlay) {
        const newState = playTile(state, currentPlayerId, tileToPlay.id);
        emitNewState(newState);
      }
    } else if (state.phase === 'FoundCorporation' && state.pendingFounding?.playerId === currentPlayerId) {
       const corpToFound = state.pendingFounding.availableCorps[0];
       const newState = foundCorporation(state, currentPlayerId, corpToFound);
       emitNewState(newState);
    } else if (state.phase === 'MergeResolution' && state.pendingMerge && state.turnOrder[state.pendingMerge.playerResolutionIndex] === currentPlayerId) {
       const pm = state.pendingMerge;
       const dCorp = pm.defunct[pm.currentDefunctIndex];
       const currentStocks = currentPlayer.stocks[dCorp] || 0;
       
       // Bot strategy: Trade as much as possible, keep the rest
       // (Keeping is safer than selling randomly if we don't know if the game will end soon, 
       // but actually selling is usually better to get cash. Let's just sell everything to be simple)
       const sellCount = currentStocks;
       const tradeCount = 0;
       const keepCount = 0;
       
       const newState = resolveMergeStocks(state, currentPlayerId, sellCount, tradeCount, keepCount);
       emitNewState(newState);
    } else if (state.phase === 'BuyStocks') {
       // Bot doesn't buy stocks yet
       const finalState = endTurn(state);
       emitNewState(finalState);
    }
  }, 1000);
}
