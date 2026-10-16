import { useEffect, useState } from 'react';
import axios from 'axios';
import BottomNav from '../components/BottomNav';
import SupportModal from '../components/SupportModal';
import {
  getUserProfile,
  getTransactions,
  getUserWithdrawals,
  addDeposit,
  addWithdrawal,
  updateUserProfile,
  saveUserBankDetails,
  getUserBankDetails,
  bindUserUpi,
  getUserUpiDetails
} from '../services/firebaseService';
import { db, ref, get, set, update, onValue } from '../firebaseConfig';

const fmtTxTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const txIcon = (type) => {
  if (type === 'deposit') return '💳';
  if (type === 'withdraw' || type === 'withdrawal') return '🏦';
  if (type === 'bet') return '🎯';
  if (type === 'win') return '🏆';
  if (type === 'gift') return '🎁';
  if (type === 'bonus') return '⭐';
  return '💰';
};

const txColor = (type) => {
  if (type === 'deposit' || type === 'win' || type === 'gift' || type === 'bonus') return '#22c55e';
  return '#f97316';
};

const POPULAR_BANKS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Axis Bank',
  'Canara Bank',
  'Union Bank of India',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Bank of India',
  'Central Bank of India',
  'IDBI Bank',
  'Indian Bank',
  'Yes Bank',
  'Paytm Payments Bank',
  'Airtel Payments Bank',
  'Federal Bank',
  'Other Bank'
];

const Wallet = () => {
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalGameplay, setTotalGameplay] = useState(0);
  const [hasDeposited, setHasDeposited] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Bank'); // Default to Bank
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [withdrawalList, setWithdrawalList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftMsg, setGiftMsg] = useState(null);

  // Bank Account State (5 Fields: Name, Bank Name, Account No, IFSC, Mobile)
  const [userBank, setUserBank] = useState(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolder: '',
    bankName: 'State Bank of India',
    customBankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    mobile: ''
  });
  const [savingBank, setSavingBank] = useState(false);

  // UPI State (One-Time Binding System: Cannot be edited or deleted)
  const [userUpi, setUserUpi] = useState(null);
  const [upiForm, setUpiForm] = useState({
    upiId: '',
    confirmUpiId: '',
    accountHolder: ''
  });
  const [bindingUpi, setBindingUpi] = useState(false);

  // Support Modal State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMsg, setSupportMsg] = useState('');
  const [supportCategory, setSupportCategory] = useState('Withdrawal Not Received');
  const [supportUtr, setSupportUtr] = useState('');
  const [supportAmount, setSupportAmount] = useState('');
  const [supportTab, setSupportTab] = useState('ticket');
  // Withdrawal limits from admin
  const [sysLimits, setSysLimits] = useState({
    withdrawMinAmount: 200,
    withdrawMaxAmount: 50000,
    withdrawDailyLimit: 100000,
    withdrawMinGameplay: 100,
    withdrawalEnabled: true,
    depositEnabled: true,
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('ctg_user');
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    const userId = user.id || user._id;
    if (!userId) return;

    const unsubProfile = getUserProfile(userId, (data) => {
      if (data) {
        setTotalBalance(data.walletBalance || 0);
        setTotalGameplay(data.totalGameplay || 0);
        setHasDeposited(data.hasDeposited || false);
      }
    });

    const unsubTx = getTransactions(userId, (txList) => {
      setTransactions(txList || []);
    });

    const unsubWithd = getUserWithdrawals(userId, (withdList) => {
      setWithdrawalList(withdList || []);
    });

    const unsubBank = getUserBankDetails(userId, (bank) => {
      if (bank) {
        setUserBank(bank);
        setBankForm(prev => ({
          ...prev,
          accountHolder: bank.accountHolder || '',
          bankName: bank.bankName || 'State Bank of India',
          accountNumber: bank.accountNumber || '',
          confirmAccountNumber: bank.accountNumber || '',
          ifscCode: bank.ifscCode || '',
          mobile: bank.mobile || ''
        }));
      }
    });

    const unsubUpi = getUserUpiDetails(userId, (upi) => {
      if (upi) {
        setUserUpi(upi);
        setUpiForm(prev => ({
          ...prev,
          upiId: upi.upiId || '',
          confirmUpiId: upi.upiId || '',
          accountHolder: upi.accountHolder || ''
        }));
      }
    });

    return () => {
      unsubProfile();
      unsubTx();
      unsubWithd();
      unsubBank();
      unsubUpi();
    };
  }, []);

  // Real-time system limits
  useEffect(() => {
    const unsub = onValue(ref(db, 'systemSettings'), (snap) => {
      const d = snap.val();
      if (d) setSysLimits(prev => ({ ...prev, ...d }));
    });
    return unsub;
  }, []);

  // Merged and deduplicated withdrawals list
  const allWithdrawals = (() => {
    const map = new Map();
    // 1. From dedicated withdrawals collection
    withdrawalList.forEach(w => {
      map.set(w.id, {
        ...w,
        type: 'withdraw',
        reference: w.id
      });
    });
    // 2. From user transactions
    transactions
      .filter(t => t.type === 'withdraw' || t.type === 'withdrawal')
      .forEach(t => {
        const key = t.reference || t.withdrawalId || t.id;
        if (map.has(key)) {
          const prev = map.get(key);
          map.set(key, { ...prev, ...t, status: prev.status || t.status });
        } else {
          map.set(key, t);
        }
      });
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  })();

  const showMsg = (text, type = 'error', dur = 4000) => {
    setMessage(text); setMessageType(type);
    if (dur) setTimeout(() => setMessage(''), dur);
  };

  const handleContactSupportForDeposit = (txn) => {
    const refId = txn.reference || txn.id || 'DEP_' + Date.now();
    const statusText = txn.status === 'completed' || txn.status === 'approved' ? 'Credited' : txn.status === 'pending' ? 'Pending' : 'Failed/Unpaid';
    const msg = `Hello 95 CLUB Admin Support,\n\nI created a deposit of ₹${txn.amount} via ${txn.method || 'UPI'} on ${fmtTxTime(txn.createdAt)} (Ref ID: ${refId}).\nStatus is showing: ${statusText}.\n\nPlease verify my payment and update my wallet balance.`;
    setSupportMsg(msg);
    setSupportCategory('Deposit Not Credited');
    setSupportUtr(refId);
    setSupportAmount(txn.amount);
    setSupportTab('ticket');
    setShowSupportModal(true);
  };

  const handleContactSupportForWithdrawal = (txn) => {
    const refId = txn.reference || txn.withdrawalId || txn.id || 'WID_' + Date.now();
    const methodText = txn.method === 'Bank' || txn.bankAccount
      ? `Bank Transfer (${txn.bankName || 'Bank'} A/C: ${txn.bankAccount ? txn.bankAccount.slice(-4) : '••••'})`
      : `UPI (${txn.upiId || 'UPI'})`;
    const statusText = txn.status === 'completed' || txn.status === 'approved'
      ? 'Paid / Disbursed'
      : txn.status === 'pending'
        ? 'Pending Review'
        : 'Rejected';

    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id || 'guest';
    const userName = user.fullName || user.mobile || 'Player';

    const msg = `Hello 95 CLUB Customer Support,\n\nI have not received my withdrawal amount in my account:\n• Withdrawal Ref ID: ${refId}\n• Amount: ₹${txn.amount}\n• Method: ${methodText}\n• Request Time: ${fmtTxTime(txn.createdAt)}\n• Status: ${statusText}\n• User ID: ${userId} (${userName})\n\nPlease check the payout status with payment gateway and disburse my amount as soon as possible. Thank you!`;

    setSupportMsg(msg);
    setSupportCategory('Withdrawal Not Received');
    setSupportUtr(refId);
    setSupportAmount(txn.amount);
    setSupportTab('ticket');
    setShowSupportModal(true);
  };

  // ── Deposit ──
  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 100) { showMsg('Minimum deposit is ₹100'); return; }
    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id;
    if (!userId) { showMsg('Please login first'); return; }

    try {
      setLoading(true);
      showMsg('Processing deposit request...', 'info', 0);

      // Always register deposit record in database first so it shows in Deposit History immediately
      await addDeposit(userId, { amount: amt, method: 'UPI', status: 'pending' });

      // Check payment gateway
      try {
        const response = await axios.post('/api/payments/rupayex/create', { amount: amt, userId });
        if (response.data?.pay_url) {
          showMsg('Redirecting to payment...', 'success', 0);
          setTimeout(() => { window.location.href = response.data.pay_url; }, 1000);
          return;
        }
      } catch {
        // Gateway direct fallback
      }

      showMsg(`Deposit request for ₹${amt} submitted! Check Deposit History for status & support.`, 'success');
      setDepositAmount('');
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to submit deposit');
    } finally {
      setLoading(false);
    }
  };

  // ── Save Bank Details (5 Fields) ──
  const handleSaveBank = async (e) => {
    if (e) e.preventDefault();
    const holder = bankForm.accountHolder.trim();
    const bName = bankForm.bankName === 'Other Bank' ? bankForm.customBankName.trim() : bankForm.bankName.trim();
    const accNo = bankForm.accountNumber.trim();
    const cAccNo = bankForm.confirmAccountNumber.trim();
    const ifsc = bankForm.ifscCode.trim().toUpperCase();
    const mob = bankForm.mobile.trim();

    if (!holder || holder.length < 3) {
      showMsg('Please enter account holder name'); return;
    }
    if (!bName) {
      showMsg('Please select or enter bank name'); return;
    }
    if (!accNo || accNo.length < 8 || accNo.length > 20 || !/^\d+$/.test(accNo)) {
      showMsg('Please enter a valid bank account number (8-20 digits)'); return;
    }
    if (accNo !== cAccNo) {
      showMsg('Account number and confirm account number do not match!'); return;
    }
    if (!ifsc || ifsc.length !== 11) {
      showMsg('Please enter a valid 11-character IFSC code (e.g. SBIN0001234)'); return;
    }
    if (!mob || mob.length < 10 || !/^\d{10}$/.test(mob)) {
      showMsg('Please enter valid 10-digit mobile number linked to bank'); return;
    }

    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id;
    if (!userId) { showMsg('Please login first'); return; }

    try {
      setSavingBank(true);
      await saveUserBankDetails(userId, {
        accountHolder: holder,
        bankName: bName,
        accountNumber: accNo,
        ifscCode: ifsc,
        mobile: mob
      });
      setUserBank({
        accountHolder: holder,
        bankName: bName,
        accountNumber: accNo,
        ifscCode: ifsc,
        mobile: mob
      });
      setShowBankForm(false);
      showMsg('✅ Bank account linked successfully!', 'success');
    } catch {
      showMsg('Failed to save bank account details');
    } finally {
      setSavingBank(false);
    }
  };

  // ── Bind UPI (One-Time Only System) ──
  const handleBindUpi = async (e) => {
    if (e) e.preventDefault();
    if (userUpi?.locked) {
      showMsg('⚠️ UPI ID is already permanently bound to your account and cannot be modified.');
      return;
    }

    const upi = upiForm.upiId.trim().toLowerCase();
    const cUpi = upiForm.confirmUpiId.trim().toLowerCase();
    const holder = upiForm.accountHolder.trim();

    if (!upi || !upi.includes('@') || upi.length < 5) {
      showMsg('Please enter a valid UPI ID (e.g. yourname@upi)'); return;
    }
    if (upi !== cUpi) {
      showMsg('UPI ID and Confirm UPI ID do not match!'); return;
    }
    if (!holder) {
      showMsg('Please enter account holder name'); return;
    }

    const confirmed = window.confirm(
      `⚠️ PERMANENT BINDING CONFIRMATION\n\nYour UPI ID: ${upi}\n\nPlease confirm: Once saved, this UPI ID CANNOT be changed, edited, or deleted for security reasons.\n\nDo you want to permanently bind this UPI ID?`
    );
    if (!confirmed) return;

    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id;
    if (!userId) { showMsg('Please login first'); return; }

    try {
      setBindingUpi(true);
      await bindUserUpi(userId, {
        upiId: upi,
        accountHolder: holder
      });
      setUserUpi({
        upiId: upi,
        accountHolder: holder,
        locked: true
      });
      showMsg('🔒 UPI ID permanently bound successfully!', 'success');
    } catch (err) {
      showMsg(err.message || 'Failed to bind UPI ID');
    } finally {
      setBindingUpi(false);
    }
  };

  // ── Gift Code ──
  const handleRedeemGift = async () => {
    const code = giftCode.trim().toUpperCase();
    if (!code) { setGiftMsg({ text: '⚠️ Enter a gift code', type: 'error' }); return; }
    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id;
    if (!userId) { setGiftMsg({ text: '⚠️ Please login first', type: 'error' }); return; }
    setGiftLoading(true);
    try {
      const codeSnap = await get(ref(db, `giftCodes/${code}`));
      if (!codeSnap.exists()) { setGiftMsg({ text: '❌ Invalid gift code', type: 'error' }); return; }
      const codeData = codeSnap.val();
      if (codeData.usedBy?.[userId]) { setGiftMsg({ text: '⚠️ Already redeemed!', type: 'error' }); return; }
      const usedCount = codeData.usedBy ? Object.keys(codeData.usedBy).length : 0;
      if (codeData.maxUses && usedCount >= codeData.maxUses) { setGiftMsg({ text: '❌ Code limit reached', type: 'error' }); return; }
      if (codeData.expiresAt && Date.now() > codeData.expiresAt) { setGiftMsg({ text: '❌ Code expired', type: 'error' }); return; }
      const bonusAmt = codeData.amount || 0;
      await update(ref(db, `giftCodes/${code}/usedBy`), { [userId]: Date.now() });
      const balSnap = await get(ref(db, `users/${userId}/walletBalance`));
      const newBal = Number(((Number(balSnap.val()) || 0) + bonusAmt).toFixed(2));
      await update(ref(db, `users/${userId}`), { walletBalance: newBal });
      await set(ref(db, `transactions/${userId}/GIFT_${Date.now()}`), { type: 'gift', amount: bonusAmt, method: 'Gift Code', status: 'completed', reference: code, createdAt: Date.now() });
      setGiftMsg({ text: `🎁 ₹${bonusAmt} added to your wallet!`, type: 'success' });
      setGiftCode('');
    } catch (err) {
      setGiftMsg({ text: '❌ ' + err.message, type: 'error' });
    }
    setGiftLoading(false);
    setTimeout(() => setGiftMsg(null), 5000);
  };

  // ── Withdraw ──
  const handleWithdraw = async () => {
    const amt = Number(withdrawAmount);
    const minAmt = sysLimits.withdrawMinAmount || 200;
    const maxAmt = sysLimits.withdrawMaxAmount || 50000;
    const minGameplay = sysLimits.withdrawMinGameplay || 100;

    if (!sysLimits.withdrawalEnabled) {
      showMsg('🔴 Withdrawals are temporarily disabled by admin.'); return;
    }
    if (!amt || amt < minAmt) { showMsg(`Minimum withdrawal is ₹${minAmt}`); return; }
    if (amt > maxAmt) { showMsg(`Maximum withdrawal per request is ₹${maxAmt}`); return; }
    if (totalBalance < amt) { showMsg('Insufficient balance'); return; }
    if (!hasDeposited) { showMsg('Make at least ₹100 deposit before withdrawing'); return; }
    if ((totalGameplay || 0) < minGameplay) { showMsg(`Play games worth ₹${minGameplay} first. Current: ₹${(totalGameplay || 0).toFixed(2)}`); return; }

    const user = JSON.parse(localStorage.getItem('ctg_user') || '{}');
    const userId = user.id || user._id;
    if (!userId) { showMsg('Please login first'); return; }

    let withdrawData = { amount: amt, method: withdrawMethod };

    if (withdrawMethod === 'Bank') {
      if (!userBank || !userBank.accountNumber) {
        setShowBankForm(true);
        showMsg('⚠️ Please add and link your Bank Account first');
        return;
      }
      withdrawData = {
        ...withdrawData,
        bankName: userBank.bankName,
        accountHolder: userBank.accountHolder,
        accountNumber: userBank.accountNumber,
        bankAccount: userBank.accountNumber,
        ifsc: userBank.ifscCode,
        ifscCode: userBank.ifscCode,
        mobile: userBank.mobile
      };
    } else if (withdrawMethod === 'UPI') {
      if (!userUpi || !userUpi.upiId) {
        showMsg('⚠️ Please bind your UPI ID first');
        return;
      }
      withdrawData = {
        ...withdrawData,
        upiId: userUpi.upiId,
        accountHolder: userUpi.accountHolder || user.fullName || ''
      };
    }

    try {
      setLoading(true);
      await addWithdrawal(userId, withdrawData);
      const newBal = Number((totalBalance - amt).toFixed(2));
      await updateUserProfile(userId, { walletBalance: newBal });
      localStorage.setItem('ctg_user', JSON.stringify({ ...user, walletBalance: newBal }));
      showMsg(`✅ Withdrawal of ₹${amt} requested successfully!`, 'success');
      setWithdrawAmount('');
    } catch {
      showMsg('Failed to submit withdrawal request');
    }
    setLoading(false);
  };

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#0c1017 0%,#0f172a 100%)', color: '#fff', paddingBottom: 100, fontFamily: '"Inter",-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, background: 'linear-gradient(90deg,#22c55e,#10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          💰 My Wallet
        </h1>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 14px', borderRadius: 99 }}>
          ₹{totalBalance.toFixed(2)}
        </div>
      </div>

      <div style={{ padding: '16px 14px', maxWidth: 480, margin: '0 auto' }}>

        {/* ── Big Balance Card ── */}
        <div style={{ background: 'linear-gradient(135deg,#0d4a2f,#065f46,#047857)', borderRadius: 24, padding: '28px 24px', marginBottom: 16, textAlign: 'center', boxShadow: '0 20px 60px rgba(5,150,105,0.3)', border: '1px solid rgba(34,197,94,0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Total Balance</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.3)', marginBottom: 4 }}>
            ₹{totalBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Available to play & withdraw</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button onClick={() => setActiveTab('deposit')} style={{ padding: '13px', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', backdropFilter: 'blur(10px)', transition: 'all 0.2s' }}>
              💳 Deposit
            </button>
            <button onClick={() => setActiveTab('withdraw')} style={{ padding: '13px', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', backdropFilter: 'blur(10px)', transition: 'all 0.2s' }}>
              🏦 Withdraw
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.68rem', color: '#8899cc', fontWeight: 600, marginBottom: 4 }}>🎯 Total Gameplay</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#a78bfa' }}>₹{(totalGameplay || 0).toFixed(2)}</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.68rem', color: '#8899cc', fontWeight: 600, marginBottom: 4 }}>✅ Deposit Status</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: hasDeposited ? '#22c55e' : '#f87171' }}>{hasDeposited ? 'Verified ✓' : 'Not done'}</div>
          </div>
        </div>

        {/* ── Quick Tabs ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { key: 'dashboard', label: '🏠 Home' },
            { key: 'deposit', label: '💳 Deposit' },
            { key: 'withdraw', label: '🏦 Withdraw' },
            { key: 'gift', label: '🎁 Gift Code' },
            { key: 'history', label: '📜 History' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '9px 16px', borderRadius: 10, border: activeTab === tab.key ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === tab.key ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab.key ? '#22c55e' : '#64748b', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit'
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ── Message ── */}
        {message && (
          <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 14, background: messageType === 'success' ? 'rgba(34,197,94,0.12)' : messageType === 'info' ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${messageType === 'success' ? '#22c55e' : messageType === 'info' ? '#6366f1' : '#ef4444'}44`, color: messageType === 'success' ? '#4ade80' : messageType === 'info' ? '#a78bfa' : '#f87171', fontSize: '0.88rem', fontWeight: 700 }}>
            {message}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Gift Code Quick */}
            <button onClick={() => setActiveTab('gift')} style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid rgba(255,215,0,0.25)', background: 'rgba(255,215,0,0.08)', color: '#ffd700', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 14, fontFamily: 'inherit' }}>
              🎁 Redeem Gift Code
            </button>
            {/* Recent transactions preview */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8899cc', marginBottom: 12 }}>📜 Recent Transactions</div>
              {transactions.slice(0, 5).length === 0
                ? <div style={{ textAlign: 'center', color: '#445', padding: 20, fontSize: '0.85rem' }}>No transactions yet</div>
                : transactions.slice(0, 5).map(txn => (
                  <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '1.3rem' }}>{txIcon(txn.type)}</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dde4ff', textTransform: 'capitalize' }}>{txn.type} via {txn.method}</div>
                        <div style={{ fontSize: '0.65rem', color: '#6677aa' }}>{fmtTxTime(txn.createdAt)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: txColor(txn.type), fontSize: '0.9rem' }}>
                        {['deposit', 'win', 'gift', 'bonus'].includes(txn.type) ? '+' : '-'}₹{txn.amount}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: txn.status === 'completed' ? '#4ade80' : '#fbbf24', fontWeight: 700, textTransform: 'capitalize' }}>{txn.status}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── DEPOSIT ── */}
        {activeTab === 'deposit' && (
          <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 20, padding: 20, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#22c55e', marginBottom: 16 }}>💳 Add Money</div>

            {/* Quick amounts */}
            <div style={{ fontSize: '0.75rem', color: '#8899cc', fontWeight: 600, marginBottom: 8 }}>Quick Select</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              {quickAmounts.map(a => (
                <button key={a} onClick={() => setDepositAmount(String(a))} style={{ padding: '10px', borderRadius: 10, border: depositAmount === String(a) ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)', background: depositAmount === String(a) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', color: depositAmount === String(a) ? '#22c55e' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                  ₹{a}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#8899cc', fontWeight: 600, marginBottom: 6 }}>Or enter amount (Min: ₹100)</div>
            <input
              type="number"
              placeholder="Enter amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
            />

            {depositAmount && !isNaN(Number(depositAmount)) && Number(depositAmount) >= 100 && (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#4ade80' }}>
                ✅ You will receive: <strong>₹{(Number(depositAmount) * 0.98).toFixed(2)}</strong> (2% tax deducted)
              </div>
            )}

            <button onClick={handleDeposit} disabled={loading} style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: loading ? '#334155' : 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 8px 24px rgba(34,197,94,0.3)', fontFamily: 'inherit' }}>
              {loading ? '⏳ Processing...' : `💳 Deposit ₹${depositAmount || '0'}`}
            </button>

            <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '12px 14px', fontSize: '0.78rem', color: '#6677aa', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: '#8899cc', marginBottom: 4 }}>📌 Deposit Info</div>
              <div>• Instant credit via Rupayex UPI</div>
              <div>• 2% processing fee applies</div>
              <div>• Min deposit: ₹100</div>
            </div>

            {/* ── Deposit History ── */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dde4ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                📋 Deposit History
                <span style={{ fontSize: '0.68rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                  {transactions.filter(t => t.type === 'deposit').length} records
                </span>
              </div>
              {transactions.filter(t => t.type === 'deposit').length === 0
                ? <div style={{ textAlign: 'center', color: '#445', padding: '20px 0', fontSize: '0.82rem' }}>No deposits yet</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transactions.filter(t => t.type === 'deposit').map(txn => (
                    <div key={txn.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', borderRadius: 12, border: '1px solid rgba(34,197,94,0.15)', borderLeft: '3px solid #22c55e' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: '1.4rem' }}>💳</span>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dde4ff' }}>Deposit via {txn.method || 'UPI'}</div>
                            <div style={{ fontSize: '0.65rem', color: '#6677aa', marginTop: 2 }}>{fmtTxTime(txn.createdAt)}</div>
                            {txn.reference && <div style={{ fontSize: '0.62rem', color: '#8899cc', fontFamily: 'monospace' }}>Ref: {txn.reference?.slice(0, 14)}</div>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, color: '#22c55e', fontSize: '1rem' }}>+₹{txn.amount}</div>
                          <div style={{ marginTop: 3, display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 800, background: txn.status === 'completed' || txn.status === 'approved' ? 'rgba(34,197,94,0.15)' : txn.status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.15)', color: txn.status === 'completed' || txn.status === 'approved' ? '#4ade80' : txn.status === 'pending' ? '#fbbf24' : '#f87171' }}>
                            {txn.status === 'completed' || txn.status === 'approved' ? '✅ Credited' : txn.status === 'pending' ? '⏳ Pending' : '❌ Unpaid / Failed'}
                          </div>
                        </div>
                      </div>

                      {/* Customer Service Support Button for Unpaid/Pending/Failed deposits */}
                      {(txn.status !== 'completed' && txn.status !== 'approved') && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.68rem', color: '#fbbf24' }}>⚠️ Payment not verified yet?</span>
                          <button
                            onClick={() => handleContactSupportForDeposit(txn)}
                            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))', color: '#c4b5fd', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            🎧 Contact Customer Service
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}

        {/* ── WITHDRAW ── */}
        {activeTab === 'withdraw' && (
          <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 20, padding: 20, border: '1px solid rgba(249,115,22,0.2)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f97316', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏦 Withdraw Funds
            </div>

            {/* Balance Available */}
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#8899cc', fontWeight: 600 }}>Available Withdrawal Balance</div>
                <div style={{ fontSize: '0.68rem', color: '#6677aa' }}>Minimum: ₹{sysLimits.withdrawMinAmount || 200}</div>
              </div>
              <span style={{ fontWeight: 900, color: '#22c55e', fontSize: '1.3rem' }}>₹{totalBalance.toFixed(2)}</span>
            </div>

            {/* Method Selector */}
            <div style={{ fontSize: '0.78rem', color: '#8899cc', fontWeight: 700, marginBottom: 8 }}>Select Withdrawal Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setWithdrawMethod('Bank')}
                style={{
                  padding: '12px', borderRadius: 12,
                  border: withdrawMethod === 'Bank' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                  background: withdrawMethod === 'Bank' ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                  color: withdrawMethod === 'Bank' ? '#60a5fa' : '#94a3b8',
                  fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <span>🏦</span> Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMethod('UPI')}
                style={{
                  padding: '12px', borderRadius: 12,
                  border: withdrawMethod === 'UPI' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  background: withdrawMethod === 'UPI' ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.04)',
                  color: withdrawMethod === 'UPI' ? '#34d399' : '#94a3b8',
                  fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <span>📱</span> UPI (One-Time)
              </button>
            </div>

            {/* ── BANK TRANSFER SECTION ── */}
            {withdrawMethod === 'Bank' && (
              <div style={{ marginBottom: 18 }}>
                {userBank && !showBankForm ? (
                  /* Linked Bank Card */
                  <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: 16, padding: '16px 18px', border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)', position: 'relative', marginBottom: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Linked Bank Account</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>🏦 {userBank.bankName}</div>
                      </div>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '3px 10px', borderRadius: 99, fontWeight: 800 }}>
                        ✓ Verified
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Account Holder</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0' }}>{userBank.accountHolder}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Account Number</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#93c5fd', letterSpacing: '0.05em' }}>
                          •••• •••• {userBank.accountNumber ? userBank.accountNumber.slice(-4) : '••••'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>IFSC Code</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>{userBank.ifscCode}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Linked Mobile</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0' }}>+91 ••••• {userBank.mobile ? userBank.mobile.slice(-4) : '••••'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setShowBankForm(true)}
                        style={{
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 8, padding: '6px 12px', color: '#cbd5e1', fontSize: '0.72rem',
                          fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >
                        ✏️ Change Bank Details
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Bank Addition Form (5 Fields: Name, Bank Name, Account No, IFSC, Mobile) */
                  <form onSubmit={handleSaveBank} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '16px',
                    border: '1px solid rgba(59,130,246,0.25)', marginBottom: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#60a5fa' }}>
                        🏦 {userBank ? 'Update Bank Details' : 'Add Bank Account'}
                      </div>
                      {userBank && (
                        <button
                          type="button"
                          onClick={() => setShowBankForm(false)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          ✕ Cancel
                        </button>
                      )}
                    </div>

                    {/* Field 1: Account Holder Name */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        1. Account Holder Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Full Name as per Bank Passbook"
                        value={bankForm.accountHolder}
                        onChange={e => setBankForm({ ...bankForm, accountHolder: e.target.value })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Field 2: Bank Name */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        2. Bank Name *
                      </label>
                      <select
                        value={bankForm.bankName}
                        onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: '#1e293b',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      >
                        {POPULAR_BANKS.map(b => (
                          <option key={b} value={b} style={{ background: '#0f172a', color: '#fff' }}>{b}</option>
                        ))}
                      </select>
                      {bankForm.bankName === 'Other Bank' && (
                        <input
                          type="text"
                          placeholder="Type your bank name"
                          value={bankForm.customBankName}
                          onChange={e => setBankForm({ ...bankForm, customBankName: e.target.value })}
                          required
                          style={{
                            width: '100%', padding: '11px 14px', borderRadius: 10, marginTop: 6,
                            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                            color: '#fff', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>

                    {/* Field 3: Bank Account Number */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        3. Bank Account Number *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter 9-18 digit Account Number"
                        value={bankForm.accountNumber}
                        onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, '') })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.05em', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Field 4: Confirm Account Number */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        4. Confirm Account Number *
                      </label>
                      <input
                        type="text"
                        placeholder="Re-enter Account Number"
                        value={bankForm.confirmAccountNumber}
                        onChange={e => setBankForm({ ...bankForm, confirmAccountNumber: e.target.value.replace(/\D/g, '') })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.05em', outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Field 5: IFSC Code & Linked Mobile */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                          5. IFSC Code *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SBIN0001234"
                          maxLength={11}
                          value={bankForm.ifscCode}
                          onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                          required
                          style={{
                            width: '100%', padding: '11px 12px', borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                          6. Mobile Number *
                        </label>
                        <input
                          type="tel"
                          placeholder="10-digit mobile"
                          maxLength={10}
                          value={bankForm.mobile}
                          onChange={e => setBankForm({ ...bankForm, mobile: e.target.value.replace(/\D/g, '') })}
                          required
                          style={{
                            width: '100%', padding: '11px 12px', borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingBank}
                      style={{
                        width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                        background: savingBank ? '#334155' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: savingBank ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {savingBank ? '⏳ Saving Bank Details...' : '💾 Save & Link Bank Account'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── UPI (ONE-TIME BINDING) SECTION ── */}
            {withdrawMethod === 'UPI' && (
              <div style={{ marginBottom: 18 }}>
                {userUpi && userUpi.locked ? (
                  /* Permanently Bound UPI Card (No delete, no edit option) */
                  <div style={{
                    background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
                    borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(16,185,129,0.4)',
                    boxShadow: '0 10px 30px rgba(6,78,59,0.35)', position: 'relative', marginBottom: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.3rem' }}>🛡️</span>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Permanent Bound UPI
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>Account Holder: {userUpi.accountHolder || 'Verified User'}</div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', background: 'rgba(16,185,129,0.2)', color: '#34d399',
                        padding: '4px 10px', borderRadius: 99, fontWeight: 800, border: '1px solid rgba(16,185,129,0.3)'
                      }}>
                        🔒 Locked
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '12px 14px',
                      fontSize: '1.05rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace',
                      letterSpacing: '0.04em', wordBreak: 'break-all', marginBottom: 10
                    }}>
                      📱 {userUpi.upiId}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      🔒 <strong>One-time bound:</strong> For your fund security, this UPI ID is permanently locked and cannot be edited or deleted.
                    </div>
                  </div>
                ) : (
                  /* One-Time UPI Binding Form */
                  <form onSubmit={handleBindUpi} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '16px',
                    border: '1px solid rgba(16,185,129,0.3)', marginBottom: 14
                  }}>
                    <div style={{
                      background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
                      borderRadius: 12, padding: '10px 12px', marginBottom: 14, fontSize: '0.74rem', color: '#fef08a'
                    }}>
                      ⚠️ <strong>IMPORTANT SECURITY NOTICE:</strong><br />
                      You can bind your UPI ID only <strong>ONCE</strong>. Once added, it will be permanently linked and <strong>CANNOT be modified, edited, or deleted</strong>. Please verify carefully.
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        UPI Account Holder Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Full Name as registered with UPI"
                        value={upiForm.accountHolder}
                        onChange={e => setUpiForm({ ...upiForm, accountHolder: e.target.value })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        UPI ID / VPA *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. mobile@paytm or name@okhdfcbank"
                        value={upiForm.upiId}
                        onChange={e => setUpiForm({ ...upiForm, upiId: e.target.value.toLowerCase() })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                        Confirm UPI ID *
                      </label>
                      <input
                        type="text"
                        placeholder="Re-enter UPI ID exactly"
                        value={upiForm.confirmUpiId}
                        onChange={e => setUpiForm({ ...upiForm, confirmUpiId: e.target.value.toLowerCase() })}
                        required
                        style={{
                          width: '100%', padding: '11px 14px', borderRadius: 10,
                          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                          color: '#fff', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={bindingUpi}
                      style={{
                        width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                        background: bindingUpi ? '#334155' : 'linear-gradient(135deg, #059669, #047857)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: bindingUpi ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {bindingUpi ? '⏳ Binding UPI...' : '🔒 Bind UPI ID Permanently (One-Time)'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── AMOUNT & SUBMIT ── */}
            <div style={{ fontSize: '0.78rem', color: '#8899cc', fontWeight: 700, marginBottom: 6 }}>
              Withdrawal Amount (Min: ₹{sysLimits.withdrawMinAmount || 200})
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', color: '#f97316', fontWeight: 900 }}>₹</span>
              <input
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                style={{
                  width: '100%', padding: '13px 16px 13px 36px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                  color: '#fff', fontSize: '1.15rem', fontWeight: 800, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none'
                }}
              />
            </div>

            {/* Quick Amount Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
              {[200, 500, 1000, 2000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setWithdrawAmount(String(amt))}
                  style={{
                    padding: '8px 4px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', fontSize: '0.75rem',
                    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleWithdraw}
              disabled={loading}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: loading ? '#334155' : 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 24px rgba(249,115,22,0.3)', fontFamily: 'inherit'
              }}
            >
              {loading ? '⏳ Processing Request...' : `🏦 Withdraw ₹${withdrawAmount || '0'} via ${withdrawMethod}`}
            </button>

            {/* Withdrawal Rules */}
            <div style={{ marginTop: 14, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '12px 14px', fontSize: '0.76rem', color: '#6677aa', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 800, color: '#f97316', marginBottom: 8, fontSize: '0.8rem' }}>📋 Withdrawal Limits & Rules</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#6677aa' }}>Min Amount</div>
                  <div style={{ fontWeight: 800, color: '#4ade80' }}>₹{(sysLimits.withdrawMinAmount || 200).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(96,165,250,0.08)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#6677aa' }}>Max/Request</div>
                  <div style={{ fontWeight: 800, color: '#60a5fa' }}>₹{(sysLimits.withdrawMaxAmount || 50000).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#6677aa' }}>Daily Limit</div>
                  <div style={{ fontWeight: 800, color: '#f97316' }}>₹{(sysLimits.withdrawDailyLimit || 100000).toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(251,191,36,0.08)', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#6677aa' }}>Min Gameplay</div>
                  <div style={{ fontWeight: 800, color: '#fbbf24' }}>₹{(sysLimits.withdrawMinGameplay || 100).toLocaleString()}</div>
                </div>
              </div>
              <div>• Bank disbursals processed in 15-30 minutes after admin approval</div>
              <div>• Ensure your bank account number and IFSC are 100% accurate</div>
              {!sysLimits.withdrawalEnabled && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(239,68,68,0.12)', borderRadius: 8, color: '#f87171', fontWeight: 700 }}>
                  🔴 Withdrawals currently disabled by admin
                </div>
              )}
            </div>

            {/* ── WITHDRAWAL HISTORY & SUPPORT SYSTEM ── */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#dde4ff', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📋</span> Withdrawal History
                </div>
                <span style={{ fontSize: '0.68rem', background: 'rgba(249,115,22,0.15)', color: '#fb923c', padding: '3px 10px', borderRadius: 99, fontWeight: 800 }}>
                  {allWithdrawals.length} records
                </span>
              </div>

              {allWithdrawals.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '30px 0', fontSize: '0.84rem', background: 'rgba(0,0,0,0.15)', borderRadius: 12 }}>
                  <div>🏦 No withdrawal records found</div>
                  <div style={{ fontSize: '0.72rem', marginTop: 4, color: '#475569' }}>Your withdrawal requests and payout statuses will appear here</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {allWithdrawals.map(txn => {
                    const isApproved = txn.status === 'completed' || txn.status === 'approved';
                    const isPending = txn.status === 'pending';
                    const isRejected = txn.status === 'rejected' || txn.status === 'failed';
                    const refId = txn.reference || txn.withdrawalId || txn.id;

                    return (
                      <div
                        key={txn.id || refId}
                        style={{
                          padding: '14px 16px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: 14,
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderLeft: `4px solid ${isApproved ? '#22c55e' : isPending ? '#f59e0b' : '#ef4444'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{txn.method === 'UPI' || txn.upiId ? '📱' : '🏦'}</span>
                              <span>Withdrawal via {txn.method || 'Bank'}</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2 }}>
                              {fmtTxTime(txn.createdAt)} • Ref: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{refId?.slice(0, 14)}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, color: '#f97316', fontSize: '1.05rem' }}>
                              -₹{Number(txn.amount).toFixed(2)}
                            </div>
                            <div style={{
                              marginTop: 3, display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '0.62rem', fontWeight: 800,
                              background: isApproved ? 'rgba(34,197,94,0.15)' : isPending ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                              color: isApproved ? '#4ade80' : isPending ? '#fbbf24' : '#f87171'
                            }}>
                              {isApproved ? '✅ Paid' : isPending ? '⏳ In Review' : '❌ Rejected'}
                            </div>
                          </div>
                        </div>

                        {/* Account Details Line */}
                        {(txn.bankName || txn.bankAccount || txn.upiId || txn.accountHolder) && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 8, marginBottom: 8 }}>
                            {txn.upiId ? (
                              <div>UPI: <strong>{txn.upiId}</strong> {txn.accountHolder ? `(${txn.accountHolder})` : ''}</div>
                            ) : (
                              <div>
                                {txn.bankName && <span><strong>{txn.bankName}</strong> • </span>}
                                <span>A/C: ••••{(txn.bankAccount || txn.accountNumber || '').slice(-4) || '—'}</span>
                                {txn.ifsc && <span> • IFSC: {txn.ifsc}</span>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Dedicated "Withdrawal Not Received? Contact Support" Option */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ fontSize: '0.68rem', color: isPending ? '#f59e0b' : isApproved ? '#4ade80' : '#f87171' }}>
                            {isPending
                              ? '⏳ Processing bank transfer'
                              : isApproved
                                ? 'Money disbursed to your bank'
                                : 'Amount refunded to wallet'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleContactSupportForWithdrawal(txn)}
                            style={{
                              background: 'rgba(239,68,68,0.12)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              borderRadius: 8,
                              padding: '5px 12px',
                              color: '#f87171',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'inherit'
                            }}
                          >
                            <span>🎧</span> Not Received? Support
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── GIFT CODE ── */}
        {activeTab === 'gift' && (
          <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎁</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffd700', marginBottom: 4 }}>Redeem Gift Code</div>
              <div style={{ fontSize: '0.8rem', color: '#6677aa' }}>Enter your code to claim bonus instantly</div>
            </div>

            {giftMsg && (
              <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 16, textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', background: giftMsg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${giftMsg.type === 'success' ? '#22c55e' : '#ef4444'}44`, color: giftMsg.type === 'success' ? '#4ade80' : '#f87171' }}>
                {giftMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input type="text" placeholder="e.g. WELCOME100" value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleRedeemGift()}
                style={{ flex: 1, padding: '14px 16px', borderRadius: 12, border: '2px solid rgba(255,215,0,0.3)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em', outline: 'none', fontFamily: 'monospace' }}
              />
              <button onClick={handleRedeemGift} disabled={giftLoading} style={{ padding: '14px 20px', borderRadius: 12, border: 'none', background: giftLoading ? '#334155' : 'linear-gradient(135deg,#ffd700,#ff8c00)', color: '#0f172a', fontWeight: 900, cursor: giftLoading ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontFamily: 'inherit' }}>
                {giftLoading ? '⏳' : '✅ Claim'}
              </button>
            </div>

            <a href="https://t.me/61clubsupport" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#0088cc,#006aaa)', color: '#fff', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
              ✈️ Get Codes on Telegram
            </a>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <div style={{ background: 'rgba(15,22,50,0.85)', borderRadius: 20, padding: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#dde4ff', marginBottom: 14 }}>📜 All Transactions</div>
            {transactions.length === 0
              ? <div style={{ textAlign: 'center', color: '#445', padding: 30, fontSize: '0.85rem' }}>No transactions yet</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transactions.map(txn => (
                  <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, borderLeft: `3px solid ${txColor(txn.type)}` }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '1.3rem' }}>{txIcon(txn.type)}</span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dde4ff', textTransform: 'capitalize' }}>{txn.type} via {txn.method}</div>
                        <div style={{ fontSize: '0.65rem', color: '#6677aa' }}>{fmtTxTime(txn.createdAt)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: txColor(txn.type), fontSize: '0.9rem' }}>
                        {['deposit', 'win', 'gift', 'bonus'].includes(txn.type) ? '+' : '-'}₹{txn.amount}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: txn.status === 'completed' ? '#4ade80' : txn.status === 'pending' ? '#fbbf24' : '#f87171', fontWeight: 700, textTransform: 'capitalize' }}>{txn.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>

      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        initialMessage={supportMsg}
        initialCategory={supportCategory}
        initialUtr={supportUtr}
        initialAmount={supportAmount}
        initialTab={supportTab}
      />
      <BottomNav />
    </div>
  );
};

export default Wallet;
