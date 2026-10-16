const http = require('http');
const mobileNum = String(Math.floor(1000000000 + Math.random() * 9000000000));
const data = JSON.stringify({
  fullName: 'Test User',
  mobile: mobileNum,
  email: `testuser${Date.now()}@example.com`,
  password: 'Password123!',
  referralCode: ''
});
const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, (res) => {
  let raw = '';
  res.on('data', (chunk) => raw += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(raw);
  });
});
req.on('error', (e) => console.error('error', e));
req.write(data);
req.end();
