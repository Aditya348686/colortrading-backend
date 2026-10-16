import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { registerUser } from '../../services/authService';
import './Auth.css';

const Register = () => {
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [refLocked, setRefLocked] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auto-read ?ref= from URL
  useEffect(() => {
    const refFromUrl = searchParams.get('ref');
    if (refFromUrl) {
      setReferralCode(refFromUrl);
      setRefLocked(true); // lock field when coming from link
    }
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!agreed) {
      setError('You must agree to the Privacy Agreement to proceed.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (mobile.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    const userEmail = email || `${mobile}@colortrading.com`;
    const userFullName = fullName || `User_${mobile.slice(-4)}`;

    try {
      const { user, token } = await registerUser({
        fullName: userFullName,
        mobile,
        email: userEmail,
        password,
        referralCode: referralCode.trim(),
      });
      localStorage.setItem('ctg_token', token);
      localStorage.setItem('ctg_user', JSON.stringify(user));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Top Header Bar */}
      <div className="auth-header-bar">
        <button className="auth-back-btn" onClick={() => navigate('/login')} title="Back">‹</button>
        <div className="auth-logo">
          <img src="/assets/logo_95club.png" alt="95 CLUB" style={{ width: 28, height: 28, borderRadius: 6 }} />
          <span>95 CLUB</span>
        </div>
        <div className="auth-lang-select"><span>🇮🇳</span><span>IN</span></div>
      </div>

      {/* Sub-header */}
      <div className="auth-subheader-tab">
        <div className="auth-subheader-content"><span>📱</span><span>Register your phone</span></div>
      </div>

      <form className="auth-form-body" onSubmit={handleSubmit}>
        {/* Phone */}
        <div className="auth-field-group">
          <div className="auth-field-label"><span className="auth-label-icon">📱</span><span>Phone number</span></div>
          <div className="auth-phone-input-box">
            <div className="auth-country-code">+91 <span>▾</span></div>
            <input className="auth-input" type="tel" placeholder="Please enter the phone number" value={mobile} onChange={(e) => setMobile(e.target.value)} required disabled={loading} />
          </div>
        </div>

        {/* Password */}
        <div className="auth-field-group">
          <div className="auth-field-label"><span className="auth-label-icon">🔒</span><span>Set password</span></div>
          <div className="auth-input-wrapper">
            <input className="auth-input" type={showPassword ? 'text' : 'password'} placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '👁️' : '🙈'}</button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="auth-field-group">
          <div className="auth-field-label"><span className="auth-label-icon">🔒</span><span>Confirm password</span></div>
          <div className="auth-input-wrapper">
            <input className="auth-input" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
            <button type="button" className="auth-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? '👁️' : '🙈'}</button>
          </div>
        </div>

        {/* Referral / Invite Code */}
        <div className="auth-field-group">
          <div className="auth-field-label">
            <span className="auth-label-icon">🎁</span>
            <span>Invite code</span>
            {refLocked && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>✓ Auto-filled</span>}
          </div>
          <div className="auth-input-wrapper">
            <input
              className="auth-input"
              type="text"
              placeholder="Enter invite code (optional)"
              value={referralCode}
              onChange={(e) => !refLocked && setReferralCode(e.target.value)}
              disabled={loading || refLocked}
              style={refLocked ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700 } : {}}
            />
            {refLocked && (
              <button type="button" onClick={() => { setRefLocked(false); setReferralCode(''); }}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem', padding: '0 8px' }}>✕</button>
            )}
          </div>
        </div>

        {/* Agreement */}
        <div className="auth-agreement-row">
          <div className={`auth-custom-checkbox ${agreed ? 'checked' : ''}`} onClick={() => setAgreed(!agreed)} style={{ cursor: 'pointer' }}>
            {agreed && '✓'}
          </div>
          <span>I have read and agree <span className="auth-privacy-link">【Privacy Agreement】</span></span>
        </div>

        {error && <div className="auth-error-msg">{error}</div>}

        <div className="auth-actions">
          <button className="auth-btn-primary" type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
          <Link to="/login" className="auth-btn-secondary">
            <span>I have an account </span>
            <strong style={{ color: '#22c55e', marginLeft: '4px' }}>Login</strong>
          </Link>
        </div>
      </form>
    </div>
  );
};

export default Register;
