import { BoardCell, Corporation, CorporationState, GameState, Player, Tile, TileId } from './types';

const BOARD_ROWS = 9;
const BOARD_COLS = 12;

export const CORPORATIONS: Corporation[] = [
  'Tower', 'Luxor', 'American', 'Worldwide', 'Festival', 'Imperial', 'Continental'
];

export function createInitialTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const rowLabel = r + 1;
      const colLabel = String.fromCharCode(65 + c); // A = 65
      tiles.push({
        id: `${rowLabel}${colLabel}` as TileId,
        row: r,
        col: c
      });
    }
  }
  return shuffleArray(tiles);
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function createInitialGameState(id: string): GameState {
  const emptyBoard: BoardCell[][] = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
  
  const corporations = {} as Record<Corporation, CorporationState>;
  for (const corp of CORPORATIONS) {
    corporations[corp] = {
      name: corp,
      size: 0,
      stockPrice: 0,
      majorityBonus: 0,
      minorityBonus: 0,
      availableStocks: 25,
      isSafe: false,
      isActive: false
    };
  }

  return {
    id,
    players: [],
    currentPlayerIndex: 0,
    board: emptyBoard,
    corporations,
    availableTiles: createInitialTiles(),
    phase: 'Lobby',
    sharesBoughtThisTurn: 0,
    turnOrder: [],
    logs: ['Game created. Waiting for players...']
  };
}

export function addPlayer(state: GameState, player: Player): GameState {
  if (state.phase !== 'Lobby') return state;
  return {
    ...state,
    players: [...state.players, player]
  };
}

export function startGame(state: GameState): GameState {
  if (state.phase !== 'Lobby' || state.players.length < 2) return state;

  // Distribute initial money and tiles
  const newTiles = [...state.availableTiles];
  const updatedPlayers = shuffleArray([...state.players]).map(p => {
    const drawnTiles = newTiles.splice(0, 6);
    return {
      ...p,
      money: 6000,
      tiles: drawnTiles,
      stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 }
    };
  });

  return {
    ...state,
    phase: 'PlayTile',
    players: updatedPlayers,
    availableTiles: newTiles,
    turnOrder: updatedPlayers.map(p => p.id),
    logs: [...state.logs, 'Game started!']
  };
}

export function playTile(state: GameState, playerId: string, tileId: TileId): GameState {
  if (state.phase !== 'PlayTile' || state.turnOrder[state.currentPlayerIndex] !== playerId) {
    return state;
  }

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  const tileIndex = player.tiles.findIndex(t => t.id === tileId);
  if (tileIndex === -1) return state;

  const tile = player.tiles[tileIndex];
  
  // Create new board
  const newBoard = state.board.map(row => [...row]);
  newBoard[tile.row][tile.col] = 'Unincorporated';

  // Update player tiles
  const newPlayerTiles = [...player.tiles];
  newPlayerTiles.splice(tileIndex, 1);
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...player, tiles: newPlayerTiles };

  let newState = {
    ...state,
    board: newBoard,
    players: newPlayers,
    logs: [...state.logs, `${player.name} played tile ${tileId}`]
  };

  // Check adjacency
  const neighbors = getAdjacentCells(newBoard, tile.row, tile.col);
  const adjacentUnincorporated = neighbors.filter(n => n.val === 'Unincorporated');
  const adjacentCorps = Array.from(new Set(neighbors.filter(n => n.val !== 'Unincorporated' && n.val !== null).map(n => n.val as Corporation)));

  if (adjacentCorps.length === 0 && adjacentUnincorporated.length > 0) {
    // Founding a corporation
    const availableCorps = CORPORATIONS.filter(c => !newState.corporations[c].isActive);
    if (availableCorps.length > 0) {
      const { count } = fillCorporation(newBoard.map(r => [...r]), tile.row, tile.col, availableCorps[0]);
      
      newState.phase = 'FoundCorporation';
      newState.pendingFounding = {
        playerId,
        tileId,
        availableCorps,
        size: count
      };
      newState.logs.push(`${player.name} is founding a corporation...`);
      return newState; // Do not auto-end turn yet
    }
  } else if (adjacentCorps.length === 1) {
    // Grow existing corporation
    const corp = adjacentCorps[0];
    const { board: updatedBoard, count } = fillCorporation(newBoard, tile.row, tile.col, corp);
    newState.board = updatedBoard;
    newState.corporations = { ...newState.corporations };
    newState.corporations[corp] = {
      ...newState.corporations[corp],
      size: newState.corporations[corp].size + count
    };
    newState.logs.push(`${corp} grows by ${count} tile(s).`);
  } else if (adjacentCorps.length > 1) {
    // Merger
    const safeCorps = adjacentCorps.filter(c => newState.corporations[c].isSafe);
    if (safeCorps.length >= 2) {
      // Unplayable tile! Discard and draw a new one.
      let newAvailable = [...state.availableTiles];
      let newPlayerTiles = player.tiles.filter(t => t.id !== tileId);
      let drawnLog = '';
      
      if (newAvailable.length > 0) {
        const drawIndex = Math.floor(Math.random() * newAvailable.length);
        newPlayerTiles.push(newAvailable[drawIndex]);
        newAvailable = newAvailable.filter((_, i) => i !== drawIndex);
        drawnLog = ' and drew a replacement';
      }
      
      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, tiles: newPlayerTiles };
      
      return {
        ...state,
        players: newPlayers,
        availableTiles: newAvailable,
        logs: [...state.logs, `${player.name} discarded unplayable tile ${tileId}${drawnLog}.`]
      };
    }

    const sortedCorps = [...adjacentCorps].sort((a, b) => newState.corporations[b].size - newState.corporations[a].size);
    const largestSize = newState.corporations[sortedCorps[0]].size;
    const tiedSurvivors = sortedCorps.filter(c => newState.corporations[c].size === largestSize);

    if (tiedSurvivors.length > 1) {
      newState.phase = 'ChooseMergeSurvivor';
      newState.pendingSurvivorChoice = {
        playerId,
        tileId,
        tiedCorps: tiedSurvivors,
        allCorpsInvolved: adjacentCorps
      };
      newState.logs.push(`${player.name} caused a merger with tied sizes. Choose a survivor...`);
      return newState;
    }

    const survivorName = sortedCorps[0];
    const defunctCorps = sortedCorps.slice(1);

    return applyMerger(newState, tile, survivorName, defunctCorps);
  }

  // Go to BuyStocks
  newState.phase = 'BuyStocks';
  
  newState = updateCorporationStats(newState);

  // Auto-end turn check
  if (shouldAutoEndTurn(newState)) {
    return endTurn(newState);
  }

  return newState;
}

export function chooseMergeSurvivor(state: GameState, playerId: string, survivorName: Corporation): GameState {
  if (state.phase !== 'ChooseMergeSurvivor' || !state.pendingSurvivorChoice) return state;
  if (state.pendingSurvivorChoice.playerId !== playerId) return state;

  const match = tileId.match(/^(\d+)([A-Z])$/);
  if (!match) return state;
  const row = parseInt(match[1]) - 1;
  const col = match[2].charCodeAt(0) - 65;
  const tile: Tile = { id: tileId, row, col };

  const allCorpsInvolved = state.pendingSurvivorChoice.allCorpsInvolved;
  const defunctCorps = allCorpsInvolved.filter(c => c !== survivorName);

  // Wait, if defunctCorps contains ties, the merging player chooses the order.
  // The rules say they are resolved largest to smallest.
  // We should sort defunct corps by size. If they tie, they can just be sorted arbitrarily or alphabetically for now to keep it simple.
  defunctCorps.sort((a, b) => {
    if (state.corporations[b].size !== state.corporations[a].size) {
      return state.corporations[b].size - state.corporations[a].size;
    }
    return a.localeCompare(b);
  });

  return applyMerger(state, tile, survivorName, defunctCorps);
}

function applyMerger(state: GameState, tile: Tile, survivorName: Corporation, defunctCorps: Corporation[]): GameState {
  let newState = { ...state };
  newState.pendingSurvivorChoice = undefined;
  newState.logs.push(`Merger! ${survivorName} takes over ${defunctCorps.join(', ')}.`);

  const newBoard = newState.board.map(row => [...row]);

  // 1. Convert the played tile and all defunct tiles to survivor
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 12; c++) {
      if (newBoard[r][c] !== null && defunctCorps.includes(newBoard[r][c] as Corporation)) {
        newBoard[r][c] = 'Unincorporated'; // temporarily make them unincorporated
      }
    }
  }
  
  const { board: fullyUpdatedBoard } = fillCorporation(newBoard, tile.row, tile.col, survivorName);
  
  let finalSurvivorSize = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 12; c++) {
      if (fullyUpdatedBoard[r][c] === survivorName) {
        finalSurvivorSize++;
      }
    }
  }

  newState.board = fullyUpdatedBoard;
  newState.corporations = { ...newState.corporations };
  newState.corporations[survivorName] = {
    ...newState.corporations[survivorName],
    size: finalSurvivorSize
  };

  // 2. Pay out bonuses
  const newPlayers = [...newState.players];
  for (const dCorp of defunctCorps) {
    const corpState = newState.corporations[dCorp];
    
    const stockHolders = newPlayers
      .map(p => ({ id: p.id, count: p.stocks[dCorp] }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count);

    if (stockHolders.length > 0) {
      const highestCount = stockHolders[0].count;
      const majorityHolders = stockHolders.filter(p => p.count === highestCount);
      const secondHighestCount = stockHolders.find(p => p.count < highestCount)?.count;
      const minorityHolders = secondHighestCount ? stockHolders.filter(p => p.count === secondHighestCount) : [];

      const majorityPayout = majorityHolders.length === 1 ? corpState.majorityBonus : Math.floor((corpState.majorityBonus + corpState.minorityBonus) / majorityHolders.length);
      for (const h of majorityHolders) {
        const pIndex = newPlayers.findIndex(p => p.id === h.id);
        newPlayers[pIndex] = { ...newPlayers[pIndex], money: newPlayers[pIndex].money + majorityPayout };
        newState.logs.push(`${newPlayers[pIndex].name} gets majority bonus for ${dCorp} ($${majorityPayout.toLocaleString()}).`);
      }

      if (majorityHolders.length === 1 && minorityHolders.length > 0) {
        const minorityPayout = Math.floor(corpState.minorityBonus / minorityHolders.length);
        for (const h of minorityHolders) {
          const pIndex = newPlayers.findIndex(p => p.id === h.id);
          newPlayers[pIndex] = { ...newPlayers[pIndex], money: newPlayers[pIndex].money + minorityPayout };
          newState.logs.push(`${newPlayers[pIndex].name} gets minority bonus for ${dCorp} ($${minorityPayout.toLocaleString()}).`);
        }
      }
    }
  }
  
  newState.players = newPlayers;
  
  // Initialize MergeResolution
  newState.phase = 'MergeResolution';
  newState.pendingMerge = {
    mergerId: newState.turnOrder[newState.currentPlayerIndex],
    acquirer: survivorName,
    defunct: defunctCorps,
    currentDefunctIndex: 0,
    playerResolutionIndex: newState.currentPlayerIndex,
    playersResolved: []
  };
  
  return advanceMergeState(newState);
}

export function resolveMergeStocks(state: GameState, playerId: string, sellCount: number, tradeCount: number, keepCount: number): GameState {
  if (state.phase !== 'MergeResolution' || !state.pendingMerge) return state;
  const pm = state.pendingMerge;
  if (state.turnOrder[pm.playerResolutionIndex] !== playerId) return state; // Not their turn to resolve

  const dCorp = pm.defunct[pm.currentDefunctIndex];
  const aCorp = pm.acquirer;
  const pIndex = state.players.findIndex(p => p.id === playerId);
  if (pIndex === -1) return state;

  const player = state.players[pIndex];
  const currentStocks = player.stocks[dCorp] || 0;
  if (sellCount + tradeCount + keepCount !== currentStocks) return state; // Invalid numbers

  let newState = { ...state, players: [...state.players], corporations: { ...state.corporations } };
  
  // Trade logic: 2 defunct for 1 acquirer
  const tradedAcquirerStocks = Math.floor(tradeCount / 2);
  const actualTraded = tradedAcquirerStocks * 2;
  const acquirerAvailable = newState.corporations[aCorp].availableStocks;
  const finalTradedAcquirerStocks = Math.min(tradedAcquirerStocks, acquirerAvailable);
  const finalTradedDefunct = finalTradedAcquirerStocks * 2;
  
  // What happens to leftover if they tried to trade but not enough acquirer stocks?
  // Usually they have to just keep or sell. We'll enforce the UI to not allow invalid trades.
  
  // Sell logic
  const sellPayout = sellCount * newState.corporations[dCorp].stockPrice;
  
  newState.players[pIndex] = {
    ...player,
    money: player.money + sellPayout,
    stocks: {
      ...player.stocks,
      [dCorp]: keepCount + (tradeCount - finalTradedDefunct), // If trade failed partially, it stays as keep
      [aCorp]: (player.stocks[aCorp] || 0) + finalTradedAcquirerStocks
    }
  };
  
  newState.corporations[aCorp] = {
    ...newState.corporations[aCorp],
    availableStocks: newState.corporations[aCorp].availableStocks - finalTradedAcquirerStocks
  };
  
  newState.logs = [...newState.logs, `${player.name} resolved ${dCorp}: Sold ${sellCount}, Traded ${finalTradedDefunct} for ${finalTradedAcquirerStocks} ${aCorp}, Kept ${keepCount}.`];
  
  // Advance to next player
  newState.pendingMerge = {
    ...pm,
    playersResolved: [...pm.playersResolved, playerId],
    playerResolutionIndex: (pm.playerResolutionIndex + 1) % newState.players.length
  };
  
  return advanceMergeState(newState);
}

function advanceMergeState(state: GameState): GameState {
  if (state.phase !== 'MergeResolution' || !state.pendingMerge) return state;
  let newState = { ...state };
  let pm = newState.pendingMerge!;
  
  while (pm.currentDefunctIndex < pm.defunct.length) {
    const dCorp = pm.defunct[pm.currentDefunctIndex];
    
    // Check if we've circled back to the mergerId AND we've already checked/resolved them
    // Or simpler: if all players have been checked
    // Every player is checked sequentially starting from mergerId.
    if (pm.playersResolved.length >= newState.players.length) {
      // Defunct corp fully resolved! Reset its stats to actually be dead.
      const corpState = newState.corporations[dCorp];
      newState.corporations[dCorp] = {
        ...corpState,
        size: 0,
        stockPrice: 0,
        majorityBonus: 0,
        minorityBonus: 0,
        availableStocks: 25,
        isActive: false,
        isSafe: false
      };
      
      pm.currentDefunctIndex++;
      // Reset player resolution index to the merger creator for the next corp
      pm.playerResolutionIndex = newState.turnOrder.findIndex(t => t === pm.mergerId);
      pm.playersResolved = [];
      continue;
    }
    
    // Check if current player has any stocks of dCorp
    const pId = newState.turnOrder[pm.playerResolutionIndex];
    const player = newState.players.find(p => p.id === pId);
    if (player && !pm.playersResolved.includes(pId) && (player.stocks[dCorp] || 0) > 0) {
      // Waiting for this player
      return newState;
    }
    
    // Skip this player
    if (!pm.playersResolved.includes(pId)) {
      pm.playersResolved.push(pId);
    }
    pm.playerResolutionIndex = (pm.playerResolutionIndex + 1) % newState.players.length;
  }
  
  // If we reach here, all defunct corps are resolved!
  delete newState.pendingMerge;
  newState.phase = 'BuyStocks';
  newState = updateCorporationStats(newState);

  if (shouldAutoEndTurn(newState)) {
    return endTurn(newState);
  }

  return newState;
}

export function foundCorporation(state: GameState, playerId: string, corpName: Corporation): GameState {
  if (state.phase !== 'FoundCorporation' || !state.pendingFounding || state.pendingFounding.playerId !== playerId) {
    return state;
  }

  const tile = state.availableTiles.find(t => t.id === state.pendingFounding!.tileId) || 
               // hack to get row/col from tileId if not in availableTiles
               { row: parseInt(state.pendingFounding!.tileId[0]) - 1, col: state.pendingFounding!.tileId.charCodeAt(1) - 65 };
               
  // Actually we can just find it on the board
  let row = -1, col = -1;
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      // Find the recently placed unincorporated tile
      // Since it's connected, we just run the fill from ANY unincorporated tile adjacent to the play, but we don't have the exact row/col easily without parsing tileId.
      // Let's parse tileId
    }
  }
  
  // Parse tileId: '1A' -> row 0, col 0; '10A' -> row 9, col 0
  const match = state.pendingFounding.tileId.match(/^(\d+)([A-Z])$/);
  if (match) {
    row = parseInt(match[1]) - 1;
    col = match[2].charCodeAt(0) - 65;
  }

  const newBoard = state.board.map(r => [...r]);
  const { board: updatedBoard, count } = fillCorporation(newBoard, row, col, corpName);
  
  const newState = { ...state, board: updatedBoard, phase: 'BuyStocks' as const };
  newState.corporations = { ...newState.corporations };
  newState.corporations[corpName] = {
    ...newState.corporations[corpName],
    isActive: true,
    size: count
  };
  
  // Founder gets 1 free stock
  const playerIndex = newState.players.findIndex(p => p.id === playerId);
  if (newState.corporations[corpName].availableStocks > 0) {
    newState.corporations[corpName].availableStocks -= 1;
    const newPlayers = [...newState.players];
    newPlayers[playerIndex] = {
      ...newPlayers[playerIndex],
      stocks: {
        ...newPlayers[playerIndex].stocks,
        [corpName]: newPlayers[playerIndex].stocks[corpName] + 1
      }
    };
    newState.players = newPlayers;
  }

  delete newState.pendingFounding;
  newState.logs = [...newState.logs, `${state.players[playerIndex].name} founded ${corpName}!`];

  const finalState = updateCorporationStats(newState);

  if (shouldAutoEndTurn(finalState)) {
    return endTurn(finalState);
  }

  return finalState;
}

function shouldAutoEndTurn(state: GameState): boolean {
  if (state.phase !== 'BuyStocks') return false;

  if (state.sharesBoughtThisTurn >= 3) return true;

  // Can player buy anything?
  const activeCorps = Object.values(state.corporations).filter(c => c.isActive && c.availableStocks > 0);
  if (activeCorps.length === 0) return true;
  
  // Check if player has enough money to buy the cheapest stock.
  const minPrice = Math.min(...activeCorps.map(c => c.stockPrice));
  if (state.players[state.currentPlayerIndex].money < minPrice) return true;
  
  return false;
}

export function getAdjacentCells(board: BoardCell[][], row: number, col: number): { r: number, c: number, val: BoardCell }[] {
  const neighbors = [];
  if (row > 0) neighbors.push({ r: row - 1, c: col, val: board[row - 1][col] });
  if (row < BOARD_ROWS - 1) neighbors.push({ r: row + 1, c: col, val: board[row + 1][col] });
  if (col > 0) neighbors.push({ r: row, c: col - 1, val: board[row][col - 1] });
  if (col < BOARD_COLS - 1) neighbors.push({ r: row, c: col + 1, val: board[row][col + 1] });
  return neighbors;
}

export function getStockPrice(corpName: Corporation, size: number): number {
  if (size < 2) return 0;
  
  let basePrice = 200;
  if (['American', 'Worldwide', 'Festival'].includes(corpName)) basePrice = 300;
  if (['Imperial', 'Continental'].includes(corpName)) basePrice = 400;

  let step = 0;
  if (size === 2) step = 0;
  else if (size === 3) step = 1;
  else if (size === 4) step = 2;
  else if (size === 5) step = 3;
  else if (size >= 6 && size <= 10) step = 4;
  else if (size >= 11 && size <= 20) step = 5;
  else if (size >= 21 && size <= 30) step = 6;
  else if (size >= 31 && size <= 40) step = 7;
  else if (size >= 41) step = 8;

  return basePrice + (step * 100);
}

function updateCorporationStats(state: GameState): GameState {
  const newState = { ...state, corporations: { ...state.corporations } };
  for (const corpName of CORPORATIONS) {
    const corp = newState.corporations[corpName];
    if (corp.isActive) {
      const price = getStockPrice(corpName, corp.size);
      newState.corporations[corpName] = {
        ...corp,
        stockPrice: price,
        majorityBonus: price * 10,
        minorityBonus: price * 5,
        isSafe: corp.size >= 11
      };
    }
  }
  return newState;
}

export function fillCorporation(board: BoardCell[][], row: number, col: number, corpName: Corporation): { board: BoardCell[][], count: number } {
  const newBoard = board.map(r => [...r]);
  let count = 0;
  
  function dfs(r: number, c: number) {
    const neighbors = getAdjacentCells(newBoard, r, c);
    for (const n of neighbors) {
      if (n.val === 'Unincorporated') {
        newBoard[n.r][n.c] = corpName;
        count++;
        dfs(n.r, n.c);
      }
    }
  }

  // To properly fill, we mark the starting cell
  if (newBoard[row][col] === 'Unincorporated') {
    newBoard[row][col] = corpName;
    count++;
  }
  
  // Run DFS from the starting cell to convert all connected 'Unincorporated'
  dfs(row, col);

  return { board: newBoard, count };
}

export function buyStock(state: GameState, playerId: string, corpName: Corporation): GameState {
  if (state.phase !== 'BuyStocks' || state.turnOrder[state.currentPlayerIndex] !== playerId) return state;
  if (state.sharesBoughtThisTurn >= 3) return state;

  const corp = state.corporations[corpName];
  if (!corp.isActive || corp.availableStocks <= 0) return state;

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  if (player.money < corp.stockPrice) return state;

  const newState = { ...state };
  newState.corporations = { ...newState.corporations };
  newState.corporations[corpName] = { ...corp, availableStocks: corp.availableStocks - 1 };

  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = {
    ...player,
    money: player.money - corp.stockPrice,
    stocks: { ...player.stocks, [corpName]: player.stocks[corpName] + 1 }
  };
  newState.players = newPlayers;
  newState.sharesBoughtThisTurn += 1;
  newState.logs = [...newState.logs, `${player.name} bought 1 share of ${corpName}.`];

  if (shouldAutoEndTurn(newState)) {
    return endTurn(newState);
  }

  return newState;
}

function canEndGame(state: GameState): boolean {
  const activeCorps = Object.values(state.corporations).filter(c => c.isActive);
  if (activeCorps.length === 0) return false;
  
  const allSafe = activeCorps.every(c => c.isSafe);
  const any41 = activeCorps.some(c => c.size >= 41);
  return allSafe || any41;
}

export function endTurn(state: GameState): GameState {
  let newState = { ...state, players: [...state.players], logs: [...state.logs] };
  const cp = newState.players[newState.currentPlayerIndex];
  
  if (canEndGame(newState)) {
    const leader = newState.players.reduce((prev, current) => {
      return (getPlayerFinancials(newState, prev.id).netWorth > getPlayerFinancials(newState, current.id).netWorth) ? prev : current;
    });
    
    if (leader.id === cp.id) {
      newState.phase = 'GameOver';
      newState.logs.push(`Game Over! ${cp.name} ends the game and wins with a net worth of $${getPlayerFinancials(newState, cp.id).netWorth.toLocaleString()}!`);
      return newState;
    }
  }

  // Draw tile
  if (newState.availableTiles.length > 0) {
    const tileIndex = Math.floor(Math.random() * newState.availableTiles.length);
    const drawnTile = newState.availableTiles[tileIndex];
    newState.availableTiles = newState.availableTiles.filter((_, i) => i !== tileIndex);
    
    newState.players[newState.currentPlayerIndex] = {
      ...cp,
      tiles: [...cp.tiles, drawnTile]
    };
    newState.logs.push(`${cp.name} ends turn and draws a tile. ---`);
  } else {
    newState.logs.push(`${cp.name} ends turn (no tiles left). ---`);
  }
  
  const nextPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;

  return {
    ...newState,
    currentPlayerIndex: nextPlayerIndex,
    phase: 'PlayTile',
    sharesBoughtThisTurn: 0
  };
}

export interface PlayerFinancials {
  cash: number;
  stockValue: number;
  bonusValue: number;
  netWorth: number;
}

export function getPlayerFinancials(state: GameState, playerId: string): PlayerFinancials {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { cash: 0, stockValue: 0, bonusValue: 0, netWorth: 0 };

  let stockValue = 0;
  let bonusValue = 0;

  for (const [corpName, corpState] of Object.entries(state.corporations)) {
    const playerStocks = player.stocks[corpName as Corporation] || 0;
    if (playerStocks > 0) {
      stockValue += playerStocks * corpState.stockPrice;
      
      const stockHolders = state.players
        .map(p => ({ id: p.id, count: p.stocks[corpName as Corporation] }))
        .filter(p => p.count > 0)
        .sort((a, b) => b.count - a.count);

      if (stockHolders.length > 0) {
        const highestCount = stockHolders[0].count;
        const majorityHolders = stockHolders.filter(p => p.count === highestCount);
        
        if (majorityHolders.some(h => h.id === playerId)) {
          if (majorityHolders.length === 1) {
            bonusValue += corpState.majorityBonus;
          } else {
            bonusValue += Math.floor((corpState.majorityBonus + corpState.minorityBonus) / majorityHolders.length);
          }
        } else {
          const secondHighestCount = stockHolders.find(p => p.count < highestCount)?.count;
          if (secondHighestCount) {
            const minorityHolders = stockHolders.filter(p => p.count === secondHighestCount);
            if (minorityHolders.some(h => h.id === playerId)) {
              bonusValue += Math.floor(corpState.minorityBonus / minorityHolders.length);
            }
          }
        }
      }
    }
  }

  return {
    cash: player.money,
    stockValue,
    bonusValue,
    netWorth: player.money + stockValue + bonusValue
  };
}

export function calculateNetWorth(state: GameState, playerId: string): number {
  return getPlayerFinancials(state, playerId).netWorth;
}
