/**
 * Test import for a single match to verify fixes before running full import
 */
const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');

// Copy necessary functions from import script
const TEAM_ROSTERS = {
    'M. Pagel': ['Matt Pagel', 'Joe Peters', 'John Linden'],
    'D. Pagel': ['Donnie Pagel', 'Christian Ketchem', 'Jenn M', 'Jennifer Malek']
};

function getTeamForPlayer(playerName, homeTeam, awayTeam) {
    const name = playerName.trim().toLowerCase();
    const homeRoster = TEAM_ROSTERS[homeTeam] || [];
    const awayRoster = TEAM_ROSTERS[awayTeam] || [];

    for (const p of homeRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'home';
    }
    for (const p of awayRoster) {
        if (name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)) return 'away';
    }
    return null;
}

// Test match
const match = {
    name: 'Pagel v Pagel (Week 1)',
    matchId: 'sgmoL4GyVUYP67aOS7wm',
    rtfFile: 'temp/trips league/week 1/pagel v pagel MATCH.rtf',
    homeTeam: 'M. Pagel',
    awayTeam: 'D. Pagel'
};

console.log(`\n=== Testing: ${match.name} ===\n`);

const rtfPath = path.join(__dirname, '..', match.rtfFile);
const { games: parsedGames, metadata } = parseRTFMatch(rtfPath);

console.log('✓ Parsed successfully');
console.log(`  Games: ${parsedGames.length}`);
console.log(`  Total legs: ${parsedGames.reduce((sum, g) => sum + g.legs.length, 0)}`);
console.log('');

console.log('=== TIMING METADATA ===');
console.log(`  Match date: ${metadata.match_date}`);
console.log(`  Start time: ${metadata.start_time}`);
console.log(`  End time: ${metadata.end_time}`);
console.log(`  Game time: ${metadata.game_time_minutes} minutes`);
console.log(`  Match length: ${metadata.match_length_minutes} minutes`);
console.log('');

console.log('=== SET STRUCTURE ===');
const sets = new Set(parsedGames.map(g => g.set));
console.log(`  Unique sets: ${sets.size}`);
console.log(`  Set numbers: ${Array.from(sets).sort((a, b) => a - b).join(', ')}`);
console.log('');

console.log('=== GAME DETAILS ===');
parsedGames.forEach((game, idx) => {
    console.log(`  Set ${game.set}: ${game.legs.length} legs (${game.type})`);
    game.legs.forEach(leg => {
        const players = Object.keys(leg.player_stats || {});
        const homePlayers = players.filter(p => getTeamForPlayer(p, match.homeTeam, match.awayTeam) === 'home');
        const awayPlayers = players.filter(p => getTeamForPlayer(p, match.homeTeam, match.awayTeam) === 'away');
        console.log(`    Leg ${leg.legNumber}: ${homePlayers.join('/')} vs ${awayPlayers.join('/')}`);
        if (leg.checkout_darts) {
            console.log(`      ✓ Checkout darts: ${leg.checkout_darts}`);
        }
    });
});

console.log('');
console.log('=== VERIFICATION ===');
let allGood = true;

if (sets.size !== 9) {
    console.log(`✗ Wrong number of sets: ${sets.size} (expected 9)`);
    allGood = false;
} else {
    console.log('✓ Correct number of sets (9)');
}

if (!metadata.match_date || !metadata.start_time || !metadata.end_time) {
    console.log('✗ Missing timing metadata');
    allGood = false;
} else {
    console.log('✓ Timing metadata present');
}

const allHaveSet = parsedGames.every(g => g.set !== undefined);
if (!allHaveSet) {
    console.log('✗ Some games missing "set" field');
    allGood = false;
} else {
    console.log('✓ All games have "set" field');
}

const has501Checkouts = parsedGames.some(g =>
    g.legs.some(leg => leg.type.includes('501') && leg.checkout_darts)
);
if (!has501Checkouts) {
    console.log('⚠ No 501 legs with checkout_darts found (might be OK if all cricket)');
} else {
    console.log('✓ Found 501 legs with checkout_darts');
}

console.log('');
if (allGood) {
    console.log('✓✓✓ ALL CHECKS PASSED - Ready to import! ✓✓✓');
} else {
    console.log('✗✗✗ ISSUES FOUND - Fix before importing ✗✗✗');
}
