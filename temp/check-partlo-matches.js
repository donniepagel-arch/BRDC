const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
const partloTeamId = 'FDk7AdpAiEoDuwN7wxvQ';

async function checkPartloMatches() {
    console.log('=== Checking matches for Dan Partlo team ===\n');
    console.log('Team ID:', partloTeamId);

    const matchesSnap = await db.collection('leagues').doc(leagueId)
        .collection('matches')
        .get();

    console.log('\nAll matches involving this team:');
    matchesSnap.forEach(doc => {
        const data = doc.data();
        if (data.home_team_id === partloTeamId || data.away_team_id === partloTeamId) {
            console.log('\n--- Match:', doc.id, '---');
            console.log('Week:', data.week);
            console.log('Status:', data.status);
            console.log('Home team:', data.home_team_id);
            console.log('Away team:', data.away_team_id);
            console.log('Home score:', data.home_score);
            console.log('Away score:', data.away_score);
        }
    });

    process.exit(0);
}

checkPartloMatches().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
