import React, { useState } from 'react';
import { useSocket } from './SocketContext';
import { calculateNetWorth, getPlayerFinancials, getStockPrice } from '@acquire/shared';
import './App.css';

function App() {
  const { connected, gameState, createGame, joinGame, addBot, startGame, playTile, foundCorporation, buyStock, endTurn, socket } = useSocket();
  const [username, setUsername] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  
  // Merge Resolution State
  const [sellCount, setSellCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  // Corp Details Modal State
  const [selectedCorp, setSelectedCorp] = useState<string | null>(null);
  const [showFullLogs, setShowFullLogs] = useState(false);

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

    return (
      <React.Fragment key={i}>
        {logStr.endsWith('---') && i !== 0 && (
          <hr style={{ margin: '8px 0', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.3)' }} />
        )}
        <div style={{ color: logStr.endsWith('---') ? 'var(--text-muted)' : 'inherit' }}>
          {elements}
        </div>
      </React.Fragment>
    );
  };

  const me = gameState?.players.find(p => p.id === socket?.id);
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
        <h1>Acquire</h1>
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
  const isMyTurn = activePlayerId === socket?.id;
  
  const keepCount = myDefunctStocks - sellCount - tradeCount;

  return (
    <div className="game-container">
      <header className="glass">
        <div className="status">
          Phase: {gameState.phase}
          {gameState.phase !== 'Lobby' && (
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
                  const safeAdjCorps = Array.from(adjCorps).filter(c => gameState.corporations[c as string]?.isSafe);
                  
                  const availableCorps = Object.values(gameState.corporations).filter(c => !c.isActive);
                  
                  if (safeAdjCorps.length >= 2) {
                    tileIcon = '🚫';
                  } else if (adjCorps.size > 1) {
                    tileIcon = '💥';
                  } else if (adjCorps.size === 0 && adjUnincorp.length > 0 && availableCorps.length > 0) {
                    tileIcon = '✨';
                  }
                }
                
                return (
                  <div 
                    key={cIdx} 
                    className={`board-cell ${cell ? cell.toLowerCase() : ''} ${isPlayable ? 'playable' : ''}`}
                    onClick={() => {
                      if (isPlayable && tileIcon !== '🚫' && isMyTurn && gameState.phase === 'PlayTile') {
                        playTile(gameState.id, cellId);
                      }
                    }}
                  >
                    <span className="cell-label" style={{ zIndex: 1, position: 'relative' }}>{rIdx + 1}{String.fromCharCode(65 + cIdx)}</span>
                    {cell && cell !== 'Unincorporated' && <span className="cell-corp">{cell}</span>}
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
            <h3>Scoreboard & Market</h3>
            <table className="scoreboard-table">
              <thead>
                <tr>
                  <th>Category</th>
                  {(() => {
                    const playerFin = gameState.players.map(p => ({
                      id: p.id,
                      netWorth: getPlayerFinancials(gameState, p.id).netWorth
                    }));
                    
                    playerFin.sort((a, b) => b.netWorth - a.netWorth);
                    const ranks = new Map<string, number>();
                    let currentRank = 1;
                    let currentScore = -1;
                    playerFin.forEach((p, index) => {
                      if (p.netWorth !== currentScore) {
                        currentRank = index + 1;
                        currentScore = p.netWorth;
                      }
                      ranks.set(p.id, currentRank);
                    });

                    return gameState.players.map(p => {
                      const netWorth = getPlayerFinancials(gameState, p.id).netWorth;
                      const rank = netWorth > 6000 ? ranks.get(p.id) : null;
                      
                      let medal = null;
                      if (rank === 1) medal = <span className="medal medal-1">1</span>;
                      else if (rank === 2 && gameState.players.length > 2) medal = <span className="medal medal-2">2</span>;
                      else if (rank === 3 && gameState.players.length > 3) medal = <span className="medal medal-3">3</span>;

                      return (
                        <th key={p.id} className={p.id === me?.id ? 'me-col' : (p.id === activePlayerId ? 'active-player-col' : '')} style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                            {medal}
                            <span style={{ color: p.color }}>{p.name.replace(' (Me)', '').replace(' (You)', '')}</span>
                          </div>
                        </th>
                      );
                    });
                  })()}
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
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right' }}>${fin.cash.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr>
                  <td>Bonus</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right' }}>${fin.bonusValue.toLocaleString()}</td>;
                  })}
                  <td style={{ border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>
                  <td style={{ border: 'none' }}></td>
                  <td style={{ border: 'none' }}></td>
                </tr>
                <tr>
                  <td>Stocks Val</td>
                  {gameState.players.map(p => {
                    const fin = getPlayerFinancials(gameState, p.id);
                    return <td key={p.id} className={p.id === me?.id ? 'me-col' : ''} style={{ textAlign: 'right' }}>${fin.stockValue.toLocaleString()}</td>;
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
                  <td style={{ padding: '10px 0', fontWeight: 'bold', border: 'none' }}>Corporations</td>
                  {gameState.players.map(p => <td key={p.id} style={{ border: 'none' }}></td>)}
                  <td style={{ fontWeight: 'bold', border: 'none', borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '8px' }}>Avail</td>
                  <td style={{ fontWeight: 'bold', border: 'none' }}>Price</td>
                  <td style={{ border: 'none' }}></td>
                </tr>

                {Object.entries(gameState.corporations).map(([cName, cState]) => {
                  const holders = gameState.players.map(p => ({ id: p.id, count: p.stocks[cName as keyof typeof p.stocks] || 0 })).filter(h => h.count > 0).sort((a,b) => b.count - a.count);
                  const highest = holders.length > 0 ? holders[0].count : 0;
                  const majority = holders.filter(h => h.count === highest).map(h => h.id);
                  const secondHighest = holders.find(h => h.count < highest)?.count;
                  const minority = secondHighest ? holders.filter(h => h.count === secondHighest).map(h => h.id) : [];

                  return (
                    <tr key={cName} className={!cState.isActive ? 'corp-inactive' : ''}>
                      <td className={`corp-name ${cName.toLowerCase()}`} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setSelectedCorp(cName)}>
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
                      <td style={{ textAlign: 'right', borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '8px' }}>{cState.isActive ? cState.availableStocks : '-'}</td>
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
              {gameState.phase === 'FoundCorporation' && gameState.pendingFounding?.playerId === socket?.id && (
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
                                  onClick={() => socket.emit('foundCorporation', { gameId: gameState.id, corpName: c })}
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
              {gameState.phase === 'ChooseMergeSurvivor' && gameState.pendingSurvivorChoice?.playerId === socket?.id && (
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
                            onClick={() => socket.emit('chooseMergeSurvivor', { gameId: gameState.id, survivorName: corp })}
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
                              <button disabled={tradeCount + 2 > Math.min(Math.floor((myDefunctStocks - sellCount) / 2) * 2, gameState.corporations[aCorp].availableStocks * 2)} style={{ marginLeft: '10px', width: '40px' }} onClick={() => {
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
                              <button disabled={sellCount + tradeCount + 1 > myDefunctStocks} style={{ marginLeft: '10px', width: '40px' }} onClick={() => {
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
                          socket.emit('resolveMergeStocks', { gameId: gameState.id, sellCount, tradeCount, keepCount });
                        }}
                      >
                        Confirm Resolution
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => socket.emit('resolveMergeStocks', { gameId: gameState.id, sellCount: 0, tradeCount: 0, keepCount: 0 })}>Continue</button>
                  )}
                </div>
              )}
            </>
          )}

          {gameState.phase === 'GameOver' && (
            <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
              <div className="modal-content glass" style={{ padding: '3rem', width: '90vw', maxWidth: '1200px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: '0 0 1rem 0', color: 'var(--primary)' }}>Game Over!</h1>
                <h2 style={{ marginBottom: '2rem' }}>
                  {(() => {
                    const sorted = [...gameState.players].sort((a, b) => getPlayerFinancials(gameState, b.id).netWorth - getPlayerFinancials(gameState, a.id).netWorth);
                    return `${sorted[0].name} Wins!`;
                  })()}
                </h2>
                
                <table style={{ width: 'auto', margin: '0 auto', textAlign: 'left', borderSpacing: '40px 15px', marginBottom: '2rem', fontSize: '1.2rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Net Worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...gameState.players]
                      .sort((a, b) => getPlayerFinancials(gameState, b.id).netWorth - getPlayerFinancials(gameState, a.id).netWorth)
                      .map((p, index) => {
                        const fin = getPlayerFinancials(gameState, p.id);
                        return (
                          <tr key={p.id} style={{ fontWeight: index === 0 ? 'bold' : 'normal', fontSize: index === 0 ? '1.2rem' : '1rem' }}>
                            <td>
                              #{index + 1}
                            </td>
                            <td style={{ color: p.color }}>{p.name.replace('🤖 ', '')}</td>
                            <td style={{ color: 'var(--primary)' }}>${fin.netWorth.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {gameState.history && gameState.history.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '1.2rem' }}>Net Worth Over Time</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px 10px', borderRadius: '8px' }}>
                      <svg width="100%" height="150" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
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
                
                <button 
                  className="tile-btn"
                  style={{ width: '100%', padding: '15px', fontSize: '1.2rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                  onClick={() => {
                    window.history.replaceState(null, '', '/');
                    window.location.reload();
                  }}
                >
                  Return to Lobby
                </button>
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
            <h3>Game Logs</h3>
            <div className="log-messages">
              {(() => {
                const reversedLogs = [...gameState.logs].reverse();
                let cutoffIndex = -1;
                if (me) {
                  const isMyTurn = gameState.turnOrder[gameState.currentPlayerIndex] === me.id;
                  const turns: number[] = [];
                  reversedLogs.forEach((log, idx) => {
                    if (log.startsWith(`${me.name.replace('🤖 ', '')} played tile`)) {
                      turns.push(idx);
                    }
                  });

                  if (isMyTurn) {
                    cutoffIndex = turns.length > 0 ? turns[0] : -1;
                  } else {
                    cutoffIndex = turns.length > 1 ? turns[1] : (turns.length > 0 ? turns[0] : -1);
                  }
                }
                const logsToShow = cutoffIndex >= 0 ? reversedLogs.slice(0, cutoffIndex + 1) : reversedLogs.slice(0, 15);
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
