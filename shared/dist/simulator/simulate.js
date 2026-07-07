"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const engine_1 = require("../engine");
const HeuristicBot_1 = require("../bots/HeuristicBot");
const RandomBot_1 = require("../bots/RandomBot");
const PLAYER_COLORS = ['#FF3366', '#33CCFF', '#FFCC00', '#00FF66', '#CC99FF', '#FF9933', '#FFFFFF', '#FF66B2', '#99CC00', '#6699FF'];
const numGames = 100;
let heuristicWins = 0;
let randomWins = 0;
const heuristicBot = new HeuristicBot_1.HeuristicBot();
const randomBot = new RandomBot_1.RandomBot();
for (let i = 0; i < numGames; i++) {
    let state = (0, engine_1.createInitialGameState)(`sim-${i}`);
    // Add 3 Heuristic, 1 Random
    state = (0, engine_1.addPlayer)(state, {
        id: 'h1', name: 'Heuristic 1', color: PLAYER_COLORS[0],
        money: 6000, tiles: [], stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true, stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    });
    state = (0, engine_1.addPlayer)(state, {
        id: 'h2', name: 'Heuristic 2', color: PLAYER_COLORS[1],
        money: 6000, tiles: [], stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true, stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    });
    state = (0, engine_1.addPlayer)(state, {
        id: 'h3', name: 'Heuristic 3', color: PLAYER_COLORS[2],
        money: 6000, tiles: [], stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true, stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    });
    state = (0, engine_1.addPlayer)(state, {
        id: 'r1', name: 'Random 1', color: PLAYER_COLORS[3],
        money: 6000, tiles: [], stocks: { Tower: 0, Luxor: 0, American: 0, Worldwide: 0, Festival: 0, Imperial: 0, Continental: 0 },
        isBot: true, stats: { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 }
    });
    state = (0, engine_1.startGame)(state);
    let turnCounter = 0;
    while (state.phase !== 'GameOver') {
        turnCounter++;
        if (turnCounter > 10000) {
            console.log('Game stuck in infinite loop!');
            break;
        }
        const currentPlayerId = state.phase === 'MergeResolution' && state.pendingMerge
            ? state.turnOrder[state.pendingMerge.playerResolutionIndex]
            : state.turnOrder[state.currentPlayerIndex];
        const botToPlay = currentPlayerId.startsWith('h') ? heuristicBot : randomBot;
        const newState = botToPlay.takeTurn(state, currentPlayerId);
        if (newState) {
            state = newState;
        }
        else {
            console.log('Bot failed to take a turn', currentPlayerId, state.phase);
            break;
        }
    }
    // Calculate winner
    let bestPlayerId = '';
    let highestNetWorth = -1;
    for (const player of state.players) {
        const netWorth = (0, engine_1.calculateNetWorth)(state, player.id);
        if (netWorth > highestNetWorth) {
            highestNetWorth = netWorth;
            bestPlayerId = player.id;
        }
    }
    if (bestPlayerId.startsWith('h')) {
        heuristicWins++;
    }
    else {
        randomWins++;
    }
}
console.log(`Simulation complete!`);
console.log(`HeuristicBot wins: ${heuristicWins}`);
console.log(`RandomBot wins: ${randomWins}`);
