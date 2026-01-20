/**
 * Import updated match JSON files to Firestore
 * Run with: node import-matches.js
 *
 * Requires: Firebase CLI login (firebase login) or gcloud auth
 */

const admin = require('../functions/node_modules/firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with application default credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();

// Match files to import
const MATCH_FILES = [
    {
        file: 'mpagel_v_dpagel_wk1_updated.json',
        matchId: 'SHOA7GXK51JvJ3gkaN7J',
        leagueId: 'aOq4Y0ETxPZ66tM1uUtP'
    },
    {
        file: 'yasenchak_v_kull_wk1_updated.json',
        matchId: null, // Will need to look up or create
        leagueId: 'aOq4Y0ETxPZ66tM1uUtP'
    },
    {
        file: 'partlo_v_volschansky_wk1_updated.json',
        matchId: null,
        leagueId: 'aOq4Y0ETxPZ66tM1uUtP'
    },
    {
        file: 'ragnoni_v_massimiani_wk1_updated.json',
        matchId: null,
        leagueId: 'aOq4Y0ETxPZ66tM1uUtP'
    },
    {
        file: 'russano_v_mezlak_wk1_updated.json',
        matchId: null,
        leagueId: 'aOq4Y0ETxPZ66tM1uUtP'
    }
];

// Find match by home/away team names
async function findMatchByTeams(leagueId, homeTeam, awayTeam, week) {
    const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');

    // Try to find by team names
    const snapshot = await matchesRef
        .where('week', '==', week)
        .get();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const homeMatch = data.home_team_name?.toUpperCase().includes(homeTeam.toUpperCase()) ||
                         homeTeam.toUpperCase().includes(data.home_team_name?.toUpperCase());
        const awayMatch = data.away_team_name?.toUpperCase().includes(awayTeam.toUpperCase()) ||
                         awayTeam.toUpperCase().includes(data.away_team_name?.toUpperCase());

        if (homeMatch && awayMatch) {
            return doc.id;
        }
    }

    return null;
}

// Convert our JSON format to Firestore format
function convertToFirestoreFormat(matchData) {
    const firestoreGames = matchData.games.map((game, idx) => ({
        game: game.game_number,
        type: game.type,
        format: game.format,
        home_players: game.home_players,
        away_players: game.away_players,
        home_legs_won: game.result.home_legs,
        away_legs_won: game.result.away_legs,
        winner: game.winner,
        status: 'completed',
        legs: game.legs.map(leg => ({
            leg_number: leg.leg_number,
            format: leg.format,
            winner: leg.winner,
            home_stats: leg.home_stats,
            away_stats: leg.away_stats,
            player_stats: leg.player_stats,
            throws: leg.throws
        }))
    }));

    return {
        games: firestoreGames,
        home_score: matchData.final_score.home,
        away_score: matchData.final_score.away,
        total_darts: matchData.total_darts,
        total_legs: matchData.total_legs,
        status: 'completed',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
}

async function importMatch(config) {
    const filePath = path.join(__dirname, config.file);

    if (!fs.existsSync(filePath)) {
        console.log(`  Skipping ${config.file} - file not found`);
        return false;
    }

    console.log(`\nProcessing: ${config.file}`);

    const matchData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let matchId = config.matchId;

    // If no matchId, try to find it
    if (!matchId) {
        matchId = await findMatchByTeams(
            config.leagueId,
            matchData.home_team,
            matchData.away_team,
            matchData.week
        );

        if (!matchId) {
            console.log(`  Could not find match for ${matchData.home_team} vs ${matchData.away_team}`);
            return false;
        }
        console.log(`  Found match ID: ${matchId}`);
    }

    // Convert and update
    const firestoreData = convertToFirestoreFormat(matchData);

    try {
        await db.collection('leagues')
            .doc(config.leagueId)
            .collection('matches')
            .doc(matchId)
            .update(firestoreData);

        console.log(`  Updated: ${matchData.home_team} vs ${matchData.away_team}`);
        console.log(`    Games: ${firestoreData.games.length}`);
        console.log(`    Total legs: ${firestoreData.total_legs}`);
        console.log(`    Final score: ${firestoreData.home_score}-${firestoreData.away_score}`);
        return true;
    } catch (error) {
        console.error(`  Error updating match: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('=== Importing Updated Match Data to Firestore ===');
    console.log('Project: brdc-v2');
    console.log('League: aOq4Y0ETxPZ66tM1uUtP\n');

    let success = 0;
    let failed = 0;

    for (const config of MATCH_FILES) {
        const result = await importMatch(config);
        if (result) {
            success++;
        } else {
            failed++;
        }
    }

    console.log('\n=== Import Complete ===');
    console.log(`Success: ${success}`);
    console.log(`Failed: ${failed}`);

    // Exit process
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
