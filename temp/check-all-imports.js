const {parseRTFMatch} = require('./parse-rtf.js');
const path = require('path');
const fs = require('fs');

// Map match IDs to RTF files
const MATCHES_TO_CHECK = [
    // Week 1
    { id: 'sgmoL4GyVUYP67aOS7wm', file: 'trips league/pagel v pagel MATCH.rtf', name: 'Pagel v Pagel' },
    { id: 'JqiWABEBS7Bqk8n7pKxD', file: 'trips league/yasenchak v kull.rtf', name: 'Yasenchak v Kull' },
    { id: '0lxEeuAa7fEDSVeY3uCG', file: 'trips league/partlo v olschansky.rtf', name: 'Partlo v Olschansky' },
    { id: 'nYv1XeGTWbaxBepI6F5u', file: 'trips league/mezlak v russano.rtf', name: 'Mezlak v Russano' },
    { id: 'OTYlCe3NNbinKlpZccwS', file: 'trips league/massimiani v ragnoni.rtf', name: 'Massimiani v Ragnoni' },
    // Week 2
    { id: 'ixNMXr2jT5f7hDD6qFDj', file: 'trips league/week 2/dpartlo v mpagel.rtf', name: 'Partlo v M.Pagel' },
    { id: 'YFpeyQPYEQQjMLEu1eVp', file: 'trips league/week 2/massimiani v yasenchak.rtf', name: 'Massimiani v Yasenchak' },
    { id: 'tcI1eFfOlHaTyhjaCGOj', file: 'trips league/week 2/mezlak V e.o.rtf', name: 'Mezlak v E.O' },
    { id: 'Iychqt7Wto8S9m7proeH', file: 'trips league/week 2/pagel v kull.rtf', name: 'D.Pagel v Kull' },
    { id: '9unWmN7TmQgNEhFlhpuB', file: 'trips league/week 2/russano v ragnoni.rtf', name: 'Russano v Ragnoni' }
];

console.log('=== CHECKING ALL WEEK 1 & 2 IMPORTS FOR PARSING ISSUES ===\n');

const issues = [];

for (const match of MATCHES_TO_CHECK) {
    const filePath = path.join(__dirname, match.file);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${match.name}: RTF file not found at ${filePath}`);
        continue;
    }

    console.log(`\n--- ${match.name} (${match.id}) ---`);

    try {
        const games = parseRTFMatch(match.file);
        console.log(`Parsed ${games.length} games`);

        // Check each game
        games.forEach((game, gIdx) => {
            const playerCount = new Set();

            game.legs.forEach((leg, lIdx) => {
                if (!leg.type.includes('501')) return; // Only checking 501 for now

                // Count unique players
                Object.keys(leg.player_stats || {}).forEach(p => playerCount.add(p));

                // Check for suspicious round numbers
                const rounds = leg.throws.map(t => t.round);
                const maxRound = Math.max(...rounds);
                const minRound = Math.min(...rounds);
                const uniquePlayers = Object.keys(leg.player_stats || {}).length;

                // In singles (2 players), max round should be reasonable (< 30 typically)
                // In doubles (4 players), rounds alternate so numbers can be higher
                if (uniquePlayers <= 2 && maxRound > 30) {
                    const issue = `  ⚠️ Game ${gIdx + 1} Leg ${lIdx + 1}: ${uniquePlayers} players but round goes up to ${maxRound}`;
                    console.log(issue);
                    issues.push({ match: match.name, issue });
                } else if (uniquePlayers === 4 && maxRound > 50) {
                    const issue = `  ⚠️ Game ${gIdx + 1} Leg ${lIdx + 1}: 4 players (doubles) with round ${maxRound}`;
                    console.log(issue);
                    issues.push({ match: match.name, issue });
                }

                // Check if isDoubles flag matches player count
                if (game.isDoubles && uniquePlayers === 2) {
                    const issue = `  ⚠️ Game ${gIdx + 1} Leg ${lIdx + 1}: Marked as doubles but only ${uniquePlayers} players`;
                    console.log(issue);
                    issues.push({ match: match.name, issue });
                } else if (!game.isDoubles && uniquePlayers === 4) {
                    const issue = `  ⚠️ Game ${gIdx + 1} Leg ${lIdx + 1}: ${uniquePlayers} players but NOT marked as doubles`;
                    console.log(issue);
                    issues.push({ match: match.name, issue });
                }
            });
        });

        if (issues.filter(i => i.match === match.name).length === 0) {
            console.log('  ✅ No issues detected');
        }

    } catch (error) {
        console.log(`  ❌ Error parsing: ${error.message}`);
        issues.push({ match: match.name, issue: `Parse error: ${error.message}` });
    }
}

console.log('\n\n=== SUMMARY ===');
if (issues.length === 0) {
    console.log('✅ All matches parsed correctly with no issues detected');
} else {
    console.log(`❌ Found ${issues.length} issues:\n`);
    issues.forEach(i => {
        console.log(`${i.match}:`);
        console.log(`  ${i.issue}`);
    });
}
