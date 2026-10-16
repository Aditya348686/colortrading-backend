const http = require('http');

function post(path, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  try {
    // 1. Register a user
    const mobileNum = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const regResult = await post('/api/auth/register', {
      fullName: 'Auth Test User',
      mobile: mobileNum,
      email: `authtest${Date.now()}@example.com`,
      password: 'Password123!',
      referralCode: ''
    });
    console.log('Registration Status:', regResult.status);
    console.log('Registration Body:', regResult.body);

    const regData = JSON.parse(regResult.body);
    const token = regData.token;

    // 2. Play game - should be blocked (hasDeposited is false)
    const playResult = await post('/api/games/play', {
      gameType: 'wingo',
      betType: 'Green',
      betAmount: 10
    }, token);
    console.log('Play Status:', playResult.status);
    console.log('Play Body:', playResult.body);

  } catch (e) {
    console.error('Error in test:', e);
  }
}

run();
