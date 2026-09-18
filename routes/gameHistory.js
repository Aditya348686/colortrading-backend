const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Helper functions for database compatibility
const saveGameRecord = async (userId, gameData) => {
  try {
    // Try MongoDB first
    const GameHistory = require('../models/GameHistory');
    const record = await GameHistory.create({
      userId,
      ...gameData,
      createdAt: new Date()
    });
    return record;
  } catch (err) {
    // Fallback to mock DB
    try {
      return await global.db.gameRecords.create({
        userId,
        ...gameData,
        createdAt: new Date()
      });
    } catch (mockErr) {
      console.log('Both DB methods failed:', mockErr.message);
      throw mockErr;
    }
  }
};

const getGameRecords = async (userId) => {
  try {
    // Try MongoDB first
    const GameHistory = require('../models/GameHistory');
    const records = await GameHistory.find({ userId }).sort({ createdAt: -1 }).limit(50);
    return records;
  } catch (err) {
    // Fallback to mock DB
    try {
      const records = await global.db.gameRecords.findByIdAndSort(userId);
      return records || [];
    } catch (mockErr) {
      console.log('Both DB methods failed:', mockErr.message);
      return [];
    }
  }
};

// Save game record
router.post('/color-win/record', authMiddleware, async (req, res) => {
  try {
    const { period, number, size, color, bet, result, payout } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    const record = await saveGameRecord(userId, {
      game: 'colorwin',
      period,
      number,
      size,
      color,
      bet: parseFloat(bet),
      result,
      payout: parseFloat(payout)
    });

    res.status(201).json({ success: true, record });
  } catch (err) {
    console.log('Error saving record:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get game records
router.get('/color-win/records', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    const records = await getGameRecords(userId);

    res.status(200).json({
      success: true,
      records: records.filter(r => r.game === 'colorwin' || !r.game),
      total: records.length
    });
  } catch (err) {
    console.log('Error fetching records:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all game history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    const records = await getGameRecords(userId);

    res.status(200).json({
      success: true,
      records,
      total: records.length
    });
  } catch (err) {
    console.log('Error fetching history:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
