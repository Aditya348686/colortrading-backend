const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const GameHistory = require('../models/GameHistory');

const sampleGames = [
  { id: 'wingo', name: 'Win Go Lottery', colors: ['Green', 'Red', 'Violet'] },
  { id: 'aviator', name: 'Aviator', description: 'Multiplier flight game' },
  { id: 'vortex', name: 'Vortex Spin', description: 'Rotating jackpot wheel' },
  { id: 'mines', name: 'Mines', description: 'Risk grid cash out' }
];

router.get('/list', authMiddleware, (req, res) => {
  res.json({ games: sampleGames });
});

router.post('/play', authMiddleware, async (req, res) => {
  if (req.user && !req.user.hasDeposited) {
    return res.status(403).json({ message: 'A one-time deposit is required to activate gameplay.' });
  }

  const { gameType, betType, betAmount } = req.body;
  const result = Math.random() > 0.5 ? 'win' : 'lose';
  const payout = result === 'win' ? Number(betAmount) * 1.8 : 0;

  await GameHistory.create({
    userId: req.user._id,
    gameType,
    betType,
    betAmount,
    result,
    payout
  });

  res.json({ result, payout });
});

router.get('/history', authMiddleware, async (req, res) => {
  const history = await GameHistory.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ history });
});

module.exports = router;
