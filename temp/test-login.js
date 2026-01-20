const https = require('https');

const data = JSON.stringify({ pin: '39632911' });

const options = {
  hostname: 'us-central1-brdc-v2.cloudfunctions.net',
  port: 443,
  path: '/globalLogin',
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
      console.log('=== LOGIN RESULT ===');
      console.log('Success:', result.success);
      if (result.player) {
        console.log('Player ID:', result.player.id);
        console.log('Name:', result.player.name);
        console.log('isAdmin:', result.player.isAdmin);
        console.log('source_type:', result.player.source_type);
        console.log('league_id:', result.player.league_id);
        console.log('');
        console.log('=== INVOLVEMENTS ===');
        console.log(JSON.stringify(result.player.involvements, null, 2));
      }
      if (result.error) {
        console.log('Error:', result.error);
      }
    } catch (e) {
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));
req.write(data);
req.end();
