// Find name mismatches between players and stats collections
const https = require('https');

const url = 'https://us-central1-brdc-v2.cloudfunctions.net/debugPlayerStats?leagueId=aOq4Y0ETxPZ66tM1uUtP';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const j = JSON.parse(data);

        console.log('=== NAME MISMATCHES ===\n');

        const mismatches = [];
        j.players.forEach(p => {
            const statsEntry = j.statsCollection.find(s => s.id === p.id);
            if (statsEntry && statsEntry.player_name && p.name !== statsEntry.player_name) {
                mismatches.push({
                    id: p.id,
                    playersName: p.name,
                    statsName: statsEntry.player_name
                });
                console.log('Player ID: ' + p.id);
                console.log('  players collection: "' + p.name + '"');
                console.log('  stats collection:   "' + statsEntry.player_name + '"');
                console.log('');
            }
        });

        console.log('Total mismatches: ' + mismatches.length);
        console.log('\n=== ALL PLAYERS ===\n');
        j.players.forEach(p => {
            const statsEntry = j.statsCollection.find(s => s.id === p.id);
            const statsName = statsEntry ? statsEntry.player_name : '(no stats)';
            const match = p.name === statsName ? '✓' : '✗';
            console.log(match + ' ' + p.id.substring(0,8) + '... | players: "' + p.name + '" | stats: "' + statsName + '"');
        });
    });
}).on('error', err => {
    console.error('Error:', err.message);
});
