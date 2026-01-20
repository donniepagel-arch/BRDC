/**
 * DartConnect Match Parser v2
 * Parses RTF exports from DartConnect and extracts player stats
 */

const fs = require('fs');

// Parse RTF content and strip formatting
function stripRtf(rtfContent) {
    let text = rtfContent;

    // Replace RTF escape sequences
    text = text.replace(/\\par\b\s*/g, '\n');
    text = text.replace(/\\tab\b\s*/g, '\t');
    text = text.replace(/\\line\b\s*/g, '\n');

    // Remove font and formatting commands
    text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
    text = text.replace(/\{\\colortbl[^}]*\}/g, '');
    text = text.replace(/\{\\\*\\[^}]*\}/g, '');

    // Remove other RTF commands
    text = text.replace(/\\[a-z]+\d*\s?/gi, '');

    // Remove braces
    text = text.replace(/[{}]/g, '');

    // Handle unicode
    text = text.replace(/\u8709/g, '∅');
    text = text.replace(/u8709\?/g, '∅');
    text = text.replace(/\?/g, '∅');  // Remaining ? are probably empty marks

    // Clean up
    text = text.replace(/\r\n/g, '\n');

    return text.trim();
}

// Known player names (will be populated as we parse)
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

// Check if a string is a player name
function isPlayerName(str) {
    if (!str) return false;
    str = str.trim();
    if (knownPlayers.has(str)) return true;
    // Check if it looks like a name (two words, first letter caps)
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(str)) return true;
    if (/^[A-Z][a-z]+\s+[A-Z]$/.test(str)) return true;  // Like "Jenn M"
    return false;
}

// Parse a 501 game from tab-separated data
function parse501Game(gameData, setNum, gameNum, legNum) {
    const game = {
        set: setNum,
        game: gameNum,
        leg: legNum,
        format: '501',
        turns: [],
        leftPlayers: [],
        rightPlayers: [],
        winner: null,
        winnerLastDarts: 3,
        leftAvg: 0,
        rightAvg: 0
    };

    // Split by tabs
    const parts = gameData.split('\t').map(p => p.trim()).filter(p => p);

    let i = 0;
    let round = 0;
    let lastLeftPlayer = null;
    let lastRightPlayer = null;

    while (i < parts.length) {
        // Skip header and metadata
        if (parts[i] === '!' || parts[i] === 'Player' || parts[i] === 'Turn' ||
            parts[i] === 'Score' || parts[i] === 'Rnd' || parts[i].includes('Dart Avg')) {
            // Check for avg at end
            if (parts[i].includes('Dart Avg') || parts[i] === 'Darts:') {
                // Try to extract averages
                const avgStr = parts.slice(Math.max(0, i-2), i+3).join(' ');
                const leftAvgMatch = avgStr.match(/^(\d+\.?\d*)/);
                const rightAvgMatch = avgStr.match(/(\d+\.?\d*)\s*$/);
                if (leftAvgMatch) game.leftAvg = parseFloat(leftAvgMatch[1]);
                if (rightAvgMatch) game.rightAvg = parseFloat(rightAvgMatch[1]);
            }
            i++;
            continue;
        }

        // Check for DO (checkout) marker
        if (parts[i].startsWith('DO')) {
            const doMatch = parts[i].match(/DO\s*\((\d)\)/);
            if (doMatch) {
                game.winnerLastDarts = parseInt(doMatch[1]);
            }
            i++;
            continue;
        }

        // Check if this is a highlight number (100, 140, etc at start of turn)
        if (/^\d+$/.test(parts[i]) && parseInt(parts[i]) >= 50 && parseInt(parts[i]) <= 180) {
            // Could be a highlight or a score - look ahead
            if (i + 1 < parts.length && isPlayerName(parts[i + 1])) {
                // This is a highlight, skip it
                i++;
                continue;
            }
        }

        // Try to parse a turn
        // Pattern: [PlayerName] [Score] [Remaining] [Round] [Remaining] [Score] [PlayerName]

        // Look for left player
        if (isPlayerName(parts[i])) {
            const leftPlayer = parts[i];
            lastLeftPlayer = leftPlayer;
            if (!game.leftPlayers.includes(leftPlayer)) game.leftPlayers.push(leftPlayer);

            // Next should be score
            if (i + 1 < parts.length && /^\d+$/.test(parts[i + 1])) {
                const leftScore = parseInt(parts[i + 1]);

                // Next should be remaining
                if (i + 2 < parts.length && /^\d+$/.test(parts[i + 2])) {
                    const leftRemaining = parseInt(parts[i + 2]);

                    // Next should be round
                    if (i + 3 < parts.length && /^\d+$/.test(parts[i + 3])) {
                        round = parseInt(parts[i + 3]);

                        // Add left turn
                        const isCheckout = leftRemaining === 0;
                        game.turns.push({
                            side: 'home',
                            player: leftPlayer,
                            score: leftScore,
                            remaining: leftRemaining,
                            round: round,
                            isCheckout: isCheckout,
                            darts: isCheckout ? game.winnerLastDarts : 3
                        });

                        if (isCheckout) {
                            game.winner = 'home';
                        }

                        // Now look for right side: [Remaining] [Score] [PlayerName]
                        if (i + 4 < parts.length && /^\d+$/.test(parts[i + 4])) {
                            const rightRemaining = parseInt(parts[i + 4]);

                            if (i + 5 < parts.length && /^\d+$/.test(parts[i + 5])) {
                                const rightScore = parseInt(parts[i + 5]);

                                if (i + 6 < parts.length && isPlayerName(parts[i + 6])) {
                                    const rightPlayer = parts[i + 6];
                                    lastRightPlayer = rightPlayer;
                                    if (!game.rightPlayers.includes(rightPlayer)) game.rightPlayers.push(rightPlayer);

                                    const rightIsCheckout = rightRemaining === 0;
                                    game.turns.push({
                                        side: 'away',
                                        player: rightPlayer,
                                        score: rightScore,
                                        remaining: rightRemaining,
                                        round: round,
                                        isCheckout: rightIsCheckout,
                                        darts: rightIsCheckout ? game.winnerLastDarts : 3
                                    });

                                    if (rightIsCheckout) {
                                        game.winner = 'away';
                                    }

                                    i += 7;
                                    continue;
                                }
                            }
                        }

                        i += 4;
                        continue;
                    }
                }
            }
        }

        // Check for X (bust)
        if (parts[i] === 'X') {
            i++;
            continue;
        }

        i++;
    }

    return game;
}

// Parse cricket marks string to count
function countMarks(markStr) {
    if (!markStr || markStr === '∅' || markStr === 'Start') return 0;

    let total = 0;
    const parts = markStr.split(/,\s*/);

    for (const part of parts) {
        // T = triple (3), D = double (2), S = single (1)
        // DB = double bull, SB = single bull
        // x2, x3 = hit that many of that segment

        if (part.includes('T')) total += 3;
        else if (part.includes('D')) total += 2;
        else if (part.includes('S')) {
            // Check for multiplier
            const multMatch = part.match(/x(\d)/);
            if (multMatch) {
                total += parseInt(multMatch[1]);
            } else {
                total += 1;
            }
        }
    }

    return total;
}

// Parse a Cricket game from tab-separated data
function parseCricketGame(gameData, setNum, gameNum, legNum) {
    const game = {
        set: setNum,
        game: gameNum,
        leg: legNum,
        format: 'Cricket',
        turns: [],
        leftPlayers: [],
        rightPlayers: [],
        winner: null,
        leftMPR: 0,
        rightMPR: 0,
        leftScore: 0,
        rightScore: 0
    };

    const parts = gameData.split('\t').map(p => p.trim()).filter(p => p);

    let round = 0;

    for (let i = 0; i < parts.length; i++) {
        // Skip header
        if (parts[i] === '!' || parts[i] === 'Player' || parts[i] === 'Turn' ||
            parts[i] === 'Score' || parts[i] === 'Rnd') {
            continue;
        }

        // Check for MPR at end
        if (parts[i].includes('Dart Avg') || parts[i] === 'Darts:') {
            continue;
        }

        // Skip highlights
        if (/^\d+[MB]$/.test(parts[i])) {
            continue;
        }

        // Look for player name followed by marks
        if (isPlayerName(parts[i])) {
            const leftPlayer = parts[i];
            if (!game.leftPlayers.includes(leftPlayer)) game.leftPlayers.push(leftPlayer);

            // Next should be marks (like S19, T20, etc)
            if (i + 1 < parts.length && /^[STD]/.test(parts[i + 1])) {
                const leftMarks = parts[i + 1];
                const leftMarksCount = countMarks(leftMarks);

                // Next should be score
                if (i + 2 < parts.length && (/^\d+$/.test(parts[i + 2]) || parts[i + 2] === 'Start')) {
                    const leftScore = parts[i + 2] === 'Start' ? 0 : parseInt(parts[i + 2]);

                    // Next should be round
                    if (i + 3 < parts.length && /^\d+$/.test(parts[i + 3])) {
                        round = parseInt(parts[i + 3]);

                        game.turns.push({
                            side: 'home',
                            player: leftPlayer,
                            marksStr: leftMarks,
                            marks: leftMarksCount,
                            score: leftScore,
                            round: round
                        });

                        game.leftScore = leftScore;

                        // Look for right side
                        // [Score] [Marks] [Player] or [Start] [Marks] [Player]
                        if (i + 4 < parts.length) {
                            let rightScore = 0;
                            let nextIdx = i + 4;

                            if (/^\d+$/.test(parts[nextIdx]) || parts[nextIdx] === 'Start') {
                                rightScore = parts[nextIdx] === 'Start' ? 0 : parseInt(parts[nextIdx]);
                                nextIdx++;
                            }

                            if (nextIdx < parts.length && (/^[STD∅]/.test(parts[nextIdx]) || parts[nextIdx] === '∅')) {
                                const rightMarks = parts[nextIdx];
                                nextIdx++;

                                if (nextIdx < parts.length && isPlayerName(parts[nextIdx])) {
                                    const rightPlayer = parts[nextIdx];
                                    if (!game.rightPlayers.includes(rightPlayer)) game.rightPlayers.push(rightPlayer);

                                    game.turns.push({
                                        side: 'away',
                                        player: rightPlayer,
                                        marksStr: rightMarks,
                                        marks: countMarks(rightMarks),
                                        score: rightScore,
                                        round: round
                                    });

                                    game.rightScore = rightScore;
                                    i = nextIdx;
                                    continue;
                                }
                            }
                        }

                        i += 3;
                        continue;
                    }
                }
            }
        }
    }

    // Determine winner (higher score wins, or if tied, whoever closed out)
    game.winner = game.leftScore >= game.rightScore ? 'home' : 'away';

    return game;
}

// Main parser function
function parseMatch(rtfContent) {
    const text = stripRtf(rtfContent);
    const lines = text.split('\n');

    const match = {
        date: null,
        homeTeam: null,
        awayTeam: null,
        homePlayers: [],
        awayPlayers: [],
        legs: [],
        playerStats: {}
    };

    // Extract date
    const dateMatch = text.match(/Date:\s*([^\t\n]+)/);
    if (dateMatch) match.date = dateMatch[1].trim();

    let currentSet = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect new set
        const setMatch = line.match(/^Set\s+(\d+)/);
        if (setMatch) {
            currentSet = parseInt(setMatch[1]);
            continue;
        }

        // Detect new game
        const gameMatch = line.match(/Game\s+(\d+)\.(\d+)\s*-\s*(501|Cricket)/i);
        if (gameMatch) {
            const gameNum = parseInt(gameMatch[1]);
            const legNum = parseInt(gameMatch[2]);
            const format = gameMatch[3].includes('501') ? '501' : 'Cricket';

            // Collect all data until next game or set
            let gameData = '';
            let j = i + 1;

            while (j < lines.length) {
                if (lines[j].match(/^Set\s+\d+/) || lines[j].match(/Game\s+\d+\.\d+\s*-/)) {
                    break;
                }
                gameData += lines[j] + '\t';
                j++;
            }

            // Parse the game
            const parsedGame = format === '501'
                ? parse501Game(gameData, currentSet, gameNum, legNum)
                : parseCricketGame(gameData, currentSet, gameNum, legNum);

            match.legs.push(parsedGame);

            // Collect players
            parsedGame.leftPlayers.forEach(p => {
                if (!match.homePlayers.includes(p)) match.homePlayers.push(p);
            });
            parsedGame.rightPlayers.forEach(p => {
                if (!match.awayPlayers.includes(p)) match.awayPlayers.push(p);
            });

            i = j - 1;
            continue;
        }
    }

    return match;
}

// Calculate player stats from parsed match
function calculatePlayerStats(match) {
    const stats = {};

    for (const leg of match.legs) {
        // Track turns per player in this leg for First 9 calculation
        const playerTurnCount = {};

        for (const turn of leg.turns) {
            const player = turn.player;
            if (!player) continue;

            // Track turn count for this player in this leg
            playerTurnCount[player] = (playerTurnCount[player] || 0) + 1;

            if (!stats[player]) {
                stats[player] = {
                    name: player,
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
                    x01_checkout_attempts_low: 0,
                    x01_checkout_successes_low: 0,
                    x01_checkout_attempts_81: 0,
                    x01_checkout_successes_81: 0,
                    x01_checkout_attempts_101: 0,
                    x01_checkout_successes_101: 0,
                    x01_checkout_attempts_141: 0,
                    x01_checkout_successes_141: 0,
                    cricket_legs_played: 0,
                    cricket_legs_won: 0,
                    cricket_total_darts: 0,
                    cricket_total_marks: 0,
                    cricket_total_rounds: 0
                };
            }

            const s = stats[player];

            if (leg.format === '501') {
                const score = turn.score || 0;
                const darts = turn.darts || 3;

                s.x01_total_points += score;
                s.x01_total_darts += darts;

                // Track First 9 (first 3 turns = 9 darts)
                if (playerTurnCount[player] <= 3) {
                    s.x01_first9_points += score;
                    s.x01_first9_darts += darts;
                }

                // Track high turn (non-checkout)
                if (!turn.isCheckout && score > s.x01_high_turn) {
                    s.x01_high_turn = score;
                }

                // Count tons
                if (score === 180) s.x01_ton_80++;
                else if (score >= 140) s.x01_ton_40++;
                else if (score >= 100) s.x01_tons++;

                // Track checkout
                if (turn.isCheckout) {
                    s.x01_checkouts_hit++;
                    const checkout = score;
                    s.x01_checkout_totals += checkout;

                    if (checkout > s.x01_high_checkout) {
                        s.x01_high_checkout = checkout;
                    }

                    if (checkout <= 80) {
                        s.x01_checkout_successes_low++;
                    } else if (checkout <= 100) {
                        s.x01_checkout_successes_81++;
                    } else if (checkout <= 140) {
                        s.x01_checkout_successes_101++;
                    } else {
                        s.x01_checkout_successes_141++;
                    }
                }
            } else if (leg.format === 'Cricket') {
                s.cricket_total_marks += turn.marks || 0;
                s.cricket_total_darts += 3;
                s.cricket_total_rounds++;
            }
        }

        // Track legs played/won
        const legPlayers = new Set(leg.turns.map(t => t.player));

        for (const player of legPlayers) {
            if (!stats[player]) continue;

            if (leg.format === '501') {
                stats[player].x01_legs_played++;
                const winnerSide = leg.winner;
                const playerSide = leg.leftPlayers.includes(player) ? 'home' : 'away';
                if (winnerSide === playerSide) {
                    stats[player].x01_legs_won++;
                }
            } else {
                stats[player].cricket_legs_played++;
                const winnerSide = leg.winner;
                const playerSide = leg.leftPlayers.includes(player) ? 'home' : 'away';
                if (winnerSide === playerSide) {
                    stats[player].cricket_legs_won++;
                }
            }
        }
    }

    // Calculate averages
    for (const player in stats) {
        const s = stats[player];
        s.x01_average = s.x01_total_darts > 0
            ? Math.round((s.x01_total_points / s.x01_total_darts) * 3 * 100) / 100
            : 0;
        s.x01_three_dart_avg = s.x01_average;
        s.x01_first_9_avg = s.x01_first9_darts > 0
            ? Math.round((s.x01_first9_points / s.x01_first9_darts) * 3 * 100) / 100
            : 0;
        s.x01_avg_checkout = s.x01_checkouts_hit > 0
            ? Math.round((s.x01_checkout_totals / s.x01_checkouts_hit) * 100) / 100
            : 0;
        s.cricket_mpr = s.cricket_total_rounds > 0
            ? Math.round((s.cricket_total_marks / s.cricket_total_rounds) * 100) / 100
            : 0;
    }

    return stats;
}

// Main execution
if (require.main === module) {
    const filePath = process.argv[2] || '../temp/trips league/pagel v pagel.rtf';

    console.log('Reading file:', filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    console.log('\n=== Parsing Match ===\n');
    const match = parseMatch(content);

    console.log('Date:', match.date);
    console.log('Home Players:', match.homePlayers.join(', '));
    console.log('Away Players:', match.awayPlayers.join(', '));
    console.log('Total Legs:', match.legs.length);

    console.log('\n=== Leg Summary ===\n');
    for (const leg of match.legs) {
        const winnerSide = leg.winner;
        const winnerPlayer = winnerSide === 'home' ? leg.leftPlayers[0] : leg.rightPlayers[0];
        console.log(`Set ${leg.set} Game ${leg.game}.${leg.leg} (${leg.format}): ${winnerPlayer || 'unknown'} wins - ${leg.turns.length} turns`);
    }

    console.log('\n=== Player Stats ===\n');
    const stats = calculatePlayerStats(match);

    for (const player in stats) {
        const s = stats[player];
        console.log(`\n${player}:`);
        if (s.x01_legs_played > 0) {
            console.log(`  501: ${s.x01_legs_won}/${s.x01_legs_played} legs, ${s.x01_average} avg (First9: ${s.x01_first_9_avg}), ${s.x01_total_darts} darts`);
            console.log(`       Tons: ${s.x01_tons}, T40: ${s.x01_ton_40}, T80: ${s.x01_ton_80}`);
            console.log(`       High Turn: ${s.x01_high_turn}, High CO: ${s.x01_high_checkout}, Avg CO: ${s.x01_avg_checkout}`);
        }
        if (s.cricket_legs_played > 0) {
            console.log(`  Cricket: ${s.cricket_legs_won}/${s.cricket_legs_played} legs, ${s.cricket_mpr} MPR, ${s.cricket_total_marks} marks`);
        }
    }

    // Output JSON for import
    if (process.argv[3] === '--json') {
        console.log('\n=== JSON Output ===\n');
        console.log(JSON.stringify(stats, null, 2));
    }
}

module.exports = { parseMatch, calculatePlayerStats, stripRtf };
