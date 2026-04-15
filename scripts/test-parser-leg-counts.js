const { parseRTFMatch } = require('../temp/parse-rtf');
const path = require('path');

// Test file: Week 3 Russano vs Yasenchak
const testFile = 'temp/trips league/week 3/russano v yasenchak.rtf';

console.log('=== PARSER LEG COUNT TEST ===\n');
console.log(`Parsing: ${testFile}\n`);

try {
    const parsed = parseRTFMatch(testFile);
    const parsedGames = parsed.games || [];
    
    console.log(`Total games parsed: ${parsedGames.length}\n`);
    
    parsedGames.forEach((game, idx) => {
        console.log(`Game ${idx + 1}:`);
        console.log(`  Type: ${game.type}`);
        console.log(`  Legs: ${(game.legs || []).length}`);
        
        if (game.legs && game.legs.length > 0) {
            let homeWins = 0;
            let awayWins = 0;
            
            game.legs.forEach((leg, legIdx) => {
                const winner = leg.winner;
                console.log(`    Leg ${legIdx + 1}: winner=${winner}`);
                
                if (winner === 'home') homeWins++;
                else if (winner === 'away') awayWins++;
            });
            
            const isValid = (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
                          (awayWins === 2 && (homeWins === 0 || homeWins === 1));
            
            const status = isValid ? '✓' : '❌ INVALID';
            console.log(`  Leg Count: home=${homeWins}, away=${awayWins} ${status}`);
            
            if (!isValid) {
                if (homeWins + awayWins > 3) {
                    console.log(`    ERROR: More than 3 legs total!`);
                } else if (homeWins > 2 || awayWins > 2) {
                    console.log(`    ERROR: One side has more than 2 wins!`);
                } else if (homeWins === awayWins) {
                    console.log(`    ERROR: Tie (both sides have same wins)!`);
                }
            }
        }
        console.log('');
    });
    
    // Summary
    let validCount = 0;
    let invalidCount = 0;
    
    parsedGames.forEach(game => {
        if (game.legs && game.legs.length > 0) {
            let homeWins = 0;
            let awayWins = 0;
            
            game.legs.forEach(leg => {
                if (leg.winner === 'home') homeWins++;
                else if (leg.winner === 'away') awayWins++;
            });
            
            const isValid = (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
                          (awayWins === 2 && (homeWins === 0 || homeWins === 1));
            
            if (isValid) validCount++;
            else invalidCount++;
        }
    });
    
    console.log('═══════════════════════════════════════');
    console.log(`SUMMARY: ${validCount} valid, ${invalidCount} invalid`);
    console.log('═══════════════════════════════════════\n');
    
    if (invalidCount === 0) {
        console.log('✅ Parser output is correct! Problem must be in conversion logic.');
    } else {
        console.log('❌ Parser is outputting invalid leg counts.');
    }
    
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
