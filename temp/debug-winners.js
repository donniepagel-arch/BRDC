/**
 * Debug winner detection for Pagel v Pagel
 * Expected: M. Pagel 7 - 2 D. Pagel
 */

const { parseRTFMatch } = require('./parse-rtf.js');
const path = require('path');

// Team rosters for reference
const HOME_TEAM = ['Matt Pagel', 'Joe Peters', 'John Linden']; // M. Pagel
const AWAY_TEAM = ['Donnie Pagel', 'Christian Ketchem', 'Jenn M']; // D. Pagel

function getTeamForPlayer(playerName) {
    if (HOME_TEAM.some(p => playerName.includes(p))) return 'home';
    if (AWAY_TEAM.some(p => playerName.includes(p))) return 'away';
    return 'unknown';
}

const rtfPath = path.join(__dirname, 'trips league', 'pagel v pagel MATCH.rtf');
const games = parseRTFMatch(rtfPath);

console.log('=== PAGEL V PAGEL - DEBUG WINNER DETECTION ===\n');
console.log('Expected: M. Pagel 7 - 2 D. Pagel\n');

let homeSetWins = 0;
let awaySetWins = 0;

for (const game of games) {
    console.log(`\n=== SET ${game.gameNumber} (${game.type}) ===`);
    console.log(`Players: ${game.home_players?.join(', ') || '?'} vs ${game.away_players?.join(', ') || '?'}`);

    let homeLegWins = 0;
    let awayLegWins = 0;

    for (const leg of game.legs) {
        console.log(`\n  Leg ${leg.legNumber} (${leg.type || game.type}):`);

        // Check player_stats
        const playerStats = leg.player_stats || {};
        let homePoints = 0, awayPoints = 0;
        let homeMarks = 0, awayMarks = 0;
        let homeDarts = 0, awayDarts = 0;

        for (const [name, stats] of Object.entries(playerStats)) {
            const side = stats.side || getTeamForPlayer(name);
            if (side === 'home') {
                homePoints += stats.points || 0;
                homeMarks += stats.marks || 0;
                homeDarts += stats.darts || 0;
            } else if (side === 'away') {
                awayPoints += stats.points || 0;
                awayMarks += stats.marks || 0;
                awayDarts += stats.darts || 0;
            }
            console.log(`    ${name} (${side}): ${stats.points || 0} pts, ${stats.marks || 0} marks, ${stats.darts || 0} darts`);
        }

        // Check throws for winner
        const throws = leg.throws || [];
        let winnerFromThrows = null;
        let lastThrow = null;
        let closingThrow = null;

        // Check if leg has winner from parser
        if (leg.winner) {
            console.log(`    PARSER WINNER: ${leg.winner}`);
        }

        for (const t of throws) {
            if (t.remaining === 0) {
                winnerFromThrows = t.side;
                console.log(`    CHECKOUT: ${t.player} (${t.side}) remaining=0`);
            }
            if (t.isClosingThrow) {
                closingThrow = t;
                console.log(`    CLOSING THROW: ${t.player} (${t.side}) isClosingThrow=true`);
            }
            lastThrow = t;
        }

        // Check for rounds where only one side threw
        const roundMap = {};
        for (const t of throws) {
            if (!roundMap[t.round]) roundMap[t.round] = { home: null, away: null };
            roundMap[t.round][t.side] = t;
        }
        const lastRound = Math.max(...Object.keys(roundMap).map(Number));
        const lastRoundData = roundMap[lastRound];
        if (lastRoundData) {
            if (lastRoundData.home && !lastRoundData.away) {
                console.log(`    LAST ROUND ${lastRound}: only HOME threw`);
            } else if (lastRoundData.away && !lastRoundData.home) {
                console.log(`    LAST ROUND ${lastRound}: only AWAY threw`);
            } else {
                console.log(`    LAST ROUND ${lastRound}: both threw`);
            }
        }

        // Determine winner
        let legWinner = null;
        const legType = (leg.type || game.type || '').toLowerCase();
        const is501 = legType.includes('501');

        if (winnerFromThrows) {
            legWinner = winnerFromThrows;
            console.log(`    Winner from throws (remaining=0): ${legWinner}`);
        } else if (is501) {
            // Check if either side scored 501
            if (homePoints === 501) {
                legWinner = 'home';
                console.log(`    Winner from points (home=501): home`);
            } else if (awayPoints === 501) {
                legWinner = 'away';
                console.log(`    Winner from points (away=501): away`);
            } else {
                console.log(`    NO 501 WINNER DETECTED! home=${homePoints}, away=${awayPoints}`);
            }
        } else {
            // Cricket - use parser winner first
            if (leg.winner) {
                legWinner = leg.winner;
                console.log(`    Winner from parser: ${legWinner}`);
            } else if (closingThrow) {
                legWinner = closingThrow.side;
                console.log(`    Winner from closingThrow: ${legWinner}`);
            } else if (lastRoundData) {
                if (lastRoundData.home && !lastRoundData.away) {
                    legWinner = 'home';
                    console.log(`    Winner from single-side last round: home`);
                } else if (lastRoundData.away && !lastRoundData.home) {
                    legWinner = 'away';
                    console.log(`    Winner from single-side last round: away`);
                } else if (lastThrow) {
                    legWinner = lastThrow.side;
                    console.log(`    Winner from last throw (fallback): ${legWinner}`);
                }
            }
        }

        if (legWinner === 'home') homeLegWins++;
        else if (legWinner === 'away') awayLegWins++;

        console.log(`    LEG WINNER: ${legWinner || 'UNKNOWN'}`);
    }

    // Determine set winner (best of 3)
    const setWinner = homeLegWins > awayLegWins ? 'home' :
                      awayLegWins > homeLegWins ? 'away' : 'tie';

    if (setWinner === 'home') homeSetWins++;
    else if (setWinner === 'away') awaySetWins++;

    console.log(`\n  SET ${game.gameNumber} RESULT: ${homeLegWins}-${awayLegWins} -> ${setWinner.toUpperCase()}`);
}

console.log('\n========================================');
console.log(`FINAL: M. Pagel ${homeSetWins} - ${awaySetWins} D. Pagel`);
console.log(`Expected: M. Pagel 7 - 2 D. Pagel`);
console.log(`Match: ${homeSetWins === 7 && awaySetWins === 2 ? 'YES' : 'NO'}`);
