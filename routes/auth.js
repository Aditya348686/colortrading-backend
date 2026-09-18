const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Referral = require('../models/Referral');
const dotenv = require('dotenv');

dotenv.config();

// Fallback to mock DB if MongoDB not available
const getUser = async (query) => {
  try {
    return await User.findOne(query);
  } catch (e) {
    return await global.db.users.findOne(query);
  }
};

const createUser = async (data) => {
  try {
    return await User.create(data);
  } catch (e) {
    return await global.db.users.create(data);
  }
};

const createReferral = async (data) => {
  try {
    return await Referral.create(data);
  } catch (e) {
    return await global.db.referrals.create(data);
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const getRandomSignupBonus = () => {
  const rand = Math.random();
  if (rand < 0.4) {
    return 25;
  } else if (rand < 0.7) {
    return 26;
  } else {
    return Math.floor(Math.random() * (100 - 27 + 1)) + 27;
  }
};

router.post('/register', async (req, res) => {
  const { fullName, mobile, email, password, referralCode } = req.body;
  try {
    const existing = await getUser({ $or: [{ email }, { mobile }] });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newReferralCode = `CT${Math.floor(100000 + Math.random() * 900000)}`;
    const referredBy = referralCode || null;
    const signupBonus = getRandomSignupBonus();

    const user = await createUser({
      fullName,
      mobile,
      email,
      password: passwordHash,
      referralCode: newReferralCode,
      referredBy,
      walletBalance: signupBonus,
      bonusBalance: 0,
      hasDeposited: false
    });

    await createReferral({
      userId: user._id,
      referralCode: newReferralCode,
      link: `${process.env.REFERRAL_BASE_URL || 'https://example.com'}/register?ref=${newReferralCode}`
    });

    if (referredBy) {
      const sponsor = await getUser({ referralCode: referredBy });
      if (sponsor) {
        sponsor.referralEarnings += 10;
        sponsor.activeReferrals += 1;
        if (sponsor.save) await sponsor.save();
      }
    }

    res.status(201).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance,
        vipLevel: user.vipLevel,
        hasDeposited: user.hasDeposited || false
      },
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await getUser({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    res.json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        referralCode: user.referralCode,
        walletBalance: user.walletBalance,
        vipLevel: user.vipLevel,
        hasDeposited: user.hasDeposited || false
      },
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await getUser({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Password reset instruction would be sent via email in production.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
