/**
 * Generate Tournament Bracket Cloud Functions
 * Supports single-elimination and double-elimination (Heartbreaker format)
 *
 * REFACTORED to work with new unified structure
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

// =============================================================================
// DOUBLE ELIMINATION BRACKET GENERATOR (Heartbreaker Format)
// =============================================================================

/**
 * Generate a double-elimination bracket for teams (mixed doubles)
 * Used by Matchmaker/Heartbreaker tournaments
 *
 * Winners Bracket: Cricket best-of-3
 * Losers Bracket: 501 best-of-1
 * Grand Finals: WC Champion vs LC Champion (with potential bracket reset)
 */
exports.generateDoubleEliminationBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN if provided
        if (director_pin && tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

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
            format: 'heartbreaker',
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

            // Mingle period tracking (Heartbreaker)
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
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Generate Winners Bracket matches with teams placed
 */
function generateWinnersBracketMatches(teams, bracketSize, totalRounds) {
    const matches = [];
    let matchNum = 1;
    const firstRoundMatches = bracketSize / 2;

    // Round 1 - place teams
    for (let i = 0; i < firstRoundMatches; i++) {
        const team1 = teams[i * 2] || null;
        const team2 = teams[i * 2 + 1] || null;
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
 * Returns count of byes processed
 */
function autoAdvanceByes(winnersMatches) {
    let byeCount = 0;

    winnersMatches.forEach((match, idx) => {
        if (match.round === 1 && match.status === 'bye') {
            // One team has a bye - they auto-advance
            const advancingTeam = match.team1 || match.team2;
            const advancingId = match.team1_id || match.team2_id;

            if (advancingTeam) {
                match.winner_id = advancingId;
                match.status = 'completed';
                match.completed_at = new Date().toISOString();
                byeCount++;
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
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        // Get tournament
        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();

        // Normalize format (accept both hyphen and underscore)
        const format = (tournamentData.format || 'single_elimination').toLowerCase().replace(/-/g, '_');

        // Route to double elimination if that's the format
        if (format === 'double_elimination') {
            // For double elimination, use the dedicated endpoint
            return res.status(400).json({
                error: 'Use generateDoubleEliminationBracket for double elimination format'
            });
        }

        // Get checked-in players from tournament.players map
        const playersMap = tournamentData.players || {};
        const players = Object.entries(playersMap)
            .filter(([id, player]) => player.checkedIn === true)
            .map(([id, player]) => ({
                id: id,
                name: player.name,
                ...player
            }));

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
        res.status(500).json({ error: error.message });
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

// =============================================================================
// BRACKET EDITING FUNCTIONS
// =============================================================================

/**
 * Swap two positions in the bracket (only allowed before round 1 starts)
 */
exports.swapBracketPositions = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, position1, position2, director_pin } = req.body;

        if (!tournament_id || position1 === undefined || position2 === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN if required
        if (director_pin && tournament.director_pin && tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

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
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Regenerate bracket with new random seeding (only allowed before round 1 starts)
 */
exports.regenerateBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN
        if (director_pin && tournament.director_pin && tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

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

        // Check for completed matches
        const hasCompletedMatches = bracket.winners.some(m =>
            m.round === 1 && m.status === 'completed' && m.status !== 'bye'
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

        // Reshuffle teams
        const shuffled = [...teams].sort(() => Math.random() - 0.5);

        // Calculate bracket structure
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        const firstRoundMatches = bracketSize / 2;

        // Regenerate round 1 matches
        let matchNum = 1;
        bracket.winners = bracket.winners.map(match => {
            if (match.round === 1) {
                const pos = match.position;
                const team1 = shuffled[pos * 2] || null;
                const team2 = shuffled[pos * 2 + 1] || null;
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
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Lock bracket (called when first match is completed)
 */
exports.lockBracket = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);

        await tournamentRef.update({
            bracket_locked: true,
            bracket_locked_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Bracket locked' });

    } catch (error) {
        console.error('Lock bracket error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
