const dbUrl = "https://earn-and-money-3ff08-default-rtdb.firebaseio.com";

const PERIOD_SECONDS = {
  '30sec': 30,
  '1min': 60,
  '3min': 180,
  '5min': 300,
  '10min': 600
};
const ALL_PERIODS = ['30sec', '1min', '3min', '5min', '10min'];
const PAYOUTS = {
  color: { green: 2, red: 2, violet: 4.5 },
  number: 9,
  size: 2,
};

const getNumberColor = (num) => {
  if (num === 0 || num === 5) return 'violet';
  if ([1, 3, 7, 9].includes(num)) return 'green';
  return 'red';
};

const getPeriodInfo = (periodType, timestamp = Date.now()) => {
  const duration = PERIOD_SECONDS[periodType];
  const block = Math.floor(timestamp / (duration * 1000));
  const blockStartMs = block * duration * 1000;
  const endTime = (block + 1) * duration * 1000;
  
  const blockStart = new Date(blockStartMs);
  const yyyy = blockStart.getFullYear();
  const mm = String(blockStart.getMonth() + 1).padStart(2, '0');
  const dd = String(blockStart.getDate()).padStart(2, '0');
  const hh = String(blockStart.getHours()).padStart(2, '0');
  const min = String(blockStart.getMinutes()).padStart(2, '0');
  const sec = String(blockStart.getSeconds()).padStart(2, '0');
  
  const tag = periodType.replace('sec', 's').replace('min', 'm');
  const periodId = `${yyyy}${mm}${dd}${hh}${min}${sec}_${tag}`;
  
  return { periodId, endTime, block };
};

let activeBlocks = {};

const tick = async () => {
  const now = Date.now();
  
  for (const periodType of ALL_PERIODS) {
    const { periodId, endTime, block } = getPeriodInfo(periodType, now);
    
    // Check if block has transitioned
    if (activeBlocks[periodType] === undefined) {
      activeBlocks[periodType] = block;
      await updatePeriodInDb(periodType, periodId, endTime);
    } else if (block !== activeBlocks[periodType]) {
      const oldBlock = activeBlocks[periodType];
      const { periodId: oldPeriodId } = getPeriodInfo(periodType, oldBlock * PERIOD_SECONDS[periodType] * 1000);
      
      activeBlocks[periodType] = block;
      
      endPeriod(periodType, oldPeriodId).catch(err => {
        console.error(`[GameTimer] Error in endPeriod for ${periodType} / ${oldPeriodId}:`, err);
      });
      
      await updatePeriodInDb(periodType, periodId, endTime);
    }
  }
};

const updatePeriodInDb = async (periodType, periodId, endTime) => {
  try {
    await fetch(`${dbUrl}/gameControl/wingo/periods/${periodType}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, endTime })
    });
  } catch (err) {
    console.error(`[GameTimer] Failed to update period info for ${periodType}:`, err.message);
  }
};

const endPeriod = async (periodType, periodId) => {
  console.log(`[GameTimer] Ending period ${periodId} for ${periodType}...`);
  
  let resultNum;
  try {
    const nextResultRes = await fetch(`${dbUrl}/gameControl/wingo/nextResult.json`);
    const nextResult = await nextResultRes.json();
    
    const specificResultRes = await fetch(`${dbUrl}/gameControl/wingo/results/${periodId}.json`);
    const specificResult = await specificResultRes.json();
    
    if (nextResult !== null && nextResult !== undefined) {
      const r = typeof nextResult === 'object' ? nextResult.result : nextResult;
      resultNum = (r !== null && r !== undefined && !isNaN(Number(r))) ? Number(r) : Math.floor(Math.random() * 10);
      
      await fetch(`${dbUrl}/gameControl/wingo/nextResult.json`, { method: 'DELETE' }).catch(() => {});
    } else if (specificResult && specificResult.result !== undefined) {
      const r = specificResult.result;
      resultNum = typeof r === 'number' ? r : parseInt(r) || Math.floor(Math.random() * 10);
    } else {
      resultNum = Math.floor(Math.random() * 10);
    }
  } catch (err) {
    console.error(`[GameTimer] Error fetching game control for ${periodId}:`, err.message);
    resultNum = Math.floor(Math.random() * 10);
  }
  
  const resultColor = getNumberColor(resultNum);
  const resultSize = resultNum >= 5 ? 'big' : 'small';
  
  console.log(`[GameTimer] Period ${periodId} Result: Number ${resultNum}, Color ${resultColor}, Size ${resultSize}`);
  
  try {
    await fetch(`${dbUrl}/wingoResults/${periodType}/${periodId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: resultNum,
        color: resultColor,
        size: resultSize,
        period: periodId,
        periodType: periodType,
        timestamp: Date.now(),
      })
    });
  } catch (err) {
    console.error(`[GameTimer] Failed to save result to Firebase for ${periodId}:`, err.message);
  }
  
  try {
    const betsRes = await fetch(`${dbUrl}/bets.json`);
    const allBets = await betsRes.json();
    
    if (allBets) {
      for (const [userId, userBets] of Object.entries(allBets)) {
        if (!userBets || !userBets.wingo) continue;
        
        for (const [betId, bet] of Object.entries(userBets.wingo)) {
          if (bet.periodId === periodId && bet.status === 'pending') {
            let won = false;
            if (bet.betType === 'color' && bet.betValue === resultColor) won = true;
            if (bet.betType === 'number' && parseInt(bet.betValue) === resultNum) won = true;
            if (bet.betType === 'size' && bet.betValue === resultSize) won = true;
            
            const payoutMultiplier = bet.betType === 'color'
              ? PAYOUTS.color[bet.betValue]
              : bet.betType === 'number'
              ? PAYOUTS.number
              : PAYOUTS.size;
              
            const payout = won ? bet.amount * payoutMultiplier * bet.multiplier : 0;
            
            await fetch(`${dbUrl}/bets/${userId}/wingo/${betId}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: won ? 'won' : 'lost',
                result: resultNum,
                payout,
                settledAt: Date.now(),
              })
            });
            
            if (won && payout > 0) {
              const balRes = await fetch(`${dbUrl}/users/${userId}/walletBalance.json`);
              const currentBal = Number(await balRes.json()) || 0;
              const newBal = currentBal + payout;
              
              await fetch(`${dbUrl}/users/${userId}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletBalance: newBal })
              });
              
              const txRefName = `TX_${Date.now()}_${Math.floor(Math.random()*1000)}`;
              await fetch(`${dbUrl}/transactions/${userId}/${txRefName}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: "win",
                  amount: payout,
                  method: "wingo",
                  status: "completed",
                  reference: periodId,
                  createdAt: Date.now()
                })
              });
              
              const notifRefName = `NOTIF_${Date.now()}`;
              await fetch(`${dbUrl}/notifications/${userId}/${notifRefName}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: `Congratulations! You won ₹${payout.toFixed(2)} in Win Go (${periodType})!`,
                  type: 'success',
                  read: false,
                  createdAt: Date.now()
                })
              });
              
              console.log(`[GameTimer] User ${userId} won ₹${payout.toFixed(2)} on bet ${betId}`);
            } else {
              console.log(`[GameTimer] User ${userId} lost bet ${betId}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[GameTimer] Failed to settle bets for ${periodId}:`, err.message);
  }
};

const startTimers = () => {
  console.log('[GameTimer] Starting independent game timers...');
  setInterval(tick, 1000);
};

module.exports = { startTimers };
