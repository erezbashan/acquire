import React, { useState } from 'react';
import { useSocket } from './SocketContext';
import { type Corporation, getPlayerFinancials, getStockPrice } from '@acquire/shared';
import './App.css';

function App() {
  const { connected, gameState, createGame, joinGame, quitGame, addBot, startGame, playTile, buyStock, endTurn, rejoinGame, playerId, foundCorporation, chooseMergeSurvivor, resolveMergeStocks, openGames, addChatMessage } = useSocket();
  const [username, setUsername] = useState(localStorage.getItem('acquire_username') || '');
  const [gameIdInput, setGameIdInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(() => window.innerWidth < 800);
  const [showFullChat, setShowFullChat] = useState(false);
  const [systemNotification, setSystemNotification] = useState('');
  
  // Merge Resolution State
  const [sellCount, setSellCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  const handleSendChat = () => {
    if (chatInput.trim() && gameState) {
      addChatMessage(gameState.id, chatInput.trim());
      setChatInput('');
    }
  };

  const handleQuitGame = async () => {
    if (gameState) {
      await quitGame(gameState.id);
    }
    window.location.href = '/';
  };

  // Corp Details Modal State
  const [selectedCorp, setSelectedCorp] = useState<Corporation | null>(null);
  const [showFullLogs, setShowFullLogs] = useState(false);
  const [showGameOver, setShowGameOver] = useState(true);

  const renderLogLine = (logStr: string, i: number) => {
    if (!gameState) return null;
    let cleanLog = logStr.replace('---', '').replace(/🤖 /g, '');
    let elements = [];
    
    const corpColors: Record<string, string> = {
      Tower: 'var(--corp-tower)',
      Luxor: 'var(--corp-luxor)',
      American: 'var(--corp-american)',
      Worldwide: 'var(--corp-worldwide)',
      Festival: 'var(--corp-festival)',
      Imperial: 'var(--corp-imperial)',
      Continental: 'var(--corp-continental)'
    };
    
    // Check for player names
    const player = gameState.players.find(p => cleanLog.startsWith(p.name.replace('🤖 ', '')));
    let namePart = '';
    
    if (player) {
      namePart = player.name.replace('🤖 ', '');
      elements.push(<span key="name" className="player-name" style={{ color: player.color }}>{namePart}</span>);
      cleanLog = cleanLog.substring(namePart.length);
    }

    // Now split the rest by corp names and colorize them
    // We can do a simple regex or split
    const corpNames = Object.keys(corpColors).join('|');
    const regex = new RegExp(`(${corpNames})`, 'g');
    
    const parts = cleanLog.split(regex);
    parts.forEach((part, idx) => {
      if (corpColors[part]) {
        elements.push(<span key={idx} style={{ color: corpColors[part], fontWeight: 'bold' }}>{part}</span>);
      } else if (part) {
        elements.push(<span key={idx}>{part}</span>);
      }
    });

    let emoji = '';
    if (logStr.includes('founded')) emoji = '🏢 ';
    else if (logStr.includes('bought')) emoji = '💰 ';
    else if (logStr.includes('discarded')) emoji = '🗑️ ';
    else if (logStr.includes('gets bonus')) emoji = '💵 ';
    else if (logStr.includes('played tile')) emoji = '⬜ ';
    else if (logStr.includes('Merger!')) emoji = '💥 ';
    else if (logStr.includes('grows by')) emoji = '📈 ';
    else if (logStr.includes('resolved')) emoji = '⚖️ ';
    else if (logStr.includes('caused a merger')) emoji = '⚠️ ';

    let bg = 'transparent';
    if (logStr.includes('founded')) bg = 'rgba(255, 255, 255, 0.1)';
    if (logStr.includes('Merger!')) bg = 'rgba(239, 68, 68, 0.2)';

    return (
      <React.Fragment key={i}>
        {logStr.endsWith('---') && i !== 0 && (
          <hr style={{ margin: '8px 0', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
        )}
        <div style={{ 
          color: logStr.endsWith('---') ? 'var(--text-muted)' : 'inherit',
          backgroundColor: bg,
          padding: bg !== 'transparent' ? '4px 8px' : '2px 0',
          borderRadius: '4px',
          fontWeight: logStr.includes('founded') || logStr.includes('Merger!') ? 'bold' : 'normal',
          display: 'flex',
          gap: '4px',
          alignItems: 'flex-start'
        }}>
          {emoji && <span style={{ fontSize: '1em', lineHeight: 1, display: 'flex', alignItems: 'center' }}>{emoji}</span>}
          <div style={{ flex: 1 }}>{elements}</div>
        </div>
      </React.Fragment>
    );
  };

  const me = gameState?.players.find(p => p.id === playerId);
  const pm = gameState?.pendingMerge;
  const dCorp = pm?.defunct[pm.currentDefunctIndex];
  const aCorp = pm?.acquirer;
  const myDefunctStocks = me && dCorp ? (me.stocks[dCorp] || 0) : 0;
  
  // Auto-reset merge sliders if myDefunctStocks changes
  React.useEffect(() => {
    setSellCount(0);
    setTradeCount(0);
  }, [myDefunctStocks, dCorp]);

  // URL Game ID parsing
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game');
    if (game && !gameIdInput) {
      setGameIdInput(game);
      rejoinGame(game);
    }
  }, []);

  React.useEffect(() => {
    if (connected && gameState) {
      window.history.replaceState(null, '', `/?game=${gameState.id}`);
    }
  }, [connected, gameState?.id]);
  React.useEffect(() => {
    setSystemNotification('');
    setShowGameOver(true);
  }, [gameState?.id]);

  React.useEffect(() => {
    if (gameState?.phase === 'GameOver') {
      setShowGameOver(true);
    }
  }, [gameState?.phase]);

  React.useEffect(() => {
    if (gameState?.chat && gameState.chat.length > 0) {
      const lastMsg = gameState.chat[gameState.chat.length - 1];
      if (lastMsg.sender === 'System' && Date.now() - lastMsg.timestamp < 10000) {
        setSystemNotification(lastMsg.text);
        const timer = setTimeout(() => setSystemNotification(''), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState?.chat]);

  if (!connected) {
    return <div className="loading">Connecting to server...</div>;
  }

  if (!gameState || !me) {
    const isJoiningExisting = gameState && !me;
    
    return (
      <div className="lobby-container">
        <button 
          onClick={() => setShowHelpModal(true)}
          style={{ position: 'fixed', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', color: 'white', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', zIndex: 3000, boxShadow: '0 4px 10px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          title="Help & Feedback"
        >
          ?
        </button>

        {showHelpModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 }} onClick={() => setShowHelpModal(false)}>
            <div className="modal-content glass" style={{ padding: '2rem', minWidth: '400px', maxWidth: '600px', textAlign: 'left', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowHelpModal(false)} 
                style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
              <h2 style={{ marginTop: 0 }}>Help & Feedback</h2>
              <p>
                <strong>Acquire</strong> is a classic board game of strategy and finance. Players form, merge, and expand hotel chains while strategically buying stock to maximize their wealth. Use your tiles to manipulate the board and outsmart your opponents to become the wealthiest player!
              </p>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                <li><a href="https://www.ultraboardgames.com/acquire/game-rules.php" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Read Official Rules</a></li>
                <li><a href="mailto:erez.bashan@gmail.com?subject=Acquire%20Game%20Feedback" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Send Feedback or Report a Bug</a></li>
              </ul>
            </div>
          </div>
        )}
        
        <div className="title-area">
          <h1>Acquire</h1>
        </div>
        <div className="lobby-card glass">
          <input 
            type="text" 
            placeholder="3-Letter Name" 
            maxLength={3}
            value={username} 
            onChange={e => setUsername(e.target.value.toUpperCase())} 
          />
          <div className="actions">
            {!isJoiningExisting ? (
              <>
                <button onClick={() => createGame(username)} disabled={username.length !== 3}>Create Game</button>
                <div className="join-section">
                  <input 
                    type="text" 
                    placeholder="Game ID" 
                    value={gameIdInput} 
                    onChange={e => setGameIdInput(e.target.value.toUpperCase())} 
                  />
                  <button onClick={() => joinGame(gameIdInput, username)} disabled={username.length !== 3 || !gameIdInput}>Join Game</button>
                </div>
              </>
            ) : (
              <button onClick={() => joinGame(gameState.id, username)} disabled={username.length !== 3} style={{ width: '100%', marginTop: '1rem' }}>
                Join Game {gameState.id}
              </button>
            )}
          </div>
        </div>
        
        {!isJoiningExisting && openGames.length > 0 && (
          <div className="lobby-card glass" style={{ marginTop: '2rem' }}>
            <h3>Ongoing Games</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1rem' }}>
              {[...openGames].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(game => {
                const idleMins = Math.floor((Date.now() - (game.updatedAt || Date.now())) / 60000);
                return (
                  <div key={game.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span><strong>{game.id}</strong> ({game.players.length} players)</span>
                      {idleMins >= 1 && <span style={{ fontSize: '0.85rem', color: '#fb923c', marginTop: '4px' }}>Idle for {idleMins} min{idleMins !== 1 ? 's' : ''}</span>}
                    </div>
                    <button onClick={() => { setGameIdInput(game.id); joinGame(game.id, username); }} disabled={username.length !== 3} style={{ padding: '5px 15px' }}>
                      Join
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const activePlayerId = gameState.phase === 'MergeResolution' && gameState.pendingMerge 
    ? gameState.turnOrder[gameState.pendingMerge.playerResolutionIndex] 
    : gameState.turnOrder[gameState.currentPlayerIndex];
    
  const activePlayerName = gameState.players.find(p => p.id === activePlayerId)?.name || 'Someone';
  const isMyTurn = activePlayerId === playerId;
  
  const keepCount = myDefunctStocks - sellCount - tradeCount;

  const meIndexInTurnOrder = gameState.turnOrder?.indexOf(playerId) ?? -1;
  const orderedPlayerIds = meIndexInTurnOrder >= 0 
    ? [...gameState.turnOrder.slice(meIndexInTurnOrder), ...gameState.turnOrder.slice(0, meIndexInTurnOrder)]
    : (gameState.turnOrder?.length > 0 ? gameState.turnOrder : gameState.players.map(p => p.id));
  const orderedPlayers = orderedPlayerIds.map(id => gameState.players.find(p => p.id === id)!).filter(Boolean);

  return (
    <div className="game-container">
      <header className="glass">
        <div className="status" style={{ display: 'flex', alignItems: 'center' }}>
          {gameState.phase === 'GameOver' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
              <span style={{ 
                padding: '8px 24px', 
                backgroundColor: '#f59e0b', 
                color: 'black', 
                fontWeight: '900', 
                fontSize: '1.5rem', 
                borderRadius: '8px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.5)',
              }}>
                Game Over
              </span>
              {(() => {
                const sortedPlayers = [...gameState.players].sort((a, b) => getPlayerFinancials(gameState, b.id).netWorth - getPlayerFinancials(gameState, a.id).netWorth);
                const winner = sortedPlayers[0];
                return winner && (
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.5)' }}>
                    🏆 Winner: <span style={{ color: winner.color }}>{winner.name.replace('🤖 ', '')}</span>
                  </span>
                );
              })()}
              {!showGameOver && (
                <button 
                  onClick={() => setShowGameOver(true)} 
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                >
                  Show Final Results
                </button>
              )}
            </div>
          )}
          {gameState.phase !== 'Lobby' && gameState.phase !== 'GameOver' && (
            <span style={{ 
              marginLeft: '1rem', 
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: isMyTurn ? '#4caf50' : 'rgba(255,255,255,0.1)',
              color: '#fff', 
              fontWeight: isMyTurn ? 'bold' : 'normal' 
            }}>
              {isMyTurn ? "Your Turn: Please take action!" : `Waiting for ${activePlayerName}...`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {gameState.phase === 'Lobby' && (
            <>
              {gameState.hostId === playerId && (
                <>
                  <button 
                    onClick={() => addBot(gameState.id)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Add Bot
                  </button>
                  <button 
                    onClick={() => startGame(gameState.id)} 
                    disabled={gameState.players.length < 2}
                    style={{
                      background: gameState.players.length < 2 ? 'rgba(255,255,255,0.1)' : '#10b981',
                      color: gameState.players.length < 2 ? 'rgba(255,255,255,0.4)' : 'white',
                      border: gameState.players.length < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      cursor: gameState.players.length < 2 ? 'not-allowed' : 'pointer',
                      boxShadow: gameState.players.length < 2 ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    Start Game
                  </button>
                </>
              )}
              {gameState.hostId !== playerId && (
                <span style={{ padding: '4px 12px', color: '#ccc', alignSelf: 'center' }}>Waiting for host to start...</span>
              )}
            </>
          )}
          
          {gameState.phase === 'GameOver' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleQuitGame}
                style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Back to Lobby
              </button>
              <button 
                onClick={async () => {
                  const myName = me?.name.replace('🤖 ', '') || localStorage.getItem('acquire_username') || 'Player';
                  if (gameState) {
                    await quitGame(gameState.id);
                  }
                  await createGame(myName);
                }}
                style={{ 
                  background: '#10b981', 
                  color: 'white',
                  fontWeight: 'bold',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
                }}
              >
                New Game
              </button>
            </div>
          ) : (
            <button className="quit-btn" onClick={handleQuitGame}>
              Quit Game
            </button>
          )}

          <button 
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('game', gameState.id);
              navigator.clipboard.writeText(url.toString());
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
              setShowShareModal(true);
            }}
            style={{ 
              background: copiedLink ? '#10b981' : 'rgba(255,255,255,0.1)', 
              border: copiedLink ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              transition: 'all 0.3s ease'
            }}
          >
            {copiedLink ? 'Copied!' : 'Share'}
          </button>

          <button 
            onClick={() => setShowHelpModal(true)}
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', color: 'white', border: 'none', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            title="Help & Feedback"
          >
            ?
          </button>
        </div>
      </header>

      <div className="main-content">
        {systemNotification && (
          <div className="system-toast" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 4000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', fontWeight: 'bold' }}>
            {systemNotification}
          </div>
        )}
        
        {showHelpModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 }} onClick={() => setShowHelpModal(false)}>
            <div className="modal-content glass" style={{ padding: '2rem', minWidth: '400px', maxWidth: '600px', textAlign: 'left', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowHelpModal(false)} 
                style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
              <h2 style={{ marginTop: 0 }}>Help & Feedback</h2>
              <p>
                <strong>Acquire</strong> is a classic board game of strategy and finance. Players form, merge, and expand hotel chains while strategically buying stock to maximize their wealth. Use your tiles to manipulate the board and outsmart your opponents to become the wealthiest player!
              </p>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                <li><a href="https://www.ultraboardgames.com/acquire/game-rules.php" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Read Official Rules</a></li>
                <li><a href="mailto:erez.bashan@gmail.com?subject=Acquire%20Game%20Feedback" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>Send Feedback or Report a Bug</a></li>
              </ul>
            </div>
          </div>
        )}
        
        {showShareModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
            <div className="modal-content glass" style={{ padding: '2rem', minWidth: '400px', textAlign: 'center', position: 'relative' }}>
              <button 
                onClick={() => setShowShareModal(false)} 
                style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
              <h2 style={{ marginTop: 0 }}>Invite Friends</h2>
              <p style={{ color: 'var(--text-muted)' }}>Send this link to your friends so they can join the game directly!</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/?game=${gameState.id}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?game=${gameState.id}`);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }} style={{ background: copiedLink ? '#10b981' : 'var(--accent)' }}>
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showMobileWarning && (
          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,20,30,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
            <div className="modal-content glass" style={{ padding: '2rem', minWidth: '300px', maxWidth: '80%', textAlign: 'center', position: 'relative', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
              <h2 style={{ marginTop: 0, color: '#ef4444' }}>Screen Too Small</h2>
              <p style={{ lineHeight: '1.5' }}>
                Acquire requires a lot of screen real estate to display the board and player information properly. 
              </p>
              <p style={{ lineHeight: '1.5', fontWeight: 'bold' }}>
                For the best experience, please play on a desktop, laptop, or tablet.
              </p>
              <button 
                onClick={() => setShowMobileWarning(false)}
                style={{ marginTop: '1.5rem', width: '100%' }}
              >
                I Understand, Continue Anyway
              </button>
            </div>
          </div>
        )}
        
        <div className="board glass">
          {Array.from({length: 9}).map((_, rIdx) => {
            const row = gameState.board[rIdx];
            return (
            <div key={rIdx} className="board-row">
              {row.map((cell, cIdx) => {
                const cellId = `${rIdx + 1}${String.fromCharCode(65 + cIdx)}`;
                const isInHand = me?.tiles.some(t => t.id === cellId);
                const isPlayable = isInHand && gameState.phase === 'PlayTile' && isMyTurn;
                let tileIcon = null;
                
                if (isInHand) {
                  const neighbors = [];
                  if (rIdx > 0) neighbors.push(gameState.board[rIdx - 1][cIdx]);
                  if (rIdx < 8) neighbors.push(gameState.board[rIdx + 1][cIdx]);
                  if (cIdx > 0) neighbors.push(gameState.board[rIdx][cIdx - 1]);
                  if (cIdx < 11) neighbors.push(gameState.board[rIdx][cIdx + 1]);
                  
                  const adjCorps = new Set(neighbors.filter(n => n && n !== 'Unincorporated'));
                  const adjUnincorp = neighbors.filter(n => n === 'Unincorporated');
                  const safeAdjCorps = Array.from(adjCorps).filter(c => gameState.corporations[c as Corporation]?.isSafe);
                  
                  const availableCorps = Object.values(gameState.corporations).filter(c => !c.isActive);
                  
                  if (safeAdjCorps.length >= 2) {
                    tileIcon = '🚫';
                  } else if (adjCorps.size > 1) {
                    tileIcon = '💥';
                  } else if (adjCorps.size === 0 && adjUnincorp.length > 0 && availableCorps.length > 0) {
                    tileIcon = '✨';
                  }
                }
                
                let renderedCell = cell;
                let isDefunct = false;
                
                if (gameState.phase === 'MergeResolution' && gameState.pendingMerge?.defunctTiles) {
                  const defunct = gameState.pendingMerge.defunctTiles.find(t => t.row === rIdx && t.col === cIdx);
                  if (defunct) {
                    renderedCell = defunct.corp;
                    isDefunct = true;
                  }
                }
                
                return (
                  <div 
                    key={cIdx} 
                    className={`board-cell ${renderedCell ? renderedCell.toLowerCase() : ''} ${isInHand ? 'in-hand' : ''} ${isPlayable ? 'playable' : ''}`}
                    style={{ opacity: isDefunct ? 0.6 : 1, filter: isDefunct ? 'grayscale(0.3)' : 'none' }}
                    onClick={() => {
                      if (isPlayable && tileIcon !== '🚫' && isMyTurn && gameState.phase === 'PlayTile') {
                        playTile(gameState.id, cellId);
                      }
                    }}
                  >
                    <span className="cell-label" style={{ zIndex: 1, position: 'relative' }}>{rIdx + 1}{String.fromCharCode(65 + cIdx)}</span>
                    {renderedCell && renderedCell !== 'Unincorporated' && <span className="cell-corp">{renderedCell}</span>}
                    {isInHand && tileIcon && (
                      <div className="tile-icon-bg" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '3rem', opacity: 0.25, zIndex: 0 }}>
                        {tileIcon}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            );
          })}
              {gameState.phase === 'FoundCorporation' && gameState.pendingFounding?.playerId === playerId && (
                <div className="modal-backdrop" style={{ position: 'absolute', borderRadius: 'inherit', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                  <div className="modal-content glass" style={{ padding: '2rem', minWidth: '300px', textAlign: 'center' }}>
                    <h3>Found a Corporation</h3>
                    <p style={{ marginBottom: '1.5rem' }}>Choose a corporation to found:</p>
                    <div className="corp-options">
                      {(() => {
                        const size = gameState.pendingFounding.size || 2;
                        const prices = new Map<number, string[]>();
                        
                        gameState.pendingFounding.availableCorps.forEach(c => {
                          const price = getStockPrice(c, size);
                          if (!prices.has(price)) prices.set(price, []);
                          prices.get(price)!.push(c);
                        });

                        return Array.from(prices.entries())
                          .sort((a, b) => a[0] - b[0])
                          .map(([price, corps]) => (
                            <div key={price} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                              <strong style={{ width: '60px', textAlign: 'right' }}>${price.toLocaleString()}:</strong>
                              {corps.map(c => (
                                <button 
                                  key={c} 
                                  className={`tile-btn ${c.toLowerCase()}`} 
                                  onClick={() => foundCorporation(gameState.id, c)}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
          {me && (
            <>
              {gameState.phase === 'ChooseMergeSurvivor' && gameState.pendingSurvivorChoice?.playerId === playerId && (
                <div className="modal-backdrop" style={{ position: 'absolute', borderRadius: 'inherit', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                  <div className="modal-content glass" style={{ padding: '2rem', minWidth: '300px', textAlign: 'center' }}>
                    <h3>Choose Surviving Corporation</h3>
                    <p>A merger occurred! Choose which corporation will survive:</p>
                    <div className="corp-buttons" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      {gameState.pendingSurvivorChoice.tiedCorps.map(corp => {
                        const defunctCorps = gameState.pendingSurvivorChoice!.allCorpsInvolved.filter(c => c !== corp);
                        return (
                          <button 
                            key={corp}
                            className={`tile-btn ${corp.toLowerCase()}`}
                            onClick={() => chooseMergeSurvivor(gameState.id, corp)}
                          >
                            Merge {defunctCorps.join(', ')} into {corp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              {isMyTurn && gameState.phase === 'MergeResolution' && pm && dCorp && aCorp && (
                <div className="modal-backdrop" style={{ position: 'absolute', borderRadius: 'inherit', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                  <div className="merge-panel glass" style={{ padding: '1rem', border: '2px solid var(--accent)' }}>
                    <h4>Resolve Merge Stocks</h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', margin: '20px 0' }}>
                    <div className={`board-cell ${dCorp.toLowerCase()}`} style={{ width: '100px', height: '70px', flex: 'none', borderRadius: '8px', opacity: 0.8 }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Defunct</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '4px' }}>{dCorp}</div>
                    </div>
                    <div style={{ fontSize: '2rem', color: 'white' }}>➔</div>
                    <div className={`board-cell ${aCorp.toLowerCase()}`} style={{ width: '100px', height: '70px', flex: 'none', borderRadius: '8px', border: '2px solid white', boxShadow: '0 0 15px rgba(255,255,255,0.3)' }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Survivor</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '4px' }}>{aCorp}</div>
                    </div>
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '1.1rem', marginBottom: '20px' }}>
                    You have <strong>{myDefunctStocks}</strong> shares of <strong>{dCorp}</strong>.
                  </p>
                  
                  {myDefunctStocks > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                      <table style={{ width: '100%', textAlign: 'center', borderSpacing: '0 10px' }}>
                        <tbody>
                          <tr>
                            <td style={{ textAlign: 'left' }}>Trade 2 (${gameState.corporations[dCorp].stockPrice.toLocaleString()}) for 1 (${gameState.corporations[aCorp].stockPrice.toLocaleString()})</td>
                            <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <button disabled={tradeCount <= 0} onClick={() => setTradeCount(t => t - 2)} style={{ width: '30px' }}>-</button>
                              <span style={{ margin: '0 15px', display: 'inline-block', width: '20px', textAlign: 'center' }}>{tradeCount}</span>
                              <button disabled={tradeCount + 2 > Math.min(Math.floor((myDefunctStocks - sellCount) / 2) * 2, gameState.corporations[aCorp].availableStocks * 2)} onClick={() => setTradeCount(t => t + 2)} style={{ width: '30px' }}>+</button>
                              <button disabled={tradeCount + 2 > Math.min(Math.floor((myDefunctStocks - sellCount) / 2) * 2, gameState.corporations[aCorp].availableStocks * 2)} style={{ marginLeft: '10px', width: '40px', padding: '0' }} onClick={() => {
                                const maxTrades = Math.min(Math.floor((myDefunctStocks - sellCount) / 2) * 2, gameState.corporations[aCorp].availableStocks * 2);
                                setTradeCount(maxTrades);
                              }}>All</button>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ textAlign: 'left' }}>Sell (@ ${gameState.corporations[dCorp].stockPrice.toLocaleString()})</td>
                            <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <button disabled={sellCount <= 0} onClick={() => setSellCount(s => s - 1)} style={{ width: '30px' }}>-</button>
                              <span style={{ margin: '0 15px', display: 'inline-block', width: '20px', textAlign: 'center' }}>{sellCount}</span>
                              <button disabled={sellCount + tradeCount + 1 > myDefunctStocks} onClick={() => setSellCount(s => s + 1)} style={{ width: '30px' }}>+</button>
                              <button disabled={sellCount + tradeCount + 1 > myDefunctStocks} style={{ marginLeft: '10px', width: '40px', padding: '0' }} onClick={() => {
                                setSellCount(myDefunctStocks - tradeCount);
                              }}>All</button>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ textAlign: 'left' }}>Keep</td>
                            <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <div style={{ width: '30px' }}></div>
                              <span style={{ margin: '0 15px', display: 'inline-block', width: '20px', fontWeight: 'bold', textAlign: 'center' }}>{keepCount}</span>
                              <div style={{ width: '30px' }}></div>
                              <div style={{ marginLeft: '10px', width: '40px' }}></div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      <button 
                        style={{ marginTop: '10px' }}
                        onClick={() => {
                          resolveMergeStocks(gameState.id, sellCount, tradeCount, keepCount);
                        }}
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => resolveMergeStocks(gameState.id, 0, 0, 0)}>Continue</button>
                  )}
                </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="sidebar">
          <div className="players-list glass">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th></th>
                  {orderedPlayers.map(p => {
                    const isBot = p.name.includes('🤖');
                    const displayName = p.name.replace('🤖 ', '').replace(' (Me)', '').replace(' (You)', '');
                    return (
                      <th key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ minWidth: '75px', textAlign: 'right', verticalAlign: 'bottom', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', height: '24px' }}>
                          {isBot && <span style={{ lineHeight: '1' }}>🤖</span>}
                          <span className="player-name" style={{ color: p.color, position: 'relative', display: 'inline-block', lineHeight: '1' }}>
                            {p.id === activePlayerId && gameState.phase !== 'GameOver' && (
                              <span style={{ 
                                position: 'absolute', 
                                top: '-18px',
                                left: '50%',
                                transform: 'translateX(-50%) scaleX(3)',
                                fontSize: '1.2rem', 
                                color: 'var(--accent)',
                                textShadow: '0 0 5px var(--accent)'
                              }}>
                                ▼
                              </span>
                            )}
                            {displayName}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ minWidth: '50px', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></th>
                  <th style={{ minWidth: '60px' }}></th>
                  <th style={{ position: 'relative' }}>
                    {gameState.phase === 'BuyStocks' && isMyTurn && (
                      <div style={{ position: 'absolute', right: '0', bottom: '4px' }}>
                        <button 
                          className="end-turn-btn action-required-buy" 
                          style={{ padding: '4px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap', width: 'auto' }} 
                          onClick={() => endTurn(gameState.id)}
                        >
                          End Turn
                        </button>
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cash</td>
                  {orderedPlayers.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.cash.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none', position: 'relative' }}>
                    {gameState.phase === 'BuyStocks' && isMyTurn && (
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                          Bought: {gameState.sharesBoughtThisTurn}/3
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Bonus</td>
                  {orderedPlayers.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.bonusValue.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr>
                  <td>Stocks Val</td>
                  {orderedPlayers.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.stockValue.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                  <td>Net Worth</td>
                  {orderedPlayers.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    const allNW = Array.from(new Set(orderedPlayers.map(p2 => getPlayerFinancials(gameState, p2.id).netWorth))).sort((a, b) => b - a);
                    const firstNW = allNW.length > 0 && allNW[0] > 6000 ? allNW[0] : -1;
                    const secondNW = allNW.length > 1 && allNW[1] > 6000 ? allNW[1] : -1;
                    const isFirst = fin.netWorth === firstNW;
                    const isSecond = fin.netWorth === secondNW;
                    
                    return (
                      <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ 
                        textAlign: 'right', 
                        minWidth: '75px',
                        fontWeight: 'bold',
                        color: isFirst ? '#fbbf24' : (isSecond ? '#d97706' : 'inherit'),
                        textShadow: isFirst ? '0 0 8px rgba(251, 191, 36, 0.5)' : (isSecond ? '0 0 8px rgba(217, 119, 6, 0.3)' : 'none')
                      }}>
                        ${fin.netWorth.toLocaleString()}
                      </td>
                    );
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                
                <tr>
                  <td style={{ padding: '10px 0', border: 'none' }}></td>
                  <td colSpan={gameState.players.length} style={{ textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Shares</td>
                  <td style={{ fontWeight: 'bold', border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '8px' }}>Avail</td>
                  <td style={{ fontWeight: 'bold', border: 'none' }}>Price</td>
                  <td style={{ border: 'none' }}></td>
                </tr>

                {Object.entries(gameState.corporations).sort((a, b) => {
                  const corpOrder = ['Tower', 'Luxor', 'American', 'Worldwide', 'Festival', 'Imperial', 'Continental'];
                  return corpOrder.indexOf(a[0]) - corpOrder.indexOf(b[0]);
                }).map(([cName, cState]) => {
                  const holders = orderedPlayers.map(p => ({ id: p.id, count: p.stocks[cName as keyof typeof p.stocks] || 0 })).filter(h => h.count > 0).sort((a,b) => b.count - a.count);
                  const highest = holders.length > 0 ? holders[0].count : 0;
                  const majority = holders.filter(h => h.count === highest).map(h => h.id);
                  const secondHighest = holders.find(h => h.count < highest)?.count;
                  const minority = (majority.length > 1 || !secondHighest) ? [] : holders.filter(h => h.count === secondHighest).map(h => h.id);

                  return (
                    <tr key={cName} className={!cState.isActive ? 'corp-inactive' : ''}>
                      <td className={`corp-name ${cName.toLowerCase()}`} style={{ cursor: 'pointer', textDecoration: 'underline', maxWidth: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => setSelectedCorp(cName as Corporation)} title={`${cState.isSafe ? '🛡️ ' : ''}${!cState.isActive ? '💤 ' : ''}${cName}`.trim()}>
                        {cState.isSafe && '🛡️ '}
                        {!cState.isActive && '💤 '}
                        {cName}
                      </td>
                      {orderedPlayers.map(p => {
                        const isMajority = highest > 0 && majority.includes(p.id);
                        const isMinority = minority.includes(p.id);
                        const numStocks = p.stocks[cName as keyof typeof p.stocks] || 0;
                        return (
                          <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ 
                            textAlign: 'right',
                            fontWeight: isMajority || isMinority ? 'bold' : 'normal',
                            color: isMajority ? '#fbbf24' : (isMinority ? '#d97706' : 'inherit'),
                            textShadow: isMajority ? '0 0 8px rgba(251, 191, 36, 0.5)' : (isMinority ? '0 0 8px rgba(217, 119, 6, 0.3)' : 'none')
                          }}>
                            {numStocks}
                          </td>
                        );
                      })}
                      {(() => {
                        const totalShares = cState.availableStocks + gameState.players.reduce((sum, p) => sum + (p.stocks[cName as keyof typeof p.stocks] || 0), 0);
                        const isBugged = totalShares !== 25;
                        return (
                          <td style={{ textAlign: 'right', borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '8px', color: isBugged ? '#ef4444' : 'inherit', fontWeight: isBugged ? 'bold' : 'normal' }}>
                            {cState.isActive ? cState.availableStocks : '-'}
                          </td>
                        );
                      })()}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {cState.isActive ? `$${cState.stockPrice.toLocaleString()}` : '-'}
                      </td>
                      <td>
                        <button 
                          className={isMyTurn && gameState.phase === 'BuyStocks' && me!.money >= cState.stockPrice && gameState.sharesBoughtThisTurn < 3 && cState.availableStocks > 0 && cState.isActive ? 'action-required-buy' : ''}
                          disabled={!isMyTurn || gameState.phase !== 'BuyStocks' || me!.money < cState.stockPrice || gameState.sharesBoughtThisTurn >= 3 || cState.availableStocks <= 0 || !cState.isActive}
                          onClick={() => buyStock(gameState.id, cName)}
                          style={{ padding: '2px 8px', fontSize: '0.8rem', marginLeft: '10px' }}
                        >
                          Buy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


          {gameState.phase === 'GameOver' && showGameOver && (
            <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div className="modal-content glass" style={{ padding: '3rem', width: '90vw', maxWidth: '1200px', textAlign: 'center', position: 'relative' }}>
                <button 
                  onClick={() => setShowGameOver(false)} 
                  style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '2rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
                <table style={{ width: 'auto', margin: '0 auto', textAlign: 'left', borderSpacing: '20px 5px', marginBottom: '1rem', fontSize: '1rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th>Rank</th>
                      <th>Player</th>
                      <th style={{ textAlign: 'right' }}>Net Worth</th>
                      <th style={{ textAlign: 'center' }}>Founded</th>
                      <th style={{ textAlign: 'center' }}>Mergers</th>
                      <th style={{ textAlign: 'center' }}>1st Bonus</th>
                      <th style={{ textAlign: 'center' }}>2nd Bonus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...gameState.players]
                      .sort((a, b) => getPlayerFinancials(gameState, b.id).netWorth - getPlayerFinancials(gameState, a.id).netWorth)
                      .map((p, index) => {
                        const fin = getPlayerFinancials(gameState, p.id);
                        const stats = p.stats || { chainsFounded: 0, mergesCaused: 0, firstBonuses: 0, secondBonuses: 0, sharesBought: 0 };
                        
                        let extraFirst = 0;
                        let extraSecond = 0;
                        Object.entries(gameState.corporations).forEach(([cName, cState]) => {
                          if (cState.isActive) {
                            const stockHolders = gameState.players.map(p2 => ({ id: p2.id, count: p2.stocks[cName as keyof typeof p2.stocks] || 0 })).filter(p2 => p2.count > 0).sort((a, b) => b.count - a.count);
                            if (stockHolders.length > 0) {
                              const highestCount = stockHolders[0].count;
                              const majorityHolders = stockHolders.filter(p2 => p2.count === highestCount);
                              const secondHighestCount = stockHolders.find(p2 => p2.count < highestCount)?.count;
                              const minorityHolders = secondHighestCount ? stockHolders.filter(p2 => p2.count === secondHighestCount) : [];

                              if (majorityHolders.some(h => h.id === p.id)) extraFirst++;
                              if (minorityHolders.some(h => h.id === p.id)) extraSecond++;
                              if (majorityHolders.length === 1 && minorityHolders.length === 0 && majorityHolders[0].id === p.id) {
                                extraSecond++; // sole shareholder gets both
                              }
                            }
                          }
                        });

                        return (
                          <tr key={p.id} style={{ fontWeight: index === 0 ? 'bold' : 'normal', fontSize: index === 0 ? '1.1rem' : '0.9rem' }}>
                            <td>
                              #{index + 1}
                            </td>
                            <td className="player-name" style={{ color: p.color }}>{p.name.replace('🤖 ', '')}</td>
                            <td style={{ color: 'var(--primary)', textAlign: 'right' }}>${fin.netWorth.toLocaleString()}</td>
                            <td style={{ textAlign: 'center' }}>{stats.chainsFounded}</td>
                            <td style={{ textAlign: 'center' }}>{stats.mergesCaused}</td>
                            <td style={{ textAlign: 'center' }}>{stats.firstBonuses + extraFirst}</td>
                            <td style={{ textAlign: 'center' }}>{stats.secondBonuses + extraSecond}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {gameState.history && gameState.history.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '5px 10px', borderRadius: '8px' }}>
                      <svg width="100%" height="450" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        {(() => {
                          const history = gameState.history;
                          const maxNW = Math.max(...history.flatMap(h => Object.values(h.netWorths)));
                          const minNW = 6000;
                          const range = Math.max(maxNW - minNW, 1000);
                          
                          return gameState.players.map(p => {
                            const points = history.map((h, step) => {
                              const x = (step / Math.max(1, history.length - 1)) * 100;
                              const nw = h.netWorths[p.id] || minNW;
                              const y = 100 - ((nw - minNW) / range) * 100;
                              return `${x},${y}`;
                            }).join(' ');
                            
                            return (
                              <polyline 
                                key={p.id}
                                points={points}
                                fill="none"
                                stroke={p.color}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                              />
                            );
                          });
                        })()}
                      </svg>
                    </div>
                  </div>
                )}


                
              </div>
            </div>
          )}

          {selectedCorp && (
            <div className="modal-backdrop" onClick={() => setSelectedCorp(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ padding: '2rem', minWidth: '300px' }}>
                <h3 className={`corp-name ${selectedCorp.toLowerCase()}`} style={{ marginBottom: '1rem', display: 'inline-block' }}>{selectedCorp} Details</h3>
                <table style={{ width: '100%', textAlign: 'left', borderSpacing: '0 10px' }}>
                  <tbody>
                    <tr><th>Status</th><td>{gameState.corporations[selectedCorp].isActive ? 'Active' : 'Inactive'}</td></tr>
                    <tr><th>Size</th><td>{gameState.corporations[selectedCorp].size} tiles {gameState.corporations[selectedCorp].isSafe ? '🛡️ (Safe)' : ''}</td></tr>
                    {gameState.corporations[selectedCorp].isActive && (
                      <>
                        <tr><th>Stock Price</th><td>${gameState.corporations[selectedCorp].stockPrice.toLocaleString()}</td></tr>
                        <tr><th>Majority Bonus</th><td>${gameState.corporations[selectedCorp].majorityBonus.toLocaleString()}</td></tr>
                        <tr><th>Minority Bonus</th><td>${gameState.corporations[selectedCorp].minorityBonus.toLocaleString()}</td></tr>
                        <tr><th>Available Stocks</th><td>{gameState.corporations[selectedCorp].availableStocks}</td></tr>
                      </>
                    )}
                  </tbody>
                </table>
                <button onClick={() => setSelectedCorp(null)} style={{ marginTop: '1.5rem', width: '100%' }}>Close</button>
              </div>
            </div>
          )}

          <div className="chat glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column' }}>
            <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px', minHeight: '50px', flex: 1, overflow: 'hidden' }}>
              {[...(gameState.chat || [])].reverse().slice(0, 3).map((msg, i) => {
                const senderPlayer = gameState.players.find(p => p.name.replace('🤖 ', '') === msg.sender);
                const senderColor = senderPlayer ? senderPlayer.color : 'var(--accent)';
                return (
                  <div key={i} style={{ fontSize: '0.85rem' }}>
                    <span className="player-name" style={{ color: senderColor }}>{msg.sender}:</span> <span style={{ color: '#e2e8f0' }}>{msg.text}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Say something..."
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
              <button onClick={handleSendChat} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Send</button>
              <button onClick={() => setShowFullChat(true)} className="action-btn" style={{ padding: '4px 12px', fontSize: '0.85rem' }}>View Full Chat</button>
            </div>
          </div>

          <div className="logs glass">
            <div className="log-messages">
              {(() => {
                const reversedLogs = [...gameState.logs].reverse();
                let separatorCount = 0;
                let cutoffIndex = -1;
                for (let i = 0; i < reversedLogs.length; i++) {
                  if (reversedLogs[i].endsWith('---')) separatorCount++;
                  // Show the current active turn plus the last N full turns (one full round)
                  if (separatorCount === gameState.players.length) {
                    cutoffIndex = i;
                    break;
                  }
                }
                const logsToShow = cutoffIndex >= 0 ? reversedLogs.slice(0, cutoffIndex + 1) : reversedLogs;
                return logsToShow.map((log, i) => renderLogLine(log, i));
              })()}
            </div>
            {gameState.logs.length > 0 && (
              <button 
                className="action-btn" 
                style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                onClick={() => setShowFullLogs(true)}
              >
                View Full Game Log
              </button>
            )}
          </div>
        </div>
      </div>

      {showFullLogs && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowFullLogs(false)}>
          <div className="modal-content glass" style={{ padding: '2rem', minWidth: '400px', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Full Game Log</h3>
            <div className="log-messages" style={{ overflowY: 'auto', flex: 1, paddingRight: '10px' }}>
              {[...gameState.logs].reverse().map((log, i) => renderLogLine(log, i))}
            </div>
            <button onClick={() => setShowFullLogs(false)} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}

      {showFullChat && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowFullChat(false)}>
          <div className="modal-content glass" style={{ padding: '2rem', minWidth: '600px', width: '80vw', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px', overflowY: 'auto', flex: 1, paddingRight: '10px', marginBottom: '1rem' }}>
              {[...(gameState.chat || [])].reverse().map((msg, i) => {
                const senderPlayer = gameState.players.find(p => p.name.replace('🤖 ', '') === msg.sender);
                const senderColor = senderPlayer ? senderPlayer.color : 'var(--accent)';
                return (
                  <div key={i} style={{ fontSize: '0.85rem' }}>
                    <span className="player-name" style={{ color: senderColor }}>{msg.sender}:</span> <span style={{ color: '#e2e8f0' }}>{msg.text}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Say something..."
                style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white' }}
              />
              <button onClick={handleSendChat} style={{ padding: '8px 16px' }}>Send</button>
              <button onClick={() => setShowFullChat(false)} className="action-btn" style={{ padding: '8px 16px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
