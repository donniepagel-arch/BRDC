/**
 * Create chat rooms for a league using Firebase Admin SDK.
 * Creates:
 *   1. A league-wide chat room (all players)
 *   2. A team chat room per team (team players only)
 *
 * Uses player team_id queries (correct per data model) instead of team.player_ids (bug).
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function createLeagueChatRooms() {
    console.log(`Creating chat rooms for league: ${LEAGUE_ID}`);

    // Get league data
    const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();
    if (!leagueDoc.exists) {
        console.error('League not found!');
        return;
    }
    const league = leagueDoc.data();
    const leagueName = league.league_name || league.name || 'League';
    console.log(`League: ${leagueName}`);

    // Get all players
    const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();
    const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allPlayerIds = allPlayers.map(p => p.id);
    console.log(`Found ${allPlayers.length} players`);

    // Get all teams
    const teamsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('teams').get();
    const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${teams.length} teams`);

    // 1. Create league-wide chat room (if not exists)
    const existingLeague = await db.collection('chat_rooms')
        .where('league_id', '==', LEAGUE_ID)
        .where('type', '==', 'league')
        .limit(1)
        .get();

    if (existingLeague.empty) {
        const ref = await db.collection('chat_rooms').add({
            type: 'league',
            name: `${leagueName} Chat`,
            league_id: LEAGUE_ID,
            team_id: null,
            match_id: null,
            participants: allPlayerIds,
            participant_count: allPlayerIds.length,
            admins: [],
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            last_message: null,
            unread_count: {},
            status: 'active'
        });

        // Add welcome message
        await ref.collection('messages').add({
            sender_id: 'system',
            sender_name: 'System',
            text: `Welcome to ${leagueName} chat!`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'system',
            pinned: false
        });

        console.log(`Created league chat: ${ref.id}`);
    } else {
        console.log(`League chat already exists: ${existingLeague.docs[0].id}`);
    }

    // 2. Create team chat rooms
    for (const team of teams) {
        const existingTeam = await db.collection('chat_rooms')
            .where('league_id', '==', LEAGUE_ID)
            .where('team_id', '==', team.id)
            .where('type', '==', 'team')
            .limit(1)
            .get();

        if (existingTeam.empty) {
            // Get team players by querying players with matching team_id (CORRECT approach)
            const teamPlayers = allPlayers.filter(p => p.team_id === team.id);
            const teamPlayerIds = teamPlayers.map(p => p.id);

            // Also add captain if not already included
            if (team.captain_id && !teamPlayerIds.includes(team.captain_id)) {
                teamPlayerIds.push(team.captain_id);
            }

            const ref = await db.collection('chat_rooms').add({
                type: 'team',
                name: `${team.name} Team Chat`,
                league_id: LEAGUE_ID,
                team_id: team.id,
                match_id: null,
                participants: teamPlayerIds,
                participant_count: teamPlayerIds.length,
                admins: team.captain_id ? [team.captain_id] : [],
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                last_message: null,
                unread_count: {},
                status: 'active'
            });

            // Add welcome message
            await ref.collection('messages').add({
                sender_id: 'system',
                sender_name: 'System',
                text: `Welcome to ${team.name} team chat!`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'system',
                pinned: false
            });

            console.log(`Created team chat for ${team.name}: ${ref.id} (${teamPlayerIds.length} players)`);
        } else {
            console.log(`Team chat already exists for ${team.name}: ${existingTeam.docs[0].id}`);
        }
    }

    console.log('\nDone! Chat rooms created successfully.');
}

createLeagueChatRooms().catch(console.error);
