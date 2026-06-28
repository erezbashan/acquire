const ioClient = require('socket.io-client');

const socket = ioClient('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to server');

  socket.emit('createGame', { username: 'TestUser' }, (res: any) => {
    console.log(`Game created: ${res.gameId}`);
    
    // Add 3 bots
    socket.emit('addBot', { gameId: res.gameId });
    socket.emit('addBot', { gameId: res.gameId });
    socket.emit('addBot', { gameId: res.gameId });

    setTimeout(() => {
      console.log('Starting game...');
      socket.emit('startGame', { gameId: res.gameId });
    }, 1000);
  });
});

socket.on('gameState', (state: any) => {
  console.log(`\n--- Game State Update ---`);
  console.log(`Phase: ${state.phase}`);
  console.log(`Players: ${state.players.length}`);
  
  const me = state.players.find((p: any) => p.id === socket.id);
  if (me) {
    console.log(`My Tiles: ${me.tiles.map((t:any) => t.id).join(', ')}`);
  }

  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  console.log(`Current Player: ${state.players.find((p:any)=>p.id === currentPlayerId)?.name}`);
  console.log(`Logs: ${state.logs[state.logs.length - 1]}`);

  // If it's my turn and PlayTile phase, play the first tile
  if (state.phase === 'PlayTile' && currentPlayerId === socket.id && me && me.tiles.length > 0) {
    const tileToPlay = me.tiles[0];
    console.log(`\nPlaying tile: ${tileToPlay.id}`);
    socket.emit('playTile', { gameId: state.id, tileId: tileToPlay.id });
  }

  // If it's my turn and BuyStocks phase, end turn
  if (state.phase === 'BuyStocks' && currentPlayerId === socket.id) {
    console.log(`\nEnding turn...`);
    socket.emit('endTurn', { gameId: state.id });
  }

  // Check board for played tiles
  let playedCount = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell) playedCount++;
    }
  }
  console.log(`Tiles on board: ${playedCount}`);

  // Exit after a few tiles are played
  if (playedCount > 5) {
    console.log('\nTest complete! Exiting.');
    process.exit(0);
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
export {}
