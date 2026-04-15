const { parseRTFMatch } = require('../temp/parse-rtf');

// All 15 matches to validate
const MATCHES = [
  // Week 1
  { week: 1, name: 'M. Pagel vs D. Pagel', file: 'temp/trips league/week 1/pagel v pagel MATCH.rtf' },
  { week: 1, name: 'N. Kull vs K. Yasenchak', file: 'temp/trips league/week 1/yasenchak v kull.rtf' },
  { week: 1, name: 'E.O vs D. Partlo', file: 'temp/trips league/week 1/partlo v olschansky.rtf' },
  { week: 1, name: 'N. Mezlak vs D. Russano', file: 'temp/trips league/week 1/mezlak v russano.rtf' },
  { week: 1, name: 'J. Ragnoni vs neon nightmares', file: 'temp/trips league/week 1/massimiani v ragnoni.rtf' },
  // Week 2
  { week: 2, name: 'D. Pagel vs N. Kull', file: 'temp/trips league/week 2/pagel v kull.rtf' },
  { week: 2, name: 'D. Russano vs J. Ragnoni', file: 'temp/trips league/week 2/russano v ragnoni.rtf' },
  { week: 2, name: 'N. Mezlak vs E.O', file: 'temp/trips league/week 2/mezlak V e.o.rtf' },
  { week: 2, name: 'D. Partlo vs M. Pagel', file: 'temp/trips league/week 2/dpartlo v mpagel.rtf' },
  { week: 2, name: 'neon nightmares vs K. Yasenchak', file: 'temp/trips league/week 2/massimiani v yasenchak.rtf' },
  // Week 3
  { week: 3, name: 'E.O vs J. Ragnoni', file: 'temp/trips league/week 3/e.o v jragnonio.rtf' },
  { week: 3, name: 'D. Partlo vs D. Pagel', file: 'temp/trips league/week 3/dpartlo v dpagel.rtf' },
  { week: 3, name: 'D. Russano vs K. Yasenchak', file: 'temp/trips league/week 3/russano v yasenchak.rtf' },
  { week: 3, name: 'N. Kull vs neon nightmares', file: 'temp/trips league/week 3/nkull v neon nightmares.rtf' },
  { week: 3, name: 'M. Pagel vs N. Mezlak', file: 'temp/trips league/week 3/mpagel v nmezlak.rtf' }
];

function validateMatch(match) {
  try {
    const parsed = parseRTFMatch(match.file);
    const games = parsed.games || [];
    
    const results = {
      totalGames: games.length,
      validGames: 0,
      invalidGames: 0,
      issues: []
    };
    
    games.forEach((game, idx) => {
      const gameNum = idx + 1;
      if (!game.legs || game.legs.length === 0) {
        results.invalidGames++;
        results.issues.push(`Game ${gameNum}: No legs found`);
        return;
      }
      
      let homeWins = 0;
      let awayWins = 0;
      
      game.legs.forEach(leg => {
        if (leg.winner === 'home') homeWins++;
        else if (leg.winner === 'away') awayWins++;
        else if (leg.winner === undefined) {
          results.issues.push(`Game ${gameNum}: Leg ${leg.leg_number || '?'} has undefined winner`);
        }
      });
      
      const isValid = (homeWins === 2 && (awayWins === 0 || awayWins === 1)) ||
                     (awayWins === 2 && (homeWins === 0 || homeWins === 1));
      
      if (isValid) {
        results.validGames++;
      } else {
        results.invalidGames++;
        results.issues.push(`Game ${gameNum}: Invalid score ${homeWins}-${awayWins} (${game.legs.length} legs)`);
      }
    });
    
    return results;
  } catch (error) {
    return {
      totalGames: 0,
      validGames: 0,
      invalidGames: 0,
      issues: [`PARSE ERROR: ${error.message}`]
    };
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('VALIDATION: ALL 15 MATCHES');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalValid = 0;
let totalInvalid = 0;
let matchesWithIssues = 0;

MATCHES.forEach((match, idx) => {
  const results = validateMatch(match);
  const status = results.invalidGames === 0 ? '✅' : '❌';
  
  console.log(`${idx + 1}. ${status} Week ${match.week}: ${match.name}`);
  console.log(`   Games: ${results.validGames}/${results.totalGames} valid`);
  
  if (results.issues.length > 0) {
    matchesWithIssues++;
    results.issues.forEach(issue => {
      console.log(`   ⚠️  ${issue}`);
    });
  }
  
  totalValid += results.validGames;
  totalInvalid += results.invalidGames;
  console.log('');
});

console.log('═══════════════════════════════════════════════════════════════');
console.log(`SUMMARY: ${totalValid} valid games, ${totalInvalid} invalid games`);
console.log(`Matches with issues: ${matchesWithIssues}/15`);
console.log('═══════════════════════════════════════════════════════════════');

if (totalInvalid === 0) {
  console.log('\n✅ ALL MATCHES PARSE CORRECTLY!');
  process.exit(0);
} else {
  console.log(`\n❌ ${totalInvalid} games still have parsing issues.`);
  process.exit(1);
}
