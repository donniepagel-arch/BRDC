const https = require('https');

https.get('https://us-central1-brdc-v2.cloudfunctions.net/getSchedule?league_id=aOq4Y0ETxPZ66tM1uUtP', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const match = json.matches.find(m => m.id === 'tcI1eFfOlHaTyhjaCGOj');
        
        if (match) {
            console.log('Match Verification:');
            console.log('===================');
            console.log('Match:', match.home_team_name, 'vs', match.away_team_name);
            console.log('Week:', match.week);
            console.log('Status:', match.status);
            console.log('Score:', match.home_score, '-', match.away_score);
            console.log('Total Sets:', match.games?.length || 0);
            console.log('Total Legs:', match.total_legs);
            console.log('Total Darts:', match.total_darts);
            console.log('Import Source:', match.import_source);
            
            // Check checkout darts tracking
            let checkout_count = 0;
            let x01_legs = 0;
            if (match.games) {
                match.games.forEach(game => {
                    if (game.legs) {
                        game.legs.forEach(leg => {
                            if (leg.format === '501' || leg.format === '301' || leg.format === '701') {
                                x01_legs++;
                                if (leg.checkout_darts) checkout_count++;
                            }
                        });
                    }
                });
            }
            console.log('X01 Legs:', x01_legs);
            console.log('Legs with checkout_darts tracked:', checkout_count);
            console.log('Checkout tracking:', checkout_count === x01_legs ? 'COMPLETE' : 'MISSING');
        }
    });
});
