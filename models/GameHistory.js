const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  game: { type: String, required: true, enum: ['colorwin', 'aviator', 'vortex', 'mines', 'diceroll', 'livecoin'] },
  period: { type: String, required: true },
  number: { type: Number, min: 0, max: 9 },
  size: { type: String, enum: ['Big', 'Small', 'Undefined'], default: 'Undefined' },
  color: { type: String, enum: ['🟢', '🔴', '🟣', 'N/A'], default: 'N/A' },
  bet: { type: Number, required: true, min: 1 },
  result: { type: String, enum: ['won', 'lost', 'pending'], default: 'pending' },
  payout: { type: Number, default: 0 },
  multiplier: { type: Number },
  selectedChoice: { type: String },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Index for efficient queries
gameHistorySchema.index({ userId: 1, createdAt: -1 });
gameHistorySchema.index({ game: 1, createdAt: -1 });

module.exports = mongoose.model('GameHistory', gameHistorySchema);

