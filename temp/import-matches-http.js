/**
 * Import match data via HTTP Cloud Functions
 * No authentication required - uses deployed Firebase functions
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Match files to import (match IDs from Firestore listing)
const MATCH_FILES = [
    { file: 'mpagel_v_dpagel_wk1_updated.json', matchId: 'SHOA7GXK51JvJ3gkaN7J' },      // MPAGEL vs DPAGEL
    { file: 'yasenchak_v_kull_wk1_updated.json', matchId: 'gp0eE8NDtHu02jALwIUt' },     // NKull vs KYasenchak
    { file: 'partlo_v_volschansky_wk1_updated.json', matchId: '2GlQBrvdY3yK8HsWhQ3R' }, // EOlschansky vs DPARTLO
    { file: 'ragnoni_v_massimiani_wk1_updated.json', matchId: 'eei0PZ1r6TDt4ACtdv6f' }, // JRagnoni vs Neon Nightmares
    { file: 'russano_v_mezlak_wk1_updated.json', matchId: 'eUNgycIyJT1wR9JSmW2d' }      // NMEZLAK vs DRUSSANO
];

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
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

async function findMatchId(homeTeam, awayTeam, week) {
    const url = `${BASE_URL}/findMatch?leagueId=${LEAGUE_ID}&homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&week=${week}`;
    const result = await httpGet(url);

    if (result.status === 200 && result.data.matchId) {
        return result.data.matchId;
    }
    return null;
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
        console.log(`  Looking up match: ${matchData.home_team} vs ${matchData.away_team}`);
        matchId = await findMatchId(matchData.home_team, matchData.away_team, matchData.week);

        if (!matchId) {
            console.log(`  Could not find match for ${matchData.home_team} vs ${matchData.away_team}`);
            return false;
        }
        console.log(`  Found match ID: ${matchId}`);
    }

    // Call import function
    const importUrl = `${BASE_URL}/importMatchData`;
    const result = await httpPost(importUrl, {
        matchId,
        leagueId: LEAGUE_ID,
        matchData
    });

    if (result.status === 200 && result.data.success) {
        console.log(`  SUCCESS: ${matchData.home_team} vs ${matchData.away_team}`);
        console.log(`    Games: ${result.data.games}, Legs: ${result.data.totalLegs}`);
        return true;
    } else {
        console.log(`  FAILED: ${result.data.error || JSON.stringify(result.data)}`);
        return false;
    }
}

async function listAllMatches() {
    console.log('=== Listing Week 1 Matches ===\n');
    const url = `${BASE_URL}/listMatches?leagueId=${LEAGUE_ID}&week=1`;
    const result = await httpGet(url);

    if (result.status === 200 && result.data.matches) {
        for (const match of result.data.matches) {
            console.log(`  ${match.matchId}: ${match.homeTeam} vs ${match.awayTeam} (${match.status})`);
        }
        return result.data.matches;
    } else {
        console.log('  Error listing matches:', result.data);
        return [];
    }
}

async function main() {
    console.log('=== Importing DartConnect Match Data ===');
    console.log('Project: brdc-v2');
    console.log(`League: ${LEAGUE_ID}\n`);

    // First list existing matches
    const existingMatches = await listAllMatches();
    console.log(`\nFound ${existingMatches.length} matches in Firestore\n`);

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
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
