// get-match-ids.js
const admin = require('firebase-admin');

// Initialize with application default credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});
const db = admin.firestore();

async function getMatchIds() {
    const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
    const matchesSnap = await db.collection('leagues').doc(leagueId).collection('matches').get();

    console.log('\n=== ALL MATCHES ===\n');

    matchesSnap.docs.forEach(doc => {
        const data = doc.data();
        const week = data.week || '?';
        const home = data.home_team_name || data.home_team || '?';
        const away = data.away_team_name || data.away_team || '?';

        console.log(`Week ${week}: ${home} vs ${away}`);
        console.log(`  Match ID: ${doc.id}\n`);
    });

    process.exit(0);
}

getMatchIds();
