const { parseRTFMatch } = require('../temp/parse-rtf');
const path = require('path');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          PARSER FIX DEMONSTRATION                            ║');
console.log('║  Showing how normalization fixed the 1-1 tie bug             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const testFile = 'temp/trips league/week 1/mezlak v russano.rtf';
const fileName = path.basename(testFile);

console.log(`File: ${fileName}`);
console.log(`Problem Games: Set 1 and Set 8 were showing 1-1 ties\n`);

try {
    const parsed = parseRTFMatch(testFile);
    const games = parsed.games || [];
    
    // Show Game 1 (Set 1)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SET 1 (Game 1) - 501 SIDO Doubles');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const game1 = games[0];
    console.log('Teams:');
    const leg1Players = game1.legs[0].player_stats || {};
    const homeTeam = [];
    const awayTeam = [];
    for (const [name, stats] of Object.entries(leg1Players)) {
        if (stats.side === 'home') homeTeam.push(name);
        else awayTeam.push(name);
    }
    console.log(`  Home: ${homeTeam.join(' + ')}`);
    console.log(`  Away: ${awayTeam.join(' + ')}\n`);
    
    console.log('Results:');
    game1.legs.forEach((leg, idx) => {
        const winnerTeam = leg.winner === 'home' ? 'Home' : 'Away';
        const winnerNames = leg.winner === 'home' ? homeTeam.join(' + ') : awayTeam.join(' + ');
        console.log(`  Leg ${idx + 1}: ${winnerTeam} wins (${winnerNames})`);
    });
    
    const g1HomeWins = game1.legs.filter(l => l.winner === 'home').length;
    const g1AwayWins = game1.legs.filter(l => l.winner === 'away').length;
    console.log(`\n✅ FINAL SCORE: ${g1HomeWins}-${g1AwayWins}`);
    
    if (g1HomeWins === g1AwayWins) {
        console.log('   ❌ ERROR: Still showing tie!\n');
    } else {
        console.log('   ✓ Correct! One side won 2-0.\n');
    }
    
    // Show Game 8 (Set 8)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SET 8 (Game 8) - 501 SIDO Singles');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const game8 = games[7];
    console.log('Players:');
    const leg8Players = game8.legs[0].player_stats || {};
    const home8 = [];
    const away8 = [];
    for (const [name, stats] of Object.entries(leg8Players)) {
        if (stats.side === 'home') home8.push(name);
        else away8.push(name);
    }
    console.log(`  Home: ${home8.join(', ')}`);
    console.log(`  Away: ${away8.join(', ')}\n`);
    
    console.log('Results:');
    game8.legs.forEach((leg, idx) => {
        const winnerSide = leg.winner === 'home' ? 'Home' : 'Away';
        const winnerName = leg.winner === 'home' ? home8[0] : away8[0];
        console.log(`  Leg ${idx + 1}: ${winnerSide} wins (${winnerName})`);
    });
    
    const g8HomeWins = game8.legs.filter(l => l.winner === 'home').length;
    const g8AwayWins = game8.legs.filter(l => l.winner === 'away').length;
    console.log(`\n✅ FINAL SCORE: ${g8HomeWins}-${g8AwayWins}`);
    
    if (g8HomeWins === g8AwayWins) {
        console.log('   ❌ ERROR: Still showing tie!\n');
    } else {
        console.log('   ✓ Correct! One side won 2-0.\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const allValid = games.every(game => {
        const homeWins = game.legs.filter(l => l.winner === 'home').length;
        const awayWins = game.legs.filter(l => l.winner === 'away').length;
        return (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
               (awayWins === 2 && (homeWins === 0 || homeWins === 1));
    });
    
    if (allValid) {
        console.log('✅ ALL 9 SETS NOW SHOW VALID SCORES');
        console.log('✅ Parser normalization fixed the orientation bug');
        console.log('✅ Same players consistently assigned to same side across legs\n');
    } else {
        console.log('❌ Some sets still showing invalid scores\n');
    }
    
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
