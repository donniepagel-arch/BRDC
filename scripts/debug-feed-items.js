/**
 * Debug: Check what's actually in the feed items
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
    const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

    // Get league doc
    const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();
    console.log('League document exists:', leagueDoc.exists);
    if (leagueDoc.exists) {
        const data = leagueDoc.data();
        console.log('League fields:', Object.keys(data));
        console.log('league_name:', data.league_name);
        console.log('name:', data.name);
        console.log('title:', data.title);
    }

    // Get feed items
    const feedSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('feed')
        .limit(2)
        .get();

    console.log('\nFeed items count:', feedSnap.size);
    feedSnap.forEach(doc => {
        const item = doc.data();
        console.log('\nFeed item type:', item.type);
        console.log('league_name field:', item.league_name);
        console.log('league_id field:', item.league_id);
    });

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
