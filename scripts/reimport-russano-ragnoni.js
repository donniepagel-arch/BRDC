/**
 * Reimport Russano vs Ragnoni match (Week 2)
 * Match ID: 9unWmN7TmQgNEhFlhpuB
 *
 * Run: node scripts/reimport-russano-ragnoni.js
 */

const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = '9unWmN7TmQgNEhFlhpuB';
const RTF_FILE = 'trips league/week 2/russano v ragnoni.rtf';

// Team rosters for player-to-team mapping
// Added aliases for name variations in RTF files
const TEAM_ROSTERS = {
    'D. Russano': ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric D', 'Eric', 'Luke Kollias'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner', 'Dave Brunner', 'Derek Fess', 'Josh Kelly', 'Joshua kelly']
};

function getTeamForPlayer(playerName, homeTeam, awayTeam) {
    const name = playerName.trim().toLowerCase();
    const homeRoster = TEAM_ROSTERS[homeTeam] || [];
    const awayRoster = TEAM_ROSTERS[awayTeam] || [];

    for (const p of homeRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'home';
    }
    for (const p of awayRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'away';
    }
    return null;
}

// Group throws by round
function groupThrowsByRound(throws, homeTeam, awayTeam) {
    const byRound = {};
    for (const t of throws) {
        if (!byRound[t.round]) {
            byRound[t.round] = { round: t.round, home: null, away: null };
        }
        const actualSide = getTeamForPlayer(t.player, homeTeam, awayTeam) || t.side;
        byRound[t.round][actualSide] = {
            player: t.player,
            score: t.score,
            remaining: t.remaining,
            hit: t.hit,
            marks: t.marks
        };
    }
    return Object.values(byRound).sort((a, b) => a.round - b.round);
}

// Convert parsed games to Firestore format
function convertToFirestoreFormat(parsedGames, homeTeam, awayTeam) {
    const games = [];
    let totalDarts = 0;
    let totalLegs = 0;
    let homeScore = 0;
    let awayScore = 0;

    // Assign sequential game numbers
    parsedGames.forEach((g, idx) => {
        g.gameNumber = idx + 1;
    });

    const setMap = {};
    for (const game of parsedGames) {
        const setNum = game.gameNumber;
        if (!setMap[setNum]) {
            setMap[setNum] = {
                set: setNum,
                legs: [],
                homeLegsWon: 0,
                awayLegsWon: 0
            };
        }

        for (const leg of game.legs) {
            totalLegs++;

            const playerStats = leg.player_stats || {};
            let actualHomePlayers = [];
            let actualAwayPlayers = [];
            for (const [name, stats] of Object.entries(playerStats)) {
                const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                if (actualSide === 'home') actualHomePlayers.push(name);
                else if (actualSide === 'away') actualAwayPlayers.push(name);
                totalDarts += stats.darts || 0;
            }

            // Determine winner
            let winner = null;
            const throws = leg.throws || [];
            const legType = (leg.type || game.type || '').toLowerCase();
            const is501 = legType.includes('501');

            for (const t of throws) {
                if (t.remaining === 0) {
                    winner = getTeamForPlayer(t.player, homeTeam, awayTeam);
                    break;
                }
            }

            if (!winner && is501) {
                let homePoints = 0;
                let awayPoints = 0;
                for (const [name, stats] of Object.entries(playerStats)) {
                    const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                    if (actualSide === 'home') homePoints += stats.points || 0;
                    else if (actualSide === 'away') awayPoints += stats.points || 0;
                }
                if (homePoints === 501) winner = 'home';
                else if (awayPoints === 501) winner = 'away';
            }

            if (!winner && legType.includes('cricket') && leg.winner) {
                const parsedWinnerSide = leg.winner;
                for (const [name, stats] of Object.entries(playerStats)) {
                    if (stats.side === parsedWinnerSide) {
                        winner = getTeamForPlayer(name, homeTeam, awayTeam);
                        break;
                    }
                }
            }

            if (winner === 'home') setMap[setNum].homeLegsWon++;
            else if (winner === 'away') setMap[setNum].awayLegsWon++;

            // Calculate home and away stats
            let homeStats = { darts: 0, points: 0, marks: 0 };
            let awayStats = { darts: 0, points: 0, marks: 0 };

            for (const [name, stats] of Object.entries(playerStats)) {
                const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                if (actualSide === 'home') {
                    homeStats.darts += stats.darts || 0;
                    homeStats.points += stats.points || 0;
                    homeStats.marks += stats.marks || 0;
                } else if (actualSide === 'away') {
                    awayStats.darts += stats.darts || 0;
                    awayStats.points += stats.points || 0;
                    awayStats.marks += stats.marks || 0;
                }
            }

            const format = legType.includes('501') ? '501' : legType.includes('cricket') ? 'cricket' : legType;
            if (format === '501') {
                homeStats.three_dart_avg = homeStats.darts > 0 ? parseFloat(((homeStats.points / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.three_dart_avg = awayStats.darts > 0 ? parseFloat(((awayStats.points / awayStats.darts) * 3).toFixed(2)) : 0;
            } else {
                homeStats.mpr = homeStats.darts > 0 ? parseFloat(((homeStats.marks / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.mpr = awayStats.darts > 0 ? parseFloat(((awayStats.marks / awayStats.darts) * 3).toFixed(2)) : 0;
            }

            const legData = {
                leg_number: leg.legNumber,
                format: format,
                winner: winner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: groupThrowsByRound(throws, homeTeam, awayTeam)
            };

            if (format === '501' && winner) {
                const winningThrow = throws.find(t => t.remaining === 0 &&
                    getTeamForPlayer(t.player, homeTeam, awayTeam) === winner);
                if (winningThrow) {
                    legData.checkout = winningThrow.score;
                }
            }

            setMap[setNum].legs.push(legData);
        }
    }

    // Convert sets to games array
    for (const [setNum, setData] of Object.entries(setMap)) {
        const gameWinner = setData.homeLegsWon > setData.awayLegsWon ? 'home' :
                          setData.awayLegsWon > setData.homeLegsWon ? 'away' : 'tie';

        if (gameWinner === 'home') homeScore++;
        else if (gameWinner === 'away') awayScore++;

        const homePlayersSet = new Set();
        const awayPlayersSet = new Set();
        for (const leg of setData.legs) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                if (actualSide === 'home') homePlayersSet.add(name);
                else if (actualSide === 'away') awayPlayersSet.add(name);
            }
        }

        const format = setData.legs[0]?.format || '501';
        const isDoubles = homePlayersSet.size > 1 || awayPlayersSet.size > 1;

        games.push({
            game_number: parseInt(setNum),
            type: format,
            format: format,
            is_doubles: isDoubles,
            home_players: Array.from(homePlayersSet),
            away_players: Array.from(awayPlayersSet),
            winner: gameWinner,
            result: {
                home_legs: setData.homeLegsWon,
                away_legs: setData.awayLegsWon
            },
            legs: setData.legs
        });
    }

    return {
        games: games.sort((a, b) => a.game_number - b.game_number),
        totalDarts,
        totalLegs,
        homeScore,
        awayScore
    };
}

function postToCloudFunction(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
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
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${responseData.substring(0, 500)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('=== REIMPORTING RUSSANO VS RAGNONI ===\n');
    console.log(`Match ID: ${MATCH_ID}`);
    console.log(`RTF File: ${RTF_FILE}`);
    console.log(`League ID: ${LEAGUE_ID}\n`);

    const homeTeam = 'D. Russano';
    const awayTeam = 'J. Ragnoni';

    try {
        // Parse RTF
        console.log('Parsing RTF file...');
        const filePath = path.join(__dirname, '..', 'temp', RTF_FILE);
        const parsedGames = parseRTFMatch(filePath);
        console.log(`Parsed ${parsedGames.length} games from RTF\n`);

        // Show what we parsed
        parsedGames.forEach((g, i) => {
            const playerNames = new Set();
            g.legs.forEach(leg => {
                Object.keys(leg.player_stats || {}).forEach(p => playerNames.add(p));
            });
            console.log(`  Game ${i + 1}: ${g.type || 'unknown'}, ${g.legs.length} leg(s), players: ${Array.from(playerNames).join(', ')}`);
        });
        console.log('');

        // Convert to Firestore format
        console.log('Converting to Firestore format...');
        const converted = convertToFirestoreFormat(parsedGames, homeTeam, awayTeam);
        console.log(`  Games: ${converted.games.length}`);
        console.log(`  Total Legs: ${converted.totalLegs}`);
        console.log(`  Total Darts: ${converted.totalDarts}`);
        console.log(`  Score: ${homeTeam} ${converted.homeScore} - ${converted.awayScore} ${awayTeam}\n`);

        // Show converted games
        console.log('Converted games:');
        converted.games.forEach(g => {
            console.log(`  Game ${g.game_number}: ${g.type}, ${g.is_doubles ? 'doubles' : 'singles'}, winner: ${g.winner}, legs: ${g.result.home_legs}-${g.result.away_legs}`);
            console.log(`    Home: ${g.home_players.join(', ')}`);
            console.log(`    Away: ${g.away_players.join(', ')}`);
        });
        console.log('');

        // Import via cloud function
        console.log('Importing to Firestore...');
        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        const importResult = await postToCloudFunction(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: MATCH_ID,
            matchData: {
                home_team: homeTeam,
                away_team: awayTeam,
                games: converted.games,
                total_darts: converted.totalDarts,
                total_legs: converted.totalLegs,
                final_score: {
                    home: converted.homeScore,
                    away: converted.awayScore
                }
            }
        });
        console.log('Import result:', JSON.stringify(importResult, null, 2));

        if (!importResult.success) {
            throw new Error(importResult.error || 'Import failed');
        }

        // Update stats
        console.log('\nUpdating player stats...');
        const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
        const statsResult = await postToCloudFunction(statsUrl, {
            leagueId: LEAGUE_ID,
            matchId: MATCH_ID
        });
        console.log('Stats result:', JSON.stringify(statsResult, null, 2));

        console.log('\n=== REIMPORT COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);
