/**
 * Fix "undefined Team Chat" room names.
 * Teams use `team_name` not `name`.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function fixTeamChatNames() {
    // Get all teams
    const teamsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('teams').get();
    const teamsById = {};
    teamsSnap.docs.forEach(d => {
        teamsById[d.id] = d.data().team_name || d.data().name || 'Unknown Team';
    });

    // Get all team chat rooms for this league
    const roomsSnap = await db.collection('chat_rooms')
        .where('league_id', '==', LEAGUE_ID)
        .where('type', '==', 'team')
        .get();

    for (const roomDoc of roomsSnap.docs) {
        const data = roomDoc.data();
        const teamName = teamsById[data.team_id];
        if (teamName && data.name !== `${teamName} Team Chat`) {
            await roomDoc.ref.update({ name: `${teamName} Team Chat` });
            console.log(`Fixed: ${roomDoc.id} → "${teamName} Team Chat"`);
        } else {
            console.log(`OK: ${roomDoc.id} → "${data.name}"`);
        }
    }

    // Also fix the empty-participant room that was created before
    const emptyRooms = roomsSnap.docs.filter(d => !d.data().participants || d.data().participants.length === 0);
    if (emptyRooms.length > 0) {
        const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();
        const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const roomDoc of emptyRooms) {
            const data = roomDoc.data();
            const teamPlayers = allPlayers.filter(p => p.team_id === data.team_id);
            const teamPlayerIds = teamPlayers.map(p => p.id);
            if (teamPlayerIds.length > 0) {
                await roomDoc.ref.update({
                    participants: teamPlayerIds,
                    participant_count: teamPlayerIds.length
                });
                console.log(`Fixed participants for ${roomDoc.id}: ${teamPlayerIds.length} players`);
            }
        }
    }

    console.log('\nDone!');
}

fixTeamChatNames().catch(console.error);
