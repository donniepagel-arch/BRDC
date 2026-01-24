/**
 * Import accurate stats from DartConnect Performance Reports
 * These have the official totals, not calculated from throws
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Player name to ID mapping
const PLAYER_IDS = {
    // M. Pagel team
    'Matt Pagel': 'maH2vUZbuVLBbBQwoIqW',
    'Joe Peters': 'pERxbhcN3VNAvu6wFN9o',
    'John Linden': '06IoctkB8mTTSPBGRbu5',
    // D. Pagel team
    'Donnie Pagel': 'X2DMb9bP4Q8fy9yr5Fam',
    'Jennifer Malek': '7Hj4KWNpm0GviTYbwfbM',
    'Jenn M': '7Hj4KWNpm0GviTYbwfbM',
    'Matthew Wentz': 'TJ3uwMdslbtpjtq17xW4',
    'Christian Ketchem': '89RkfFLOhvUwV83ZS5J4',
    'Christian Ketchum': '89RkfFLOhvUwV83ZS5J4',
    // N. Kull team
    'Nathan Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Nate Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Michael Jarvis': '7GH1SWRR3dAyAVxgMqvf',
    'Stephanie Kull': '4sly23nOXhC475q95R4L',
    'Steph Kull': '4sly23nOXhC475q95R4L',
    // K. Yasenchak team
    'Kevin Yasenchak': 'dr4ML1i9ZeMI7SNisX6E',
    'Brian Smith': 'bIv2rga3jBSvzsQ2khne',
    'Cesar Andino': 'Dag2lYDtqoo4kc3cRHHa',
    // D. Partlo team
    'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
    'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
    'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
    // E. Olschansky team
    'Eddie Olschansky': 'wLMJoz1GylfVCMM32nWm',
    'Eddie Olschanskey': 'wLMJoz1GylfVCMM32nWm',
    'Jeff Boss': 'Tj1LsOtRiJwHW4r4sgWa',
    'Michael Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzales': 'FfODZtkFiGUEzptzD8tH',
    // J. Ragnoni team
    'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
    'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
    'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
    // T. Massimiani team
    'Tony Massimiani': 'gqhzEQLifL402lQwDMpH',
    'Dominick Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Dom Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Chris Benco': 'rZ57ofUYFXPSrrhyBVkz',
    // N. Mezlak team
    'Nick Mezlak': 'yGcBLDcTwgHtWmZEg3TG',
    'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
    'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
    // D. Russano team
    'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
    'Eric Duale': 'NCeaIaMXsXVN135pX91L',
    // Fill-ins
    'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
    'Joshua kelly': '34GDgRRFk0uFmOvyykHE',
    'Derek Fess': 'vVR4AOITXYzhR2H4GqzI'
};

// Performance report files
const PERFORMANCE_FILES = [
    'trips league/pagel v pagel performance.rtf',
    'trips league/yasenchak v kull performance.rtf',
    'trips league/partlo v olschansky performance.rtf',
    'trips league/massimiani v ragnoni performance.rtf',
    'trips league/mezlak v russano performance.rtf'
];

// RTF to text - use the same method as parse-rtf.js
function rtfToText(rtfContent) {
    let text = rtfContent
        .replace(/\{\\rtf1[^}]*\}/g, '')
        .replace(/\{\\fonttbl[^}]*\}/g, '')
        .replace(/\{\\colortbl[^}]*\}/g, '')
        .replace(/\{\\generator[^}]*\}/g, '')
        .replace(/\{\\mmathPr[^}]*\}/g, '')
        .replace(/\\viewkind\d+/g, '')
        .replace(/\\uc\d+/g, '')
        .replace(/\\pard[^\\]*/g, '')
        .replace(/\\sa\d+/g, '')
        .replace(/\\sl\d+/g, '')
        .replace(/\\slmult\d+/g, '')
        .replace(/\\f\d+/g, '')
        .replace(/\\fs\d+/g, '')
        .replace(/\\lang\d+/g, '')
        .replace(/\\par\s*/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\u8709\?/g, '∅')
        .replace(/\\\*/g, '')
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
        .trim();

    return text;
}

// Parse performance report to extract player totals
function parsePerformanceReport(filePath, debug = false) {
    const content = fs.readFileSync(filePath, 'utf8');
    const text = rtfToText(content);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    const players = {};

    // Find the summary section with player totals
    // Looking for lines like:
    // "Joe Peters		11	8	73%		2,531	136	55.83		93	129	2.2"
    let inPlayerSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Start after "Players" header with "Games Wins Win%"
        if (line.includes('Players') && line.includes('Games')) {
            inPlayerSection = true;
            if (debug) console.log(`  Found player section header at line ${i}`);
            continue;
        }

        if (!inPlayerSection) continue;

        // Stop at detailed game section (lines starting with game numbers like "1.1")
        if (/^\d+\.\d+/.test(line)) {
            if (debug) console.log(`  Stopping at game detail line ${i}: ${line.substring(0, 50)}`);
            break;
        }

        // Try to parse player line
        const parts = line.split(/\t+/).map(p => p.trim()).filter(p => p);

        if (debug && parts.length > 0 && /^[A-Za-z]/.test(parts[0])) {
            console.log(`  Line ${i} (${parts.length} parts): ${parts.slice(0, 5).join(' | ')}`);
        }

        // Player lines have: name, games, wins, win%, points, darts, 3DA, marks, darts, MPR
        // But some lines split differently. Let's be more flexible.
        if (parts.length >= 6) {
            const name = parts[0];

            // Skip headers
            if (name === 'Games' || name === 'Players' || name.includes('%') || name.includes('Wins')) continue;

            // Check if this is a valid player name
            const playerId = PLAYER_IDS[name];
            if (!playerId) {
                if (debug && /^[A-Za-z]/.test(name)) console.log(`    No ID for: "${name}"`);
                continue;
            }

            // Find the numeric values - the format varies but we need:
            // X01: points (large number like 2531), darts (smaller like 136)
            // Cricket: marks (like 93), darts (like 129)
            const nums = parts.slice(1).map(p => p.replace(/,/g, '').replace(/%/g, '')).filter(p => /^\d+\.?\d*$/.test(p)).map(p => parseFloat(p));

            if (debug) console.log(`    ${name}: nums = ${JSON.stringify(nums)}`);

            if (nums.length >= 6) {
                // Typical format: games, wins, x01_points, x01_darts, x01_3da, cricket_marks, cricket_darts, cricket_mpr
                // Or: games, wins, win%, x01_points, x01_darts, x01_3da, cricket_marks, cricket_darts, cricket_mpr

                // Find the large point value (usually > 500) - that's x01 points
                let x01Points = 0, x01Darts = 0, cricketMarks = 0, cricketDarts = 0;
                let games = 0, wins = 0;

                // First two small numbers are usually games and wins
                if (nums[0] < 50 && nums[1] < 50) {
                    games = nums[0];
                    wins = nums[1];
                }

                // Find x01 points (large number > 100, usually > 500)
                for (let j = 2; j < nums.length - 1; j++) {
                    if (nums[j] > 100 && nums[j + 1] < nums[j]) {
                        x01Points = nums[j];
                        x01Darts = nums[j + 1];
                        // Next pair after the 3DA (decimal) should be cricket
                        for (let k = j + 2; k < nums.length - 1; k++) {
                            if (nums[k] < 500 && nums[k + 1] < 500 && nums[k] > 0) {
                                cricketMarks = nums[k];
                                cricketDarts = nums[k + 1];
                                break;
                            }
                        }
                        break;
                    }
                }

                if (x01Points > 0 || cricketMarks > 0) {
                    if (!players[playerId]) {
                        players[playerId] = {
                            playerId,
                            playerName: name,
                            games_played: 0,
                            games_won: 0,
                            x01_points: 0,
                            x01_darts: 0,
                            cricket_marks: 0,
                            cricket_darts: 0
                        };
                    }

                    players[playerId].games_played += games;
                    players[playerId].games_won += wins;
                    players[playerId].x01_points += x01Points;
                    players[playerId].x01_darts += x01Darts;
                    players[playerId].cricket_marks += cricketMarks;
                    players[playerId].cricket_darts += cricketDarts;

                    if (debug) console.log(`    PARSED: games=${games}, wins=${wins}, x01=${x01Points}/${x01Darts}, cricket=${cricketMarks}/${cricketDarts}`);
                }
            }
        }
    }

    return Object.values(players);
}

// Make HTTP request
function postToCloudFunction(url, data) {
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
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('Parsing performance reports for accurate stats...\n');

    // Aggregate all player stats from all matches
    const allPlayers = {};

    for (const file of PERFORMANCE_FILES) {
        const filePath = path.join(__dirname, file);
        console.log(`Reading: ${file}`);

        if (!fs.existsSync(filePath)) {
            console.log(`  SKIP - file not found`);
            continue;
        }

        const players = parsePerformanceReport(filePath);
        console.log(`  Found ${players.length} players`);

        for (const p of players) {
            if (!allPlayers[p.playerId]) {
                allPlayers[p.playerId] = { ...p };
            } else {
                allPlayers[p.playerId].games_played += p.games_played;
                allPlayers[p.playerId].games_won += p.games_won;
                allPlayers[p.playerId].x01_points += p.x01_points;
                allPlayers[p.playerId].x01_darts += p.x01_darts;
                allPlayers[p.playerId].cricket_marks += p.cricket_marks;
                allPlayers[p.playerId].cricket_darts += p.cricket_darts;
            }
        }
    }

    // Convert to format for setPlayerStatsFromPerformance
    const playerStats = Object.values(allPlayers).map(p => {
        const x01_3da = p.x01_darts > 0 ? ((p.x01_points / p.x01_darts) * 3).toFixed(2) : 0;
        const cricket_mpr = p.cricket_darts > 0 ? ((p.cricket_marks / p.cricket_darts) * 3).toFixed(2) : 0;

        console.log(`${p.playerName}: ${x01_3da} 3DA, ${cricket_mpr} MPR (${p.x01_darts} x01 darts, ${p.cricket_darts} cricket darts)`);

        return {
            playerId: p.playerId,
            playerName: p.playerName,
            games_played: p.games_played,
            games_won: p.games_won,
            x01_points: p.x01_points,
            x01_darts: p.x01_darts,
            cricket_marks: p.cricket_marks,
            cricket_darts: p.cricket_darts,
            matches_played: 1 // Will be set by the function
        };
    });

    console.log(`\nTotal: ${playerStats.length} players to update`);

    // Call the cloud function
    console.log('\nSending to setPlayerStatsFromPerformance (resetExisting=true)...');

    const result = await postToCloudFunction(
        'https://us-central1-brdc-v2.cloudfunctions.net/setPlayerStatsFromPerformance',
        {
            leagueId: LEAGUE_ID,
            playerStats: playerStats,
            resetExisting: true
        }
    );

    console.log('\nResult:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
