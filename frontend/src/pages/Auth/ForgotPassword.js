import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendResetOtp, resetPasswordWithOtp } from '../../services/authService';
import './Auth.css';

const ForgotPassword = () => {
  const [activeTab, setActiveTab] = useState('phone'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [userOtp, setUserOtp] = useState('');
  const [userId, setUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const navigate = useNavigate();

  // Cooldown timer effect
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setSuccessMsg('');
    const identifier = activeTab === 'phone' ? phone.trim() : email.trim();

    if (!identifier) {
      setError(`Please enter your ${activeTab === 'phone' ? 'phone number' : 'email'}`);
      return;
    }

    setLoading(true);
    try {
      const res = await sendResetOtp(identifier);
      if (res.userId) setUserId(res.userId);
      setOtpSent(true);
      setCooldown(60);
      setSuccessMsg(`Verification code sent to ${identifier}. Please check your phone/email.`);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const identifier = activeTab === 'phone' ? phone.trim() : email.trim();

    if (!userOtp || userOtp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP code sent to your phone/email.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithOtp({
        identifier,
        userId,
        userEnteredOtp: userOtp.trim(),
        newPassword
      });
      setSuccessMsg('✅ Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Top Header Bar */}
      <div className="auth-header-bar">
        <button className="auth-back-btn" onClick={() => navigate('/login')} title="Back to Login">
          ‹
        </button>
        <div className="auth-logo">
          <span className="auth-logo-badge">🎰</span>
          <span>VEER.GAME</span>
        </div>
        <div className="auth-lang-select">
          <span>🇺🇸</span>
          <span>EN</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="auth-hero-banner">
        <h1 className="auth-hero-title">Forgot Password</h1>
        <p className="auth-hero-subtitle">
          Enter your registered phone number or email to receive a 6-digit verification code.
        </p>
      </div>

      {/* Tab Selector (only active before OTP sent) */}
      {!otpSent && (
        <div className="auth-tabs-bar">
          <button
            type="button"
            className={`auth-tab-item ${activeTab === 'phone' ? 'active' : ''}`}
            onClick={() => { setActiveTab('phone'); setError(''); }}
          >
            <span>📱</span>
            <span>Phone Number</span>
          </button>
          <button
            type="button"
            className={`auth-tab-item ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => { setActiveTab('email'); setError(''); }}
          >
            <span>✉️</span>
            <span>Email</span>
          </button>
        </div>
      )}

      {/* Form Body */}
      <div className="auth-form-body">
        {/* Step 1: Send OTP Form */}
        {!otpSent ? (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {activeTab === 'phone' ? (
              <div className="auth-field-group">
                <div className="auth-field-label">
                  <span className="auth-label-icon">📱</span>
                  <span>Phone number</span>
                </div>
                <div className="auth-phone-input-box">
                  <div className="auth-country-code">+91 <span>▾</span></div>
                  <input
                    className="auth-input"
                    type="tel"
                    placeholder="Enter registered phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            ) : (
              <div className="auth-field-group">
                <div className="auth-field-label">
                  <span className="auth-label-icon">✉️</span>
                  <span>Email</span>
                </div>
                <div className="auth-input-wrapper">
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="Enter registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {error && <div className="auth-error-msg">{error}</div>}

            <div className="auth-actions">
              <button className="auth-btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
              <Link to="/login" className="auth-btn-secondary">
                Back to Login
              </Link>
            </div>
          </form>
        ) : (
          /* Step 2: OTP Verification & Reset Password Form */
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Target identifier info card */}
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#8899cc', fontWeight: 600 }}>OTP Sent To</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#22c55e', marginTop: 2 }}>
                  {activeTab === 'phone' ? `+91 ${phone}` : email}
                </div>
              </div>
              <button type="button" onClick={() => { setOtpSent(false); setError(''); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>
                Change
              </button>
            </div>

            {/* Verification Code Input */}
            <div className="auth-field-group">
              <div className="auth-field-label">
                <span className="auth-label-icon">🔢</span>
                <span>Verification OTP Code</span>
              </div>
              <div className="auth-input-wrapper">
                <input
                  className="auth-input"
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={userOtp}
                  onChange={(e) => setUserOtp(e.target.value)}
                  required
                  disabled={loading}
                  style={{ letterSpacing: 3, fontWeight: 700, fontSize: '1.05rem' }}
                />
                <button
                  type="button"
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  style={{ position: 'absolute', right: 8, background: cooldown > 0 ? 'none' : '#22c55e', color: cooldown > 0 ? '#64748b' : '#0b130e', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}
                >
                  {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend OTP'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="auth-field-group">
              <div className="auth-field-label">
                <span className="auth-label-icon">🔒</span>
                <span>New Password</span>
              </div>
              <div className="auth-input-wrapper">
                <input
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="auth-field-group">
              <div className="auth-field-label">
                <span className="auth-label-icon">🔒</span>
                <span>Confirm New Password</span>
              </div>
              <div className="auth-input-wrapper">
                <input
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && <div className="auth-error-msg">{error}</div>}
            {successMsg && (
              <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '10px 14px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700 }}>
                {successMsg}
              </div>
            )}

            <div className="auth-actions">
              <button className="auth-btn-primary" type="submit" disabled={loading}>
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
              <button
                type="button"
                className="auth-btn-secondary"
                onClick={() => { setOtpSent(false); setError(''); setSuccessMsg(''); }}
              >
                Back / Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;

