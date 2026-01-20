/**
 * Generate Match JSON from RTF files
 * Uses the RTF parser to extract throws and calculate player_stats
 */

const fs = require('fs');
const path = require('path');
const { parseRTFMatch, parseHitNotation } = require('./parse-rtf');

// Player name normalization map
const PLAYER_NAME_MAP = {
    'christian ketchem': 'Christian Ketchum',
    'christian ketchum': 'Christian Ketchum',
    'joshua kelly': 'Joshua Kelly',
    'dom russano': 'Dominick Russano',
    'dominick russano': 'Dominick Russano',
    // Add more mappings as needed
};

function normalizeName(name) {
    const lower = name.toLowerCase().trim();
    return PLAYER_NAME_MAP[lower] || name.trim();
}

// Convert parsed game data to match JSON format
function convertToMatchFormat(games, matchMeta = {}) {
    const match = {
        ...matchMeta,
        games: []
    };

    for (const game of games) {
        const gameData = {
            game_number: game.gameNumber,
            format: game.type.includes('Cricket') ? 'cricket' : '501',
            is_doubles: game.isDoubles || false,
            legs: []
        };

        for (const leg of game.legs) {
            const legType = leg.type || game.type;
            const is501 = legType.toLowerCase().includes('501');

            // Build a map of player to side from player_stats
            const playerSideMap = {};
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                playerSideMap[normalizeName(name)] = stats.side;
            }

            // Build throws array with normalized names and fix null sides
            const throws = leg.throws.map(t => {
                const normalizedPlayer = normalizeName(t.player);
                let side = t.side;
                // If side is null, look up from player_stats
                if (!side && playerSideMap[normalizedPlayer]) {
                    side = playerSideMap[normalizedPlayer];
                }
                return {
                    round: t.round,
                    side: side,
                    player: normalizedPlayer,
                    ...(is501 ? { score: t.score, remaining: t.remaining } : { hit: t.hit, marks: t.marks, score: t.score })
                };
            });

            // Determine winner from throws (who got to 0 or closed out)
            let winner = 'home';
            if (is501) {
                // Find the throw that reaches 0
                const checkoutThrow = throws.find(t => t.remaining === 0);
                if (checkoutThrow) {
                    winner = checkoutThrow.side;
                }
            }

            // Build player_stats with normalized names
            const playerStats = {};
            for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                const normalizedName = normalizeName(name);
                if (is501) {
                    playerStats[normalizedName] = {
                        darts: stats.darts,
                        points: stats.points,
                        three_dart_avg: stats.three_dart_avg,
                        side: stats.side
                    };
                } else {
                    playerStats[normalizedName] = {
                        darts: stats.darts,
                        marks: stats.marks,
                        mpr: stats.mpr,
                        side: stats.side
                    };
                }
            }

            // Calculate team stats (home_stats, away_stats)
            const homePlayers = Object.entries(playerStats).filter(([_, s]) => s.side === 'home');
            const awayPlayers = Object.entries(playerStats).filter(([_, s]) => s.side === 'away');

            let homeStats, awayStats;
            if (is501) {
                const homeTotal = homePlayers.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    points: acc.points + s.points
                }), { darts: 0, points: 0 });
                const awayTotal = awayPlayers.reduce((acc, [_, s]) => ({
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
            } else {
                const homeTotal = homePlayers.reduce((acc, [_, s]) => ({
                    darts: acc.darts + s.darts,
                    marks: acc.marks + s.marks
                }), { darts: 0, marks: 0 });
                const awayTotal = awayPlayers.reduce((acc, [_, s]) => ({
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
            }

            const legData = {
                leg_number: leg.legNumber,
                format: is501 ? '501' : 'cricket',
                is_doubles: leg.isDoubles || game.isDoubles || false,
                winner: winner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: throws
            };

            gameData.legs.push(legData);
        }

        match.games.push(gameData);
    }

    return match;
}

// Process a single RTF file
function processRTFFile(rtfPath, matchMeta = {}) {
    console.log(`Processing: ${rtfPath}`);
    const games = parseRTFMatch(rtfPath);
    const match = convertToMatchFormat(games, matchMeta);
    return match;
}

// Main processing
const tempDir = __dirname;
const rtfFiles = [
    { rtf: 'dc/domjosh.rtf', meta: { match_name: 'Dom vs Josh (Game 9)', week: 1 } }
];

// Process domjosh as a test
const domjoshPath = path.join(tempDir, 'dc', 'domjosh.rtf');
if (fs.existsSync(domjoshPath)) {
    const match = processRTFFile(domjoshPath, {
        match_name: 'Dom Russano vs Josh Kelly',
        game_type: '501 SIDO Singles'
    });

    console.log('\n=== Generated Match JSON ===');
    console.log(JSON.stringify(match, null, 2));

    // Save to file
    const outputPath = path.join(tempDir, 'domjosh_parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(match, null, 2));
    console.log(`\nSaved to: ${outputPath}`);
}

module.exports = { processRTFFile, convertToMatchFormat, normalizeName };
