const admin = require('firebase-admin');

// Use application default credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'brdc-v2'
});
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function verifyStats() {
    const statsRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats');
    const snap = await statsRef.get();

    console.log(`\n=== STATS VERIFICATION ===`);
    console.log(`Total stats documents: ${snap.size}\n`);

    const players = [];
    snap.forEach(doc => {
        const d = doc.data();
        players.push({
            id: doc.id,
            name: d.player_name || 'Unknown',
            avg: d.x01_three_dart_avg || 0,
            mpr: d.cricket_mpr || 0,
            matches: d.matches_played || 0,
            x01_legs: d.x01_legs_played || 0,
            cricket_legs: d.cricket_legs_played || 0
        });
    });

    // Sort by name
    players.sort((a, b) => a.name.localeCompare(b.name));

    console.log('Player Stats Summary:');
    console.log('─'.repeat(90));
    console.log('Name                    3DA    MPR    Matches  X01 Legs  Cricket Legs');
    console.log('─'.repeat(90));

    players.forEach(p => {
        const name = p.name.padEnd(22);
        const avg = p.avg.toFixed(1).padStart(5);
        const mpr = p.mpr.toFixed(2).padStart(5);
        const matches = String(p.matches).padStart(7);
        const x01 = String(p.x01_legs).padStart(8);
        const cricket = String(p.cricket_legs).padStart(12);
        console.log(`${name}  ${avg}  ${mpr}  ${matches}  ${x01}  ${cricket}`);
    });

    console.log('─'.repeat(90));
    console.log(`\nTotal players with stats: ${players.length}`);

    process.exit(0);
}

verifyStats().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
