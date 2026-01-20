const https = require('https');

const data = JSON.stringify({
  player_id: 'X2DMb9bP4Q8fy9yr5Fam',
  source_type: 'global'
});

const options = {
  hostname: 'us-central1-brdc-v2.cloudfunctions.net',
  port: 443,
  path: '/getDashboardData',
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
      console.log('=== DASHBOARD RESULT ===');
      console.log('Success:', result.success);
      if (result.dashboard) {
        console.log('');
        console.log('=== PLAYER ===');
        console.log('Name:', result.dashboard.player.name);
        console.log('isAdmin:', result.dashboard.player.isAdmin);
        console.log('');
        console.log('=== STATS ===');
        console.log(JSON.stringify(result.dashboard.player.stats, null, 2));
        console.log('');
        console.log('=== ROLES ===');
        console.log('Playing:', JSON.stringify(result.dashboard.roles.playing, null, 2));
      }
      if (result.error) {
        console.log('Error:', result.error);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw response:', body.substring(0, 1000));
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
