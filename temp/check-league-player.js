const https = require('https');

// Call getPlayerStats to see what's in the league player
const data = JSON.stringify({
  league_id: 'aOq4Y0ETxPZ66tM1uUtP',
  player_id: 'X2DMb9bP4Q8fy9yr5Fam'
});

const options = {
  hostname: 'us-central1-brdc-v2.cloudfunctions.net',
  port: 443,
  path: '/getPlayerStats',
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
    console.log('=== getPlayerStats RESULT ===');
    console.log(body.substring(0, 3000));
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
