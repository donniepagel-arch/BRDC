const admin = require('firebase-admin');

// Use application default credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'brdc-v2'
});
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function findPlayers() {
    console.log('Searching for missing players...\n');

    // Players to find
    const searchNames = ['bonness', 'donley', 'anthony'];

    const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();

    console.log('=== League Players ===');
    playersSnap.forEach(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();

        // Check if this is one of our search targets
        for (const search of searchNames) {
            if (name.includes(search)) {
                console.log(`Found: ${doc.id} → ${data.name} (team: ${data.team_id})`);
            }
        }
    });

    // Also check global players
    const globalSnap = await db.collection('players').get();
    console.log('\n=== Global Players ===');
    globalSnap.forEach(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();

        for (const search of searchNames) {
            if (name.includes(search)) {
                console.log(`Global: ${doc.id} → ${data.name}`);
            }
        }
    });

    // Also list all M. Pagel team players
    const mPagelTeam = 'mgR4e3zldLsM9tAnXmK8'; // M. Pagel team ID
    console.log('\n=== All M. Pagel Team Players ===');
    playersSnap.forEach(doc => {
        const data = doc.data();
        if (data.team_id === mPagelTeam) {
            console.log(`${doc.id} → ${data.name} (pos: ${data.position})`);
        }
    });

    process.exit(0);
}

findPlayers().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
