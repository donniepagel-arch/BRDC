const https = require('https');

// Use getPlayerStats - but we need to check what collection it queries
// Let me check the league stats collection directly via an existing function

// Actually let me check if there's a function to get all league stats
const data = JSON.stringify({
  league_id: 'aOq4Y0ETxPZ66tM1uUtP',
  player_name: 'Donnie Pagel'
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
    console.log('=== getPlayerStats by name ===');
    console.log(body);
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
