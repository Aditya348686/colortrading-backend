import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, ref, set, onValue, push, update, get } from '../../firebaseConfig';
import { payReferralCommission } from '../../services/authService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getNumberColor = (num) => {
  if (num === 0 || num === 5) return 'violet';
  if ([1, 3, 7, 9].includes(num)) return 'green';
  return 'red';
};

const getNumberColorHex = (num) => {
  const c = getNumberColor(num);
  return c === 'green' ? '#00d084' : c === 'violet' ? '#c084fc' : '#f43f5e';
};

const PERIOD_SECONDS = { '30sec': 30, '1min': 60, '3min': 180, '5min': 300, '10min': 600 };
const ALL_PERIODS = ['30sec', '1min', '3min', '5min', '10min'];

const PERIOD_DISPLAY_NAMES = {
  '30sec': 'WinGo 30sec',
  '1min': 'WinGo 1 Min',
  '3min': 'WinGo 3 Min',
  '5min': 'WinGo 5 Min',
  '10min': 'WinGo 10 Min'
};

// ─── 3D Lottery Ball ──────────────────────────────────────────────────────────
const Ball = ({ num, size = 44 }) => {
  let bg = '';
  if (num === 0) bg = 'conic-gradient(#f43f5e 0deg 180deg, #c084fc 180deg 360deg)';
  else if (num === 5) bg = 'conic-gradient(#00d084 0deg 180deg, #c084fc 180deg 360deg)';
  else if ([1, 3, 7, 9].includes(num)) bg = 'radial-gradient(circle at 35% 35%, #4ade80, #00d084 65%, #047857)';
  else bg = 'radial-gradient(circle at 35% 35%, #fb7185, #f43f5e 65%, #be123c)';

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      padding: Math.max(2, size * 0.08),
      boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(0,0,0,0.3)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', boxSizing: 'border-box', flexShrink: 0
    }}>
      <div style={{
        position: 'absolute', top: '8%', left: '20%', width: '40%', height: '25%',
        background: 'rgba(255,255,255,0.5)', borderRadius: '50%',
        transform: 'rotate(-20deg)', pointerEvents: 'none'
      }} />
      <div style={{
        width: '72%', height: '72%', borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 40%, #ffffff, #f1f5f9)',
        boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 900, fontSize: size * 0.42, color: '#0f172a', fontFamily: 'Roboto, sans-serif'
      }}>{num}</div>
    </div>
  );
};

// ─── Flip Digit ───────────────────────────────────────────────────────────────
const FlipDigit = ({ char }) => {
  if (char === ':') return (
    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', margin: '0 2px', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>:</div>
  );
  return (
    <div style={{
      background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
      color: '#fff', borderRadius: 8, padding: '6px 10px',
      fontSize: '1.6rem', fontWeight: 900, fontFamily: 'Inter, monospace',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.08)',
      minWidth: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        background: 'rgba(255,255,255,0.04)', borderRadius: '8px 8px 0 0'
      }} />
      {char}
    </div>
  );
};

// ─── Period Tab Clock ─────────────────────────────────────────────────────────
const ClockIcon = ({ active }) => (
  <div style={{
    width: 36, height: 36, borderRadius: '50%',
    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, fontSize: '1.1rem'
  }}>⏱</div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const ColorWinGame = () => {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('ctg_user') || '{}');
  const userId = storedUser.id || storedUser._id || null;

  const [walletBalance, setWalletBalance] = useState(storedUser.walletBalance || 0);
  const [hasDeposited, setHasDeposited] = useState(storedUser.hasDeposited || false);
  const [totalGameplay, setTotalGameplay] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('1min');
  const [activeTab, setActiveTab] = useState('game');

  const [periodTimers, setPeriodTimers] = useState(() => {
    const init = {};
    ALL_PERIODS.forEach(p => { init[p] = { timeLeft: PERIOD_SECONDS[p], periodId: '', endTime: 0 }; });
    return init;
  });

  const [allPeriodResults, setAllPeriodResults] = useState(() => {
    const init = {};
    ALL_PERIODS.forEach(p => { init[p] = []; });
    return init;
  });
  const [recentResults, setRecentResults] = useState([]);
  const [myBets, setMyBets] = useState([]);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [betAmount, setBetAmount] = useState('10');
  const [multiplier, setMultiplier] = useState(1);
  const [betMsg, setBetMsg] = useState(null);
  const [showResult, setShowResult] = useState(null);
  const [betLoading, setBetLoading] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [resultCountdown, setResultCountdown] = useState(4);

  const periodIdRefs = useRef({});
  const resultTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const prevTimeLeftRef = useRef(null);
  ALL_PERIODS.forEach(p => { if (!periodIdRefs.current[p]) periodIdRefs.current[p] = ''; });

  // ── Sound Engine (Web Audio API - no files needed) ──
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTick = (type = 'tick') => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tick') {
        // Sharp tick beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'lock') {
        // Low thud when locked
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'win') {
        // Win fanfare
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
          g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.1 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.25);
          o.start(ctx.currentTime + i * 0.1);
          o.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
        return;
      } else if (type === 'lose') {
        // Loss sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) { /* sound not supported */ }
  };

  // Live Wallet
  useEffect(() => {
    if (!userId) return;
    const unsub = onValue(ref(db, `users/${userId}/walletBalance`), (snap) => {
      const val = snap.val();
      if (val !== null && val !== undefined) setWalletBalance(val);
    });
    return unsub;
  }, [userId]);

  // totalGameplay
  useEffect(() => {
    if (!userId) return;
    const unsub = onValue(ref(db, `users/${userId}/totalGameplay`), (snap) => {
      const val = snap.val();
      if (val !== null && val !== undefined) setTotalGameplay(val);
    });
    return unsub;
  }, [userId]);

  // hasDeposited
  useEffect(() => {
    if (!userId) return;
    const unsub = onValue(ref(db, `users/${userId}/hasDeposited`), (snap) => {
      const val = snap.val();
      if (val !== null && val !== undefined) {
        setHasDeposited(val);
        const stored = JSON.parse(localStorage.getItem('ctg_user') || '{}');
        localStorage.setItem('ctg_user', JSON.stringify({ ...stored, hasDeposited: val }));
      }
    });
    return unsub;
  }, [userId]);

  // Sync wallet to localStorage
  useEffect(() => {
    if (walletBalance !== undefined && walletBalance !== null) {
      const stored = JSON.parse(localStorage.getItem('ctg_user') || '{}');
      if (stored.walletBalance !== walletBalance) {
        localStorage.setItem('ctg_user', JSON.stringify({ ...stored, walletBalance }));
      }
    }
  }, [walletBalance]);

  // Subscribe ALL period results
  useEffect(() => {
    const unsubs = ALL_PERIODS.map(p => {
      const r = ref(db, `wingoResults/${p}`);
      return onValue(r, (snap) => {
        const data = snap.val();
        const arr = data
          ? Object.entries(data).map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
          : [];
        setAllPeriodResults(prev => ({ ...prev, [p]: arr }));
        if (p === selectedPeriod) setRecentResults(arr.slice(0, 10));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    setRecentResults(allPeriodResults[selectedPeriod]?.slice(0, 10) || []);
  }, [selectedPeriod, allPeriodResults]);

  // My Bets
  useEffect(() => {
    if (!userId) return;
    const unsub = onValue(ref(db, `bets/${userId}/wingo`), (snap) => {
      const data = snap.val();
      if (data) {
        const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => b.placedAt - a.placedAt).slice(0, 30);
        setMyBets(arr);
      } else { setMyBets([]); }
    });
    return unsub;
  }, [userId]);

  const prevMyBetsRef = useRef([]);
  const isInitialBetsLoad = useRef(true);

  // Win/Loss popup with countdown
  useEffect(() => {
    if (isInitialBetsLoad.current) {
      if (myBets.length > 0) { prevMyBetsRef.current = myBets; isInitialBetsLoad.current = false; }
      return;
    }
    myBets.forEach(bet => {
      const prevBet = prevMyBetsRef.current.find(b => b.id === bet.id);
      const isNewlySettled = bet.status !== 'pending' && prevBet && prevBet.status === 'pending';
      if (isNewlySettled && bet.period === selectedPeriod) {
        const resultColor = getNumberColor(bet.result);
        setShowResult({ number: bet.result, color: resultColor, won: bet.status === 'won', payout: bet.payout || 0, betAmount: bet.amount });
        // 🔊 Play win/loss sound
        playTick(bet.status === 'won' ? 'win' : 'lose');
        setResultCountdown(4);
        if (resultTimerRef.current) clearInterval(resultTimerRef.current);
        let cnt = 4;
        resultTimerRef.current = setInterval(() => {
          cnt--;
          setResultCountdown(cnt);
          if (cnt <= 0) { clearInterval(resultTimerRef.current); setShowResult(null); }
        }, 1000);
      }
    });
    prevMyBetsRef.current = myBets;
  }, [myBets, selectedPeriod]);

  // Deterministic wall-clock fallback generator
  const getDeterministicPeriodInfo = (periodType) => {
    const duration = PERIOD_SECONDS[periodType] || 60;
    const now = Date.now();
    const block = Math.floor(now / (duration * 1000));
    const endTime = (block + 1) * duration * 1000;
    const tl = Math.max(0, Math.ceil((endTime - now) / 1000));

    const blockStart = new Date(block * duration * 1000);
    const yyyy = blockStart.getFullYear();
    const mm = String(blockStart.getMonth() + 1).padStart(2, '0');
    const dd = String(blockStart.getDate()).padStart(2, '0');
    const hh = String(blockStart.getHours()).padStart(2, '0');
    const min = String(blockStart.getMinutes()).padStart(2, '0');
    const sec = String(blockStart.getSeconds()).padStart(2, '0');
    const tag = periodType.replace('sec', 's').replace('min', 'm');
    const pid = `${yyyy}${mm}${dd}${hh}${min}${sec}_${tag}`;

    return { periodId: pid, endTime, timeLeft: tl };
  };

  // Sync backend timers
  useEffect(() => {
    const unsub = onValue(ref(db, 'gameControl/wingo/periods'), (snap) => {
      const data = snap.val() || {};
      setPeriodTimers(prev => {
        const next = { ...prev };
        ALL_PERIODS.forEach(p => {
          if (data[p]) {
            const { periodId, endTime } = data[p];
            periodIdRefs.current[p] = periodId;
            const tl = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            next[p] = { timeLeft: tl, periodId, endTime };
          }
        });
        return next;
      });
    });
    return unsub;
  }, []);

  // Local countdown tick
  useEffect(() => {
    const timer = setInterval(() => {
      setPeriodTimers(prev => {
        let changed = false;
        const next = { ...prev };
        ALL_PERIODS.forEach(p => {
          if (prev[p] && prev[p].endTime) {
            const tl = Math.max(0, Math.ceil((prev[p].endTime - Date.now()) / 1000));
            if (tl !== prev[p].timeLeft) { next[p] = { ...prev[p], timeLeft: tl }; changed = true; }
          }
        });
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { return () => { if (resultTimerRef.current) clearInterval(resultTimerRef.current); }; }, []);

  // Timer & Lock resolution: Fallback to deterministic timer if server state is missing or 0
  const fallbackInfo = getDeterministicPeriodInfo(selectedPeriod);
  const currentTimer = periodTimers[selectedPeriod];
  const timeLeft = (currentTimer && currentTimer.timeLeft > 0)
    ? currentTimer.timeLeft
    : fallbackInfo.timeLeft;
  const currentPeriodId = currentTimer?.periodId || periodIdRefs.current[selectedPeriod] || fallbackInfo.periodId;

  // Lock ONLY during final 5 seconds (5, 4, 3, 2, 1) of the round
  const isLocked = timeLeft <= 5 && timeLeft > 0;

  // ── Countdown Sound Effect (5,4,3,2,1 tick + lock) ──
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== prevTimeLeftRef.current) {
      if (timeLeft === 5 || timeLeft === 4 || timeLeft === 3 || timeLeft === 2 || timeLeft === 1) {
        playTick('tick');
      }
    }
    if (timeLeft === 0 && prevTimeLeftRef.current > 0) {
      playTick('lock');
    }
    prevTimeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  const handlePlaceBet = async () => {
    if (!selectedColor && selectedNumber === null && !selectedSize) {
      setBetMsg({ text: '⚠️ Please select a Color, Number, or Big/Small', type: 'error' });
      setTimeout(() => setBetMsg(null), 3000); return;
    }
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      setBetMsg({ text: '⚠️ Enter a valid bet amount', type: 'error' });
      setTimeout(() => setBetMsg(null), 3000); return;
    }
    if (!userId) {
      setBetMsg({ text: '⚠️ Please login to place bets', type: 'error' });
      setTimeout(() => setBetMsg(null), 3000); return;
    }
    const totalCost = amount * multiplier;
    if (walletBalance < totalCost) {
      setBetMsg({ text: `⚠️ Insufficient balance! Need ₹${totalCost.toFixed(2)}`, type: 'error' });
      setTimeout(() => setBetMsg(null), 3000); return;
    }
    if (timeLeft <= 5 && timeLeft > 0) {
      setBetMsg({ text: '⚠️ Betting closed for final 5 seconds! Wait for next round.', type: 'error' });
      setTimeout(() => setBetMsg(null), 3000); return;
    }
    setBetLoading(true);
    try {
      const newBal = Number((walletBalance - totalCost).toFixed(2));
      const newGameplay = Number(((totalGameplay || 0) + totalCost).toFixed(2));
      await update(ref(db, `users/${userId}`), { walletBalance: newBal, totalGameplay: newGameplay });
      localStorage.setItem('ctg_user', JSON.stringify({ ...storedUser, walletBalance: newBal }));
      const txRef = push(ref(db, `transactions/${userId}`));
      await set(txRef, { type: 'bet', amount: totalCost, method: 'wingo', status: 'completed', reference: currentPeriodId, createdAt: Date.now() });
      let betType, betValue;
      if (selectedColor) { betType = 'color'; betValue = selectedColor; }
      else if (selectedNumber !== null) { betType = 'number'; betValue = String(selectedNumber); }
      else { betType = 'size'; betValue = selectedSize; }
      const betRef = push(ref(db, `bets/${userId}/wingo`));
      await set(betRef, { periodId: currentPeriodId, gameType: 'wingo', period: selectedPeriod, betType, betValue, amount, multiplier, totalCost, status: 'pending', placedAt: Date.now() });
      setBetMsg({ text: `✅ Bet placed! ₹${totalCost.toFixed(2)} deducted`, type: 'success' });
      setTimeout(() => setBetMsg(null), 3000);
      setSelectedColor(null); setSelectedNumber(null); setSelectedSize(null); setMultiplier(1);
      // Pay referral commission to sponsors (non-blocking)
      payReferralCommission(userId, totalCost).catch(console.error);
    } catch (err) {
      setBetMsg({ text: '❌ Bet failed: ' + err.message, type: 'error' });
      setTimeout(() => setBetMsg(null), 4000);
    } finally { setBetLoading(false); }
  };

  const handleRandomSelect = () => {
    if (isLocked) return;
    const randomNum = Math.floor(Math.random() * 10);
    setSelectedNumber(randomNum); setSelectedColor(null); setSelectedSize(null);
  };

  const multipliersList = [1, 5, 10, 20, 50, 100];

  const colorBtnStyle = (b, isSel) => ({
    padding: '14px 6px', borderRadius: 16, border: isSel ? '2px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.1)',
    background: b.bg, color: '#fff', fontWeight: 900, fontSize: '0.95rem',
    cursor: isLocked ? 'not-allowed' : 'pointer',
    boxShadow: isSel ? `0 0 20px ${b.glow}, 0 6px 16px ${b.glow}` : `0 4px 10px ${b.glow}`,
    opacity: isLocked ? 0.4 : 1, transition: 'all 0.2s ease',
    transform: isSel ? 'scale(1.05) translateY(-2px)' : 'scale(1)'
  });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0d0f1a 0%, #111827 100%)', color: '#fff', paddingBottom: 90, fontFamily: '"Inter", -apple-system, sans-serif' }}>
      <style>{`
        @keyframes fadeInBg { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn { 0% { transform: scale(0.5) translateY(30px); opacity: 0; } 70% { transform: scale(1.05) translateY(-4px); } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes countdown { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 100; } }
        .bet-btn:hover { transform: scale(1.04) translateY(-1px) !important; }
        .tab-btn:hover { background: rgba(255,255,255,0.08) !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      {/* ── Result Modal (timer always visible inside) ── */}
      {showResult && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', animation: 'fadeInBg 0.3s ease' }}>

          {/* Timer always visible at top of result modal */}
          <div style={{ marginBottom: 20, textAlign: 'center', animation: 'slideUp 0.4s ease' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Next Round In</div>
            <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <FlipDigit char={mm[0]} /><FlipDigit char={mm[1]} /><FlipDigit char=':' /><FlipDigit char={ss[0]} /><FlipDigit char={ss[1]} />
            </div>
          </div>

          {/* Result Card */}
          <div style={{
            background: showResult.won
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)'
              : 'linear-gradient(135deg, #4c0519 0%, #881337 50%, #be123c 100%)',
            borderRadius: 28, padding: '32px 28px', textAlign: 'center', minWidth: 300, maxWidth: '90%',
            animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: showResult.won ? '0 30px 60px rgba(5,150,105,0.4), 0 0 0 1px rgba(5,150,105,0.3)' : '0 30px 60px rgba(190,18,60,0.4), 0 0 0 1px rgba(190,18,60,0.3)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: 8 }}>{showResult.won ? '🏆' : '💔'}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '0.06em', marginBottom: 4 }}>
              {showResult.won ? 'YOU WON!' : 'BETTER LUCK'}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: 20 }}>
              {showResult.won ? 'Congratulations!' : 'Try again next round'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: '14px 18px', marginBottom: 16 }}>
              <Ball num={showResult.number} size={52} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.72rem', opacity: 0.6, marginBottom: 2 }}>Result</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'capitalize' }}>{showResult.color}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{showResult.number >= 5 ? 'Big' : 'Small'} · #{showResult.number}</div>
              </div>
            </div>

            {showResult.won ? (
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fef08a', textShadow: '0 0 20px rgba(254,240,138,0.5)' }}>+₹{showResult.payout.toFixed(2)}</div>
            ) : (
              <div style={{ fontSize: '1.1rem', opacity: 0.7, color: '#fca5a5' }}>-₹{showResult.betAmount.toFixed(2)}</div>
            )}

            {/* Auto close countdown */}
            <div style={{ marginTop: 16, fontSize: '0.75rem', opacity: 0.5 }}>Closing in {resultCountdown}s</div>
            <button onClick={() => { setShowResult(null); if (resultTimerRef.current) clearInterval(resultTimerRef.current); }}
              style={{ marginTop: 10, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 12, padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{ fontSize: '1.2rem' }}>‹</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, background: 'linear-gradient(90deg, #facc15, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>🎰 WinGo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 14px', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>💰</span><span>₹{Number(walletBalance).toFixed(2)}</span>
          </div>
          <button onClick={() => window.location.reload()} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '1rem', cursor: 'pointer', borderRadius: 8, padding: '5px 8px' }}>🔄</button>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '14px 12px' }}>

        {/* ── Period Tabs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {['30sec', '1min', '3min', '5min'].map((p) => {
            const isActive = selectedPeriod === p;
            const t = periodTimers[p];
            const pct = t?.endTime ? Math.max(0, (t.endTime - Date.now()) / (PERIOD_SECONDS[p] * 1000)) : 1;
            return (
              <button key={p} onClick={() => setSelectedPeriod(p)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '10px 4px 8px', borderRadius: 16, border: isActive ? '1px solid rgba(250,204,21,0.4)' : '1px solid rgba(255,255,255,0.06)',
                background: isActive ? 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(250,204,21,0.15))' : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fbbf24' : '#64748b', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 4px 16px rgba(249,115,22,0.2)' : 'none'
              }}>
                <ClockIcon active={isActive} />
                <span style={{ whiteSpace: 'nowrap' }}>{p === '30sec' ? '30sec' : p === '1min' ? '1 Min' : p === '3min' ? '3 Min' : '5 Min'}</span>
              </button>
            );
          })}
        </div>

        {/* ── Timer + Period Banner ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
          borderRadius: 20, padding: '18px 20px', marginBottom: 14,
          boxShadow: '0 8px 32px rgba(79,70,229,0.3)', border: '1px solid rgba(99,102,241,0.3)',
          position: 'relative', overflow: 'hidden'
        }}>
          {/* Glow decoration */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', filter: 'blur(30px)', pointerEvents: 'none' }} />

          {/* Ticket cutouts */}
          <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: '#111827' }} />
          <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: '#111827' }} />
          <div style={{ position: 'absolute', left: '49%', top: 12, bottom: 12, borderLeft: '1px dashed rgba(255,255,255,0.15)', pointerEvents: 'none' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <button onClick={() => setShowRuleModal(true)} style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
                padding: '4px 12px', color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4
              }}>📖 How to play</button>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#c7d2fe', marginBottom: 10 }}>{PERIOD_DISPLAY_NAMES[selectedPeriod]}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                {(recentResults.length >= 5 ? recentResults.slice(0, 5) : [{ number: 4 }, { number: 7 }, { number: 5 }, { number: 6 }, { number: 1 }])
                  .map((res, idx) => <Ball key={idx} num={res.number} size={28} />)}
              </div>
            </div>

            {/* Right: Timer — ALWAYS rendered */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time Remaining</div>
              <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
                <FlipDigit char={mm[0]} /><FlipDigit char={mm[1]} /><FlipDigit char=':' /><FlipDigit char={ss[0]} /><FlipDigit char={ss[1]} />
              </div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.05em', wordBreak: 'break-all' }}>
                {currentPeriodId?.slice(0, 16)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {currentTimer?.endTime > 0 && (
            <div style={{ marginTop: 14, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: timeLeft <= 10 ? '#f43f5e' : timeLeft <= 30 ? '#f97316' : '#6366f1',
                width: `${Math.min(100, (timeLeft / PERIOD_SECONDS[selectedPeriod]) * 100)}%`,
                transition: 'width 0.5s linear, background 0.5s ease',
                boxShadow: timeLeft <= 10 ? '0 0 8px #f43f5e' : 'none'
              }} />
            </div>
          )}
        </div>

        {/* ── Locked Alert ── */}
        {isLocked && (
          <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#fb7185', borderRadius: 12, padding: '10px 14px', marginBottom: 12, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', animation: 'pulse 1s infinite' }}>
            🔒 Betting locked — Next round starting...
          </div>
        )}

        {/* ── Bet Message ── */}
        {betMsg && (
          <div style={{
            background: betMsg.type === 'success' ? 'rgba(0,208,132,0.1)' : 'rgba(244,63,94,0.1)',
            border: `1px solid ${betMsg.type === 'success' ? 'rgba(0,208,132,0.3)' : 'rgba(244,63,94,0.3)'}`,
            color: betMsg.type === 'success' ? '#00d084' : '#fb7185',
            borderRadius: 12, padding: '10px 14px', marginBottom: 12, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', animation: 'slideUp 0.3s ease'
          }}>{betMsg.text}</div>
        )}

        {/* ── Color Buttons ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Green', color: 'green', bg: 'linear-gradient(135deg, #00d084, #059669)', glow: 'rgba(0,208,132,0.35)' },
            { label: 'Violet', color: 'violet', bg: 'linear-gradient(135deg, #c084fc, #9333ea)', glow: 'rgba(192,132,252,0.35)' },
            { label: 'Red', color: 'red', bg: 'linear-gradient(135deg, #f43f5e, #be123c)', glow: 'rgba(244,63,94,0.35)' }
          ].map((b) => {
            const isSel = selectedColor === b.color;
            return (
              <button key={b.color} className="bet-btn" disabled={isLocked}
                onClick={() => { setSelectedColor(isSel ? null : b.color); setSelectedNumber(null); setSelectedSize(null); }}
                style={colorBtnStyle(b, isSel)}>
                {b.label}
              </button>
            );
          })}
        </div>

        {/* ── Number Balls Grid ── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: '16px 12px', marginBottom: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const isSel = selectedNumber === n;
              return (
                <div key={n} onClick={() => { if (isLocked) return; setSelectedNumber(isSel ? null : n); setSelectedColor(null); setSelectedSize(null); }}
                  style={{ display: 'flex', justifyContent: 'center', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1, transform: isSel ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s ease', filter: isSel ? `drop-shadow(0 0 12px ${getNumberColorHex(n)})` : 'none' }}>
                  <Ball num={n} size={52} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Multiplier + Random ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
          <button disabled={isLocked} onClick={handleRandomSelect} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.1)', color: '#fb7185', fontWeight: 800, fontSize: '0.8rem', cursor: isLocked ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            🎲 Random
          </button>
          {multipliersList.map((m) => (
            <button key={m} onClick={() => setMultiplier(m)} style={{ padding: '8px 14px', borderRadius: 10, border: multiplier === m ? '1px solid rgba(0,208,132,0.5)' : '1px solid rgba(255,255,255,0.08)', background: multiplier === m ? 'rgba(0,208,132,0.15)' : 'rgba(255,255,255,0.04)', color: multiplier === m ? '#00d084' : '#64748b', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}>
              X{m}
            </button>
          ))}
        </div>

        {/* ── Big / Small ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: '📈 Big', size: 'big', bg: 'linear-gradient(135deg, #f97316, #ea580c)', glow: 'rgba(249,115,22,0.35)' },
            { label: '📉 Small', size: 'small', bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: 'rgba(59,130,246,0.35)' }
          ].map((s) => {
            const isSel = selectedSize === s.size;
            return (
              <button key={s.size} className="bet-btn" disabled={isLocked}
                onClick={() => { setSelectedSize(isSel ? null : s.size); setSelectedColor(null); setSelectedNumber(null); }}
                style={{ padding: '14px', borderRadius: 16, border: isSel ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.08)', background: s.bg, color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: isLocked ? 'not-allowed' : 'pointer', boxShadow: isSel ? `0 0 20px ${s.glow}` : `0 4px 10px ${s.glow}`, opacity: isLocked ? 0.4 : 1, transition: 'all 0.2s ease', transform: isSel ? 'scale(1.03)' : 'scale(1)' }}>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Bet Summary ── */}
        {(selectedColor || selectedNumber !== null || selectedSize) && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14, marginBottom: 16, border: '1px solid rgba(99,102,241,0.3)', animation: 'slideUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: '0.85rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Selection: <strong style={{ color: '#818cf8' }}>{selectedColor ? selectedColor.toUpperCase() : selectedNumber !== null ? `Number ${selectedNumber}` : selectedSize?.toUpperCase()}</strong></span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Cost: <strong style={{ color: '#f43f5e' }}>₹{(parseFloat(betAmount || 10) * multiplier).toFixed(2)}</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} placeholder="Amount"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.95rem', fontWeight: 700, outline: 'none' }} />
              <button onClick={handlePlaceBet} disabled={isLocked || betLoading}
                style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: isLocked || betLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00d084, #059669)', color: '#fff', fontWeight: 900, fontSize: '0.9rem', cursor: isLocked || betLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(0,208,132,0.3)', whiteSpace: 'nowrap' }}>
                {betLoading ? '⏳...' : '✅ Bet'}
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom Tabs ── */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 4, marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
          {[{ key: 'game', label: '📊 Game history' }, { key: 'chart', label: '📈 Chart' }, { key: 'myhistory', label: '🏆 My history' }].map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} className="tab-btn" onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', background: isActive ? 'rgba(99,102,241,0.25)' : 'transparent', color: isActive ? '#818cf8' : '#475569', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Game/Chart History ── */}
        {(activeTab === 'game' || activeTab === 'chart') && (
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 18, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 1fr', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: 8 }}>
              <span>Period</span><span style={{ textAlign: 'center' }}>Number</span><span style={{ textAlign: 'center' }}>Big/Small</span><span style={{ textAlign: 'center' }}>Color</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
              {(allPeriodResults[selectedPeriod] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569', fontSize: '0.85rem' }}>No history yet for {selectedPeriod}</div>
              ) : (
                (allPeriodResults[selectedPeriod] || []).map((r, i) => (
                  <div key={r.id || i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 1fr', gap: 8, alignItems: 'center', padding: '8px 10px', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: 8 }}>
                    <span style={{ fontFamily: 'monospace', color: '#475569', fontSize: '0.68rem', wordBreak: 'break-all' }}>{r.period || r.id || '—'}</span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Ball num={r.number} size={24} /></div>
                    <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.78rem', color: r.number >= 5 ? '#f97316' : '#3b82f6' }}>{r.number >= 5 ? 'Big' : 'Small'}</span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: getNumberColorHex(r.number), boxShadow: `0 0 6px ${getNumberColorHex(r.number)}` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── My History ── */}
        {activeTab === 'myhistory' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 18, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 12 }}>🏆 My Betting Records</div>
            {myBets.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.85rem', padding: '24px 0' }}>No bets yet. Start playing!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {myBets.map((b, i) => (
                  <div key={b.id || i} style={{ padding: 12, borderRadius: 12, background: b.status === 'won' ? 'rgba(0,208,132,0.08)' : b.status === 'lost' ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${b.status === 'won' ? 'rgba(0,208,132,0.2)' : b.status === 'lost' ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#475569' }}>{b.periodId?.slice(0, 16)}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: b.status === 'won' ? '#00d084' : b.status === 'lost' ? '#f43f5e' : '#f59e0b', color: '#fff' }}>
                        {b.status === 'won' ? '✓ WON' : b.status === 'lost' ? '✗ LOST' : '⏳ PENDING'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'capitalize' }}>Bet: {b.betValue} ({b.betType})</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>₹{b.totalCost?.toFixed(2)}</div>
                        {b.status === 'won' && <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#00d084' }}>+₹{b.payout?.toFixed(2)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── How To Play Modal ── */}
      {showRuleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: 20 }}>
          <div style={{ background: '#1e293b', borderRadius: 20, padding: 24, maxWidth: 400, width: '100%', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>📖 WinGo Rules</h3>
              <button onClick={() => setShowRuleModal(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', borderRadius: 8, padding: '4px 8px' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.8 }}>
              <p>• <strong style={{ color: '#00d084' }}>Green:</strong> Numbers 1,3,7,9 → <strong style={{ color: '#fff' }}>2x</strong>. Number 5 → <strong style={{ color: '#fff' }}>1.5x</strong></p>
              <p>• <strong style={{ color: '#f43f5e' }}>Red:</strong> Numbers 2,4,6,8 → <strong style={{ color: '#fff' }}>2x</strong>. Number 0 → <strong style={{ color: '#fff' }}>1.5x</strong></p>
              <p>• <strong style={{ color: '#c084fc' }}>Violet:</strong> Numbers 0 or 5 → <strong style={{ color: '#fff' }}>4.5x</strong></p>
              <p>• <strong style={{ color: '#fbbf24' }}>Number (0-9):</strong> Exact match → <strong style={{ color: '#fff' }}>9x</strong></p>
              <p>• <strong style={{ color: '#f97316' }}>Big/Small:</strong> Big (5-9), Small (0-4) → <strong style={{ color: '#fff' }}>2x</strong></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorWinGame;
