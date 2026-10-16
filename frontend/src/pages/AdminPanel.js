import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getAdminDashboard,
  getAllUsers, banUser, editUserWallet, deleteUser, sendNotifToUser,
  getWinGoResults, setWinGoResult, setWinGoNextResult, getWinGoControl, getAllBets,
  getAviatorControl, setAviatorRTP, setAviatorMultiplier,
  getMinesControl, setMinesProbability,
  getAllDeposits, approveDeposit, rejectDeposit,
  getAllWithdrawals, approveWithdrawal, rejectWithdrawal,
  getAllBonuses, giveBonus,
  getOnlineCount,
} from '../services/firebaseService';
import { db, ref, set, get, push, update, onValue, remove } from '../firebaseConfig';
import './AdminPanel.css';

const ADMIN_EMAIL = 'admin123@gmail.com';
const ADMIN_PASSWORD = 'admin123';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'controls', label: 'System Controls', icon: '⚙️' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'bets', label: 'Live Bets', icon: '🎯' },
  { id: 'wingo', label: 'Win Go', icon: '🎨' },
  { id: 'aviator', label: 'Aviator', icon: '✈️' },
  { id: 'mines', label: 'Mines', icon: '💣' },
  { id: 'deposits', label: 'Deposits', icon: '💰' },
  { id: 'withdrawals', label: 'Withdrawals', icon: '💸' },
  { id: 'bonuses', label: 'Bonuses', icon: '🎁' },
  { id: 'giftcodes', label: 'Gift Codes', icon: '🎟️' },
  { id: 'support', label: 'Support Messages', icon: '🎧' },
  { id: 'livechat', label: 'Live Chat', icon: '💬' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const StatusBadge = ({ status }) => {
  const cfg = { pending: ['#fbbf24', '#78350f22'], approved: ['#4ade80', '#14532d22'], won: ['#4ade80', '#14532d22'], rejected: ['#f87171', '#7f1d1d22'], lost: ['#f87171', '#7f1d1d22'], active: ['#60a5fa', '#1e3a5f22'], banned: ['#f87171', '#7f1d1d22'] };
  const [color, bg] = cfg[status] || ['#8899cc', '#1a1a2e22'];
  return <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800, color, background: bg, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{status}</span>;
};

// ─── Admin Login ──────────────────────────────────────────────────────────────
const AdminLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('super');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    setTimeout(() => {
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        localStorage.setItem('admin_auth', JSON.stringify({ email, role, loggedAt: Date.now() }));
        onLogin({ email, role });
      } else {
        setError('❌ Invalid admin credentials');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <span>⚙️</span>
          <h1>Admin Panel</h1>
          <p>Color Trading Gaming Platform</p>
        </div>
        <form className="admin-login-form" onSubmit={handleLogin}>
          <div className="admin-role-select">
            <button type="button" className={`admin-role-btn ${role === 'super' ? 'active' : ''}`} onClick={() => setRole('super')}>Super Admin</button>
            <button type="button" className={`admin-role-btn ${role === 'sub' ? 'active' : ''}`} onClick={() => setRole('sub')}>Sub Admin</button>
          </div>
          <div className="admin-input-group">
            <label>Email</label>
            <input type="email" placeholder="admin123@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required className="admin-input" />
          </div>
          <div className="admin-input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="admin-input" />
          </div>
          {error && <p className="admin-error">{error}</p>}
          <button type="submit" className="admin-login-btn" disabled={loading}>{loading ? '⏳ Logging in...' : '🔐 Login to Admin'}</button>
        </form>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats] = useState({ totalUsers: 0, onlineUsers: 0, todayDeposits: 0, todayWithdrawals: 0, revenue: 0, activeBets: 0, totalWalletBalance: 0, bannedUsers: 0 });

  useEffect(() => {
    const unsub = getAdminDashboard(setStats);
    return unsub;
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: '#6366f1' },
    { label: 'Online Now', value: stats.onlineUsers, icon: '🟢', color: '#10b981', live: true },
    { label: "Today Deposits", value: `₹${stats.todayDeposits}`, icon: '💰', color: '#f59e0b' },
    { label: "Today Withdrawals", value: `₹${stats.todayWithdrawals}`, icon: '💸', color: '#ef4444' },
    { label: 'Revenue', value: `₹${stats.revenue}`, icon: '📈', color: '#8b5cf6' },
    { label: 'Active Bets', value: stats.activeBets, icon: '🎯', color: '#ec4899', live: true },
    { label: 'Total Balance', value: `₹${stats.totalWalletBalance}`, icon: '🏦', color: '#14b8a6' },
    { label: 'Banned Users', value: stats.bannedUsers, icon: '🚫', color: '#f87171' },
  ];

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>📊 Dashboard Analytics</h2>
        <span className="admin-live-badge">🔴 LIVE</span>
      </div>
      <div className="admin-stats-grid">
        {cards.map(c => (
          <div key={c.label} className="admin-stat-card" style={{ borderColor: c.color + '44' }}>
            <div className="admin-stat-icon" style={{ background: c.color + '22', color: c.color }}>{c.icon}</div>
            <div className="admin-stat-info">
              <p className="admin-stat-label">{c.label}</p>
              <p className="admin-stat-value" style={{ color: c.color }}>
                {c.value}{c.live && <span className="admin-pulse" />}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── User Management ──────────────────────────────────────────────────────────
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => { const u = getAllUsers(setUsers); return u; }, []);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const handleDepositUnlock = async (u) => {
    const newVal = !u.hasDeposited;
    await update(ref(db, `users/${u.id}`), { hasDeposited: newVal });
    showToast(`Deposit ${newVal ? 'UNLOCKED ✅' : 'locked 🔒'} for ${u.fullName || u.email}`);
  };

  const filtered = users.filter(u =>
    (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.mobile || '').includes(search)
  );

  const handleBan = async (u) => {
    await banUser(u.id, !u.banned);
    showToast(`User ${u.banned ? 'unbanned' : 'banned'} ✅`);
  };

  const handleWallet = async (userId) => {
    if (!newBalance || isNaN(newBalance)) return;
    await editUserWallet(userId, parseFloat(newBalance));
    showToast('Wallet updated ✅');
    setEditingId(null); setNewBalance('');
  };

  const handleNotif = async (userId) => {
    if (!notifMsg.trim()) return;
    await sendNotifToUser(userId, notifMsg);
    showToast('Notification sent ✅');
    setNotifMsg('');
  };

  const handleDelete = async (u) => {
    const confirmed = window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE user "${u.fullName || u.email}"? This cannot be undone!`);
    if (!confirmed) return;
    try {
      await deleteUser(u.id);
      showToast(`User "${u.fullName || u.email}" deleted ✅`);
    } catch (err) {
      showToast('Failed to delete user ❌', false);
    }
  };

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>{toast.msg}</div>}
      <div className="admin-section-header">
        <h2>👥 User Management</h2>
        <span className="admin-count-badge">{users.length} Users</span>
      </div>
      <input className="admin-search" placeholder="🔍 Search by name, email, mobile..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>{['Name', 'Email', 'Mobile', 'Balance', 'VIP', 'KYC', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#667', padding: 24 }}>No users found</td></tr>}
            {filtered.map(u => (
              <tr key={u.id}>
                <td><strong>{u.fullName || '—'}</strong><br /><span style={{ fontSize: '0.65rem', color: '#667' }}>{u.id?.slice(0, 8)}</span></td>
                <td style={{ fontSize: '0.8rem' }}>{u.email || '—'}</td>
                <td>{u.mobile || '—'}</td>
                <td>
                  {editingId === u.id
                    ? <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" value={newBalance} onChange={e => setNewBalance(e.target.value)} style={{ width: 70, padding: '4px 6px', borderRadius: 6, border: '1px solid #444', background: '#1a2040', color: '#fff', fontSize: '0.8rem' }} />
                      <button className="admin-btn-sm admin-btn-green" onClick={() => handleWallet(u.id)}>✓</button>
                      <button className="admin-btn-sm" onClick={() => setEditingId(null)}>✗</button>
                    </div>
                    : <span style={{ color: '#4ade80', fontWeight: 700, cursor: 'pointer' }} onClick={() => { setEditingId(u.id); setNewBalance(u.walletBalance || 0); }}>₹{u.walletBalance || 0} ✏️</span>
                  }
                </td>
                <td><span style={{ color: '#fbbf24', fontWeight: 700 }}>{u.vipLevel || 'Bronze'}</span></td>
                <td><StatusBadge status={u.kycStatus?.toLowerCase() || 'pending'} /></td>
                <td><StatusBadge status={u.banned ? 'banned' : 'active'} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className={`admin-btn-sm ${u.banned ? 'admin-btn-green' : 'admin-btn-red'}`} onClick={() => handleBan(u)}>
                      {u.banned ? '✅ Unban' : '🚫 Ban'}
                    </button>
                    <button
                      className={`admin-btn-sm`}
                      style={{ background: u.hasDeposited ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)', border: `1px solid ${u.hasDeposited ? '#22c55e' : '#fbbf24'}`, color: u.hasDeposited ? '#22c55e' : '#fbbf24', fontWeight: 800 }}
                      onClick={() => handleDepositUnlock(u)}
                      title={u.hasDeposited ? 'Click to lock deposit' : 'Click to unlock deposit'}
                    >
                      {u.hasDeposited ? '🔓 Dep ON' : '🔒 Dep OFF'}
                    </button>
                    <button className="admin-btn-sm" onClick={() => { const m = prompt('Message to user:'); if (m) sendNotifToUser(u.id, m).then(() => showToast('Sent ✅')); }}>
                      📣
                    </button>
                    <button className="admin-btn-sm" style={{ background: 'rgba(239,68,68,0.8)', color: '#fff', border: '1px solid #ef4444', fontWeight: 800 }} onClick={() => handleDelete(u)}>
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Live Bets ────────────────────────────────────────────────────────────────
const LiveBets = () => {
  const [bets, setBets] = useState([]);
  useEffect(() => { const u = getAllBets(setBets); return u; }, []);

  const pending = bets.filter(b => b.status === 'pending');
  const recent = bets.slice(0, 100);

  // Analyze pending bets by color
  const colorTotals = { green: 0, red: 0, violet: 0 };
  const numberTotals = {};
  const sizeTotals = { big: 0, small: 0 };
  pending.forEach(b => {
    const amt = b.totalCost || b.amount || 0;
    if (b.betType === 'color' && colorTotals[b.betValue] !== undefined) colorTotals[b.betValue] += amt;
    if (b.betType === 'number') numberTotals[b.betValue] = (numberTotals[b.betValue] || 0) + amt;
    if (b.betType === 'size' && sizeTotals[b.betValue] !== undefined) sizeTotals[b.betValue] += amt;
  });
  const totalPending = pending.reduce((s, b) => s + (b.totalCost || b.amount || 0), 0);
  const maxBetAmt = Math.max(...pending.map(b => b.totalCost || b.amount || 0), 0);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>🎯 Live Bets</h2>
        <span className="admin-live-badge">🔴 {pending.length} LIVE</span>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Pending', value: pending.length, color: '#fbbf24' },
          { label: 'Total Bets', value: bets.length, color: '#60a5fa' },
          { label: 'Live Wagered', value: `₹${totalPending.toFixed(0)}`, color: '#f87171' },
          { label: 'Biggest Bet', value: `₹${maxBetAmt.toFixed(0)}`, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(15,22,50,0.8)', border: `1px solid ${s.color}33`, borderRadius: 14, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#6677aa', marginTop: 3, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Color Distribution */}
      {pending.length > 0 && (
        <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 800, color: '#dde4ff' }}>📊 Live Bet Distribution</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
            {[{ key: 'green', color: '#22c55e', label: 'Green' }, { key: 'red', color: '#ef4444', label: 'Red' }, { key: 'violet', color: '#8b5cf6', label: 'Violet' }].map(c => {
              const pct = totalPending > 0 ? ((colorTotals[c.key] / totalPending) * 100).toFixed(0) : 0;
              return (
                <div key={c.key} style={{ background: c.color + '15', border: `1px solid ${c.color}44`, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, color: c.color, fontSize: '1rem' }}>₹{colorTotals[c.key].toFixed(0)}</div>
                  <div style={{ fontSize: '0.65rem', color: '#667', marginTop: 2 }}>{c.label} • {pct}%</div>
                  <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: c.color, borderRadius: 99, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[{ key: 'big', color: '#f59e0b', label: 'Big (5-9)' }, { key: 'small', color: '#60a5fa', label: 'Small (0-4)' }].map(s => {
              const pct = totalPending > 0 ? ((sizeTotals[s.key] / totalPending) * 100).toFixed(0) : 0;
              return (
                <div key={s.key} style={{ background: s.color + '15', border: `1px solid ${s.color}44`, borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#8899cc', fontSize: '0.75rem' }}>{s.label}</span>
                  <span style={{ color: s.color, fontWeight: 800, fontSize: '0.88rem' }}>₹{sizeTotals[s.key].toFixed(0)} <span style={{ color: '#667', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bets Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{['User', 'Game', 'Bet', 'Amount', 'Risk', 'Status', 'Time'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {recent.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#667', padding: 24 }}>No bets yet</td></tr>}
            {recent.map(b => {
              const amt = b.totalCost || b.amount || 0;
              const isHighRisk = amt >= maxBetAmt * 0.6 && maxBetAmt > 0;
              return (
                <tr key={b.id} style={{ background: isHighRisk && b.status === 'pending' ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
                  <td style={{ fontSize: '0.72rem', color: '#8899cc', fontFamily: 'monospace' }}>{b.userId?.slice(0, 8)}...</td>
                  <td><span style={{ textTransform: 'uppercase', color: '#a78bfa', fontWeight: 700, fontSize: '0.8rem' }}>{b.game}</span></td>
                  <td><span style={{ textTransform: 'capitalize', color: '#dde4ff' }}>{b.betType}: {b.betValue}</span></td>
                  <td style={{ color: isHighRisk ? '#f87171' : '#ffd700', fontWeight: 700 }}>₹{amt}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 800,
                      background: isHighRisk && b.status === 'pending' ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.1)',
                      color: isHighRisk && b.status === 'pending' ? '#f87171' : '#4ade80'
                    }}>
                      {isHighRisk && b.status === 'pending' ? '🔥 HIGH' : '✓ LOW'}
                    </span>
                  </td>
                  <td><StatusBadge status={b.status} /></td>
                  <td style={{ fontSize: '0.75rem', color: '#667' }}>{fmtTime(b.placedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── WinGo Control ────────────────────────────────────────────────────────────
// Helper: get color for number
const getNumColorName = (n) => n === 0 || n === 5 ? 'violet' : [1, 3, 7, 9].includes(n) ? 'green' : 'red';
const PAYOUTS_BOT = { color: { green: 2, red: 2, violet: 4.5 }, number: 9, size: 2 };

const WinGoControl = () => {
  const [period, setPeriod] = useState('1min');
  const [results, setResults] = useState([]);
  const [nextResult, setNextResult] = useState('');
  const [control, setControl] = useState({});
  const [toast, setToast] = useState(null);

  // ─── AI BOT STATE ───────────────────────────────────────────────────────────
  const [botEnabled, setBotEnabled] = useState(false);
  const [botThreshold, setBotThreshold] = useState(200); // ₹ threshold for "big bet"
  const [botMode, setBotMode] = useState('smart'); // 'smart' | 'max_loss' | 'balanced'
  const [botLog, setBotLog] = useState([]);
  const [allBets, setAllBets] = useState([]);
  const [botAnalysis, setBotAnalysis] = useState(null);
  const botIntervalRef = useRef(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const u1 = getWinGoControl(setControl);
    const u2 = getWinGoResults(period, setResults);
    const u3 = getAllBets(setAllBets);
    return () => { u1(); u2(); u3(); };
  }, [period]);

  // ─── BOT ANALYSIS LOGIC ─────────────────────────────────────────────────────
  const analyzeBetsForBot = useCallback((pendingBets) => {
    if (!pendingBets.length) return null;

    const totalPool = pendingBets.reduce((s, b) => s + (b.totalCost || b.amount || 0), 0);

    // For each possible result (0-9), calculate: playerPayout - totalPool = house profit
    const results = [];
    for (let num = 0; num <= 9; num++) {
      const color = getNumColorName(num);
      const size = num >= 5 ? 'big' : 'small';
      let playerPayout = 0;

      pendingBets.forEach(bet => {
        const amt = bet.amount || 0;
        const multi = bet.multiplier || 1;
        let payoutMult = 0;
        if (bet.betType === 'color' && bet.betValue === color) payoutMult = PAYOUTS_BOT.color[color];
        if (bet.betType === 'number' && parseInt(bet.betValue) === num) payoutMult = PAYOUTS_BOT.number;
        if (bet.betType === 'size' && bet.betValue === size) payoutMult = PAYOUTS_BOT.size;
        playerPayout += amt * payoutMult * multi;
      });

      const houseProfit = totalPool - playerPayout;
      results.push({ num, color, size, playerPayout, houseProfit });
    }

    // Sort by house profit (descending = best for house)
    results.sort((a, b) => b.houseProfit - a.houseProfit);

    // In 'smart' mode: big bets lose, small bets win
    // Find the result where biggest betters lose
    const bigBets = pendingBets.filter(b => (b.totalCost || b.amount || 0) >= botThreshold);
    const smallBets = pendingBets.filter(b => (b.totalCost || b.amount || 0) < botThreshold);

    let chosenResult = results[0]; // default: max house profit

    if (botMode === 'smart' && bigBets.length > 0) {
      // Find result where NONE of the big bets win
      const safePicks = results.filter(r => {
        return bigBets.every(bet => {
          const c = getNumColorName(r.num);
          const s = r.num >= 5 ? 'big' : 'small';
          if (bet.betType === 'color' && bet.betValue === c) return false; // big bet wins
          if (bet.betType === 'number' && parseInt(bet.betValue) === r.num) return false;
          if (bet.betType === 'size' && bet.betValue === s) return false;
          return true;
        });
      });
      if (safePicks.length > 0) chosenResult = safePicks[0]; // most profitable where big bets lose
    }

    return {
      chosenResult: chosenResult.num,
      houseProfit: chosenResult.houseProfit,
      totalPool,
      bigBetCount: bigBets.length,
      smallBetCount: smallBets.length,
      analysis: results.slice(0, 3),
    };
  }, [botThreshold, botMode]);

  // ─── BOT RUNNER ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (botIntervalRef.current) clearInterval(botIntervalRef.current);
    if (!botEnabled) {
      setBotAnalysis(null);
      return;
    }

    const runBot = async () => {
      const pendingBets = allBets.filter(b => b.status === 'pending' && b.game === 'wingo');
      const analysis = analyzeBetsForBot(pendingBets);
      setBotAnalysis(analysis);

      if (analysis && analysis.chosenResult !== null) {
        await setWinGoNextResult(analysis.chosenResult);
        const logEntry = {
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          result: analysis.chosenResult,
          profit: analysis.houseProfit.toFixed(0),
          bigBets: analysis.bigBetCount,
          pool: analysis.totalPool.toFixed(0),
        };
        setBotLog(prev => [logEntry, ...prev.slice(0, 14)]);
      }
    };

    runBot();
    botIntervalRef.current = setInterval(runBot, 5000);
    return () => clearInterval(botIntervalRef.current);
  }, [botEnabled, allBets, analyzeBetsForBot]);

  const setNext = async (num) => {
    const n = Number(num);
    if (isNaN(n) || n < 0 || n > 9) { showToast('Enter valid number 0–9 ❌', false); return; }
    await setWinGoNextResult(n);
    setNextResult(String(n));
    showToast(`Next WinGo result forced to ${n} ✅`);
  };

  const clearNext = async () => {
    await setWinGoNextResult(null);
    setNextResult('');
    showToast('Reset to random ✅');
  };

  const getNumColor = (n) => n === 0 || n === 5 ? '#8b5cf6' : [1, 3, 7, 9].includes(n) ? '#22c55e' : '#ef4444';

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}
      <div className="admin-section-header">
        <h2>🎨 Win Go Control</h2>
        <span className="admin-live-badge">🔴 LIVE</span>
      </div>

      {/* Period Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['30sec', '1min', '3min', '5min', '10min'].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: '7px 14px', borderRadius: 8, border: period === p ? '2px solid #ff3d7f' : '1px solid rgba(255,255,255,0.1)', background: period === p ? 'rgba(255,61,127,0.15)' : 'rgba(255,255,255,0.04)', color: period === p ? '#ff3d7f' : '#8899cc', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {p}
          </button>
        ))}
      </div>

      {/* ─── AI BOT SECTION ─── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#dde4ff' }}>🤖 AI Win/Loss Bot</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#6677aa' }}>Big bet = LOSS • Small bet = WIN • Auto-sets result every 5s</p>
          </div>
          {/* Toggle Switch */}
          <div
            onClick={() => { setBotEnabled(p => !p); if (!botEnabled) showToast('🤖 Bot ACTIVATED!'); else { showToast('Bot stopped ⏹'); clearNext(); } }}
            style={{ width: 64, height: 32, borderRadius: 99, background: botEnabled ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.08)', border: botEnabled ? '2px solid #8b5cf6' : '2px solid rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'all 0.3s', boxShadow: botEnabled ? '0 0 20px rgba(139,92,246,0.5)' : 'none' }}
          >
            <div style={{ position: 'absolute', top: 3, left: botEnabled ? 34 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
          </div>
        </div>

        {/* Bot Status Banner */}
        {botEnabled && (
          <div style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700 }}>BOT RUNNING — Auto-controlling game results</span>
          </div>
        )}

        {/* Bot Settings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ background: 'rgba(15,22,50,0.6)', borderRadius: 12, padding: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: '#8899cc', fontWeight: 700 }}>💰 BIG BET THRESHOLD</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#fbbf24', fontWeight: 900 }}>₹</span>
              <input type="number" value={botThreshold} onChange={e => setBotThreshold(Number(e.target.value))} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700 }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.62rem', color: '#6677aa' }}>Bets above this = LOSE</p>
          </div>
          <div style={{ background: 'rgba(15,22,50,0.6)', borderRadius: 12, padding: 12 }}>
            <p style={{ margin: '0 0 6px', fontSize: '0.72rem', color: '#8899cc', fontWeight: 700 }}>🧠 BOT MODE</p>
            {[{ v: 'smart', l: 'Smart (Safe)' }, { v: 'max_loss', l: 'Max Loss' }].map(m => (
              <button key={m.v} onClick={() => setBotMode(m.v)} style={{ display: 'block', width: '100%', padding: '5px 8px', borderRadius: 6, border: botMode === m.v ? '1px solid #8b5cf6' : '1px solid transparent', background: botMode === m.v ? 'rgba(139,92,246,0.2)' : 'transparent', color: botMode === m.v ? '#c4b5fd' : '#6677aa', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 2 }}>{m.l}</button>
            ))}
          </div>
        </div>

        {/* Live Analysis */}
        {botAnalysis && botEnabled && (
          <div style={{ background: 'rgba(15,22,50,0.7)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 800, color: '#c4b5fd' }}>⚡ Live Analysis</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'Pool', value: `₹${botAnalysis.totalPool.toFixed(0)}`, color: '#fbbf24' },
                { label: 'Big Bets', value: botAnalysis.bigBetCount, color: '#f87171' },
                { label: 'Small Bets', value: botAnalysis.smallBetCount, color: '#4ade80' },
                { label: 'House Profit', value: `₹${botAnalysis.houseProfit.toFixed(0)}`, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: s.color, fontWeight: 900, fontSize: '1rem' }}>{s.value}</div>
                  <div style={{ color: '#6677aa', fontSize: '0.62rem', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.75rem', color: '#8899cc' }}>Bot will force result:</span>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: getNumColor(botAnalysis.chosenResult), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem', boxShadow: `0 0 12px ${getNumColor(botAnalysis.chosenResult)}88` }}>{botAnalysis.chosenResult}</div>
              <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700 }}>House profit: ₹{botAnalysis.houseProfit.toFixed(0)}</span>
            </div>
          </div>
        )}

        {/* Bot Log */}
        {botLog.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 800, color: '#6677aa' }}>🕐 BOT ACTION LOG</p>
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {botLog.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 8px', background: i === 0 ? 'rgba(99,102,241,0.15)' : 'transparent', borderRadius: 6 }}>
                  <span style={{ fontSize: '0.62rem', color: '#667', fontFamily: 'monospace', minWidth: 60 }}>{log.time}</span>
                  <span style={{ fontSize: '0.7rem', color: '#8899cc' }}>Forced</span>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: getNumColor(log.result), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.65rem' }}>{log.result}</div>
                  <span style={{ fontSize: '0.68rem', color: '#4ade80', marginLeft: 'auto' }}>+₹{log.profit} profit</span>
                  <span style={{ fontSize: '0.65rem', color: '#f87171' }}>{log.bigBets} big</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!botEnabled && (
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#6677aa', textAlign: 'center', padding: '8px 0' }}>Toggle ON to activate the AI bot — it will auto-set results to maximize house profit</p>
        )}
      </div>
      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,61,127,0.2)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 800, color: '#dde4ff' }}>🎯 Force Next Result</p>
        <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6677aa' }}>Select a number to force as the result for the next period. Leave unset for random.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => setNext(n)}
              style={{ aspectRatio: '1', borderRadius: '50%', border: nextResult === String(n) ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.15)', background: getNumColor(n) + '55', color: '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min={0} max={9} placeholder="0–9" value={nextResult} onChange={e => setNextResult(e.target.value)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontFamily: 'inherit' }} />
          <button onClick={() => setNext(nextResult)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ff3d7f,#ff5663)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>⚡ Set</button>
          <button onClick={clearNext} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,61,127,0.1)', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🔄 Reset</button>
        </div>
        {/* Active forced result display */}
        {control.nextResult !== undefined && control.nextResult !== null && (
          <p style={{ margin: '10px 0 0', fontSize: '0.82rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,0.3)' }}>
            ⚡ Next forced result: <strong style={{ fontSize: '1.2rem', color: '#fff' }}>
              {typeof control.nextResult === 'object' ? control.nextResult.result : control.nextResult}
            </strong>
            {' '}<span style={{ color: '#f87171', cursor: 'pointer', textDecoration: 'underline', marginLeft: 8 }} onClick={clearNext}>✕ Clear</span>
          </p>
        )}
      </div>

      {/* Recent Results */}
      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16 }}>
        <p style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 800, color: '#dde4ff' }}>📋 Recent Results — {period}</p>
        {results.length === 0
          ? <p style={{ textAlign: 'center', color: '#667', fontSize: '0.85rem', padding: 20 }}>No results yet for this period</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 2fr', gap: 6, padding: '8px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 8, fontSize: '0.68rem', fontWeight: 800, color: '#8899cc' }}>
              <span>PERIOD</span><span>NUM</span><span>COLOR</span><span>SIZE</span><span>TIME</span>
            </div>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 2fr', gap: 6, padding: '9px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, alignItems: 'center', borderLeft: `3px solid ${getNumColor(r.number)}` }}>
                <span style={{ fontSize: '0.62rem', color: '#667', fontFamily: 'monospace' }}>{r.period?.slice(0, 14)}...</span>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: getNumColor(r.number), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '0.8rem' }}>{r.number}</div>
                <span style={{ fontSize: '0.72rem', color: r.color === 'green' ? '#4ade80' : r.color === 'violet' ? '#a78bfa' : '#f87171', textTransform: 'capitalize', fontWeight: 700 }}>{r.color}</span>
                <span style={{ fontSize: '0.72rem', color: r.size === 'big' ? '#f59e0b' : '#60a5fa', textTransform: 'capitalize', fontWeight: 700 }}>{r.size}</span>
                <span style={{ fontSize: '0.65rem', color: '#667' }}>{fmtTime(r.timestamp)}</span>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
};

// ─── Aviator Control ──────────────────────────────────────────────────────────
const AviatorControl = () => {
  const [control, setControl] = useState({ rtp: 95, forceMultiplier: null });
  const [rtp, setRtp] = useState(95);
  const [forceMulti, setForceMulti] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const u = getAviatorControl((c) => { setControl(c); setRtp(c.rtp || 95); setForceMulti(c.forceMultiplier || ''); });
    return u;
  }, []);

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: '#065f46', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast}</div>}
      <div className="admin-section-header">
        <h2>✈️ Aviator Control</h2>
        <span className="admin-live-badge">🔴 LIVE</span>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: 20 }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 800, color: '#dde4ff' }}>📊 RTP Control</p>
          <p style={{ margin: '0 0 14px', fontSize: '0.72rem', color: '#6677aa' }}>Return to Player % — Current: <strong style={{ color: '#4ade80' }}>{control.rtp || 95}%</strong></p>
          <div style={{ marginBottom: 12 }}>
            <input type="range" min={50} max={99} value={rtp} onChange={e => setRtp(e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#667', marginTop: 4 }}>
              <span>50% (Low)</span><span style={{ color: '#a78bfa', fontWeight: 700 }}>{rtp}%</span><span>99% (High)</span>
            </div>
          </div>
          <button onClick={async () => { await setAviatorRTP(Number(rtp)); showToast(`RTP set to ${rtp}% ✅`); }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Apply RTP
          </button>
        </div>

        <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 18, padding: 20 }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 800, color: '#dde4ff' }}>🎯 Force Crash Multiplier</p>
          <p style={{ margin: '0 0 14px', fontSize: '0.72rem', color: '#6677aa' }}>Force next crash at a specific multiplier. Leave empty for RTP-based random.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.01" min="1.01" placeholder="e.g. 2.50" value={forceMulti} onChange={e => setForceMulti(e.target.value)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontFamily: 'inherit' }} />
            <button onClick={async () => { await setAviatorMultiplier(forceMulti ? Number(forceMulti) : null); showToast(forceMulti ? `Crash at ${forceMulti}x ✅` : 'Reset to random ✅'); }} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ec4899,#db2777)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Set
            </button>
            <button onClick={async () => { setForceMulti(''); await setAviatorMultiplier(null); showToast('Reset ✅'); }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#8899cc', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear
            </button>
          </div>
          {control.forceMultiplier && <p style={{ margin: '10px 0 0', color: '#fbbf24', fontSize: '0.78rem' }}>⚡ Forced: {control.forceMultiplier}x</p>}
        </div>
      </div>
    </div>
  );
};

// ─── Mines Control ────────────────────────────────────────────────────────────
const MinesControl = () => {
  const [control, setControl] = useState({ probability: 25 });
  const [prob, setProb] = useState(25);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const u = getMinesControl((c) => { setControl(c); setProb(c.probability || 25); }); return u; }, []);

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: '#065f46', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast}</div>}
      <div className="admin-section-header">
        <h2>💣 Mines Configuration</h2>
        <span className="admin-live-badge">🔴 LIVE</span>
      </div>

      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 18, padding: 24 }}>
        <p style={{ margin: '0 0 6px', fontWeight: 800, color: '#dde4ff' }}>💥 Mine Hit Probability</p>
        <p style={{ margin: '0 0 20px', fontSize: '0.75rem', color: '#6677aa' }}>
          Chance of hitting a mine on any given cell. Current: <strong style={{ color: '#fbbf24' }}>{control.probability || 25}%</strong>
        </p>
        <input type="range" min={5} max={80} value={prob} onChange={e => setProb(e.target.value)} style={{ width: '100%', accentColor: '#f59e0b', marginBottom: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#667', marginBottom: 20 }}>
          <span>5% (Easy)</span><span style={{ color: '#fbbf24', fontWeight: 700 }}>{prob}% Probability</span><span>80% (Hard)</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {[{ label: '😊 Easy', val: 15 }, { label: '😐 Medium', val: 30 }, { label: '😰 Hard', val: 50 }, { label: '💀 Extreme', val: 70 }].map(p => (
            <button key={p.val} onClick={() => setProb(p.val)} style={{ padding: '8px 14px', borderRadius: 8, border: prob == p.val ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)', background: prob == p.val ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', color: prob == p.val ? '#fbbf24' : '#8899cc', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={async () => { await setMinesProbability(Number(prob)); showToast(`Mine probability set to ${prob}% ✅`); }} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
          💾 Apply Changes
        </button>
      </div>
    </div>
  );
};

// ─── Deposits ─────────────────────────────────────────────────────────────────
const Deposits = () => {
  const [deposits, setDeposits] = useState([]);
  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const u = getAllDeposits(setDeposits); return u; }, []);

  const pending = deposits.filter(d => d.status === 'pending');

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}
      <div className="admin-section-header">
        <h2>💰 Deposits</h2>
        <span className="admin-live-badge">{pending.length} Pending</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total', value: deposits.length, color: '#60a5fa' },
          { label: 'Pending', value: pending.length, color: '#fbbf24' },
          { label: 'Approved', value: deposits.filter(d => d.status === 'approved').length, color: '#4ade80' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(15,22,50,0.8)', border: `1px solid ${s.color}33`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#6677aa', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{['User', 'Amount', 'Method', 'Status', 'Time', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {deposits.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#667', padding: 24 }}>No deposits yet</td></tr>}
            {deposits.map(d => (
              <tr key={d.id}>
                <td style={{ fontSize: '0.72rem', color: '#8899cc', fontFamily: 'monospace' }}>{d.userId?.slice(0, 8)}...</td>
                <td style={{ color: '#4ade80', fontWeight: 800 }}>₹{d.amount}</td>
                <td>{d.method || 'UPI'}</td>
                <td><StatusBadge status={d.status} /></td>
                <td style={{ fontSize: '0.72rem', color: '#667' }}>{fmtTime(d.createdAt)}</td>
                <td>
                  {d.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="admin-btn-sm admin-btn-green" onClick={async () => { await approveDeposit(d.id, d.userId, d.amount); showToast('Deposit approved ✅'); }}>✅ Approve</button>
                      <button className="admin-btn-sm admin-btn-red" onClick={async () => { await rejectDeposit(d.id, d.userId); showToast('Rejected', false); }}>❌ Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Withdrawals & RupayEx Payout System ─────────────────────────────────────
const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [toast, setToast] = useState(null);
  const [gatewayBalance, setGatewayBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('bank');
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    payoutId: ''
  });
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [checkPayoutId, setCheckPayoutId] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const fetchWalletBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await fetch('/api/payments/rupayex/wallet-balance');
      const json = await res.json();
      if (json.status) {
        setGatewayBalance(json.balance);
      } else {
        setGatewayBalance('N/A');
      }
    } catch (e) {
      console.error(e);
      setGatewayBalance('Error');
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    const u = getAllWithdrawals(setWithdrawals);
    fetchWalletBalance();
    return u;
  }, []);

  const pending = withdrawals.filter(w => w.status === 'pending');

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!checkPayoutId.trim()) return;
    setCheckingStatus(true);
    setStatusResult(null);
    try {
      const res = await fetch(`/api/payments/rupayex/payout-status?payout_id=${encodeURIComponent(checkPayoutId.trim())}`);
      const json = await res.json();
      setStatusResult(json);
    } catch (e) {
      setStatusResult({ status: false, message: e.message });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleManualPayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutForm.amount || Number(payoutForm.amount) < 1 || !payoutForm.accountHolder) {
      showToast('Please fill amount (min 1) and account holder name', false);
      return;
    }
    if (payoutMethod === 'bank' && (!payoutForm.accountNumber || !payoutForm.ifscCode || !payoutForm.bankName)) {
      showToast('Bank method requires account number, IFSC code, and bank name', false);
      return;
    }
    if (payoutMethod === 'upi' && !payoutForm.upiId) {
      showToast('UPI method requires UPI ID', false);
      return;
    }

    setPayoutSubmitting(true);
    try {
      const payload = {
        withdrawalId: 'MANUAL_' + Date.now(),
        userId: 'ADMIN_DIRECT',
        amount: Number(payoutForm.amount),
        method: payoutMethod,
        accountHolder: payoutForm.accountHolder,
        ...(payoutMethod === 'bank'
          ? { accountNumber: payoutForm.accountNumber, ifscCode: payoutForm.ifscCode, bankName: payoutForm.bankName }
          : { upiId: payoutForm.upiId }
        )
      };

      const res = await fetch('/api/payments/rupayex/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        showToast(`Payout Created! ID: ${json.data?.payout_id || 'PO_SUCCESS'} ✅`);
        setPayoutForm({ amount: '', accountHolder: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '', payoutId: '' });
        setShowManualForm(false);
        fetchWalletBalance();
      } else {
        showToast(`Error: ${json.message || 'Payout failed'}`, false);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to create payout', false);
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleAutoPayout = async (w) => {
    try {
      const confirmPayout = window.confirm(`Are you sure you want to trigger automatic Rupayex payout of ₹${w.amount} to user?`);
      if (!confirmPayout) return;

      showToast('⏳ Processing automatic payout...');

      const payload = {
        withdrawalId: w.id,
        userId: w.userId,
        amount: Number(w.amount),
        method: w.method === 'Bank' ? 'bank' : 'upi',
        accountHolder: w.accountHolder || 'User Payout',
        ...(w.method === 'Bank'
          ? { accountNumber: w.bankAccount || w.accountNumber, ifscCode: w.ifsc || w.ifscCode || '—', bankName: w.bankName || 'Bank' }
          : { upiId: w.upiId }
        )
      };

      if (!w.accountHolder) {
        const userSnap = await fetch(`https://earn-and-money-3ff08-default-rtdb.firebaseio.com/users/${w.userId}.json`);
        const userObj = await userSnap.json();
        if (userObj && userObj.fullName) {
          payload.accountHolder = userObj.fullName;
        }
      }

      const res = await fetch('/api/payments/rupayex/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let json;
      try {
        json = await res.json();
      } catch (parseErr) {
        showToast(`Error: Server returned non-JSON response (HTTP ${res.status}). Check backend.`, false);
        return;
      }

      if (json.success) {
        showToast('Automatic Payout Successful! ✅');
        fetchWalletBalance();
      } else {
        showToast(`Error: ${json.message || 'Payout failed'}`, false);
      }
    } catch (err) {
      console.error(err);
      showToast(`Payout Error: ${err.message || 'Failed to initiate'}`, false);
    }
  };

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}

      <div className="admin-section-header">
        <h2>💸 Withdrawals & Payout System</h2>
        <span className="admin-live-badge">{pending.length} Pending</span>
      </div>

      {/* RupayEx Gateway Header Card */}
      <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.15))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 18, padding: 20, marginBottom: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>💳</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#dde4ff', fontWeight: 800 }}>RupayEx Payout Gateway</h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#8899cc' }}>API Base: https://rupayex.net/api | Instant Bank & UPI Disbursal</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.7rem', color: '#8899cc', display: 'block' }}>GATEWAY WALLET BALANCE</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4ade80' }}>
              {balanceLoading ? '⏳ Loading...' : (gatewayBalance !== null ? `₹${gatewayBalance}` : '—')}
            </span>
          </div>
          <button onClick={fetchWalletBalance} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
            🔄 Refresh
          </button>
          <button onClick={() => setShowManualForm(!showManualForm)} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>
            {showManualForm ? '✕ Close Form' : '⚡ Create Direct Payout'}
          </button>
        </div>
      </div>

      {/* Direct Manual Payout Modal / Card */}
      {showManualForm && (
        <div style={{ background: 'rgba(15,22,50,0.95)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 18, padding: 20, marginBottom: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <h4 style={{ margin: '0 0 12px', color: '#c4b5fd', fontSize: '1rem', fontWeight: 800 }}>➕ Create RupayEx Direct Payout</h4>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button type="button" onClick={() => setPayoutMethod('bank')} style={{ padding: '8px 16px', borderRadius: 8, border: payoutMethod === 'bank' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', background: payoutMethod === 'bank' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)', color: payoutMethod === 'bank' ? '#c4b5fd' : '#8899cc', fontWeight: 700, cursor: 'pointer' }}>
              🏦 Bank Transfer
            </button>
            <button type="button" onClick={() => setPayoutMethod('upi')} style={{ padding: '8px 16px', borderRadius: 8, border: payoutMethod === 'upi' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', background: payoutMethod === 'upi' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)', color: payoutMethod === 'upi' ? '#c4b5fd' : '#8899cc', fontWeight: 700, cursor: 'pointer' }}>
              📱 UPI Transfer
            </button>
          </div>

          <form onSubmit={handleManualPayoutSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Amount (INR, Min: 1) *</label>
              <input type="number" placeholder="5000" value={payoutForm.amount} onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Account Holder Name *</label>
              <input type="text" placeholder="Raushan Kumar" value={payoutForm.accountHolder} onChange={e => setPayoutForm({ ...payoutForm, accountHolder: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
            </div>

            {payoutMethod === 'bank' ? (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Bank Account Number *</label>
                  <input type="text" placeholder="1234567890" value={payoutForm.accountNumber} onChange={e => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>IFSC Code *</label>
                  <input type="text" placeholder="SBIN0001234" value={payoutForm.ifscCode} onChange={e => setPayoutForm({ ...payoutForm, ifscCode: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Bank Name *</label>
                  <input type="text" placeholder="State Bank of India" value={payoutForm.bankName} onChange={e => setPayoutForm({ ...payoutForm, bankName: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
                </div>
              </>
            ) : (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.75rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>UPI ID *</label>
                <input type="text" placeholder="raushan@paytm" value={payoutForm.upiId} onChange={e => setPayoutForm({ ...payoutForm, upiId: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff' }} />
              </div>
            )}

            <div style={{ gridColumn: 'span 2', marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowManualForm(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8899cc' }}>Cancel</button>
              <button type="submit" disabled={payoutSubmitting} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 800 }}>
                {payoutSubmitting ? '⏳ Submitting...' : '🚀 Submit Payout Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payout Status Checker Widget */}
      <div style={{ background: 'rgba(15,22,50,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 800, color: '#dde4ff' }}>🔍 Check Payout Status</p>
        <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: 10 }}>
          <input type="text" placeholder="Enter payout_id (e.g. PO_1709XXXXXX)" value={checkPayoutId} onChange={e => setCheckPayoutId(e.target.value)} style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.85rem' }} />
          <button type="submit" disabled={checkingStatus} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {checkingStatus ? 'Querying...' : 'Check Status'}
          </button>
        </form>

        {statusResult && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.8rem' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: statusResult.status ? '#4ade80' : '#f87171' }}>
              {statusResult.status ? '✅ Status Query Success' : '❌ Status Query Error'}
            </p>
            <pre style={{ margin: 0, color: '#a5b4fc', fontSize: '0.75rem', overflowX: 'auto', background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
              {JSON.stringify(statusResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* User Withdrawals Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{['User', 'Amount', 'Method', 'Details', 'Status', 'Time', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {withdrawals.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#667', padding: 24 }}>No withdrawals yet</td></tr>}
            {withdrawals.map(w => (
              <tr key={w.id}>
                <td style={{ fontSize: '0.72rem', color: '#8899cc', fontFamily: 'monospace' }}>{w.userId?.slice(0, 8)}...</td>
                <td style={{ color: '#f87171', fontWeight: 800 }}>₹{w.amount}</td>
                <td>{w.method || 'UPI'}</td>
                <td style={{ fontSize: '0.72rem', color: '#8899cc', maxWidth: 240 }}>
                  {w.method === 'Bank' || w.bankAccount ? (
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 700 }}>🏦 {w.bankName || 'Bank'}: {w.bankAccount || w.accountNumber || '—'}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        <span>Holder: {w.accountHolder || '—'}</span> • <span>IFSC: {w.ifsc || w.ifscCode || '—'}</span>
                      </div>
                      {w.mobile && <div style={{ fontSize: '0.65rem', color: '#a78bfa' }}>📱 Mob: {w.mobile}</div>}
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: '#34d399', fontWeight: 700 }}>📱 UPI: {w.upiId || '—'}</div>
                      {w.accountHolder && <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Holder: {w.accountHolder}</div>}
                    </div>
                  )}
                </td>
                <td><StatusBadge status={w.status} /></td>
                <td style={{ fontSize: '0.72rem', color: '#667' }}>{fmtTime(w.createdAt)}</td>
                <td>
                  {w.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="admin-btn-sm admin-btn-green" onClick={async () => { await approveWithdrawal(w.id, w.userId, w.amount); showToast('Approved ✅'); }}>✅ Approve</button>
                      <button className="admin-btn-sm admin-btn-red" onClick={async () => { await rejectWithdrawal(w.id); showToast('Rejected', false); }}>❌ Reject</button>
                      <button className="admin-btn-sm" style={{ background: '#a78bfa', color: '#fff', border: 'none', fontWeight: 800 }} onClick={() => handleAutoPayout(w)}>⚡ RupayEx Payout</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// ─── Bonuses ──────────────────────────────────────────────────────────────────
const Bonuses = () => {
  const [users, setUsers] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const u1 = getAllUsers(setUsers);
    const u2 = getAllBonuses(setBonuses);
    return () => { u1(); u2(); };
  }, []);

  const handleGive = async () => {
    if (!selectedUser || !amount || !reason) { showToast('Fill all fields', false); return; }
    await giveBonus(selectedUser, parseFloat(amount), reason);
    showToast(`Bonus of ₹${amount} given ✅`);
    setAmount(''); setReason('');
  };

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}
      <div className="admin-section-header"><h2>🎁 Bonus Management</h2></div>

      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ margin: '0 0 14px', fontWeight: 800, color: '#dde4ff' }}>💝 Give Bonus</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0d1426', color: '#fff', fontSize: '0.88rem', fontFamily: 'inherit' }}>
            <option value="">Select User...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.email}</option>)}
          </select>
          <input type="number" placeholder="Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'inherit' }} />
          <input type="text" placeholder="Reason (e.g. Welcome bonus)" value={reason} onChange={e => setReason(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'inherit' }} />
          <button onClick={handleGive} style={{ padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>🎁 Give Bonus</button>
        </div>
      </div>

      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 800, color: '#dde4ff' }}>📋 Bonus History</p>
        {bonuses.length === 0
          ? <p style={{ textAlign: 'center', color: '#667', padding: 20 }}>No bonuses given yet</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bonuses.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#dde4ff', fontWeight: 600 }}>{b.reason}</div>
                  <div style={{ fontSize: '0.68rem', color: '#667', fontFamily: 'monospace' }}>{b.userId?.slice(0, 12)}...</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#4ade80', fontWeight: 800 }}>+₹{b.amount}</div>
                  <div style={{ fontSize: '0.65rem', color: '#667' }}>{fmtTime(b.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  );
};

// ─── Referrals ────────────────────────────────────────────────────────────────
const Referrals = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => { const u = getAllUsers(setUsers); return u; }, []);

  const sorted = [...users].sort((a, b) => (b.activeReferrals || 0) - (a.activeReferrals || 0));

  return (
    <div className="admin-section">
      <div className="admin-section-header"><h2>🔗 Referral Management</h2><span className="admin-live-badge">🔴 LIVE</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Referrers', value: users.filter(u => u.activeReferrals > 0).length, color: '#a78bfa' },
          { label: 'Total Referrals', value: users.reduce((s, u) => s + (u.activeReferrals || 0), 0), color: '#60a5fa' },
          { label: 'Total Paid', value: `₹${users.reduce((s, u) => s + (u.referralEarnings || 0), 0).toFixed(0)}`, color: '#4ade80' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(15,22,50,0.8)', border: `1px solid ${s.color}33`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#6677aa', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr>{['User', 'Email', 'Referral Code', 'Team', 'Earnings'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.filter(u => u.referralCode).map(u => (
              <tr key={u.id}>
                <td><strong>{u.fullName || '—'}</strong></td>
                <td style={{ fontSize: '0.8rem', color: '#8899cc' }}>{u.email || '—'}</td>
                <td><code style={{ background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 6, color: '#a78bfa', fontSize: '0.8rem' }}>{u.referralCode}</code></td>
                <td style={{ color: '#60a5fa', fontWeight: 700 }}>{u.activeReferrals || 0}</td>
                <td style={{ color: '#4ade80', fontWeight: 700 }}>₹{u.referralEarnings || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── System Controls (Deposit ON/OFF + Game Maintenance + Withdrawal Limits) ──
const SystemControls = () => {
  const [settings, setSettings] = useState({
    depositEnabled: true,
    withdrawalEnabled: true,
    wingoMaintenance: false,
    aviatorMaintenance: false,
    minesMaintenance: false,
  });
  const [limits, setLimits] = useState({
    withdrawMinAmount: 200,
    withdrawMaxAmount: 50000,
    withdrawDailyLimit: 100000,
    withdrawMinGameplay: 100,
  });
  const [limitInputs, setLimitInputs] = useState({ ...limits });
  const [toast, setToast] = useState(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const unsub = onValue(ref(db, 'systemSettings'), (snap) => {
      const data = snap.val();
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
        const limData = {
          withdrawMinAmount: data.withdrawMinAmount ?? 200,
          withdrawMaxAmount: data.withdrawMaxAmount ?? 50000,
          withdrawDailyLimit: data.withdrawDailyLimit ?? 100000,
          withdrawMinGameplay: data.withdrawMinGameplay ?? 100,
        };
        setLimits(limData);
        setLimitInputs(limData);
      }
    });
    return unsub;
  }, []);

  const toggle = async (key, label) => {
    const newVal = !settings[key];
    try {
      await update(ref(db, 'systemSettings'), { [key]: newVal });
      setSettings(prev => ({ ...prev, [key]: newVal }));
      showToast(`${label}: ${newVal ? '✅ ON' : '🔴 OFF'}`);
    } catch (err) {
      showToast('Failed to update ❌', false);
    }
  };

  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      const toSave = {
        withdrawMinAmount: Number(limitInputs.withdrawMinAmount),
        withdrawMaxAmount: Number(limitInputs.withdrawMaxAmount),
        withdrawDailyLimit: Number(limitInputs.withdrawDailyLimit),
        withdrawMinGameplay: Number(limitInputs.withdrawMinGameplay),
      };
      if (toSave.withdrawMinAmount < 1) { showToast('Min amount must be ≥ ₹1 ❌', false); return; }
      if (toSave.withdrawMaxAmount < toSave.withdrawMinAmount) { showToast('Max must be > Min ❌', false); return; }
      await update(ref(db, 'systemSettings'), toSave);
      setLimits(toSave);
      showToast('✅ Withdrawal limits saved!');
    } catch {
      showToast('Failed to save ❌', false);
    }
    setSavingLimits(false);
  };

  const ToggleCard = ({ label, icon, desc, stateKey, color }) => {
    const isOn = settings[stateKey];
    return (
      <div style={{ background: 'rgba(15,22,50,0.85)', border: `1px solid ${isOn ? color + '44' : 'rgba(239,68,68,0.3)'}`, borderRadius: 18, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: isOn ? color + '22' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border: `1px solid ${isOn ? color + '44' : 'rgba(239,68,68,0.3)'}` }}>
            {isOn ? icon : '🔴'}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#dde4ff', fontSize: '0.95rem', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: '0.72rem', color: '#6677aa' }}>{desc}</div>
            <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: isOn ? color + '22' : 'rgba(239,68,68,0.15)', border: `1px solid ${isOn ? color + '55' : 'rgba(239,68,68,0.4)'}` }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOn ? color : '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isOn ? color : '#ef4444' }}>{isOn ? 'ACTIVE' : stateKey.includes('Maintenance') ? 'UNDER MAINTENANCE' : 'DISABLED'}</span>
            </div>
          </div>
        </div>
        <div
          onClick={() => toggle(stateKey, label)}
          style={{ width: 64, height: 32, borderRadius: 99, background: isOn ? `linear-gradient(135deg,${color},${color}aa)` : 'rgba(239,68,68,0.3)', border: `2px solid ${isOn ? color : 'rgba(239,68,68,0.5)'}`, cursor: 'pointer', position: 'relative', transition: 'all 0.3s', flexShrink: 0, boxShadow: isOn ? `0 0 20px ${color}55` : 'none' }}
        >
          <div style={{ position: 'absolute', top: 3, left: isOn ? 34 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }} />
        </div>
      </div>
    );
  };

  const LimitInput = ({ label, icon, field, prefix = '₹', hint }) => (
    <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: '#dde4ff', fontSize: '0.88rem' }}>{icon} {label}</div>
          {hint && <div style={{ fontSize: '0.68rem', color: '#6677aa', marginTop: 2 }}>{hint}</div>}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>
          Current: {prefix}{limits[field]?.toLocaleString()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: '#6677aa', fontWeight: 700, fontSize: '1rem' }}>{prefix}</span>
        <input
          type="number"
          value={limitInputs[field]}
          onChange={e => setLimitInputs(prev => ({ ...prev, [field]: e.target.value }))}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#fff', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, outline: 'none' }}
        />
      </div>
    </div>
  );

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}

      <div className="admin-section-header">
        <h2>⚙️ System Controls</h2>
        <span className="admin-live-badge">🔴 LIVE</span>
      </div>

      {/* ── Deposit / Withdrawal ON/OFF ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8899cc', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>💳 Payment Controls</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleCard label="Deposit System" icon="💰" desc="Turn OFF to stop all new deposits" stateKey="depositEnabled" color="#4ade80" />
          <ToggleCard label="Withdrawal System" icon="💸" desc="Turn OFF to stop all new withdrawals" stateKey="withdrawalEnabled" color="#60a5fa" />
        </div>
      </div>

      {/* ── Withdrawal Limits ── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8899cc', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>💸 Withdrawal Limits</p>
        <p style={{ fontSize: '0.73rem', color: '#6677aa', marginBottom: 14 }}>Set min/max withdrawal amounts. Users will see these limits in real-time.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <LimitInput
            label="Minimum Withdrawal"
            icon="⬇️"
            field="withdrawMinAmount"
            hint="Minimum amount user can withdraw per request"
          />
          <LimitInput
            label="Maximum Per Request"
            icon="⬆️"
            field="withdrawMaxAmount"
            hint="Max amount allowed in a single withdrawal"
          />
          <LimitInput
            label="Daily Withdrawal Limit"
            icon="📅"
            field="withdrawDailyLimit"
            hint="Total max withdrawal per user per day"
          />
          <LimitInput
            label="Min Gameplay Required"
            icon="🎯"
            field="withdrawMinGameplay"
            hint="User must have played games worth this amount to withdraw"
          />
        </div>

        {/* Current Limits Summary */}
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa', marginBottom: 10 }}>📊 Active Limits Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Min Withdraw', value: `₹${limits.withdrawMinAmount?.toLocaleString()}`, color: '#4ade80' },
              { label: 'Max/Request', value: `₹${limits.withdrawMaxAmount?.toLocaleString()}`, color: '#60a5fa' },
              { label: 'Daily Limit', value: `₹${limits.withdrawDailyLimit?.toLocaleString()}`, color: '#f97316' },
              { label: 'Min Gameplay', value: `₹${limits.withdrawMinGameplay?.toLocaleString()}`, color: '#fbbf24' },
            ].map(i => (
              <div key={i.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: '0.65rem', color: '#6677aa', fontWeight: 600 }}>{i.label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: i.color }}>{i.value}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={saveLimits}
          disabled={savingLimits}
          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: savingLimits ? '#334155' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: savingLimits ? 'not-allowed' : 'pointer', boxShadow: '0 8px 24px rgba(99,102,241,0.3)', fontFamily: 'inherit' }}
        >
          {savingLimits ? '⏳ Saving...' : '💾 Save Withdrawal Limits'}
        </button>
      </div>

      {/* ── Game Maintenance ── */}
      <div>
        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8899cc', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎮 Game Maintenance</p>
        <p style={{ fontSize: '0.75rem', color: '#6677aa', marginBottom: 14 }}>When a game is set to Maintenance, users will see a maintenance screen instead of the game.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ToggleCard label="WinGo (Color Trading)" icon="🎨" desc="Turn OFF to put WinGo under maintenance" stateKey="wingoMaintenance" color="#a78bfa" />
          <ToggleCard label="Aviator" icon="✈️" desc="Turn OFF to put Aviator under maintenance" stateKey="aviatorMaintenance" color="#06b6d4" />
          <ToggleCard label="Mines" icon="💣" desc="Turn OFF to put Mines under maintenance" stateKey="minesMaintenance" color="#f59e0b" />
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 20, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 14, padding: 16 }}>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>⚠️ Note: All changes are live instantly. Users will see the updated limits in real-time.</p>
      </div>
    </div>
  );
};

// ─── Support Messages ─────────────────────────────────────────────────────────
const SupportMessages = () => {
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState({});
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('all'); // all | open | resolved

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const msgsRef = ref(db, 'supportMessages');
    const unsub = onValue(msgsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMessages(arr);
    });
    return unsub;
  }, []);

  const handleReply = async (msgId, userId) => {
    const text = replyText[msgId]?.trim();
    if (!text) return;
    try {
      // Save reply in support message
      await set(ref(db, `supportMessages/${msgId}/reply`), text);
      await set(ref(db, `supportMessages/${msgId}/replyAt`), Date.now());
      await set(ref(db, `supportMessages/${msgId}/status`), 'replied');
      // Also send notification to user
      if (userId) {
        const notifRef = ref(db, `users/${userId}/notifications/${Date.now()}`);
        await set(notifRef, {
          message: `📩 Admin Reply: ${text}`,
          type: 'support',
          createdAt: Date.now(),
          read: false,
        });
      }
      setReplyText(prev => ({ ...prev, [msgId]: '' }));
      showToast('Reply sent & user notified ✅');
    } catch (err) {
      showToast('Failed to send reply ❌', false);
    }
  };

  const handleResolve = async (msgId) => {
    await set(ref(db, `supportMessages/${msgId}/status`), 'resolved');
    showToast('Marked as resolved ✅');
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Delete this support message?')) return;
    await remove(ref(db, `supportMessages/${msgId}`));
    showToast('Deleted ✅');
  };

  const filtered = messages.filter(m => {
    if (filter === 'open') return m.status !== 'resolved';
    if (filter === 'resolved') return m.status === 'resolved';
    return true;
  });

  const openCount = messages.filter(m => m.status !== 'resolved').length;

  const statusColor = (s) => s === 'resolved' ? '#4ade80' : s === 'replied' ? '#60a5fa' : '#fbbf24';
  const statusLabel = (s) => s === 'resolved' ? '✅ Resolved' : s === 'replied' ? '💬 Replied' : '🕐 Open';

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}

      <div className="admin-section-header">
        <h2>🎧 Support Messages</h2>
        <span className="admin-live-badge" style={{ background: openCount > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.1)', color: openCount > 0 ? '#fbbf24' : '#4ade80', border: `1px solid ${openCount > 0 ? '#fbbf2444' : '#4ade8044'}` }}>
          {openCount} Open
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total', value: messages.length, color: '#60a5fa' },
          { label: 'Open', value: messages.filter(m => m.status !== 'resolved').length, color: '#fbbf24' },
          { label: 'Resolved', value: messages.filter(m => m.status === 'resolved').length, color: '#4ade80' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(15,22,50,0.8)', border: `1px solid ${s.color}33`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: '#6677aa', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', 'All'], ['open', '🕐 Open'], ['resolved', '✅ Resolved']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ padding: '7px 16px', borderRadius: 8, border: filter === val ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)', background: filter === val ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', color: filter === val ? '#a78bfa' : '#8899cc', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Messages List */}
      {filtered.length === 0
        ? <div style={{ textAlign: 'center', color: '#667', padding: 40, background: 'rgba(15,22,50,0.6)', borderRadius: 16 }}>No messages found</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(msg => (
            <div key={msg.id} style={{ background: 'rgba(15,22,50,0.85)', border: `1px solid ${statusColor(msg.status)}33`, borderRadius: 18, padding: 20, borderLeft: `4px solid ${statusColor(msg.status)}` }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '1.2rem' }}>👤</span>
                    <strong style={{ color: '#dde4ff', fontSize: '0.95rem' }}>{msg.userName || 'Unknown User'}</strong>
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: '0.65rem', fontWeight: 800, color: statusColor(msg.status), background: statusColor(msg.status) + '22', border: `1px solid ${statusColor(msg.status)}44` }}>
                      {statusLabel(msg.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#6677aa' }}>
                    📧 {msg.userEmail || '—'} &nbsp;•&nbsp; 🕐 {fmtTime(msg.createdAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {msg.status !== 'resolved' && (
                    <button onClick={() => handleResolve(msg.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                      ✅ Resolve
                    </button>
                  )}
                  <button onClick={() => handleDelete(msg.id)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* Category & Subject */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                {msg.category && (
                  <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 800 }}>
                    🏷️ {msg.category}
                  </span>
                )}
                {msg.subject && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa' }}>📌 {msg.subject}</div>
                )}
              </div>

              {/* UTR, Amount, Proof Grid */}
              {(msg.utr || msg.amount || msg.proof) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  {msg.utr && msg.utr !== '—' && (
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#8899cc' }}>UTR / REF ID</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>{msg.utr}</div>
                    </div>
                  )}
                  {msg.amount && msg.amount !== '—' && (
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#8899cc' }}>AMOUNT</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#22c55e' }}>₹{msg.amount}</div>
                    </div>
                  )}
                  {msg.proof && msg.proof !== '—' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.65rem', color: '#8899cc' }}>PROOF / ATTACHMENT</div>
                      <div style={{ fontSize: '0.8rem', color: '#60a5fa', wordBreak: 'break-all' }}>🖼️ {msg.proof}</div>
                    </div>
                  )}
                </div>
              )}

              {/* User Message */}
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: '0.88rem', color: '#ccd6f6', lineHeight: 1.6 }}>
                {msg.message}
              </div>

              {/* Existing Reply */}
              {msg.reply && (
                <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.7rem', color: '#6677aa', marginBottom: 4 }}>💬 Admin Reply — {fmtTime(msg.replyAt)}</div>
                  <div style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>{msg.reply}</div>
                </div>
              )}

              {/* Reply Box */}
              {msg.status !== 'resolved' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Type your reply..."
                    value={replyText[msg.id] || ''}
                    onChange={e => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleReply(msg.id, msg.userId)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'inherit', fontSize: '0.88rem' }}
                  />
                  <button onClick={() => handleReply(msg.id, msg.userId)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    📩 Reply
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      }
    </div>
  );
};

// ─── Live Chat Admin ──────────────────────────────────────────────────────────
const LiveChatAdmin = () => {
  const [chats, setChats] = useState([]);
  const [selectedUser, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Load all chat threads
  useEffect(() => {
    const chatsRef = ref(db, 'chats');
    const unsub = onValue(chatsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      arr.sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
      setChats(arr);
    });
    return unsub;
  }, []);

  // Load messages for selected user
  useEffect(() => {
    if (!selectedUser) return;
    const msgRef = ref(db, `chats/${selectedUser}/messages`);
    const unsub = onValue(msgRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      arr.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(arr);
    });
    return unsub;
  }, [selectedUser]);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedUser || sending) return;
    setSending(true);
    try {
      const msgRef = push(ref(db, `chats/${selectedUser}/messages`));
      await set(msgRef, {
        sender: 'admin',
        senderName: 'Admin Support',
        text,
        createdAt: Date.now(),
        read: false,
      });
      await update(ref(db, `chats/${selectedUser}`), {
        lastMessage: text,
        lastAt: Date.now(),
        status: 'replied',
        unreadUser: (messages.filter(m => m.sender === 'admin' && !m.read).length + 1),
      });
      setReplyText('');
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
  const totalUnread = chats.reduce((s, c) => s + (c.unreadAdmin || 0), 0);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>💬 Live Chat Inbox</h2>
        <span className="admin-live-badge" style={{ background: totalUnread > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.1)', color: totalUnread > 0 ? '#f87171' : '#4ade80' }}>
          {totalUnread > 0 ? `${totalUnread} Unread` : 'All Read'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, height: 520 }}>
        {/* Left: User List */}
        <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', fontWeight: 800, color: '#6677aa' }}>
            {chats.length} Conversations
          </div>
          {chats.length === 0 && (
            <div style={{ textAlign: 'center', color: '#667', padding: 30, fontSize: '0.8rem' }}>No chats yet</div>
          )}
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setSelectedUserId(chat.id)}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: selectedUser === chat.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderLeft: selectedUser === chat.id ? '3px solid #6366f1' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: '#dde4ff', fontSize: '0.85rem' }}>{chat.userName || 'User'}</strong>
                {chat.unreadAdmin > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: '0.62rem', fontWeight: 800 }}>
                    {chat.unreadAdmin}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6677aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chat.lastMessage || 'No messages'}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#445', marginTop: 3 }}>{fmtTime(chat.lastAt)}</div>
            </div>
          ))}
        </div>

        {/* Right: Chat Window */}
        <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column' }}>
          {!selectedUser ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6677aa', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: '2.5rem' }}>💬</span>
              <span style={{ fontSize: '0.85rem' }}>Select a conversation to start replying</span>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>👤</div>
                <div>
                  <div style={{ fontWeight: 800, color: '#dde4ff', fontSize: '0.9rem' }}>{chats.find(c => c.id === selectedUser)?.userName || 'User'}</div>
                  <div style={{ fontSize: '0.67rem', color: '#6677aa' }}>{chats.find(c => c.id === selectedUser)?.mobile || selectedUser?.slice(0, 12)}</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.sender === 'admin' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                    {m.sender !== 'admin' && (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>👤</div>
                    )}
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        padding: '9px 14px',
                        borderRadius: m.sender === 'admin' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: m.sender === 'admin' ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(255,255,255,0.07)',
                        color: '#fff',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-line',
                      }}>
                        {m.text}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#6677aa', marginTop: 3, textAlign: m.sender === 'admin' ? 'right' : 'left' }}>
                        {fmtTime(m.createdAt)} {m.sender === 'admin' && (m.read ? '✓✓' : '✓')}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply Input */}
              <form onSubmit={handleSendReply} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Type reply to user..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  disabled={sending}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontFamily: 'inherit', fontSize: '0.88rem' }}
                />
                <button type="submit" disabled={sending || !replyText.trim()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: sending ? '#334155' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {sending ? '...' : '➤ Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
const AdminPanel = () => {
  const savedAuth = localStorage.getItem('admin_auth');
  const [admin, setAdmin] = useState(savedAuth ? JSON.parse(savedAuth) : null);
  const [section, setSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <UserManagement />;
      case 'bets': return <LiveBets />;
      case 'wingo': return <WinGoControl />;
      case 'aviator': return <AviatorControl />;
      case 'mines': return <MinesControl />;
      case 'deposits': return <Deposits />;
      case 'withdrawals': return <Withdrawals />;
      case 'bonuses': return <Bonuses />;
      case 'giftcodes': return <GiftCodes />;
      case 'support': return <SupportMessages />;
      case 'livechat': return <LiveChatAdmin />;
      case 'controls': return <SystemControls />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="admin-shell">
      {/* Mobile Overlay */}
      {sidebarOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 25, backdropFilter: 'blur(4px)' }} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <span>⚙️</span>
            <div>
              <h2 className="admin-logo-title">Admin Panel</h2>
              <p className="admin-logo-role">{admin.role === 'super' ? 'Super Admin' : 'Sub Admin'}</p>
            </div>
          </div>
        </div>
        <nav className="admin-nav">
          {SECTIONS.map(s => (
            <button key={s.id} className={`admin-nav-item ${section === s.id ? 'active' : ''}`} onClick={() => { setSection(s.id); setSidebarOpen(false); }}>
              <span className="admin-nav-icon">{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={() => { localStorage.removeItem('admin_auth'); setAdmin(null); }}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <div className="admin-topbar">
          <button className="admin-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <h1 className="admin-topbar-title">{SECTIONS.find(s => s.id === section)?.label || 'Dashboard'}</h1>
          <div className="admin-topbar-right">
            <span className="admin-live-dot"></span>
            <span style={{ fontSize: '0.8rem', color: '#8899cc', marginRight: '10px' }}>{admin.email}</span>
          </div>
        </div>
        <div className="admin-content">
          {renderSection()}
        </div>
      </main>
    </div>
  );
};

// ─── Gift Codes Manager ───────────────────────────────────────────────────────
const GiftCodes = () => {
  const [codes, setCodes] = useState({});
  const [form, setForm] = useState({ code: '', amount: '', maxUses: '', expiresIn: '7' });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const unsub = onValue(ref(db, 'giftCodes'), (snap) => {
      setCodes(snap.val() || {});
    });
    return unsub;
  }, []);

  const handleCreate = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code || !form.amount) { showToast('Code and amount required ❌', false); return; }
    if (!/^[A-Z0-9_]+$/.test(code)) { showToast('Only A-Z, 0-9, _ allowed in code ❌', false); return; }
    setLoading(true);
    try {
      const expiresAt = form.expiresIn ? Date.now() + (parseInt(form.expiresIn) * 24 * 60 * 60 * 1000) : null;
      await set(ref(db, `giftCodes/${code}`), {
        amount: parseFloat(form.amount),
        maxUses: form.maxUses ? parseInt(form.maxUses) : 9999,
        expiresAt,
        createdAt: Date.now(),
        usedBy: {}
      });
      showToast(`Gift code "${code}" created ✅`);
      setForm({ code: '', amount: '', maxUses: '', expiresIn: '7' });
    } catch (err) { showToast('Failed: ' + err.message, false); }
    setLoading(false);
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete gift code "${code}"?`)) return;
    await remove(ref(db, `giftCodes/${code}`));
    showToast(`Code "${code}" deleted ✅`);
  };

  const inp = { padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem' };

  return (
    <div className="admin-section">
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff', padding: '12px 20px', borderRadius: 12, fontWeight: 700, zIndex: 999 }}>{toast.msg}</div>}
      <div className="admin-section-header">
        <h2>🎟️ Gift Code Manager</h2>
        <span className="admin-count-badge">{Object.keys(codes).length} Codes</span>
      </div>

      {/* Create Code */}
      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ margin: '0 0 14px', fontWeight: 800, color: '#ffd700' }}>➕ Create New Gift Code</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Code Name</label>
            <input style={inp} placeholder="e.g. WELCOME100" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Bonus Amount (₹)</label>
            <input type="number" style={inp} placeholder="e.g. 50" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Max Uses (blank = unlimited)</label>
            <input type="number" style={inp} placeholder="e.g. 100" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#8899cc', display: 'block', marginBottom: 4 }}>Expires In (days)</label>
            <input type="number" style={inp} placeholder="e.g. 7" value={form.expiresIn} onChange={e => setForm(f => ({ ...f, expiresIn: e.target.value }))} />
          </div>
        </div>
        <button onClick={handleCreate} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: loading ? '#334155' : 'linear-gradient(135deg, #ffd700, #f97316)', color: '#0f172a', fontWeight: 900, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? '⏳ Creating...' : '🎟️ Create Gift Code'}
        </button>
      </div>

      {/* Active Codes List */}
      <div style={{ background: 'rgba(15,22,50,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16 }}>
        <p style={{ margin: '0 0 14px', fontWeight: 800, color: '#dde4ff' }}>📋 Active Gift Codes</p>
        {Object.keys(codes).length === 0
          ? <p style={{ textAlign: 'center', color: '#667', padding: 20 }}>No gift codes created yet</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
            {Object.entries(codes).map(([code, data]) => {
              const usedCount = data.usedBy ? Object.keys(data.usedBy).length : 0;
              const isExpired = data.expiresAt && Date.now() > data.expiresAt;
              return (
                <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isExpired ? 'rgba(239,68,68,0.05)' : 'rgba(255,215,0,0.05)', borderRadius: 12, border: `1px solid ${isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(255,215,0,0.15)'}` }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: isExpired ? '#f87171' : '#ffd700', fontFamily: 'monospace' }}>{code}</div>
                    <div style={{ fontSize: '0.72rem', color: '#6677aa', marginTop: 2 }}>
                      ₹{data.amount} bonus • Used: {usedCount}/{data.maxUses >= 9999 ? '∞' : data.maxUses}
                      {data.expiresAt && <span style={{ marginLeft: 6, color: isExpired ? '#f87171' : '#8899cc' }}>• {isExpired ? '❌ Expired' : `Exp: ${new Date(data.expiresAt).toLocaleDateString('en-IN')}`}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(code)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                    🗑️ Delete
                  </button>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
};

export default AdminPanel;

