import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, ref, onValue, update, set, push, get } from '../../firebaseConfig';

const AviatorGame = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  const [user, setUser] = useState({ walletBalance: 0 });
  const [hasDeposited, setHasDeposited] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'running', 'crashed'
  const [crashMultiplier, setCrashMultiplier] = useState(0);

  // Betting states
  const [bet1, setBet1] = useState({ amount: '10', placed: false, cashedOut: false, winAmount: 0 });
  const [bet2, setBet2] = useState({ amount: '50', placed: false, cashedOut: false, winAmount: 0 });
  const [autoCashout1, setAutoCashout1] = useState('');
  const [autoCashout2, setAutoCashout2] = useState('');

  // History
  const [history, setHistory] = useState([
    { mult: 1.24, color: '#3b82f6' },
    { mult: 2.15, color: '#9333ea' },
    { mult: 1.05, color: '#3b82f6' },
    { mult: 14.80, color: '#f43f5e' },
    { mult: 3.42, color: '#9333ea' },
    { mult: 1.12, color: '#3b82f6' },
    { mult: 5.60, color: '#9333ea' },
    { mult: 1.01, color: '#3b82f6' }
  ]);

  const userId = user.id || user._id;

  // Listen to live user wallet & deposit status
  useEffect(() => {
    const storedUser = localStorage.getItem('ctg_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setHasDeposited(parsed.hasDeposited || false);
    }
  }, []);

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

  // Flight Game Animation Loop
  const progressRef = useRef(0);
  const animationRef = useRef(null);

  const startFlight = () => {
    setGameState('running');
    setMultiplier(1.0);
    setCrashMultiplier(0);
    progressRef.current = 0;

    // Determine random crash multiplier for this round (between 1.1x and 25x)
    const randomTarget = Number((1.1 + Math.random() * Math.random() * 20).toFixed(2));

    const startTime = Date.now();

    const loop = () => {
      const elapsed = (Date.now() - startTime) / 1000; // in seconds
      const currentMult = Number((1.0 + Math.pow(elapsed, 1.35) * 0.4).toFixed(2));

      if (currentMult >= randomTarget) {
        // Crash
        setGameState('crashed');
        setCrashMultiplier(currentMult);
        setMultiplier(currentMult);

        const newColor = currentMult >= 10 ? '#f43f5e' : currentMult >= 2 ? '#9333ea' : '#3b82f6';
        setHistory(prev => [{ mult: currentMult, color: newColor }, ...prev.slice(0, 15)]);

        // Reset bets if not cashed out
        setBet1(prev => ({ ...prev, placed: false }));
        setBet2(prev => ({ ...prev, placed: false }));

        setTimeout(() => {
          setGameState('waiting');
          setMultiplier(1.0);
        }, 3000);
        return;
      }

      setMultiplier(currentMult);
      progressRef.current = Math.min(1, elapsed / 8);

      // Check Auto Cashouts
      if (autoCashout1 && parseFloat(autoCashout1) <= currentMult) {
        handleCashOut(1, currentMult);
      }
      if (autoCashout2 && parseFloat(autoCashout2) <= currentMult) {
        handleCashOut(2, currentMult);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // HTML5 Canvas Rendering for Aviator Flight Path
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (gameState === 'running' || gameState === 'crashed') {
      const p = progressRef.current;
      const startX = 40;
      const startY = height - 40;
      const endX = startX + p * (width - 120);
      const endY = startY - Math.pow(p, 1.2) * (height - 100);
      const controlX = startX + (endX - startX) * 0.5;
      const controlY = startY;

      // Draw Filled Curved Area under Flight
      const areaGradient = ctx.createLinearGradient(0, 0, 0, height);
      areaGradient.addColorStop(0, gameState === 'crashed' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(244, 63, 94, 0.4)');
      areaGradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, endY);
      ctx.lineTo(endX, height);
      ctx.lineTo(startX, height);
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();

      // Draw Trailing Red Neon Line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(controlX, controlY, endX, endY);
      ctx.strokeStyle = gameState === 'crashed' ? '#ef4444' : '#f43f5e';
      ctx.lineWidth = 4;
      ctx.shadowColor = gameState === 'crashed' ? '#ef4444' : '#f43f5e';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [gameState, multiplier]);

  // Place Bet
  const handlePlaceBet = async (panelNum) => {
    if (!hasDeposited) {
      alert('⚠️ Please make a deposit to activate gameplay!');
      return;
    }

    const betState = panelNum === 1 ? bet1 : bet2;
    const amount = parseFloat(betState.amount);

    if (!amount || amount <= 0) {
      alert('Enter a valid bet amount');
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
        method: 'aviator',
        status: 'completed',
        reference: `BET_AV_${Date.now()}`,
        createdAt: Date.now()
      });

      if (panelNum === 1) {
        setBet1(prev => ({ ...prev, placed: true, cashedOut: false, winAmount: 0 }));
      } else {
        setBet2(prev => ({ ...prev, placed: true, cashedOut: false, winAmount: 0 }));
      }

      if (gameState === 'waiting') {
        startFlight();
      }
    } catch (e) {
      console.error(e);
      alert('Bet failed');
    }
  };

  // Cash Out
  const handleCashOut = async (panelNum, currentM = multiplier) => {
    const betState = panelNum === 1 ? bet1 : bet2;
    if (!betState.placed || betState.cashedOut) return;

    const amount = parseFloat(betState.amount);
    const payout = Number((amount * currentM).toFixed(2));

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
        method: 'aviator',
        status: 'completed',
        reference: `WIN_AV_${Date.now()}`,
        createdAt: Date.now()
      });

      if (panelNum === 1) {
        setBet1(prev => ({ ...prev, cashedOut: true, winAmount: payout }));
      } else {
        setBet2(prev => ({ ...prev, cashedOut: true, winAmount: payout }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate current plane position for SVG overlay
  const p = progressRef.current;
  const planeXPos = 40 + p * (400 - 120);
  const planeYPos = 240 - Math.pow(p, 1.2) * 160;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c14',
      color: '#fff',
      paddingBottom: 80,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: '#121524',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>‹</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.4rem' }}>✈️</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f43f5e', letterSpacing: '0.05em' }}>AVIATOR</span>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: '0.9rem',
          fontWeight: 800,
          color: '#22c55e'
        }}>
          💰 ₹{Number(user.walletBalance || 0).toFixed(2)}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '10px' }}>

        {/* Top Multipliers History Pill Bar */}
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 10,
          scrollbarWidth: 'none'
        }}>
          {history.map((h, i) => (
            <div
              key={i}
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${h.color}`,
                color: h.color,
                fontWeight: 800,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap'
              }}
            >
              {h.mult.toFixed(2)}x
            </div>
          ))}
        </div>

        {/* Flight Cockpit Screen */}
        <div style={{
          background: 'radial-gradient(circle at center, #181c2e 0%, #0d0f19 100%)',
          borderRadius: 20,
          border: '1px solid rgba(244,63,94,0.3)',
          position: 'relative',
          height: 280,
          overflow: 'hidden',
          marginBottom: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
        }}>

          {/* HTML5 Canvas Grid & Arc */}
          <canvas
            ref={canvasRef}
            width={440}
            height={280}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* SVG Red Jet Aircraft */}
          {gameState === 'running' && (
            <div style={{
              position: 'absolute',
              left: `${planeXPos}px`,
              top: `${planeYPos}px`,
              transition: 'all 0.1s linear',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <svg width="70" height="44" viewBox="0 0 100 60" style={{ filter: 'drop-shadow(0 4px 14px rgba(244, 63, 94, 0.8))' }}>
                {/* Exhaust Jet Fire */}
                <path d="M 5 30 Q -20 30 -35 28 Q -20 30 -35 32 Z" fill="url(#fireGradient)" />
                {/* Jet Fuselage */}
                <path d="M 10 30 Q 30 15 80 25 Q 95 30 80 35 Q 30 45 10 30 Z" fill="url(#bodyGradient)" />
                {/* Wings */}
                <path d="M 45 25 L 30 2 L 48 2 L 60 25 Z" fill="#e11d48" />
                <path d="M 45 35 L 30 58 L 48 58 L 60 35 Z" fill="#be123c" />
                {/* Tail Fin */}
                <path d="M 12 30 L 2 10 L 18 10 L 25 30 Z" fill="#9f1239" />
                {/* Cockpit Glass Canopy */}
                <path d="M 55 24 Q 68 20 75 27 Q 65 29 55 27 Z" fill="#38bdf8" opacity="0.9" />
                {/* Propeller / Nose */}
                <ellipse cx="85" cy="30" rx="3" ry="8" fill="#fbbf24" />

                <defs>
                  <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#9f1239" />
                    <stop offset="50%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                  <linearGradient id="fireGradient" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}

          {/* Center Stage Multiplier Counter */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            {gameState === 'running' && (
              <div style={{
                fontSize: '3.6rem',
                fontWeight: 900,
                color: '#ffffff',
                textShadow: '0 0 35px rgba(244,63,94,0.8), 0 0 10px rgba(244,63,94,0.5)',
                fontFamily: 'Inter, sans-serif'
              }}>
                {multiplier.toFixed(2)}x
              </div>
            )}

            {gameState === 'crashed' && (
              <div style={{ textAlign: 'center', animation: 'popIn 0.3s ease' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.8)' }}>
                  FLEW AWAY!
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#94a3b8', marginTop: 4 }}>
                  @{crashMultiplier.toFixed(2)}x
                </div>
              </div>
            )}

            {gameState === 'waiting' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24', marginBottom: 6 }}>
                  WAITING FOR NEXT ROUND
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Place your bets to start flight
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lock Alert for Deposit */}
        {!hasDeposited ? (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '2px dashed #f43f5e',
            borderRadius: 18,
            padding: '28px 20px',
            textAlign: 'center',
            marginBottom: 16
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>🔒</div>
            <h3 style={{ margin: '0 0 6px 0', color: '#f43f5e', fontWeight: 900 }}>Gameplay Locked</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              A one-time deposit is required to activate gameplay. Please make a deposit to start flying!
            </p>
            <button onClick={() => navigate('/wallet')} style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(244,63,94,0.4)'
            }}>
              💳 Deposit Now
            </button>
          </div>
        ) : (
          /* Dual Bet Cockpit Panels */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            {/* Bet Cockpit 1 */}
            <div style={{
              background: '#121524',
              borderRadius: 16,
              padding: 12,
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>BET 1</span>
                {bet1.cashedOut && <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 900 }}>+₹{bet1.winAmount}</span>}
              </div>

              <input
                type="number"
                value={bet1.amount}
                onChange={(e) => setBet1(prev => ({ ...prev, amount: e.target.value }))}
                disabled={bet1.placed}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginBottom: 8,
                  boxSizing: 'border-box'
                }}
              />

              {/* Quick Amount Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 10 }}>
                {['10', '50', '100', '500'].map(amt => (
                  <button
                    key={amt}
                    disabled={bet1.placed}
                    onClick={() => setBet1(prev => ({ ...prev, amount: amt }))}
                    style={{
                      padding: '4px 2px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#94a3b8',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              {!bet1.placed ? (
                <button
                  onClick={() => handlePlaceBet(1)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.35)'
                  }}
                >
                  BET ₹{bet1.amount || '0'}
                </button>
              ) : (
                <button
                  disabled={bet1.cashedOut || gameState !== 'running'}
                  onClick={() => handleCashOut(1)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: bet1.cashedOut ? '#334155' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: bet1.cashedOut || gameState !== 'running' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(249,115,22,0.35)'
                  }}
                >
                  {bet1.cashedOut ? 'CASHED OUT' : `CASH OUT ₹${(parseFloat(bet1.amount || 0) * multiplier).toFixed(2)}`}
                </button>
              )}
            </div>

            {/* Bet Cockpit 2 */}
            <div style={{
              background: '#121524',
              borderRadius: 16,
              padding: 12,
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>BET 2</span>
                {bet2.cashedOut && <span style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 900 }}>+₹{bet2.winAmount}</span>}
              </div>

              <input
                type="number"
                value={bet2.amount}
                onChange={(e) => setBet2(prev => ({ ...prev, amount: e.target.value }))}
                disabled={bet2.placed}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  marginBottom: 8,
                  boxSizing: 'border-box'
                }}
              />

              {/* Quick Amount Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 10 }}>
                {['10', '50', '100', '500'].map(amt => (
                  <button
                    key={amt}
                    disabled={bet2.placed}
                    onClick={() => setBet2(prev => ({ ...prev, amount: amt }))}
                    style={{
                      padding: '4px 2px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#94a3b8',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              {!bet2.placed ? (
                <button
                  onClick={() => handlePlaceBet(2)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(34,197,94,0.35)'
                  }}
                >
                  BET ₹{bet2.amount || '0'}
                </button>
              ) : (
                <button
                  disabled={bet2.cashedOut || gameState !== 'running'}
                  onClick={() => handleCashOut(2)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    border: 'none',
                    background: bet2.cashedOut ? '#334155' : 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    cursor: bet2.cashedOut || gameState !== 'running' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(249,115,22,0.35)'
                  }}
                >
                  {bet2.cashedOut ? 'CASHED OUT' : `CASH OUT ₹${(parseFloat(bet2.amount || 0) * multiplier).toFixed(2)}`}
                </button>
              )}
            </div>

          </div>
        )}

      </div>

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AviatorGame;
