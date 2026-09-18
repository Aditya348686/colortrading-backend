const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mockDB = require('./mockDB');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const referralRoutes = require('./routes/referral');
const gameRoutes = require('./routes/games');
const gameHistoryRoutes = require('./routes/gameHistory');
const adminRoutes = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');

dotenv.config();
const app = express();

// Global database reference
global.db = mockDB;
let usingMongoDB = false;

connectDB().then((connected) => {
  usingMongoDB = connected;
  if (!usingMongoDB) {
    console.log('Running in mock database mode');
    global.db = mockDB;
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/game-history', gameHistoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentsRoutes);

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Color Trading Gaming API running', database: usingMongoDB ? 'MongoDB' : 'Mock' });
});

// Serve frontend static build files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);

  // Start the background game timers
  try {
    const { startTimers } = require('./utils/gameTimer');
    startTimers();
  } catch (err) {
    console.error('Error starting game timers:', err.message);
  }
});

