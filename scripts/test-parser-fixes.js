const { parseRTFMatch } = require('../temp/parse-rtf.js');

const rtfPath = 'trips league/week 1/pagel v pagel MATCH.rtf';
const { games, metadata } = parseRTFMatch(`../temp/${rtfPath}`);

console.log('=== METADATA ===');
console.log('Date:', metadata.match_date);
console.log('Start:', metadata.start_time);
console.log('End:', metadata.end_time);
console.log('Game Time (min):', metadata.game_time_minutes);
console.log('Match Length (min):', metadata.match_length_minutes);
console.log('');

console.log('=== GAMES ===');
console.log('Total games parsed:', games.length);
const sets = new Set(games.map(g => g.set || g.gameNumber));
console.log('Unique sets:', sets.size);
console.log('Set numbers:', Array.from(sets).sort((a, b) => a - b));
console.log('');

console.log('First 3 games:');
games.slice(0, 3).forEach(g => {
    console.log(`  Set ${g.set || g.gameNumber}: ${g.legs.length} legs, type: ${g.type}`);
});

console.log('');
console.log('=== VERIFICATION ===');
if (metadata.match_date && metadata.start_time && metadata.end_time) {
    console.log('✓ Timing data extracted successfully');
} else {
    console.log('✗ Timing data missing');
}

if (sets.size === 9) {
    console.log('✓ Correct number of sets (9)');
} else {
    console.log(`✗ Wrong number of sets: ${sets.size} (expected 9)`);
}

const hasSetsField = games.every(g => g.set !== undefined);
if (hasSetsField) {
    console.log('✓ All games have "set" field');
} else {
    console.log('✗ Some games missing "set" field');
}
