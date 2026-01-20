/**
 * Import Aggregated Stats to Firestore
 * Uploads parsed match stats to the league stats collection
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin using Application Default Credentials
// This works when logged in via Firebase CLI
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

// League ID for 2026 Winter Triple Draft
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Load aggregated stats
const statsData = require('./aggregated-stats.json');

async function importStats() {
    console.log('Importing stats to Firestore...');
    console.log(`League: ${LEAGUE_ID}`);
    console.log(`Players: ${Object.keys(statsData).length}\n`);

    const batch = db.batch();
    let count = 0;

    for (const [playerId, stats] of Object.entries(statsData)) {
        // Skip temp IDs (players not in roster)
        if (playerId.startsWith('temp_')) {
            console.log(`  SKIP: ${stats.player_name} (temp ID: ${playerId})`);
            continue;
        }

        const statsRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats').doc(playerId);

        // Add timestamp
        const statsWithTimestamp = {
            ...stats,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(statsRef, statsWithTimestamp, { merge: true });
        console.log(`  ADD: ${stats.player_name} (${playerId})`);
        count++;
    }

    // Commit the batch
    await batch.commit();
    console.log(`\nSuccessfully imported ${count} player stats to Firestore!`);

    // Verify by reading back a sample
    console.log('\nVerifying import...');
    const sampleRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats').doc('yGcBLDcTwgHtWmZEg3TG');
    const sampleDoc = await sampleRef.get();

    if (sampleDoc.exists) {
        const data = sampleDoc.data();
        console.log(`  Nick Mezlak: 501 Avg ${data.x01_3da}, First9 ${data.x01_first9_avg}, MPR ${data.cricket_mpr}`);
    }

    process.exit(0);
}

importStats().catch(err => {
    console.error('Error importing stats:', err);
    process.exit(1);
});
