const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

router.get('/summary', authMiddleware, async (req, res) => {
  const user = req.user;
  res.json({
    wallet: {
      totalBalance: user.walletBalance,
      bonusAmount: user.bonusBalance,
      winningAmount: user.walletBalance - user.bonusBalance
    }
  });
});

router.post('/deposit', authMiddleware, async (req, res) => {
  const { amount, method } = req.body;
  const user = req.user;
  user.walletBalance += Number(amount);
  await user.save();

  await Transaction.create({
    userId: user._id,
    type: 'deposit',
    amount,
    method,
    status: 'completed',
    reference: `DEP${Date.now()}`
  });

  res.json({ message: 'Deposit successful', balance: user.walletBalance });
});

router.post('/withdraw', authMiddleware, async (req, res) => {
  const { amount, method } = req.body;
  const user = req.user;
  if (user.walletBalance < amount) {
    return res.status(400).json({ message: 'Insufficient balance' });
  }
  user.walletBalance -= Number(amount);
  await user.save();

  await Transaction.create({
    userId: user._id,
    type: 'withdraw',
    amount,
    method,
    status: 'pending',
    reference: `WDR${Date.now()}`
  });

  res.json({ message: 'Withdraw request submitted', balance: user.walletBalance });
});

router.get('/history', authMiddleware, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ transactions });
});

module.exports = router;
