/**
 * Test the exact same query that getPlayerChatRooms uses
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

async function testQuery() {
    // Get a player from the league
    const playersSnap = await db.collection('leagues').doc('aOq4Y0ETxPZ66tM1uUtP').collection('players').get();
    const player = playersSnap.docs[0];
    console.log(`Testing with player: ${player.id} (${player.data().name})`);

    // Run the EXACT same query as getPlayerChatRooms
    try {
        const roomsSnapshot = await db.collection('chat_rooms')
            .where('participants', 'array-contains', player.id)
            .orderBy('updated_at', 'desc')
            .get();

        console.log(`Query returned ${roomsSnapshot.size} rooms:`);
        roomsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${doc.id}: ${data.name} (${data.type}) | updated_at: ${data.updated_at}`);
        });
    } catch (error) {
        console.error('Query FAILED:', error.message);
        console.error('This means the Firestore composite index is missing!');
    }

    // Also try calling the cloud function via HTTP
    const https = require('https');
    const globalPlayerSnap = await db.collection('players').limit(1).get();
    const globalPlayer = globalPlayerSnap.docs[0];
    console.log(`\nAlso testing HTTP call with global player: ${globalPlayer.id} (${globalPlayer.data().name}), PIN: ${globalPlayer.data().pin}`);

    // Test via HTTP
    const testPin = globalPlayer.data().pin;
    const postData = JSON.stringify({ player_pin: testPin });
    const options = {
        hostname: 'us-central1-brdc-v2.cloudfunctions.net',
        path: '/getPlayerChatRooms',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                console.log(`HTTP response (${res.statusCode}):`, JSON.stringify({
                    success: parsed.success,
                    error: parsed.error,
                    roomCounts: parsed.rooms ? {
                        league: parsed.rooms.league?.length || 0,
                        team: parsed.rooms.team?.length || 0,
                        match: parsed.rooms.match?.length || 0,
                    } : null,
                    player_id: parsed.player_id
                }, null, 2));
            } catch(e) {
                console.log(`HTTP raw response (${res.statusCode}):`, data.substring(0, 300));
            }
        });
    });
    req.on('error', e => console.error('HTTP error:', e.message));
    req.write(postData);
    req.end();
}

testQuery().catch(console.error);
