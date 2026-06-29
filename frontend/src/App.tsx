import React, { useState } from 'react';
import { useSocket } from './SocketContext';
import { type Corporation, getPlayerFinancials, getStockPrice } from '@acquire/shared';
import './App.css';

function App() {
  const { connected, gameState, createGame, joinGame, addBot, startGame, playTile, buyStock, endTurn, rejoinGame, playerId, socket } = useSocket();
  const [username, setUsername] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  
  // Merge Resolution State
  const [sellCount, setSellCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

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
      elements.push(<span key="name" style={{ color: player.color, fontWeight: 'bold' }}>{namePart}</span>);
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

  if (!connected) {
    return <div className="loading">Connecting to server...</div>;
  }

  if (!gameState) {
    return (
      <div className="lobby-container">
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
          </div>
        </div>
      </div>
    );
  }

  const activePlayerId = gameState.phase === 'MergeResolution' && gameState.pendingMerge 
    ? gameState.turnOrder[gameState.pendingMerge.playerResolutionIndex] 
    : gameState.turnOrder[gameState.currentPlayerIndex];
    
  const activePlayerName = gameState.players.find(p => p.id === activePlayerId)?.name || 'Someone';
  const isMyTurn = activePlayerId === playerId;
  
  const keepCount = myDefunctStocks - sellCount - tradeCount;

  return (
    <div className="game-container">
      <header className="glass">
        <div className="status" style={{ display: 'flex', alignItems: 'center' }}>
          {gameState.phase === 'GameOver' && !showGameOver && (
            <button onClick={() => setShowGameOver(true)} style={{ marginLeft: '1rem', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Show Final Results
            </button>
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
        {gameState.phase === 'Lobby' ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => addBot(gameState.id)}>Add Bot</button>
            <button onClick={() => startGame(gameState.id)} disabled={gameState.players.length < 2}>Start Game</button>
            <button className="quit-btn" onClick={() => window.location.reload()}>Quit Game</button>
          </div>
        ) : (
          <button className="quit-btn" onClick={() => window.location.reload()}>Quit Game</button>
        )}
      </header>

      <div className="main-content">
        <div className="board glass">
          {gameState.board.map((row, rIdx) => (
            <div key={rIdx} className="board-row">
              {row.map((cell, cIdx) => {
                const cellId = `${rIdx + 1}${String.fromCharCode(65 + cIdx)}`;
                const isPlayable = me?.tiles.some(t => t.id === cellId);
                let tileIcon = null;
                
                if (isPlayable) {
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
                    className={`board-cell ${renderedCell ? renderedCell.toLowerCase() : ''} ${isPlayable ? 'playable' : ''}`}
                    style={{ opacity: isDefunct ? 0.6 : 1, filter: isDefunct ? 'grayscale(0.3)' : 'none' }}
                    onClick={() => {
                      if (isPlayable && tileIcon !== '🚫' && isMyTurn && gameState.phase === 'PlayTile') {
                        playTile(gameState.id, cellId);
                      }
                    }}
                  >
                    <span className="cell-label" style={{ zIndex: 1, position: 'relative' }}>{rIdx + 1}{String.fromCharCode(65 + cIdx)}</span>
                    {renderedCell && renderedCell !== 'Unincorporated' && <span className="cell-corp">{renderedCell}</span>}
                    {isPlayable && tileIcon && (
                      <div className="tile-icon-bg" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '3rem', opacity: 0.25, zIndex: 0 }}>
                        {tileIcon}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar">
          <div className="players-list glass">
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th></th>
                  {gameState.players.map(p => {
                      return (
                        <th key={p.id} className={` ${p.id === me?.id ? 'me-col' : ''} ${p.id === activePlayerId ? 'active-player-col' : ''}`} style={{ textAlign: 'right', minWidth: '75px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: p.color }}>{p.name.replace(' (Me)', '').replace(' (You)', '')}</span>
                          </div>
                        </th>
                      );
                    })}
                  <th style={{ minWidth: '50px', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></th>
                  <th style={{ minWidth: '60px' }}></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cash</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.cash.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr>
                  <td>Bonus</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.bonusValue.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr>
                  <td>Stocks Val</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right', minWidth: '75px' }}>${fin.stockValue.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                  <td>Net Worth</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    const allNW = Array.from(new Set(gameState.players.map(p2 => getPlayerFinancials(gameState, p2.id).netWorth))).sort((a, b) => b - a);
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

                {Object.entries(gameState.corporations).map(([cName, cState]) => {
                  const holders = gameState.players.map(p => ({ id: p.id, count: p.stocks[cName as keyof typeof p.stocks] || 0 })).filter(h => h.count > 0).sort((a,b) => b.count - a.count);
                  const highest = holders.length > 0 ? holders[0].count : 0;
                  const majority = holders.filter(h => h.count === highest).map(h => h.id);
                  const secondHighest = holders.find(h => h.count < highest)?.count;
                  const minority = (majority.length > 1 || !secondHighest) ? [] : holders.filter(h => h.count === secondHighest).map(h => h.id);

                  return (
                    <tr key={cName} className={!cState.isActive ? 'corp-inactive' : ''}>
                      <td className={`corp-name ${cName.toLowerCase()}`} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setSelectedCorp(cName as Corporation)}>
                        {cName} {cState.isSafe && '🛡️'} {!cState.isActive && '💤'}
                      </td>
                      {gameState.players.map(p => {
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
            
            {gameState.phase === 'BuyStocks' && isMyTurn && (
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                 <span>Shares bought: {gameState.sharesBoughtThisTurn}/3</span>
                 <button className="end-turn-btn" style={{ width: 'auto', marginLeft: '10px', padding: '5px 15px' }} onClick={() => endTurn(gameState.id)}>End Turn</button>
              </div>
            )}
          </div>

          {me && (
            <>
              {gameState.phase === 'FoundCorporation' && gameState.pendingFounding?.playerId === playerId && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
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
                                  onClick={() => socket?.emit('foundCorporation', { gameId: gameState.id, corpName: c })}
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
              {gameState.phase === 'ChooseMergeSurvivor' && gameState.pendingSurvivorChoice?.playerId === playerId && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
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
                            onClick={() => socket?.emit('chooseMergeSurvivor', { gameId: gameState.id, survivorName: corp })}
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
                <div className="merge-panel glass" style={{ padding: '1rem', border: '2px solid var(--accent)' }}>
                  <h4>Resolve Merge Stocks</h4>
                  <p><strong>{dCorp}</strong> is defunct. <strong>{aCorp}</strong> is the survivor.</p>
                  <p>You have <strong>{myDefunctStocks}</strong> shares of {dCorp}.</p>
                  
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
                          socket?.emit('resolveMergeStocks', { gameId: gameState.id, sellCount, tradeCount, keepCount });
                        }}
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => socket?.emit('resolveMergeStocks', { gameId: gameState.id, sellCount: 0, tradeCount: 0, keepCount: 0 })}>Continue</button>
                  )}
                </div>
              )}
            </>
          )}

          {gameState.phase === 'GameOver' && showGameOver && (
            <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div className="modal-content glass" style={{ padding: '3rem', width: '90vw', maxWidth: '1200px', textAlign: 'center', position: 'relative' }}>
                <button 
                  onClick={() => setShowGameOver(false)} 
                  style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '2rem', cursor: 'pointer' }}
                >
                  &times;
                </button>
                <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Game Over!</h1>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>
                  {(() => {
                    const sorted = [...gameState.players].sort((a, b) => getPlayerFinancials(gameState, b.id).netWorth - getPlayerFinancials(gameState, a.id).netWorth);
                    return `${sorted[0].name} Wins!`;
                  })()}
                </h2>
                
                <table style={{ width: 'auto', margin: '0 auto', textAlign: 'left', borderSpacing: '20px 5px', marginBottom: '1rem', fontSize: '1rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Net Worth</th>
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
                            <td style={{ color: p.color }}>{p.name.replace('🤖 ', '')}</td>
                            <td style={{ color: 'var(--primary)' }}>${fin.netWorth.toLocaleString()}</td>
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
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '1.2rem' }}>Net Worth Over Time</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px 10px', borderRadius: '8px' }}>
                      <svg width="100%" height="250" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
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
    </div>
  );
}

export default App;
