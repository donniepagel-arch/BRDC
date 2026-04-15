/**
 * Reimport All Matches Script
 *
 * Reimports all Week 1 and Week 2 matches with the fixed RTF parser
 * that correctly detects 501 leg winners.
 *
 * Review-only warning:
 * This is a historical bounded repair script for early-season matches.
 * Do not use it as a normal importer.
 *
 * Usage: node scripts/reimport-all-matches.js [--dry-run] [--week=1|2] [--match=matchId]
 */

const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// All matches to reimport
const MATCHES = [
    // Week 1 (files in week 1 subdirectory)
    {
        id: 'sgmoL4GyVUYP67aOS7wm',
        file: 'trips league/week 1/pagel v pagel MATCH.rtf',
        homeTeam: 'M. Pagel',
        awayTeam: 'D. Pagel',
        week: 1
    },
    {
        id: 'JqiWABEBS7Bqk8n7pKxD',
        file: 'trips league/week 1/yasenchak v kull.rtf',
        homeTeam: 'N. Kull',
        awayTeam: 'K. Yasenchak',
        week: 1
    },
    {
        id: '0lxEeuAa7fEDSVeY3uCG',
        file: 'trips league/week 1/partlo v olschansky.rtf',
        homeTeam: 'E. O',
        awayTeam: 'D. Partlo',
        week: 1
    },
    {
        id: 'nYv1XeGTWbaxBepI6F5u',
        file: 'trips league/week 1/mezlak v russano.rtf',
        homeTeam: 'N. Mezlak',
        awayTeam: 'D. Russano',
        week: 1
    },
    {
        id: 'OTYlCe3NNbinKlpZccwS',
        file: 'trips league/week 1/massimiani v ragnoni.rtf',
        homeTeam: 'J. Ragnoni',
        awayTeam: 'neon nightmares',
        week: 1
    },
    // Week 2
    {
        id: 'ixNMXr2jT5f7hDD6qFDj',
        file: 'trips league/week 2/dpartlo v mpagel.rtf',
        homeTeam: 'D. Partlo',
        awayTeam: 'M. Pagel',
        week: 2
    },
    {
        id: 'YFpeyQPYEQQjMLEu1eVp',
        file: 'trips league/week 2/massimiani v yasenchak.rtf',
        homeTeam: 'neon nightmares',
        awayTeam: 'K. Yasenchak',
        week: 2
    },
    {
        id: 'tcI1eFfOlHaTyhjaCGOj',
        file: 'trips league/week 2/mezlak V e.o.rtf',
        homeTeam: 'E. O',
        awayTeam: 'N. Mezlak',
        week: 2
    },
    {
        id: 'Iychqt7Wto8S9m7proeH',
        file: 'trips league/week 2/pagel v kull.rtf',
        homeTeam: 'D. Pagel',
        awayTeam: 'N. Kull',
        week: 2
    },
    {
        id: '9unWmN7TmQgNEhFlhpuB',
        file: 'trips league/week 2/russano v ragnoni.rtf',
        homeTeam: 'D. Russano',
        awayTeam: 'J. Ragnoni',
        week: 2
    }
];

// All team rosters for player-to-team mapping
const TEAM_ROSTERS = {
    'M. Pagel': ['Matt Pagel', 'Joe Peters', 'John Linden'],
    'D. Pagel': ['Donnie Pagel', 'Matthew Wentz', 'Jennifer Malek', 'Jenn M', 'Christian Ketchem', 'Christian Ketchum'],
    'N. Kull': ['Nathan Kull', 'Nate Kull', 'Michael Jarvis', 'Mike Jarvis', 'Stephanie Kull', 'Steph Kull'],
    'K. Yasenchak': ['Kevin Yasenchak', 'Brian Smith', 'Cesar Andino'],
    'D. Partlo': ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
    'E. O': ['Eddie Olschansky', 'Eddie Olschanskey', 'Jeff Boss', 'Michael Gonzalez', 'Mike Gonzalez', 'Mike Gonzales'],
    'N. Mezlak': ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U'],
    'D. Russano': ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric D', 'Eric', 'Luke Kollias'],
    'J. Ragnoni': ['John Ragnoni', 'Marc Tate', 'David Brunner', 'Dave Brunner', 'Derek Fess', 'Josh Kelly', 'Joshua Kelly'],
    'neon nightmares': ['Tony Massimiani', 'Chris Benco', 'Dominick Russano', 'Dom Russano']
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

function convertToFirestoreFormat(parsedGames, homeTeam, awayTeam) {
    const games = [];
    let totalDarts = 0;
    let totalLegs = 0;
    let homeScore = 0;
    let awayScore = 0;

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

            // Determine winner from leg.winner (now properly set by fixed parser)
            let winner = null;
            const throws = leg.throws || [];
            const legType = (leg.type || game.type || '').toLowerCase();

            // Use the leg.winner from the parser (fixed to work for both 501 and cricket)
            if (leg.winner) {
                // Map parser's winner to actual team side
                // The parser sets winner based on which side got the checkout
                // But we need to verify against our roster mapping
                winner = leg.winner;
            }

            // Fallback: check throws for who reached 0
            if (!winner) {
                for (const t of throws) {
                    if (t.remaining === 0) {
                        winner = getTeamForPlayer(t.player, homeTeam, awayTeam);
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

async function reimportMatch(match, dryRun = false) {
    const { id, file, homeTeam, awayTeam, week } = match;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Week ${week}: ${homeTeam} vs ${awayTeam}`);
    console.log(`Match ID: ${id}`);
    console.log(`RTF File: ${file}`);
    console.log('='.repeat(60));

    try {
        // Parse RTF
        const filePath = path.join(__dirname, '..', 'temp', file);
        const parsedGames = parseRTFMatch(filePath);
        console.log(`Parsed ${parsedGames.length} games from RTF`);

        // Convert to Firestore format
        const converted = convertToFirestoreFormat(parsedGames, homeTeam, awayTeam);
        console.log(`Score: ${homeTeam} ${converted.homeScore} - ${converted.awayScore} ${awayTeam}`);
        console.log(`Total Legs: ${converted.totalLegs}, Total Darts: ${converted.totalDarts}`);

        // Show game summary
        converted.games.forEach(g => {
            console.log(`  Game ${g.game_number}: ${g.type}, ${g.is_doubles ? 'doubles' : 'singles'}, winner: ${g.winner}, legs: ${g.result.home_legs}-${g.result.away_legs}`);
        });

        if (dryRun) {
            console.log('\n[DRY RUN] Would import this match');
            return { success: true, dryRun: true, score: `${converted.homeScore}-${converted.awayScore}` };
        }

        // Import via cloud function
        console.log('\nImporting to Firestore...');
        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        const importResult = await postToCloudFunction(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: id,
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

        if (!importResult.success) {
            throw new Error(importResult.error || 'Import failed');
        }

        console.log('Import successful!');

        // Update stats
        console.log('Updating player stats...');
        const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
        const statsResult = await postToCloudFunction(statsUrl, {
            leagueId: LEAGUE_ID,
            matchId: id
        });

        if (statsResult.success) {
            console.log(`Stats updated for ${statsResult.playersUpdated} players`);
        } else {
            console.log('Warning: Stats update failed:', statsResult.error);
        }

        return {
            success: true,
            score: `${converted.homeScore}-${converted.awayScore}`,
            playersUpdated: statsResult.playersUpdated || 0
        };

    } catch (error) {
        console.error('Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const weekArg = args.find(a => a.startsWith('--week='));
    const matchArg = args.find(a => a.startsWith('--match='));

    const weekFilter = weekArg ? parseInt(weekArg.split('=')[1]) : null;
    const matchFilter = matchArg ? matchArg.split('=')[1] : null;

    console.log('=== REIMPORT ALL MATCHES ===');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    if (weekFilter) console.log(`Week filter: ${weekFilter}`);
    if (matchFilter) console.log(`Match filter: ${matchFilter}`);
    console.log('');

    let matchesToProcess = MATCHES;

    if (weekFilter) {
        matchesToProcess = matchesToProcess.filter(m => m.week === weekFilter);
    }
    if (matchFilter) {
        matchesToProcess = matchesToProcess.filter(m => m.id === matchFilter);
    }

    console.log(`Processing ${matchesToProcess.length} matches...\n`);

    const results = [];
    for (const match of matchesToProcess) {
        const result = await reimportMatch(match, dryRun);
        results.push({ ...match, ...result });

        // Small delay between imports
        if (!dryRun) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\nSuccessful: ${successful.length}`);
    successful.forEach(r => {
        console.log(`  Week ${r.week}: ${r.homeTeam} vs ${r.awayTeam} -> ${r.score}${r.dryRun ? ' [DRY RUN]' : ''}`);
    });

    if (failed.length > 0) {
        console.log(`\nFailed: ${failed.length}`);
        failed.forEach(r => {
            console.log(`  Week ${r.week}: ${r.homeTeam} vs ${r.awayTeam} - ${r.error}`);
        });
    }

    console.log('\n=== COMPLETE ===');
}

main().catch(console.error);
