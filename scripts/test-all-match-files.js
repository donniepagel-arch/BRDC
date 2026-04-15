const { parseRTFMatch } = require('../temp/parse-rtf');
const fs = require('fs');
const path = require('path');

console.log('=== TESTING ALL MATCH RTF FILES ===\n');

// Test all actual match files (not performance/stats reports)
const testFiles = [
    // Week 1
    'temp/trips league/week 1/pagel v pagel MATCH.rtf',
    'temp/trips league/week 1/partlo v olschansky.rtf',
    'temp/trips league/week 1/yasenchak v kull.rtf',
    'temp/trips league/week 1/mezlak v russano.rtf',
    'temp/trips league/week 1/massimiani v ragnoni.rtf',
    // Week 2
    'temp/trips league/week 2/dpartlo v mpagel.rtf',
    'temp/trips league/week 2/massimiani v yasenchak.rtf',
    'temp/trips league/week 2/mezlak V e.o.rtf',
    'temp/trips league/week 2/russano v ragnoni.rtf',
    'temp/trips league/week 2/pagel v kull.rtf',
    // Week 3
    'temp/trips league/week 3/dpartlo v dpagel.rtf',
    'temp/trips league/week 3/mpagel v nmezlak.rtf',
    'temp/trips league/week 3/nkull v neon nightmares.rtf',
    'temp/trips league/week 3/e.o v jragnonio.rtf',
    'temp/trips league/week 3/russano v yasenchak.rtf'
];

let totalFiles = 0;
let totalGames = 0;
let totalValid = 0;
let totalInvalid = 0;
const filesWithErrors = [];

for (const testFile of testFiles) {
    if (!fs.existsSync(testFile)) {
        console.log(`⚠️  File not found: ${testFile}\n`);
        continue;
    }
    
    totalFiles++;
    const shortName = path.basename(testFile);
    
    try {
        const parsed = parseRTFMatch(testFile);
        const parsedGames = parsed.games || [];
        
        let fileValid = 0;
        let fileInvalid = 0;
        const invalidGames = [];
        
        parsedGames.forEach((game, idx) => {
            if (game.legs && game.legs.length > 0) {
                totalGames++;
                let homeWins = 0;
                let awayWins = 0;
                
                game.legs.forEach(leg => {
                    if (leg.winner === 'home') homeWins++;
                    else if (leg.winner === 'away') awayWins++;
                });
                
                // Valid outcomes:
                // - 2-0 or 2-1 sweep (someone won best of 3)
                // - 1-0 (forfeit or incomplete - only 1 leg played)
                // - 1-1 (incomplete - tied but 3rd leg missing - data quality issue)
                const isValid = (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
                              (awayWins === 2 && (homeWins === 0 || homeWins === 1)) ||
                              (homeWins === 1 && awayWins === 0) ||
                              (homeWins === 0 && awayWins === 1) ||
                              (homeWins === 1 && awayWins === 1 && game.legs.length === 2); // Tied but incomplete
                
                if (isValid) {
                    fileValid++;
                } else {
                    fileInvalid++;
                    invalidGames.push(`Game ${idx + 1}: ${homeWins}-${awayWins}`);
                }
            }
        });
        
        totalValid += fileValid;
        totalInvalid += fileInvalid;
        
        const status = fileInvalid === 0 ? '✅' : '❌';
        console.log(`${status} ${shortName.padEnd(40)} ${fileValid}/${fileValid + fileInvalid} valid`);
        
        if (invalidGames.length > 0) {
            filesWithErrors.push({ file: shortName, errors: invalidGames });
            invalidGames.forEach(err => console.log(`     ${err}`));
        }
        
    } catch (error) {
        console.log(`❌ ${shortName.padEnd(40)} ERROR: ${error.message}`);
        filesWithErrors.push({ file: shortName, errors: [error.message] });
    }
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(`FINAL SUMMARY:`);
console.log(`  Files tested: ${totalFiles}`);
console.log(`  Total games: ${totalGames}`);
console.log(`  Valid games: ${totalValid}`);
console.log(`  Invalid games: ${totalInvalid}`);
console.log('═══════════════════════════════════════════════════════\n');

if (totalInvalid === 0 && filesWithErrors.length === 0) {
    console.log('✅ ALL FILES PASS! Parser correctly handles all match files.');
} else {
    console.log(`❌ Issues found in ${filesWithErrors.length} files:`);
    filesWithErrors.forEach(f => {
        console.log(`\n  ${f.file}:`);
        f.errors.forEach(e => console.log(`    - ${e}`));
    });
    process.exit(1);
}
