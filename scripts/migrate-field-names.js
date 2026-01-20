/**
 * Migration Script: Standardize Field Names
 *
 * This script updates existing Firestore documents to use canonical field names.
 * Run with: node scripts/migrate-field-names.js
 *
 * Safe to run multiple times - checks for old fields before updating.
 */

const admin = require('firebase-admin');

// Initialize with application default credentials or service account
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

// Field mappings: old -> new
const STATS_FIELD_MAPPINGS = {
    'x01_3da': 'x01_three_dart_avg',
    'x01_avg': 'x01_three_dart_avg',
    'three_dart_avg': 'x01_three_dart_avg',
    'ppd': 'x01_three_dart_avg',
    'avg': 'x01_three_dart_avg',
    'x01_first9_avg': 'x01_first_9_avg',
    'first_9_avg': 'x01_first_9_avg',
    'x01_avg_finish': 'x01_avg_checkout',
    'avg_finish': 'x01_avg_checkout',
    'mpr': 'cricket_mpr'
};

// Team field mappings
const TEAM_FIELD_MAPPINGS = {
    'name': 'team_name'  // Only on team docs, not player docs
};

let totalUpdated = 0;
let totalSkipped = 0;

async function migrateDocument(docRef, data, fieldMappings, docType) {
    const updates = {};
    const deletes = {};
    let hasChanges = false;

    for (const [oldField, newField] of Object.entries(fieldMappings)) {
        // Skip if old field doesn't exist
        if (data[oldField] === undefined) continue;

        // Skip if new field already has a value (don't overwrite)
        if (data[newField] !== undefined && data[newField] !== null) {
            // Just delete the old field if new exists
            deletes[oldField] = admin.firestore.FieldValue.delete();
            hasChanges = true;
            continue;
        }

        // Copy value to new field, delete old field
        updates[newField] = data[oldField];
        deletes[oldField] = admin.firestore.FieldValue.delete();
        hasChanges = true;
    }

    if (hasChanges) {
        try {
            await docRef.update({ ...updates, ...deletes });
            totalUpdated++;
            console.log(`  Updated ${docType}: ${docRef.path}`);
            return true;
        } catch (error) {
            console.error(`  Error updating ${docRef.path}:`, error.message);
            return false;
        }
    }

    totalSkipped++;
    return false;
}

async function migrateLeagueStats(leagueId) {
    console.log(`\nMigrating league stats: ${leagueId}`);

    // Migrate aggregated_stats collection
    const aggStatsSnap = await db.collection('leagues').doc(leagueId)
        .collection('aggregated_stats').get();

    for (const doc of aggStatsSnap.docs) {
        await migrateDocument(doc.ref, doc.data(), STATS_FIELD_MAPPINGS, 'aggregated_stats');
    }

    // Migrate stats collection
    const statsSnap = await db.collection('leagues').doc(leagueId)
        .collection('stats').get();

    for (const doc of statsSnap.docs) {
        await migrateDocument(doc.ref, doc.data(), STATS_FIELD_MAPPINGS, 'stats');
    }
}

async function migrateLeagueTeams(leagueId) {
    console.log(`\nMigrating league teams: ${leagueId}`);

    const teamsSnap = await db.collection('leagues').doc(leagueId)
        .collection('teams').get();

    for (const doc of teamsSnap.docs) {
        const data = doc.data();

        // Special handling: only migrate 'name' to 'team_name' if team_name doesn't exist
        if (data.name && !data.team_name) {
            await doc.ref.update({
                team_name: data.name,
                name: admin.firestore.FieldValue.delete()
            });
            totalUpdated++;
            console.log(`  Updated team: ${doc.ref.path}`);
        }
    }
}

async function migrateLeaguePlayers(leagueId) {
    console.log(`\nMigrating league players: ${leagueId}`);

    const playersSnap = await db.collection('leagues').doc(leagueId)
        .collection('players').get();

    for (const doc of playersSnap.docs) {
        // Players might have embedded stats
        await migrateDocument(doc.ref, doc.data(), STATS_FIELD_MAPPINGS, 'league_player');
    }
}

async function migrateGlobalPlayers() {
    console.log('\nMigrating global players collection...');

    const playersSnap = await db.collection('players').get();

    for (const doc of playersSnap.docs) {
        const data = doc.data();

        // Check for stats nested object
        if (data.stats) {
            const statsUpdates = {};
            let hasStatsChanges = false;

            for (const [oldField, newField] of Object.entries(STATS_FIELD_MAPPINGS)) {
                if (data.stats[oldField] !== undefined && data.stats[newField] === undefined) {
                    statsUpdates[`stats.${newField}`] = data.stats[oldField];
                    statsUpdates[`stats.${oldField}`] = admin.firestore.FieldValue.delete();
                    hasStatsChanges = true;
                }
            }

            if (hasStatsChanges) {
                try {
                    await doc.ref.update(statsUpdates);
                    totalUpdated++;
                    console.log(`  Updated player stats: ${doc.ref.path}`);
                } catch (error) {
                    console.error(`  Error updating ${doc.ref.path}:`, error.message);
                }
            }
        }
    }
}

async function migrateBots() {
    console.log('\nMigrating bots collection...');

    const botsSnap = await db.collection('bots').get();

    for (const doc of botsSnap.docs) {
        const data = doc.data();
        const updates = {};
        let hasChanges = false;

        // Check x01_skills nested object
        if (data.x01_skills) {
            if (data.x01_skills.three_dart_avg !== undefined &&
                data.x01_skills.x01_three_dart_avg === undefined) {
                updates['x01_skills.x01_three_dart_avg'] = data.x01_skills.three_dart_avg;
                updates['x01_skills.three_dart_avg'] = admin.firestore.FieldValue.delete();
                hasChanges = true;
            }
        }

        // Check x01_stats nested object
        if (data.x01_stats) {
            if (data.x01_stats.three_dart_avg !== undefined &&
                data.x01_stats.x01_three_dart_avg === undefined) {
                updates['x01_stats.x01_three_dart_avg'] = data.x01_stats.three_dart_avg;
                updates['x01_stats.three_dart_avg'] = admin.firestore.FieldValue.delete();
                hasChanges = true;
            }
        }

        if (hasChanges) {
            try {
                await doc.ref.update(updates);
                totalUpdated++;
                console.log(`  Updated bot: ${doc.ref.path}`);
            } catch (error) {
                console.error(`  Error updating ${doc.ref.path}:`, error.message);
            }
        }
    }
}

async function migrateTournamentStats() {
    console.log('\nMigrating tournament stats...');

    const tournamentsSnap = await db.collection('tournaments').get();

    for (const tournamentDoc of tournamentsSnap.docs) {
        const matchesSnap = await tournamentDoc.ref.collection('matches').get();

        for (const matchDoc of matchesSnap.docs) {
            const data = matchDoc.data();

            // Check for player_stats in match
            if (data.player_stats) {
                const updates = {};
                let hasChanges = false;

                for (const [playerId, stats] of Object.entries(data.player_stats)) {
                    for (const [oldField, newField] of Object.entries(STATS_FIELD_MAPPINGS)) {
                        if (stats[oldField] !== undefined && stats[newField] === undefined) {
                            updates[`player_stats.${playerId}.${newField}`] = stats[oldField];
                            updates[`player_stats.${playerId}.${oldField}`] = admin.firestore.FieldValue.delete();
                            hasChanges = true;
                        }
                    }
                }

                if (hasChanges) {
                    try {
                        await matchDoc.ref.update(updates);
                        totalUpdated++;
                        console.log(`  Updated tournament match: ${matchDoc.ref.path}`);
                    } catch (error) {
                        console.error(`  Error updating ${matchDoc.ref.path}:`, error.message);
                    }
                }
            }
        }
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('BRDC Field Names Migration');
    console.log('='.repeat(60));
    console.log('\nThis script will update documents to use canonical field names.');
    console.log('It is safe to run multiple times.\n');

    try {
        // Get all leagues
        const leaguesSnap = await db.collection('leagues').get();
        console.log(`Found ${leaguesSnap.size} leagues to process`);

        for (const leagueDoc of leaguesSnap.docs) {
            console.log(`\n${'='.repeat(40)}`);
            console.log(`Processing league: ${leagueDoc.id}`);
            console.log(`Name: ${leagueDoc.data().name || leagueDoc.data().league_name || 'Unknown'}`);

            await migrateLeagueStats(leagueDoc.id);
            await migrateLeagueTeams(leagueDoc.id);
            await migrateLeaguePlayers(leagueDoc.id);
        }

        // Migrate global collections
        await migrateGlobalPlayers();
        await migrateBots();
        await migrateTournamentStats();

        console.log('\n' + '='.repeat(60));
        console.log('Migration Complete!');
        console.log('='.repeat(60));
        console.log(`Documents updated: ${totalUpdated}`);
        console.log(`Documents skipped (already migrated): ${totalSkipped}`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
