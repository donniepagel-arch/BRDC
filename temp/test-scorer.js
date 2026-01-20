/**
 * Test Script for Scorer Throw Tracking
 * Verifies throw data is saved correctly in existing matches
 */

const https = require('https');

const BASE_URL = 'us-central1-brdc-v2.cloudfunctions.net';

function httpGet(path) {
    return new Promise((resolve, reject) => {
        https.get(`https://${BASE_URL}${path}`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('=== Scorer Throw Tracking Test ===\n');

    // Use the existing BRDC league for testing
    const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
    console.log('Using existing league:', leagueId);

    // Step 1: Get matches from the league
    console.log('\n1. Getting matches...');
    const matchesResult = await httpGet(`/listMatches?leagueId=${leagueId}&week=1`);

    if (!matchesResult.data.matches || matchesResult.data.matches.length === 0) {
        console.log('  No matches found');
        return;
    }

    // Find a match that we can test with (one that's completed and has data)
    const matches = matchesResult.data.matches;
    console.log('  Found', matches.length, 'matches');

    // Use the first match
    const match = matches[0];
    const matchId = match.matchId;
    console.log('  Using Match:', matchId);
    console.log('  Home:', match.homeTeam, 'vs Away:', match.awayTeam);
    console.log('  Status:', match.status);

    // Step 2: Get match details to see current throws
    console.log('\n2. Getting match details...');
    const detailsResult = await httpGet(`/getMatchDetails?leagueId=${leagueId}&matchId=${matchId}`);

    if (detailsResult.status === 200) {
        const summary = detailsResult.data;
        console.log('\n  === Match Summary ===');
        console.log('  Home:', summary.homeTeam);
        console.log('  Away:', summary.awayTeam);
        console.log('  Status:', summary.status);
        console.log('  Games:', summary.gamesCount);
        console.log('  Total Legs:', summary.totalLegs);
        console.log('  Total Darts:', summary.totalDarts);

        if (summary.games && summary.games.length > 0) {
            console.log('\n  === Games Detail ===');
            for (const game of summary.games) {
                console.log(`\n  Game ${game.game}:`);
                console.log('    Type:', game.type);
                console.log('    Format:', game.format);
                console.log('    Winner:', game.winner);
                console.log('    Legs:', game.legsCount);
                console.log('    Has Throws:', game.hasThrows);
                console.log('    Has Player Stats:', game.hasPlayerStats);

                if (game.sampleLeg) {
                    console.log('    Sample Leg:');
                    console.log('      Winner:', game.sampleLeg.winner);
                    console.log('      Throws Count:', game.sampleLeg.throwsCount);
                    console.log('      Player Stats:', game.sampleLeg.playerStatsKeys?.join(', ') || 'none');
                }
            }
        }
    } else {
        console.log('  Could not get details:', detailsResult.status, detailsResult.data);
    }

    console.log('\n=== Test Complete ===');
    console.log('\nView the match at:');
    console.log(`https://brdc-v2.web.app/pages/match-hub.html?league=${leagueId}&match=${matchId}`);
}

main().catch(console.error);
