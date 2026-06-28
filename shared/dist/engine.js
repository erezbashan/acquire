"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialTiles = createInitialTiles;
exports.createInitialGameState = createInitialGameState;
exports.addPlayer = addPlayer;
exports.startGame = startGame;
exports.playTile = playTile;
exports.endTurn = endTurn;
exports.calculateNetWorth = calculateNetWorth;
const BOARD_ROWS = 9;
const BOARD_COLS = 12;
const CORPORATIONS = [
    'Tower', 'Luxor', 'American', 'Worldwide', 'Festival', 'Imperial', 'Continental'
];
function createInitialTiles() {
    const tiles = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            const rowLabel = r + 1;
            const colLabel = String.fromCharCode(65 + c); // A = 65
            tiles.push({
                id: `${rowLabel}${colLabel}`,
                row: r,
                col: c
            });
        }
    }
    return shuffleArray(tiles);
}
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
function createInitialGameState(id) {
    const emptyBoard = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(null));
    const corporations = {};
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
        turnOrder: [],
        logs: ['Game created. Waiting for players...']
    };
}
function addPlayer(state, player) {
    if (state.phase !== 'Lobby')
        return state;
    return {
        ...state,
        players: [...state.players, player]
    };
}
function startGame(state) {
    if (state.phase !== 'Lobby' || state.players.length < 2)
        return state;
    // Distribute initial money and tiles
    const newTiles = [...state.availableTiles];
    const updatedPlayers = state.players.map(p => {
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
function playTile(state, playerId, tileId) {
    if (state.phase !== 'PlayTile' || state.turnOrder[state.currentPlayerIndex] !== playerId) {
        return state;
    }
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1)
        return state;
    const player = state.players[playerIndex];
    const tileIndex = player.tiles.findIndex(t => t.id === tileId);
    if (tileIndex === -1)
        return state;
    const tile = player.tiles[tileIndex];
    // Create new board
    const newBoard = state.board.map(row => [...row]);
    newBoard[tile.row][tile.col] = 'Unincorporated';
    // Update player tiles
    const newPlayerTiles = [...player.tiles];
    newPlayerTiles.splice(tileIndex, 1);
    const newPlayers = [...state.players];
    newPlayers[playerIndex] = { ...player, tiles: newPlayerTiles };
    // TODO: Check for mergers or foundings here. For now, just place it.
    return {
        ...state,
        board: newBoard,
        players: newPlayers,
        phase: 'BuyStocks',
        logs: [...state.logs, `${player.name} played tile ${tileId}`]
    };
}
function endTurn(state) {
    if (state.phase !== 'BuyStocks')
        return state;
    const currentPlayer = state.players[state.currentPlayerIndex];
    const newTiles = [...state.availableTiles];
    const newPlayers = [...state.players];
    // Draw new tile
    let drawnTileLog = '';
    if (newTiles.length > 0 && currentPlayer.tiles.length < 6) {
        const drawnTile = newTiles.shift();
        newPlayers[state.currentPlayerIndex] = {
            ...currentPlayer,
            tiles: [...currentPlayer.tiles, drawnTile]
        };
        drawnTileLog = ` and drew a tile`;
    }
    const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    return {
        ...state,
        players: newPlayers,
        availableTiles: newTiles,
        currentPlayerIndex: nextPlayerIndex,
        phase: 'PlayTile',
        logs: [...state.logs, `${currentPlayer.name} ended their turn${drawnTileLog}.`]
    };
}
function calculateNetWorth(state, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player)
        return 0;
    let netWorth = player.money;
    // For each corporation, calculate stock value + bonuses
    for (const [corpName, corpState] of Object.entries(state.corporations)) {
        const playerStocks = player.stocks[corpName];
        if (playerStocks > 0) {
            netWorth += playerStocks * corpState.stockPrice;
            // Calculate bonuses
            const stockHolders = state.players
                .map(p => ({ id: p.id, count: p.stocks[corpName] }))
                .filter(p => p.count > 0)
                .sort((a, b) => b.count - a.count);
            if (stockHolders.length > 0) {
                const highestCount = stockHolders[0].count;
                const majorityHolders = stockHolders.filter(p => p.count === highestCount);
                if (majorityHolders.some(h => h.id === playerId)) {
                    // Player splits majority bonus (and minority if they are the only majority holder)
                    if (majorityHolders.length === 1) {
                        netWorth += corpState.majorityBonus;
                    }
                    else {
                        netWorth += Math.floor((corpState.majorityBonus + corpState.minorityBonus) / majorityHolders.length);
                    }
                }
                else {
                    // Player might get minority bonus
                    const secondHighestCount = stockHolders.find(p => p.count < highestCount)?.count;
                    if (secondHighestCount) {
                        const minorityHolders = stockHolders.filter(p => p.count === secondHighestCount);
                        if (minorityHolders.some(h => h.id === playerId)) {
                            netWorth += Math.floor(corpState.minorityBonus / minorityHolders.length);
                        }
                    }
                }
            }
        }
    }
    return netWorth;
}
