/**
 * Add missing fill-in players to the league players collection.
 * These players have stats entries but no player documents.
 *
 * Usage: node scripts/add-missing-fillins.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Fill-in players to add (team_id null = fill-in pool)
const FILLINS = [
    { name: 'Anthony Donley', position: null },
    { name: 'Dave Bonness', position: null }
];

async function run() {
    console.log('=== Add Missing Fill-in Players ===\n');

    // First, check existing players to avoid duplicates
    const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();
    const existingNames = new Set();
    playersSnap.forEach(d => existingNames.add(d.data().name));

    for (const fillin of FILLINS) {
        if (existingNames.has(fillin.name)) {
            console.log(`SKIP: ${fillin.name} already exists`);
            continue;
        }

        // Check if there's a stats entry we can match by elimination
        // (stats entries with no matching player doc)
        const statsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('stats').get();
        const playerIds = new Set();
        playersSnap.forEach(d => playerIds.add(d.id));

        const orphanStats = [];
        statsSnap.forEach(d => {
            if (!playerIds.has(d.id)) {
                orphanStats.push({ id: d.id, ...d.data() });
            }
        });

        console.log(`Found ${orphanStats.length} orphan stats entries`);
        orphanStats.forEach(s => {
            console.log(`  ${s.id}: 3DA=${s.x01_three_dart_avg || s.three_dart_avg || '?'}, MPR=${s.cricket_mpr || s.mpr || '?'}, x01_legs=${s.x01_legs_played || 0}, cricket_legs=${s.cricket_legs_played || 0}`);
        });

        // Create player doc with auto-generated ID (or match to orphan stats ID)
        let docId;
        if (fillin.name === 'Anthony Donley' && orphanStats.length > 0) {
            // Anthony played weeks 3+4 = more legs (~10 x01, ~9 cricket)
            const match = orphanStats.find(s => (s.x01_legs_played || 0) >= 8);
            docId = match ? match.id : null;
        } else if (fillin.name === 'Dave Bonness' && orphanStats.length > 0) {
            // Dave played week 3 only = fewer legs (~4 x01, ~4 cricket)
            const match = orphanStats.find(s => (s.x01_legs_played || 0) <= 6);
            docId = match ? match.id : null;
        }

        const playerData = {
            name: fillin.name,
            team_id: null,
            position: null,
            is_captain: false
        };

        if (docId) {
            console.log(`ADD: ${fillin.name} with ID ${docId} (matched to orphan stats)`);
            await db.collection('leagues').doc(LEAGUE_ID).collection('players').doc(docId).set(playerData);
        } else {
            console.log(`ADD: ${fillin.name} with auto-generated ID`);
            const ref = await db.collection('leagues').doc(LEAGUE_ID).collection('players').add(playerData);
            console.log(`  Created with ID: ${ref.id}`);
        }
    }

    console.log('\nDone!');
}

run().catch(console.error);
