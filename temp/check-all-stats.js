const https = require('https');

// Get all stats for the league - use getPlayerStats without player_id to get leaderboard
const data = JSON.stringify({
  league_id: 'aOq4Y0ETxPZ66tM1uUtP'
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
    try {
      const result = JSON.parse(body);
      console.log('=== ALL STATS IN LEAGUE ===');
      if (result.stats && Array.isArray(result.stats)) {
        result.stats.forEach(s => {
          console.log('');
          console.log('Player:', s.player_name);
          console.log('ID:', s.player_id);
          console.log('501 Legs:', s.x01_legs_played);
          console.log('Cricket Legs:', s.cricket_legs_played);
        });
      } else {
        console.log('Result:', JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', body.substring(0, 2000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
