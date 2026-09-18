const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const GameHistory = require('../models/GameHistory');

// Helper: try MongoDB, fall back to mockDB
const tryMongo = async (fn, fallback) => {
  try {
    return await fn();
  } catch (e) {
    return fallback ? fallback() : null;
  }
};

// GET /api/admin/dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const totalUsers = await tryMongo(
      () => User.countDocuments(),
      () => global.db?.users?.countDocuments()
    ) || 0;

    const activeUsers = await tryMongo(
      () => User.countDocuments({ walletBalance: { $gt: 0 } }),
      () => 0
    ) || 0;

    const depositAgg = await tryMongo(
      () => Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      () => []
    ) || [];

    const withdrawAgg = await tryMongo(
      () => Transaction.aggregate([
        { $match: { type: 'withdraw' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      () => []
    ) || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDepAgg = await tryMongo(
      () => Transaction.aggregate([
        { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      () => []
    ) || [];

    const todayWdAgg = await tryMongo(
      () => Transaction.aggregate([
        { $match: { type: 'withdraw', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      () => []
    ) || [];

    const totalDeposits = depositAgg[0]?.total || 0;
    const totalWithdrawals = withdrawAgg[0]?.total || 0;
    const totalRevenue = totalDeposits - totalWithdrawals;

    res.json({
      totalUsers,
      activeUsers,
      totalDeposits,
      totalWithdrawals,
      totalRevenue,
      todayDeposits: todayDepAgg[0]?.total || 0,
      todayWithdrawals: todayWdAgg[0]?.total || 0,
      recentGames: await tryMongo(
        () => GameHistory.find().sort({ createdAt: -1 }).limit(10),
        () => []
      ) || []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await tryMongo(
      () => User.find().select('-password').sort({ createdAt: -1 }).limit(100),
      () => global.db?.users?.find()
    ) || [];
    res.json({ users });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/admin/ban-user
router.post('/ban-user', authMiddleware, async (req, res) => {
  try {
    const { userId, banned } = req.body;
    await tryMongo(
      () => User.findByIdAndUpdate(userId, { banned }),
      () => {}
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/admin/edit-wallet
router.post('/edit-wallet', authMiddleware, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    await tryMongo(
      () => User.findByIdAndUpdate(userId, { walletBalance: Number(amount) }),
      () => {}
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/admin/transactions
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await tryMongo(
      () => Transaction.find(query).sort({ createdAt: -1 }).limit(200),
      () => []
    ) || [];
    res.json({ transactions });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/admin/approve-withdrawal
router.post('/approve-withdrawal', authMiddleware, async (req, res) => {
  try {
    const { txId } = req.body;
    await tryMongo(
      () => Transaction.findByIdAndUpdate(txId, { status: 'approved' }),
      () => {}
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/admin/reject-withdrawal
router.post('/reject-withdrawal', authMiddleware, async (req, res) => {
  try {
    const { txId } = req.body;
    await tryMongo(
      () => Transaction.findByIdAndUpdate(txId, { status: 'rejected' }),
      () => {}
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/admin/delete-user
router.delete('/delete-user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    await tryMongo(
      () => User.findByIdAndDelete(userId),
      () => {}
    );
    // Also clean up their transactions
    await tryMongo(
      () => Transaction.deleteMany({ userId }),
      () => {}
    );
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
