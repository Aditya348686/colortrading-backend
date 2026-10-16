import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, ref, onValue, update, set, push, get } from '../../firebaseConfig';

const VortexGame = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ walletBalance: 0 });
  const [hasDeposited, setHasDeposited] = useState(false);
  const [betAmount, setBetAmount] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [showFireworks, setShowFireworks] = useState(false);

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

  const wheelSections = [
    { color: '#22c55e', label: '2x', reward: 2 },
    { color: '#ef4444', label: '5x', reward: 5 },
    { color: '#7c3aed', label: '10x', reward: 10 },
    { color: '#ffd700', label: '50x', reward: 50 },
    { color: '#ff1493', label: '100x', reward: 100 },
    { color: '#00bfff', label: '3x', reward: 3 }
  ];

  const spinWheel = async () => {
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
        method: 'vortex',
        status: 'completed',
        reference: `BET_VX_${Date.now()}`,
        createdAt: Date.now()
      });

      setSpinning(true);
      const randomRotation = Math.floor(Math.random() * 360) + 1080;
      setWheelRotation(randomRotation);

      setTimeout(async () => {
        const normalizedRotation = randomRotation % 360;
        const sectionAngle = 360 / wheelSections.length;
        const resultIndex = Math.floor(normalizedRotation / sectionAngle) % wheelSections.length;
        
        const winResult = wheelSections[resultIndex];
        const rewardAmount = parseFloat((amount * winResult.reward).toFixed(2));
        
        try {
          const uSnap = await get(ref(db, `users/${userId}/walletBalance`));
          const curBal = uSnap.val() || 0;
          const finalBal = Number((curBal + rewardAmount).toFixed(2));
          
          await update(ref(db, `users/${userId}`), { walletBalance: finalBal });
          
          const storedAfter = JSON.parse(localStorage.getItem('ctg_user') || '{}');
          localStorage.setItem('ctg_user', JSON.stringify({ ...storedAfter, walletBalance: finalBal }));

          const txWinRef = push(ref(db, `transactions/${userId}`));
          await set(txWinRef, {
            type: 'win',
            amount: rewardAmount,
            method: 'vortex',
            status: 'completed',
            reference: `WIN_VX_${Date.now()}`,
            createdAt: Date.now()
          });
        } catch (dbErr) {
          console.error(dbErr);
        }

        setResult(winResult);
        setShowFireworks(true);
        setGameHistory((old) => [
          {
            multiplier: `${winResult.reward}x`,
            amount: `₹${rewardAmount}`,
            time: new Date().toLocaleTimeString()
          },
          ...old.slice(0, 9)
        ]);

        setTimeout(() => {
          setShowFireworks(false);
          setSpinning(false);
          setTimeout(() => setResult(null), 2000);
        }, 1500);
      }, 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to place bet. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0f1929 0%, #050b1c 100%)', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{ fontSize: '1.5rem' }}>←</span>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ffd700' }}>VORTEX</h1>
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
          💰 ₹{user.walletBalance || 0}.00
        </div>
      </div>

      <div style={{ padding: '12px' }}>
        {/* Spinning Wheel Container */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,20,147,0.1))',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255,215,0,0.3)',
            position: 'relative',
            minHeight: 340
          }}
        >
          {/* Pointer Arrow */}
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '2rem',
              zIndex: 10
            }}
          >
            🔺
          </div>

          {/* Spinning Wheel */}
          <svg
            viewBox="0 0 200 200"
            style={{
              width: 280,
              height: 280,
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning ? 'transform 3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
            }}
          >
            {wheelSections.map((section, idx) => {
              const angle = (360 / wheelSections.length) * idx;
              const radius = 100;
              const startAngle = (angle * Math.PI) / 180;
              const endAngle = ((angle + 360 / wheelSections.length) * Math.PI) / 180;

              return (
                <g key={idx}>
                  {/* Pie slice */}
                  <path
                    d={`
                      M 100 100
                      L ${100 + radius * Math.cos(startAngle)} ${100 + radius * Math.sin(startAngle)}
                      A ${radius} ${radius} 0 0 1 ${100 + radius * Math.cos(endAngle)} ${100 + radius * Math.sin(endAngle)}
                      Z
                    `}
                    fill={section.color}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="2"
                  />
                  {/* Label */}
                  <text
                    x={100 + (radius / 1.5) * Math.cos(startAngle + Math.PI / 6)}
                    y={100 + (radius / 1.5) * Math.sin(startAngle + Math.PI / 6)}
                    textAnchor="middle"
                    dy="0.3em"
                    fill="#fff"
                    fontSize="16"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {section.label}
                  </text>
                </g>
              );
            })}
            {/* Center circle */}
            <circle cx="100" cy="100" r="30" fill="#050b1c" stroke="#ffd700" strokeWidth="3" />
            <circle cx="100" cy="100" r="20" fill="#0f1929" />
          </svg>

          {/* Result Display */}
          {result && (
            <div
              style={{
                position: 'absolute',
                background: `linear-gradient(135deg, ${result.color}dd, ${result.color}99)`,
                border: `3px solid ${result.color}`,
                borderRadius: 20,
                padding: '20px 40px',
                textAlign: 'center',
                animation: 'slideIn 0.5s ease-out'
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: 8 }}>YOU WON</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffd700' }}>{result.reward}x</div>
              <div style={{ fontSize: '1rem', color: '#fff', marginTop: 8 }}>₹{(parseFloat(betAmount) * result.reward).toFixed(2)}</div>
            </div>
          )}

          {/* Fireworks */}
          {showFireworks && (
            <>
              <div style={{ position: 'absolute', fontSize: '3rem', animation: 'float 1.5s ease-out' }}>🎉</div>
              <div style={{ position: 'absolute', fontSize: '3rem', animation: 'float 1.5s ease-out 0.3s' }}>🎆</div>
              <div style={{ position: 'absolute', fontSize: '3rem', animation: 'float 1.5s ease-out 0.6s' }}>✨</div>
              <div style={{ position: 'absolute', fontSize: '3rem', animation: 'float 1.5s ease-out 0.9s' }}>🎇</div>
            </>
          )}
        </div>

        {/* Bet input & spin button */}
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
            {/* Bet Amount Input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.85rem', color: '#aab8ff', marginBottom: 6, display: 'block' }}>Bet Amount</label>
              <input
                type="number"
                placeholder="Enter bet amount"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={spinning}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '1rem',
                  textAlign: 'center'
                }}
              />
            </div>

            {/* Spin Button */}
            <button
              onClick={spinWheel}
              disabled={spinning}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: 'none',
                background: spinning ? 'rgba(255,215,0,0.3)' : 'linear-gradient(135deg, #ffd700, #ff8c00)',
                color: '#000',
                fontWeight: 700,
                fontSize: '1.1rem',
                cursor: spinning ? 'not-allowed' : 'pointer',
                marginBottom: 16,
                boxShadow: '0 6px 20px rgba(255,215,0,0.4)',
                opacity: spinning ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => !spinning && (e.target.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => !spinning && (e.target.style.transform = 'scale(1)')}
            >
              {spinning ? '🎡 SPINNING...' : '🎡 SPIN WHEEL'}
            </button>
          </>
        )}

        {/* Game Statistics */}
        <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 16, padding: 14, marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: '#ffd700' }}>📊 REWARDS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {wheelSections.map((section, idx) => (
              <div
                key={idx}
                style={{
                  background: section.color,
                  borderRadius: 10,
                  padding: '8px',
                  textAlign: 'center',
                  color: '#000',
                  fontWeight: 700
                }}
              >
                {section.label}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Results */}
        <div style={{ background: 'rgba(30,40,80,0.6)', borderRadius: 16, padding: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: '#ffd700' }}>🏆 RECENT RESULTS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
            {gameHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', padding: 20 }}>No results yet</div>
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
                    <div style={{ color: '#ffd700', fontWeight: 700 }}>{game.multiplier}</div>
                    <div style={{ color: '#aab8ff', fontSize: '0.75rem' }}>{game.time}</div>
                  </div>
                  <div style={{ color: '#22c55e', fontWeight: 700 }}>{game.amount}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float {
          0% { opacity: 1; transform: translateY(0) translateX(0); }
          100% { opacity: 0; transform: translateY(-100px) translateX(${Math.random() * 100 - 50}px); }
        }
      `}</style>
    </div>
  );
};

export default VortexGame;
