/**
 * Debug Mezlak v Russano match
 */

const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

// Team rosters
const MEZLAK_TEAM = ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U'];
const RUSSANO_TEAM = ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric'];

function getTeam(playerName) {
    const name = playerName.trim();
    for (const p of MEZLAK_TEAM) {
        if (name.toLowerCase().includes(p.toLowerCase())) return 'mezlak';
    }
    for (const p of RUSSANO_TEAM) {
        if (name.toLowerCase().includes(p.toLowerCase())) return 'russano';
    }
    return 'unknown';
}

const rtfPath = path.join(__dirname, 'trips league', 'mezlak v russano.rtf');
const games = parseRTFMatch(rtfPath);

console.log('=== MEZLAK V RUSSANO DEBUG ===\n');
console.log(`Parsed ${games.length} sets\n`);

let mezlakSets = 0;
let russanoSets = 0;

for (const game of games) {
    console.log(`\nSET ${game.gameNumber} (${game.type}):`);

    // Get players from legs
    const players = new Set();
    for (const leg of game.legs) {
        for (const [name, stats] of Object.entries(leg.player_stats || {})) {
            players.add(name);
        }
    }
    console.log(`  Players: ${Array.from(players).join(', ')}`);

    let mezlakLegs = 0;
    let russanoLegs = 0;

    for (const leg of game.legs) {
        let legWinner = null;
        const legType = (leg.type || game.type || '').toLowerCase();
        const is501 = legType.includes('501');

        // For 501, check throws for checkout
        if (is501) {
            for (const t of (leg.throws || [])) {
                if (t.remaining === 0) {
                    const team = getTeam(t.player);
                    legWinner = team;
                    break;
                }
            }
            // Fallback: check points
            if (!legWinner) {
                let mezlakPts = 0, russanoPts = 0;
                for (const [name, stats] of Object.entries(leg.player_stats || {})) {
                    const team = getTeam(name);
                    if (team === 'mezlak') mezlakPts += stats.points || 0;
                    else if (team === 'russano') russanoPts += stats.points || 0;
                }
                if (mezlakPts === 501) legWinner = 'mezlak';
                else if (russanoPts === 501) legWinner = 'russano';
            }
        } else {
            // Cricket - use parser winner
            if (leg.winner) {
                // Map home/away to team
                const homePlayer = Object.entries(leg.player_stats || {}).find(([_, s]) => s.side === 'home');
                const awayPlayer = Object.entries(leg.player_stats || {}).find(([_, s]) => s.side === 'away');
                if (leg.winner === 'home' && homePlayer) {
                    legWinner = getTeam(homePlayer[0]);
                } else if (leg.winner === 'away' && awayPlayer) {
                    legWinner = getTeam(awayPlayer[0]);
                }
            }
        }

        if (legWinner === 'mezlak') mezlakLegs++;
        else if (legWinner === 'russano') russanoLegs++;

        console.log(`    Leg ${leg.legNumber} (${legType}): ${legWinner || 'unknown'}`);
    }

    const setWinner = mezlakLegs > russanoLegs ? 'mezlak' :
                      russanoLegs > mezlakLegs ? 'russano' : 'tie';

    if (setWinner === 'mezlak') mezlakSets++;
    else if (setWinner === 'russano') russanoSets++;

    console.log(`  SET WINNER: ${setWinner} (${mezlakLegs}-${russanoLegs})`);
}

console.log('\n========================================');
console.log(`FINAL: N. Mezlak ${mezlakSets} - ${russanoSets} D. Russano`);
console.log(`Total sets: ${mezlakSets + russanoSets}`);
