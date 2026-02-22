/**
 * Final robust import for Weeks 1-3
 */
const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Comprehensive mapping of player names to their base team and official position
const PLAYER_CONFIG = {
    'Matt Pagel': { team: 'M. Pagel', pos: 'p1' },
    'Joe Peters': { team: 'M. Pagel', pos: 'p2' },
    'John Linden': { team: 'M. Pagel', pos: 'p3' },
    'Dave Bonness': { team: 'M. Pagel', pos: 'p2' },

    'Donnie Pagel': { team: 'D. Pagel', pos: 'p1' },
    'Christian Ketchum': { team: 'D. Pagel', pos: 'p2' },
    'Christian Ketchem': { team: 'D. Pagel', pos: 'p2' },
    'Jenn M': { team: 'D. Pagel', pos: 'p3' },
    'Jenn Malek': { team: 'D. Pagel', pos: 'p3' },
    'Jennifer Malek': { team: 'D. Pagel', pos: 'p3' },
    'Matt Wentz': { team: 'D. Pagel', pos: 'p2' },

    'Nathan Kull': { team: 'N. Kull', pos: 'p1' },
    'Nate Kull': { team: 'N. Kull', pos: 'p1' },
    'Michael Jarvis': { team: 'N. Kull', pos: 'p2' },
    'Stephanie Kull': { team: 'N. Kull', pos: 'p3' },
    'Steph Kull': { team: 'N. Kull', pos: 'p3' },

    'Kevin Yasenchak': { team: 'K. Yasenchak', pos: 'p1' },
    'Kevin Y': { team: 'K. Yasenchak', pos: 'p1' },
    'Brian Smith': { team: 'K. Yasenchak', pos: 'p2' },
    'Brian S': { team: 'K. Yasenchak', pos: 'p2' },
    'Cesar Andino': { team: 'K. Yasenchak', pos: 'p3' },
    'Cesar A': { team: 'K. Yasenchak', pos: 'p3' },

    'Dan Partlo': { team: 'D. Partlo', pos: 'p1' },
    'Joe Donley': { team: 'D. Partlo', pos: 'p2' },
    'Kevin McKelvey': { team: 'D. Partlo', pos: 'p3' },
    'Kevin Mckelvey': { team: 'D. Partlo', pos: 'p3' },

    'Eddie Olschansky': { team: 'E. O', pos: 'p1' },
    'Eddie O': { team: 'E. O', pos: 'p1' },
    'Eddie Olschanskey': { team: 'E. O', pos: 'p1' },
    'Jeff Boss': { team: 'E. O', pos: 'p2' },
    'Michael Gonzalez': { team: 'E. O', pos: 'p3' },
    'Mike Gonzalez': { team: 'E. O', pos: 'p3' },
    'Mike Gonzales': { team: 'E. O', pos: 'p3' },
    'Mike Gonz': { team: 'E. O', pos: 'p3' },


    'Tony Massimiani': { team: 'neon nightmares', pos: 'p1' },
    'Chris Benco': { team: 'neon nightmares', pos: 'p2' },
    'Chris B': { team: 'neon nightmares', pos: 'p2' },
    'Dominick Russano': { team: 'neon nightmares', pos: 'p3' },
    'Dom Russano': { team: 'neon nightmares', pos: 'p3' },
    'DR': { team: 'neon nightmares', pos: 'p3' },
    'TM': { team: 'neon nightmares', pos: 'p1' },

    'John Ragnoni': { team: 'J. Ragnoni', pos: 'p1' },
    'Marc Tate': { team: 'J. Ragnoni', pos: 'p2' },
    'David Brunner': { team: 'J. Ragnoni', pos: 'p3' },
    'Dave Brunner': { team: 'J. Ragnoni', pos: 'p3' },
    'Derek Fess': { team: 'J. Ragnoni', pos: 'p1' },
    'Josh Kelly': { team: 'J. Ragnoni', pos: 'p3' },
    'Joshua kelly': { team: 'J. Ragnoni', pos: 'p3' },
    'Derek': { team: 'J. Ragnoni', pos: 'p1' },
    'DF': { team: 'J. Ragnoni', pos: 'p1' },
    'JK': { team: 'J. Ragnoni', pos: 'p3' },
    'Anthony Donley': { team: 'J. Ragnoni', pos: 'p1' },

    'Nick Mezlak': { team: 'N. Mezlak', pos: 'p1' },
    'Cory Jacobs': { team: 'N. Mezlak', pos: 'p2' },
    'Dillon Ulisses': { team: 'N. Mezlak', pos: 'p3' },
    'Dillon U': { team: 'N. Mezlak', pos: 'p3' },
    'Dillon Ullises': { team: 'N. Mezlak', pos: 'p3' },

    'Danny Russano': { team: 'D. Russano', pos: 'p1' },
    'Chris Russano': { team: 'D. Russano', pos: 'p2' },
    'Eric Duale': { team: 'D. Russano', pos: 'p3' },
    'Eric D': { team: 'D. Russano', pos: 'p3' },
    'Eric': { team: 'D. Russano', pos: 'p3' },
    'Luke Kollias': { team: 'D. Russano', pos: 'p2' }
};

const EXPECTED_ORDER = [
    'P1+P2 Doubles 501',
    'P3 Singles Cricket',
    'P1 Singles Cricket',
    'P2+P3 Doubles 501',
    'P2 Singles Cricket',
    'P1 Singles 501',
    'P1+P3 Doubles 501',
    'P2 Singles 501',
    'P3 Singles 501'
];

function findConfig(name) {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    for (const key of Object.keys(PLAYER_CONFIG)) {
        if (key.toLowerCase() === n || n.includes(key.toLowerCase()) || key.toLowerCase().includes(n)) {
            return PLAYER_CONFIG[key];
        }
    }
    // Specific match for short codes like DR, TM, DF, JK
    if (n === 'dr') return PLAYER_CONFIG['Dom Russano'];
    if (n === 'tm') return PLAYER_CONFIG['Tony Massimiani'];
    if (n === 'df') return PLAYER_CONFIG['Derek Fess'];
    if (n === 'jk') return PLAYER_CONFIG['Josh Kelly'];
    if (n === 'marc') return PLAYER_CONFIG['Marc Tate'];
    if (n === 'chris b') return PLAYER_CONFIG['Chris Benco'];
    return null;
}

// Canonical name mapping: RTF typos/variants → correct spelling
// Applied during conversion so Firestore always stores the correct name
const CANONICAL_NAMES = {
    'Christian Ketchem': 'Christian Ketchum',
    'Nate Kull': 'Nathan Kull',
    'Steph Kull': 'Stephanie Kull',
    'Jenn M': 'Jennifer Malek',
    'Jenn Malek': 'Jennifer Malek',
    'Mike Gonzales': 'Michael Gonzalez',
    'Mike Gonzalez': 'Michael Gonzalez',
    'Mike Gonz': 'Michael Gonzalez',
    'Eddie O': 'Eddie Olschansky',
    'Eddie Olschanskey': 'Eddie Olschansky',
    'Kevin Y': 'Kevin Yasenchak',
    'Brian S': 'Brian Smith',
    'Cesar A': 'Cesar Andino',
    'Dom Russano': 'Dominick Russano',
    'Kevin Mckelvey': 'Kevin McKelvey',
    'Mike Jarvis': 'Michael Jarvis',
    'Chris B': 'Chris Benco',
    'Matt Wentz': 'Matthew Wentz',
    'Dave Bonness': 'Dave Bonness',
    'Dillon U': 'Dillon Ulisses'
};

function canonicalizeName(name) {
    return CANONICAL_NAMES[name] || name;
}

// Module-level fill-in overrides for the current match being processed
let _currentFillIns = {};

function setFillIns(fillIns) {
    _currentFillIns = fillIns || {};
}

function getTeamForPlayer(playerName, homeTeam, awayTeam) {
    // Check fill-in overrides first (player from another team playing as sub)
    if (_currentFillIns[playerName]) return _currentFillIns[playerName];

    const config = findConfig(playerName);
    if (!config) return null;
    // Special case for teams that have multiple names (E.O vs E. O vs E.O. March)
    const normalize = (t) => t.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    const playerTeam = normalize(config.team);
    if (playerTeam === normalize(homeTeam)) return 'home';
    if (playerTeam === normalize(awayTeam)) return 'away';

    // Fallback if team names don't match exactly but we know the league structure
    if (homeTeam.includes('Olschansky') || homeTeam === 'E. O') {
        if (playerTeam === 'eo') return 'home';
    }
    if (awayTeam.includes('Olschansky') || awayTeam === 'E. O') {
        if (playerTeam === 'eo') return 'away';
    }
    if (homeTeam.toLowerCase().includes('nightmares')) {
        if (playerTeam === 'neonnightmares') return 'home';
    }
    if (awayTeam.toLowerCase().includes('nightmares')) {
        if (playerTeam === 'neonnightmares') return 'away';
    }

    return null;
}

function getPlayerPositionCombo(game, homeTeamName, awayTeamName) {
    const players = new Set();
    for (const leg of game.legs) {
        Object.keys(leg.player_stats || {}).forEach(p => players.add(p));
    }

    const homePositions = new Set();
    players.forEach(p => {
        const team = getTeamForPlayer(p, homeTeamName, awayTeamName);
        if (team === 'home') {
            const config = findConfig(p);
            if (config) homePositions.add(config.pos);
        }
    });

    const hasP1 = homePositions.has('p1');
    const hasP2 = homePositions.has('p2');
    const hasP3 = homePositions.has('p3');

    const format = game.legs[0]?.type?.toLowerCase().includes('cricket') ? 'Cricket' : '501';
    const isDoubles = game.legs[0]?.isDoubles || Object.keys(game.legs[0]?.player_stats || {}).length >= 4;

    if (isDoubles) {
        if (hasP1 && hasP2) return 'P1+P2 Doubles 501';
        if (hasP2 && hasP3) return 'P2+P3 Doubles 501';
        if (hasP1 && hasP3) return 'P1+P3 Doubles 501';
    } else {
        if (format === 'Cricket') {
            if (hasP1) return 'P1 Singles Cricket';
            if (hasP2) return 'P2 Singles Cricket';
            if (hasP3) return 'P3 Singles Cricket';
        } else {
            if (hasP1) return 'P1 Singles 501';
            if (hasP2) return 'P2 Singles 501';
            if (hasP3) return 'P3 Singles 501';
        }
    }
    return 'Unknown';
}

function reorderGames(games, homeTeam, awayTeam) {
    const byCombo = {};
    for (const g of games) {
        const combo = getPlayerPositionCombo(g, homeTeam, awayTeam);
        if (!byCombo[combo]) byCombo[combo] = [];
        byCombo[combo].push(g);
        console.log(`  Parsed Game: ${combo} (${Object.keys(g.legs[0]?.player_stats || {}).join(', ')})`);
    }

    const reordered = [];
    EXPECTED_ORDER.forEach(type => {
        if (byCombo[type] && byCombo[type].length > 0) {
            reordered.push(byCombo[type].shift());
        } else {
            console.warn(`  WARNING: Missing game for ${type}`);
        }
    });

    // Handle leftovers (e.g. if P2 played twice in singles)
    Object.keys(byCombo).forEach(type => {
        while (byCombo[type].length > 0) {
            const leftover = byCombo[type].shift();
            console.warn(`  WARNING: Leftover game of type ${type} - appending at end`);
            reordered.push(leftover);
        }
    });

    return reordered;
}

function groupThrowsByRound(throws, homeTeam, awayTeam) {
    const rounds = [];
    let currentRound = null;

    throws.forEach(t => {
        const roundNum = t.round;
        if (!currentRound || currentRound.round !== roundNum) {
            currentRound = { round: roundNum, home: null, away: null };
            rounds.push(currentRound);
        }

        const canonName = canonicalizeName(t.player);
        const team = getTeamForPlayer(t.player, homeTeam, awayTeam);
        if (team === 'home') {
            currentRound.home = { player: canonName, hit: t.hit, score: t.score, marks: t.marks, remaining: t.remaining };
            // X01 flags
            if (t.notable) currentRound.home.notable = t.notable;
            if (t.checkout) currentRound.home.checkout = true;
            if (t.checkout_darts) currentRound.home.checkout_darts = t.checkout_darts;
            // Cricket flags
            if (t.closed_out) currentRound.home.closed_out = true;
            if (t.closeout_darts) currentRound.home.closeout_darts = t.closeout_darts;
            // Dart detail flags
            if (t.bulls) currentRound.home.bulls = t.bulls;
            if (t.triples) currentRound.home.triples = t.triples;
        } else if (team === 'away') {
            currentRound.away = { player: canonName, hit: t.hit, score: t.score, marks: t.marks, remaining: t.remaining };
            // X01 flags
            if (t.notable) currentRound.away.notable = t.notable;
            if (t.checkout) currentRound.away.checkout = true;
            if (t.checkout_darts) currentRound.away.checkout_darts = t.checkout_darts;
            // Cricket flags
            if (t.closed_out) currentRound.away.closed_out = true;
            if (t.closeout_darts) currentRound.away.closeout_darts = t.closeout_darts;
            // Dart detail flags
            if (t.bulls) currentRound.away.bulls = t.bulls;
            if (t.triples) currentRound.away.triples = t.triples;
        }
    });

    return rounds;
}

function convertToFirestoreFormat(parsedGames, homeTeam, awayTeam, metadata, matchConfig) {
    const matchId = matchConfig.matchId;
    const games = [];
    let totalLegs = 0;
    let totalDarts = 0;

    parsedGames.forEach((parsedGame, index) => {
        const setNum = index + 1;
        const setLegs = [];
        let setHomeLegsWon = 0;
        let setAwayLegsWon = 0;
        const homePlayersSet = new Set();
        const awayPlayersSet = new Set();

        (parsedGame.legs || []).forEach((leg, legIndex) => {
            totalLegs++;
            const legType = leg.type?.toLowerCase() || '501';
            // Determine alignment for this leg: Is the "home" (left) side actually the home team?
            // Find a player on the "home" (left) side of the raw data
            const leftSidePlayer = Object.keys(leg.player_stats || {}).find(p => leg.player_stats[p].side === 'home');
            let leftSideIsHomeTeam = true; // Default assumption

            if (leftSidePlayer) {
                const team = getTeamForPlayer(leftSidePlayer, homeTeam, awayTeam);
                if (team === 'away') {
                    leftSideIsHomeTeam = false;
                }
            }

            const rawWinner = leg.winner;

            // Remap winner from RTF orientation to actual team orientation
            let legWinner = rawWinner;
            if (!leftSideIsHomeTeam) {
                if (rawWinner === 'home') legWinner = 'away';
                else if (rawWinner === 'away') legWinner = 'home';
            }

            if (legWinner === 'home') { setHomeLegsWon++; }
            else if (legWinner === 'away') { setAwayLegsWon++; }


            const playerStats = {};
            const homeStats = { darts: 0, points: 0, marks: 0 };
            const awayStats = { darts: 0, points: 0, marks: 0 };

            const throws = leg.throws || [];
            totalDarts += throws.length * 3;

            Object.entries(leg.player_stats || {}).forEach(([rawPlayer, stats]) => {
                const player = canonicalizeName(rawPlayer);
                const team = getTeamForPlayer(rawPlayer, homeTeam, awayTeam);
                if (team === 'home') homePlayersSet.add(player);
                else if (team === 'away') awayPlayersSet.add(player);

                playerStats[player] = {
                    darts: stats.darts || 0,
                    points: stats.points || 0,
                    marks: stats.marks || 0,
                    three_dart_avg: stats.three_dart_avg || 0,
                    mpr: stats.mpr || 0
                };
                if (stats.checkout) playerStats[player].checkout = stats.checkout;

                if (team === 'home') {
                    homeStats.darts += stats.darts || 0;
                    homeStats.points += stats.points || 0;
                    homeStats.marks += stats.marks || 0;
                } else if (team === 'away') {
                    awayStats.darts += stats.darts || 0;
                    awayStats.points += stats.points || 0;
                    awayStats.marks += stats.marks || 0;
                }
            });

            const format = legType.includes('501') ? '501' : legType.includes('cricket') ? 'cricket' : legType;
            if (format === '501') {
                homeStats.three_dart_avg = homeStats.darts > 0 ? parseFloat(((homeStats.points / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.three_dart_avg = awayStats.darts > 0 ? parseFloat(((awayStats.points / awayStats.darts) * 3).toFixed(2)) : 0;
            } else {
                homeStats.mpr = homeStats.darts > 0 ? parseFloat(((homeStats.marks / homeStats.darts) * 3).toFixed(2)) : 0;
                awayStats.mpr = awayStats.darts > 0 ? parseFloat(((awayStats.marks / awayStats.darts) * 3).toFixed(2)) : 0;
            }

            const legData = {
                leg_number: legIndex + 1,
                format: format,
                winner: legWinner,
                home_stats: homeStats,
                away_stats: awayStats,
                player_stats: playerStats,
                throws: groupThrowsByRound(throws, homeTeam, awayTeam)
            };

            if (format === '501' && legWinner) {
                const winningThrow = throws.find(t => t.remaining === 0 &&
                    getTeamForPlayer(t.player, homeTeam, awayTeam) === legWinner);
                if (winningThrow) legData.checkout = winningThrow.score;
            }
            setLegs.push(legData);
        });

        let setWinner = setHomeLegsWon > setAwayLegsWon ? 'home' :
            setAwayLegsWon > setHomeLegsWon ? 'away' : 'tie';

        // Apply set winner overrides (if needed)
        // NOTE: Overrides should ONLY change the winner, NOT the leg counts
        // Leg counts are correctly accumulated from parsed legs (lines 271-276)
        if (matchConfig.setOverrides && matchConfig.setOverrides[setNum]) {
            setWinner = matchConfig.setOverrides[setNum];
            console.log(`  [OVERRIDE] Set ${setNum} Winner FORCED to: ${setWinner}`);
            // DO NOT modify setHomeLegsWon/setAwayLegsWon - they're already correct from parser
        }

        // Legacy fix for D. Partlo vs D. Pagel (Week 3) - Set 1
        // The RTF has anomalous mixed player columns for Set 1, causing incorrect winner detection.
        // NOTE: This should be handled by reordering games, not by overriding here
        if (matchId === 'xX4UtSU1dms9spECerDd' && setNum === 1) {
            console.log('  [FIX] Overriding Set 1 winner to Away (D. Pagel) due to mixed RTF columns');
            setWinner = 'away';
            // DO NOT modify leg counts - leave them as parsed
        }

        // Skip sets with DartConnect "Home"/"Away" placeholders (no real players mapped)
        if (homePlayersSet.size === 0 || awayPlayersSet.size === 0) {
            console.log(`  [SKIP] Set ${setNum} — unmapped players on one or both sides (DartConnect placeholder), dropping phantom set`);
            return;
        }

        games.push({
            set: setNum,
            game_number: setNum,
            type: parsedGame.type || 'mixed',
            format: parsedGame.type?.toLowerCase().includes('cricket') ? 'cricket' : '501',
            home_players: Array.from(homePlayersSet),
            away_players: Array.from(awayPlayersSet),
            winner: setWinner,
            result: { home_legs: setHomeLegsWon, away_legs: setAwayLegsWon },
            status: 'completed',
            legs: setLegs
        });
    });

    let homeScore = 0;
    let awayScore = 0;
    games.forEach(g => {
        if (g.winner === 'home') homeScore++;
        else if (g.winner === 'away') awayScore++;
    });

    return {
        games,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: homeScore,
        away_score: awayScore,
        final_score: { home: homeScore, away: awayScore },
        total_darts: totalDarts,
        total_legs: totalLegs,
        total_sets: games.length,
        match_date: metadata.match_date || new Date().toISOString(),
        start_time: metadata.start_time ? metadata.start_time.toISOString() : null,
        end_time: metadata.end_time ? metadata.end_time.toISOString() : null,
        game_time_minutes: metadata.game_time_minutes || null,
        match_length_minutes: metadata.match_length_minutes || null
    };
}

function postToCloudFunction(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function importMatch(match) {
    console.log(`\n=== Importing: ${match.name} ===`);
    const rtfPath = path.join(__dirname, '..', match.rtfFile);
    console.log(`Reading: ${rtfPath}`);

    try {
        // Set fill-in overrides for this match (players from other teams playing as subs)
        setFillIns(match.fillIns || {});

        const { games: parsedGames, metadata } = parseRTFMatch(rtfPath);
        console.log(`Parsed ${parsedGames.length} raw games/legs`);

        let gamesToConvert = parsedGames;
        if (match.reorder) {
            console.log(`Reordering games to official BRDC 9-set format...`);
            gamesToConvert = reorderGames(parsedGames, match.homeTeam, match.awayTeam);
            console.log(`Reordered to ${gamesToConvert.length} sets`);
        }

        const matchData = convertToFirestoreFormat(gamesToConvert, match.homeTeam, match.awayTeam, metadata, match);
        console.log(`Calculated Score: ${match.homeTeam} ${matchData.final_score.home} - ${matchData.final_score.away} ${match.awayTeam}`);

        const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
        const importResult = await postToCloudFunction(importUrl, {
            leagueId: LEAGUE_ID,
            matchId: match.matchId,
            matchData: matchData
        });
        console.log('Import result:', JSON.stringify(importResult, null, 2));

        return { success: true, match: match.name, import: importResult };
    } catch (error) {
        console.error(`Error importing ${match.name}:`, error.message);
        return { success: false, match: match.name, error: error.message };
    }
}

const MATCHES = [
    { name: 'Pagel v Pagel (Week 1)', matchId: 'sgmoL4GyVUYP67aOS7wm', rtfFile: 'temp/trips league/week 1/pagel v pagel MATCH.rtf', homeTeam: 'M. Pagel', awayTeam: 'D. Pagel', reorder: true },
    { name: 'N. Kull vs K. Yasenchak (Week 1)', matchId: 'JqiWABEBS7Bqk8n7pKxD', rtfFile: 'temp/trips league/week 1/yasenchak v kull.rtf', homeTeam: 'N. Kull', awayTeam: 'K. Yasenchak', reorder: true },
    { name: 'E.O vs D. Partlo (Week 1)', matchId: '0lxEeuAa7fEDSVeY3uCG', rtfFile: 'temp/trips league/week 1/partlo v olschansky.rtf', homeTeam: 'E. O', awayTeam: 'D. Partlo', reorder: true },
    { name: 'N. Mezlak vs D. Russano (Week 1)', matchId: 'nYv1XeGTWbaxBepI6F5u', rtfFile: 'temp/trips league/week 1/mezlak v russano.rtf', homeTeam: 'N. Mezlak', awayTeam: 'D. Russano', reorder: true },
    { name: 'J. Ragnoni vs Neon Nightmares (Week 1)', matchId: 'OTYlCe3NNbinKlpZccwS', rtfFile: 'temp/trips league/week 1/massimiani v ragnoni.rtf', homeTeam: 'J. Ragnoni', awayTeam: 'neon nightmares', reorder: true },
    { name: 'D. Pagel vs N. Kull (Week 2)', matchId: 'RfSuCwwQUm2vvpH3e322', rtfFile: 'temp/trips league/week 2/pagel v kull.rtf', homeTeam: 'D. Pagel', awayTeam: 'N. Kull', reorder: true },
    { name: 'D. Russano vs J. Ragnoni (Week 2)', matchId: 'mOtQbjkiLzWc6Ea7gnkp', rtfFile: 'temp/trips league/week 2/russano v ragnoni.rtf', homeTeam: 'D. Russano', awayTeam: 'J. Ragnoni', reorder: true },
    { name: 'E.O. vs N. Mezlak (Week 2)', matchId: 'DhKUt2hCdSEJaNRDceIz', rtfFile: 'temp/trips league/week 2/mezlak V e.o.rtf', homeTeam: 'E. O', awayTeam: 'N. Mezlak', reorder: true },
    { name: 'D. Partlo vs M. Pagel (Week 2)', matchId: 'fqICAD9zFe7cLgNM2m4T', rtfFile: 'temp/trips league/week 2/dpartlo v mpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'M. Pagel', reorder: true },
    { name: 'Neon Nightmares vs K. Yasenchak (Week 2)', matchId: 'j99cYF5bV2Se7zoNVpgi', rtfFile: 'temp/trips league/week 2/massimiani v yasenchak.rtf', homeTeam: 'neon nightmares', awayTeam: 'K. Yasenchak', reorder: true },
    { name: 'J. Ragnoni vs E. O (Week 3)', matchId: 'P57BmQcCGdfZLIxaIe5P', rtfFile: 'temp/trips league/week 3/e.o v jragnonio.rtf', homeTeam: 'J. Ragnoni', awayTeam: 'E. O', reorder: true },
    { name: 'D. Partlo vs D. Pagel (Week 3)', matchId: 'xX4UtSU1dms9spECerDd', rtfFile: 'temp/trips league/week 3/dpartlo v dpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'D. Pagel', reorder: true },
    { name: 'K. Yasenchak vs D. Russano (Week 3)', matchId: 'nUT8f6Fvdi1y7St9wlGQ', rtfFile: 'temp/trips league/week 3/russano v yasenchak.rtf', homeTeam: 'K. Yasenchak', awayTeam: 'D. Russano', reorder: true },
    { name: 'N. Kull vs Neon Nightmares (Week 3)', matchId: 'bHKrdlJnQWbABkMWkLov', rtfFile: 'temp/trips league/week 3/nkull v neon nightmares.rtf', homeTeam: 'N. Kull', awayTeam: 'neon nightmares', reorder: true },
    { name: 'N. Mezlak vs M. Pagel (Week 3)', matchId: 'pw8L1xdnkTDCiorTwbWO', rtfFile: 'temp/trips league/week 3/mpagel v nmezlak.rtf', homeTeam: 'N. Mezlak', awayTeam: 'M. Pagel', reorder: true },
    // Week 4
    { name: 'D. Pagel vs N. Mezlak (Week 4)', matchId: 'zRWjWDe2qw7R8MC7K81i', rtfFile: 'temp/trips league/week 4/pagel v mezlak.rtf', homeTeam: 'D. Pagel', awayTeam: 'N. Mezlak', reorder: true },
    { name: 'D. Partlo vs N. Kull (Week 4)', matchId: 'pNJ5wKPIrHPQqXQv5Nhl', rtfFile: 'temp/trips league/week 4/partlo v kull.rtf', homeTeam: 'D. Partlo', awayTeam: 'N. Kull', reorder: true },
    { name: 'M. Pagel vs J. Ragnoni (Week 4)', matchId: 'ZRBshDQa7pRghXNonnAs', rtfFile: 'temp/trips league/week 4/ragnoni v pagel.rtf', homeTeam: 'M. Pagel', awayTeam: 'J. Ragnoni', reorder: true, fillIns: { 'Christian Ketchum': 'home' } },
    { name: 'E. O vs K. Yasenchak (Week 4)', matchId: 'cd313aLms9YgAEMHXJpV', rtfFile: 'temp/trips league/week 4/yasenchak v olshansky.rtf', homeTeam: 'E. O', awayTeam: 'K. Yasenchak', reorder: true },
    { name: 'Neon Nightmares vs D. Russano (Week 4)', matchId: 'IQ4pQ6jqQUAsvdOg0j3e', rtfFile: 'temp/trips league/week 4/neon nightmare v drussano.rtf', homeTeam: 'neon nightmares', awayTeam: 'D. Russano', reorder: true }
];

async function main() {
    const weekFilter = process.argv[2] ? parseInt(process.argv[2]) : null;
    const matchesToRun = weekFilter
        ? MATCHES.filter(m => m.name.includes(`Week ${weekFilter}`))
        : MATCHES;

    if (weekFilter) {
        console.log(`Starting imports for League: ${LEAGUE_ID} (Week ${weekFilter} only — ${matchesToRun.length} matches)`);
    } else {
        console.log(`Starting all imports for League: ${LEAGUE_ID} (${matchesToRun.length} matches)`);
    }

    const results = [];
    for (const match of matchesToRun) {
        results.push(await importMatch(match));
    }
    console.log('\n=== IMPORT SUMMARY ===');
    results.forEach(r => console.log(`[${r.success ? 'OK' : 'FAIL'}] ${r.match}${r.error ? ': ' + r.error : ''}`));

    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
        console.log(`\n=== RECALCULATING ALL STATS (${successCount} matches imported) ===`);
        const recalcUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/recalculateAllLeagueStats';
        const recalcResult = await postToCloudFunction(recalcUrl, { leagueId: LEAGUE_ID });
        if (recalcResult.success) {
            console.log(`Stats recalculated: ${recalcResult.matchesProcessed} matches → ${recalcResult.playersUpdated} players`);
        } else {
            console.error('Stats recalc failed:', recalcResult.error || recalcResult);
        }
    }
}

// Export functions for use by other scripts
module.exports = {
    reorderGames,
    convertToFirestoreFormat,
    getTeamForPlayer,
    setFillIns
};

// Run main only if called directly (not required as a module)
if (require.main === module) {
    main().catch(console.error);
}
