import { db, ref, set, get, update, push } from '../firebaseConfig';

// Simple hash
const simpleHash = (str) => btoa(unescape(encodeURIComponent(str + '_ctg_salt_2024')));
const verifyHash = (str, hash) => simpleHash(str) === hash;

const generateId = () => Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
const generateReferralCode = () => `CT${Math.floor(100000 + Math.random() * 900000)}`;
const generateToken = (userId) => btoa(JSON.stringify({ id: userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));

const getRandomSignupBonus = () => {
  const rand = Math.random();
  if (rand < 0.4) return 25;
  else if (rand < 0.7) return 26;
  else return Math.floor(Math.random() * (100 - 27 + 1)) + 27;
};

// ─── Commission rates per level ──────────────────────────────────────────────
export const REFERRAL_COMMISSION = { level1: 0.10, level2: 0.05, level3: 0.02 };

// ─── Pay referral commission on bet ──────────────────────────────────────────
// Called whenever a user places a bet. Walks up L1→L2→L3 sponsors.
export const payReferralCommission = async (bettorUserId, betAmount) => {
  try {
    const bettorSnap = await get(ref(db, `users/${bettorUserId}`));
    if (!bettorSnap.exists()) return;
    const bettor = bettorSnap.val();

    const allSnap = await get(ref(db, 'users'));
    const allUsers = allSnap.val() || {};

    const levels = [
      { sponsorCode: bettor.referredBy, rate: REFERRAL_COMMISSION.level1, level: 1 },
    ];

    // Find L1 sponsor to get L2
    if (bettor.referredBy) {
      const l1Entry = Object.entries(allUsers).find(([, u]) => u.referralCode === bettor.referredBy);
      if (l1Entry) {
        const [, l1User] = l1Entry;
        if (l1User.referredBy) {
          levels.push({ sponsorCode: l1User.referredBy, rate: REFERRAL_COMMISSION.level2, level: 2 });
          // Find L2 sponsor to get L3
          const l2Entry = Object.entries(allUsers).find(([, u]) => u.referralCode === l1User.referredBy);
          if (l2Entry) {
            const [, l2User] = l2Entry;
            if (l2User.referredBy) {
              levels.push({ sponsorCode: l2User.referredBy, rate: REFERRAL_COMMISSION.level3, level: 3 });
            }
          }
        }
      }
    }

    // Pay each sponsor
    for (const { sponsorCode, rate } of levels) {
      if (!sponsorCode) continue;
      const sponsorEntry = Object.entries(allUsers).find(([, u]) => u.referralCode === sponsorCode);
      if (!sponsorEntry) continue;
      const [sponsorId, sponsorData] = sponsorEntry;
      const commission = Number((betAmount * rate).toFixed(2));
      if (commission <= 0) continue;

      const newBal = Number(((sponsorData.walletBalance || 0) + commission).toFixed(2));
      const newEarnings = Number(((sponsorData.referralEarnings || 0) + commission).toFixed(2));
      await update(ref(db, `users/${sponsorId}`), {
        walletBalance: newBal,
        referralEarnings: newEarnings,
      });

      // Log commission transaction
      const txRef = push(ref(db, `transactions/${sponsorId}`));
      await set(txRef, {
        type: 'commission',
        amount: commission,
        method: `L${levels.indexOf({ sponsorCode, rate }) + 1} Referral`,
        status: 'completed',
        from: bettorUserId,
        betAmount,
        rate: `${(rate * 100).toFixed(0)}%`,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.error('[Referral Commission Error]', err);
  }
};

// ─── Register ──────────────────────────────────────────────────────────────────
export const registerUser = async ({ fullName, mobile, email, password, referralCode }) => {
  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.val() || {};

  // Check duplicate
  const existingUser = Object.values(usersData).find((u) => u.email === email || u.mobile === mobile);
  if (existingUser) throw new Error('User with this email or mobile already exists');

  const userId = generateId();
  const newReferralCode = generateReferralCode();
  const passwordHash = simpleHash(password);
  const signupBonus = getRandomSignupBonus();

  const userData = {
    fullName,
    mobile,
    email,
    password: passwordHash,
    referralCode: newReferralCode,
    referredBy: referralCode || null,
    walletBalance: signupBonus,
    bonusBalance: 0,
    vipLevel: 'Bronze',
    referralEarnings: 0,
    activeReferrals: 0,
    totalGameplay: 0,
    kycStatus: 'Pending',
    profilePhoto: '',
    role: 'user',
    banned: false,
    hasDeposited: false,
    createdAt: Date.now(),
  };

  await set(ref(db, `users/${userId}`), userData);

  // ── Handle Referral ──
  if (referralCode && referralCode.trim()) {
    const sponsor = Object.entries(usersData).find(([, u]) => u.referralCode === referralCode.trim());
    if (sponsor) {
      const [sponsorId, sponsorData] = sponsor;

      // Give instant ₹10 signup bonus to sponsor
      const SIGNUP_BONUS = 10;
      const newBal = Number(((sponsorData.walletBalance || 0) + SIGNUP_BONUS).toFixed(2));
      const newEarnings = Number(((sponsorData.referralEarnings || 0) + SIGNUP_BONUS).toFixed(2));
      const newReferrals = (sponsorData.activeReferrals || 0) + 1;

      await update(ref(db, `users/${sponsorId}`), {
        walletBalance: newBal,
        referralEarnings: newEarnings,
        activeReferrals: newReferrals,
      });

      // Log signup bonus as transaction
      const txRef = push(ref(db, `transactions/${sponsorId}`));
      await set(txRef, {
        type: 'commission',
        amount: SIGNUP_BONUS,
        method: 'L1 Referral (Signup)',
        status: 'completed',
        from: userId,
        createdAt: Date.now(),
      });

      // Also save referral record under sponsor for team list
      const rRef = push(ref(db, `referrals/${sponsorId}/team`));
      await set(rRef, {
        userId,
        fullName,
        mobile: mobile.slice(0, 5) + '*****',
        joinedAt: Date.now(),
        level: 1,
        totalBets: 0,
        totalCommission: 0,
      });
    }
  }

  // Update stats
  const statsSnap = await get(ref(db, 'stats/totalUsers'));
  const currentCount = statsSnap.val() || 0;
  await set(ref(db, 'stats/totalUsers'), currentCount + 1);

  const token = generateToken(userId);
  const publicUser = {
    id: userId, fullName, email, mobile,
    referralCode: newReferralCode,
    walletBalance: signupBonus,
    bonusBalance: 0,
    vipLevel: 'Bronze',
    role: 'user',
    hasDeposited: false,
    referralEarnings: 0,
    activeReferrals: 0,
  };

  return { user: publicUser, token };
};

// ─── Login ─────────────────────────────────────────────────────────────────────
export const loginUser = async ({ email, password }) => {
  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.val() || {};

  // Support login by email OR mobile
  const entry = Object.entries(usersData).find(([, u]) => u.email === email || u.mobile === email);
  if (!entry) throw new Error('No account found with this email/mobile');

  const [userId, userData] = entry;
  if (!verifyHash(password, userData.password)) throw new Error('Incorrect password');
  if (userData.banned) throw new Error('Your account has been banned. Contact support.');

  const token = generateToken(userId);
  const publicUser = {
    id: userId,
    fullName: userData.fullName,
    email: userData.email,
    mobile: userData.mobile,
    referralCode: userData.referralCode,
    walletBalance: userData.walletBalance || 0,
    bonusBalance: userData.bonusBalance || 0,
    vipLevel: userData.vipLevel || 'Bronze',
    kycStatus: userData.kycStatus || 'Pending',
    profilePhoto: userData.profilePhoto || '',
    activeReferrals: userData.activeReferrals || 0,
    referralEarnings: userData.referralEarnings || 0,
    role: userData.role || 'user',
    hasDeposited: userData.hasDeposited || false,
    totalGameplay: userData.totalGameplay || 0,
  };

  return { user: publicUser, token };
};

// ─── Get current user ─────────────────────────────────────────────────────────
export const getCurrentUser = () => {
  try {
    const token = localStorage.getItem('ctg_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      localStorage.removeItem('ctg_token');
      localStorage.removeItem('ctg_user');
      return null;
    }
    return payload;
  } catch { return null; }
};

// ─── Send Reset OTP ────────────────────────────────────────────────────────────
export const sendResetOtp = async (identifier) => {
  const cleanIdent = identifier.trim();

  // Try backend first
  try {
    const isEmail = cleanIdent.includes('@');
    const res = await axios.post('/api/auth/send-otp', isEmail ? { email: cleanIdent } : { mobile: cleanIdent });
    if (res.data?.success) {
      return { success: true, identifier: cleanIdent, message: res.data.message };
    }
  } catch (backendErr) {
    if (backendErr.response?.data?.message) {
      throw new Error(backendErr.response.data.message);
    }
  }

  // Firebase fallback
  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.val() || {};

  const entry = Object.entries(usersData).find(([, u]) => u.email === cleanIdent || u.mobile === cleanIdent);

  if (!entry) {
    throw new Error('No account found with this phone number or email.');
  }

  const [userId] = entry;
  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Save OTP to Firebase RTDB under otps node
  await set(ref(db, `otps/${userId}`), {
    otp: generatedOtp,
    expiresAt,
    identifier: cleanIdent,
    createdAt: Date.now()
  });

  return {
    success: true,
    userId,
    identifier: cleanIdent,
    message: `Verification code sent to ${cleanIdent}`,
  };
};

// ─── Reset Password with OTP Verification ──────────────────────────────────────
export const resetPasswordWithOtp = async ({ identifier, userId, userEnteredOtp, newPassword }) => {
  const cleanIdent = identifier ? identifier.trim() : '';

  // Try backend reset-password first
  try {
    const isEmail = cleanIdent.includes('@');
    const payload = isEmail
      ? { email: cleanIdent, otp: userEnteredOtp, newPassword }
      : { mobile: cleanIdent, otp: userEnteredOtp, newPassword };
    const res = await axios.post('/api/auth/reset-password', payload);
    if (res.data?.success) {
      return { success: true, message: res.data.message };
    }
  } catch (backendErr) {
    if (backendErr.response?.data?.message && !backendErr.response.data.message.includes('404')) {
      throw new Error(backendErr.response.data.message);
    }
  }

  // Firebase fallback validation
  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.val() || {};
  let targetId = userId;

  if (!targetId && cleanIdent) {
    const entry = Object.entries(usersData).find(([, u]) => u.email === cleanIdent || u.mobile === cleanIdent);
    if (entry) targetId = entry[0];
  }

  if (!targetId) throw new Error('User not found');

  // Verify OTP from Firebase RTDB
  const otpSnap = await get(ref(db, `otps/${targetId}`));
  if (!otpSnap.exists()) {
    throw new Error('OTP expired or not requested. Please request a new code.');
  }

  const otpRecord = otpSnap.val();
  if (Date.now() > otpRecord.expiresAt) {
    await set(ref(db, `otps/${targetId}`), null);
    throw new Error('OTP code has expired. Please request a new code.');
  }

  if (otpRecord.otp !== userEnteredOtp.trim()) {
    throw new Error('Invalid OTP code. Please enter the correct code.');
  }

  // Password update
  const passwordHash = simpleHash(newPassword);
  await update(ref(db, `users/${targetId}`), { password: passwordHash });

  // Delete used OTP
  await set(ref(db, `otps/${targetId}`), null);

  return { success: true, message: 'Password updated successfully!' };
};


