/**
 * Process all RTF match files and generate updated JSON with throws and player_stats
 */

const fs = require('fs');
const path = require('path');
const { parseRTFMatch, parseMultiMatchRTF } = require('./parse-rtf');

const tempDir = __dirname;

// Player name normalization map
const PLAYER_NAME_MAP = {
    'christian ketchem': 'Christian Ketchum',
    'christian ketchum': 'Christian Ketchum',
    'joshua kelly': 'Joshua Kelly',
    'josh kelly': 'Joshua Kelly',
    'dom russano': 'Dominick Russano',
    'dominick russano': 'Dominick Russano',
    'kevin y': 'Kevin Yasenchak',
    'cesar a': 'Cesar Alcantara',
    'jenn m': 'Jenn M',
    'eddie olschanskey': 'Eddie Olschansky',
    'eddie olschansky': 'Eddie Olschansky',
    // Russano v Mezlak players
    'danny russano': 'Danny Russano',
    'chris russano': 'Chris Russano',
    'eric duale': 'Eric Duale',
    'nick mezlak': 'Nick Mezlak',
    'cory jacobs': 'Cory Jacobs',
    'dillon ulisses': 'Dillon Ulisses',
    'dillon u': 'Dillon Ulisses',
    'eric': 'Eric Duale',
    'nick m': 'Nick Mezlak',
    'danny r': 'Danny Russano',
    'chris r': 'Chris Russano',
    'cory j': 'Cory Jacobs',
};

function normalizeName(name) {
    if (!name) return name;
    const lower = name.toLowerCase().trim();
    return PLAYER_NAME_MAP[lower] || name.trim();
}

// Match configuration - maps RTF files to match metadata
const MATCH_CONFIG = {
    'match 1.rtf': {
        outputFile: 'mpagel_v_dpagel_wk1_updated.json',
        match_id: 'SHOA7GXK51JvJ3gkaN7J',
        league_id: 'aOq4Y0ETxPZ66tM1uUtP',
        home_team: 'MPAGEL',
        away_team: 'DPAGEL',
        week: 1,
        date: '2026-01-14',
        home_roster: ['Matt Pagel', 'Joe Peters', 'John Linden'],
        away_roster: ['Donnie Pagel', 'Christian Ketchum', 'Jenn M']
    },
    'yasenchak v kull match.rtf': {
        outputFile: 'yasenchak_v_kull_wk1_updated.json',
        home_team: 'YASENCHAK',
        away_team: 'KULL',
        week: 1,
        home_roster: ['Kevin Yasenchak', 'Brian Smith', 'Cesar Alcantara'],
        away_roster: ['Nate Kull', 'Michael Jarvis', 'Steph Kull']
    },
    'partloVolschansky.rtf': {
        outputFile: 'partlo_v_volschansky_wk1_updated.json',
        home_team: 'PARTLO',
        away_team: 'OLSCHANSKY',
        week: 1,
        home_roster: ['Dan Partlo', 'Joe Donley', 'Kevin Mckelvey'],
        away_roster: ['Eddie Olschansky', 'Jeff Boss', 'Mike Gonzales']
    },
    'ragnoniVmassimiani.rtf': {
        outputFile: 'ragnoni_v_massimiani_wk1_updated.json',
        home_team: 'RAGNONI',
        away_team: 'MASSIMIANI',
        week: 1,
        home_roster: ['Tony Ragnoni', 'Chris Benco', 'Dominick Russano'],
        away_roster: ['Tony Massimiani', 'Derek Fess', 'Marc Tate', 'Joshua Kelly']
    },
    'russano v mezlak.rtf': {
        outputFile: 'russano_v_mezlak_wk1_updated.json',
        home_team: 'RUSSANO',
        away_team: 'MEZLAK',
        week: 1,
        home_roster: ['Danny Russano', 'Chris Russano', 'Eric Duale'],
        away_roster: ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses'],
        isMultiMatch: true  // This RTF contains multiple individual games concatenated
    }
};

// Convert parsed data to match JSON format
function convertToMatchJSON(games, config) {
    const match = {
        match_id: config.match_id || `MATCH_${Date.now()}`,
        league_id: config.league_id || 'aOq4Y0ETxPZ66tM1uUtP',
        home_team: config.home_team,
        away_team: config.away_team,
        week: config.week,
        date: config.date || '2026-01-14',
        games: []
    };

    // Track scores for final result
    let homeLegsWon = 0;
    let awayLegsWon = 0;
    let totalDarts = 0;
    let totalLegs = 0;

    for (const game of games) {
        // Get unique players from this game first to determine if it's doubles
        const homePlayers = new Set();
        const awayPlayers = new Set();

        // Scan all legs to find all players
        for (const leg of game.legs) {
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const normalized = normalizeName(name);
                if (stats.side === 'home') homePlayers.add(normalized);
                if (stats.side === 'away') awayPlayers.add(normalized);
            }
        }

        // Detect doubles: more than 1 player per side
        const isDoubles = homePlayers.size > 1 || awayPlayers.size > 1 || game.isDoubles;

        const gameData = {
            game_number: game.gameNumber,
            type: isDoubles ? 'doubles' : 'singles',
            format: game.type.includes('Cricket') ? 'cricket' : '501',
            legs: [],
            result: { home_legs: 0, away_legs: 0 }
        };

        // Reset for per-leg tracking
        homePlayers.clear();
        awayPlayers.clear();

        for (const leg of game.legs) {
            const legType = leg.type || game.type;
            const is501 = legType.toLowerCase().includes('501');

            // Build player side map
            const playerSideMap = {};
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const normalized = normalizeName(name);
                playerSideMap[normalized] = stats.side;
                if (stats.side === 'home') homePlayers.add(normalized);
                if (stats.side === 'away') awayPlayers.add(normalized);
            }

            // Convert throws to round-based format
            const throwsByRound = {};
            for (const t of leg.throws) {
                const round = t.round;
                if (!throwsByRound[round]) {
                    throwsByRound[round] = { round };
                }
                const normalized = normalizeName(t.player);
                let side = t.side;
                if (!side && playerSideMap[normalized]) {
                    side = playerSideMap[normalized];
                }

                if (is501) {
                    throwsByRound[round][side] = {
                        player: normalized,
                        score: t.score,
                        remaining: t.remaining
                    };
                } else {
                    throwsByRound[round][side] = {
                        player: normalized,
                        hit: t.hit,
                        marks: t.marks,
                        score: t.score
                    };
                }
            }

            const throws = Object.values(throwsByRound).sort((a, b) => a.round - b.round);

            // Calculate team stats
            const homePlayerStats = Object.entries(leg.player_stats || {})
                .filter(([_, s]) => s.side === 'home');
            const awayPlayerStats = Object.entries(leg.player_stats || {})
                .filter(([_, s]) => s.side === 'away');

            let homeStats, awayStats;
            if (is501) {
                const homeTotal = homePlayerStats.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    points: acc.points + s.points
                }), { darts: 0, points: 0 });
                const awayTotal = awayPlayerStats.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    points: acc.points + s.points
                }), { darts: 0, points: 0 });

                homeStats = {
                    darts: homeTotal.darts,
                    points: homeTotal.points,
                    three_dart_avg: homeTotal.darts > 0 ? parseFloat((homeTotal.points / homeTotal.darts * 3).toFixed(2)) : 0
                };
                awayStats = {
                    darts: awayTotal.darts,
                    points: awayTotal.points,
                    three_dart_avg: awayTotal.darts > 0 ? parseFloat((awayTotal.points / awayTotal.darts * 3).toFixed(2)) : 0
                };
                totalDarts += homeTotal.darts + awayTotal.darts;
            } else {
                const homeTotal = homePlayerStats.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    marks: acc.marks + s.marks
                }), { darts: 0, marks: 0 });
                const awayTotal = awayPlayerStats.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    marks: acc.marks + s.marks
                }), { darts: 0, marks: 0 });

                homeStats = {
                    darts: homeTotal.darts,
                    marks: homeTotal.marks,
                    mpr: homeTotal.darts > 0 ? parseFloat((homeTotal.marks / homeTotal.darts * 3).toFixed(2)) : 0
                };
                awayStats = {
                    darts: awayTotal.darts,
                    marks: awayTotal.marks,
                    mpr: awayTotal.darts > 0 ? parseFloat((awayTotal.marks / awayTotal.darts * 3).toFixed(2)) : 0
                };
                totalDarts += homeTotal.darts + awayTotal.darts;
            }

            // Determine winner
            let winner = 'home';
            if (is501) {
                const checkoutThrow = throws.find(t =>
                    (t.home && t.home.remaining === 0) || (t.away && t.away.remaining === 0)
                );
                if (checkoutThrow) {
                    winner = checkoutThrow.home && checkoutThrow.home.remaining === 0 ? 'home' : 'away';
                }
            }

            // Build player_stats with normalized names
            const playerStats = {};
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const normalized = normalizeName(name);
                if (is501) {
                    playerStats[normalized] = {
                        darts: stats.darts,
                        points: stats.points,
                        three_dart_avg: stats.three_dart_avg
                    };
                } else {
                    playerStats[normalized] = {
                        darts: stats.darts,
                        marks: stats.marks,
                        mpr: stats.mpr
                    };
                }
            }

            const legData = {
                leg_number: leg.legNumber,
                format: is501 ? '501' : 'cricket',
                winner: winner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: throws
            };

            gameData.legs.push(legData);
            totalLegs++;

            // Update game result
            if (winner === 'home') {
                gameData.result.home_legs++;
                homeLegsWon++;
            } else {
                gameData.result.away_legs++;
                awayLegsWon++;
            }
        }

        // Set game winner based on legs won
        gameData.winner = gameData.result.home_legs > gameData.result.away_legs ? 'home' : 'away';

        // Add players to game
        gameData.home_players = Array.from(homePlayers).map(name => ({ name }));
        gameData.away_players = Array.from(awayPlayers).map(name => ({ name }));

        match.games.push(gameData);
    }

    match.final_score = { home: homeLegsWon, away: awayLegsWon };
    match.total_darts = totalDarts;
    match.total_legs = totalLegs;

    return match;
}

// Process a single RTF file
function processRTFFile(rtfPath, config) {
    console.log(`\nProcessing: ${path.basename(rtfPath)}`);

    try {
        const games = parseRTFMatch(rtfPath);
        console.log(`  Found ${games.length} games`);

        let totalLegs = 0;
        for (const game of games) {
            totalLegs += game.legs.length;
        }
        console.log(`  Total legs: ${totalLegs}`);

        const match = convertToMatchJSON(games, config);
        return match;
    } catch (error) {
        console.error(`  Error: ${error.message}`);
        return null;
    }
}

// Process multi-match RTF file (contains multiple individual games in one file)
function processMultiMatchRTF(rtfPath, config) {
    console.log(`\nProcessing multi-match: ${path.basename(rtfPath)}`);

    try {
        const matches = parseMultiMatchRTF(rtfPath);
        console.log(`  Found ${matches.length} individual matches`);

        // Combine all games from individual matches into one team match
        // Renumber game numbers sequentially
        const allGames = [];
        let gameNumber = 1;

        for (const individualMatch of matches) {
            console.log(`  Match ${individualMatch.matchIndex}: ${individualMatch.homeTeam} vs ${individualMatch.awayTeam} (${individualMatch.games.length} game(s))`);

            for (const game of individualMatch.games) {
                // Renumber the game
                const renumberedGame = {
                    ...game,
                    gameNumber: gameNumber++,
                    // Also track the original match info
                    matchup: `${individualMatch.homeTeam} vs ${individualMatch.awayTeam}`
                };
                allGames.push(renumberedGame);
            }
        }

        console.log(`  Total games after combining: ${allGames.length}`);

        let totalLegs = 0;
        for (const game of allGames) {
            totalLegs += game.legs.length;
        }
        console.log(`  Total legs: ${totalLegs}`);

        const match = convertToMatchJSON(allGames, config);
        return match;
    } catch (error) {
        console.error(`  Error: ${error.message}`);
        console.error(error.stack);
        return null;
    }
}

// Main processing
console.log('=== Processing All RTF Match Files ===\n');

const results = [];

for (const [rtfFile, config] of Object.entries(MATCH_CONFIG)) {
    const rtfPath = path.join(tempDir, rtfFile);

    if (!fs.existsSync(rtfPath)) {
        console.log(`\nSkipping ${rtfFile} - file not found`);
        continue;
    }

    // Use multi-match processor if flagged
    const match = config.isMultiMatch
        ? processMultiMatchRTF(rtfPath, config)
        : processRTFFile(rtfPath, config);

    if (match) {
        const outputPath = path.join(tempDir, config.outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(match, null, 2));
        console.log(`  Saved to: ${config.outputFile}`);
        console.log(`  Games: ${match.games.length}, Legs: ${match.total_legs}, Darts: ${match.total_darts}`);
        results.push({ file: config.outputFile, games: match.games.length, legs: match.total_legs });
    }
}

console.log('\n=== Summary ===');
console.log(`Processed ${results.length} matches:`);
for (const r of results) {
    console.log(`  ${r.file}: ${r.games} games, ${r.legs} legs`);
}
