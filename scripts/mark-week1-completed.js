/**
 * Mark all Week 1 matches as completed
 * Run with: firebase functions:shell < scripts/mark-week1-completed.js
 * Or: node scripts/mark-week1-completed.js (after gcloud auth)
 */

const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';

async function markWeek1Completed() {
    console.log('=== Marking all Week 1 matches as completed ===\n');

    const matchesSnap = await db.collection('leagues').doc(leagueId)
        .collection('matches')
        .where('week', '==', 1)
        .get();

    console.log(`Found ${matchesSnap.size} Week 1 matches\n`);

    const batch = db.batch();
    let updateCount = 0;

    matchesSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Match: ${doc.id}`);
        console.log(`  Current status: ${data.status}`);

        if (data.status !== 'completed') {
            batch.update(doc.ref, { status: 'completed' });
            console.log(`  -> Will update to: completed`);
            updateCount++;
        } else {
            console.log(`  -> Already completed, skipping`);
        }
        console.log('');
    });

    if (updateCount > 0) {
        await batch.commit();
        console.log(`\nSuccessfully updated ${updateCount} matches to completed status`);
    } else {
        console.log('\nNo matches needed updating');
    }

    process.exit(0);
}

markWeek1Completed().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
