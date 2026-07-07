import { createInitialGameState, playTile, addPlayer, startGame, foundCorporation } from './engine';

let state = createInitialGameState('test');
state = addPlayer(state, { id: 'p1', name: 'p1', money: 6000, tiles: [], stocks: {Tower:0,Luxor:0,American:0,Worldwide:0,Festival:0,Imperial:0,Continental:0} } as any);
state = addPlayer(state, { id: 'p2', name: 'p2', money: 6000, tiles: [], stocks: {Tower:0,Luxor:0,American:0,Worldwide:0,Festival:0,Imperial:0,Continental:0} } as any);
state = startGame(state);
state.players[0].tiles = [{id: '9F', row: 8, col: 5}, {id: '9G', row: 8, col: 6}] as any;

state = playTile(state, 'p1', '9F' as any);
console.log('After 9F:', state.board[8][5]);

state.phase = 'PlayTile';
state.turnOrder = ['p1', 'p2'];
state.currentPlayerIndex = 0;

state = playTile(state, 'p1', '9G' as any);
console.log('After 9G, phase:', state.phase);

state = foundCorporation(state, 'p1', 'Tower');
console.log('After found, 9F:', state.board[8][5], '9G:', state.board[8][6], 'size:', state.corporations.Tower.size);
