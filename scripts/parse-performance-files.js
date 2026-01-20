/**
 * Parse DartConnect Performance RTF files
 * Extracts player stats directly from the performance summary lines
 */

const fs = require('fs');
const path = require('path');

// Player name to ID mapping
const playerNameToId = {
    'Matt Pagel': 'maH2vUZbuVLBbBQwoIqW',
    'Joe Peters': 'pERxbhcN3VNAvu6wFN9o',
    'John Linden': '06IoctkB8mTTSPBGRbu5',
    'Donnie Pagel': 'X2DMb9bP4Q8fy9yr5Fam',
    'Matthew Wentz': 'TJ3uwMdslbtpjtq17xW4',
    'Jennifer Malek': '7Hj4KWNpm0GviTYbwfbM',
    'Jenn M': '7Hj4KWNpm0GviTYbwfbM',
    'Christian Ketchem': '0Puu4ha5L5GjrCcQqhKa',
    'Kevin Yasenchak': 'dr4ML1i9ZeMI7SNisX6E',
    'Kevin Y': 'dr4ML1i9ZeMI7SNisX6E',
    'Brian Smith': 'bIv2rga3jBSvzsQ2khne',
    'Cesar Andino': 'Dag2lYDtqoo4kc3cRHHa',
    'Cesar A': 'Dag2lYDtqoo4kc3cRHHa',
    'Eddie Olschansky': 'wLMJoz1GylfVCMM32nWm',
    'Eddie Olschanskey': 'wLMJoz1GylfVCMM32nWm',
    'Jeff Boss': 'Tj1LsOtRiJwHW4r4sgWa',
    'Michael Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzales': 'FfODZtkFiGUEzptzD8tH',
    'Nathan Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Nate Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Michael Jarvis': '7GH1SWRR3dAyAVxgMqvf',
    'Stephanie Kull': '4sly23nOXhC475q95R4L',
    'Steph Kull': '4sly23nOXhC475q95R4L',
    'Tony Massimiani': 'gqhzEQLifL402lQwDMpH',
    'Chris Benco': 'rZ57ofUYFXPSrrhyBVkz',
    'Dominick Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Dom Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Nick Mezlak': 'yGcBLDcTwgHtWmZEg3TG',
    'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
    'Cory J': '8f52A1dwRB4eIU5UyQZo',
    'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
    'Dillon U': 'dFmalrT5BMdaTOUUVTOZ',
    'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
    'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
    'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
    'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
    'Chris R': 'NJgDQ0d4RzpDVuCnqYZO',
    'Eric Duale': 'NCeaIaMXsXVN135pX91L',
    'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
    'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
    'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
    'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
    'Derek Fess': 'vVR4AOITXYzhR2H4GqzI'
};

// Parse a performance file and extract player stats
function parsePerformanceFile(content) {
    const players = {};

    // Pattern: Name\tab\tab Games\tab Wins\tab Win%\tab\tab 501_pts\tab 501_darts\tab 3DA\tab\tab cricket_marks\tab cricket_darts\tab MPR
    // The RTF uses literal \tab for tabs
    const regex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)?)\\tab\\tab\s*(\d+)\\tab\s*(\d+)\\tab\s*(\d+)%\\tab\\tab\s*([\d,]+)\\tab\s*(\d+)\\tab\s*([\d.]+)\\tab\\tab\s*([\d,]*)\\tab\s*(\d*)\\tab\s*([\d.]*)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1].trim();

        // Skip non-player entries
        if (name === 'Home' || name === 'Away' || name.includes('Games')) continue;

        const games = parseInt(match[2]) || 0;
        const wins = parseInt(match[3]) || 0;
        const x01Points = parseInt(match[5].replace(/,/g, '')) || 0;
        const x01Darts = parseInt(match[6]) || 0;
        const cricketMarks = parseInt((match[8] || '0').replace(/,/g, '')) || 0;
        const cricketDarts = parseInt(match[9] || '0') || 0;

        // Calculate cricket rounds (3 darts per round)
        const cricketRounds = Math.floor(cricketDarts / 3);

        if (!players[name]) {
            players[name] = {
                games_played: 0,
                games_won: 0,
                x01_total_points: 0,
                x01_total_darts: 0,
                cricket_total_marks: 0,
                cricket_total_darts: 0,
                cricket_total_rounds: 0
            };
        }

        players[name].games_played += games;
        players[name].games_won += wins;
        players[name].x01_total_points += x01Points;
        players[name].x01_total_darts += x01Darts;
        players[name].cricket_total_marks += cricketMarks;
        players[name].cricket_total_darts += cricketDarts;
        players[name].cricket_total_rounds += cricketRounds;
    }

    return players;
}

// Main
const baseDir = path.join(__dirname, '../temp/trips league');
const performanceFiles = fs.readdirSync(baseDir).filter(f => f.includes('performance') && f.endsWith('.rtf'));

console.log('Processing performance files:', performanceFiles);
console.log('');

const allStats = {};

for (const file of performanceFiles) {
    const filePath = path.join(baseDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const players = parsePerformanceFile(content);

    console.log(`\n=== ${file} ===`);

    for (const [name, stats] of Object.entries(players)) {
        const playerId = playerNameToId[name];

        if (!playerId) {
            console.log(`  WARNING: No ID for "${name}"`);
            continue;
        }

        console.log(`  ${name}: ${stats.games_played} games, ${stats.x01_total_points} pts/${stats.x01_total_darts} darts, ${stats.cricket_total_marks} marks`);

        if (!allStats[playerId]) {
            allStats[playerId] = {
                player_id: playerId,
                player_name: name,
                games_played: 0,
                games_won: 0,
                x01_total_points: 0,
                x01_total_darts: 0,
                cricket_total_marks: 0,
                cricket_total_darts: 0,
                cricket_total_rounds: 0
            };
        }

        allStats[playerId].games_played += stats.games_played;
        allStats[playerId].games_won += stats.games_won;
        allStats[playerId].x01_total_points += stats.x01_total_points;
        allStats[playerId].x01_total_darts += stats.x01_total_darts;
        allStats[playerId].cricket_total_marks += stats.cricket_total_marks;
        allStats[playerId].cricket_total_darts += stats.cricket_total_darts;
        allStats[playerId].cricket_total_rounds += stats.cricket_total_rounds;
    }
}

// Calculate derived stats
console.log('\n\n=== AGGREGATED STATS ===\n');

for (const [playerId, stats] of Object.entries(allStats)) {
    // Calculate 3DA
    if (stats.x01_total_darts > 0) {
        stats.x01_3da = Math.round((stats.x01_total_points / stats.x01_total_darts) * 3 * 100) / 100;
        stats.x01_three_dart_avg = stats.x01_3da;
    }

    // Calculate MPR
    if (stats.cricket_total_rounds > 0) {
        stats.cricket_mpr = Math.round((stats.cricket_total_marks / stats.cricket_total_rounds) * 100) / 100;
    }

    console.log(`${stats.player_name}: 501 ${stats.x01_3da || 0} (${stats.x01_total_points} pts / ${stats.x01_total_darts} darts), Cricket ${stats.cricket_mpr || 0} MPR`);
}

// Save to file
const outputPath = path.join(__dirname, 'performance-stats.json');
fs.writeFileSync(outputPath, JSON.stringify(allStats, null, 2));
console.log(`\nSaved to: ${outputPath}`);
