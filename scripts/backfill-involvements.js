/**
 * Backfill player involvements for sidebar "My Leagues" / "My Tournaments"
 *
 * Reads all leagues and tournaments, finds their players,
 * and updates each global player document with the involvements field.
 *
 * Usage: node scripts/backfill-involvements.js
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

async function backfillInvolvements() {
    console.log('=== Backfill Player Involvements ===\n');

    // Track all involvements per global player
    const playerInvolvements = {}; // playerId -> { leagues: [], tournaments: [] }

    // --- LEAGUES ---
    console.log('--- Processing Leagues ---');
    const leaguesSnap = await db.collection('leagues').get();
    console.log(`Found ${leaguesSnap.size} leagues\n`);

    for (const leagueDoc of leaguesSnap.docs) {
        const leagueData = leagueDoc.data();
        const leagueId = leagueDoc.id;
        const leagueName = leagueData.league_name || leagueData.name || 'Unknown League';
        console.log(`League: ${leagueName} (${leagueId})`);

        // Get teams for this league (for team_name lookup)
        const teamsSnap = await db.collection('leagues').doc(leagueId).collection('teams').get();
        const teamsById = {};
        teamsSnap.forEach(t => { teamsById[t.id] = t.data(); });

        // Get league players
        const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').get();
        console.log(`  ${playersSnap.size} players`);

        playersSnap.forEach(playerDoc => {
            const playerData = playerDoc.data();
            const playerId = playerDoc.id;
            const teamId = playerData.team_id;
            const teamName = (teamId && teamsById[teamId] ? (teamsById[teamId].team_name || teamsById[teamId].name) : '') || '';

            if (!playerInvolvements[playerId]) {
                playerInvolvements[playerId] = { leagues: [], tournaments: [] };
            }

            // Avoid duplicates
            const already = playerInvolvements[playerId].leagues.find(l => l.id === leagueId);
            if (!already) {
                playerInvolvements[playerId].leagues.push({
                    id: leagueId,
                    name: leagueName || '',
                    team_id: teamId || '',
                    team_name: teamName || '',
                    role: playerData.is_captain ? 'captain' : 'player',
                    added_at: new Date()
                });
            }
        });
    }

    // --- TOURNAMENTS ---
    console.log('\n--- Processing Tournaments ---');
    const tourneysSnap = await db.collection('tournaments').get();
    console.log(`Found ${tourneysSnap.size} tournaments\n`);

    for (const tourneyDoc of tourneysSnap.docs) {
        const tourneyData = tourneyDoc.data();
        const tourneyId = tourneyDoc.id;
        const tourneyName = tourneyData.name || tourneyData.tournament_name || 'Unknown Tournament';
        const eventName = tourneyData.event_name || '';
        console.log(`Tournament: ${tourneyName} (${tourneyId})`);

        // Get tournament players
        const playersSnap = await db.collection('tournaments').doc(tourneyId).collection('players').get();
        console.log(`  ${playersSnap.size} players`);

        playersSnap.forEach(playerDoc => {
            const playerId = playerDoc.id;
            const playerData = playerDoc.data();

            if (!playerInvolvements[playerId]) {
                playerInvolvements[playerId] = { leagues: [], tournaments: [] };
            }

            const already = playerInvolvements[playerId].tournaments.find(t => t.id === tourneyId);
            if (!already) {
                playerInvolvements[playerId].tournaments.push({
                    id: tourneyId,
                    name: tourneyName || '',
                    event_name: eventName || '',
                    status: playerData.status || 'registered',
                    registered_at: playerData.registered_at || new Date()
                });
            }
        });
    }

    // --- WRITE INVOLVEMENTS ---
    console.log('\n--- Writing Involvements to Global Player Docs ---');
    const playerIds = Object.keys(playerInvolvements);
    console.log(`${playerIds.length} players to update\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const playerId of playerIds) {
        const inv = playerInvolvements[playerId];
        const playerRef = db.collection('players').doc(playerId);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            console.log(`  SKIP: ${playerId} - global player doc not found`);
            notFound++;
            continue;
        }

        const existing = playerDoc.data().involvements || {};
        const merged = {
            leagues: inv.leagues,
            tournaments: inv.tournaments,
            directing: existing.directing || [],
            captaining: existing.captaining || []
        };

        await playerRef.update({ involvements: merged });
        const name = playerDoc.data().name || playerDoc.data().first_name || playerId;
        console.log(`  UPDATED: ${name} - ${inv.leagues.length} leagues, ${inv.tournaments.length} tournaments`);
        updated++;
    }

    console.log(`\n=== Done ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (no global doc): ${notFound}`);
    console.log(`Total players processed: ${playerIds.length}`);
}

backfillInvolvements().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
