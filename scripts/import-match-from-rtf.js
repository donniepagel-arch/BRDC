/**
 * Import Week 1 matches from RTF files to Firestore
 * Run: node import-week1-matches.js
 */

const { parseRTFMatch, parseMultiMatchRTF } = require('../temp/parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Team rosters for player-to-team mapping
const TEAM_ROSTERS = {
    'M. Pagel': ['Matt Pagel', 'Joe Peters', 'John Linden'],
    'D. Pagel': ['Donnie Pagel', 'Christian Ketchem', 'Jenn M', 'Jennifer Malek'],
    'N. Kull': ['Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Stephanie Kull', 'Steph Kull'],
    'K. Yasenchak': ['Kevin Yasenchak', 'Brian Smith', 'Cesar Andino'],
    'D. Partlo': ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
    'E. Olschansky': ['Eddie Olschansky', 'Eddie Olschanskey', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzalez', 'Mike Gonzales'],
    'T. Massimiani': ['Tony Massimiani', 'Dominick Russano', 'Dom Russano', 'Chris Benco'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner', 'Derek Fess', 'Josh Kelly', 'Joshua kelly'],
    'N. Mezlak': ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U', 'Dillon Ullises'],
    'D. Russano': ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric'],
    'E.O. March': ['Eddie Olschansky', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzales']
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

// Match IDs from Firestore
const MATCHES = [
    // Add matches here to import
    // Example:
    // {
    //     name: 'Team A v Team B (Week X)',
    //     matchId: 'FIRESTORE_MATCH_ID',
    //     rtfFile: '../temp/trips league/week X/filename.rtf',
    //     homeTeam: 'Team A',
    //     awayTeam: 'Team B'
    // }
];

// Helper to identify player combo for reordering
function getPlayerCombo(game, homeTeam, awayTeam) {
    const players = new Set();
    for (const leg of game.legs) {
        Object.keys(leg.player_stats || {}).forEach(p => players.add(p.toLowerCase()));
    }
    const playerList = Array.from(players);

    // For Massimioni team: tony, chris (benco), dom (russano)
    const hasT = playerList.some(p => p.includes('tony'));
    const hasC = playerList.some(p => p.includes('chris') || p.includes('benco'));
    const hasD = playerList.some(p => p.includes('dom') || p.includes('russano'));

    if (hasT && hasC && !hasD) return 'tony/chris';
    if (hasT && hasD && !hasC) return 'tony/dom';
    if (hasC && hasD && !hasT) return 'chris/dom';
    if (hasT && !hasC && !hasD) return 'tony';
    if (hasC && !hasT && !hasD) return 'chris';
    if (hasD && !hasT && !hasC) return 'dom';
    return '???';
}

// Reorder games based on player pattern
function reorderGames(games, expectedOrder, homeTeam, awayTeam) {
    const byCombo = {};
    for (const g of games) {
        const combo = getPlayerCombo(g, homeTeam, awayTeam);
        if (!byCombo[combo]) byCombo[combo] = [];
        byCombo[combo].push(g);
    }

    const reordered = [];
    const used = {};
    for (const combo of expectedOrder) {
        if (!used[combo]) used[combo] = 0;
        if (byCombo[combo] && byCombo[combo][used[combo]]) {
            const game = byCombo[combo][used[combo]];
            game.gameNumber = reordered.length + 1;
            reordered.push(game);
            used[combo]++;
        }
    }
    return reordered;
}

// Group throws by round - each throw object should have both home and away
// Uses player names to determine actual team (not RTF home/away which varies)
function groupThrowsByRound(throws, homeTeam, awayTeam) {
    const byRound = {};
    for (const t of throws) {
        if (!byRound[t.round]) {
            byRound[t.round] = { round: t.round, home: null, away: null };
        }
        // Map to actual team based on player name
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

    // Group games by set number
    // Check if all games have the same gameNumber (e.g., all "Game 1.x" format)
    // If so, assign unique sequential game numbers
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

            // Determine winner from player_stats
            const playerStats = leg.player_stats || {};
            const players = Object.keys(playerStats);

            // Map players to actual teams using player names (not RTF home/away which varies)
            let actualHomePlayers = [];
            let actualAwayPlayers = [];
            for (const [name, stats] of Object.entries(playerStats)) {
                const actualSide = getTeamForPlayer(name, homeTeam, awayTeam);
                if (actualSide === 'home') actualHomePlayers.push(name);
                else if (actualSide === 'away') actualAwayPlayers.push(name);
                totalDarts += stats.darts || 0;
            }

            // Determine winner - check throws for checkout
            let winner = null;
            const throws = leg.throws || [];
            const lastThrow = throws[throws.length - 1];
            const legType = (leg.type || game.type || '').toLowerCase();
            const is501 = legType.includes('501');

            // Check throws for remaining === 0 (checkout) - map player to actual team
            for (const t of throws) {
                if (t.remaining === 0) {
                    winner = getTeamForPlayer(t.player, homeTeam, awayTeam);
                    break;
                }
            }

            // For 501, also check if total points equals 501 (means they checked out)
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

            // For cricket, use the winner from the parser (based on final scores)
            // but map to actual team using player names
            if (!winner && legType.includes('cricket')) {
                // First check if the leg has a winner from parsing
                if (leg.winner) {
                    // Parser gives us 'home'/'away' from RTF, need to map to actual team
                    // Find a player from that side and map to their actual team
                    const parsedWinnerSide = leg.winner;
                    for (const [name, stats] of Object.entries(playerStats)) {
                        if (stats.side === parsedWinnerSide) {
                            winner = getTeamForPlayer(name, homeTeam, awayTeam);
                            break;
                        }
                    }
                } else {
                    // Fallback: look for explicit closing throw marker
                    const closingThrow = throws.find(t => t.isClosingThrow);
                    if (closingThrow) {
                        winner = getTeamForPlayer(closingThrow.player, homeTeam, awayTeam);
                    } else {
                        // Last resort: find the last round where only one side threw
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

            // Calculate home and away stats from player_stats using actual team mapping
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
            if (format === '501') {
                // Add checkout_darts if available
                if (leg.checkout_darts) {
                    legData.checkout_darts = leg.checkout_darts;
                }
                // Add checkout score
                if (winner) {
                    const winningThrow = throws.find(t => t.remaining === 0 &&
                        getTeamForPlayer(t.player, homeTeam, awayTeam) === winner);
                    if (winningThrow) {
                        legData.checkout = winningThrow.score;
                    }
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

        // Get players from legs - use actual team mapping, not RTF side
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

async function importMatch(match) {
    console.log(`\n=== Importing: ${match.name} ===`);

    const rtfPath = path.join(__dirname, match.rtfFile);
    console.log(`Reading: ${rtfPath}`);

    try {
        let parsedGames = parseRTFMatch(rtfPath);
        console.log(`Parsed ${parsedGames.length} games`);

        // Reorder games if needed (for files with out-of-order sets)
        if (match.reorderByPlayers) {
            console.log(`Reordering games by player pattern...`);
            parsedGames = reorderGames(parsedGames, match.reorderByPlayers, match.homeTeam, match.awayTeam);
            console.log(`Reordered to ${parsedGames.length} games`);
        }

        const matchData = convertToFirestoreFormat(parsedGames, match.homeTeam, match.awayTeam);
        console.log(`Converted to ${matchData.games.length} sets, ${matchData.total_legs} legs`);
        console.log(`Score: ${match.homeTeam} ${matchData.final_score.home} - ${matchData.final_score.away} ${match.awayTeam}`);
        console.log(`DEBUG: First game first leg checkout_darts:`, matchData.games[0]?.legs[0]?.checkout_darts || 'NONE');

        // Import match data
        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        const importResult = await postToCloudFunction(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: match.matchId,
            matchData: matchData
        });
        console.log('Import result:', JSON.stringify(importResult, null, 2));

        // Update stats
        const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
        const statsResult = await postToCloudFunction(statsUrl, {
            leagueId: LEAGUE_ID,
            matchId: match.matchId
        });
        console.log('Stats result:', JSON.stringify(statsResult, null, 2));

        return { success: true, match: match.name, import: importResult, stats: statsResult };
    } catch (error) {
        console.error(`Error importing ${match.name}:`, error.message);
        return { success: false, match: match.name, error: error.message };
    }
}

async function main() {
    console.log('Starting Week 1 match imports...');
    console.log(`League ID: ${LEAGUE_ID}`);

    const results = [];
    for (const match of MATCHES) {
        const result = await importMatch(match);
        results.push(result);
    }

    console.log('\n=== SUMMARY ===');
    for (const result of results) {
        if (result.success) {
            console.log(`[OK] ${result.match}`);
        } else {
            console.log(`[FAIL] ${result.match}: ${result.error}`);
        }
    }
}

main().catch(console.error);
