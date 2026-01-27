const fs = require('fs');
const https = require('https');
const path = require('path');

const JSON_FILE = path.join(__dirname, 'tcI1eFfOlHaTyhjaCGOj-match.json');

const payload = fs.readFileSync(JSON_FILE, 'utf8');
const parsed = JSON.parse(payload);

console.log('Importing Mezlak v E.O match...');
console.log('Match ID:', parsed.matchId);
console.log('League ID:', parsed.leagueId);
console.log('Games:', parsed.matchData.games.length);

let checkoutDartsCount = 0;
parsed.matchData.games.forEach(game => {
    if (game.legs) {
        game.legs.forEach(leg => {
            if (leg.home_stats && leg.home_stats.checkout_darts) checkoutDartsCount++;
            if (leg.away_stats && leg.away_stats.checkout_darts) checkoutDartsCount++;
        });
    }
});
console.log('Legs with checkout_darts:', checkoutDartsCount);

const options = {
    hostname: 'us-central1-brdc-v2.cloudfunctions.net',
    port: 443,
    path: '/importMatchData',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

console.log('\nPosting to cloud function...');

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response body:', data);
        if (res.statusCode === 200) {
            console.log('\nSuccess! Match imported with checkout_darts tracking.');
        } else {
            console.error('\nImport failed!');
        }
    });
});

req.on('error', (error) => { console.error('Error:', error); });
req.write(payload);
req.end();
