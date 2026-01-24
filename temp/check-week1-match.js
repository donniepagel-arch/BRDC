const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';

async function checkWeek1Match() {
    console.log('=== Checking Week 1 matches for lineup data ===\n');

    const matchesSnap = await db.collection('leagues').doc(leagueId)
        .collection('matches')
        .where('week', '==', 1)
        .get();

    matchesSnap.forEach(doc => {
        const data = doc.data();
        console.log('\n--- Match:', doc.id, '---');
        console.log('Home team:', data.home_team_id);
        console.log('Away team:', data.away_team_id);
        console.log('Status:', data.status);
        console.log('Home lineup:', JSON.stringify(data.home_lineup, null, 2));
        console.log('Away lineup:', JSON.stringify(data.away_lineup, null, 2));

        if (data.games && data.games.length > 0) {
            console.log('\nGames array (first 3):');
            data.games.slice(0, 3).forEach((game, i) => {
                console.log(`  Game ${i}: home_players=${JSON.stringify(game.home_players)}, away_players=${JSON.stringify(game.away_players)}`);
            });
        }
    });

    process.exit(0);
}

checkWeek1Match().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
