import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, ref, onValue, update, set, push, get } from '../../firebaseConfig';

const MinesGame = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ walletBalance: 0 });
  const [hasDeposited, setHasDeposited] = useState(false);
  const [betAmount, setBetAmount] = useState('');
  const [mineCount, setMineCount] = useState(3);
  const [riskLevel, setRiskLevel] = useState('Medium');
  const [gameActive, setGameActive] = useState(false);
  const [tiles, setTiles] = useState([]);
  const [revealed, setRevealed] = useState([]);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);
  const [currentWinnings, setCurrentWinnings] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('ctg_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setHasDeposited(parsed.hasDeposited || false);
    }
  }, []);

  const userId = user.id || user._id;

  useEffect(() => {
    if (!userId) return;
    const userRef = ref(db, `users/${userId}`);
    const unsub = onValue(userRef, (snap) => {
      const val = snap.val();
      if (val) {
        setUser(val);
        setHasDeposited(val.hasDeposited || false);
        const stored = JSON.parse(localStorage.getItem('ctg_user') || '{}');
        localStorage.setItem('ctg_user', JSON.stringify({ ...stored, ...val }));
      }
    });
    return unsub;
  }, [userId]);

  const creditWinnings = async (payout, resultStr) => {
    try {
      const snap = await get(ref(db, `users/${userId}/walletBalance`));
      const curBal = snap.val() || 0;
      const newBal = Number((curBal + payout).toFixed(2));

      await update(ref(db, `users/${userId}`), { walletBalance: newBal });

      const stored = JSON.parse(localStorage.getItem('ctg_user') || '{}');
      localStorage.setItem('ctg_user', JSON.stringify({ ...stored, walletBalance: newBal }));

      const txRef = push(ref(db, `transactions/${userId}`));
      await set(txRef, {
        type: 'win',
        amount: payout,
        method: 'mines',
        status: 'completed',
        reference: `WIN_MN_${Date.now()}`,
        createdAt: Date.now()
      });

      setGameHistory((old) => [
        { betAmount, result: resultStr, winnings: `₹${payout.toFixed(2)}`, time: new Date().toLocaleTimeString() },
        ...old.slice(0, 9)
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  // Initialize game
  const startGame = async () => {
    if (!hasDeposited) {
      alert('⚠️ Please make a deposit to activate gameplay!');
      return;
    }
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }
    if (user.walletBalance < amount) {
      alert(`Insufficient balance! Need ₹${amount.toFixed(2)}`);
      return;
    }

    try {
      const newBal = Number((user.walletBalance - amount).toFixed(2));
      await update(ref(db, `users/${userId}`), {
        walletBalance: newBal,
        totalGameplay: Number(((user.totalGameplay || 0) + amount).toFixed(2))
      });

      const stored = JSON.parse(localStorage.getItem('ctg_user') || '{}');
      localStorage.setItem('ctg_user', JSON.stringify({ ...stored, walletBalance: newBal }));

      const txRef = push(ref(db, `transactions/${userId}`));
      await set(txRef, {
        type: 'bet',
        amount: amount,
        method: 'mines',
        status: 'completed',
        reference: `BET_MN_${Date.now()}`,
        createdAt: Date.now()
      });

      const gridSize = 25; // 5x5
      const mines = new Array(gridSize).fill(false);
      const mineIndices = [];

      while (mineIndices.length < mineCount) {
        const idx = Math.floor(Math.random() * gridSize);
        if (!mineIndices.includes(idx)) {
          mineIndices.push(idx);
          mines[idx] = true;
        }
      }

      setTiles(mines);
      setRevealed(new Array(gridSize).fill(false));
      setGameActive(true);
      setGameWon(false);
      setGameLost(false);
      setCurrentWinnings(amount * 1.1);
    } catch (e) {
      console.error(e);
      alert('Failed to place bet. Please try again.');
    }
  };

  // Click on tile
  const clickTile = (idx) => {
    if (!gameActive || revealed[idx]) return;

    const newRevealed = [...revealed];
    newRevealed[idx] = true;
    setRevealed(newRevealed);

    if (tiles[idx]) {
      // Hit a mine
      setGameActive(false);
      setGameLost(true);
      setGameHistory((old) => [
        { betAmount, result: 'Lost', winnings: '₹0', time: new Date().toLocaleTimeString() },
        ...old.slice(0, 9)
      ]);
    } else {
      // Safe tile
      const safeCount = newRevealed.filter((r, i) => r && !tiles[i]).length;
      const multiplier = 1 + safeCount * 0.1;
      const winnings = parseFloat(betAmount) * multiplier;
      setCurrentWinnings(winnings);

      // Check if all safe tiles revealed
      if (safeCount + mineCount === 25) {
        setGameActive(false);
        setGameWon(true);
        creditWinnings(winnings, 'Won (All Safe)');
      }
    }
  };

  // Cashout
  const cashOut = () => {
    setGameActive(false);
    creditWinnings(currentWinnings, 'Cashed Out');
  };

  const gridSize = 5;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f1929 0%, #050b1c 100%)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{ fontSize: '1.5rem' }}>←</span>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ffd700' }}>MINES</h1>
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          💰 ₹{user.walletBalance || 0}.00
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        {/* Game Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#aab8ff', marginBottom: 4 }}>Bet Amount</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffd700' }}>₹{betAmount || '0'}</div>
          </div>
          <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: gameActive ? '#22c55e' : '#ff69b4', marginBottom: 4 }}>
              {gameActive ? 'Current Winnings' : gameWon ? 'Won' : gameLost ? 'Lost' : 'Winnings'}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: gameWon ? '#22c55e' : gameLost ? '#ef4444' : '#ffd700' }}>
              ₹{currentWinnings.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div
          style={{
            background: 'rgba(30,40,80,0.6)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: 8
          }}
        >
          {tiles.map((isMine, idx) => {
            const isRevealed = revealed[idx];
            return (
              <button
                key={idx}
                onClick={() => clickTile(idx)}
                disabled={!gameActive || isRevealed}
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  cursor: gameActive && !isRevealed ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  background: isRevealed
                    ? isMine
                      ? 'linear-gradient(135deg, #ef4444, #cc0000)'
                      : 'linear-gradient(135deg, #22c55e, #00aa00)'
                    : 'linear-gradient(135deg, rgba(100,200,255,0.2), rgba(100,200,255,0.05))',
                  border: isRevealed ? '2px solid rgba(0,0,0,0.3)' : '2px solid rgba(100,200,255,0.3)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (gameActive && !isRevealed) e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  if (gameActive && !isRevealed) e.target.style.transform = 'scale(1)';
                }}
              >
                {isRevealed ? isMine ? '💣' : '✅' : ''}
              </button>
            );
          })}
        </div>

        {/* Game Status */}
        {gameWon && (
          <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))', borderRadius: 12, padding: 16, marginBottom: 16, border: '2px solid #22c55e', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#22c55e' }}>YOU WON!</div>
            <div style={{ fontSize: '0.85rem', color: '#aab8ff', marginTop: 4 }}>All safe tiles revealed!</div>
          </div>
        )}
        {gameLost && (
          <div style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))', borderRadius: 12, padding: 16, marginBottom: 16, border: '2px solid #ef4444', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💥</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>YOU HIT A MINE!</div>
            <div style={{ fontSize: '0.85rem', color: '#aab8ff', marginTop: 4 }}>Better luck next time!</div>
          </div>
        )}

        {/* Controls & Settings */}
        {!hasDeposited ? (
          <div style={{
            background: 'rgba(30,40,80,0.85)',
            border: '2px dashed #ff3d7f',
            borderRadius: 16,
            padding: '30px 20px',
            textAlign: 'center',
            marginBottom: 16,
            boxShadow: '0 0 30px rgba(255, 61, 127, 0.15)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#ff3d7f', fontWeight: 900 }}>Gameplay Locked</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#aab8ff', lineHeight: '1.4' }}>
              A one-time deposit is required to activate games. Deposit at least ₹100 to start playing.
            </p>
            <button onClick={() => navigate('/wallet')} style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg,#ff3d7f,#ff5663)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(255, 61, 127, 0.4)'
            }}>
              💳 Deposit Now
            </button>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {gameActive && (
                <button
                  onClick={cashOut}
                  style={{
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ff8c00, #ff6b00)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(255, 140, 0, 0.3)'
                  }}
                >
                  💰 CASH OUT
                </button>
              )}
              {!gameActive && (
                <button
                  onClick={startGame}
                  style={{
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #00ff00, #00cc00)',
                    color: '#000',
                    fontWeight: 700,
                    cursor: 'pointer',
                    gridColumn: '1 / -1',
                    boxShadow: '0 4px 15px rgba(0, 255, 0, 0.3)'
                  }}
                >
                  🎮 START GAME
                </button>
              )}
            </div>

            {/* Settings */}
            <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 16, padding: 14, marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: '#ffd700' }}>⚙️ SETTINGS</p>

              {/* Bet Amount */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.75rem', color: '#aab8ff', display: 'block', marginBottom: 4 }}>Bet Amount</label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={gameActive}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff'
                  }}
                />
              </div>

              {/* Mine Count */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.75rem', color: '#aab8ff', display: 'block', marginBottom: 4 }}>Mines: {mineCount}</label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={mineCount}
                  onChange={(e) => setMineCount(parseInt(e.target.value))}
                  disabled={gameActive}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Risk Level */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['Easy', 'Medium', 'Hard'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setRiskLevel(level)}
                    disabled={gameActive}
                    style={{
                      padding: '8px',
                      borderRadius: 8,
                      border: riskLevel === level ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                      background: riskLevel === level ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.2)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: gameActive ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* Auto Play */}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="autoplay"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  disabled={gameActive}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="autoplay" style={{ color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
                  Enable Auto Play
                </label>
              </div>
            </div>
          </>
        )}

        {/* Game History */}
        <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 16, padding: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: '#ffd700' }}>🏆 GAME HISTORY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
            {gameHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', padding: 20 }}>No games played yet</div>
            ) : (
              gameHistory.map((game, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 8,
                    fontSize: '0.85rem'
                  }}
                >
                  <div>
                    <div style={{ color: '#fff' }}>Bet: ₹{game.betAmount}</div>
                    <div style={{ color: game.result === 'Won' || game.result === 'Cashed Out' ? '#22c55e' : '#ef4444', fontSize: '0.75rem' }}>
                      {game.result}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: game.result === 'Won' || game.result === 'Cashed Out' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {game.winnings}
                    </div>
                    <div style={{ color: '#aab8ff', fontSize: '0.75rem' }}>{game.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinesGame;
