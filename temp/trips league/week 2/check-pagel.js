const https = require('https');

https.get('https://us-central1-brdc-v2.cloudfunctions.net/getSchedule?league_id=aOq4Y0ETxPZ66tM1uUtP', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const match = json.matches.find(m => m.id === 'sgmoL4GyVUYP67aOS7wm');
        
        if (match && match.games && match.games[0] && match.games[0].legs && match.games[0].legs[0]) {
            const leg = match.games[0].legs[0];
            console.log('Pagel Match - First Leg Structure:');
            console.log(JSON.stringify({
                checkout: leg.checkout,
                checkout_darts: leg.checkout_darts,
                closeout_darts: leg.closeout_darts,
                winning_round: leg.winning_round,
                format: leg.format
            }, null, 2));
        }
    });
});
