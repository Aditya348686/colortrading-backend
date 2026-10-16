import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/authService';
import './Auth.css';

const Login = () => {
  const [activeTab, setActiveTab] = useState('email'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const loginIdentifier = activeTab === 'email' ? email : phone;

    try {
      // Allow login with email or phone number
      const { user, token } = await loginUser({ email: loginIdentifier, password });
      localStorage.setItem('ctg_token', token);
      localStorage.setItem('ctg_user', JSON.stringify(user));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Top Header Bar */}
      <div className="auth-header-bar">
        <button className="auth-back-btn" onClick={() => navigate('/')} title="Back">
          ‹
        </button>
        <div className="auth-logo">
          <img src="/assets/logo_95club.png" alt="95 CLUB" style={{ width: 28, height: 28, borderRadius: 6 }} />
          <span>95 CLUB</span>
        </div>
        <div className="auth-lang-select">
          <span>🇮🇳</span>
          <span>IN</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="auth-hero-banner">
        <h1 className="auth-hero-title">Log in</h1>
        <p className="auth-hero-subtitle">
          Please log in with your phone number or email<br />
          If you forget your password, please contact customer service
        </p>
      </div>

      {/* Tab Selector */}
      <div className="auth-tabs-bar">
        <button
          type="button"
          className={`auth-tab-item ${activeTab === 'phone' ? 'active' : ''}`}
          onClick={() => setActiveTab('phone')}
        >
          <span>📱</span>
          <span>Phone Number</span>
        </button>
        <button
          type="button"
          className={`auth-tab-item ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          <span>✉️</span>
          <span>Email</span>
        </button>
      </div>

      {/* Form Body */}
      <form className="auth-form-body" onSubmit={handleSubmit}>
        {activeTab === 'phone' ? (
          <div className="auth-field-group">
            <div className="auth-field-label">
              <span className="auth-label-icon">📱</span>
              <span>Phone number</span>
            </div>
            <div className="auth-phone-input-box">
              <div className="auth-country-code">
                +91 <span>▾</span>
              </div>
              <input
                className="auth-input"
                type="tel"
                placeholder="Please enter the phone number"
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
              <span>Mail</span>
            </div>
            <div className="auth-input-wrapper">
              <input
                className="auth-input"
                type="email"
                placeholder="please input your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Password Field */}
        <div className="auth-field-group">
          <div className="auth-field-label">
            <span className="auth-label-icon">🔒</span>
            <span>Password</span>
          </div>
          <div className="auth-input-wrapper">
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        {/* Options Row */}
        <div className="auth-options-row">
          <label className="auth-checkbox-label" onClick={() => setRememberPassword(!rememberPassword)}>
            <div className={`auth-custom-checkbox ${rememberPassword ? 'checked' : ''}`}>
              {rememberPassword && '✓'}
            </div>
            <span>Remember password</span>
          </label>
          <Link to="/forgot-password" className="auth-forgot-link">
            Forgot password?
          </Link>
        </div>

        {/* Error Message */}
        {error && <div className="auth-error-msg">{error}</div>}

        {/* Action Buttons */}
        <div className="auth-actions">
          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
          <Link to="/register" className="auth-btn-secondary">
            Register
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Login;
