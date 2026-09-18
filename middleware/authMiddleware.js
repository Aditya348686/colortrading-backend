const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    
    try {
      req.user = await User.findById(decoded.id).select('-password');
    } catch (dbError) {
      if (global.db && global.db.users) {
        req.user = await global.db.users.findOne({ _id: decoded.id });
      }
    }

    if (req.user && !req.user.save) {
      req.user.save = async function() { return this; };
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = protect;
