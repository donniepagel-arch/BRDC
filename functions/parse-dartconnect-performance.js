/**
 * DartConnect Performance Report Parser
 * Parses the "Player Performance" report format from DartConnect
 * This is more reliable than parsing turn-by-turn data
 */

const fs = require('fs');

// Parse RTF content and strip formatting
function stripRtf(rtfContent) {
    let text = rtfContent;
    text = text.replace(/\\par\b\s*/g, '\n');
    text = text.replace(/\\tab\b\s*/g, '\t');
    text = text.replace(/\\line\b\s*/g, '\n');
    text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
    text = text.replace(/\{\\colortbl[^}]*\}/g, '');
    text = text.replace(/\{\\\*\\[^}]*\}/g, '');
    text = text.replace(/\\[a-z]+\d*\s?/gi, '');
    text = text.replace(/[{}]/g, '');
    text = text.replace(/\r\n/g, '\n');
    return text.trim();
}

// Known player names
const knownPlayers = new Set([
    'Matt Pagel', 'Joe Peters', 'John Linden',
    'Donnie Pagel', 'Matthew Wentz', 'Jennifer Malek', 'Jenn M',
    'Christian Ketchem', 'Kevin Yasenchak', 'Brian Smith', 'Cesar Andino',
    'Eddie Olschansky', 'Jeff Boss', 'Michael Gonzalez',
    'Nathan Kull', 'Michael Jarvis', 'Stephanie Kull',
    'Tony Massimiani', 'Chris Benco', 'Dominick Russano',
    'Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses',
    'Dan Partlo', 'Joe Donley', 'Kevin Mckelvey',
    'Danny Russano', 'Chris Russano', 'Eric Duale',
    'John Ragnoni', 'Marc Tate', 'David Brunner'
]);

function isPlayerName(str) {
    if (!str) return false;
    str = str.trim();
    if (knownPlayers.has(str)) return true;
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(str)) return true;
    if (/^[A-Z][a-z]+\s+[A-Z]$/.test(str)) return true;
    return false;
}

/**
 * Parse the performance report format
 * Uses the summary table which has all the totals we need
 *
 * Summary table format (tab-separated):
 * Player Name | [empty] | Games | Wins | Win% | [empty] | 501_Points | 501_Darts | 501_3DA | [empty] | Cricket_Marks | Cricket_Darts | Cricket_MPR
 */
function parsePerformanceReport(rtfContent) {
    const text = stripRtf(rtfContent);
    const lines = text.split('\n');

    const match = {
        date: null,
        totalGames: 0,
        totalDarts: 0,
        playerStats: {}
    };

    // Extract date
    const dateMatch = text.match(/Date:\s*([^\t\n]+)/);
    if (dateMatch) match.date = dateMatch[1].trim();

    // Extract total games
    const gamesMatch = text.match(/Games:\s*(\d+)/);
    if (gamesMatch) match.totalGames = parseInt(gamesMatch[1]);

    // Extract total darts
    const dartsMatch = text.match(/Darts:\s*([\d,]+)/);
    if (dartsMatch) match.totalDarts = parseInt(dartsMatch[1].replace(/,/g, ''));

    // Find the player summary table
    // It comes after "Players" header line and has format:
    // Games | Wins | Win % | [empty] | Points | Darts | 3DA | [empty] | Marks | Darts | MPR
    let inPlayerSection = false;

    for (const line of lines) {
        // Look for the header line that indicates player section
        if (line.includes('Players') && line.includes('Match') && line.includes("All '01 Games")) {
            inPlayerSection = true;
            continue;
        }

        // Skip the column headers line
        if (inPlayerSection && line.includes('Games') && line.includes('Wins') && line.includes('Win %')) {
            continue;
        }

        // Parse player data lines
        if (inPlayerSection) {
            // Split by tabs, keeping empty strings
            const rawParts = line.split('\t');

            // Check if first part is a player name
            const firstName = rawParts[0]?.trim();
            if (!firstName || !isPlayerName(firstName)) {
                // End of player section
                if (firstName && !firstName.match(/^\s*$/) && Object.keys(match.playerStats).length > 0) {
                    inPlayerSection = false;
                }
                continue;
            }

            // Parse the tab-separated values
            // Format: Name | [empty] | Games | Wins | Win% | [empty] | Points | Darts | 3DA | [empty] | Marks | Darts | MPR
            const parts = rawParts.map(p => p.trim());

            // Extract values by finding numeric patterns
            const numbers = [];
            const decimals = [];

            for (let i = 1; i < parts.length; i++) {
                const val = parts[i];
                if (!val) continue;

                // Skip percentages
                if (val.includes('%')) continue;

                // Check for decimal (3DA, MPR)
                if (val.includes('.')) {
                    decimals.push(parseFloat(val));
                }
                // Check for integer (with possible comma)
                else if (/^[\d,]+$/.test(val)) {
                    numbers.push(parseInt(val.replace(/,/g, '')));
                }
            }

            // Expected order: Games, Wins, 501_Points, 501_Darts, Cricket_Marks, Cricket_Darts
            // Decimals: 501_3DA, Cricket_MPR
            if (numbers.length >= 6 && decimals.length >= 2) {
                const playerName = firstName;

                match.playerStats[playerName] = {
                    name: playerName,
                    total_games: numbers[0],
                    total_wins: numbers[1],
                    win_percent: Math.round((numbers[1] / numbers[0]) * 100),

                    // 501 stats
                    x01_total_points: numbers[2],
                    x01_total_darts: numbers[3],
                    x01_average: decimals[0],
                    x01_legs_played: 0,  // Will calculate from games
                    x01_legs_won: 0,
                    x01_tons: 0,
                    x01_ton_40: 0,
                    x01_ton_80: 0,
                    x01_high_checkout: 0,
                    x01_checkouts_hit: 0,

                    // Cricket stats
                    cricket_total_marks: numbers[4],
                    cricket_total_darts: numbers[5],
                    cricket_mpr: decimals[1],
                    cricket_legs_played: 0,
                    cricket_legs_won: 0
                };

                // Calculate legs from darts (501 avg ~15-30 darts per leg)
                // We can estimate legs played from darts / average_darts_per_leg
                // But actually the games count in the table IS total legs/games
                // For doubles, both teammates get credited for the same games

                // Estimate 501 vs cricket split based on darts ratio
                const total501Darts = numbers[3];
                const totalCricketDarts = numbers[5];
                const dartRatio = total501Darts / (total501Darts + totalCricketDarts);

                // Total games is sum of 501 + cricket games played
                // We don't have individual game counts, but we can estimate
                const s = match.playerStats[playerName];
                s.x01_legs_played = Math.round(s.total_games * dartRatio);
                s.cricket_legs_played = s.total_games - s.x01_legs_played;

                // Estimate wins proportionally
                s.x01_legs_won = Math.round(s.total_wins * dartRatio);
                s.cricket_legs_won = s.total_wins - s.x01_legs_won;
            }
        }
    }

    return match;
}

/**
 * Parse a player line from the per-game breakdown
 * Returns: { name, darts, points, marks, won, started, checkout, tons, etc }
 */
function parsePlayerLine(parts, format) {
    if (!parts || parts.length < 2) return null;

    // First element is player name (or 'S' flag + name)
    let name = parts[0];
    let started = false;
    let idx = 1;

    if (parts[0] === 'S') {
        started = true;
        name = parts[1];
        idx = 2;
    } else if (isPlayerName(parts[0])) {
        name = parts[0];
        idx = 1;
        // Check if next is 'S'
        if (parts[idx] === 'S') {
            started = true;
            idx++;
        }
    } else {
        return null;
    }

    if (!isPlayerName(name)) return null;

    const playerData = {
        name: name,
        started: started,
        won: false,
        darts: 0,
        points: 0,
        marks: 0,
        checkout: 0,
        highTurn: 0
    };

    // Look through remaining parts for key data
    // Format varies, but we need: DT (darts), PTS (points), MKS (marks)
    // W = won, CO value = checkout

    for (let i = idx; i < parts.length; i++) {
        const val = parts[i];

        // Check for win marker
        if (val === 'W') {
            playerData.won = true;
            continue;
        }

        // Skip percentage values
        if (val.includes('%')) continue;

        // Skip MPR/3DA values (have decimal)
        if (val.includes('.') && parseFloat(val) < 100) continue;

        // Look for marks (ends with M)
        if (val.endsWith('M')) {
            const marksMatch = val.match(/(\d+)M/);
            if (marksMatch) {
                playerData.marks = parseInt(marksMatch[1]);
            }
            continue;
        }
    }

    // Extract numeric values - look for the pattern near end
    // Typical pattern: ... | DT | PTS | MKS |
    // For 501: numbers like 12 (darts), 200 (points)
    // For cricket: numbers like 24 (darts), then marks (already captured)

    const numbers = [];
    for (let i = idx; i < parts.length; i++) {
        const val = parts[i];
        if (/^\d+$/.test(val) && parseInt(val) < 1000) {
            numbers.push(parseInt(val));
        }
    }

    // For 501: typically see [round, checkout?, remaining, darts, points]
    // The DT and PTS are usually the last two significant numbers before any marks
    if (format === '501') {
        // Look for the darts-points pair
        // DT is typically between 9-40, PTS between 100-501
        for (let i = 0; i < numbers.length - 1; i++) {
            const dt = numbers[i];
            const pts = numbers[i + 1];
            if (dt >= 9 && dt <= 60 && pts >= 50 && pts <= 501) {
                playerData.darts = dt;
                playerData.points = pts;
                break;
            }
        }

        // Look for checkout value (CO column - usually 2-digit number after W)
        for (let i = idx; i < parts.length; i++) {
            if (parts[i] === 'W' && i + 2 < parts.length) {
                // Next is round, then checkout
                const checkoutIdx = i + 2;
                if (checkoutIdx < parts.length && /^\d+$/.test(parts[checkoutIdx])) {
                    const co = parseInt(parts[checkoutIdx]);
                    if (co >= 2 && co <= 170) {
                        playerData.checkout = co;
                    }
                }
            }
        }
    } else {
        // Cricket - darts is typically between 18-50
        for (const num of numbers) {
            if (num >= 15 && num <= 60) {
                playerData.darts = num;
                break;
            }
        }
    }

    return playerData;
}

/**
 * Add player game data to cumulative stats
 */
function addToPlayerStats(stats, playerData, format, game) {
    const name = playerData.name;

    if (!stats[name]) {
        stats[name] = {
            name: name,
            x01_legs_played: 0,
            x01_legs_won: 0,
            x01_total_darts: 0,
            x01_total_points: 0,
            x01_tons: 0,
            x01_ton_40: 0,
            x01_ton_80: 0,
            x01_high_checkout: 0,
            x01_checkouts_hit: 0,
            x01_average: 0,
            cricket_legs_played: 0,
            cricket_legs_won: 0,
            cricket_total_darts: 0,
            cricket_total_marks: 0,
            cricket_mpr: 0,
            total_games: 0,
            total_wins: 0
        };
    }

    const s = stats[name];

    if (format === '501') {
        s.x01_legs_played++;
        if (playerData.won) s.x01_legs_won++;
        s.x01_total_darts += playerData.darts;
        s.x01_total_points += playerData.points;

        if (playerData.checkout > 0) {
            s.x01_checkouts_hit++;
            if (playerData.checkout > s.x01_high_checkout) {
                s.x01_high_checkout = playerData.checkout;
            }
        }
    } else {
        s.cricket_legs_played++;
        if (playerData.won) s.cricket_legs_won++;
        s.cricket_total_darts += playerData.darts;
        s.cricket_total_marks += playerData.marks;
    }
}

// Main execution
if (require.main === module) {
    const filePath = process.argv[2] || '../temp/trips league/pagel v pagel performance.rtf';

    console.log('Reading performance report:', filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    console.log('\n=== Parsing Performance Report ===\n');
    const match = parsePerformanceReport(content);

    console.log('Date:', match.date);
    console.log('Total Games:', match.totalGames);
    console.log('Total Darts:', match.totalDarts);
    console.log('Players Found:', Object.keys(match.playerStats).length);

    console.log('\n=== DartConnect Official Stats (to match) ===');
    console.log('Joe Peters:        11 games, 8 wins, 55.83 3DA, 2.2 MPR');
    console.log('Matt Pagel:        10 games, 5 wins, 53.54 3DA, 2.7 MPR');
    console.log('Christian Ketchem: 11 games, 3 wins, 49.85 3DA, 1.4 MPR');
    console.log('Donnie Pagel:      10 games, 5 wins, 49.36 3DA, 2.4 MPR');
    console.log('John Linden:       11 games, 7 wins, 46.93 3DA, 1.8 MPR');
    console.log('Jenn M:            11 games, 4 wins, 45.57 3DA, 1.9 MPR');

    console.log('\n=== Calculated Player Stats ===\n');

    for (const player in match.playerStats) {
        const s = match.playerStats[player];
        console.log(`\n${player}:`);
        console.log(`  Games: ${s.total_games} (${s.total_wins} wins)`);
        if (s.x01_legs_played > 0) {
            console.log(`  501: ${s.x01_legs_won}/${s.x01_legs_played} legs, ${s.x01_average} avg`);
            console.log(`       ${s.x01_total_darts} darts, ${s.x01_total_points} pts`);
            if (s.x01_high_checkout > 0) {
                console.log(`       High CO: ${s.x01_high_checkout}`);
            }
        }
        if (s.cricket_legs_played > 0) {
            console.log(`  Cricket: ${s.cricket_legs_won}/${s.cricket_legs_played} legs, ${s.cricket_mpr} MPR`);
            console.log(`          ${s.cricket_total_darts} darts, ${s.cricket_total_marks} marks`);
        }
    }
}

module.exports = { parsePerformanceReport, stripRtf };
