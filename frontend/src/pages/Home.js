import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import SupportModal from '../components/SupportModal';
import { getUserProfile, getWalletBalance, setUserOnline } from '../services/firebaseService';
import { db, ref, onValue } from '../firebaseConfig';
import './Home.css';
import '../components/SupportModal.css';

const Home = () => {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('ctg_user') || '{}');
  const userId = storedUser.id || storedUser._id || null;

  const [showSupport, setShowSupport] = useState(false);
  const [activeCategory, setActiveCategory] = useState('lottery');
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [desktopInstalled, setDesktopInstalled] = useState(false);

  const [sysSettings, setSysSettings] = useState({
    depositEnabled: true,
    wingoMaintenance: false,
    aviatorMaintenance: false,
    minesMaintenance: false,
  });

  const [user, setUser] = useState({
    fullName: storedUser.fullName || 'Player',
    walletBalance: storedUser.walletBalance || 0,
    bonusBalance: storedUser.bonusBalance || 0,
    vipLevel: storedUser.vipLevel || 'Bronze',
    referralEarnings: storedUser.referralEarnings || 0,
    activeReferrals: storedUser.activeReferrals || 0,
  });

  useEffect(() => {
    if (!userId) return;
    setUserOnline(userId);

    const unsubProfile = getUserProfile(userId, (data) => {
      if (data) {
        setUser((prev) => ({
          ...prev,
          ...data,
          walletBalance: data.walletBalance ?? prev.walletBalance,
        }));
      }
    });

    const unsubWallet = getWalletBalance(userId, (bal) => {
      if (bal !== null && bal !== undefined) {
        setUser((prev) => ({ ...prev, walletBalance: bal }));
      }
    });

    return () => {
      unsubProfile();
      unsubWallet();
    };
  }, [userId]);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // System Settings
  useEffect(() => {
    const unsub = onValue(ref(db, 'systemSettings'), (snap) => {
      const data = snap.val();
      if (data) setSysSettings((prev) => ({ ...prev, ...data }));
    });
    return unsub;
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDesktopInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('🎉 95 CLUB Shortcut: Tap your browser menu and choose "Add to Home Screen" to claim your ₹13 bonus!');
    }
  };

  const categories = [
    { id: 'lottery', name: 'Lottery', icon: '🎱', class: 'cat-lottery' },
    { id: 'popular', name: 'Popular', icon: '🏆', class: 'cat-popular' },
    { id: 'mini', name: 'Mini games', icon: '✈️', class: 'cat-mini' },
    { id: 'slots', name: 'Slots', icon: '🎰', class: 'cat-slots' },
    { id: 'sports', name: 'Sports', icon: '⚽', class: 'cat-sports' },
  ];

  const depositOffers = [
    { deposit: 300, bonus: 100, extra: 50 },
    { deposit: 1000, bonus: 300, extra: 150 },
    { deposit: 2000, bonus: 700, extra: 300 },
  ];

  return (
    <div className="home-page-95club">
      {/* ── Top Header Bar ── */}
      <header className="nc-header">
        <div className="nc-header-left" onClick={() => navigate('/')}>
          <img src="/assets/logo_95club.png" alt="95 CLUB Logo" className="nc-header-logo-img" />
          <div className="nc-brand-text">
            <span className="nc-brand-title">👑 95 CLUB</span>
            <span className="nc-brand-sub">OFFICIAL CASINO</span>
          </div>
        </div>

        <div className="nc-header-right">
          <div className="nc-wallet-pill" onClick={() => navigate('/wallet')}>
            <span style={{ fontSize: '0.82rem' }}>💰</span>
            <span className="nc-wallet-amt">₹{Number(user.walletBalance || 0).toFixed(2)}</span>
          </div>

          <button
            className="nc-header-btn"
            onClick={handleInstallApp}
            title="Download 95 CLUB App"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z" />
            </svg>
          </button>

          <button
            className="nc-header-btn"
            onClick={() => setShowSupport(true)}
            title="24/7 Customer Service"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 2.21 1.79 4 4 4h1v-8H5v-3c0-3.87 3.13-7 7-7s7 3.13 7 7v3h-3v8h1c2.21 0 4-1.79 4-4v-7c0-4.97-4.03-9-9-9z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div className="nc-hero-wrap">
        <div className="nc-hero-card">
          <img src="/assets/banner_95club.png" alt="95 CLUB Official Channel" className="nc-hero-img" />
          <div className="nc-hero-overlay">
            <a
              href="https://t.me/61clubsupport"
              target="_blank"
              rel="noopener noreferrer"
              className="nc-telegram-badge"
            >
              <span>✈️</span> t.me/95clubofficial
            </a>
            <a
              href="https://t.me/61clubsupport"
              target="_blank"
              rel="noopener noreferrer"
              className="nc-hero-join-btn"
            >
              ⚡ JOIN NOW
            </a>
          </div>
        </div>
      </div>

      {/* ── Marquee / Announcement Bar ── */}
      <div className="nc-notice-bar">
        <div className="nc-notice-icon">🔊</div>
        <div className="nc-notice-marquee">
          <div className="nc-notice-marquee-inner">
            Dear User, welcome to 95 CLUB! 95 CLUB is a brand-new premium entertainment platform. Instant deposits, fast withdrawals, WinGo, K3, 5D Lottery, and 24/7 customer support!
          </div>
        </div>
        <button className="nc-notice-detail-btn" onClick={() => setShowNoticeModal(true)}>
          Detail
        </button>
      </div>

      {/* ── Category Icons Row (5 Rounded Squircle Cards) ── */}
      <div className="nc-categories-row">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={`nc-category-card ${cat.class} ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            <span className="nc-cat-icon">{cat.icon}</span>
            <span className="nc-cat-label">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* ── Section Header (🎱 Lottery ALL 5) ── */}
      <div className="nc-section-header">
        <div className="nc-section-title-wrap">
          <span className="nc-section-icon">🎱</span>
          <span className="nc-section-title">Lottery</span>
          <span className="nc-section-badge">ALL 5</span>
        </div>
        <div className="nc-nav-arrows">
          <button className="nc-arrow-btn">‹</button>
          <button className="nc-arrow-btn">›</button>
        </div>
      </div>

      {/* ── 3D Game Cards Grid (Matches Reference Image) ── */}
      <div className="nc-games-grid">
        {/* Card 1: WINGO */}
        <div
          className="nc-game-card"
          onClick={() => {
            if (sysSettings.wingoMaintenance) {
              alert('WinGo is currently under maintenance. Please check back shortly!');
              return;
            }
            navigate('/game/colorwin');
          }}
        >
          <span className="nc-game-card-badge">HOT</span>
          <div className="nc-game-card-img-wrap">
            <img src="/assets/card_wingo.png" alt="WINGO" className="nc-game-card-img" />
          </div>
          <div className="nc-game-card-title">WINGO</div>
        </div>

        {/* Card 2: K3 LOTTERY */}
        <div
          className="nc-game-card"
          onClick={() => {
            navigate('/game/colorwin');
          }}
        >
          <span className="nc-game-card-badge">DICE</span>
          <div className="nc-game-card-img-wrap">
            <img src="/assets/card_k3.png" alt="K3 LOTTERY" className="nc-game-card-img" />
          </div>
          <div className="nc-game-card-title">K3 LOTTERY</div>
        </div>

        {/* Card 3: 5D LOTTERY */}
        <div
          className="nc-game-card"
          onClick={() => {
            navigate('/game/colorwin');
          }}
        >
          <span className="nc-game-card-badge">5D</span>
          <div className="nc-game-card-img-wrap">
            <img src="/assets/card_5d.png" alt="5D LOTTERY" className="nc-game-card-img" />
          </div>
          <div className="nc-game-card-title">5D LOTTERY</div>
        </div>
      </div>

      {/* ── Secondary Games Row (Aviator, Mines) ── */}
      <div className="nc-secondary-games-row">
        <div
          className="nc-secondary-card card-aviator"
          onClick={() => {
            if (sysSettings.aviatorMaintenance) {
              alert('Aviator is currently under maintenance.');
              return;
            }
            navigate('/game/aviator');
          }}
        >
          <div className="nc-secondary-info">
            <h4>✈️ AVIATOR</h4>
            <p>Crash Multiplier 100x</p>
          </div>
          <span className="nc-secondary-icon">🚀</span>
        </div>

        <div
          className="nc-secondary-card card-mines"
          onClick={() => {
            if (sysSettings.minesMaintenance) {
              alert('Mines Sweeper is currently under maintenance.');
              return;
            }
            navigate('/game/mines');
          }}
        >
          <div className="nc-secondary-info">
            <h4>💣 MINES</h4>
            <p>Jewels & Treasure</p>
          </div>
          <span className="nc-secondary-icon">💎</span>
        </div>
      </div>

      {/* ── Floating / Sticky "Add to Desktop" Bar ── */}
      <div className="nc-desktop-banner" onClick={handleInstallApp}>
        <div className="nc-desktop-left">
          <div className="nc-desktop-icon">
            <img src="/assets/logo_95club.png" alt="95 CLUB App" />
          </div>
          <div className="nc-desktop-text">
            <span className="nc-desktop-title">Get ₹13 Bonus</span>
            <span className="nc-desktop-sub">Add 95 CLUB to Desktop</span>
          </div>
        </div>
        <div className="nc-desktop-action">
          {desktopInstalled ? 'Installed ✓' : '+ Install'}
        </div>
      </div>

      {/* ── Quick Stats Bar ── */}
      <div className="nc-stats-bar">
        <div className="nc-stat-box">
          <span className="nc-stat-num">₹{Number(user.walletBalance || 0).toFixed(2)}</span>
          <span className="nc-stat-txt">Wallet Balance</span>
        </div>
        <div className="nc-stat-sep" />
        <div className="nc-stat-box">
          <span className="nc-stat-num">₹{Number(user.referralEarnings || 0).toFixed(2)}</span>
          <span className="nc-stat-txt">Referral Income</span>
        </div>
        <div className="nc-stat-sep" />
        <div className="nc-stat-box">
          <span className="nc-stat-num">{user.activeReferrals || 0}</span>
          <span className="nc-stat-txt">Team Members</span>
        </div>
      </div>

      {/* ── Deposit Offers Section ── */}
      <div className="nc-offers-section">
        <div className="nc-section-header" style={{ margin: '0 0 10px' }}>
          <div className="nc-section-title-wrap">
            <span className="nc-section-icon">🎁</span>
            <span className="nc-section-title">95 CLUB Deposit Bonus</span>
          </div>
          <button
            onClick={() => navigate('/wallet')}
            style={{ background: 'none', border: 'none', color: '#ff4d67', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
          >
            Deposit Now →
          </button>
        </div>

        <div className="nc-offers-grid">
          {depositOffers.map((offer, idx) => (
            <div key={idx} className="nc-offer-card" onClick={() => navigate('/wallet')}>
              <div className="nc-offer-left">
                <span className="nc-offer-badge">₹{offer.deposit}</span>
                <div className="nc-offer-info">
                  <span className="nc-offer-amt">Deposit ₹{offer.deposit}</span>
                  <span className="nc-offer-reward">+₹{offer.bonus} Extra Bonus (Instant)</span>
                </div>
              </div>
              <span className="nc-offer-arrow">›</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Notice Detail Modal ── */}
      {showNoticeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowNoticeModal(false)}
        >
          <div
            style={{
              background: '#200509',
              border: '1.5px solid rgba(255,77,103,0.3)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src="/assets/logo_95club.png" alt="95 CLUB" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffd700', fontWeight: 900 }}>95 CLUB Notice</h3>
                <span style={{ fontSize: '0.7rem', color: '#ff9aa7' }}>Official Announcement</span>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#d1b2b6', lineHeight: 1.6, margin: '0 0 18px' }}>
              Welcome to <strong>95 CLUB</strong>! We provide high-speed gaming entertainment including WinGo color prediction, K3 Lottery, 5D Lottery, Aviator crash game, and Mines.
              <br /><br />
              • Instant deposits via RupayEx UPI<br />
              • Fast withdrawal processing<br />
              • 24/7 dedicated customer support team
            </p>
            <button
              onClick={() => setShowNoticeModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #ff4d67, #e11d48)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* 24/7 Support Modal */}
      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />

      {/* 5-Tab Luxury Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
};

export default Home;
