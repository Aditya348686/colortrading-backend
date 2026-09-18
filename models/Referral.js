const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String, required: true, unique: true },
  link: { type: String, required: true },
  totalReferrals: { type: Number, default: 0 },
  levelOneEarned: { type: Number, default: 0 },
  levelTwoEarned: { type: Number, default: 0 },
  levelThreeEarned: { type: Number, default: 0 },
  activeReferrals: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', referralSchema);
