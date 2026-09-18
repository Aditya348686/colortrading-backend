const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalBalance: { type: Number, default: 0 },
  winningAmount: { type: Number, default: 0 },
  bonusAmount: { type: Number, default: 0 },
  depositAmount: { type: Number, default: 0 },
  withdrawAmount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Wallet', walletSchema);
