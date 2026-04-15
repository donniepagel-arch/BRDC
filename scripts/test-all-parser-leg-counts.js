const { parseRTFMatch } = require('../temp/parse-rtf');
const fs = require('fs');
const path = require('path');

console.log('=== TESTING ALL RTF FILES FOR PARSER LEG COUNT VALIDITY ===\n');

const testFiles = [
    'temp/trips league/week 1/mezlak v russano.rtf',
    'temp/trips league/week 1/partlo v olschansky.rtf',
    'temp/trips league/week 3/russano v yasenchak.rtf'
];

let totalFiles = 0;
let totalValid = 0;
let totalInvalid = 0;

for (const testFile of testFiles) {
    if (!fs.existsSync(testFile)) {
        console.log(`❌ File not found: ${testFile}\n`);
        continue;
    }
    
    totalFiles++;
    console.log(`📄 ${testFile}`);
    
    try {
        const parsed = parseRTFMatch(testFile);
        const parsedGames = parsed.games || [];
        
        let fileValid = 0;
        let fileInvalid = 0;
        
        parsedGames.forEach((game, idx) => {
            if (game.legs && game.legs.length > 0) {
                let homeWins = 0;
                let awayWins = 0;
                
                game.legs.forEach(leg => {
                    if (leg.winner === 'home') homeWins++;
                    else if (leg.winner === 'away') awayWins++;
                });
                
                const isValid = (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
                              (awayWins === 2 && (homeWins === 0 || homeWins === 1));
                
                if (isValid) {
                    fileValid++;
                } else {
                    fileInvalid++;
                    console.log(`  ❌ Game ${idx + 1}: ${homeWins}-${awayWins} INVALID`);
                }
            }
        });
        
        totalValid += fileValid;
        totalInvalid += fileInvalid;
        
        const status = fileInvalid === 0 ? '✅' : '❌';
        console.log(`  ${status} Valid: ${fileValid}, Invalid: ${fileInvalid}`);
        
    } catch (error) {
        console.log(`  ❌ Error parsing: ${error.message}`);
    }
    
    console.log('');
}

console.log('═══════════════════════════════════════════════════════');
console.log(`FINAL SUMMARY:`);
console.log(`  Files tested: ${totalFiles}`);
console.log(`  Total games valid: ${totalValid}`);
console.log(`  Total games invalid: ${totalInvalid}`);
console.log('═══════════════════════════════════════════════════════\n');

if (totalInvalid === 0) {
    console.log('✅ ALL FILES PASS! Parser correctly handles leg counts.');
} else {
    console.log(`❌ ${totalInvalid} invalid leg counts found across files.`);
    process.exit(1);
}
