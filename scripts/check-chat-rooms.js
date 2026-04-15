/**
 * Check existing chat rooms and their participants
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function checkChatRooms() {
    // Get all chat rooms for this league
    const roomsSnap = await db.collection('chat_rooms')
        .where('league_id', '==', LEAGUE_ID)
        .get();

    console.log(`Found ${roomsSnap.size} chat rooms for league ${LEAGUE_ID}\n`);

    for (const doc of roomsSnap.docs) {
        const data = doc.data();
        console.log(`Room: ${doc.id}`);
        console.log(`  Type: ${data.type}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Participants (${data.participants?.length || 0}): ${(data.participants || []).slice(0, 5).join(', ')}${data.participants?.length > 5 ? '...' : ''}`);
        console.log(`  Last message: ${data.last_message?.text || 'none'}`);
        console.log('');
    }

    // Check a sample team document
    const teamsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('teams').get();
    console.log('\n--- Sample Team Document ---');
    if (teamsSnap.size > 0) {
        const team = teamsSnap.docs[0];
        console.log(`ID: ${team.id}`);
        console.log(`Data:`, JSON.stringify(team.data(), null, 2));
    }

    // Check if a specific player is in any room
    const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();
    const firstPlayer = playersSnap.docs[0];
    console.log(`\n--- Checking player: ${firstPlayer.id} (${firstPlayer.data().name}) ---`);

    const playerRooms = await db.collection('chat_rooms')
        .where('participants', 'array-contains', firstPlayer.id)
        .get();
    console.log(`Player is in ${playerRooms.size} rooms:`);
    playerRooms.docs.forEach(d => {
        console.log(`  - ${d.id}: ${d.data().name} (${d.data().type})`);
    });
}

checkChatRooms().catch(console.error);
