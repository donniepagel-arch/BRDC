/**
 * Debug parsing to find discrepancy
 * Compare parsed stats vs DartConnect performance report
 */

const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

// DartConnect official stats from performance report
const DC_STATS = {
    'Joe Peters': { x01_pts: 2531, x01_darts: 136, x01_3da: 55.83, cricket_marks: 93, cricket_darts: 129, cricket_mpr: 2.2 },
    'Matt Pagel': { x01_pts: 1642, x01_darts: 92, x01_3da: 53.54, cricket_marks: 111, cricket_darts: 122, cricket_mpr: 2.7 },
    'Christian Ketchem': { x01_pts: 2127, x01_darts: 128, x01_3da: 49.85, cricket_marks: 61, cricket_darts: 129, cricket_mpr: 1.4 },
    'Donnie Pagel': { x01_pts: 1629, x01_darts: 99, x01_3da: 49.36, cricket_marks: 106, cricket_darts: 132, cricket_mpr: 2.4 },
    'John Linden': { x01_pts: 2190, x01_darts: 140, x01_3da: 46.93, cricket_marks: 79, cricket_darts: 129, cricket_mpr: 1.8 },
    'Jenn M': { x01_pts: 2142, x01_darts: 141, x01_3da: 45.57, cricket_marks: 81, cricket_darts: 128, cricket_mpr: 1.9 }
};

const rtfPath = path.join(__dirname, 'trips league', 'pagel v pagel MATCH.rtf');

console.log('Parsing Pagel v Pagel match...\n');

const games = parseRTFMatch(rtfPath);
console.log(`Parsed ${games.length} games\n`);

// Aggregate stats by player
const parsedStats = {};

for (const game of games) {
    for (const leg of game.legs) {
        const legType = (leg.type || game.type || '').toLowerCase();
        const is501 = legType.includes('501');

        for (const [player, stats] of Object.entries(leg.player_stats || {})) {
            if (!parsedStats[player]) {
                parsedStats[player] = {
                    x01_pts: 0,
                    x01_darts: 0,
                    cricket_marks: 0,
                    cricket_darts: 0,
                    legs: []
                };
            }

            if (is501) {
                parsedStats[player].x01_pts += stats.points || 0;
                parsedStats[player].x01_darts += stats.darts || 0;
                parsedStats[player].legs.push({
                    game: game.gameNumber,
                    leg: leg.legNumber,
                    type: '501',
                    pts: stats.points,
                    darts: stats.darts,
                    avg: stats.three_dart_avg
                });
            } else {
                parsedStats[player].cricket_marks += stats.marks || 0;
                parsedStats[player].cricket_darts += stats.darts || 0;
                parsedStats[player].legs.push({
                    game: game.gameNumber,
                    leg: leg.legNumber,
                    type: 'cricket',
                    marks: stats.marks,
                    darts: stats.darts,
                    mpr: stats.mpr
                });
            }
        }
    }
}

// Compare parsed vs DC stats
console.log('=== COMPARISON: Parsed vs DartConnect ===\n');

for (const [player, dc] of Object.entries(DC_STATS)) {
    const parsed = parsedStats[player];
    if (!parsed) {
        console.log(`${player}: NOT FOUND IN PARSED DATA\n`);
        continue;
    }

    const parsed_3da = parsed.x01_darts > 0 ? ((parsed.x01_pts / parsed.x01_darts) * 3).toFixed(2) : 0;
    const parsed_mpr = parsed.cricket_darts > 0 ? ((parsed.cricket_marks / parsed.cricket_darts) * 3).toFixed(2) : 0;

    const x01_match = parsed.x01_darts === dc.x01_darts && parsed.x01_pts === dc.x01_pts;
    const cricket_match = parsed.cricket_darts === dc.cricket_darts && parsed.cricket_marks === dc.cricket_marks;

    console.log(`${player}:`);
    console.log(`  X01:     Parsed: ${parsed.x01_pts} pts / ${parsed.x01_darts} darts = ${parsed_3da} 3DA`);
    console.log(`           DC:     ${dc.x01_pts} pts / ${dc.x01_darts} darts = ${dc.x01_3da} 3DA`);
    console.log(`           DIFF:   pts=${parsed.x01_pts - dc.x01_pts}, darts=${parsed.x01_darts - dc.x01_darts} ${x01_match ? '✓' : '✗'}`);
    console.log(`  Cricket: Parsed: ${parsed.cricket_marks} marks / ${parsed.cricket_darts} darts = ${parsed_mpr} MPR`);
    console.log(`           DC:     ${dc.cricket_marks} marks / ${dc.cricket_darts} darts = ${dc.cricket_mpr} MPR`);
    console.log(`           DIFF:   marks=${parsed.cricket_marks - dc.cricket_marks}, darts=${parsed.cricket_darts - dc.cricket_darts} ${cricket_match ? '✓' : '✗'}`);
    console.log('');
}

// Show detailed breakdown for Donnie Pagel
console.log('\n=== DONNIE PAGEL LEG-BY-LEG ===\n');
const donnie = parsedStats['Donnie Pagel'];
if (donnie) {
    console.log('501 Legs:');
    donnie.legs.filter(l => l.type === '501').forEach(l => {
        console.log(`  Game ${l.game}.${l.leg}: ${l.pts} pts, ${l.darts} darts, ${l.avg} avg`);
    });
    console.log(`  TOTAL: ${donnie.x01_pts} pts, ${donnie.x01_darts} darts\n`);

    console.log('Cricket Legs:');
    donnie.legs.filter(l => l.type === 'cricket').forEach(l => {
        console.log(`  Game ${l.game}.${l.leg}: ${l.marks} marks, ${l.darts} darts, ${l.mpr} mpr`);
    });
    console.log(`  TOTAL: ${donnie.cricket_marks} marks, ${donnie.cricket_darts} darts`);
}
