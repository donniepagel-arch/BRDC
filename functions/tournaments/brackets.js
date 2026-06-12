/**
 * Generate Tournament Bracket Cloud Functions
 * Supports single-elimination and double-elimination (mixed doubles matchmaker format)
 *
 * REFACTORED to work with new unified structure
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const { requireTournamentAccess } = require('../src/tournament-auth-helper');

// =============================================================================
// DOUBLE ELIMINATION BRACKET GENERATOR (Mixed Doubles Matchmaker Format)
// =============================================================================

/**
 * Generate a double-elimination bracket for teams (mixed doubles)
 * Used by mixed doubles matchmaker tournaments
 *
 * Winners Bracket: Cricket best-of-3
 * Losers Bracket: 501 best-of-1
 * Grand Finals: WC Champion vs LC Champion (with potential bracket reset)
 */
exports.generateDoubleEliminationBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const { tournamentRef, tournament } = await requireTournamentAccess(req, tournament_id);

        // Get teams from registrations (pre-formed + matched teams)
        const registrationsSnap = await tournamentRef.collection('registrations').get();
        const teams = [];

        registrationsSnap.docs.forEach(doc => {
            const reg = doc.data();
            if (reg.type === 'team' || reg.type === 'matched_team') {
                teams.push({
                    id: doc.id,
                    team_name: reg.team_name,
                    player1: reg.player1,
                    player2: reg.player2,
                    type: reg.type
                });
            }
        });

        if (teams.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Need at least 2 teams. Run partner draw first if you have singles.'
            });
        }

        // Shuffle teams for random seeding
        const shuffled = [...teams].sort(() => Math.random() - 0.5);

        // Calculate bracket size (power of 2)
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        const byeCount = bracketSize - shuffled.length;
        const wcRounds = Math.log2(bracketSize);

        // Losers bracket has more rounds (2 * WC rounds - 2)
        // Each WC round feeds losers, then LC has internal rounds
        const lcRounds = (wcRounds - 1) * 2;

        // Generate Winners Bracket
        const winnersMatches = generateWinnersBracketMatches(shuffled, bracketSize, wcRounds);

        // Generate Losers Bracket structure (empty - populated as WC progresses)
        const losersMatches = generateLosersBracketStructure(bracketSize, lcRounds);

        // Grand Finals structure
        const grandFinals = {
            match1: {
                id: 'gf-1',
                round: 'grand_finals',
                team1_id: null,  // WC Champion
                team2_id: null,  // LC Champion
                team1: null,
                team2: null,
                winner_id: null,
                scores: null,
                status: 'waiting',
                board: null,
                game_type: tournament.winners_game_type || 'cricket',
                best_of: tournament.winners_best_of || 3
            },
            match2: null,  // Created only if LC Champion wins match1 (bracket reset)
            bracket_reset_needed: false
        };

        // Calculate expected match counts
        const wcMatchCount = winnersMatches.length;
        const lcMatchCount = losersMatches.length;

        const bracket = {
            type: 'double_elimination',
            format: 'mixed_doubles_matchmaker',
            team_count: teams.length,
            bracket_size: bracketSize,
            bye_count: byeCount,

            // Bracket structure
            winners: winnersMatches,
            winners_rounds: wcRounds,

            losers: losersMatches,
            losers_rounds: lcRounds,

            grand_finals: grandFinals,

            // Champion tracking
            wc_champion_id: null,
            lc_champion_id: null,
            tournament_champion_id: null,

            // Mingle period tracking
            mingle_active: false,
            mingle_round: 0,
            mingle_started_at: null,
            mingle_ends_at: null,

            // Progress tracking
            current_wc_round: 1,
            current_lc_round: 0,  // LC doesn't start until WC R1 complete
            wc_complete: false,
            lc_complete: false,

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // Auto-advance byes in round 1
        const byeAdvances = autoAdvanceByes(bracket.winners);

        // Save bracket to tournament
        await tournamentRef.update({
            bracket: bracket,
            bracketGenerated: true,
            bracketGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            started: true,
            team_count: teams.length
        });

        res.json({
            success: true,
            message: 'Double elimination bracket generated',
            team_count: teams.length,
            bracket_size: bracketSize,
            bye_count: byeCount,
            winners_matches: wcMatchCount,
            losers_matches: lcMatchCount,
            byes_advanced: byeAdvances,
            wc_rounds: wcRounds,
            lc_rounds: lcRounds
        });

    } catch (error) {
        console.error('Generate double elim bracket error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Generate Winners Bracket matches with teams placed
 */
function generateWinnersBracketMatches(teams, bracketSize, totalRounds) {
    const matches = [];
    let matchNum = 1;
    const firstRoundMatches = bracketSize / 2;
    const byeCount = bracketSize - teams.length;
    const fullMatchCount = firstRoundMatches - byeCount;

    // Round 1 - distribute teams so full matches come first, then byes
    // Full matches get 2 teams each, bye matches get 1 team each
    // Example: 6 teams in 8-bracket → 2 full matches + 2 byes (1 team each)
    let teamIdx = 0;
    for (let i = 0; i < firstRoundMatches; i++) {
        let team1 = null;
        let team2 = null;

        if (i < fullMatchCount) {
            // Full match - both teams present
            team1 = teams[teamIdx++] || null;
            team2 = teams[teamIdx++] || null;
        } else {
            // Bye match - one team, auto-advances
            team1 = teams[teamIdx++] || null;
            team2 = null;
        }

        const isBye = !team1 || !team2;

        matches.push({
            id: `wc-${matchNum}`,
            matchNumber: matchNum,
            round: 1,
            position: i,
            bracket: 'winners',

            team1_id: team1?.id || null,
            team2_id: team2?.id || null,
            team1: team1 || null,
            team2: team2 || null,

            winner_id: null,
            loser_id: null,
            scores: null,

            status: isBye ? 'bye' : 'pending',
            board: null,
            started_at: null,
            completed_at: null,

            // Track where loser goes in LC
            // Two WC R1 losers feed into each LC R1 match
            loser_goes_to_lc_round: 1,
            loser_goes_to_lc_position: Math.floor(i / 2)
        });
        matchNum++;
    }

    // Subsequent rounds - empty waiting for winners
    let prevRoundMatches = firstRoundMatches;
    for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = prevRoundMatches / 2;

        for (let pos = 0; pos < roundMatches; pos++) {
            const lcRound = (round - 1) * 2;  // Losers enter at round based on when they lost

            matches.push({
                id: `wc-${matchNum}`,
                matchNumber: matchNum,
                round: round,
                position: pos,
                bracket: 'winners',

                team1_id: null,
                team2_id: null,
                team1: null,
                team2: null,

                winner_id: null,
                loser_id: null,
                scores: null,

                status: 'waiting',
                board: null,
                started_at: null,
                completed_at: null,

                // Feeder matches from previous round
                feeder1: `wc-${getFeederMatchNumber(round, pos, 0, firstRoundMatches)}`,
                feeder2: `wc-${getFeederMatchNumber(round, pos, 1, firstRoundMatches)}`,

                loser_goes_to_lc_round: lcRound,
                loser_goes_to_lc_position: pos
            });
            matchNum++;
        }
        prevRoundMatches = roundMatches;
    }

    return matches;
}

/**
 * Generate Losers Bracket structure (all empty - populated as WC progresses)
 *
 * LC structure alternates between:
 * - Dropout rounds (WC losers vs existing LC players)
 * - Consolidation rounds (LC winners vs LC winners)
 */
function generateLosersBracketStructure(bracketSize, totalRounds) {
    const matches = [];
    let matchNum = 1;
    const wcRounds = Math.log2(bracketSize);

    // Calculate match counts per round
    // Round 1: WC R1 losers play each other (bracketSize/4 matches)
    // Round 2: WC R1 winners' losers (WC R2 losers) drop in
    // Pattern continues...

    let currentMatchCount = bracketSize / 4;  // Half of WC R1 losers play each other

    for (let round = 1; round <= totalRounds; round++) {
        const isDropoutRound = round % 2 === 0 && round > 1;

        // Determine matches in this round
        let matchesInRound;
        if (round === 1) {
            matchesInRound = bracketSize / 4;
        } else if (isDropoutRound) {
            // Dropout rounds: same as previous round (new WC losers join)
            matchesInRound = currentMatchCount;
        } else {
            // Consolidation rounds: halve the matches
            currentMatchCount = Math.max(1, currentMatchCount / 2);
            matchesInRound = currentMatchCount;
        }

        for (let pos = 0; pos < matchesInRound; pos++) {
            matches.push({
                id: `lc-${matchNum}`,
                matchNumber: matchNum,
                round: round,
                position: pos,
                bracket: 'losers',
                round_type: isDropoutRound ? 'dropout' : 'consolidation',

                team1_id: null,
                team2_id: null,
                team1: null,
                team2: null,

                winner_id: null,
                loser_id: null,  // This team is ELIMINATED (2nd loss)
                scores: null,

                status: 'waiting',
                board: null,
                started_at: null,
                completed_at: null
            });
            matchNum++;
        }
    }

    return matches;
}

/**
 * Calculate feeder match number for a given position
 */
function getFeederMatchNumber(round, position, slot, firstRoundMatches) {
    // For round 2, feeders are from round 1
    // Position 0 comes from matches 1 and 2
    // Position 1 comes from matches 3 and 4, etc.

    if (round === 2) {
        return position * 2 + slot + 1;
    }

    // For later rounds, calculate based on structure
    let matchesBeforeThisRound = 0;
    let matchesInRound = firstRoundMatches;

    for (let r = 1; r < round - 1; r++) {
        matchesBeforeThisRound += matchesInRound;
        matchesInRound = matchesInRound / 2;
    }

    return matchesBeforeThisRound + position * 2 + slot + 1;
}

/**
 * Auto-advance teams that have a bye (opponent is null)
 * Places the advancing team into the next round's match slot
 * Returns count of byes processed
 */
function autoAdvanceByes(winnersMatches) {
    let byeCount = 0;

    winnersMatches.forEach((match) => {
        if (match.round === 1 && match.status === 'bye') {
            // One team has a bye - they auto-advance
            const advancingTeam = match.team1 || match.team2;
            const advancingId = match.team1_id || match.team2_id;

            if (advancingTeam) {
                match.winner_id = advancingId;
                match.status = 'completed';
                match.completed_at = new Date().toISOString();
                byeCount++;

                // Place the advancing team into the next round match
                const nextPosition = Math.floor(match.position / 2);
                const nextMatch = winnersMatches.find(m =>
                    m.round === 2 && m.position === nextPosition
                );

                if (nextMatch) {
                    const isSlot1 = match.position % 2 === 0;
                    if (isSlot1) {
                        nextMatch.team1_id = advancingId;
                        nextMatch.team1 = advancingTeam;
                    } else {
                        nextMatch.team2_id = advancingId;
                        nextMatch.team2 = advancingTeam;
                    }

                    // If both teams are now present, match is ready
                    if (nextMatch.team1_id && nextMatch.team2_id) {
                        nextMatch.status = 'pending';
                    }
                }
            }
        }
    });

    return byeCount;
}

// =============================================================================
// SINGLE ELIMINATION BRACKET GENERATOR (Standard tournaments)
// =============================================================================

exports.generateBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        const { tournamentRef, tournament: tournamentData } = await requireTournamentAccess(req, tournament_id);

        // Normalize format (accept both hyphen and underscore)
        const format = (tournamentData.format || 'single_elimination').toLowerCase().replace(/-/g, '_');

        // Route to double elimination if that's the format
        if (format === 'double_elimination') {
            // For double elimination, use the dedicated endpoint
            return res.status(400).json({
                error: 'Use generateDoubleEliminationBracket for double elimination format'
            });
        }

        const playersMap = tournamentData.players || {};
        let players = Object.entries(playersMap)
            .filter(([, player]) => player.checkedIn === true || player.checked_in === true)
            .map(([id, player]) => ({
                id,
                name: player.name,
                ...player
            }));

        const venueLabel = `${tournamentData.venue_name || tournamentData.venue || ''}`;
        const isOnlineTournament = tournamentData.is_online === true
            || /online|virtual|remote/i.test(venueLabel);

        // Online tournaments can be bracketed directly from active registrations.
        if (players.length < 2 && isOnlineTournament) {
            const registrationsSnap = await tournamentRef.collection('registrations')
                .where('status', '==', 'active')
                .get();

            players = registrationsSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(player => player.player_id || player.email || player.full_name || player.name)
                .map(player => ({
                    id: player.player_id || player.id,
                    registration_id: player.id,
                    name: player.full_name || player.name || 'Player',
                    email: player.email || null,
                    checkedIn: player.checked_in === true || isOnlineTournament,
                    ...player
                }));
        }

        if (players.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 checked-in players' });
        }

        // Generate single elimination bracket
        let bracket = generateSingleElimination(players, tournament_id);

        // Save bracket to tournament document
        await tournamentRef.update({
            bracket: bracket,
            bracketGenerated: true,
            bracketGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            playerCount: players.length,
            started: true
        });

        res.json({
            success: true,
            matches_created: bracket.matches.length,
            players: players.length,
            bracket: bracket
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

function generateSingleElimination(players, tournament_id) {
    // Shuffle players for random seeding
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Calculate bracket size (power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const byeCount = bracketSize - shuffled.length;

    // Calculate total rounds
    const totalRounds = Math.log2(bracketSize);

    const matches = [];
    let matchNumber = 1;

    // Create first round matches
    const firstRoundMatches = bracketSize / 2;

    for (let i = 0; i < firstRoundMatches; i++) {
        const player1 = shuffled[i * 2];
        const player2 = shuffled[i * 2 + 1];

        matches.push({
            id: `match-${matchNumber}`,
            matchNumber: matchNumber++,
            round: 1,
            position: i,
            player1: player1 ? {
                id: player1.id,
                name: player1.name,
                isBot: player1.isBot || false,
                botDifficulty: player1.botDifficulty || null
            } : null,
            player2: player2 ? {
                id: player2.id,
                name: player2.name,
                isBot: player2.isBot || false,
                botDifficulty: player2.botDifficulty || null
            } : null,
            score: { player1: null, player2: null },
            winner: null,
            status: 'pending',
            board: null
        });
    }

    // Create subsequent rounds (empty matches waiting for winners)
    let previousRoundMatches = firstRoundMatches;
    for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = previousRoundMatches / 2;

        for (let i = 0; i < roundMatches; i++) {
            const prevMatchBase = (round === 2) ? 0 : matches.filter(m => m.round < round).length;

            matches.push({
                id: `match-${matchNumber}`,
                matchNumber: matchNumber++,
                round: round,
                position: i,
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                status: 'waiting',
                board: null
            });
        }

        previousRoundMatches = roundMatches;
    }

    return {
        type: 'single-elimination',
        totalRounds: totalRounds,
        totalPlayers: shuffled.length,
        bracketSize: bracketSize,
        matches: matches,
        createdAt: admin.firestore.Timestamp.now()
    };
}

function shuffleEntries(entries) {
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function registrationName(registration) {
    return registration.full_name || registration.name || registration.player_name || registration.email || 'Player';
}

function pairBlindDrawPlayers(players, eventId) {
    const shuffled = shuffleEntries(players);
    const teams = [];

    for (let i = 0; i < shuffled.length; i += 2) {
        const first = shuffled[i];
        const second = shuffled[i + 1];
        teams.push({
            id: `draw_team_${String(i / 2 + 1).padStart(2, '0')}`,
            name: `${registrationName(first)} / ${registrationName(second)}`,
            team_name: `${registrationName(first)} / ${registrationName(second)}`,
            players: [first, second].map(player => ({
                registration_id: player.id,
                player_id: player.player_id || null,
                name: registrationName(player),
                email: player.email || null,
                phone: player.phone || null
            })),
            checkedIn: true,
            checked_in: true,
            status: 'active',
            entry_type: 'blind_draw_team',
            draw_event_id: eventId || null,
            seed_number: teams.length + 1
        });
    }

    return teams;
}

function generateBlindDrawSingleElimination(teams) {
    const shuffled = shuffleEntries(teams);
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const byeCount = bracketSize - shuffled.length;
    const totalRounds = Math.log2(bracketSize);
    const matches = [];
    let matchNumber = 1;
    const firstRoundSlots = Array(bracketSize).fill(null);
    const firstRoundMatches = bracketSize / 2;
    const byePositions = [];
    let left = 0;
    let right = firstRoundMatches - 1;
    const reservedByeOpponentSlots = new Set();

    while (byePositions.length < byeCount) {
        byePositions.push(left++);
        if (byePositions.length < byeCount) byePositions.push(right--);
    }

    let teamIndex = 0;
    for (const position of byePositions) {
        firstRoundSlots[position * 2] = shuffled[teamIndex++] || null;
        reservedByeOpponentSlots.add(position * 2 + 1);
    }

    for (let i = 0; i < firstRoundSlots.length && teamIndex < shuffled.length; i++) {
        if (reservedByeOpponentSlots.has(i) || firstRoundSlots[i]) continue;
        firstRoundSlots[i] = shuffled[teamIndex++];
    }

    for (let i = 0; i < firstRoundMatches; i++) {
        const player1 = firstRoundSlots[i * 2] || null;
        const player2 = firstRoundSlots[i * 2 + 1] || null;
        const hasBye = (player1 && !player2) || (!player1 && player2);
        const byeWinner = hasBye ? (player1 || player2) : null;

        matches.push({
            id: `match-${matchNumber}`,
            matchNumber: matchNumber++,
            round: 1,
            position: i,
            player1,
            player2,
            score: { player1: null, player2: null },
            winner: byeWinner,
            winner_id: byeWinner?.id || null,
            status: hasBye ? 'bye' : (player1 && player2 ? 'pending' : 'waiting'),
            board: null
        });
    }

    let previousRoundMatches = firstRoundMatches;
    for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = previousRoundMatches / 2;
        for (let i = 0; i < roundMatches; i++) {
            matches.push({
                id: `match-${matchNumber}`,
                matchNumber: matchNumber++,
                round,
                position: i,
                player1: null,
                player2: null,
                score: { player1: null, player2: null },
                winner: null,
                status: 'waiting',
                board: null
            });
        }
        previousRoundMatches = roundMatches;
    }

    matches
        .filter(match => match.round === 1 && match.status === 'bye' && match.winner)
        .forEach(match => {
            match.status = 'completed';
            match.completedAt = admin.firestore.Timestamp.now();

            const nextMatch = matches.find(item => item.round === 2 && item.position === Math.floor(match.position / 2));
            if (!nextMatch) return;

            if (match.position % 2 === 0) nextMatch.player1 = match.winner;
            else nextMatch.player2 = match.winner;

            if (nextMatch.player1 && nextMatch.player2) nextMatch.status = 'pending';
        });

    return {
        type: 'single-elimination',
        entry_type: 'blind_draw',
        team_size: 2,
        totalRounds,
        totalPlayers: teams.length * 2,
        totalTeams: teams.length,
        bracketSize,
        matches,
        createdAt: admin.firestore.Timestamp.now()
    };
}

function generateBlindDrawDoubleElimination(teams, tournament = {}) {
    const shuffled = shuffleEntries(teams);
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const wcRounds = Math.log2(bracketSize);
    const lcRounds = (wcRounds - 1) * 2;
    const winnersMatches = generateWinnersBracketMatches(shuffled, bracketSize, wcRounds);
    const losersMatches = generateLosersBracketStructure(bracketSize, lcRounds);

    const bracket = {
        type: 'double_elimination',
        format: 'blind_draw_doubles',
        entry_type: 'blind_draw',
        team_size: 2,
        team_count: teams.length,
        totalPlayers: teams.length * 2,
        bracket_size: bracketSize,
        bye_count: bracketSize - teams.length,
        winners: winnersMatches,
        winners_rounds: wcRounds,
        losers: losersMatches,
        losers_rounds: lcRounds,
        grand_finals: {
            match1: {
                id: 'gf-1',
                round: 'grand_finals',
                team1_id: null,
                team2_id: null,
                team1: null,
                team2: null,
                winner_id: null,
                scores: null,
                status: 'waiting',
                board: null,
                game_type: tournament.winners_game_type || tournament.game_type || '501',
                best_of: tournament.grand_finals_best_of || tournament.winners_best_of || tournament.best_of || 3
            },
            match2: null,
            bracket_reset_needed: false
        },
        wc_champion_id: null,
        lc_champion_id: null,
        tournament_champion_id: null,
        mingle_active: false,
        mingle_round: 0,
        current_wc_round: 1,
        current_lc_round: 0,
        wc_complete: false,
        lc_complete: false,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    autoAdvanceByes(bracket.winners);
    return bracket;
}

exports.generateBlindDrawBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, event_id, checked_in_only, house_name, force } = req.body || {};
        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const { tournamentRef, tournament } = await requireTournamentAccess(req, tournament_id);
        if ((tournament.bracketGenerated || tournament.bracket) && force !== true) {
            return res.status(400).json({
                success: false,
                error: 'Tournament already has a bracket. Re-run with force enabled to overwrite it.'
            });
        }

        const registrationsSnap = await tournamentRef.collection('registrations').get();
        let registrations = registrationsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(registration => registration.status !== 'cancelled')
            .filter(registration => !event_id || (registration.event_ids || []).includes(event_id));

        if (checked_in_only === true) {
            registrations = registrations.filter(registration => registration.checked_in === true || registration.checkedIn === true);
        }

        const houseName = String(house_name || '').trim();
        if (houseName) {
            registrations.push({
                id: `house_${houseName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'player'}`,
                full_name: houseName,
                name: houseName,
                email: null,
                phone: null,
                status: 'active',
                checked_in: true,
                event_ids: event_id ? [event_id] : [],
                is_house: true
            });
        }

        if (registrations.length < 4) {
            return res.status(400).json({
                success: false,
                error: `Need at least 4 players for blind-draw doubles. Found ${registrations.length}.`
            });
        }

        if (registrations.length % 2 !== 0) {
            return res.status(400).json({
                success: false,
                error: `Odd player count (${registrations.length}). Add a player or enter a house player.`
            });
        }

        if (force === true) {
            const oldTeams = await tournamentRef.collection('draw_teams').get();
            const oldPlayers = await tournamentRef.collection('players').where('entry_type', '==', 'blind_draw_team').get();
            const cleanup = admin.firestore().batch();
            oldTeams.docs.forEach(doc => cleanup.delete(doc.ref));
            oldPlayers.docs.forEach(doc => cleanup.delete(doc.ref));
            if (event_id) {
                const oldEventTeams = await tournamentRef.collection('events').doc(event_id).collection('draw_teams').get();
                oldEventTeams.docs.forEach(doc => cleanup.delete(doc.ref));
            }
            await cleanup.commit();
        }

        const teams = pairBlindDrawPlayers(registrations, event_id || null);
        const normalizedFormat = String(tournament.format || '').toLowerCase().replace(/-/g, '_');
        const bracket = normalizedFormat === 'double_elimination'
            ? generateBlindDrawDoubleElimination(teams, tournament)
            : generateBlindDrawSingleElimination(teams);
        const batch = admin.firestore().batch();
        const playersMap = {};

        for (const team of teams) {
            playersMap[team.id] = team;
            batch.set(tournamentRef.collection('draw_teams').doc(team.id), {
                ...team,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            batch.set(tournamentRef.collection('players').doc(team.id), {
                ...team,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            if (event_id) {
                batch.set(tournamentRef.collection('events').doc(event_id).collection('draw_teams').doc(team.id), {
                    ...team,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        if (event_id) {
            batch.set(tournamentRef.collection('events').doc(event_id), {
                draw_generated: true,
                draw_generated_at: admin.firestore.FieldValue.serverTimestamp(),
                team_count: teams.length,
                player_count: registrations.length,
                status: 'active',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        batch.set(tournamentRef, {
            players: playersMap,
            draw_generated: true,
            draw_generated_at: admin.firestore.FieldValue.serverTimestamp(),
            team_count: teams.length,
            playerCount: registrations.length,
            bracket,
            bracketGenerated: true,
            bracketGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            started: true,
            status: 'bracket_generated',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        return res.json({
            success: true,
            players: registrations.length,
            teams: teams.length,
            matches_created: bracket.matches?.length
                || ((bracket.winners?.length || 0) + (bracket.losers?.length || 0) + (bracket.grand_finals?.match1 ? 1 : 0) + (bracket.grand_finals?.match2 ? 1 : 0)),
            bracket
        });
    } catch (error) {
        console.error('Generate blind draw bracket error:', error);
        return res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

// =============================================================================
// BRACKET EDITING FUNCTIONS
// =============================================================================

/**
 * Swap two positions in the bracket (only allowed before round 1 starts)
 */
exports.swapBracketPositions = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, position1, position2 } = req.body;

        if (!tournament_id || position1 === undefined || position2 === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const { tournamentRef, tournament } = await requireTournamentAccess(req, tournament_id);

        // Check if bracket is locked (round 1 has started)
        if (tournament.bracket_locked) {
            return res.status(400).json({
                success: false,
                error: 'Bracket is locked - matches have already started'
            });
        }

        // Check if any match in round 1 has been completed
        const bracket = tournament.bracket;
        if (!bracket || !bracket.winners) {
            return res.status(400).json({ success: false, error: 'No bracket found' });
        }

        // Check for any completed matches in round 1
        const round1Completed = bracket.winners.some(m =>
            m.round === 1 && m.status === 'completed' && !m.status !== 'bye'
        );

        if (round1Completed) {
            // Lock the bracket
            await tournamentRef.update({ bracket_locked: true });
            return res.status(400).json({
                success: false,
                error: 'Cannot edit bracket - round 1 matches have been played'
            });
        }

        // Find the matches at these positions in round 1
        const match1 = bracket.winners.find(m => m.round === 1 && m.position === Math.floor(position1 / 2));
        const match2 = bracket.winners.find(m => m.round === 1 && m.position === Math.floor(position2 / 2));

        if (!match1 || !match2) {
            return res.status(400).json({ success: false, error: 'Invalid positions' });
        }

        // Determine which slot (team1 or team2) within the match
        const slot1 = position1 % 2 === 0 ? 'team1' : 'team2';
        const slot2 = position2 % 2 === 0 ? 'team1' : 'team2';

        // Get the teams/players to swap
        const team1Data = {
            id: match1[`${slot1}_id`],
            team: match1[slot1]
        };
        const team2Data = {
            id: match2[`${slot2}_id`],
            team: match2[slot2]
        };

        // Perform the swap in memory
        const matchIndex1 = bracket.winners.findIndex(m => m.id === match1.id);
        const matchIndex2 = bracket.winners.findIndex(m => m.id === match2.id);

        bracket.winners[matchIndex1][`${slot1}_id`] = team2Data.id;
        bracket.winners[matchIndex1][slot1] = team2Data.team;
        bracket.winners[matchIndex2][`${slot2}_id`] = team1Data.id;
        bracket.winners[matchIndex2][slot2] = team1Data.team;

        // Update status for bye handling
        bracket.winners.forEach((match, idx) => {
            if (match.round === 1) {
                const hasTeam1 = match.team1_id || match.team1;
                const hasTeam2 = match.team2_id || match.team2;

                if (!hasTeam1 || !hasTeam2) {
                    bracket.winners[idx].status = 'bye';
                    // Auto-advance the non-null team
                    if (hasTeam1) {
                        bracket.winners[idx].winner_id = match.team1_id;
                    } else if (hasTeam2) {
                        bracket.winners[idx].winner_id = match.team2_id;
                    }
                } else {
                    bracket.winners[idx].status = 'pending';
                    bracket.winners[idx].winner_id = null;
                }
            }
        });

        // Save updated bracket
        await tournamentRef.update({
            bracket: bracket,
            bracket_last_edited: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Positions swapped successfully',
            swapped: {
                position1: { team: team1Data.team?.team_name || team1Data.team?.name || 'TBD', movedTo: position2 },
                position2: { team: team2Data.team?.team_name || team2Data.team?.name || 'TBD', movedTo: position1 }
            }
        });

    } catch (error) {
        console.error('Swap positions error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Regenerate bracket with new random seeding (only allowed before round 1 starts)
 */
exports.regenerateBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, seed_order } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const { tournamentRef, tournament } = await requireTournamentAccess(req, tournament_id);

        // Check if bracket is locked
        if (tournament.bracket_locked) {
            return res.status(400).json({
                success: false,
                error: 'Bracket is locked - matches have already started'
            });
        }

        const bracket = tournament.bracket;
        if (!bracket || !bracket.winners) {
            return res.status(400).json({ success: false, error: 'No bracket found' });
        }

        // Check for real completed matches (not just auto-advanced byes)
        // A real completed match has both teams AND actual scores
        const hasCompletedMatches = bracket.winners.some(m =>
            m.round === 1 && m.status === 'completed' && m.team1 && m.team2 && m.scores
        );

        if (hasCompletedMatches) {
            await tournamentRef.update({ bracket_locked: true });
            return res.status(400).json({
                success: false,
                error: 'Cannot regenerate - matches have been played'
            });
        }

        // Collect all teams from round 1
        const teams = [];
        bracket.winners.filter(m => m.round === 1).forEach(match => {
            if (match.team1_id && match.team1) {
                teams.push({ id: match.team1_id, ...match.team1 });
            }
            if (match.team2_id && match.team2) {
                teams.push({ id: match.team2_id, ...match.team2 });
            }
        });

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Not enough teams to regenerate' });
        }

        // Use director's seed order if provided, otherwise random shuffle
        let shuffled;
        if (seed_order && Array.isArray(seed_order) && seed_order.length > 0) {
            shuffled = seed_order.map(id => teams.find(t => t.id === id)).filter(Boolean);
            // Append any teams not in seed_order (safety net)
            teams.forEach(t => { if (!shuffled.find(s => s.id === t.id)) shuffled.push(t); });
        } else {
            shuffled = [...teams].sort(() => Math.random() - 0.5);
        }

        // Calculate bracket structure
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        const firstRoundMatches = bracketSize / 2;
        const byeCount = bracketSize - shuffled.length;
        const fullMatchCount = firstRoundMatches - byeCount;

        // Distribute teams: full matches first, bye matches at end
        // Each bye match gets exactly 1 team (not zero)
        let teamIdx = 0;
        const round1Placements = [];
        for (let i = 0; i < firstRoundMatches; i++) {
            if (i < fullMatchCount) {
                round1Placements.push({ team1: shuffled[teamIdx++] || null, team2: shuffled[teamIdx++] || null });
            } else {
                round1Placements.push({ team1: shuffled[teamIdx++] || null, team2: null });
            }
        }

        // Regenerate round 1 matches
        let matchNum = 1;
        bracket.winners = bracket.winners.map(match => {
            if (match.round === 1) {
                const pos = match.position;
                const placement = round1Placements[pos] || { team1: null, team2: null };
                const team1 = placement.team1;
                const team2 = placement.team2;
                const isBye = !team1 || !team2;

                return {
                    ...match,
                    team1_id: team1?.id || null,
                    team2_id: team2?.id || null,
                    team1: team1 || null,
                    team2: team2 || null,
                    winner_id: isBye ? (team1?.id || team2?.id) : null,
                    loser_id: null,
                    scores: null,
                    status: isBye ? 'bye' : 'pending',
                    board: null,
                    started_at: null,
                    completed_at: isBye ? new Date().toISOString() : null
                };
            }
            // Clear later rounds
            return {
                ...match,
                team1_id: null,
                team2_id: null,
                team1: null,
                team2: null,
                winner_id: null,
                loser_id: null,
                scores: null,
                status: 'waiting',
                board: null,
                started_at: null,
                completed_at: null
            };
        });

        // Clear losers bracket if exists
        if (bracket.losers) {
            bracket.losers = bracket.losers.map(match => ({
                ...match,
                team1_id: null,
                team2_id: null,
                team1: null,
                team2: null,
                winner_id: null,
                loser_id: null,
                scores: null,
                status: 'waiting',
                board: null,
                started_at: null,
                completed_at: null
            }));
        }

        // Clear grand finals if exists
        if (bracket.grand_finals) {
            bracket.grand_finals = {
                ...bracket.grand_finals,
                match1: {
                    ...bracket.grand_finals.match1,
                    team1_id: null,
                    team2_id: null,
                    team1: null,
                    team2: null,
                    winner_id: null,
                    scores: null,
                    status: 'waiting',
                    board: null
                },
                match2: null,
                bracket_reset_needed: false
            };
        }

        // Reset progress tracking
        bracket.wc_champion_id = null;
        bracket.lc_champion_id = null;
        bracket.tournament_champion_id = null;
        bracket.current_wc_round = 1;
        bracket.current_lc_round = 0;
        bracket.wc_complete = false;
        bracket.lc_complete = false;

        // Auto-advance byes to Round 2 (places bye winners into next round slots)
        autoAdvanceByes(bracket.winners);

        // Save regenerated bracket
        await tournamentRef.update({
            bracket: bracket,
            bracket_regenerated_at: admin.firestore.FieldValue.serverTimestamp(),
            bracket_locked: false
        });

        res.json({
            success: true,
            message: 'Bracket regenerated with new seeding',
            team_count: teams.length,
            new_order: shuffled.map(t => t.team_name || t.name || 'Team')
        });

    } catch (error) {
        console.error('Regenerate bracket error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Lock bracket (called when first match is completed)
 */
exports.lockBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const { tournamentRef } = await requireTournamentAccess(req, tournament_id);

        await tournamentRef.update({
            bracket_locked: true,
            bracket_locked_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Bracket locked' });

    } catch (error) {
        console.error('Lock bracket error:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});
