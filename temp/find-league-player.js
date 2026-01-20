const https = require('https');

// Call getLeaguePlayers to see all players in the league
const data = JSON.stringify({
  league_id: 'aOq4Y0ETxPZ66tM1uUtP'
});

const options = {
  hostname: 'us-central1-brdc-v2.cloudfunctions.net',
  port: 443,
  path: '/getLeaguePlayers',
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
      console.log('=== LEAGUE PLAYERS ===');
      if (result.players) {
        result.players.forEach(p => {
          if (p.name && p.name.toLowerCase().includes('pagel')) {
            console.log('');
            console.log('Found:', p.name);
            console.log('ID:', p.id);
            console.log('PIN:', p.pin);
            console.log('unified_stats:', JSON.stringify(p.unified_stats, null, 2));
          }
        });

        // Also show all player names
        console.log('');
        console.log('=== ALL PLAYER NAMES ===');
        result.players.forEach(p => {
          console.log('-', p.name, '(ID:', p.id + ')');
        });
      }
    } catch (e) {
      console.log('Error:', e.message);
      console.log('Raw:', body.substring(0, 2000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
