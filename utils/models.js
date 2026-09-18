// Wrapper models that work with both MongoDB and mock database
const mongoose = require('mongoose');

const getModels = () => {
  // Try to use Mongoose models if MongoDB is connected
  try {
    const User = require('../models/User');
    const Referral = require('../models/Referral');
    const Transaction = require('../models/Transaction');
    const GameHistory = require('../models/GameHistory');
    return { User, Referral, Transaction, GameHistory, isMongo: true };
  } catch (e) {
    // Fall back to mock DB
    return {
      User: global.db.users,
      Referral: global.db.referrals,
      Transaction: global.db.transactions,
      GameHistory: global.db.gameHistory,
      isMongo: false
    };
  }
};

module.exports = getModels;
