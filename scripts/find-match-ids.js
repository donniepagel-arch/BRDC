/**
 * Find match IDs for Week 1 matches
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function findMatchIds() {
    console.log('Fetching Week 1 matches...\n');

    const matchesRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches');
    const snapshot = await matchesRef.where('week', '==', 1).get();

    const matches = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        matches.push({
            id: doc.id,
            home: data.home_team || 'Unknown',
            away: data.away_team || 'Unknown',
            week: data.week
        });
    });

    matches.sort((a, b) => a.home.localeCompare(b.home));

    console.log('Week 1 Matches:\n');
    matches.forEach(m => {
        console.log(`  "${m.home} vs ${m.away}"`);
        console.log(`  ID: ${m.id}`);
        console.log('');
    });

    console.log('\nCopy-paste format for MATCHES array:\n');
    matches.forEach(m => {
        const homeShort = m.home.split('.')[0];
        const awayShort = m.away.split('.')[0];
        console.log(`{`);
        console.log(`    name: '${homeShort} vs ${awayShort} (Week 1)',`);
        console.log(`    matchId: '${m.id}',`);
        console.log(`    rtfFile: 'temp/trips league/week 1/FILENAME.rtf',`);
        console.log(`    homeTeam: '${m.home}',`);
        console.log(`    awayTeam: '${m.away}'`);
        console.log(`},`);
    });

    process.exit(0);
}

findMatchIds().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
