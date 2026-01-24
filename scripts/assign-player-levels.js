/**
 * Assign Player Levels Script
 *
 * Updates the `level` field for all players in the Winter Triple Draft league
 * by looking at their team assignment and position.
 *
 * Position 1 = A, Position 2 = B, Position 3 = C
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin using Application Default Credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

// League ID for 2026 Winter Triple Draft
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function assignPlayerLevels() {
    console.log('=== Assigning Player Levels ===');
    console.log(`League: ${LEAGUE_ID}\n`);

    // First, get all teams to see the player-level mapping in team docs
    const teamsSnapshot = await db.collection('leagues').doc(LEAGUE_ID)
        .collection('teams').get();

    console.log(`Found ${teamsSnapshot.size} teams\n`);

    // Build a map of player ID -> level from team data
    const playerLevelMap = {};

    for (const teamDoc of teamsSnapshot.docs) {
        const team = teamDoc.data();
        console.log(`Team: ${team.team_name}`);

        if (team.players && Array.isArray(team.players)) {
            for (const player of team.players) {
                // Team player entries have { id, name, position, level }
                if (player.id && player.level) {
                    playerLevelMap[player.id] = player.level;
                    console.log(`  - ${player.name}: Level ${player.level} (from team doc)`);
                } else if (player.id && player.position) {
                    // Derive level from position
                    const posMap = { 1: 'A', 2: 'B', 3: 'C' };
                    const derivedLevel = posMap[player.position];
                    if (derivedLevel) {
                        playerLevelMap[player.id] = derivedLevel;
                        console.log(`  - ${player.name}: Level ${derivedLevel} (derived from position ${player.position})`);
                    }
                }
            }
        }
    }

    console.log(`\nBuilt level map for ${Object.keys(playerLevelMap).length} players\n`);

    // Now get all players in the league and update their level field
    const playersSnapshot = await db.collection('leagues').doc(LEAGUE_ID)
        .collection('players').get();

    console.log(`Found ${playersSnapshot.size} players in league\n`);

    const batch = db.batch();
    let updateCount = 0;
    let skippedCount = 0;
    let notOnTeamCount = 0;

    for (const playerDoc of playersSnapshot.docs) {
        const player = playerDoc.data();
        const playerId = playerDoc.id;

        // Check if we have a level from the team map
        let newLevel = playerLevelMap[playerId];

        // If not in team map, try to derive from player's position field
        if (!newLevel && player.position) {
            const posMap = { 1: 'A', 2: 'B', 3: 'C' };
            newLevel = posMap[player.position];
        }

        // Also check preferred_level or skill_level
        if (!newLevel && player.preferred_level && ['A', 'B', 'C'].includes(player.preferred_level)) {
            newLevel = player.preferred_level;
        }

        if (!newLevel && player.skill_level && ['A', 'B', 'C'].includes(player.skill_level)) {
            newLevel = player.skill_level;
        }

        if (newLevel) {
            const currentLevel = player.level;
            if (currentLevel === newLevel) {
                console.log(`  SKIP: ${player.name} - already has level ${currentLevel}`);
                skippedCount++;
            } else {
                console.log(`  UPDATE: ${player.name} - setting level to ${newLevel} (was: "${currentLevel || ''}")`);
                const playerRef = db.collection('leagues').doc(LEAGUE_ID)
                    .collection('players').doc(playerId);
                batch.update(playerRef, { level: newLevel });
                updateCount++;
            }
        } else {
            console.log(`  NO LEVEL: ${player.name} - not on a team or no position data`);
            notOnTeamCount++;
        }
    }

    if (updateCount > 0) {
        console.log(`\nCommitting batch update for ${updateCount} players...`);
        await batch.commit();
        console.log('Done!');
    } else {
        console.log('\nNo updates needed.');
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updateCount}`);
    console.log(`Already correct: ${skippedCount}`);
    console.log(`Not on team/no position: ${notOnTeamCount}`);

    process.exit(0);
}

assignPlayerLevels().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
