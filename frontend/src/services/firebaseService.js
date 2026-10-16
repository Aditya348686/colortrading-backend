import { db, ref, set, get, onValue, update, push, remove, serverTimestamp } from '../firebaseConfig';

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export const getUserProfile = (userId, callback) =>
  onValue(ref(db, `users/${userId}`), (snap) => callback(snap.val()));

export const updateUserProfile = (userId, data) =>
  update(ref(db, `users/${userId}`), { ...data, updatedAt: serverTimestamp() });

export const saveUserToFirebase = async (userId, userData) =>
  set(ref(db, `users/${userId}`), { ...userData, updatedAt: serverTimestamp() });

export const getUserFromFirebase = async (userId) => {
  const snap = await get(ref(db, `users/${userId}`));
  return snap.val();
};

// ─── WALLET ───────────────────────────────────────────────────────────────────
export const getWalletBalance = (userId, callback) =>
  onValue(ref(db, `users/${userId}/walletBalance`), (snap) => callback(snap.val()));

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
export const addTransaction = (userId, txData) => {
  const txRef = push(ref(db, `transactions/${userId}`));
  return set(txRef, { ...txData, createdAt: serverTimestamp() });
};

export const getTransactions = (userId, callback) =>
  onValue(ref(db, `transactions/${userId}`), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).reverse() : []);
  });

// ─── GAME HISTORY ─────────────────────────────────────────────────────────────
export const addGameHistory = (userId, gameData) => {
  const gRef = push(ref(db, `gameHistory/${userId}`));
  return set(gRef, { ...gameData, createdAt: serverTimestamp() });
};

export const getGameHistory = (userId, callback) =>
  onValue(ref(db, `gameHistory/${userId}`), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).reverse() : []);
  });

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────
export const getDashboardStats = (callback) =>
  onValue(ref(db, 'stats'), (snap) => callback(snap.val() || {}));

export const updateDashboardStats = (data) =>
  update(ref(db, 'stats'), { ...data, updatedAt: serverTimestamp() });

// Aggregate real user data for stats
export const getAdminDashboard = (callback) => {
  const subs = [];
  let users = [], onlineMap = {}, bets = [], deposits = [], withdrawals = [];

  const notify = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const todayDeps = deposits.filter(d => d.createdAt > todayTs);
    const todayWithds = withdrawals.filter(w => w.createdAt > todayTs && w.status === 'approved');
    const todayDepAmt = todayDeps.reduce((s, d) => s + (d.amount || 0), 0);
    const todayWithdAmt = todayWithds.reduce((s, w) => s + (w.amount || 0), 0);
    const revenue = todayDepAmt - todayWithdAmt;
    const pendingBets = bets.filter(b => b.status === 'pending');
    const totalWallet = users.reduce((s, u) => s + (u.walletBalance || 0), 0);

    callback({
      totalUsers: users.length,
      onlineUsers: Object.keys(onlineMap).length,
      todayDeposits: todayDepAmt.toFixed(2),
      todayWithdrawals: todayWithdAmt.toFixed(2),
      revenue: revenue.toFixed(2),
      activeBets: pendingBets.length,
      totalWalletBalance: totalWallet.toFixed(2),
      bannedUsers: users.filter(u => u.banned).length,
    });
  };

  subs.push(onValue(ref(db, 'users'), (snap) => {
    const d = snap.val() || {};
    users = Object.entries(d).map(([id, v]) => ({ id, ...v }));
    notify();
  }));

  subs.push(onValue(ref(db, 'online'), (snap) => {
    onlineMap = snap.val() || {};
    notify();
  }));

  subs.push(onValue(ref(db, 'deposits'), (snap) => {
    const d = snap.val() || {};
    deposits = Object.values(d);
    notify();
  }));

  subs.push(onValue(ref(db, 'withdrawals'), (snap) => {
    const d = snap.val() || {};
    withdrawals = Object.values(d);
    notify();
  }));

  // All user bets
  subs.push(onValue(ref(db, 'bets'), (snap) => {
    const d = snap.val() || {};
    bets = [];
    Object.values(d).forEach(userBets => {
      if (userBets.wingo) bets.push(...Object.values(userBets.wingo));
      if (userBets.aviator) bets.push(...Object.values(userBets.aviator));
      if (userBets.mines) bets.push(...Object.values(userBets.mines));
    });
    notify();
  }));

  return () => subs.forEach(u => u());
};

// ─── ADMIN: ALL USERS ─────────────────────────────────────────────────────────
export const getAllUsers = (callback) =>
  onValue(ref(db, 'users'), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })) : []);
  });

export const banUser = (userId, banned) =>
  update(ref(db, `users/${userId}`), { banned, updatedAt: serverTimestamp() });

export const editUserWallet = (userId, amount) =>
  update(ref(db, `users/${userId}`), { walletBalance: Number(amount), updatedAt: serverTimestamp() });

export const deleteUser = (userId) => remove(ref(db, `users/${userId}`));

export const sendNotifToUser = (userId, message, type = 'info') => {
  const nRef = push(ref(db, `notifications/${userId}`));
  return set(nRef, { message, type, read: false, createdAt: Date.now() });
};

// ─── ADMIN: GAME CONTROL ──────────────────────────────────────────────────────
// WinGo
export const setWinGoResult = (period, result) =>
  set(ref(db, `gameControl/wingo/results/${period}`), { result, setAt: Date.now() });

export const setWinGoNextResult = (result) => {
  if (result === null || result === undefined) {
    return remove(ref(db, 'gameControl/wingo/nextResult'));
  }
  return set(ref(db, 'gameControl/wingo/nextResult'), { result: Number(result), setAt: Date.now() });
};

export const getWinGoControl = (callback) =>
  onValue(ref(db, 'gameControl/wingo'), (snap) => callback(snap.val() || {}));

export const getWinGoResults = (period, callback) =>
  onValue(ref(db, `wingoResults/${period}`), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.timestamp - a.timestamp) : []);
  });

export const getAllBets = (callback) =>
  onValue(ref(db, 'bets'), (snap) => {
    const d = snap.val() || {};
    const allBets = [];
    Object.entries(d).forEach(([uid, games]) => {
      if (games.wingo) Object.entries(games.wingo).forEach(([bid, b]) => allBets.push({ id: bid, userId: uid, game: 'wingo', ...b }));
      if (games.aviator) Object.entries(games.aviator).forEach(([bid, b]) => allBets.push({ id: bid, userId: uid, game: 'aviator', ...b }));
      if (games.mines) Object.entries(games.mines).forEach(([bid, b]) => allBets.push({ id: bid, userId: uid, game: 'mines', ...b }));
    });
    allBets.sort((a, b) => b.placedAt - a.placedAt);
    callback(allBets);
  });

// Aviator
export const setAviatorRTP = (rtp) =>
  update(ref(db, 'gameControl/aviator'), { rtp, updatedAt: Date.now() });

export const setAviatorMultiplier = (multiplier) =>
  update(ref(db, 'gameControl/aviator'), { forceMultiplier: multiplier, updatedAt: Date.now() });

export const getAviatorControl = (callback) =>
  onValue(ref(db, 'gameControl/aviator'), (snap) => callback(snap.val() || { rtp: 95, forceMultiplier: null }));

// Mines
export const setMinesProbability = (probability) =>
  update(ref(db, 'gameControl/mines'), { probability, updatedAt: Date.now() });

export const getMinesControl = (callback) =>
  onValue(ref(db, 'gameControl/mines'), (snap) => callback(snap.val() || { probability: 25 }));

// ─── ADMIN: DEPOSITS / WITHDRAWALS ────────────────────────────────────────────
export const getAllDeposits = (callback) =>
  onValue(ref(db, 'deposits'), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : []);
  });

export const addDeposit = async (userId, data) => {
  const dRef = push(ref(db, 'deposits'));
  const depId = dRef.key;
  const txRef = push(ref(db, `transactions/${userId}`));
  await set(txRef, {
    type: 'deposit',
    amount: data.amount,
    method: data.method || 'UPI',
    status: data.status || 'pending',
    reference: depId,
    createdAt: Date.now()
  });
  await set(dRef, { id: depId, userId, ...data, status: data.status || 'pending', createdAt: Date.now() });
  return depId;
};

export const approveDeposit = async (depositId, userId, amount) => {
  await update(ref(db, `deposits/${depositId}`), { status: 'approved', processedAt: Date.now() });
  if (userId) {
    const txsSnap = await get(ref(db, `transactions/${userId}`));
    if (txsSnap.exists()) {
      const txs = txsSnap.val();
      Object.entries(txs).forEach(([txId, tx]) => {
        if (tx.reference === depositId || (tx.type === 'deposit' && tx.status === 'pending' && Math.abs((tx.amount || 0) - amount) < 0.01)) {
          update(ref(db, `transactions/${userId}/${txId}`), { status: 'completed', processedAt: Date.now() });
        }
      });
    }
  }
  const snap = await get(ref(db, `users/${userId}/walletBalance`));
  const cur = snap.val() || 0;
  const netAmount = Number((amount * 0.98).toFixed(2));
  await update(ref(db, `users/${userId}`), { walletBalance: Number((cur + netAmount).toFixed(2)), hasDeposited: true });
  const statsSnap = await get(ref(db, 'stats/todayDeposits'));
  const curDep = statsSnap.val() || 0;
  await set(ref(db, 'stats/todayDeposits'), Number((curDep + amount).toFixed(2)));
};

export const rejectDeposit = async (depositId, userId) => {
  await update(ref(db, `deposits/${depositId}`), { status: 'rejected', processedAt: Date.now() });
  if (userId) {
    const txsSnap = await get(ref(db, `transactions/${userId}`));
    if (txsSnap.exists()) {
      const txs = txsSnap.val();
      Object.entries(txs).forEach(([txId, tx]) => {
        if (tx.reference === depositId || (tx.type === 'deposit' && tx.status === 'pending')) {
          update(ref(db, `transactions/${userId}/${txId}`), { status: 'rejected', processedAt: Date.now() });
        }
      });
    }
  }
};

export const getAllWithdrawals = (callback) =>
  onValue(ref(db, 'withdrawals'), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : []);
  });

export const getUserWithdrawals = (userId, callback) =>
  onValue(ref(db, 'withdrawals'), (snap) => {
    const d = snap.val();
    if (!d) {
      callback([]);
      return;
    }
    const list = Object.entries(d)
      .map(([id, v]) => ({ id, ...v }))
      .filter((w) => w.userId === userId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });

export const approveWithdrawal = async (wid, userId, amount) => {
  await update(ref(db, `withdrawals/${wid}`), { status: 'approved', processedAt: Date.now() });

  // Update stats
  if (amount) {
    const statsSnap = await get(ref(db, 'stats/todayWithdrawals'));
    const curWithd = Number(statsSnap.val()) || 0;
    await set(ref(db, 'stats/todayWithdrawals'), Number((curWithd + Number(amount)).toFixed(2)));
  }

  // Update user transactions
  if (userId) {
    const txsSnap = await get(ref(db, `transactions/${userId}`));
    if (txsSnap.exists()) {
      const txs = txsSnap.val();
      Object.entries(txs).forEach(([txId, tx]) => {
        if (
          tx.reference === wid ||
          tx.withdrawalId === wid ||
          txId === wid ||
          (tx.type === 'withdraw' && tx.status === 'pending' && (!amount || Math.abs((tx.amount || 0) - amount) < 0.01))
        ) {
          update(ref(db, `transactions/${userId}/${txId}`), { status: 'completed', processedAt: Date.now() });
        }
      });
    }
  }
};

export const rejectWithdrawal = async (wid) => {
  const wSnap = await get(ref(db, `withdrawals/${wid}`));
  const wData = wSnap.val();
  if (wData && wData.status === 'pending') {
    await update(ref(db, `withdrawals/${wid}`), { status: 'rejected', processedAt: Date.now() });
    const { userId, amount } = wData;
    if (userId) {
      // Refund balance
      const uSnap = await get(ref(db, `users/${userId}/walletBalance`));
      const curBal = Number(uSnap.val()) || 0;
      await update(ref(db, `users/${userId}`), { walletBalance: Number((curBal + Number(amount)).toFixed(2)) });

      // Update user transactions
      const txsSnap = await get(ref(db, `transactions/${userId}`));
      if (txsSnap.exists()) {
        const txs = txsSnap.val();
        Object.entries(txs).forEach(([txId, tx]) => {
          if (
            tx.reference === wid ||
            tx.withdrawalId === wid ||
            txId === wid ||
            (tx.type === 'withdraw' && tx.status === 'pending')
          ) {
            update(ref(db, `transactions/${userId}/${txId}`), { status: 'rejected', processedAt: Date.now() });
          }
        });
      }
    }
  }
};

export const addWithdrawal = async (userId, data) => {
  const wRef = push(ref(db, 'withdrawals'));
  const wid = wRef.key;
  const withdrawalRecord = {
    id: wid,
    userId,
    ...data,
    status: data.status || 'pending',
    createdAt: Date.now()
  };
  await set(wRef, withdrawalRecord);

  // Synchronously add transaction entry to user's transactions node with matching reference
  const txRef = push(ref(db, `transactions/${userId}`));
  await set(txRef, {
    id: txRef.key,
    type: 'withdraw',
    amount: Number(data.amount),
    method: data.method || 'Bank',
    status: 'pending',
    reference: wid,
    withdrawalId: wid,
    bankAccount: data.bankAccount || '',
    bankName: data.bankName || '',
    accountHolder: data.accountHolder || '',
    ifsc: data.ifsc || data.ifscCode || '',
    mobile: data.mobile || '',
    upiId: data.upiId || '',
    createdAt: Date.now()
  });

  return wid;
};

// ─── USER BANK DETAILS ────────────────────────────────────────────────────────
export const saveUserBankDetails = async (userId, bankData) => {
  const data = {
    ...bankData,
    updatedAt: Date.now()
  };
  await set(ref(db, `users/${userId}/bankDetails`), data);
  return data;
};

export const getUserBankDetails = (userId, callback) =>
  onValue(ref(db, `users/${userId}/bankDetails`), (snap) => callback(snap.val()));

// ─── USER UPI DETAILS (ONE-TIME BINDING) ───────────────────────────────────────
export const bindUserUpi = async (userId, upiData) => {
  const snap = await get(ref(db, `users/${userId}/upiDetails`));
  if (snap.exists() && snap.val()?.upiId) {
    throw new Error('UPI ID is already permanently bound to this account and cannot be modified.');
  }

  const data = {
    upiId: upiData.upiId.trim().toLowerCase(),
    accountHolder: upiData.accountHolder?.trim() || '',
    boundAt: Date.now(),
    locked: true
  };
  await set(ref(db, `users/${userId}/upiDetails`), data);
  return data;
};

export const getUserUpiDetails = (userId, callback) =>
  onValue(ref(db, `users/${userId}/upiDetails`), (snap) => callback(snap.val()));

// ─── ADMIN: BONUSES ───────────────────────────────────────────────────────────
export const giveBonus = async (userId, amount, reason) => {
  const snap = await get(ref(db, `users/${userId}/walletBalance`));
  const cur = snap.val() || 0;
  await update(ref(db, `users/${userId}`), { walletBalance: cur + amount, bonusBalance: (cur + amount) });
  const bRef = push(ref(db, 'bonuses'));
  return set(bRef, { userId, amount, reason, createdAt: Date.now() });
};

export const getAllBonuses = (callback) =>
  onValue(ref(db, 'bonuses'), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt) : []);
  });

// ─── ONLINE USERS ─────────────────────────────────────────────────────────────
export const setUserOnline = (userId) =>
  set(ref(db, `online/${userId}`), { online: true, lastSeen: serverTimestamp() });

export const setUserOffline = (userId) =>
  remove(ref(db, `online/${userId}`));

export const getOnlineCount = (callback) =>
  onValue(ref(db, 'online'), (snap) => {
    callback(snap.val() ? Object.keys(snap.val()).length : 0);
  });

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const getNotifications = (userId, callback) =>
  onValue(ref(db, `notifications/${userId}`), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })).reverse() : []);
  });

export const markNotificationRead = (userId, notifId) =>
  update(ref(db, `notifications/${userId}/${notifId}`), { read: true });

// ─── REFERRALS ────────────────────────────────────────────────────────────────
export const getReferralData = (userId, callback) =>
  onValue(ref(db, `referrals/${userId}`), (snap) => callback(snap.val() || {}));

// ─── ACTIVE BETS ─────────────────────────────────────────────────────────────
export const getActiveBets = (callback) =>
  onValue(ref(db, 'activeBets'), (snap) => {
    const d = snap.val();
    callback(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })) : []);
  });
