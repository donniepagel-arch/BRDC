/**
 * Import All Match Stats from DartConnect RTF files
 * Parses all match files in the trips league folder and aggregates stats
 */

const fs = require('fs');
const path = require('path');
const { parseMatch, calculatePlayerStats } = require('../functions/parse-dartconnect.js');

// Player name to ID mapping (from league roster)
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
    'Eddie Olschanskey': 'wLMJoz1GylfVCMM32nWm',  // Alternate spelling
    'Jeff Boss': 'Tj1LsOtRiJwHW4r4sgWa',
    'Michael Gonzalez': 'FfODZtkFiGUEzptzD8tH',
    'Mike Gonzales': 'FfODZtkFiGUEzptzD8tH',  // Alternate spelling
    'Nathan Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Nate Kull': 'bsAlnR7Ii1pWmMvsWzrS',
    'Michael Jarvis': '7GH1SWRR3dAyAVxgMqvf',
    'Stephanie Kull': '4sly23nOXhC475q95R4L',
    'Steph Kull': '4sly23nOXhC475q95R4L',
    'Tony Massimiani': 'gqhzEQLifL402lQwDMpH',
    'Chris Benco': 'rZ57ofUYFXPSrrhyBVkz',
    'Dominick Russano': 'pL9CGc688ZpxbPKJ11cZ',
    'Dom Russano': 'pL9CGc688ZpxbPKJ11cZ',  // Nickname
    'Nick Mezlak': 'yGcBLDcTwgHtWmZEg3TG',
    'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
    'Cory J': '8f52A1dwRB4eIU5UyQZo',  // Abbreviation
    'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
    'Dillon U': 'dFmalrT5BMdaTOUUVTOZ',  // Abbreviation
    'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
    'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
    'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
    'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
    'Chris R': 'NJgDQ0d4RzpDVuCnqYZO',  // Abbreviation
    'Eric Duale': 'NCeaIaMXsXVN135pX91L',
    'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
    'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
    'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
    'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
    'Derek Fess': 'vVR4AOITXYzhR2H4GqzI'
};

// Match files to process
const matchFiles = [
    'yasenchak v kull.rtf',
    'pagel v pagel MATCH.rtf',
    'partlo v olschansky.rtf',
    'mezlak v russano.rtf',
    'massimiani v ragnoni.rtf'
];

const baseDir = path.join(__dirname, '../temp/trips league');

// Aggregate all stats
const allStats = {};

function mergeStats(target, source) {
    // Numeric fields to sum
    const sumFields = [
        'x01_legs_played', 'x01_legs_won', 'x01_total_darts', 'x01_total_points',
        'x01_first9_darts', 'x01_first9_points',
        'x01_tons', 'x01_ton_40', 'x01_ton_80',
        'x01_checkouts_hit', 'x01_checkout_totals',
        'cricket_legs_played', 'cricket_legs_won',
        'cricket_total_darts', 'cricket_total_marks', 'cricket_total_rounds'
    ];

    // Max fields
    const maxFields = ['x01_high_turn', 'x01_high_checkout'];

    for (const field of sumFields) {
        target[field] = (target[field] || 0) + (source[field] || 0);
    }

    for (const field of maxFields) {
        target[field] = Math.max(target[field] || 0, source[field] || 0);
    }
}

// Process each match file
console.log('Processing match files...\n');

for (const file of matchFiles) {
    const filePath = path.join(baseDir, file);

    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${file} (not found)`);
        continue;
    }

    console.log(`  Processing: ${file}`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = parseMatch(content);
        const stats = calculatePlayerStats(match);

        console.log(`    Found ${Object.keys(stats).length} players, ${match.legs.length} legs`);

        // Merge stats into aggregate
        for (const [playerName, playerStats] of Object.entries(stats)) {
            const playerId = playerNameToId[playerName];

            if (!playerId) {
                console.log(`    WARNING: No ID for player "${playerName}"`);
                continue;
            }

            if (!allStats[playerId]) {
                allStats[playerId] = {
                    player_id: playerId,
                    player_name: playerName,
                    x01_legs_played: 0,
                    x01_legs_won: 0,
                    x01_total_darts: 0,
                    x01_total_points: 0,
                    x01_first9_darts: 0,
                    x01_first9_points: 0,
                    x01_tons: 0,
                    x01_ton_40: 0,
                    x01_ton_80: 0,
                    x01_high_turn: 0,
                    x01_high_checkout: 0,
                    x01_checkouts_hit: 0,
                    x01_checkout_totals: 0,
                    cricket_legs_played: 0,
                    cricket_legs_won: 0,
                    cricket_total_darts: 0,
                    cricket_total_marks: 0,
                    cricket_total_rounds: 0
                };
            }

            mergeStats(allStats[playerId], playerStats);
        }
    } catch (err) {
        console.log(`    ERROR: ${err.message}`);
    }
}

// Calculate derived stats
console.log('\nCalculating derived stats...\n');

for (const [playerId, stats] of Object.entries(allStats)) {
    // X01 averages
    if (stats.x01_total_darts > 0) {
        stats.x01_3da = Math.round((stats.x01_total_points / stats.x01_total_darts) * 3 * 100) / 100;
        stats.x01_three_dart_avg = stats.x01_3da;
    }
    if (stats.x01_first9_darts > 0) {
        stats.x01_first9_avg = Math.round((stats.x01_first9_points / stats.x01_first9_darts) * 3 * 100) / 100;
    }
    if (stats.x01_checkouts_hit > 0) {
        stats.x01_avg_finish = Math.round((stats.x01_checkout_totals / stats.x01_checkouts_hit) * 100) / 100;
    }

    // Ton totals for leaderboard compatibility
    stats.x01_tons_100 = stats.x01_tons;
    stats.x01_tons_140 = stats.x01_ton_40;
    stats.x01_tons_180 = stats.x01_ton_80;
    stats.x01_ton_forties = stats.x01_ton_40 + stats.x01_ton_80;
    stats.x01_ton_eighties = stats.x01_ton_80;

    // Cricket MPR
    if (stats.cricket_total_rounds > 0) {
        stats.cricket_mpr = Math.round((stats.cricket_total_marks / stats.cricket_total_rounds) * 100) / 100;
    }

    console.log(`${stats.player_name}: 501 ${stats.x01_3da || 0} (F9: ${stats.x01_first9_avg || 0}), Cricket ${stats.cricket_mpr || 0} MPR`);
}

// Output JSON
console.log('\n=== JSON Output for Import ===\n');
console.log(JSON.stringify(allStats, null, 2));

// Save to file
const outputPath = path.join(__dirname, 'aggregated-stats.json');
fs.writeFileSync(outputPath, JSON.stringify(allStats, null, 2));
console.log(`\nSaved to: ${outputPath}`);
