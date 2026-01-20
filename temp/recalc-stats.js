const https = require('https');

const data = JSON.stringify({
  league_id: 'aOq4Y0ETxPZ66tM1uUtP',
  admin_pin: '39632911'
});

const options = {
  hostname: 'us-central1-brdc-v2.cloudfunctions.net',
  port: 443,
  path: '/recalculateLeagueStats',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('=== RECALCULATE RESULT ===');
    console.log(body);
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
