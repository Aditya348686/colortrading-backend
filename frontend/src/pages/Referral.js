import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { getUserProfile, getTransactions } from '../services/firebaseService';
import { db, ref, onValue } from '../firebaseConfig';

const Referral = () => {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('ctg_user') || '{}');
  const userId = storedUser.id || storedUser._id || null;

  const [user, setUser] = useState({
    referralCode: storedUser.referralCode || '',
    referralEarnings: storedUser.referralEarnings || 0,
    activeReferrals: storedUser.activeReferrals || 0,
    fullName: storedUser.fullName || '',
    walletBalance: storedUser.walletBalance || 0,
  });
  const [team, setTeam] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  // Live user profile
  useEffect(() => {
    if (!userId) return;
    const unsub = getUserProfile(userId, (data) => {
      if (data) {
        setUser(prev => ({
          ...prev,
          referralCode: data.referralCode || prev.referralCode,
          referralEarnings: data.referralEarnings ?? prev.referralEarnings,
          activeReferrals: data.activeReferrals ?? prev.activeReferrals,
          walletBalance: data.walletBalance ?? prev.walletBalance,
        }));
      }
    });
    return unsub;
  }, [userId]);

  // Team list from Firebase referrals node
  useEffect(() => {
    if (!userId) return;
    const unsub = onValue(ref(db, `referrals/${userId}/team`), (snap) => {
      const d = snap.val();
      if (d) {
        const arr = Object.entries(d).map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.joinedAt - a.joinedAt);
        setTeam(arr);
      } else {
        setTeam([]);
      }
    });
    return unsub;
  }, [userId]);

  // Commission transactions
  useEffect(() => {
    if (!userId) return;
    const unsub = getTransactions(userId, (txList) => {
      const commTx = (txList || []).filter(t => t.type === 'commission');
      setCommissions(commTx);
    });
    return unsub;
  }, [userId]);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: '👑 Join 95 CLUB Gaming!',
        text: `Hey! Join 95 CLUB and earn real money. Use my referral code: ${user.referralCode}`,
        url: referralLink,
      });
    } else {
      handleCopy(referralLink, 'link');
    }
  };

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtMobile = (m) => m ? m.toString().slice(0, 5) + '*****' : '—';

  const totalEarnings = commissions.reduce((s, c) => s + (c.amount || 0), 0);

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'team', label: `👥 Team (${team.length})` },
    { id: 'earnings', label: '💰 Earnings' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0c1017', color: '#ffffff', paddingBottom: 100, fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .ref-tab-btn:hover { background: rgba(255,255,255,0.06) !important; }
        .ref-copy-btn:active { transform: scale(0.95); }
      `}</style>

      {/* Header */}
      <div style={{ padding: '14px 18px 12px', background: 'linear-gradient(135deg, #121722, #1a2035)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, background: 'linear-gradient(90deg, #a78bfa 0%, #60a5fa 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          👥 Refer &amp; Earn
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
          Earn up to 10% commission on every bet your team places
        </p>
      </div>

      <div style={{ padding: '14px' }}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16, animation: 'slideUp 0.4s ease' }}>
          {[
            { label: 'Total Earned', value: `₹${(user.referralEarnings || 0).toFixed(2)}`, color: '#4ade80', icon: '💰' },
            { label: 'Team Members', value: user.activeReferrals || 0, color: '#a78bfa', icon: '👥' },
            { label: 'Commission', value: `₹${totalEarnings.toFixed(2)}`, color: '#fbbf24', icon: '📈' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(15,22,50,0.85)', border: `1px solid ${s.color}22`, borderRadius: 16, padding: '14px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: s.color, margin: '4px 0 2px' }}>{s.value}</div>
              <div style={{ fontSize: '0.6rem', color: '#6677aa', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Referral Code Card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.15))', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 20, padding: '18px 16px', marginBottom: 12 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#8899cc', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🎯 Your Referral Code</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: '13px 14px', fontSize: '1.4rem', fontWeight: 900, color: '#a78bfa', letterSpacing: '0.15em', fontFamily: 'monospace', textAlign: 'center' }}>
              {user.referralCode || '...'}
            </div>
            <button className="ref-copy-btn" onClick={() => handleCopy(user.referralCode, 'code')}
              style={{ background: copied === 'code' ? '#065f46' : 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, padding: '13px 16px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s', minWidth: 80 }}>
              {copied === 'code' ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          {/* Share Link */}
          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: '0.72rem', color: '#6677aa', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 10 }}>
            {referralLink}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => handleCopy(referralLink, 'link')}
              style={{ padding: '11px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              {copied === 'link' ? '✓ Copied!' : '🔗 Copy Link'}
            </button>
            <button onClick={handleShare}
              style={{ padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#ff3d7f,#ff5663)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
              📤 Share Now
            </button>
          </div>
        </div>

        {/* Commission Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { level: 'L1', pct: '10%', label: 'Direct Referrals', color: '#ffd700' },
            { level: 'L2', pct: '5%', label: 'Level 2 Team', color: '#a8a9ad' },
            { level: 'L3', pct: '2%', label: 'Level 3 Team', color: '#cd7f32' },
          ].map((c) => (
            <div key={c.level} style={{ background: `${c.color}12`, border: `1px solid ${c.color}33`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: c.color }}>{c.pct}</div>
              <div style={{ fontSize: '0.68rem', color: c.color, fontWeight: 700, marginBottom: 2 }}>{c.level}</div>
              <div style={{ fontSize: '0.6rem', color: '#6677aa' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} className="ref-tab-btn" onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, padding: '9px 6px', borderRadius: 9, border: 'none', background: activeTab === t.id ? 'rgba(99,102,241,0.3)' : 'transparent', color: activeTab === t.id ? '#a78bfa' : '#6677aa', fontWeight: activeTab === t.id ? 700 : 500, fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={{ animation: 'slideUp 0.3s ease' }}>
            {/* How it works */}
            <div style={{ background: 'rgba(14,22,50,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px' }}>
              <p style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 800, color: '#dde4ff' }}>📖 How It Works</p>
              {[
                { step: '1', text: 'Share your referral code or link with friends', icon: '📤' },
                { step: '2', text: 'Friend registers using your code & gets signup bonus', icon: '👤' },
                { step: '3', text: 'You earn ₹10 instantly when they register', icon: '💰' },
                { step: '4', text: 'Earn 10% on every bet they place — FOREVER', icon: '♾️' },
                { step: '5', text: 'Earn 5% from L2 & 2% from L3 team bets too!', icon: '🚀' },
              ].map((item) => (
                <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderBottom: item.step < '5' ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{item.icon}</span>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#c0d0ff' }}>
                    <strong style={{ color: '#a78bfa' }}>Step {item.step}:</strong> {item.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Invite via Telegram */}
            <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`👑 Join 95 CLUB Gaming! Use my referral code: ${user.referralCode}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg, #0088cc, #006aaa)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.3rem' }}>✈️</span>
              Share on Telegram
            </a>

            <a href={`https://wa.me/?text=${encodeURIComponent(`👑 Join 95 CLUB Gaming! Use my referral code: ${user.referralCode}\n\n${referralLink}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8, padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
              <span style={{ fontSize: '1.3rem' }}>📱</span>
              Share on WhatsApp
            </a>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div style={{ animation: 'slideUp 0.3s ease' }}>
            {team.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(15,22,50,0.6)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dde4ff', marginBottom: 6 }}>No team members yet</div>
                <div style={{ fontSize: '0.8rem', color: '#6677aa' }}>Share your referral code to invite friends!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {team.map((member, i) => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(15,22,50,0.85)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>
                      {(member.fullName || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dde4ff' }}>{member.fullName || 'User'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6677aa' }}>{fmtMobile(member.mobile)} • Joined {fmtTime(member.joinedAt)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700 }}>L{member.level || 1}</div>
                      <div style={{ fontSize: '0.65rem', color: '#6677aa', marginTop: 2 }}>#{i + 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <div style={{ animation: 'slideUp 0.3s ease' }}>
            {/* Summary */}
            <div style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,197,94,0.08))', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80' }}>₹{(user.referralEarnings || 0).toFixed(2)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6677aa', marginTop: 2 }}>Total Referral Earnings</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24' }}>{commissions.length}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6677aa', marginTop: 2 }}>Commission Transactions</div>
                </div>
              </div>
            </div>

            {commissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(15,22,50,0.6)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>💰</div>
                <div style={{ fontSize: '0.9rem', color: '#6677aa' }}>No commission earned yet.<br />Invite friends to start earning!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {commissions.slice(0, 50).map((tx) => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(15,22,50,0.85)', borderRadius: 14, border: '1px solid rgba(74,222,128,0.1)', borderLeft: '3px solid #4ade80' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dde4ff' }}>{tx.method || 'Commission'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6677aa', marginTop: 2 }}>
                        {tx.betAmount ? `Team bet: ₹${tx.betAmount}` : 'Signup bonus'} • {fmtTime(tx.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#4ade80' }}>+₹{(tx.amount || 0).toFixed(2)}</div>
                      {tx.rate && <div style={{ fontSize: '0.65rem', color: '#6677aa' }}>{tx.rate}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div >
  );
};

export default Referral;
