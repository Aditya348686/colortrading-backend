import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Wallet from './pages/Wallet';
import Referral from './pages/Referral';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import ColorWinGame from './pages/Games/ColorWinGame';
import AviatorGame from './pages/Games/AviatorGame';
import MinesGame from './pages/Games/MinesGame';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/referral" element={<ProtectedRoute><Referral /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/game/colorwin" element={<ProtectedRoute><ColorWinGame /></ProtectedRoute>} />
        <Route path="/game/aviator" element={<ProtectedRoute><AviatorGame /></ProtectedRoute>} />
        <Route path="/game/mines" element={<ProtectedRoute><MinesGame /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
