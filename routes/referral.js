const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Referral = require('../models/Referral');
const User = require('../models/User');

router.get('/', authMiddleware, async (req, res) => {
  const referral = await Referral.findOne({ userId: req.user._id });
  const users = await User.find({ referredBy: req.user.referralCode }).limit(100);
  res.json({
    referral: referral || null,
    totalReferrals: users.length,
    activeReferrals: req.user.activeReferrals,
    teamIncome: req.user.referralEarnings,
    levelPercentages: { level1: 10, level2: 5, level3: 2 }
  });
});

module.exports = router;
