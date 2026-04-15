/**
 * Smart Reimport Script
 *
 * This script properly handles home/away mapping by:
 * 1. Fetching match info from Firestore (home_team, away_team, rosters)
 * 2. Parsing RTF (left side = "left", right side = "right")
 * 3. Using player names to detect which RTF side maps to which Firestore team
 * 4. Assigning winners correctly
 *
 * Usage: node scripts/smart-reimport.js <matchId> <rtfFile> [--dry-run]
 */

const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse: ${data.substring(0, 500)}`));
                }
            });
        }).on('error', reject);
    });
}

function httpPost(url, body) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(body);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse: ${data.substring(0, 500)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Fetch match details and team rosters from Firestore
async function fetchMatchInfo(matchId) {
    // Get match details
    const matchUrl = `https://us-central1-brdc-v2.cloudfunctions.net/getMatchDetails?leagueId=${LEAGUE_ID}&matchId=${matchId}`;
    const matchData = await httpGet(matchUrl);

    // Get teams with rosters
    const teamsUrl = `https://us-central1-brdc-v2.cloudfunctions.net/getTeams?league_id=${LEAGUE_ID}`;
    const teamsData = await httpGet(teamsUrl);

    if (!teamsData.success) {
        throw new Error('Failed to fetch teams');
    }

    // Build roster lookup
    const rosters = {};
    for (const team of teamsData.teams) {
        rosters[team.team_name] = team.players.map(p => p.name.toLowerCase());
    }

    return {
        homeTeamName: matchData.homeTeam,
        awayTeamName: matchData.awayTeam,
        homeTeamId: matchData.homeTeamId,
        awayTeamId: matchData.awayTeamId,
        rosters
    };
}

// Check if a player name matches any name in a roster
function playerMatchesRoster(playerName, rosterNames) {
    const name = playerName.toLowerCase().trim();
    for (const rosterName of rosterNames) {
        if (name.includes(rosterName) || rosterName.includes(name)) {
            return true;
        }
        // Check first name + last initial
        const nameParts = name.split(' ');
        const rosterParts = rosterName.split(' ');
        if (nameParts[0] === rosterParts[0]) {
            return true;
        }
    }
    return false;
}

// Detect which RTF side (left/right) maps to which Firestore team (home/away)
// Returns global detection for logging purposes
function detectSideMapping(parsedGames, homeRoster, awayRoster) {
    let leftMatchesHome = 0;
    let leftMatchesAway = 0;

    for (const game of parsedGames) {
        for (const leg of game.legs) {
            for (const [playerName, stats] of Object.entries(leg.player_stats || {})) {
                const rtfSide = stats.side; // 'home' (left) or 'away' (right) from parser

                if (playerMatchesRoster(playerName, homeRoster)) {
                    if (rtfSide === 'home') leftMatchesHome++;
                    else leftMatchesAway++;
                } else if (playerMatchesRoster(playerName, awayRoster)) {
                    if (rtfSide === 'home') leftMatchesAway++;
                    else leftMatchesHome++;
                }
            }
        }
    }

    console.log(`  Side detection: leftMatchesHome=${leftMatchesHome}, leftMatchesAway=${leftMatchesAway}`);

    // If left side of RTF has more home team players, no swap needed
    // If left side has more away team players, swap is needed
    return leftMatchesHome >= leftMatchesAway ? 'no_swap' : 'swap';
}

// Detect side mapping for a single leg based on player roster matching
function detectLegSideMapping(playerStats, homeRoster, awayRoster) {
    let leftMatchesHome = 0;
    let leftMatchesAway = 0;

    for (const [playerName, stats] of Object.entries(playerStats || {})) {
        const rtfSide = stats.side;

        if (playerMatchesRoster(playerName, homeRoster)) {
            if (rtfSide === 'home') leftMatchesHome++;
            else leftMatchesAway++;
        } else if (playerMatchesRoster(playerName, awayRoster)) {
            if (rtfSide === 'home') leftMatchesAway++;
            else leftMatchesHome++;
        }
    }

    return leftMatchesHome >= leftMatchesAway ? 'no_swap' : 'swap';
}

// Convert parsed games to Firestore format with correct side mapping
function convertToFirestoreFormat(parsedGames, homeRoster, awayRoster, sideMapping) {
    const games = [];
    let totalDarts = 0;
    let totalLegs = 0;
    let homeScore = 0;
    let awayScore = 0;

    for (let gameIdx = 0; gameIdx < parsedGames.length; gameIdx++) {
        const game = parsedGames[gameIdx];
        const gameNumber = gameIdx + 1;
        const legs = [];
        let homeLegsWon = 0;
        let awayLegsWon = 0;

        for (const leg of game.legs) {
            totalLegs++;
            const playerStats = leg.player_stats || {};
            const throws = leg.throws || [];
            const legType = (leg.type || game.type || '').toLowerCase();
            const format = legType.includes('501') ? '501' : legType.includes('cricket') ? 'cricket' : '501';

            // Detect per-leg side mapping based on player roster matching
            const legSwap = detectLegSideMapping(playerStats, homeRoster, awayRoster);
            const needsSwap = legSwap === 'swap';

            // Calculate stats per side
            let leftStats = { darts: 0, points: 0, marks: 0 };
            let rightStats = { darts: 0, points: 0, marks: 0 };
            let leftPlayers = [];
            let rightPlayers = [];

            for (const [playerName, stats] of Object.entries(playerStats)) {
                const rtfSide = stats.side;
                if (rtfSide === 'home') {
                    leftStats.darts += stats.darts || 0;
                    leftStats.points += stats.points || 0;
                    leftStats.marks += stats.marks || 0;
                    leftPlayers.push(playerName);
                } else {
                    rightStats.darts += stats.darts || 0;
                    rightStats.points += stats.points || 0;
                    rightStats.marks += stats.marks || 0;
                    rightPlayers.push(playerName);
                }
                totalDarts += stats.darts || 0;
            }

            // Determine winner from parser
            let rtfWinner = leg.winner; // 'home' (left) or 'away' (right)

            // Map RTF winner to actual home/away
            let actualWinner = null;
            if (rtfWinner) {
                if (needsSwap) {
                    actualWinner = rtfWinner === 'home' ? 'away' : 'home';
                } else {
                    actualWinner = rtfWinner;
                }
            }

            if (actualWinner === 'home') homeLegsWon++;
            else if (actualWinner === 'away') awayLegsWon++;

            // Map stats to actual home/away
            let homeStats, awayStats, homePlayers, awayPlayers;
            if (needsSwap) {
                homeStats = rightStats;
                awayStats = leftStats;
                homePlayers = rightPlayers;
                awayPlayers = leftPlayers;
            } else {
                homeStats = leftStats;
                awayStats = rightStats;
                homePlayers = leftPlayers;
                awayPlayers = rightPlayers;
            }

            // Calculate averages
            if (format === '501') {
                homeStats.three_dart_avg = homeStats.darts > 0 ?
                    parseFloat(((homeStats.points / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.three_dart_avg = awayStats.darts > 0 ?
                    parseFloat(((awayStats.points / awayStats.darts) * 3).toFixed(2)) : 0;
            } else {
                homeStats.mpr = homeStats.darts > 0 ?
                    parseFloat(((homeStats.marks / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.mpr = awayStats.darts > 0 ?
                    parseFloat(((awayStats.marks / awayStats.darts) * 3).toFixed(2)) : 0;
            }

            // Build throws with correct mapping
            const mappedThrows = [];
            const throwsByRound = {};
            for (const t of throws) {
                if (!throwsByRound[t.round]) {
                    throwsByRound[t.round] = { round: t.round, home: null, away: null };
                }
                const rtfSide = t.side;
                const actualSide = needsSwap ? (rtfSide === 'home' ? 'away' : 'home') : rtfSide;
                throwsByRound[t.round][actualSide] = {
                    player: t.player,
                    score: t.score,
                    remaining: t.remaining,
                    hit: t.hit,
                    marks: t.marks
                };
            }

            legs.push({
                leg_number: leg.legNumber,
                format: format,
                winner: actualWinner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: Object.values(throwsByRound).sort((a, b) => a.round - b.round)
            });
        }

        // Determine game winner
        const gameWinner = homeLegsWon > awayLegsWon ? 'home' :
                          awayLegsWon > homeLegsWon ? 'away' : 'tie';

        if (gameWinner === 'home') homeScore++;
        else if (gameWinner === 'away') awayScore++;

        // Get unique players for game - assign based on roster matching
        const homePlayersSet = new Set();
        const awayPlayersSet = new Set();
        for (const leg of legs) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                // Assign player to team based on which roster they match
                if (playerMatchesRoster(name, homeRoster)) {
                    homePlayersSet.add(name);
                } else if (playerMatchesRoster(name, awayRoster)) {
                    awayPlayersSet.add(name);
                } else {
                    // Unknown player - use per-leg side detection
                    const legSwap = detectLegSideMapping(leg.player_stats, homeRoster, awayRoster);
                    if (legSwap === 'swap') {
                        if (stats.side === 'home') awayPlayersSet.add(name);
                        else homePlayersSet.add(name);
                    } else {
                        if (stats.side === 'home') homePlayersSet.add(name);
                        else awayPlayersSet.add(name);
                    }
                }
            }
        }

        const format = legs[0]?.format || '501';
        const isDoubles = homePlayersSet.size > 1 || awayPlayersSet.size > 1;

        games.push({
            game_number: gameNumber,
            type: format,
            format: format,
            is_doubles: isDoubles,
            home_players: Array.from(homePlayersSet),
            away_players: Array.from(awayPlayersSet),
            winner: gameWinner,
            result: {
                home_legs: homeLegsWon,
                away_legs: awayLegsWon
            },
            legs: legs
        });
    }

    return { games, totalDarts, totalLegs, homeScore, awayScore };
}

async function main() {
    const args = process.argv.slice(2);
    const matchId = args.find(a => !a.startsWith('--'));
    const rtfFile = args.find((a, i) => i > 0 && !a.startsWith('--'));
    const dryRun = args.includes('--dry-run');

    if (!matchId || !rtfFile) {
        console.log('Usage: node scripts/smart-reimport.js <matchId> <rtfFile> [--dry-run]');
        console.log('Example: node scripts/smart-reimport.js sgmoL4GyVUYP67aOS7wm "trips league/week 1/pagel v pagel MATCH.rtf"');
        process.exit(1);
    }

    console.log('=== SMART REIMPORT ===\n');
    console.log(`Match ID: ${matchId}`);
    console.log(`RTF File: ${rtfFile}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

    try {
        // 1. Fetch match info from Firestore
        console.log('1. Fetching match info from Firestore...');
        const matchInfo = await fetchMatchInfo(matchId);
        console.log(`   Home Team: ${matchInfo.homeTeamName}`);
        console.log(`   Away Team: ${matchInfo.awayTeamName}`);

        const homeRoster = matchInfo.rosters[matchInfo.homeTeamName] || [];
        const awayRoster = matchInfo.rosters[matchInfo.awayTeamName] || [];
        console.log(`   Home Roster: ${homeRoster.join(', ')}`);
        console.log(`   Away Roster: ${awayRoster.join(', ')}\n`);

        // 2. Parse RTF
        console.log('2. Parsing RTF file...');
        const filePath = path.join(__dirname, '..', 'temp', rtfFile);
        const parsedGames = parseRTFMatch(filePath);
        console.log(`   Parsed ${parsedGames.length} games\n`);

        // 3. Detect side mapping
        console.log('3. Detecting side mapping...');
        const sideMapping = detectSideMapping(parsedGames, homeRoster, awayRoster);
        console.log(`   Result: ${sideMapping === 'swap' ? 'RTF left = Away team (swap needed)' : 'RTF left = Home team (no swap)'}\n`);

        // 4. Convert with correct mapping
        console.log('4. Converting to Firestore format...');
        const converted = convertToFirestoreFormat(parsedGames, homeRoster, awayRoster, sideMapping);
        console.log(`   Score: ${matchInfo.homeTeamName} ${converted.homeScore} - ${converted.awayScore} ${matchInfo.awayTeamName}`);
        console.log(`   Total Legs: ${converted.totalLegs}`);
        console.log(`   Total Darts: ${converted.totalDarts}\n`);

        // Show game details
        console.log('Game Summary:');
        for (const g of converted.games) {
            console.log(`  Game ${g.game_number}: ${g.type}, ${g.is_doubles ? 'doubles' : 'singles'}`);
            console.log(`    ${matchInfo.homeTeamName}: ${g.home_players.join(', ')}`);
            console.log(`    ${matchInfo.awayTeamName}: ${g.away_players.join(', ')}`);
            console.log(`    Winner: ${g.winner} (${g.result.home_legs}-${g.result.away_legs})`);
        }

        if (dryRun) {
            console.log('\n[DRY RUN] Would import this match');
            return;
        }

        // 5. Import
        console.log('\n5. Importing to Firestore...');
        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        const importResult = await httpPost(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: matchId,
            matchData: {
                home_team: matchInfo.homeTeamName,
                away_team: matchInfo.awayTeamName,
                games: converted.games,
                total_darts: converted.totalDarts,
                total_legs: converted.totalLegs,
                final_score: {
                    home: converted.homeScore,
                    away: converted.awayScore
                }
            }
        });

        if (!importResult.success) {
            throw new Error(importResult.error || 'Import failed');
        }
        console.log('   Import successful!');

        // 6. Update stats
        console.log('\n6. Updating player stats...');
        const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
        const statsResult = await httpPost(statsUrl, {
            leagueId: LEAGUE_ID,
            matchId: matchId
        });

        if (statsResult.success) {
            console.log(`   Updated ${statsResult.playersUpdated} players`);
        }

        console.log('\n=== COMPLETE ===');

    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
