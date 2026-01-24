/**
 * Import Week 2 - Pagel v Kull match from RTF file to Firestore
 * Run: node import-week2-pagel-kull.js
 */

const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = 'Iychqt7Wto8S9m7proeH';

// Team rosters for player-to-team mapping
const TEAM_ROSTERS = {
    'D. Pagel': ['Donnie Pagel', 'Christian Ketchem', 'Jenn M', 'Jennifer Malek'],
    'N. Kull': ['Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Mike Jarvis', 'Stephanie Kull', 'Steph Kull']
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

    // Ensure unique game numbers
    const gameNumbers = parsedGames.map(g => g.gameNumber);
    const allSameGameNum = gameNumbers.every(n => n === gameNumbers[0]);
    if (allSameGameNum && parsedGames.length > 1) {
        parsedGames.forEach((g, idx) => {
            g.gameNumber = idx + 1;
        });
    }

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

            // Map players to actual teams
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

            // Check for checkout (remaining === 0)
            for (const t of throws) {
                if (t.remaining === 0) {
                    winner = getTeamForPlayer(t.player, homeTeam, awayTeam);
                    break;
                }
            }

            // For 501, check if total points === 501
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

            // For cricket, use parser winner
            if (!winner && legType.includes('cricket')) {
                if (leg.winner) {
                    const parsedWinnerSide = leg.winner;
                    for (const [name, stats] of Object.entries(playerStats)) {
                        if (stats.side === parsedWinnerSide) {
                            winner = getTeamForPlayer(name, homeTeam, awayTeam);
                            break;
                        }
                    }
                } else {
                    // Look for closing throw
                    const closingThrow = throws.find(t => t.isClosingThrow);
                    if (closingThrow) {
                        winner = getTeamForPlayer(closingThrow.player, homeTeam, awayTeam);
                    } else {
                        // Find last round with single-side throw
                        const roundMap = {};
                        for (const t of throws) {
                            if (!roundMap[t.round]) roundMap[t.round] = { home: null, away: null };
                            roundMap[t.round][t.side] = t;
                        }
                        const rounds = Object.keys(roundMap).map(Number).sort((a, b) => b - a);
                        for (const r of rounds) {
                            const rd = roundMap[r];
                            if (rd.home && !rd.away && rd.home.player) {
                                winner = getTeamForPlayer(rd.home.player, homeTeam, awayTeam);
                                break;
                            } else if (rd.away && !rd.home && rd.away.player) {
                                winner = getTeamForPlayer(rd.away.player, homeTeam, awayTeam);
                                break;
                            }
                        }
                    }
                }
            }

            if (winner === 'home') setMap[setNum].homeLegsWon++;
            else if (winner === 'away') setMap[setNum].awayLegsWon++;

            // Calculate stats
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

            // Calculate averages
            const format = legType.includes('501') ? '501' : legType.includes('cricket') ? 'cricket' : legType;
            if (format === '501') {
                homeStats.three_dart_avg = homeStats.darts > 0 ? parseFloat(((homeStats.points / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.three_dart_avg = awayStats.darts > 0 ? parseFloat(((awayStats.points / awayStats.darts) * 3).toFixed(2)) : 0;
            } else {
                homeStats.mpr = homeStats.darts > 0 ? parseFloat(((homeStats.marks / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.mpr = awayStats.darts > 0 ? parseFloat(((awayStats.marks / awayStats.darts) * 3).toFixed(2)) : 0;
            }

            // Build leg data
            const legData = {
                leg_number: leg.legNumber,
                format: format,
                winner: winner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: groupThrowsByRound(throws, homeTeam, awayTeam)
            };

            // Add checkout info for 501
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

        // Get players from legs
        const homePlayersSet = new Set();
        const awayPlayersSet = new Set();

        for (const leg of setData.legs) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                if (actualSide === 'home') homePlayersSet.add(name);
                else if (actualSide === 'away') awayPlayersSet.add(name);
            }
        }

        games.push({
            game_number: parseInt(setNum),
            set: parseInt(setNum),
            type: setData.legs[0]?.format || 'mixed',
            format: setData.legs[0]?.format || 'mixed',
            home_players: Array.from(homePlayersSet),
            away_players: Array.from(awayPlayersSet),
            result: {
                home_legs: setData.homeLegsWon,
                away_legs: setData.awayLegsWon
            },
            winner: gameWinner,
            status: 'completed',
            legs: setData.legs
        });
    }

    return {
        games,
        home_team: homeTeam,
        away_team: awayTeam,
        final_score: { home: homeScore, away: awayScore },
        total_darts: totalDarts,
        total_legs: totalLegs
    };
}

// Make HTTP request to cloud function
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

async function importMatch() {
    const homeTeam = 'D. Pagel';
    const awayTeam = 'N. Kull';

    console.log(`\n=== Importing Week 2: ${homeTeam} vs ${awayTeam} ===`);

    const rtfPath = path.join(__dirname, 'trips league/week 2/pagel v kull.rtf');
    console.log(`Reading: ${rtfPath}`);

    try {
        let parsedGames = parseRTFMatch(rtfPath);
        console.log(`Parsed ${parsedGames.length} games`);

        const matchData = convertToFirestoreFormat(parsedGames, homeTeam, awayTeam);
        console.log(`Converted to ${matchData.games.length} sets, ${matchData.total_legs} legs`);
        console.log(`Score: ${homeTeam} ${matchData.final_score.home} - ${matchData.final_score.away} ${awayTeam}`);

        // Show set breakdown
        matchData.games.forEach(g => {
            console.log(`  Set ${g.set}: ${g.home_players.join('/')} vs ${g.away_players.join('/')} => ${g.result.home_legs}-${g.result.away_legs} (${g.winner})`);
        });

        // Import match data
        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        console.log('\nImporting to Firestore...');
        const importResult = await postToCloudFunction(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: MATCH_ID,
            matchData: matchData
        });
        console.log('Import result:', JSON.stringify(importResult, null, 2));

        if (importResult.success) {
            // Update player stats
            console.log('\nUpdating player stats...');
            const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
            const statsResult = await postToCloudFunction(statsUrl, {
                leagueId: LEAGUE_ID,
                matchId: MATCH_ID
            });
            console.log('Stats update result:', JSON.stringify(statsResult, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

importMatch();
