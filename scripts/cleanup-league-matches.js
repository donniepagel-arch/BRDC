/**
 * CLEANUP LEAGUE MATCHES - Winter Triple Draft
 *
 * Removes all match data and resets stats while preserving:
 * - League configuration
 * - Player registrations
 * - Team rosters
 * - Draft results
 *
 * Usage: node scripts/cleanup-league-matches.js LEAGUE_ID DIRECTOR_PIN
 * Example: node scripts/cleanup-league-matches.js aOq4Y0ETxPZ66tM1uUtP 39632911
 */

const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Configuration
const LEAGUE_ID = process.argv[2];
const DIRECTOR_PIN = process.argv[3];
const BACKUP_DIR = './backups';

// Validate arguments
if (!LEAGUE_ID || !DIRECTOR_PIN) {
    console.error('\n❌ Missing arguments!');
    console.error('\nUsage: node scripts/cleanup-league-matches.js LEAGUE_ID DIRECTOR_PIN');
    console.error('Example: node scripts/cleanup-league-matches.js aOq4Y0ETxPZ66tM1uUtP 39632911\n');
    process.exit(1);
}

// Stats fields to reset to 0
const STATS_FIELDS_TO_RESET = {
    // X01 Stats
    x01_legs_played: 0,
    x01_legs_won: 0,
    x01_total_darts: 0,
    x01_total_points: 0,
    x01_tons: 0,
    x01_ton_00: 0,
    x01_ton_20: 0,
    x01_ton_40: 0,
    x01_ton_60: 0,
    x01_ton_80: 0,
    x01_first9_darts: 0,
    x01_first9_points: 0,
    x01_first_turn_total: 0,
    x01_first_turn_count: 0,
    x01_high_checkout: 0,
    x01_checkouts_hit: 0,
    x01_checkout_attempts: 0,
    x01_checkout_darts: 0,
    x01_total_checkout_points: 0,
    x01_co_80_hits: 0,
    x01_co_80_attempts: 0,
    x01_co_120_hits: 0,
    x01_co_120_attempts: 0,
    x01_co_140_hits: 0,
    x01_co_140_attempts: 0,
    x01_co_161_hits: 0,
    x01_co_161_attempts: 0,
    x01_high_score: 0,
    x01_high_straight_in: 0,
    x01_best_leg: 0,
    x01_legs_with_darts: 0,
    x01_legs_with_darts_won: 0,
    x01_legs_against_darts: 0,
    x01_legs_against_darts_won: 0,
    x01_opponent_points_total: 0,
    x01_opponent_darts_total: 0,

    // Cricket Stats
    cricket_legs_played: 0,
    cricket_legs_won: 0,
    cricket_total_marks: 0,
    cricket_total_darts: 0,
    cricket_total_rounds: 0,
    cricket_missed_darts: 0,
    cricket_triple_bull_darts: 0,
    cricket_five_mark_rounds: 0,
    cricket_six_mark_rounds: 0,
    cricket_seven_mark_rounds: 0,
    cricket_eight_mark_rounds: 0,
    cricket_nine_mark_rounds: 0,
    cricket_three_bulls: 0,
    cricket_four_bulls: 0,
    cricket_five_bulls: 0,
    cricket_six_bulls: 0,
    cricket_hat_tricks: 0,
    cricket_legs_with_darts: 0,
    cricket_legs_with_darts_won: 0,
    cricket_legs_against_darts: 0,
    cricket_legs_against_darts_won: 0,
    cricket_high_mark_round: 0,
    cricket_low_rounds: 0,

    // Match Stats
    games_played: 0,
    games_won: 0,
    matches_played: 0,
    matches_won: 0
};

// Main cleanup function
async function cleanupLeague() {
    console.log('\n' + '='.repeat(60));
    console.log('WINTER TRIPLE DRAFT - MATCH DATA CLEANUP');
    console.log('='.repeat(60) + '\n');

    console.log(`League ID: ${LEAGUE_ID}`);
    console.log(`Director PIN: ${'*'.repeat(8)}\n`);

    try {
        // Step 1: Verify league exists and PIN is correct
        console.log('📋 Step 1: Verifying league and director access...');
        const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();

        if (!leagueDoc.exists) {
            throw new Error(`League ${LEAGUE_ID} not found`);
        }

        const leagueData = leagueDoc.data();

        // Check PIN (admin_pin or director_pin)
        if (leagueData.admin_pin !== DIRECTOR_PIN && leagueData.director_pin !== DIRECTOR_PIN) {
            throw new Error('Invalid director PIN');
        }

        console.log(`✅ League verified: ${leagueData.league_name}\n`);

        // Step 2: Create backup
        console.log('💾 Step 2: Creating backup...');
        await createBackup(LEAGUE_ID, leagueData);
        console.log('✅ Backup created\n');

        // Step 3: Delete matches collection
        console.log('🗑️  Step 3: Deleting all matches...');
        const matchesDeleted = await deleteCollection(`leagues/${LEAGUE_ID}/matches`);
        console.log(`✅ Deleted ${matchesDeleted} matches\n`);

        // Step 4: Reset player stats
        console.log('📊 Step 4: Resetting player stats...');
        const statsReset = await resetPlayerStats(LEAGUE_ID);
        console.log(`✅ Reset stats for ${statsReset} players\n`);

        // Step 5: Reset team standings
        console.log('🏆 Step 5: Resetting team standings...');
        const teamsReset = await resetTeamStandings(LEAGUE_ID);
        console.log(`✅ Reset standings for ${teamsReset} teams\n`);

        // Step 6: Delete audit log (optional)
        console.log('📝 Step 6: Clearing audit log...');
        const auditDeleted = await deleteCollection(`leagues/${LEAGUE_ID}/audit_log`);
        console.log(`✅ Deleted ${auditDeleted} audit entries\n`);

        // Final summary
        console.log('='.repeat(60));
        console.log('✅ CLEANUP COMPLETE!');
        console.log('='.repeat(60));
        console.log('\nSummary:');
        console.log(`  - Matches deleted: ${matchesDeleted}`);
        console.log(`  - Players reset: ${statsReset}`);
        console.log(`  - Teams reset: ${teamsReset}`);
        console.log(`  - Audit entries deleted: ${auditDeleted}`);
        console.log('\nPreserved:');
        console.log('  ✅ League configuration');
        console.log('  ✅ Player registrations');
        console.log('  ✅ Team rosters');
        console.log('  ✅ Draft results');
        console.log(`\nBackup saved to: ${BACKUP_DIR}/league-${LEAGUE_ID}-${new Date().toISOString().split('T')[0]}.json\n`);

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }
}

// Create backup of current data
async function createBackup(leagueId, leagueData) {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const backup = {
        league: leagueData,
        matches: [],
        stats: [],
        teams: [],
        timestamp: new Date().toISOString()
    };

    // Backup matches
    const matchesSnap = await db.collection('leagues').doc(leagueId).collection('matches').get();
    matchesSnap.forEach(doc => {
        backup.matches.push({ id: doc.id, ...doc.data() });
    });

    // Backup stats
    const statsSnap = await db.collection('leagues').doc(leagueId).collection('stats').get();
    statsSnap.forEach(doc => {
        backup.stats.push({ id: doc.id, ...doc.data() });
    });

    // Backup teams
    const teamsSnap = await db.collection('leagues').doc(leagueId).collection('teams').get();
    teamsSnap.forEach(doc => {
        backup.teams.push({ id: doc.id, ...doc.data() });
    });

    const filename = `${BACKUP_DIR}/league-${leagueId}-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    return filename;
}

// Delete a collection in batches
async function deleteCollection(collectionPath) {
    const batchSize = 100;
    let deletedCount = 0;

    const query = db.doc(`leagues/${LEAGUE_ID}`).collection(collectionPath.split('/').pop());

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, batchSize, resolve, reject).catch(reject);
    });

    async function deleteQueryBatch(query, batchSize, resolve, reject) {
        const snapshot = await query.limit(batchSize).get();

        if (snapshot.size === 0) {
            resolve(deletedCount);
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();

        // Recurse on the next batch
        process.nextTick(() => {
            deleteQueryBatch(query, batchSize, resolve, reject);
        });
    }
}

// Reset player stats to 0
async function resetPlayerStats(leagueId) {
    const statsSnap = await db.collection('leagues').doc(leagueId).collection('stats').get();

    let resetCount = 0;
    const batch = db.batch();

    statsSnap.forEach(doc => {
        batch.update(doc.ref, STATS_FIELDS_TO_RESET);
        resetCount++;
    });

    if (resetCount > 0) {
        await batch.commit();
    }

    return resetCount;
}

// Reset team standings
async function resetTeamStandings(leagueId) {
    const teamsSnap = await db.collection('leagues').doc(leagueId).collection('teams').get();

    let resetCount = 0;
    const batch = db.batch();

    teamsSnap.forEach(doc => {
        batch.update(doc.ref, {
            wins: 0,
            losses: 0,
            ties: 0,
            points: 0,
            games_won: 0,
            games_lost: 0
        });
        resetCount++;
    });

    if (resetCount > 0) {
        await batch.commit();
    }

    return resetCount;
}

// Run the cleanup
cleanupLeague();
