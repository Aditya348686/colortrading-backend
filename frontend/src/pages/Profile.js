import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import SupportModal from '../components/SupportModal';
import {
  getUserProfile,
  getWalletBalance,
  getNotifications,
  markNotificationRead,
  setUserOnline,
  setUserOffline,
  saveUserToFirebase,
  getUserFromFirebase
} from '../services/firebaseService';
import './Profile.css';
import '../components/SupportModal.css';

const Profile = () => {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('ctg_user') || '{}');
  const userId = storedUser.id || storedUser._id || 'guest';

  const [user, setUser] = useState({
    fullName: storedUser.fullName || 'Player One',
    email: storedUser.email || 'user@example.com',
    mobile: storedUser.mobile || '+91 98765 43210',
    vipLevel: storedUser.vipLevel || 'Bronze',
    referralCode: storedUser.referralCode || '61CLUB001',
    walletBalance: storedUser.walletBalance || 0,
    bonusBalance: storedUser.bonusBalance || 0,
    kycStatus: storedUser.kycStatus || 'Pending',
    profilePhoto: storedUser.profilePhoto || '',
    activeReferrals: storedUser.activeReferrals || 0,
    referralEarnings: storedUser.referralEarnings || 0,
  });

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [walletBalance, setWalletBalance] = useState(storedUser.walletBalance || 0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userId === 'guest') return;

    setUserOnline(userId);

    getUserFromFirebase(userId).then((fbData) => {
      if (!fbData && storedUser.email) {
        saveUserToFirebase(userId, {
          fullName: storedUser.fullName || '',
          email: storedUser.email || '',
          mobile: storedUser.mobile || '',
          walletBalance: storedUser.walletBalance ?? 50,
          bonusBalance: storedUser.bonusBalance ?? 20,
          vipLevel: storedUser.vipLevel || 'Bronze',
          referralCode: storedUser.referralCode || '',
          referralEarnings: storedUser.referralEarnings ?? 0,
          activeReferrals: storedUser.activeReferrals ?? 0,
          kycStatus: storedUser.kycStatus || 'Pending',
          profilePhoto: storedUser.profilePhoto || '',
          role: storedUser.role || 'user',
          banned: false,
          createdAt: Date.now(),
        });
      }
    });

    const unsubProfile = getUserProfile(userId, (data) => {
      if (data && Object.keys(data).length > 0) {
        setUser((prev) => ({ ...prev, ...data }));
        if (data.walletBalance !== undefined && data.walletBalance !== null) {
          setWalletBalance(data.walletBalance);
        }
        const updated = { ...storedUser, ...data };
        localStorage.setItem('ctg_user', JSON.stringify(updated));
      }
    });

    const unsubWallet = getWalletBalance(userId, (bal) => {
      if (bal !== null && bal !== undefined) {
        setWalletBalance(bal);
      }
    });

    const unsubNotif = getNotifications(userId, (list) => {
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
    });

    return () => {
      unsubProfile();
      unsubWallet();
      unsubNotif();
      setUserOffline(userId);
    };
    // eslint-disable-next-line
  }, [userId]);

  const handleRefreshBalance = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const logout = () => {
    if (userId !== 'guest') setUserOffline(userId);
    localStorage.removeItem('ctg_token');
    localStorage.removeItem('ctg_user');
    window.location.href = '/login';
  };

  const handleNotifClick = (notif) => {
    if (!notif.read) markNotificationRead(userId, notif.id);
  };

  const vipColors = {
    Bronze: '#cd7f32',
    Silver: '#a8a9ad',
    Gold: '#ffd700',
    Platinum: '#e5e4e2',
    Diamond: '#b9f2ff',
  };

  const vipColor = vipColors[user.vipLevel] || '#cd7f32';

  const initials = user.fullName
    ? user.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '95';

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <span className="profile-header-title">👑 95 CLUB PROFILE</span>
        <div className="profile-header-balance">
          <span>💰</span>
          <span>₹{Number(walletBalance).toFixed(2)}</span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="profile-balance-card">
        <div className="profile-balance-gradient" />
        <div className="profile-balance-inner">
          <div className="profile-avatar-row">
            <div className="profile-avatar" style={{ boxShadow: `0 0 0 3px ${vipColor}` }}>
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="avatar" className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-initials">{initials}</span>
              )}
              <span className="profile-vip-badge" style={{ background: vipColor }}>
                {user.vipLevel}
              </span>
            </div>
            <div className="profile-user-info">
              <p className="profile-user-name">{user.fullName}</p>
              <p className="profile-user-id">
                UID: {(() => {
                  if (!userId || userId === 'guest') return '100001';
                  if (/^\d{6}$/.test(userId)) return userId;
                  let hash = 0;
                  for (let i = 0; i < userId.length; i++) {
                    hash = (hash * 31 + userId.charCodeAt(i)) % 900000;
                  }
                  return String(100000 + Math.abs(hash));
                })()}
              </p>
              <p className="profile-kyc" style={{ color: user.kycStatus === 'Verified' ? '#22c55e' : '#ffb300' }}>
                KYC: {user.kycStatus}
              </p>
            </div>
          </div>

          <div className="profile-total-balance">
            <p className="profile-balance-label">Total balance</p>
            <div className="profile-balance-amount">
              <span>₹{Number(walletBalance).toFixed(2)}</span>
              <button
                className={`profile-refresh-btn ${refreshing ? 'spinning' : ''}`}
                onClick={handleRefreshBalance}
                title="Refresh"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="profile-quick-actions">
            <button className="profile-action-btn" onClick={() => navigate('/wallet')}>
              <span className="profile-action-icon wallet-icon">💳</span>
              <span>Wallet</span>
            </button>
            <button className="profile-action-btn" onClick={() => navigate('/wallet')}>
              <span className="profile-action-icon deposit-icon">💰</span>
              <span>Deposit</span>
            </button>
            <button className="profile-action-btn" onClick={() => navigate('/wallet')}>
              <span className="profile-action-icon withdraw-icon">💸</span>
              <span>Withdraw</span>
            </button>
            <button className="profile-action-btn" onClick={() => setShowSupport(true)}>
              <span className="profile-action-icon vip-icon">🎧</span>
              <span>Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="profile-menu-list">
        {/* 24/7 Customer Support */}
        <button className="profile-list-item" onClick={() => setShowSupport(true)}>
          <span className="profile-list-icon support-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>🎧</span>
          <span className="profile-list-label" style={{ fontWeight: 700, color: '#22c55e' }}>24/7 Customer Support</span>
          <span className="profile-list-arrow" style={{ marginLeft: 'auto', color: '#22c55e' }}>›</span>
        </button>

        {/* Notification */}
        <button
          className="profile-list-item"
          onClick={() => setShowNotif((v) => !v)}
        >
          <span className="profile-list-icon notif-icon">✉️</span>
          <span className="profile-list-label">Notifications</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {unreadCount > 0 && (
              <span className="profile-notif-badge">{unreadCount}</span>
            )}
            <span className="profile-list-arrow">{showNotif ? '∨' : '›'}</span>
          </div>
        </button>
        {showNotif && (
          <div className="profile-notif-panel">
            {notifications.length === 0 ? (
              <p className="profile-notif-empty">No notifications yet</p>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`profile-notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleNotifClick(n)}
                >
                  <span className="profile-notif-dot" style={{ background: n.read ? '#555' : '#22c55e' }} />
                  <div>
                    <p className="profile-notif-title">{n.title || 'Notification'}</p>
                    <p className="profile-notif-body">{n.body || n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Gifts */}
        <button className="profile-list-item" onClick={() => setShowGifts((v) => !v)}>
          <span className="profile-list-icon gift-icon">🎁</span>
          <span className="profile-list-label">Gifts & Promo Codes</span>
          <span className="profile-list-arrow" style={{ marginLeft: 'auto' }}>
            {showGifts ? '∧' : '∨'}
          </span>
        </button>
        {showGifts && (
          <div className="profile-notif-panel">
            <p className="profile-notif-empty">🎁 Active gifts will appear here. Contact Support for special bonus codes!</p>
          </div>
        )}

        {/* Telegram Official Support */}
        <a
          className="profile-list-item"
          href="https://t.me/61clubsupport"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <span className="profile-list-icon telegram-icon">✈️</span>
          <span className="profile-list-label">Telegram Channel</span>
          <span className="profile-list-arrow" style={{ marginLeft: 'auto' }}>›</span>
        </a>

        {/* KYC */}
        <button className="profile-list-item" onClick={() => navigate('/wallet')}>
          <span className="profile-list-icon kyc-icon">🪪</span>
          <span className="profile-list-label">KYC Verification</span>
          <span
            className="profile-kyc-tag"
            style={{
              background: user.kycStatus === 'Verified' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: user.kycStatus === 'Verified' ? '#22c55e' : '#eab308',
              marginLeft: 'auto',
            }}
          >
            {user.kycStatus}
          </span>
        </button>

        {/* Referral Info */}
        <div className="profile-referral-card">
          <div className="profile-referral-row">
            <span className="profile-referral-icon">👥</span>
            <div>
              <p className="profile-referral-label">Referral Code</p>
              <p className="profile-referral-code">{user.referralCode}</p>
            </div>
            <button
              className="profile-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(user.referralCode);
              }}
            >
              Copy
            </button>
          </div>
          <div className="profile-referral-stats">
            <div className="profile-ref-stat">
              <span className="profile-ref-stat-val">{user.activeReferrals}</span>
              <span className="profile-ref-stat-label">Referrals</span>
            </div>
            <div className="profile-ref-stat">
              <span className="profile-ref-stat-val">₹{user.referralEarnings || 0}</span>
              <span className="profile-ref-stat-label">Earnings</span>
            </div>
            <div className="profile-ref-stat">
              <span className="profile-ref-stat-val" style={{ color: vipColor }}>{user.vipLevel}</span>
              <span className="profile-ref-stat-label">VIP Level</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '0 16px 120px' }}>
        <button className="profile-logout-btn" onClick={logout}>
          🚪 Logout
        </button>
      </div>

      {/* Floating 24/7 Support Button */}
      <button className="floating-support-btn" onClick={() => setShowSupport(true)}>
        <span>🎧</span>
        <span>24/7 Support</span>
      </button>

      {/* Support Modal */}
      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />

      <BottomNav />
    </div>
  );
};

export default Profile;
