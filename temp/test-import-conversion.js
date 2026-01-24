/**
 * Test the import conversion without actually importing
 */

const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

// Team rosters for player-to-team mapping
const TEAM_ROSTERS = {
    'M. Pagel': ['Matt Pagel', 'Joe Peters', 'John Linden'],
    'D. Pagel': ['Donnie Pagel', 'Christian Ketchem', 'Jenn M', 'Jennifer Malek'],
    'N. Kull': ['Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Stephanie Kull', 'Steph Kull'],
    'K. Yasenchak': ['Kevin Yasenchak', 'Brian Smith', 'Cesar Andino'],
    'D. Partlo': ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
    'E. Olschansky': ['Eddie Olschansky', 'Eddie Olschanskey', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzalez', 'Mike Gonzales'],
    'T. Massimiani': ['Tony Massimiani', 'Dominick Russano', 'Dom Russano', 'Chris Benco'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner'],
    'N. Mezlak': ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U'],
    'D. Russano': ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric']
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

// Group throws by round using actual team mapping
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

    // Check if all games have the same gameNumber
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

            // Check throws for remaining === 0 (checkout)
            for (const t of throws) {
                if (t.remaining === 0) {
                    winner = getTeamForPlayer(t.player, homeTeam, awayTeam);
                    break;
                }
            }

            // For 501, check if total points equals 501
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

            // For cricket, use the winner from the parser
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
                    const closingThrow = throws.find(t => t.isClosingThrow);
                    if (closingThrow) {
                        winner = getTeamForPlayer(closingThrow.player, homeTeam, awayTeam);
                    }
                }
            }

            if (winner === 'home') setMap[setNum].homeLegsWon++;
            else if (winner === 'away') setMap[setNum].awayLegsWon++;

            // Calculate stats using actual team mapping
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

        // Get players using actual team mapping
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

// Test Mezlak v Russano
const rtfPath = path.join(__dirname, 'trips league', 'mezlak v russano.rtf');
const parsedGames = parseRTFMatch(rtfPath);
const matchData = convertToFirestoreFormat(parsedGames, 'N. Mezlak', 'D. Russano');

console.log('=== MEZLAK V RUSSANO - IMPORT CONVERSION TEST ===\n');
console.log(`Parsed ${parsedGames.length} games`);
console.log(`Converted to ${matchData.games.length} sets, ${matchData.total_legs} legs`);
console.log(`\nFINAL SCORE: N. Mezlak ${matchData.final_score.home} - ${matchData.final_score.away} D. Russano`);
console.log(`\nExpected: N. Mezlak 4 - 5 D. Russano`);
console.log(`Match: ${matchData.final_score.home === 4 && matchData.final_score.away === 5 ? 'CORRECT!' : 'INCORRECT'}`);

console.log('\n--- Sets breakdown ---');
for (const game of matchData.games) {
    console.log(`Set ${game.set}: ${game.home_players.join(', ')} vs ${game.away_players.join(', ')}`);
    console.log(`  Result: ${game.result.home_legs}-${game.result.away_legs} (${game.winner} wins)`);
}
