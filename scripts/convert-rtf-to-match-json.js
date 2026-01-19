/**
 * Convert DartConnect RTF files to accurate JSON match data
 * This parses RTF exports and produces:
 * 1. Accurate turn-by-turn throws data
 * 2. Correct player stats per leg
 * 3. Proper aggregated stats
 */

const fs = require('fs');
const path = require('path');

// Player name to ID mapping
const playerNameToId = {
    'Matt Pagel': 'maH2vUZbuVLBbBQwoIqW',
    'Joe Peters': 'pERxbhcN3VNAvu6wFN9o',
    'John Linden': '06IoctkB8mTTSPBGRbu5',
    'Donnie Pagel': 'X2DMb9bP4Q8fy9yr5Fam',
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
    'Nick M': 'yGcBLDcTwgHtWmZEg3TG',
    'Cory Jacobs': '8f52A1dwRB4eIU5UyQZo',
    'Cory J': '8f52A1dwRB4eIU5UyQZo',
    'Dillon Ulisses': 'dFmalrT5BMdaTOUUVTOZ',
    'Dillon U': 'dFmalrT5BMdaTOUUVTOZ',
    'Dan Partlo': 'xtgPtBokzUj3nli61AKq',
    'Joe Donley': 'JxFXNWdd2dFMja3rI0jf',
    'Kevin Mckelvey': 'Gmxl5I2CtVXYns4b4AeU',
    'Danny Russano': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Danny R': 'gmZ8d6De0ZlqPVV0V9Q6',
    'Chris Russano': 'NJgDQ0d4RzpDVuCnqYZO',
    'Chris R': 'NJgDQ0d4RzpDVuCnqYZO',
    'Eric Duale': 'NCeaIaMXsXVN135pX91L',
    'John Ragnoni': 'SwnH8GUBmrcdmOAs07Vp',
    'Marc Tate': 'ZwdiN0qfmIY5MMCOLJps',
    'David Brunner': 'ctnV5Je72HAIyVpE5zjS',
    'Josh Kelly': '34GDgRRFk0uFmOvyykHE',
    'Derek Fess': 'vVR4AOITXYzhR2H4GqzI'
};

// Known player names for validation
const knownPlayers = new Set(Object.keys(playerNameToId));

// Strip RTF formatting
function stripRtf(rtfContent) {
    let text = rtfContent;

    // Normalize line endings first
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');

    // Remove RTF header section (everything in first {...})
    // Keep content after the header
    const headerEnd = text.indexOf('}', text.indexOf('{\\fonttbl'));
    if (headerEnd > 0) {
        // Find where actual content starts (after header blocks)
        let contentStart = 0;
        let braceDepth = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') braceDepth++;
            else if (text[i] === '}') {
                braceDepth--;
                if (braceDepth === 0 && i > headerEnd) {
                    contentStart = i + 1;
                    break;
                }
            }
        }
    }

    // Replace RTF control codes in order of specificity
    // \par = paragraph break -> newline
    text = text.replace(/\\par[ ]?/g, '\n');
    // \line = line break -> newline
    text = text.replace(/\\line[ ]?/g, '\n');
    // \tab = tab character (only eat trailing space, not newlines)
    text = text.replace(/\\tab[ ]?/g, '\t');

    // Remove font tables and color tables
    text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
    text = text.replace(/\{\\colortbl[^}]*\}/g, '');
    text = text.replace(/\{\\\*\\[^}]*\}/g, '');

    // Remove other common RTF control codes
    text = text.replace(/\\f\d+\s?/g, '');      // font switches like \f0 \f1
    text = text.replace(/\\fs\d+\s?/g, '');     // font size like \fs22
    text = text.replace(/\\lang\d+\s?/g, '');   // language
    text = text.replace(/\\uc\d+\s?/g, '');     // unicode char count
    text = text.replace(/\\pard[^\\]*/g, '');   // paragraph defaults
    text = text.replace(/\\sa\d+\s?/g, '');     // space after
    text = text.replace(/\\sl\d+\s?/g, '');     // space line
    text = text.replace(/\\slmult\d+\s?/g, ''); // space line mult
    text = text.replace(/\\viewkind\d+\s?/g, '');
    text = text.replace(/\\[a-z]+\d*\s?/gi, ''); // catch remaining control codes

    // Remove braces
    text = text.replace(/[{}]/g, '');

    // Handle unicode (the empty set symbol u8709)
    text = text.replace(/u8709\??/g, '∅');

    // Clean up: remove header junk that might remain
    text = text.replace(/^.*Cambria Math;[\s\S]*?\\uc1\s*/m, '');
    text = text.replace(/rtf1.*?\\uc1\s*/g, '');
    text = text.replace(/^\s*\*.*$/gm, '');

    // Clean up multiple consecutive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    text = text.split('\n').map(line => line.trimEnd()).join('\n');

    return text.trim();
}

// Check if string is a player name
function isPlayerName(str) {
    if (!str) return false;
    str = str.trim();
    if (knownPlayers.has(str)) return true;
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(str)) return true;
    if (/^[A-Z][a-z]+\s+[A-Z]$/.test(str)) return true;
    return false;
}

// Count cricket marks from string like "T20, S19x2"
function countMarks(markStr) {
    if (!markStr || markStr === '∅' || markStr === 'Start' || markStr === 'X') return 0;
    let total = 0;
    const parts = markStr.split(/,\s*/);
    for (const part of parts) {
        if (part.includes('T')) total += 3;
        else if (part.includes('D')) total += 2;
        else if (part.includes('S')) {
            const multMatch = part.match(/x(\d)/);
            total += multMatch ? parseInt(multMatch[1]) : 1;
        }
    }
    return total;
}

// Parse a 501 game from lines
function parse501Game(lines, setNum, gameNum, legNum) {
    const game = {
        set: setNum,
        game: gameNum,
        leg: legNum,
        format: '501',
        throws: [],
        homePlayers: [],
        awayPlayers: [],
        winner: null,
        checkoutDarts: 3,
        playerStats: {}
    };

    // Find DO marker for checkout darts
    for (const line of lines) {
        const doMatch = line.match(/DO\s*\((\d)\)/);
        if (doMatch) {
            game.checkoutDarts = parseInt(doMatch[1]);
            break;
        }
    }

    // Parse each line as a round
    for (const line of lines) {
        // Skip headers and metadata
        if (line.includes('Player') && line.includes('Turn')) continue;
        if (line.includes('Dart Avg')) continue;
        if (line.includes('Darts:') && !line.includes('\t')) continue;
        if (!line.trim()) continue;

        const parts = line.split('\t').map(p => p.trim()).filter(p => p);
        if (parts.length < 3) continue;

        // Format: [highlight] PlayerName Score Remaining Round [Remaining Score PlayerName [highlight]]
        // Or for final round when away wins: Round Remaining Score PlayerName DO

        let idx = 0;
        let homePlayer = null, homeScore = 0, homeRemaining = 0;
        let awayPlayer = null, awayScore = 0, awayRemaining = 0;
        let round = 0;
        let hasHomeCheckout = false, hasAwayCheckout = false;

        // Check for DO marker
        const hasDO = line.includes('DO');

        // Skip highlight numbers at start (100, 140, 180, etc.)
        while (idx < parts.length && /^\d+$/.test(parts[idx]) && parseInt(parts[idx]) >= 50 && parseInt(parts[idx]) <= 180) {
            idx++;
        }

        // Check for DO at start (home checkout)
        if (parts[idx] === 'DO' || (parts[idx] && parts[idx].startsWith('DO'))) {
            hasHomeCheckout = true;
            idx++;
        }

        // Try to parse home player
        if (idx < parts.length && isPlayerName(parts[idx])) {
            homePlayer = parts[idx];
            idx++;

            // Score (number or X for bust)
            if (idx < parts.length && (/^\d+$/.test(parts[idx]) || parts[idx] === 'X')) {
                homeScore = parts[idx] === 'X' ? 0 : parseInt(parts[idx]);
                idx++;
            }

            // Remaining
            if (idx < parts.length && /^\d+$/.test(parts[idx])) {
                homeRemaining = parseInt(parts[idx]);
                if (homeRemaining === 0) hasHomeCheckout = true;
                idx++;
            }

            // Round
            if (idx < parts.length && /^\d+$/.test(parts[idx])) {
                round = parseInt(parts[idx]);
                idx++;
            }
        } else if (idx < parts.length && /^\d+$/.test(parts[idx]) && parseInt(parts[idx]) <= 50) {
            // This might be a round-first format (away-only checkout line)
            round = parseInt(parts[idx]);
            idx++;

            // Home remaining (unchanged from previous)
            if (idx < parts.length && /^\d+$/.test(parts[idx])) {
                homeRemaining = parseInt(parts[idx]);
                idx++;
            }
        }

        // Parse away side
        if (idx < parts.length) {
            // Away remaining
            if (/^\d+$/.test(parts[idx])) {
                awayRemaining = parseInt(parts[idx]);
                if (awayRemaining === 0) hasAwayCheckout = true;
                idx++;
            }

            // Away score
            if (idx < parts.length && (/^\d+$/.test(parts[idx]) || parts[idx] === 'X')) {
                awayScore = parts[idx] === 'X' ? 0 : parseInt(parts[idx]);
                idx++;
            }

            // Away player
            if (idx < parts.length && isPlayerName(parts[idx])) {
                awayPlayer = parts[idx];
                idx++;
            }

            // Check for DO at end (away checkout)
            if (idx < parts.length && (parts[idx] === 'DO' || parts[idx].startsWith('DO'))) {
                hasAwayCheckout = true;
            }
        }

        // Record throws
        if (homePlayer && round > 0) {
            if (!game.homePlayers.includes(homePlayer)) game.homePlayers.push(homePlayer);

            const isCheckout = hasHomeCheckout && homeRemaining === 0 && hasDO;
            game.throws.push({
                round,
                side: 'home',
                player: homePlayer,
                score: homeScore,
                remaining: homeRemaining,
                darts: isCheckout ? game.checkoutDarts : 3,
                isCheckout
            });

            if (!game.playerStats[homePlayer]) {
                game.playerStats[homePlayer] = { darts: 0, points: 0, turns: 0 };
            }
            game.playerStats[homePlayer].darts += isCheckout ? game.checkoutDarts : 3;
            game.playerStats[homePlayer].points += homeScore;
            game.playerStats[homePlayer].turns++;

            if (isCheckout) {
                game.playerStats[homePlayer].checkout = homeScore;
                game.playerStats[homePlayer].checkout_darts = game.checkoutDarts;
                game.winner = 'home';
            }
        }

        if (awayPlayer && round > 0) {
            if (!game.awayPlayers.includes(awayPlayer)) game.awayPlayers.push(awayPlayer);

            const isCheckout = hasAwayCheckout && awayRemaining === 0 && hasDO;
            game.throws.push({
                round,
                side: 'away',
                player: awayPlayer,
                score: awayScore,
                remaining: awayRemaining,
                darts: isCheckout ? game.checkoutDarts : 3,
                isCheckout
            });

            if (!game.playerStats[awayPlayer]) {
                game.playerStats[awayPlayer] = { darts: 0, points: 0, turns: 0 };
            }
            game.playerStats[awayPlayer].darts += isCheckout ? game.checkoutDarts : 3;
            game.playerStats[awayPlayer].points += awayScore;
            game.playerStats[awayPlayer].turns++;

            if (isCheckout) {
                game.playerStats[awayPlayer].checkout = awayScore;
                game.playerStats[awayPlayer].checkout_darts = game.checkoutDarts;
                game.winner = 'away';
            }
        }
    }

    return game;
}

// Parse a Cricket game from lines
function parseCricketGame(lines, setNum, gameNum, legNum) {
    const game = {
        set: setNum,
        game: gameNum,
        leg: legNum,
        format: 'Cricket',
        throws: [],
        homePlayers: [],
        awayPlayers: [],
        winner: null,
        playerStats: {}
    };

    let lastHomeScore = 0, lastAwayScore = 0;

    for (const line of lines) {
        // Skip headers and metadata
        if (line.includes('Player') && line.includes('Turn')) continue;
        if (line.includes('Dart Avg') || line.includes('Darts:')) continue;
        if (!line.trim()) continue;

        const parts = line.split('\t').map(p => p.trim()).filter(p => p);
        if (parts.length < 3) continue;

        let idx = 0;
        let homePlayer = null, homeMarks = 0, homeScore = 0;
        let awayPlayer = null, awayMarks = 0, awayScore = 0;
        let round = 0;

        // Skip highlight at start (like "5M", "3B", "6M", etc.)
        while (idx < parts.length && /^\d+[MB]?$/.test(parts[idx])) {
            idx++;
        }

        // Home player
        if (idx < parts.length && isPlayerName(parts[idx])) {
            homePlayer = parts[idx];
            idx++;

            // Marks string (like "T20, S19x2" or "∅")
            if (idx < parts.length) {
                homeMarks = countMarks(parts[idx]);
                idx++;
            }

            // Score or "Start"
            if (idx < parts.length && (/^\d+$/.test(parts[idx]) || parts[idx] === 'Start')) {
                homeScore = parts[idx] === 'Start' ? 0 : parseInt(parts[idx]);
                lastHomeScore = homeScore;
                idx++;
            }

            // Round
            if (idx < parts.length && /^\d+$/.test(parts[idx])) {
                round = parseInt(parts[idx]);
                idx++;
            }
        } else if (idx < parts.length && /^\d+$/.test(parts[idx]) && parseInt(parts[idx]) <= 50) {
            // Round-first format (away wins at end)
            round = parseInt(parts[idx]);
            idx++;
        }

        // Away side
        if (idx < parts.length) {
            // Away score first (or Start)
            if (/^\d+$/.test(parts[idx]) || parts[idx] === 'Start') {
                awayScore = parts[idx] === 'Start' ? 0 : parseInt(parts[idx]);
                lastAwayScore = awayScore;
                idx++;
            }

            // Away marks
            if (idx < parts.length) {
                awayMarks = countMarks(parts[idx]);
                idx++;
            }

            // Away player
            if (idx < parts.length && isPlayerName(parts[idx])) {
                awayPlayer = parts[idx];
                idx++;
            }
        }

        // Record throws
        if (homePlayer && round > 0) {
            if (!game.homePlayers.includes(homePlayer)) game.homePlayers.push(homePlayer);

            game.throws.push({
                round,
                side: 'home',
                player: homePlayer,
                marks: homeMarks,
                score: homeScore,
                darts: 3
            });

            if (!game.playerStats[homePlayer]) {
                game.playerStats[homePlayer] = { darts: 0, marks: 0, rounds: 0 };
            }
            game.playerStats[homePlayer].darts += 3;
            game.playerStats[homePlayer].marks += homeMarks;
            game.playerStats[homePlayer].rounds++;
        }

        if (awayPlayer && round > 0) {
            if (!game.awayPlayers.includes(awayPlayer)) game.awayPlayers.push(awayPlayer);

            game.throws.push({
                round,
                side: 'away',
                player: awayPlayer,
                marks: awayMarks,
                score: awayScore,
                darts: 3
            });

            if (!game.playerStats[awayPlayer]) {
                game.playerStats[awayPlayer] = { darts: 0, marks: 0, rounds: 0 };
            }
            game.playerStats[awayPlayer].darts += 3;
            game.playerStats[awayPlayer].marks += awayMarks;
            game.playerStats[awayPlayer].rounds++;
        }
    }

    // Determine winner from final scores
    game.winner = lastHomeScore >= lastAwayScore ? 'home' : 'away';

    return game;
}

// Parse full RTF file
function parseRtfFile(rtfContent) {
    const text = stripRtf(rtfContent);
    const lines = text.split('\n');

    const match = {
        date: null,
        games: [],
        homePlayers: new Set(),
        awayPlayers: new Set()
    };

    // Extract date
    const dateMatch = text.match(/Date:\s*([^\t\n]+)/);
    if (dateMatch) match.date = dateMatch[1].trim();

    let currentSet = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Detect set
        const setMatch = line.match(/^Set\s+(\d+)/);
        if (setMatch) {
            currentSet = parseInt(setMatch[1]);
            i++;
            continue;
        }

        // Detect game
        const gameMatch = line.match(/Game\s+(\d+)\.(\d+)\s*-\s*(501|Cricket)/i);
        if (gameMatch) {
            const gameNum = parseInt(gameMatch[1]);
            const legNum = parseInt(gameMatch[2]);
            const format = gameMatch[3].toLowerCase().includes('501') ? '501' : 'Cricket';

            // Collect lines until next game/set
            const gameLines = [];
            let j = i + 1;
            while (j < lines.length) {
                if (lines[j].match(/^Set\s+\d+/) || lines[j].match(/Game\s+\d+\.\d+\s*-/)) {
                    break;
                }
                gameLines.push(lines[j]);
                j++;
            }

            const game = format === '501'
                ? parse501Game(gameLines, currentSet, gameNum, legNum)
                : parseCricketGame(gameLines, currentSet, gameNum, legNum);

            match.games.push(game);

            game.homePlayers.forEach(p => match.homePlayers.add(p));
            game.awayPlayers.forEach(p => match.awayPlayers.add(p));

            i = j;
            continue;
        }

        i++;
    }

    match.homePlayers = Array.from(match.homePlayers);
    match.awayPlayers = Array.from(match.awayPlayers);

    return match;
}

// Calculate aggregated player stats from parsed match
function calculateAggregatedStats(match) {
    const stats = {};

    for (const game of match.games) {
        const format = game.format;
        const winner = game.winner;

        for (const [playerName, pStats] of Object.entries(game.playerStats)) {
            const playerId = playerNameToId[playerName];
            if (!playerId) {
                console.log(`  WARNING: No ID for player "${playerName}"`);
                continue;
            }

            if (!stats[playerId]) {
                stats[playerId] = {
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

            const s = stats[playerId];
            const isHome = game.homePlayers.includes(playerName);
            const playerWon = (isHome && winner === 'home') || (!isHome && winner === 'away');

            if (format === '501') {
                s.x01_legs_played++;
                if (playerWon) s.x01_legs_won++;
                s.x01_total_darts += pStats.darts;
                s.x01_total_points += pStats.points;

                if (pStats.checkout) {
                    s.x01_checkouts_hit++;
                    s.x01_checkout_totals += pStats.checkout;
                    if (pStats.checkout > s.x01_high_checkout) {
                        s.x01_high_checkout = pStats.checkout;
                    }
                }

                // Calculate first 9 and tons from throws
                const playerThrows = game.throws.filter(t => t.player === playerName);
                let turnCount = 0;
                for (const t of playerThrows) {
                    turnCount++;
                    if (turnCount <= 3) {
                        s.x01_first9_darts += t.darts;
                        s.x01_first9_points += t.score;
                    }

                    if (!t.isCheckout) {
                        if (t.score > s.x01_high_turn) s.x01_high_turn = t.score;
                    }

                    if (t.score === 180) s.x01_ton_80++;
                    else if (t.score >= 140) s.x01_ton_40++;
                    else if (t.score >= 100) s.x01_tons++;
                }
            } else {
                s.cricket_legs_played++;
                if (playerWon) s.cricket_legs_won++;
                s.cricket_total_darts += pStats.darts;
                s.cricket_total_marks += pStats.marks;
                s.cricket_total_rounds += pStats.rounds;
            }
        }
    }

    // Calculate derived stats
    for (const s of Object.values(stats)) {
        if (s.x01_total_darts > 0) {
            s.x01_3da = Math.round((s.x01_total_points / s.x01_total_darts) * 3 * 100) / 100;
            s.x01_three_dart_avg = s.x01_3da;
        }
        if (s.x01_first9_darts > 0) {
            s.x01_first9_avg = Math.round((s.x01_first9_points / s.x01_first9_darts) * 3 * 100) / 100;
        }
        if (s.x01_checkouts_hit > 0) {
            s.x01_avg_finish = Math.round((s.x01_checkout_totals / s.x01_checkouts_hit) * 100) / 100;
        }
        if (s.cricket_total_rounds > 0) {
            s.cricket_mpr = Math.round((s.cricket_total_marks / s.cricket_total_rounds) * 100) / 100;
        }

        // Ton totals for leaderboard
        s.x01_tons_100 = s.x01_tons;
        s.x01_tons_140 = s.x01_ton_40;
        s.x01_tons_180 = s.x01_ton_80;
        s.x01_ton_forties = s.x01_ton_40 + s.x01_ton_80;
        s.x01_ton_eighties = s.x01_ton_80;
    }

    return stats;
}

// Convert parsed match to JSON format for match details
function convertToMatchJson(parsedMatch, matchId, leagueId, homeTeam, awayTeam) {
    const games = [];
    let gameNumber = 0;
    let homeWins = 0, awayWins = 0;

    // Group legs into games (based on set number)
    const gameGroups = {};
    for (const leg of parsedMatch.games) {
        const key = leg.set;
        if (!gameGroups[key]) {
            gameGroups[key] = [];
        }
        gameGroups[key].push(leg);
    }

    for (const [setNum, legs] of Object.entries(gameGroups)) {
        gameNumber++;

        const firstLeg = legs[0];
        const formats = [...new Set(legs.map(l => l.format))];
        const gameType = formats.length > 1 ? 'mixed' : (formats[0] === '501' ? 'x01' : 'cricket');
        const gameFormat = formats.length > 1 ? '501/cricket' : formats[0];

        let homeLegs = 0, awayLegs = 0;
        const gameLegData = [];

        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];

            if (leg.winner === 'home') homeLegs++;
            else if (leg.winner === 'away') awayLegs++;

            const legData = {
                leg_number: i + 1,
                format: leg.format === '501' ? '501' : 'cricket',
                winner: leg.winner,
                home_stats: {},
                away_stats: {},
                player_stats: {},
                throws: leg.throws
            };

            if (leg.format === '501') {
                const homeDarts = leg.throws.filter(t => t.side === 'home').reduce((sum, t) => sum + t.darts, 0);
                const homePoints = leg.throws.filter(t => t.side === 'home').reduce((sum, t) => sum + t.score, 0);
                const awayDarts = leg.throws.filter(t => t.side === 'away').reduce((sum, t) => sum + t.darts, 0);
                const awayPoints = leg.throws.filter(t => t.side === 'away').reduce((sum, t) => sum + t.score, 0);

                legData.home_stats = {
                    starting_score: 501,
                    darts_thrown: homeDarts,
                    three_dart_avg: homeDarts > 0 ? Math.round((homePoints / homeDarts) * 3 * 100) / 100 : 0
                };
                legData.away_stats = {
                    starting_score: 501,
                    darts_thrown: awayDarts,
                    three_dart_avg: awayDarts > 0 ? Math.round((awayPoints / awayDarts) * 3 * 100) / 100 : 0
                };

                const checkoutThrow = leg.throws.find(t => t.isCheckout);
                if (checkoutThrow) {
                    if (checkoutThrow.side === 'home') {
                        legData.home_stats.checkout = checkoutThrow.score;
                        legData.home_stats.checkout_darts = checkoutThrow.darts;
                    } else {
                        legData.away_stats.checkout = checkoutThrow.score;
                        legData.away_stats.checkout_darts = checkoutThrow.darts;
                    }
                }

                // Add remaining for losing side
                const lastHomeThrow = leg.throws.filter(t => t.side === 'home').pop();
                const lastAwayThrow = leg.throws.filter(t => t.side === 'away').pop();
                if (leg.winner === 'home' && lastAwayThrow) {
                    legData.away_stats.remaining = lastAwayThrow.remaining;
                } else if (leg.winner === 'away' && lastHomeThrow) {
                    legData.home_stats.remaining = lastHomeThrow.remaining;
                }
            } else {
                // Cricket
                const homeMarks = leg.throws.filter(t => t.side === 'home').reduce((sum, t) => sum + t.marks, 0);
                const homeDarts = leg.throws.filter(t => t.side === 'home').reduce((sum, t) => sum + t.darts, 0);
                const homeRounds = leg.throws.filter(t => t.side === 'home').length;
                const awayMarks = leg.throws.filter(t => t.side === 'away').reduce((sum, t) => sum + t.marks, 0);
                const awayDarts = leg.throws.filter(t => t.side === 'away').reduce((sum, t) => sum + t.darts, 0);
                const awayRounds = leg.throws.filter(t => t.side === 'away').length;

                const lastHomeThrow = leg.throws.filter(t => t.side === 'home').pop();
                const lastAwayThrow = leg.throws.filter(t => t.side === 'away').pop();

                legData.home_stats = {
                    marks: homeMarks,
                    darts_thrown: homeDarts,
                    mpr: homeRounds > 0 ? Math.round((homeMarks / homeRounds) * 10) / 10 : 0,
                    points: lastHomeThrow ? lastHomeThrow.score : 0
                };
                legData.away_stats = {
                    marks: awayMarks,
                    darts_thrown: awayDarts,
                    mpr: awayRounds > 0 ? Math.round((awayMarks / awayRounds) * 10) / 10 : 0,
                    points: lastAwayThrow ? lastAwayThrow.score : 0
                };
            }

            // Add player stats
            for (const [playerName, pStats] of Object.entries(leg.playerStats)) {
                if (leg.format === '501') {
                    legData.player_stats[playerName] = {
                        darts: pStats.darts,
                        points: pStats.points
                    };
                    if (pStats.checkout) {
                        legData.player_stats[playerName].checkout = pStats.checkout;
                        legData.player_stats[playerName].checkout_darts = pStats.checkout_darts;
                    }
                } else {
                    const playerThrows = leg.throws.filter(t => t.player === playerName);
                    const playerRounds = playerThrows.length;
                    legData.player_stats[playerName] = {
                        darts: pStats.darts,
                        marks: pStats.marks,
                        mpr: playerRounds > 0 ? Math.round((pStats.marks / playerRounds) * 100) / 100 : 0
                    };
                }
            }

            gameLegData.push(legData);
        }

        const gameWinner = homeLegs > awayLegs ? 'home' : 'away';
        if (gameWinner === 'home') homeWins++;
        else awayWins++;

        games.push({
            game_number: gameNumber,
            type: gameType,
            format: gameFormat,
            home_players: firstLeg.homePlayers,
            away_players: firstLeg.awayPlayers,
            result: {
                home_legs: homeLegs,
                away_legs: awayLegs
            },
            winner: gameWinner,
            legs: gameLegData
        });
    }

    const totalDarts = parsedMatch.games.reduce((sum, g) =>
        sum + g.throws.reduce((s, t) => s + t.darts, 0), 0);
    const totalLegs = parsedMatch.games.length;

    return {
        matchId,
        leagueId,
        matchData: {
            home_team: homeTeam,
            away_team: awayTeam,
            final_score: {
                home: homeWins,
                away: awayWins
            },
            total_darts: totalDarts,
            total_legs: totalLegs,
            games
        }
    };
}

// Merge stats helper
function mergeStats(target, source) {
    const sumFields = [
        'x01_legs_played', 'x01_legs_won', 'x01_total_darts', 'x01_total_points',
        'x01_first9_darts', 'x01_first9_points', 'x01_tons', 'x01_ton_40', 'x01_ton_80',
        'x01_checkouts_hit', 'x01_checkout_totals',
        'cricket_legs_played', 'cricket_legs_won', 'cricket_total_darts',
        'cricket_total_marks', 'cricket_total_rounds'
    ];
    for (const f of sumFields) {
        target[f] = (target[f] || 0) + (source[f] || 0);
    }
    if ((source.x01_high_turn || 0) > (target.x01_high_turn || 0)) {
        target.x01_high_turn = source.x01_high_turn;
    }
    if ((source.x01_high_checkout || 0) > (target.x01_high_checkout || 0)) {
        target.x01_high_checkout = source.x01_high_checkout;
    }
}

// Main execution
const matchFiles = [
    { file: 'pagel v pagel MATCH.rtf', homeTeam: 'Team 10', awayTeam: 'Team 5', matchId: 'pagel-v-pagel' },
    { file: 'yasenchak v kull.rtf', homeTeam: 'Team 9', awayTeam: 'Team 6', matchId: 'yasenchak-v-kull' },
    { file: 'partlo v olschansky.rtf', homeTeam: 'Team 8', awayTeam: 'Team 3', matchId: 'partlo-v-olschansky' },
    { file: 'mezlak v russano.rtf', homeTeam: 'Team 7', awayTeam: 'Team 4', matchId: 'mezlak-v-russano' },
    { file: 'massimiani v ragnoni.rtf', homeTeam: 'Team 1', awayTeam: 'Team 2', matchId: 'massimiani-v-ragnoni' }
];

const baseDir = path.join(__dirname, '../temp/trips league');
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';

const allStats = {};
const allMatches = [];

console.log('Processing RTF match files...\n');

for (const matchInfo of matchFiles) {
    const filePath = path.join(baseDir, matchInfo.file);

    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${matchInfo.file} (not found)`);
        continue;
    }

    console.log(`Processing: ${matchInfo.file}`);

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = parseRtfFile(content);

        // Count total throws
        const totalThrows = parsed.games.reduce((sum, g) => sum + g.throws.length, 0);
        console.log(`  Found ${parsed.games.length} legs, ${totalThrows} throws, ${parsed.homePlayers.length + parsed.awayPlayers.length} players`);

        // Convert to match JSON
        const matchJson = convertToMatchJson(parsed, matchInfo.matchId, leagueId, matchInfo.homeTeam, matchInfo.awayTeam);
        allMatches.push(matchJson);

        // Calculate stats
        const stats = calculateAggregatedStats(parsed);

        // Merge into all stats
        for (const [playerId, pStats] of Object.entries(stats)) {
            if (!allStats[playerId]) {
                allStats[playerId] = { ...pStats };
            } else {
                mergeStats(allStats[playerId], pStats);
            }
        }

        // Output individual match JSON
        const matchOutputPath = path.join(__dirname, `${matchInfo.matchId}-match.json`);
        fs.writeFileSync(matchOutputPath, JSON.stringify(matchJson, null, 2));
        console.log(`  Saved: ${matchInfo.matchId}-match.json`);

    } catch (err) {
        console.log(`  ERROR: ${err.message}`);
        console.log(err.stack);
    }
}

// Recalculate derived stats for merged data
console.log('\nCalculating final aggregated stats...\n');

for (const s of Object.values(allStats)) {
    if (s.x01_total_darts > 0) {
        s.x01_3da = Math.round((s.x01_total_points / s.x01_total_darts) * 3 * 100) / 100;
        s.x01_three_dart_avg = s.x01_3da;
    }
    if (s.x01_first9_darts > 0) {
        s.x01_first9_avg = Math.round((s.x01_first9_points / s.x01_first9_darts) * 3 * 100) / 100;
    }
    if (s.x01_checkouts_hit > 0) {
        s.x01_avg_finish = Math.round((s.x01_checkout_totals / s.x01_checkouts_hit) * 100) / 100;
    }
    if (s.cricket_total_rounds > 0) {
        s.cricket_mpr = Math.round((s.cricket_total_marks / s.cricket_total_rounds) * 100) / 100;
    }
    s.x01_tons_100 = s.x01_tons;
    s.x01_tons_140 = s.x01_ton_40;
    s.x01_tons_180 = s.x01_ton_80;
    s.x01_ton_forties = s.x01_ton_40 + s.x01_ton_80;
    s.x01_ton_eighties = s.x01_ton_80;

    console.log(`${s.player_name}: 501 ${s.x01_3da || 0} avg (${s.x01_total_darts} darts, ${s.x01_legs_played} legs), Cricket ${s.cricket_mpr || 0} MPR (${s.cricket_legs_played} legs)`);
}

// Save aggregated stats
const statsOutputPath = path.join(__dirname, 'aggregated-stats-new.json');
fs.writeFileSync(statsOutputPath, JSON.stringify(allStats, null, 2));
console.log(`\nSaved aggregated stats: aggregated-stats-new.json`);

// Save all matches combined
const allMatchesPath = path.join(__dirname, 'all-matches.json');
fs.writeFileSync(allMatchesPath, JSON.stringify(allMatches, null, 2));
console.log(`Saved all matches: all-matches.json`);

console.log('\nDone!');
