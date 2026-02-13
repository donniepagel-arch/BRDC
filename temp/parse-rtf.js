/**
 * RTF Match Data Parser for DartConnect exports
 * Extracts turn-by-turn throw data and calculates player_stats
 */

const fs = require('fs');
const path = require('path');

// Extract timing metadata from RTF header
function extractMatchMetadata(text) {
    const lines = text.split('\n');
    let match_date = null;
    let start_time = null;
    let end_time = null;
    let game_time_minutes = null;
    let match_length_minutes = null;

    for (const line of lines) {
        // Date: Wed, 14-Jan-2026 or Date: 14-Jan-2026
        const dateMatch = line.match(/Date[:\s]+(?:\w+,?\s*)?(\d+-\w+-\d+)/i);
        if (dateMatch) {
            match_date = new Date(dateMatch[1]);
        }

        // Start: 7:33 PM
        const startMatch = line.match(/Start[:\s]+(\d+):(\d+)\s*([AP]M)/i);
        if (startMatch && match_date) {
            let hours = parseInt(startMatch[1]);
            const minutes = parseInt(startMatch[2]);
            const ampm = startMatch[3].toUpperCase();

            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            start_time = new Date(match_date);
            start_time.setHours(hours, minutes, 0, 0);
        }

        // End: 10:45 PM
        const endMatch = line.match(/End[:\s]+(\d+):(\d+)\s*([AP]M)/i);
        if (endMatch && match_date) {
            let hours = parseInt(endMatch[1]);
            const minutes = parseInt(endMatch[2]);
            const ampm = endMatch[3].toUpperCase();

            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;

            end_time = new Date(match_date);
            end_time.setHours(hours, minutes, 0, 0);
        }

        // Game Time: 02:37
        const gameTimeMatch = line.match(/Game Time[:\s]+(\d+):(\d+)/i);
        if (gameTimeMatch) {
            game_time_minutes = parseInt(gameTimeMatch[1]) * 60 + parseInt(gameTimeMatch[2]);
        }

        // Match Length: 03:12
        const lengthMatch = line.match(/Match Length[:\s]+(\d+):(\d+)/i);
        if (lengthMatch) {
            match_length_minutes = parseInt(lengthMatch[1]) * 60 + parseInt(lengthMatch[2]);
        }
    }

    return { match_date, start_time, end_time, game_time_minutes, match_length_minutes };
}

// Parse RTF content to plain text
function rtfToText(rtfContent) {
    let text = rtfContent
        .replace(/\{\\rtf1[^}]*\}/g, '')
        .replace(/\{\\fonttbl[^}]*\}/g, '')
        .replace(/\{\\colortbl[^}]*\}/g, '')
        .replace(/\{\\generator[^}]*\}/g, '')
        .replace(/\{\\mmathPr[^}]*\}/g, '')
        .replace(/\\viewkind\d+/g, '')
        .replace(/\\uc\d+/g, '')
        .replace(/\\pard[^\\]*/g, '')
        .replace(/\\sa\d+/g, '')
        .replace(/\\sl\d+/g, '')
        .replace(/\\slmult\d+/g, '')
        .replace(/\\f\d+/g, '')
        .replace(/\\fs\d+/g, '')
        .replace(/\\lang\d+/g, '')
        .replace(/\\par\s*/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\u8709\?/g, '∅')
        .replace(/\\\*/g, '')
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
        .trim();

    // Clean up extra spaces that RTF conversion may introduce
    // Normalize "Game   1 . 1  -  501" to "Game 1.1 - 501"
    text = text
        // Fix spaced-out numbers with dots: "1 . 1" -> "1.1"
        .replace(/(\d)\s+\.\s+(\d)/g, '$1.$2')
        // Fix spaced-out colons: "00 : 22" -> "00:22"
        .replace(/(\d)\s+:\s+(\d)/g, '$1:$2')
        // Collapse multiple spaces (but not tabs or newlines)
        .replace(/  +/g, ' ');

    return text;
}

// Check if string is a valid player name
function isValidPlayerName(str) {
    if (!str) return false;
    if (/^\d+$/.test(str)) return false;
    if (/^DO\s*\(\s*\d+\s*\)$/i.test(str)) return false;
    if (str === 'X' || str === '∅' || str === '-' || str === '!') return false;
    if (str === 'Start' || str === 'Player' || str === 'Turn' || str === 'Score' || str === 'Rnd') return false;
    // Exclude cricket hit notation (e.g., "T20", "S19x2", "DB", "SB", "T20, S19")
    if (/^[TDS]\d+/.test(str)) return false;  // Starts with T/D/S followed by number
    if (/^[TDS]B/.test(str)) return false;     // Triple/Double/Single Bull
    if (/^\d+[MBTDS]/.test(str)) return false; // Notable markers like "5M", "3B"
    if (str.includes(',') && /[TDS]\d+/.test(str)) return false; // Multi-hit notation
    return /[a-zA-Z]/.test(str);
}

// Detect notable X01 throw (returns label or null)
function getX01Notable(score) {
    if (score === 180) return '180';
    if (score >= 171) return 'T80';  // Ton-80 (171-179)
    if (score >= 140) return 'TON+'; // Ton-40+ (140-169)
    if (score >= 100) return 'TON';  // Ton (100-139)
    if (score >= 95) return '95+';   // Near-ton (95-99)
    return null;
}

// Detect notable Cricket throw (returns label or null)
function getCricketNotable(marks) {
    if (marks >= 9) return '9M';
    if (marks === 8) return '8M';
    if (marks === 7) return '7M';
    if (marks === 6) return '6M';
    if (marks === 5) return '5M';
    return null;
}

// Parse cricket hit notation to count marks
function parseHitNotation(hitStr) {
    if (!hitStr || hitStr === '∅' || hitStr === 'X' || hitStr === '-') return 0;

    let marks = 0;
    const hits = hitStr.split(',').map(h => h.trim());

    for (const hit of hits) {
        if (!hit) continue;
        const multiplierMatch = hit.match(/x(\d+)$/);
        const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;
        const baseHit = hit.replace(/x\d+$/, '');

        if (baseHit.startsWith('T')) {
            marks += 3 * multiplier;
        } else if (baseHit === 'DB') {
            marks += 2 * multiplier;
        } else if (baseHit === 'SB') {
            marks += 1 * multiplier;
        } else if (baseHit.startsWith('D')) {
            marks += 2 * multiplier;
        } else if (baseHit.startsWith('S')) {
            marks += 1 * multiplier;
        }
    }
    return marks;
}

// Parse a single leg of 501 data
function parse501Leg(lines) {
    const throws = [];
    const playerStats = {};
    let inThrowData = false;
    let homePlayer = null;
    let awayPlayer = null;
    let lastRound = 0;
    let checkoutDarts = 3; // Default to 3, will be overwritten if DO marker found
    let checkoutPlayer = null;
    let checkoutRound = null;
    let winnerSide = null;
    let headerValues = []; // Track header values for side validation

    for (const line of lines) {
        if (!line.trim()) continue;
        const normalizedLine = line.replace(/\s*\t\s*/g, '\t').trim();

        // Capture header values (first few numbers before throws start)
        if (!inThrowData && /^\d+$/.test(normalizedLine.trim())) {
            headerValues.push(parseInt(normalizedLine.trim()));
        }

        // Detect header
        if (normalizedLine.includes('Player\tTurn') || normalizedLine.includes('!\tPlayer')) {
            inThrowData = true;
            continue;
        }

        // End of throw data
        if (normalizedLine.includes('3 Dart Avg') || (normalizedLine.includes('Darts:') && !normalizedLine.includes('Player'))) {
            break;
        }

        if (!inThrowData) continue;

        // Check for DO marker in line (checkout)
        const doMatch = line.match(/DO\s*\(\s*(\d+)\s*\)/);
        if (doMatch) {
            checkoutDarts = parseInt(doMatch[1]);
        }

        const parts = normalizedLine.split('\t').filter(p => p.trim() !== '');
        if (parts.length < 4) continue;

        // Identify all players, numbers, and special markers (X, ∅) in the row
        const players = [];
        const numbers = [];
        const specials = []; // For X (bust) and ∅ (no throw)
        for (let i = 0; i < parts.length; i++) {
            if (isValidPlayerName(parts[i])) {
                players.push({ name: parts[i], index: i });
            } else if (/^\d+$/.test(parts[i])) {
                numbers.push({ value: parseInt(parts[i]), index: i });
            } else if (parts[i] === 'X' || parts[i] === '∅') {
                specials.push({ value: 0, index: i, type: parts[i] });
            }
        }

        // Combine numbers and specials for parsing, treating X/∅ as score=0
        const allValues = [...numbers, ...specials].sort((a, b) => a.index - b.index);

        // Need at least one player and some values
        if (players.length === 0 || allValues.length < 3) continue;

        // Find the round number - it's the number that makes sense as a round
        // Rounds increment by 1 each turn, so prefer exact match to lastRound + 1
        // Standard format: Player Score Remaining ROUND Remaining Score Player
        // Round should have at least 2 values before and 2 values after
        let roundInfo = null;
        const expectedRound = lastRound + 1;

        // First pass: look for exactly the expected next round with proper context (2+ values on each side)
        for (const num of numbers) {
            if (num.value === expectedRound) {
                const beforeVals = allValues.filter(n => n.index < num.index);
                const afterVals = allValues.filter(n => n.index > num.index);
                // Require at least 2 values before and 2 after (score + remaining on each side)
                if (beforeVals.length >= 2 && afterVals.length >= 2) {
                    roundInfo = num;
                    break;
                }
            }
        }

        // Second pass: relax to 1+ values on each side for expected round
        if (!roundInfo) {
            for (const num of numbers) {
                if (num.value === expectedRound) {
                    const beforeVals = allValues.filter(n => n.index < num.index);
                    const afterVals = allValues.filter(n => n.index > num.index);
                    if (beforeVals.length > 0 && afterVals.length > 0) {
                        roundInfo = num;
                        break;
                    }
                }
            }
        }

        // Third pass: if no exact match, look for any valid round >= expected with proper context
        if (!roundInfo) {
            for (const num of numbers) {
                if (num.value > 0 && num.value <= 30 && num.value >= expectedRound) {
                    const beforeVals = allValues.filter(n => n.index < num.index);
                    const afterVals = allValues.filter(n => n.index > num.index);
                    // Prefer candidates with 2+ values on each side
                    if (beforeVals.length >= 2 && afterVals.length >= 2) {
                        roundInfo = num;
                        break;
                    }
                }
            }
        }

        // Fourth pass: fallback to any valid round
        if (!roundInfo) {
            for (const num of numbers) {
                if (num.value > 0 && num.value <= 30 && num.value >= expectedRound) {
                    const beforeVals = allValues.filter(n => n.index < num.index);
                    const afterVals = allValues.filter(n => n.index > num.index);
                    if (beforeVals.length > 0 && afterVals.length > 0) {
                        roundInfo = num;
                        break;
                    }
                }
            }
        }

        if (!roundInfo) {
            // Special case: checkout-only row where only winner's throw is shown
            // This means the opponent did NOT throw in this final round (cork winner checked out first)
            // Format: [round] [remaining=0] [score] [player] DO(n)
            if (players.length === 1 && numbers.length >= 2 && doMatch) {
                // Use lastRound + 1 as the round number (more reliable than parsing)
                const round = lastRound + 1;
                const remaining = 0; // Checkout means remaining is always 0
                const score = numbers.length > 2 ? numbers[2].value : numbers[0].value;
                const player = players[0].name;

                if (true) { // Always process checkout-only rows
                    // This is a checkout row - only winner threw, opponent didn't get to throw
                    const side = playerStats[player]?.side || 'away';
                    const scoreValue = numbers.length > 2 ? numbers[2].value : 0;
                    const throwData = {
                        round: round,
                        side: side,
                        player: player,
                        score: scoreValue,
                        remaining: 0,
                        checkout: true,
                        checkout_darts: checkoutDarts,
                        opponentDidNotThrow: true // Flag that opponent didn't throw this round
                    };

                    // Add notable flag
                    const notable = getX01Notable(scoreValue);
                    if (notable) throwData.notable = notable;

                    throws.push(throwData);

                    if (!playerStats[player]) {
                        playerStats[player] = { darts: 0, points: 0, side };
                    }
                    // For checkout, add score and darts
                    const checkoutScore = numbers.length > 2 ? numbers[2].value : 0;
                    playerStats[player].points += checkoutScore;
                    playerStats[player].darts += checkoutDarts;
                    checkoutPlayer = player;
                    checkoutRound = round;
                    winnerSide = side;
                    lastRound = round;
                }
            }
            continue;
        }

        const round = roundInfo.value;
        lastRound = round;

        // Get values before and after round (includes X/∅ as score=0)
        const beforeRound = allValues.filter(n => n.index < roundInfo.index).sort((a, b) => b.index - a.index);
        const afterRound = allValues.filter(n => n.index > roundInfo.index).sort((a, b) => a.index - b.index);

        // Home remaining is immediately before round, home score is before that
        const homeRemaining = beforeRound.length > 0 ? beforeRound[0].value : null;
        const homeScore = beforeRound.length > 1 ? beforeRound[1].value : null;

        // Away remaining is immediately after round, away score is after that
        const awayRemaining = afterRound.length > 0 ? afterRound[0].value : null;
        const awayScore = afterRound.length > 1 ? afterRound[1].value : null;

        // Find home player (before round index) and away player (after round index)
        const homePlayers = players.filter(p => p.index < roundInfo.index);
        const awayPlayers = players.filter(p => p.index > roundInfo.index);

        if (homePlayers.length > 0) homePlayer = homePlayers[0].name;
        if (awayPlayers.length > 0) awayPlayer = awayPlayers[awayPlayers.length - 1].name;

        // Detect "bust + checkout same round" pattern
        // Pattern: One player busts (X marker, remaining > 0), other checks out (DO marker, remaining = 0)
        const homeBusted = specials.some(s => s.type === 'X' && s.index < roundInfo.index);
        const awayBusted = specials.some(s => s.type === 'X' && s.index > roundInfo.index);
        
        // Record home throw
        if (homePlayer && homeScore !== null && homeRemaining !== null) {
            const throwData = {
                round,
                side: 'home',
                player: homePlayer,
                score: homeScore,
                remaining: homeRemaining
            };

            // Add notable flag for X01
            const notable = getX01Notable(homeScore);
            if (notable) throwData.notable = notable;

            // Check if this is a checkout (remaining = 0 AND not busted)
            if (homeRemaining === 0 && !homeBusted) {
                throwData.checkout = true;
                throwData.checkout_darts = doMatch ? checkoutDarts : 3;
            }

            throws.push(throwData);

            if (!playerStats[homePlayer]) {
                playerStats[homePlayer] = { darts: 0, points: 0, side: 'home' };
            }
            playerStats[homePlayer].points += homeScore;

            if (homeRemaining === 0 && !homeBusted) {
                if (doMatch) {
                    playerStats[homePlayer].darts += checkoutDarts;
                } else {
                    playerStats[homePlayer].darts += 3; // Fallback if DO marker missing/unparsed
                }
                checkoutPlayer = homePlayer;
                winnerSide = 'home';
            } else {
                playerStats[homePlayer].darts += 3;
            }
        }

        // Record away throw
        if (awayPlayer && awayRemaining !== null) {
            const throwData = {
                round,
                side: 'away',
                player: awayPlayer,
                score: awayScore || 0,
                remaining: awayRemaining
            };

            // Add notable flag for X01
            const notable = getX01Notable(awayScore || 0);
            if (notable) throwData.notable = notable;

            // Check if this is a checkout (remaining = 0 AND not busted)
            if (awayRemaining === 0 && !awayBusted) {
                throwData.checkout = true;
                throwData.checkout_darts = doMatch ? checkoutDarts : 3;
            }

            throws.push(throwData);

            if (!playerStats[awayPlayer]) {
                playerStats[awayPlayer] = { darts: 0, points: 0, side: 'away' };
            }
            playerStats[awayPlayer].points += awayScore || 0;

            if (awayRemaining === 0 && !awayBusted) {
                if (doMatch) {
                    playerStats[awayPlayer].darts += checkoutDarts;
                } else {
                    playerStats[awayPlayer].darts += 3;
                }
                checkoutPlayer = awayPlayer;
                winnerSide = 'away';
            } else {
                playerStats[awayPlayer].darts += 3;
            }
        }
    }

    // Validate winner against team averages
    // If header shows pattern like [0, 4] and winner has much lower average, sides may be flipped
    if (winnerSide && headerValues.length >= 2) {
        const homePlayers = Object.keys(playerStats).filter(p => playerStats[p].side === 'home');
        const awayPlayers = Object.keys(playerStats).filter(p => playerStats[p].side === 'away');
        
        // Calculate team averages
        const homeTotal = homePlayers.reduce((acc, p) => ({
            darts: acc.darts + playerStats[p].darts,
            points: acc.points + playerStats[p].points
        }), { darts: 0, points: 0 });
        
        const awayTotal = awayPlayers.reduce((acc, p) => ({
            darts: acc.darts + playerStats[p].darts,
            points: acc.points + playerStats[p].points
        }), { darts: 0, points: 0 });
        
        const home3DA = homeTotal.darts > 0 ? (homeTotal.points / homeTotal.darts * 3) : 0;
        const away3DA = awayTotal.darts > 0 ? (awayTotal.points / awayTotal.darts * 3) : 0;
        
        // Check for suspicious pattern: winner has significantly lower average
        const avgDiff = Math.abs(home3DA - away3DA);
        if (avgDiff > 4.0) { // More than 4 point difference in 3DA
            // Check header pattern: [small, large] suggests small=home lost, large=away lost
            const [val1, val2] = headerValues;
            if (val1 < val2 && winnerSide === 'home' && away3DA > home3DA) {
                // Home "won" but has much lower average, and header shows 0-4 pattern
                // This suggests sides are flipped - flip the result
                winnerSide = 'away';
                
                // Swap player sides
                Object.keys(playerStats).forEach(p => {
                    playerStats[p].side = playerStats[p].side === 'home' ? 'away' : 'home';
                });
                
                // Swap throws
                throws.forEach(t => {
                    t.side = t.side === 'home' ? 'away' : 'home';
                });
            } else if (val1 > val2 && winnerSide === 'away' && home3DA > away3DA) {
                // Away "won" but has much lower average, and header shows large-small pattern
                // Flip the result
                winnerSide = 'home';
                
                // Swap player sides
                Object.keys(playerStats).forEach(p => {
                    playerStats[p].side = playerStats[p].side === 'home' ? 'away' : 'home';
                });
                
                // Swap throws
                throws.forEach(t => {
                    t.side = t.side === 'home' ? 'away' : 'home';
                });
            }
        }
    }

    return { throws, playerStats, checkout_darts: checkoutDarts, checkout_player: checkoutPlayer, winner: winnerSide };
}

// Check if string looks like cricket hit notation
function isHitNotation(str) {
    if (!str || str === '∅' || str === 'X' || str === 'Start') return false;
    // Hit notation patterns: T20, S19x2, DB, SB, T20 S19, etc.
    return /^[TDS]\d+/.test(str) || /^[TDS]B/.test(str) || (str.includes(',') && /[TDS]\d+/.test(str));
}

// Count darts from hit notation
function countDartsFromHit(hitStr) {
    if (!hitStr || hitStr === '∅' || hitStr === 'X' || hitStr === '-') return 0;

    // Count individual hits (comma-separated or space-separated)
    const hits = hitStr.split(/[,\s]+/).filter(h => h.trim());
    let dartCount = 0;

    for (const hit of hits) {
        if (!hit) continue;
        // Check for multiplier (e.g., S19x2, DBx2)
        const multiplierMatch = hit.match(/x(\d+)$/);
        const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;
        dartCount += multiplier;
    }

    return dartCount || 0;
}

// Parse a single leg of cricket data
// Format: [notable?] [home_player] [home_hit] [home_score] [round] [away_score] [away_hit] [away_player] [notable?]
// Options: { winner: 'home'|'away', closeoutDarts: 1|2|3 } - if provided, adjusts dart count for winner's final throw
function parseCricketLeg(lines, options = {}) {
    const throws = [];
    const playerStats = {};
    let inThrowData = false;
    let homePlayer = null;
    let awayPlayer = null;
    let lastRound = 0;
    let lastHomeThrow = null;
    let lastAwayThrow = null;
    let summaryDarts = null; // Will try to extract from summary line

    // Look for final scores at the beginning of the leg data
    // Format: [home_final_score] / - / [away_final_score] / [duration]
    let homeFinalScore = null;
    let awayFinalScore = null;
    let foundScores = 0;

    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const l = lines[i].trim();
        // Skip empty lines and the dash separator
        if (!l || l === '-') continue;
        // Stop if we hit the header
        if (l.includes('Player') || l.includes('!')) break;
        // Check for pure number (score) or time format (skip)
        if (/^\d+$/.test(l)) {
            const score = parseInt(l);
            if (foundScores === 0) {
                homeFinalScore = score;
                foundScores++;
            } else if (foundScores === 1) {
                awayFinalScore = score;
                foundScores++;
                break;
            }
        }
    }

    for (const line of lines) {
        if (!line.trim()) continue;
        const normalizedLine = line.replace(/\s*\t\s*/g, '\t').trim();

        // Detect header
        if (normalizedLine.includes('Player') && (normalizedLine.includes('Rnd') || normalizedLine.includes('!'))) {
            inThrowData = true;
            continue;
        }

        // Check for summary line with dart count (e.g., "2.6	Darts: 34	3 Dart Avg")
        const dartsMatch = normalizedLine.match(/Darts:\s*(\d+)/);
        if (dartsMatch) {
            summaryDarts = parseInt(dartsMatch[1]);
        }

        // End of throw data
        if (normalizedLine.includes('3 Dart Avg') || normalizedLine.includes('MPR')) {
            break;
        }

        if (!inThrowData) continue;

        const parts = normalizedLine.split('\t').filter(p => p.trim() !== '');
        if (parts.length < 3) continue;

        // Check for winner-only closing line formats:
        // Format 1: [round] [score] [hit] [player] [notable?]  (e.g., "17	370	DBx2	Donnie Pagel	3B")
        // Format 2: [player] [hit] [score] [round]             (e.g., "John Linden	SBx2	20	12")
        if (parts.length >= 3 && parts.length <= 6) {
            let round = null;
            let score = null;
            let hit = null;
            let player = null;

            // Try Format 1: [round] [score] [hit] [player]
            const firstNum = parseInt(parts[0]);
            if (!isNaN(firstNum) && firstNum > lastRound && firstNum <= 50) {
                round = firstNum;
                score = parseInt(parts[1]) || 0;
                // Find hit and player in remaining parts
                for (let i = 2; i < parts.length; i++) {
                    if (isHitNotation(parts[i]) || parts[i] === '∅') {
                        hit = parts[i];
                    } else if (isValidPlayerName(parts[i])) {
                        player = parts[i];
                    }
                }
            }
            
            // Try Format 2: [player] [hit] [score] [round]
            if (!round && parts.length === 4 && isValidPlayerName(parts[0])) {
                const lastNum = parseInt(parts[3]);
                if (!isNaN(lastNum) && lastNum > lastRound && lastNum <= 50) {
                    player = parts[0];
                    if (isHitNotation(parts[1]) || parts[1] === '∅') {
                        hit = parts[1];
                    }
                    score = parseInt(parts[2]) || 0;
                    round = lastNum;
                }
            }

            if (round && player && hit) {
                lastRound = round;
                const marks = parseHitNotation(hit);
                // Closing throw - use 3 darts, adjustment happens later if needed
                const dartsUsed = 3;

                // Determine side based on known players
                let side = 'away'; // Default to away for closing throws
                if (playerStats[player]) {
                    side = playerStats[player].side;
                }

                const throwData = {
                    round,
                    side,
                    player,
                    hit,
                    marks,
                    score,
                    closed_out: true,
                    closeout_darts: dartsUsed // Will be adjusted later if options.closeoutDarts provided
                };

                // Add notable flag for cricket
                const notable = getCricketNotable(marks);
                if (notable) throwData.notable = notable;

                throws.push(throwData);

                if (!playerStats[player]) {
                    playerStats[player] = { darts: 0, marks: 0, side };
                }
                playerStats[player].marks += marks;
                playerStats[player].darts += dartsUsed;

                if (side === 'home') {
                    lastHomeThrow = { player, round, darts: dartsUsed };
                } else {
                    lastAwayThrow = { player, round, darts: dartsUsed };
                }
                continue;
            }
        }

        if (parts.length < 4) continue;

        // Find round number - look for expected next round first
        let roundIdx = -1;
        const expectedRound = lastRound + 1;

        for (let i = 1; i < parts.length - 1; i++) {
            const val = parseInt(parts[i]);
            if (val === expectedRound) {
                // Verify: before should be a score (number or 'Start'), after should be a score (number)
                const before = parts[i - 1];
                const after = parts[i + 1];
                if ((/^\d+$/.test(before) || before === 'Start') && (/^\d+$/.test(after) || after === 'Start')) {
                    roundIdx = i;
                    break;
                }
            }
        }

        // Fallback: find any valid round
        if (roundIdx === -1) {
            for (let i = 1; i < parts.length - 1; i++) {
                const val = parseInt(parts[i]);
                if (!isNaN(val) && val > 0 && val <= 50 && val >= expectedRound) {
                    const before = parts[i - 1];
                    const after = parts[i + 1];
                    if ((/^\d+$/.test(before) || before === 'Start') && (/^\d+$/.test(after) || after === 'Start')) {
                        roundIdx = i;
                        break;
                    }
                }
            }
        }

        if (roundIdx === -1) continue;

        const round = parseInt(parts[roundIdx]);
        lastRound = round;
        const homeScore = parts[roundIdx - 1] === 'Start' ? 0 : parseInt(parts[roundIdx - 1]) || 0;
        const awayScore = parseInt(parts[roundIdx + 1]) || 0;

        // Find home section: everything before roundIdx-1 (home_score)
        // Should contain: [notable?] [player] [hit]
        let homeHit = null;
        for (let i = 0; i < roundIdx - 1; i++) {
            if (isValidPlayerName(parts[i])) {
                homePlayer = parts[i];
                // Next element should be hit notation
                if (i + 1 < roundIdx - 1) {
                    const nextPart = parts[i + 1];
                    if (isHitNotation(nextPart) || nextPart === '∅') {
                        homeHit = nextPart;
                    }
                }
                break;
            }
        }

        // Find away section: everything after roundIdx+1 (away_score)
        // Should contain: [hit] [player] [notable?]
        let awayHit = null;
        for (let i = parts.length - 1; i > roundIdx + 1; i--) {
            if (isValidPlayerName(parts[i])) {
                awayPlayer = parts[i];
                // Previous element should be hit notation
                if (i > roundIdx + 2) {
                    const prevPart = parts[i - 1];
                    if (isHitNotation(prevPart) || prevPart === '∅') {
                        awayHit = prevPart;
                    }
                }
                break;
            }
        }

        // Record throws - always 3 darts per round (notation shows hits, not total darts)
        if (homePlayer) {
            const marks = parseHitNotation(homeHit);
            const throwData = {
                round,
                side: 'home',
                player: homePlayer,
                hit: homeHit || '',
                marks,
                score: homeScore
            };

            // Add notable flag for cricket
            const notable = getCricketNotable(marks);
            if (notable) throwData.notable = notable;

            throws.push(throwData);
            lastHomeThrow = { player: homePlayer, round, darts: 3 };

            if (!playerStats[homePlayer]) {
                playerStats[homePlayer] = { darts: 0, marks: 0, side: 'home' };
            }
            playerStats[homePlayer].marks += marks;
            playerStats[homePlayer].darts += 3;
        }

        if (awayPlayer) {
            const marks = parseHitNotation(awayHit);
            const throwData = {
                round,
                side: 'away',
                player: awayPlayer,
                hit: awayHit || '',
                marks,
                score: awayScore
            };

            // Add notable flag for cricket
            const notable = getCricketNotable(marks);
            if (notable) throwData.notable = notable;

            throws.push(throwData);
            lastAwayThrow = { player: awayPlayer, round, darts: 3 };

            if (!playerStats[awayPlayer]) {
                playerStats[awayPlayer] = { darts: 0, marks: 0, side: 'away' };
            }
            playerStats[awayPlayer].marks += marks;
            playerStats[awayPlayer].darts += 3;
        }
    }

    // Determine winner from final scores (higher score wins in cricket)
    let winner = null;
    if (homeFinalScore !== null && awayFinalScore !== null) {
        if (homeFinalScore > awayFinalScore) {
            winner = 'home';
        } else if (awayFinalScore > homeFinalScore) {
            winner = 'away';
        }
        // If scores are equal, look for closing throw
        if (!winner) {
            const closingThrow = throws.find(t => t.closed_out);
            if (closingThrow) {
                winner = closingThrow.side;
            }
        }

        // Mark the last throw from the winner as the closeout
        if (winner && throws.length > 0) {
            const lastThrow = winner === 'home' ? lastHomeThrow : lastAwayThrow;
            if (lastThrow) {
                const winningThrow = throws.find(t =>
                    t.round === lastThrow.round &&
                    t.player === lastThrow.player &&
                    t.side === winner
                );
                if (winningThrow && !winningThrow.closed_out) {
                    winningThrow.closed_out = true;
                    winningThrow.closeout_darts = 3; // Default, will be adjusted if needed
                }
            }
        }
    }

    // Adjust dart count for winner's closeout if provided externally
    if (options.winner && options.closeoutDarts && options.closeoutDarts < 3) {
        const lastThrow = options.winner === 'home' ? lastHomeThrow : lastAwayThrow;
        if (lastThrow && playerStats[lastThrow.player]) {
            // Only adjust if we counted 3 darts but should have counted fewer
            if (lastThrow.darts === 3) {
                const dartAdjustment = 3 - options.closeoutDarts;
                playerStats[lastThrow.player].darts -= dartAdjustment;

                // Also update the closeout_darts field on the throw object
                const closingThrow = throws.find(t =>
                    t.round === lastThrow.round &&
                    t.player === lastThrow.player &&
                    t.closed_out
                );
                if (closingThrow) {
                    closingThrow.closeout_darts = options.closeoutDarts;
                }
            }
        }
    }

    // Calculate closeout darts from summaryDarts for singles games
    // In singles, summaryDarts is the total for one player
    // We extract it from summary lines like: "2.6  Darts: 34  3 Dart Avg"
    // This appears TWICE in the summary (once for home, once for away)
    // For now, we'll use the approach: if counted darts > summary darts, the winner closed with fewer darts
    if (summaryDarts && winner) {
        // Check if this is singles (only 2 players total)
        const playerCount = Object.keys(playerStats).length;
        if (playerCount === 2) {
            // Get the winner's player
            const winnerPlayer = winner === 'home' ? homePlayer : awayPlayer;
            if (winnerPlayer && playerStats[winnerPlayer]) {
                const countedDarts = playerStats[winnerPlayer].darts;
                // summaryDarts is for the winner (appears first in summary line)
                // If we counted more darts than the summary shows, adjust the closeout
                if (countedDarts > summaryDarts) {
                    const dartAdjustment = countedDarts - summaryDarts;
                    playerStats[winnerPlayer].darts = summaryDarts;
                }
            }
        }
    }

    return { throws, playerStats, lastRound, summaryDarts, winner, homeFinalScore, awayFinalScore };
}

// Extract match metadata from header lines
function extractMatchMeta(lines) {
    let homeTeam = null;
    let awayTeam = null;
    let isDoubles = false;

    // First pass: look for opponents in summary table
    // Format is like: "Dillon U\t\t2\t1\t2\t\t..." or with tabs
    // The first column is the player/team name, followed by numeric stats
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip headers and metadata lines
        if (line.includes('All Games') || line.includes('AGP') ||
            line.includes('Opponents') || line.includes('Score') ||
            line.includes('Select Report') || line.includes('Game Detail') ||
            line.includes('Disclaimer') || line.includes('Date:') ||
            line.includes('Start:') || line.includes('End:') ||
            line.includes('Learn More') || line.includes('Summary')) {
            continue;
        }

        // Look for lines that start with a name (letters, spaces, &) followed by stats
        // Typical format: "Player Name   2   1   2   1,002   73   41.18"
        const parts = line.split(/\t+/).map(p => p.trim()).filter(p => p);

        if (parts.length >= 3) {
            const firstPart = parts[0];

            // Check if first part looks like a player/team name
            // Should start with letter and contain mostly letters/spaces/&
            if (/^[A-Za-z]/.test(firstPart) &&
                !firstPart.includes('Game') &&
                !firstPart.includes('WIN') &&
                !firstPart.includes(':') &&
                !/^\d/.test(firstPart)) {

                // Check if followed by numeric stats
                const hasNumericStats = parts.slice(1).some(p => /^\d+$/.test(p) || /^[\d,]+$/.test(p));

                if (hasNumericStats) {
                    // Extract just the name part (before any tabs/numbers)
                    const name = firstPart.replace(/\s+$/, '');

                    if (!homeTeam) {
                        homeTeam = name;
                    } else if (!awayTeam && name !== homeTeam) {
                        awayTeam = name;
                        break; // Found both teams
                    }
                }
            }
        }
    }

    // Second pass: if we didn't find teams, look for WIN marker
    if (!homeTeam || !awayTeam) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === 'WIN') {
                // Next two non-empty lines are home and away teams
                let foundTeams = 0;
                for (let j = i + 1; j < Math.min(i + 10, lines.length) && foundTeams < 2; j++) {
                    const teamLine = lines[j].trim();
                    if (teamLine &&
                        !teamLine.includes('Game') &&
                        !teamLine.includes('-') &&
                        !/^\d+$/.test(teamLine) &&
                        /^[A-Za-z]/.test(teamLine)) {
                        if (foundTeams === 0) {
                            if (!homeTeam) homeTeam = teamLine;
                        } else {
                            if (!awayTeam) awayTeam = teamLine;
                        }
                        foundTeams++;
                    }
                }
                break;
            }
        }
    }

    // Detect if doubles match (team names with &)
    if ((homeTeam && homeTeam.includes('&')) || (awayTeam && awayTeam.includes('&'))) {
        isDoubles = true;
    }

    return { homeTeam, awayTeam, isDoubles };
}

// Parse games from a single match section
function parseMatchSection(lines) {
    const games = [];
    let currentGame = null;
    let currentLeg = null;
    let currentLegType = null;
    let legLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect game header - each "Game X.Y - Type" is a separate leg with its own type
        const gameMatch = line.match(/Game\s+(\d+)\.(\d+)\s*-\s*(501|Cricket)\s*(SIDO|DIDO)?/i);
        if (gameMatch) {
            // Save previous leg (using its OWN type, not the new leg's type!)
            if (currentLeg && legLines.length > 0 && currentGame && currentLegType) {
                const gameType = currentLegType.toLowerCase().includes('501') ? '501' : 'cricket';
                const parsed = gameType === '501' ? parse501Leg(legLines) : parseCricketLeg(legLines);
                currentLeg.throws = parsed.throws;
                currentLeg.player_stats = calculateFinalStats(parsed.playerStats, gameType);
                // Store checkout_darts for 501 games
                if (gameType === '501' && parsed.checkout_darts) {
                    currentLeg.checkout_darts = parsed.checkout_darts;
                }
                // Capture the winner (works for both 501 and cricket)
                if (parsed.winner) {
                    currentLeg.winner = parsed.winner;
                }
                // Detect doubles by player count (4 players = doubles)
                const playerCount = Object.keys(currentLeg.player_stats || {}).length;
                if (playerCount === 4) {
                    currentLeg.isDoubles = true;
                    if (currentGame) currentGame.isDoubles = true;
                }
            }

            // NOW update to the NEW leg's type
            const setNumber = parseInt(gameMatch[1]);
            const legNumber = parseInt(gameMatch[2]);
            const legType = gameMatch[3];
            const variant = gameMatch[4] || '';
            currentLegType = legType + (variant ? ' ' + variant : '');

            // New game/set?
            if (!currentGame || currentGame.set !== setNumber) {
                if (currentGame) games.push(currentGame);
                currentGame = {
                    set: setNumber,           // Add set field
                    gameNumber: setNumber,    // Keep for backward compat
                    type: currentLegType,
                    isDoubles: false,
                    legs: []
                };
            }

            currentLeg = {
                legNumber: legNumber,
                type: currentLegType,  // Each leg tracks its own type
                throws: [],
                player_stats: {}
            };
            currentGame.legs.push(currentLeg);
            legLines = [];
            continue;
        }

        // Detect doubles
        if (line.includes('(Doubles)') && currentLeg) {
            currentLeg.isDoubles = true;
            if (currentGame) currentGame.isDoubles = true;
        }

        if (currentLeg) legLines.push(line);
    }

    // Save last leg/game
    if (currentLeg && legLines.length > 0 && currentGame) {
        const gameType = currentLegType.toLowerCase().includes('501') ? '501' : 'cricket';
        const parsed = gameType === '501' ? parse501Leg(legLines) : parseCricketLeg(legLines);
        currentLeg.throws = parsed.throws;
        currentLeg.player_stats = calculateFinalStats(parsed.playerStats, gameType);
        // Store checkout_darts for 501 games
        if (gameType === '501' && parsed.checkout_darts) {
            currentLeg.checkout_darts = parsed.checkout_darts;
        }
        // Capture the winner (works for both 501 and cricket)
        if (parsed.winner) {
            currentLeg.winner = parsed.winner;
        }
        // Detect doubles by player count (4 players = doubles)
        const playerCount = Object.keys(currentLeg.player_stats || {}).length;
        if (playerCount === 4) {
            currentLeg.isDoubles = true;
            if (currentGame) currentGame.isDoubles = true;
        }
    }
    if (currentGame) games.push(currentGame);

    // Normalize side assignments across legs within each game
    // RTF orientation can flip between legs, causing incorrect tie scores
    for (const game of games) {
        normalizeSideAssignments(game);
    }

    return games;
}

/**
 * Normalize side assignments across all legs in a game
 * Ensures the same players are always on the same side (home/away)
 * even if RTF export flips orientation between legs
 */
function normalizeSideAssignments(game) {
    if (!game.legs || game.legs.length < 2) return;

    // Get all players from first leg to establish canonical orientation
    const firstLeg = game.legs[0];
    const firstLegPlayers = firstLeg.player_stats || {};
    
    const canonicalHomePlayers = [];
    const canonicalAwayPlayers = [];
    
    for (const [player, stats] of Object.entries(firstLegPlayers)) {
        if (stats.side === 'home') {
            canonicalHomePlayers.push(player);
        } else if (stats.side === 'away') {
            canonicalAwayPlayers.push(player);
        }
    }
    
    if (canonicalHomePlayers.length === 0 && canonicalAwayPlayers.length === 0) {
        return; // No players found, can't normalize
    }

    // Check and fix each subsequent leg
    for (let i = 1; i < game.legs.length; i++) {
        const leg = game.legs[i];
        const legPlayers = leg.player_stats || {};
        
        // Count how many canonical home/away players appear on each side
        let homePlayersOnHomeSide = 0;
        let homePlayersOnAwaySide = 0;
        let awayPlayersOnHomeSide = 0;
        let awayPlayersOnAwaySide = 0;
        
        for (const [player, stats] of Object.entries(legPlayers)) {
            const isCanonicalHome = canonicalHomePlayers.includes(player);
            const isCanonicalAway = canonicalAwayPlayers.includes(player);
            
            if (stats.side === 'home') {
                if (isCanonicalHome) homePlayersOnHomeSide++;
                if (isCanonicalAway) awayPlayersOnHomeSide++;
            } else if (stats.side === 'away') {
                if (isCanonicalHome) homePlayersOnAwaySide++;
                if (isCanonicalAway) awayPlayersOnAwaySide++;
            }
        }
        
        // If more canonical home players are on away side, or more canonical away players are on home side,
        // then this leg has flipped orientation
        const isFlipped = (homePlayersOnAwaySide > homePlayersOnHomeSide) || 
                         (awayPlayersOnHomeSide > awayPlayersOnAwaySide);
        
        if (isFlipped) {
            // Flip all side assignments in this leg
            for (const stats of Object.values(legPlayers)) {
                if (stats.side === 'home') {
                    stats.side = 'away';
                } else if (stats.side === 'away') {
                    stats.side = 'home';
                }
            }
            
            // Flip throws
            if (leg.throws) {
                for (const throwData of leg.throws) {
                    if (throwData.side === 'home') {
                        throwData.side = 'away';
                    } else if (throwData.side === 'away') {
                        throwData.side = 'home';
                    }
                }
            }
            
            // Flip winner
            if (leg.winner === 'home') {
                leg.winner = 'away';
            } else if (leg.winner === 'away') {
                leg.winner = 'home';
            }
        }
    }
}

// Parse RTF file that may contain multiple matches (separated by "More Darts!")
function parseMultiMatchRTF(filePath) {
    const rtfContent = fs.readFileSync(filePath, 'utf8');
    const text = rtfToText(rtfContent);

    // Split on "More Darts!" which separates individual matches
    // The pattern may have RTF artifacts like spaces between chars
    const matchSections = text.split(/More\s*Darts\s*!/i);

    const allMatches = [];

    for (let sectionIdx = 0; sectionIdx < matchSections.length; sectionIdx++) {
        const section = matchSections[sectionIdx].trim();
        if (!section) continue;

        const lines = section.split('\n');

        // Check if this section contains any games
        const hasGames = lines.some(l => /Game\s+\d+\.\d+\s*-/.test(l));
        if (!hasGames) continue;

        // Extract metadata (home/away teams)
        const meta = extractMatchMeta(lines);

        // Parse the games
        const games = parseMatchSection(lines);

        if (games.length > 0) {
            allMatches.push({
                matchIndex: allMatches.length + 1,
                homeTeam: meta.homeTeam,
                awayTeam: meta.awayTeam,
                isDoubles: meta.isDoubles,
                games: games
            });
        }
    }

    return allMatches;
}

// Parse the entire RTF file
function parseRTFMatch(filePath) {
    const rtfContent = fs.readFileSync(filePath, 'utf8');
    const text = rtfToText(rtfContent);

    // Extract timing metadata
    const metadata = extractMatchMetadata(text);

    const matches = parseMultiMatchRTF(filePath);

    // Return games from first match with metadata
    if (matches.length === 1) {
        return { games: matches[0].games, metadata };
    }

    // If multiple matches, return all games (legacy behavior)
    // Reassign set numbers sequentially across all match sections
    const allGames = [];
    let setNumber = 1;
    for (const match of matches) {
        for (const game of match.games) {
            // Reassign the set number to be sequential across the entire match
            game.set = setNumber;
            game.gameNumber = setNumber;
            allGames.push(game);
            setNumber++;
        }
    }
    return { games: allGames, metadata };
}

// Calculate final stats
function calculateFinalStats(playerStats, gameType) {
    const finalStats = {};
    for (const [player, stats] of Object.entries(playerStats)) {
        if (gameType === '501') {
            const threeDA = stats.darts > 0 ? ((stats.points / stats.darts) * 3) : 0;
            finalStats[player] = {
                darts: stats.darts,
                points: stats.points,
                three_dart_avg: parseFloat(threeDA.toFixed(2)),
                side: stats.side
            };
        } else {
            const mpr = stats.darts > 0 ? ((stats.marks / stats.darts) * 3) : 0;
            finalStats[player] = {
                darts: stats.darts,
                marks: stats.marks,
                mpr: parseFloat(mpr.toFixed(2)),
                side: stats.side
            };
        }
    }
    return finalStats;
}

// Test parser output
function testWithVerification(filePath) {
    console.log(`\n=== Testing: ${filePath} ===\n`);
    const result = parseRTFMatch(filePath);
    const games = result.games || result;

    for (const game of games) {
        console.log(`Game ${game.gameNumber}: ${game.type} (${game.isDoubles ? 'Doubles' : 'Singles'})`);
        for (const leg of game.legs) {
            const legType = leg.type || game.type;
            const isDoubles = leg.isDoubles || game.isDoubles;
            console.log(`  Leg ${leg.legNumber} (${legType}${isDoubles ? ' Doubles' : ''}): ${leg.throws.length} throws`);

            // Group by side for team totals
            const homePlayers = Object.entries(leg.player_stats).filter(([_, s]) => s.side === 'home');
            const awayPlayers = Object.entries(leg.player_stats).filter(([_, s]) => s.side === 'away');

            if (leg.player_stats && Object.keys(leg.player_stats).length > 0) {
                const is501 = legType.toLowerCase().includes('501');

                if (is501) {
                    // Calculate team totals
                    const homeTotal = homePlayers.reduce((acc, [_, s]) => ({ darts: acc.darts + s.darts, points: acc.points + s.points }), { darts: 0, points: 0 });
                    const awayTotal = awayPlayers.reduce((acc, [_, s]) => ({ darts: acc.darts + s.darts, points: acc.points + s.points }), { darts: 0, points: 0 });
                    const home3DA = homeTotal.darts > 0 ? (homeTotal.points / homeTotal.darts * 3).toFixed(2) : 0;
                    const away3DA = awayTotal.darts > 0 ? (awayTotal.points / awayTotal.darts * 3).toFixed(2) : 0;

                    console.log(`    HOME: ${homeTotal.darts} darts, ${homeTotal.points} pts, ${home3DA} 3DA`);
                    homePlayers.forEach(([name, s]) => console.log(`      - ${name}: ${s.darts}d, ${s.points}pts, ${s.three_dart_avg.toFixed(2)}`));
                    console.log(`    AWAY: ${awayTotal.darts} darts, ${awayTotal.points} pts, ${away3DA} 3DA`);
                    awayPlayers.forEach(([name, s]) => console.log(`      - ${name}: ${s.darts}d, ${s.points}pts, ${s.three_dart_avg.toFixed(2)}`));
                } else {
                    // Cricket
                    const homeTotal = homePlayers.reduce((acc, [_, s]) => ({ darts: acc.darts + s.darts, marks: acc.marks + s.marks }), { darts: 0, marks: 0 });
                    const awayTotal = awayPlayers.reduce((acc, [_, s]) => ({ darts: acc.darts + s.darts, marks: acc.marks + s.marks }), { darts: 0, marks: 0 });
                    const homeMPR = homeTotal.darts > 0 ? (homeTotal.marks / homeTotal.darts * 3).toFixed(2) : 0;
                    const awayMPR = awayTotal.darts > 0 ? (awayTotal.marks / awayTotal.darts * 3).toFixed(2) : 0;

                    console.log(`    HOME: ${homeTotal.darts} darts, ${homeTotal.marks} marks, ${homeMPR} MPR`);
                    homePlayers.forEach(([name, s]) => console.log(`      - ${name}: ${s.darts}d, ${s.marks}m, ${s.mpr.toFixed(2)}`));
                    console.log(`    AWAY: ${awayTotal.darts} darts, ${awayTotal.marks} marks, ${awayMPR} MPR`);
                    awayPlayers.forEach(([name, s]) => console.log(`      - ${name}: ${s.darts}d, ${s.marks}m, ${s.mpr.toFixed(2)}`));
                }
            }
        }
        console.log('');
    }

    return games;
}

// Utility function to adjust cricket dart count for closeout
// Call this after parsing when you know the winner and closeout darts
// playerStats: the player_stats object from parsed leg
// winnerSide: 'home' or 'away'
// closeoutDarts: 1, 2, or 3 (actual darts used to close)
function adjustCricketCloseoutDarts(playerStats, winnerSide, closeoutDarts) {
    if (!playerStats || !winnerSide || closeoutDarts >= 3) return playerStats;

    const dartAdjustment = 3 - closeoutDarts;

    // Find the winner's player(s) and adjust their dart count
    for (const [player, stats] of Object.entries(playerStats)) {
        if (stats.side === winnerSide) {
            // In doubles, both players on winning side might need adjustment
            // For now, adjust all players on winning side proportionally
            // This is a simplification - ideally we'd track who threw the closing darts
            stats.darts -= dartAdjustment;
            // Recalculate MPR if marks exist
            if (stats.marks !== undefined && stats.darts > 0) {
                stats.mpr = parseFloat(((stats.marks / stats.darts) * 3).toFixed(2));
            }
            break; // Only adjust one player (the one who closed) in singles
        }
    }

    return playerStats;
}

// Run test
const testFile = process.argv[2] || path.join(__dirname, 'dc', 'domjosh.rtf');
if (fs.existsSync(testFile)) {
    testWithVerification(testFile);
}

module.exports = { parseRTFMatch, parseMultiMatchRTF, rtfToText, calculateFinalStats, parseHitNotation, adjustCricketCloseoutDarts };
