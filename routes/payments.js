const express = require('express');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');
const router = express.Router();

let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// Utility to sign data for iopay
function iopaySign(data, apiKey) {
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => k !== "sign" && v !== "" && v != null)
  );
  const keys = Object.keys(filtered).sort();
  const stringA = keys.map((k) => `${k}=${filtered[k]}`).join("&");
  return crypto.createHash("md5").update(stringA + "&key=" + apiKey).digest("hex").toUpperCase();
}

router.post('/create-order', authMiddleware, async (req, res) => {
  if (!razorpay) {
    return res.status(500).json({ message: 'Razorpay keys are not configured' });
  }

  const { amount, currency = 'INR' } = req.body;
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: `rcpt_${Date.now()}`
    });
    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/payments/iopay/create
router.post('/iopay/create', async (req, res) => {
  const { amount, userId } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Valid deposit amount is required' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const orderSn = "ORDER" + Date.now() + Math.floor(100 + Math.random() * 900);
    const moneyInPaise = Math.round(Number(amount) * 100);

    const appId = process.env.IOPAY_APP_ID || "APP48331430b62d";
    const apiKey = process.env.IOPAY_PAYIN_API_KEY || "39a6c5d190a35001f9f1ab4e29539b33";
    const notifyUrl = process.env.IOPAY_NOTIFY_URL || (req.protocol + '://' + req.get('host') + '/api/payments/iopay/callback');

    const payload = {
      app_id: appId,
      order_sn: orderSn,
      money: String(moneyInPaise),
      notify_url: notifyUrl,
      trade_type: "INRUPI",
      remark: "user deposit",
    };

    payload.sign = iopaySign(payload, apiKey);

    console.log("Creating payin order with payload:", payload);

    // Call iopay.in API
    const response = await fetch("https://iopay.in/api/payin/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });

    const json = await response.json();
    console.log("iopay.in response:", json);

    if (json.status === 1) {
      // Create a pending deposit record in Firebase Real-time Database
      const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";
      await fetch(`${dbUrl}/deposits/${orderSn}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          amount: Number(amount),
          method: "iopay",
          status: "pending",
          createdAt: Date.now()
        })
      });

      res.json({ success: true, pay_url: json.data.pay_url });
    } else {
      res.status(400).json({ success: false, message: json.msg || "Payin request rejected by gateway" });
    }
  } catch (error) {
    console.error("Payin creation error:", error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/payments/iopay/callback
router.post('/iopay/callback', async (req, res) => {
  const data = req.body;
  console.log("Received iopay.in callback:", data);

  const apiKey = process.env.IOPAY_PAYIN_API_KEY || "39a6c5d190a35001f9f1ab4e29539b33";
  const computedSign = iopaySign(data, apiKey);

  if (computedSign !== data.sign) {
    console.error(`Invalid signature. Computed: ${computedSign}, Received: ${data.sign}`);
    return res.status(400).send("invalid sign");
  }

  if (Number(data.status) === 1) {
    const orderSn = data.order_sn;
    const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";

    try {
      // Fetch the pending deposit
      const depRes = await fetch(`${dbUrl}/deposits/${orderSn}.json`);
      const deposit = await depRes.json();

      if (deposit && deposit.status === 'pending') {
        const userId = deposit.userId;
        const amount = Number(deposit.amount);

        console.log(`Processing approved deposit for order: ${orderSn}, user: ${userId}, amount: ${amount}`);

        // 1. Update deposit status to approved
        await fetch(`${dbUrl}/deposits/${orderSn}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved", processedAt: Date.now() })
        });

        // 2. Fetch current user balance
        const userRes = await fetch(`${dbUrl}/users/${userId}/walletBalance.json`);
        const currentBalance = Number(await userRes.json()) || 0;
        const netAmount = Number((amount * 0.98).toFixed(2));
        const newBalance = Number((currentBalance + netAmount).toFixed(2));

        // 3. Update user's walletBalance and hasDeposited
        await fetch(`${dbUrl}/users/${userId}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletBalance: newBalance, hasDeposited: true })
        });

        // 4. Update today's deposits stats
        const statsRes = await fetch(`${dbUrl}/stats/todayDeposits.json`);
        const currentTodayDep = Number(await statsRes.json()) || 0;
        await fetch(`${dbUrl}/stats.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todayDeposits: currentTodayDep + amount, updatedAt: Date.now() })
        });

        // 5. Add completed transaction to user's history
        await fetch(`${dbUrl}/transactions/${userId}.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "deposit",
            amount: amount,
            method: "iopay",
            status: "completed",
            reference: orderSn,
            createdAt: Date.now()
          })
        });

        console.log(`Successfully completed deposit for user: ${userId}`);
      } else {
        console.log(`Deposit already processed or not found for order: ${orderSn}`);
      }
    } catch (dbError) {
      console.error("Database update error during callback processing:", dbError);
      return res.status(500).send("Internal server database error");
    }
  }

  res.send("ok");
});

// ─── RUPAYEX PAYIN (DEPOSITS) ──────────────────────────────────────────────────
router.post('/rupayex/create', async (req, res) => {
  const { amount, userId, customerMobile } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'Valid deposit amount is required' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const orderId = "ORD_RPX_" + Date.now() + Math.floor(100 + Math.random() * 900);
    const apiToken = process.env.RUPAYEX_API_TOKEN || "e426639ee08145a9e8f68437696318c7";
    const baseUrl = process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api";
    const redirectUrl = req.protocol + '://' + req.get('host') + '/api/payments/rupayex/callback';

    const payload = new URLSearchParams();
    payload.append('user_token', apiToken);
    payload.append('amount', String(amount));
    payload.append('order_id', orderId);
    payload.append('redirect_url', redirectUrl);
    if (customerMobile) {
      payload.append('customer_mobile', customerMobile);
    }
    payload.append('remark1', `Deposit for user ${userId}`);

    console.log("Creating Rupayex payin order with payload:", payload.toString());

    const response = await fetch(`${baseUrl}/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Api-Token": apiToken
      },
      body: payload.toString()
    });

    const json = await response.json();
    console.log("Rupayex response:", json);

    if (json.status === true || json.success === true) {
      const payUrl = json.payment_url || json.pay_url || json.url || (json.data && (json.data.payment_url || json.data.pay_url || json.data.url));

      if (!payUrl) {
        throw new Error("Payment URL not found in Rupayex response: " + JSON.stringify(json));
      }

      const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";
      await fetch(`${dbUrl}/deposits/${orderId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          amount: Number(amount),
          method: "rupayex",
          status: "pending",
          createdAt: Date.now()
        })
      });

      res.json({ success: true, pay_url: payUrl });
    } else {
      res.status(400).json({ success: false, message: json.message || json.msg || "Payin request rejected by gateway" });
    }
  } catch (error) {
    console.error("Rupayex Payin creation error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ─── RUPAYEX CALLBACK ──────────────────────────────────────────────────────────
router.all('/rupayex/callback', async (req, res) => {
  const orderId = req.body?.order_id || req.query?.order_id || req.body?.orderId || req.query?.orderId;
  console.log("Received Rupayex callback payload:", { body: req.body, query: req.query });

  if (!orderId) {
    console.error("No order_id found in Rupayex callback");
    return res.redirect((process.env.REFERRAL_BASE_URL || 'http://localhost:3000') + '/wallet?status=error&msg=No%20order%20found');
  }

  const apiToken = process.env.RUPAYEX_API_TOKEN || "e426639ee08145a9e8f68437696318c7";
  const baseUrl = process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api";

  try {
    console.log(`Verifying Rupayex status for order: ${orderId}`);
    const verifyUrl = `${baseUrl}/order-status?user_token=${apiToken}&order_id=${orderId}`;
    const verifyRes = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "X-Api-Token": apiToken
      }
    });

    const verifyJson = await verifyRes.json();
    console.log("Rupayex Order status query response:", verifyJson);

    const isSuccess = verifyJson.status === true && (verifyJson.payment_status === "SUCCESS" || verifyJson.payment_status === "success");

    if (isSuccess) {
      const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";

      const depRes = await fetch(`${dbUrl}/deposits/${orderId}.json`);
      const deposit = await depRes.json();

      if (deposit && deposit.status === 'pending') {
        const userId = deposit.userId;
        const amount = Number(deposit.amount);

        console.log(`Processing verified Rupayex deposit for order: ${orderId}, user: ${userId}, amount: ${amount}`);

        await fetch(`${dbUrl}/deposits/${orderId}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved", processedAt: Date.now(), utr: verifyJson.utr || "—" })
        });

        const userRes = await fetch(`${dbUrl}/users/${userId}/walletBalance.json`);
        const currentBalance = Number(await userRes.json()) || 0;
        const netAmount = Number((amount * 0.98).toFixed(2));
        const newBalance = Number((currentBalance + netAmount).toFixed(2));

        await fetch(`${dbUrl}/users/${userId}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletBalance: newBalance, hasDeposited: true })
        });

        const statsRes = await fetch(`${dbUrl}/stats/todayDeposits.json`);
        const currentTodayDep = Number(await statsRes.json()) || 0;
        await fetch(`${dbUrl}/stats.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todayDeposits: currentTodayDep + amount, updatedAt: Date.now() })
        });

        await fetch(`${dbUrl}/transactions/${userId}.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "deposit",
            amount: amount,
            method: "rupayex",
            status: "completed",
            reference: orderId,
            createdAt: Date.now()
          })
        });

        console.log(`Successfully completed Rupayex deposit for user: ${userId}`);
      } else {
        console.log(`Deposit already processed or not found for order: ${orderId}`);
      }

      return res.redirect((process.env.REFERRAL_BASE_URL || 'http://localhost:3000') + '/wallet?status=success');
    } else {
      console.error(`Verification failed for Rupayex order: ${orderId}. Verify response:`, verifyJson);
      return res.redirect((process.env.REFERRAL_BASE_URL || 'http://localhost:3000') + '/wallet?status=failed&msg=Payment%20not%20verified');
    }
  } catch (error) {
    console.error("Rupayex callback processing error:", error);
    return res.redirect((process.env.REFERRAL_BASE_URL || 'http://localhost:3000') + '/wallet?status=error');
  }
});

// Helper to safely parse JSON response from third-party APIs
async function safeFetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, status: response.status, data: null, rawText: text.substring(0, 300) };
  }
}

// ─── RUPAYEX PAYOUT (WITHDRAWALS) ──────────────────────────────────────────────
router.post('/rupayex/payout', async (req, res) => {
  const { withdrawalId, userId, amount, method, accountHolder, accountNumber, ifscCode, bankName, upiId } = req.body;

  if (!withdrawalId || !userId || !amount || !method || !accountHolder) {
    return res.status(400).json({ message: 'Missing required payout fields' });
  }

  const apiToken = process.env.RUPAYEX_API_TOKEN || "e426639ee08145a9e8f68437696318c7";
  const baseUrl = process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api";
  const payoutId = "PO_RPX_" + Date.now();

  try {
    const payload = new URLSearchParams();
    payload.append('user_token', apiToken);
    payload.append('amount', String(amount));
    payload.append('method', method);
    payload.append('account_holder', accountHolder);
    payload.append('payout_id', payoutId);

    if (method === 'bank') {
      if (!accountNumber || !ifscCode || !bankName) {
        return res.status(400).json({ message: 'Missing bank details (account_number, ifsc_code, bank_name) for bank transfer method' });
      }
      payload.append('account_number', accountNumber);
      payload.append('ifsc_code', ifscCode);
      payload.append('bank_name', bankName);
    } else if (method === 'upi') {
      if (!upiId) {
        return res.status(400).json({ message: 'Missing upi_id for upi transfer method' });
      }
      payload.append('upi_id', upiId);
    } else {
      return res.status(400).json({ message: 'Invalid method. Must be bank or upi' });
    }

    console.log("Initiating Rupayex payout request:", payload.toString());

    const result = await safeFetchJson(`${baseUrl}/create-payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Api-Token": apiToken
      },
      body: payload.toString()
    });

    console.log("Rupayex Payout response:", result);

    if (!result.data) {
      return res.status(400).json({
        success: false,
        message: `RupayEx Gateway returned non-JSON response (HTTP ${result.status}). Please check API Token or Gateway status.`
      });
    }

    const json = result.data;

    if (json.status === true) {
      const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";
      await fetch(`${dbUrl}/withdrawals/${withdrawalId}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          processedAt: Date.now(),
          gateway: "rupayex",
          payout_id: json.data?.payout_id || payoutId,
          fee: json.data?.fee || 0,
          net_amount: json.data?.net_amount || amount
        })
      });

      const statsRes = await fetch(`${dbUrl}/stats/todayWithdrawals.json`);
      const currentTodayWithd = Number(await statsRes.json()) || 0;
      await fetch(`${dbUrl}/stats.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todayWithdrawals: currentTodayWithd + Number(amount), updatedAt: Date.now() })
      });

      await fetch(`${dbUrl}/transactions/${userId}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "withdrawal",
          amount: Number(amount),
          method: `rupayex_${method}`,
          status: "completed",
          reference: json.data?.payout_id || payoutId,
          createdAt: Date.now()
        })
      });

      res.json({ success: true, message: json.message || "Payout processed successfully", data: json.data });
    } else {
      res.status(400).json({ success: false, message: json.message || "Payout rejected by Rupayex" });
    }
  } catch (error) {
    console.error("Rupayex Payout error:", error);
    res.status(500).json({ message: error.message });
  }
});


// GET /api/payments/rupayex/payout-status
router.get('/rupayex/payout-status', async (req, res) => {
  const { payout_id } = req.query;
  if (!payout_id) {
    return res.status(400).json({ message: 'payout_id is required' });
  }

  const apiToken = process.env.RUPAYEX_API_TOKEN || "e426639ee08145a9e8f68437696318c7";
  const baseUrl = process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api";

  try {
    const response = await fetch(`${baseUrl}/payout-status?user_token=${apiToken}&payout_id=${encodeURIComponent(payout_id)}`, {
      method: "GET",
      headers: {
        "X-Api-Token": apiToken
      }
    });
    const json = await response.json();
    res.json(json);
  } catch (error) {
    console.error("Rupayex payout-status error:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/payments/rupayex/wallet-balance
router.get('/rupayex/wallet-balance', async (req, res) => {
  const apiToken = process.env.RUPAYEX_API_TOKEN || "e426639ee08145a9e8f68437696318c7";
  const baseUrl = process.env.RUPAYEX_BASE_URL || "https://rupayex.net/api";

  try {
    const response = await fetch(`${baseUrl}/wallet-balance?user_token=${apiToken}`, {
      method: "GET",
      headers: {
        "X-Api-Token": apiToken
      }
    });
    const json = await response.json();
    res.json(json);
  } catch (error) {
    console.error("Rupayex wallet-balance error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

