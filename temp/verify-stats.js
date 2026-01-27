const https = require('https');

https.get('https://us-central1-brdc-v2.cloudfunctions.net/getSchedule?league_id=aOq4Y0ETxPZ66tM1uUtP', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const match = json.matches.find(m => m.id === 'ixNMXr2jT5f7hDD6qFDj');

        console.log('✅ Partlo v M.Pagel - Updated Stats:');
        console.log('   Expected from DartConnect:');
        console.log('   - Dan Partlo: 51.43');
        console.log('   - Joe Donley: 56.03');
        console.log('   - Kevin Mckelvey: 38.50');
        console.log('\n   Calculated from Firestore:');

        const stats = {};
        match.games.forEach(g => {
            g.legs.forEach(l => {
                if (l.format === '501') {
                    Object.entries(l.player_stats || {}).forEach(([name, st]) => {
                        if (!stats[name]) stats[name] = {darts: 0, points: 0};
                        stats[name].darts += st.darts || 0;
                        stats[name].points += st.points || 0;
                    });
                }
            });
        });

        ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'].forEach(name => {
            if (stats[name]) {
                const avg = ((stats[name].points / stats[name].darts) * 3).toFixed(2);
                console.log('   -', name + ':', avg, `(${stats[name].darts} darts, ${stats[name].points} points)`);
            }
        });
    });
});
