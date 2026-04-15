/**
 * Fix Existing Triples Leagues
 * Syncs player involvements for leagues where players aren't seeing them on dashboard
 *
 * Usage:
 *   node fix-existing-triples-leagues.js LEAGUE_ID DIRECTOR_PIN
 *
 * Example:
 *   node fix-existing-triples-leagues.js abc123 12345678
 */

const fetch = require('node-fetch');

// Firebase Cloud Function URL
const FUNCTION_URL = 'https://us-central1-brdc-v2.cloudfunctions.net/syncLeaguePlayerInvolvements';

async function fixLeague(leagueId, directorPin) {
    console.log(`\nFixing league: ${leagueId}`);
    console.log('Calling syncLeaguePlayerInvolvements...\n');

    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                league_id: leagueId,
                pin: directorPin
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ SUCCESS!');
            console.log(`Message: ${result.message}`);
            console.log('\nPlayers should now see this league on their dashboard.');
        } else {
            console.log('❌ FAILED!');
            console.log(`Error: ${result.error}`);
        }

        return result;

    } catch (error) {
        console.log('❌ ERROR calling function!');
        console.log(`Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('\n❌ Missing arguments!');
    console.log('\nUsage: node fix-existing-triples-leagues.js LEAGUE_ID DIRECTOR_PIN');
    console.log('\nExample: node fix-existing-triples-leagues.js abc123 12345678');
    console.log('\nThe DIRECTOR_PIN is the 8-digit PIN of the league director.');
    process.exit(1);
}

const [leagueId, directorPin] = args;

// Validate PIN format
if (!/^\d{8}$/.test(directorPin)) {
    console.log('\n❌ Invalid PIN format!');
    console.log('PIN must be exactly 8 digits.');
    process.exit(1);
}

// Run the fix
fixLeague(leagueId, directorPin)
    .then(() => {
        console.log('\nDone!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nUnexpected error:', error);
        process.exit(1);
    });
