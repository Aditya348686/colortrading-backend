const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  walletBalance: { type: Number, default: 0 },
  bonusBalance: { type: Number, default: 0 },
  vipLevel: { type: String, default: 'Bronze' },
  referralEarnings: { type: Number, default: 0 },
  activeReferrals: { type: Number, default: 0 },
  kycStatus: { type: String, default: 'Pending' },
  profilePhoto: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  hasDeposited: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
