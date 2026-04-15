const { parseRTFMatch } = require('../temp/parse-rtf');

// Show how players are assigned to sides in each leg
const testFile = 'temp/trips league/week 1/mezlak v russano.rtf';

console.log('=== PARSER SIDE ASSIGNMENT ANALYSIS ===\n');
console.log(`File: ${testFile}\n`);

try {
    const parsed = parseRTFMatch(testFile);
    const parsedGames = parsed.games || [];
    
    parsedGames.forEach((game, idx) => {
        console.log(`Game ${idx + 1} (${game.type}):`);
        
        game.legs.forEach((leg, legIdx) => {
            console.log(`  Leg ${legIdx + 1}:`);
            
            const homePlayers = [];
            const awayPlayers = [];
            
            for (const [player, stats] of Object.entries(leg.player_stats || {})) {
                if (stats.side === 'home') {
                    homePlayers.push(player);
                } else if (stats.side === 'away') {
                    awayPlayers.push(player);
                }
            }
            
            console.log(`    Home: ${homePlayers.join(', ') || 'none'}`);
            console.log(`    Away: ${awayPlayers.join(', ') || 'none'}`);
            console.log(`    Winner: ${leg.winner}`);
        });
        
        console.log('');
    });
    
} catch (error) {
    console.error('Error:', error);
    process.exit(1);
}
