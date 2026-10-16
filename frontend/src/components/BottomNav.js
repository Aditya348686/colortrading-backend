import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="bottom-nav-bar">
      <div className="bottom-nav-container">
        {/* 1. Home */}
        <NavLink to="/" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
          <div className="bnav-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
          <span className="bnav-label">Home</span>
        </NavLink>

        {/* 2. Activity */}
        <NavLink
          to="/wallet?tab=gift"
          className={({ isActive }) => `bnav-item ${location.pathname === '/wallet' && location.search.includes('tab=gift') ? 'active' : ''}`}
        >
          <div className="bnav-icon has-badge">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H7c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.66-1.34 3-3 3z" />
            </svg>
            <span className="bnav-dot" />
          </div>
          <span className="bnav-label">Activity</span>
        </NavLink>

        {/* 3. Promotion (Center Floating Raised Diamond Button) */}
        <NavLink to="/referral" className="bnav-center-item">
          <div className="bnav-floating-btn">
            <div className="bnav-diamond-glow">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <polygon points="12,2 22,8.5 17,21 7,21 2,8.5" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
                <polyline points="2,8.5 12,14 22,8.5" fill="none" stroke="#ffffff" strokeWidth="1.8" />
                <line x1="12" y1="2" x2="12" y2="14" stroke="#ffffff" strokeWidth="1.8" />
                <line x1="7" y1="21" x2="12" y2="14" stroke="#ffffff" strokeWidth="1.8" />
                <line x1="17" y1="21" x2="12" y2="14" stroke="#ffffff" strokeWidth="1.8" />
              </svg>
            </div>
          </div>
          <span className="bnav-label bnav-promo-label">Promotion</span>
        </NavLink>

        {/* 4. Wallet */}
        <NavLink
          to="/wallet"
          className={({ isActive }) => `bnav-item ${isActive && !location.search.includes('tab=gift') ? 'active' : ''}`}
        >
          <div className="bnav-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
          </div>
          <span className="bnav-label">Wallet</span>
        </NavLink>

        {/* 5. Account */}
        <NavLink to="/profile" className={({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`}>
          <div className="bnav-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <span className="bnav-label">Account</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
