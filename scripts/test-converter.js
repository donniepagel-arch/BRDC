const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');

// Copy the convertToFirestoreFormat function from import script
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

// Test conversion
const rtfPath = path.join(__dirname, '..', 'temp/trips league/week 1/pagel v pagel MATCH.rtf');
const { games: parsedGames, metadata } = parseRTFMatch(rtfPath);

console.log('=== PARSED DATA ===');
console.log('Games:', parsedGames.length);
console.log('Metadata keys:', Object.keys(metadata));
console.log('Has match_date:', !!metadata.match_date);
console.log('Has start_time:', !!metadata.start_time);
console.log('Has end_time:', !!metadata.end_time);
console.log('Has game_time_minutes:', !!metadata.game_time_minutes);
console.log('Has match_length_minutes:', !!metadata.match_length_minutes);

console.log('');
console.log('=== SAMPLE GAME STRUCTURE ===');
const firstGame = parsedGames[0];
console.log('First game keys:', Object.keys(firstGame));
console.log('Has "set" field:', firstGame.set !== undefined);
console.log('Set value:', firstGame.set);
console.log('GameNumber value:', firstGame.gameNumber);
console.log('Number of legs:', firstGame.legs.length);

console.log('');
console.log('=== TIMING VALUES ===');
console.log('Match date:', metadata.match_date);
console.log('Start time:', metadata.start_time);
console.log('End time:', metadata.end_time);
console.log('Game time (min):', metadata.game_time_minutes);
console.log('Match length (min):', metadata.match_length_minutes);
