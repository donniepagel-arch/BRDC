const admin = require('firebase-admin');

// Use application default credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'brdc-v2'
});
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function clearStats() {
    const statsRef = db.collection('leagues').doc(LEAGUE_ID).collection('stats');
    const snap = await statsRef.get();
    console.log(`Deleting ${snap.size} stats documents...`);

    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log('Stats cleared successfully!');
    process.exit(0);
}

clearStats().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
