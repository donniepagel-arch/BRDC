/**
 * BRDC Overnight Testing Suite
 * Comprehensive validation of cloud functions, data integrity, and stats
 */

const admin = require('firebase-admin');
const https = require('https');
const http = require('http');

// Initialize Firebase Admin
const serviceAccount = require('../service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const BASE_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';
const HOSTING_URL = 'https://brdc-v2.web.app';

// Test results storage
const results = {
    startTime: new Date().toISOString(),
    endpointTests: [],
    dataIntegrity: [],
    statsValidation: [],
    pageTests: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
};

// Helper to make HTTP requests
function testEndpoint(functionName, method = 'POST', body = {}) {
    return new Promise((resolve) => {
        const url = `${BASE_URL}/${functionName}`;
        const startTime = Date.now();

        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                const passed = res.statusCode >= 200 && res.statusCode < 500;
                resolve({
                    function: functionName,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    passed,
                    response: data.substring(0, 200)
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                function: functionName,
                status: 'ERROR',
                error: err.message,
                passed: false
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                function: functionName,
                status: 'TIMEOUT',
                passed: false
            });
        });

        if (method === 'POST') {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// Test a page loads
function testPage(path) {
    return new Promise((resolve) => {
        const url = `${HOSTING_URL}${path}`;
        const startTime = Date.now();

        https.get(url, { timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                const hasError = data.includes('Error') || data.includes('error') || data.includes('undefined');
                resolve({
                    page: path,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    passed: res.statusCode === 200,
                    hasJsErrors: hasError,
                    size: `${(data.length / 1024).toFixed(1)}KB`
                });
            });
        }).on('error', (err) => {
            resolve({
                page: path,
                status: 'ERROR',
                error: err.message,
                passed: false
            });
        });
    });
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testCloudFunctions() {
    console.log('\n=== CLOUD FUNCTION HEALTH CHECK ===\n');

    const criticalFunctions = [
        { name: 'globalLogin', body: { pin: '00000000' } },
        { name: 'getDashboardData', body: { player_id: 'test' } },
        { name: 'getLeagueStandings', body: { league_id: 'test' } },
        { name: 'getKnockout', body: { id: 'test' } },
        { name: 'getNotablePerformances', body: { days: 7 } },
        { name: 'getFeedback', body: { status: 'all' } },
        { name: 'getMatchmakerStatus', body: { tournament_id: 'test' } },
        { name: 'searchPlayers', body: { query: 'test' } },
        { name: 'getOnlinePlayers', body: {} },
        { name: 'getGlobalLeaderboard', body: {} }
    ];

    for (const fn of criticalFunctions) {
        const result = await testEndpoint(fn.name, 'POST', fn.body);
        results.endpointTests.push(result);

        const status = result.passed ? '✓' : '✗';
        console.log(`${status} ${fn.name}: ${result.status} (${result.duration})`);

        if (result.passed) results.summary.passed++;
        else results.summary.failed++;
    }
}

async function testDataIntegrity() {
    console.log('\n=== DATA INTEGRITY SCAN ===\n');

    // Check for orphaned team players (players in teams that don't exist in players collection)
    console.log('Checking for data consistency...');

    try {
        // Count collections
        const leaguesSnap = await db.collection('leagues').get();
        const tournamentsSnap = await db.collection('tournaments').get();
        const playersSnap = await db.collection('players').get();
        const knockoutsSnap = await db.collection('knockouts').get();

        results.dataIntegrity.push({
            check: 'Collection Counts',
            leagues: leaguesSnap.size,
            tournaments: tournamentsSnap.size,
            players: playersSnap.size,
            knockouts: knockoutsSnap.size,
            passed: true
        });
        console.log(`✓ Leagues: ${leaguesSnap.size}, Tournaments: ${tournamentsSnap.size}, Players: ${playersSnap.size}, Knockouts: ${knockoutsSnap.size}`);
        results.summary.passed++;

        // Check for leagues with missing directors
        let orphanedLeagues = 0;
        for (const leagueDoc of leaguesSnap.docs) {
            const league = leagueDoc.data();
            if (league.director_player_id) {
                const directorDoc = await db.collection('players').doc(league.director_player_id).get();
                if (!directorDoc.exists) {
                    orphanedLeagues++;
                }
            }
        }

        if (orphanedLeagues > 0) {
            results.dataIntegrity.push({
                check: 'Orphaned League Directors',
                count: orphanedLeagues,
                passed: false
            });
            console.log(`✗ Found ${orphanedLeagues} leagues with missing director references`);
            results.summary.warnings++;
        } else {
            results.dataIntegrity.push({
                check: 'League Director References',
                passed: true
            });
            console.log('✓ All league director references valid');
            results.summary.passed++;
        }

        // Check for active leagues with teams
        let leaguesWithoutTeams = 0;
        for (const leagueDoc of leaguesSnap.docs) {
            const league = leagueDoc.data();
            if (league.status === 'active') {
                const teamsSnap = await db.collection('leagues').doc(leagueDoc.id).collection('teams').get();
                if (teamsSnap.size === 0) {
                    leaguesWithoutTeams++;
                }
            }
        }

        if (leaguesWithoutTeams > 0) {
            results.dataIntegrity.push({
                check: 'Active Leagues Without Teams',
                count: leaguesWithoutTeams,
                passed: false
            });
            console.log(`! ${leaguesWithoutTeams} active leagues have no teams`);
            results.summary.warnings++;
        } else {
            console.log('✓ All active leagues have teams');
            results.summary.passed++;
        }

    } catch (error) {
        results.dataIntegrity.push({
            check: 'Data Integrity Scan',
            error: error.message,
            passed: false
        });
        console.log(`✗ Error during data scan: ${error.message}`);
        results.summary.failed++;
    }
}

async function testStatsValidation() {
    console.log('\n=== STATS VALIDATION ===\n');

    try {
        // Get active leagues and spot-check stats
        const activeLeagues = await db.collection('leagues')
            .where('status', 'in', ['active', 'playoffs'])
            .limit(3)
            .get();

        for (const leagueDoc of activeLeagues.docs) {
            const league = leagueDoc.data();
            const leagueId = leagueDoc.id;
            console.log(`Checking: ${league.league_name || leagueId}`);

            // Get stats collection
            const statsSnap = await db.collection('leagues').doc(leagueId).collection('stats').get();

            let invalidStats = 0;
            for (const statDoc of statsSnap.docs) {
                const stats = statDoc.data();

                // Check for NaN or invalid values
                if (isNaN(stats.x01_total_darts) || isNaN(stats.x01_total_points)) {
                    invalidStats++;
                }

                // Check for negative values
                if (stats.x01_legs_played < 0 || stats.x01_legs_won < 0) {
                    invalidStats++;
                }
            }

            if (invalidStats > 0) {
                results.statsValidation.push({
                    league: league.league_name || leagueId,
                    invalidStats,
                    passed: false
                });
                console.log(`  ✗ Found ${invalidStats} players with invalid stats`);
                results.summary.warnings++;
            } else {
                results.statsValidation.push({
                    league: league.league_name || leagueId,
                    playerCount: statsSnap.size,
                    passed: true
                });
                console.log(`  ✓ ${statsSnap.size} players with valid stats`);
                results.summary.passed++;
            }
        }

    } catch (error) {
        results.statsValidation.push({
            check: 'Stats Validation',
            error: error.message,
            passed: false
        });
        console.log(`✗ Error validating stats: ${error.message}`);
        results.summary.failed++;
    }
}

async function testPages() {
    console.log('\n=== PAGE LOAD TESTS ===\n');

    const pages = [
        '/',
        '/pages/dashboard.html',
        '/pages/game-setup.html',
        '/pages/x01.html',
        '/pages/cricket.html',
        '/pages/leagues.html',
        '/pages/tournaments.html',
        '/pages/player-lookup.html',
        '/pages/knockout.html',
        '/pages/matchmaker-register.html'
    ];

    for (const page of pages) {
        const result = await testPage(page);
        results.pageTests.push(result);

        const status = result.passed ? '✓' : '✗';
        const warning = result.hasJsErrors ? ' (possible JS errors)' : '';
        console.log(`${status} ${page}: ${result.status} (${result.duration})${warning}`);

        if (result.passed) results.summary.passed++;
        else results.summary.failed++;
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           BRDC OVERNIGHT TESTING SUITE                     ║');
    console.log('║           Started: ' + new Date().toLocaleString() + '                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    await testCloudFunctions();
    await testDataIntegrity();
    await testStatsValidation();
    await testPages();

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`✓ Passed:   ${results.summary.passed}`);
    console.log(`✗ Failed:   ${results.summary.failed}`);
    console.log(`! Warnings: ${results.summary.warnings}`);
    console.log(`\nCompleted: ${new Date().toLocaleString()}`);

    results.endTime = new Date().toISOString();

    // Write results to file
    const fs = require('fs');
    const resultsPath = './test-results-' + new Date().toISOString().split('T')[0] + '.json';
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${resultsPath}`);

    process.exit(results.summary.failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
