/**
 * Submit Match Result Cloud Function
 * REFACTORED to work with new unified structure
 * Now includes stats aggregation for player leaderboards
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const { processTournamentMatchStats, recalculateTournamentStats } = require('./stats');

exports.submitMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, player1_score, player2_score, game_stats } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        if (!match_id) {
            return res.status(400).json({ error: 'Missing match_id' });
        }

        if (player1_score === undefined || player2_score === undefined) {
            return res.status(400).json({ error: 'Missing scores' });
        }

        // Get tournament
        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};

        if (!bracket.matches) {
            return res.status(400).json({ error: 'No bracket generated' });
        }

        // Find the match
        const matchIndex = bracket.matches.findIndex(m => m.id === match_id);

        if (matchIndex === -1) {
            return res.status(404).json({ error: 'Match not found' });
        }

        const match = bracket.matches[matchIndex];

        // Determine winner
        const winner = player1_score > player2_score ? match.player1 : match.player2;

        // Update match with comprehensive stats (DartConnect compatible)
        bracket.matches[matchIndex] = {
            ...match,
            score: {
                player1: player1_score,
                player2: player2_score
            },
            winner: winner,
            status: 'completed',
            completedAt: admin.firestore.Timestamp.now(),
            // Store comprehensive game stats if provided
            ...(game_stats && { stats: game_stats })
        };

        // Advance winner to next round if applicable
        if (match.round < bracket.totalRounds) {
            const nextRoundMatches = bracket.matches.filter(m => m.round === match.round + 1);
            const nextMatchPosition = Math.floor(match.position / 2);
            const nextMatch = nextRoundMatches[nextMatchPosition];

            if (nextMatch) {
                const nextMatchIndex = bracket.matches.findIndex(m => m.id === nextMatch.id);
                const isPlayer1Slot = match.position % 2 === 0;

                if (isPlayer1Slot) {
                    bracket.matches[nextMatchIndex].player1 = winner;
                } else {
                    bracket.matches[nextMatchIndex].player2 = winner;
                }

                // If both players are now set, make the match active
                if (bracket.matches[nextMatchIndex].player1 && bracket.matches[nextMatchIndex].player2) {
                    bracket.matches[nextMatchIndex].status = 'pending';
                }
            }
        }

        // Check if tournament is complete
        const allMatchesComplete = bracket.matches.every(m => m.status === 'completed');
        const finalMatch = bracket.matches.find(m => m.round === bracket.totalRounds);
        const tournamentComplete = finalMatch && finalMatch.status === 'completed';

        // Update tournament
        await tournamentRef.update({
            bracket: bracket,
            completed: tournamentComplete,
            ...(tournamentComplete && {
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                winner: finalMatch.winner
            })
        });

        // Process stats if game_stats provided
        if (game_stats) {
            const format = game_stats.format || tournamentData.format || '501';
            await processTournamentMatchStats(
                tournament_id,
                bracket.matches[matchIndex],
                game_stats,
                format
            );
        }

        res.json({
            success: true,
            match: bracket.matches[matchIndex],
            tournament_complete: tournamentComplete,
            ...(tournamentComplete && { winner: finalMatch.winner })
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================================================
// DOUBLE ELIMINATION MATCH RESULT (Heartbreaker Format)
// =============================================================================

/**
 * Submit match result for double-elimination tournaments
 * Handles advancement in both winners and losers brackets
 * Triggers Heartbreaker when team loses in Winners Bracket
 *
 * POST /submitDoubleElimMatchResult
 */
exports.submitDoubleElimMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            tournament_id,
            match_id,
            team1_score,
            team2_score,
            game_stats,
            director_pin
        } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        if (team1_score === undefined || team2_score === undefined) {
            return res.status(400).json({ success: false, error: 'Missing scores' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        const bracket = tournament.bracket;

        if (!bracket || bracket.type !== 'double_elimination') {
            return res.status(400).json({ success: false, error: 'Not a double elimination bracket' });
        }

        // Validate bracket structure
        if (!bracket.winners || !bracket.losers || !bracket.grand_finals) {
            return res.status(500).json({
                success: false,
                error: 'Invalid bracket structure - missing required arrays'
            });
        }

        // Verify director PIN if provided
        if (director_pin && tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

        // Find the match in winners or losers bracket
        let match = null;
        let matchArrayName = null;
        let matchIndex = -1;

        // Check winners bracket
        matchIndex = bracket.winners.findIndex(m => m.id === match_id);
        if (matchIndex !== -1) {
            match = bracket.winners[matchIndex];
            matchArrayName = 'winners';
        }

        // Check losers bracket
        if (!match) {
            matchIndex = bracket.losers.findIndex(m => m.id === match_id);
            if (matchIndex !== -1) {
                match = bracket.losers[matchIndex];
                matchArrayName = 'losers';
            }
        }

        // Check grand finals
        if (!match && match_id === 'gf-1') {
            match = bracket.grand_finals.match1;
            matchArrayName = 'grand_finals_1';
        }
        if (!match && match_id === 'gf-2') {
            match = bracket.grand_finals.match2;
            matchArrayName = 'grand_finals_2';
        }

        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        // Validate match status - prevent resubmitting completed matches
        if (match.status === 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Match already completed',
                match: match
            });
        }

        // Validate match is ready to play
        if (match.status === 'waiting') {
            return res.status(400).json({
                success: false,
                error: 'Match not ready - waiting for teams',
                match: match
            });
        }

        // Determine winner and loser
        const team1Won = team1_score > team2_score;
        const winner_id = team1Won ? match.team1_id : match.team2_id;
        const loser_id = team1Won ? match.team2_id : match.team1_id;
        const winner = team1Won ? match.team1 : match.team2;
        const loser = team1Won ? match.team2 : match.team1;

        // Update match result
        const updatedMatch = {
            ...match,
            scores: { team1: team1_score, team2: team2_score },
            winner_id,
            loser_id,
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp(),
            ...(game_stats && { stats: game_stats })
        };

        // Track what actions to take
        let heartbreakerTriggered = false;
        let teamEliminated = false;
        let advancedToNext = null;
        let droppedToLosers = null;
        let tournamentComplete = false;
        let tournamentChampion = null;

        // Handle advancement based on which bracket
        if (matchArrayName === 'winners') {
            // Winners Bracket: Winner advances in WC, loser goes to LC
            bracket.winners[matchIndex] = updatedMatch;

            // Advance winner in WC
            const advanceResult = advanceInWinnersBracket(bracket, match, winner_id, winner);
            advancedToNext = advanceResult.nextMatchId;

            // Check if this is WC Finals
            if (match.round === bracket.winners_rounds) {
                bracket.wc_champion_id = winner_id;
                bracket.wc_complete = true;

                // Place WC champion in Grand Finals
                bracket.grand_finals.match1.team1_id = winner_id;
                bracket.grand_finals.match1.team1 = winner;

                // Check if LC is also complete
                if (bracket.lc_champion_id) {
                    bracket.grand_finals.match1.team2_id = bracket.lc_champion_id;
                    // Get LC champion team data
                    const lcFinal = bracket.losers.find(m =>
                        m.round === bracket.losers_rounds && m.status === 'completed'
                    );
                    if (lcFinal) {
                        bracket.grand_finals.match1.team2 = lcFinal.winner_id === lcFinal.team1_id
                            ? lcFinal.team1 : lcFinal.team2;
                    }
                    bracket.grand_finals.match1.status = 'pending';
                }
            }

            // Drop loser to Losers Bracket (triggers Heartbreaker)
            const dropResult = dropToLosersBracket(bracket, match, loser_id, loser);
            droppedToLosers = dropResult.lcMatchId;
            heartbreakerTriggered = true;

        } else if (matchArrayName === 'losers') {
            // Losers Bracket: Winner advances in LC, loser is ELIMINATED
            bracket.losers[matchIndex] = updatedMatch;

            // Advance winner in LC
            const advanceResult = advanceInLosersBracket(bracket, match, winner_id, winner);
            advancedToNext = advanceResult.nextMatchId;

            // Check if this is LC Finals
            if (match.round === bracket.losers_rounds) {
                bracket.lc_champion_id = winner_id;
                bracket.lc_complete = true;

                // Place LC champion in Grand Finals
                bracket.grand_finals.match1.team2_id = winner_id;
                bracket.grand_finals.match1.team2 = winner;

                // Check if WC champion is waiting
                if (bracket.wc_champion_id) {
                    bracket.grand_finals.match1.status = 'pending';
                }
            }

            // Loser is eliminated (2nd loss)
            teamEliminated = true;

        } else if (matchArrayName === 'grand_finals_1') {
            // Grand Finals Match 1
            bracket.grand_finals.match1 = updatedMatch;

            if (winner_id === bracket.wc_champion_id) {
                // WC Champion wins - Tournament over!
                tournamentComplete = true;
                tournamentChampion = winner;
                bracket.tournament_champion_id = winner_id;
            } else {
                // LC Champion wins - Bracket reset needed!
                // Both teams get one loss, must play again

                // Verify champions are set
                if (!bracket.wc_champion_id || !bracket.lc_champion_id) {
                    return res.status(500).json({
                        success: false,
                        error: 'Cannot create bracket reset - champions not properly set'
                    });
                }

                // Get team data from the match we just completed
                const wcChampTeam = winner_id === bracket.wc_champion_id ? winner : loser;
                const lcChampTeam = winner_id === bracket.lc_champion_id ? winner : loser;

                bracket.grand_finals.bracket_reset_needed = true;
                bracket.grand_finals.match2 = {
                    id: 'gf-2',
                    round: 'grand_finals_reset',
                    team1_id: bracket.wc_champion_id,
                    team2_id: bracket.lc_champion_id,
                    team1: wcChampTeam,
                    team2: lcChampTeam,
                    winner_id: null,
                    scores: null,
                    status: 'pending',
                    board: null,
                    game_type: tournament.winners_game_type || 'cricket',
                    best_of: tournament.winners_best_of || 3
                };
            }

        } else if (matchArrayName === 'grand_finals_2') {
            // Grand Finals Match 2 (Bracket Reset)
            bracket.grand_finals.match2 = updatedMatch;
            tournamentComplete = true;
            tournamentChampion = winner;
            bracket.tournament_champion_id = winner_id;
        }

        // Check if mingle period should end
        // Mingle ends when LAST WC R2 match STARTS (not ends)
        checkMingleStatus(bracket);

        // Save updated bracket
        await tournamentRef.update({
            bracket: bracket,
            completed: tournamentComplete,
            ...(tournamentComplete && {
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                champion: tournamentChampion,
                champion_id: bracket.tournament_champion_id
            })
        });

        // Process stats if provided
        if (game_stats) {
            const format = matchArrayName === 'losers'
                ? (tournament.losers_game_type || '501')
                : (tournament.winners_game_type || 'cricket');

            await processTournamentMatchStats(tournament_id, updatedMatch, game_stats, format);
        }

        res.json({
            success: true,
            match: updatedMatch,
            bracket_type: matchArrayName,
            winner_id,
            loser_id,
            heartbreaker_triggered: heartbreakerTriggered,
            team_eliminated: teamEliminated,
            advanced_to: advancedToNext,
            dropped_to_losers: droppedToLosers,
            tournament_complete: tournamentComplete,
            ...(tournamentChampion && { champion: tournamentChampion })
        });

    } catch (error) {
        console.error('Submit double elim match result error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Advance winner in Winners Bracket
 *
 * Winners bracket is standard single-elimination tree:
 * - Each match winner advances to next round
 * - Position is halved each round (matches pair up)
 * - Even positions (0,2,4...) go to team1 slot
 * - Odd positions (1,3,5...) go to team2 slot
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The completed match
 * @param {string} winnerId - ID of winning team
 * @param {Object} winner - Winning team data
 * @returns {Object} - { nextMatchId: string|null }
 */
function advanceInWinnersBracket(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.winners_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // Find next match
    const nextPosition = Math.floor(match.position / 2);
    const nextMatch = bracket.winners.find(m =>
        m.round === nextRound && m.position === nextPosition
    );

    if (nextMatch) {
        const isSlot1 = match.position % 2 === 0;
        const nextIdx = bracket.winners.indexOf(nextMatch);

        if (isSlot1) {
            bracket.winners[nextIdx].team1_id = winnerId;
            bracket.winners[nextIdx].team1 = winner;
        } else {
            bracket.winners[nextIdx].team2_id = winnerId;
            bracket.winners[nextIdx].team2 = winner;
        }

        // If both teams present, match is ready
        if (bracket.winners[nextIdx].team1_id && bracket.winners[nextIdx].team2_id) {
            bracket.winners[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    console.warn(`No next match found for WC R${match.round} pos ${match.position}`);
    return { nextMatchId: null };
}

/**
 * Drop loser to Losers Bracket
 * Called when a team loses in Winners Bracket (their first loss)
 *
 * Losers bracket follows a specific dropout pattern:
 * - LC R1: WC R1 losers pair up (adjacent positions)
 * - LC R2+: WC losers drop into team2 slot to face LC survivor
 *
 * The target LC round/position is pre-calculated during bracket generation
 * and stored in the WC match as loser_goes_to_lc_round/position
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The WC match that was just completed
 * @param {string} loserId - ID of losing team (going to LC)
 * @param {Object} loser - Losing team data
 * @returns {Object} - { lcMatchId: string|null }
 */
function dropToLosersBracket(bracket, match, loserId, loser) {
    const lcRound = match.loser_goes_to_lc_round || 1;
    const lcPosition = match.loser_goes_to_lc_position || match.position;

    // Find the LC match for this loser
    const lcMatch = bracket.losers.find(m =>
        m.round === lcRound && m.position === lcPosition
    );

    if (lcMatch) {
        const lcIdx = bracket.losers.indexOf(lcMatch);

        // Determine which slot to place in
        if (lcMatch.round === 1) {
            // LC R1: WC R1 losers pair up
            // Even position WC matches → team1 slot
            // Odd position WC matches → team2 slot
            const isSlot1 = match.position % 2 === 0;
            if (isSlot1) {
                bracket.losers[lcIdx].team1_id = loserId;
                bracket.losers[lcIdx].team1 = loser;
            } else {
                bracket.losers[lcIdx].team2_id = loserId;
                bracket.losers[lcIdx].team2 = loser;
            }
        } else {
            // LC R2+: WC loser drops into team2 slot (team1 is LC survivor)
            bracket.losers[lcIdx].team2_id = loserId;
            bracket.losers[lcIdx].team2 = loser;
        }

        // If both teams present, match is ready
        if (bracket.losers[lcIdx].team1_id && bracket.losers[lcIdx].team2_id) {
            bracket.losers[lcIdx].status = 'pending';
        }

        return { lcMatchId: lcMatch.id };
    }

    console.warn(`No LC match found for WC R${match.round} pos ${match.position} loser`);
    return { lcMatchId: null };
}

/**
 * Advance winner in Losers Bracket
 *
 * Losers bracket alternates between consolidation and dropout rounds:
 * - Consolidation rounds: LC survivors play each other, winners advance at same position
 * - Dropout rounds: LC survivors face WC dropouts, winners pair up for next consolidation
 *
 * Position calculation:
 * - After DROPOUT round → divide position by 2 (winners pair up)
 * - After CONSOLIDATION round → keep same position (wait for WC dropout)
 *
 * Winners from any LC match go to team1 slot of next match
 * (team2 slot is reserved for WC dropouts in dropout rounds)
 *
 * @param {Object} bracket - Tournament bracket object
 * @param {Object} match - The completed LC match
 * @param {string} winnerId - ID of winning team
 * @param {Object} winner - Winning team data
 * @returns {Object} - { nextMatchId: string|null }
 */
function advanceInLosersBracket(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.losers_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // LC advancement depends on round type
    // After dropout round: winners pair up (divide by 2) for consolidation
    // After consolidation round: winners stay at same position (divide by 1) for dropout
    const isCurrentDropout = match.round_type === 'dropout';
    const nextMatch = bracket.losers.find(m =>
        m.round === nextRound && m.position === Math.floor(match.position / (isCurrentDropout ? 2 : 1))
    );

    if (nextMatch) {
        const nextIdx = bracket.losers.indexOf(nextMatch);

        // LC winners always go to team1 slot
        // (team2 slot reserved for WC dropouts)
        bracket.losers[nextIdx].team1_id = winnerId;
        bracket.losers[nextIdx].team1 = winner;

        // Match becomes ready when WC loser drops in (team2)
        if (bracket.losers[nextIdx].team2_id) {
            bracket.losers[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    console.warn(`No next LC match found for LC R${match.round} pos ${match.position}`);
    return { nextMatchId: null };
}

/**
 * Check and update mingle period status
 * Mingle ends when LAST WC R2 match STARTS (not when it ends)
 */
function checkMingleStatus(bracket) {
    if (!bracket.mingle_active) return;

    // Find all WC R2 matches
    const wcR2Matches = bracket.winners.filter(m => m.round === 2);

    // Check if ALL have started (status is 'in_progress' or 'completed')
    const allStarted = wcR2Matches.every(m =>
        m.status === 'in_progress' || m.status === 'completed'
    );

    if (allStarted) {
        bracket.mingle_active = false;
        bracket.mingle_ended_at = new Date().toISOString();
    }
}

/**
 * Start a match (for tracking mingle period end)
 */
exports.startDoubleElimMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, board } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or match_id' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        const bracket = tournament.bracket;

        // Find and update match
        let found = false;
        let mingleEnded = false;

        ['winners', 'losers'].forEach(bracketType => {
            const idx = bracket[bracketType].findIndex(m => m.id === match_id);
            if (idx !== -1) {
                bracket[bracketType][idx].status = 'in_progress';
                bracket[bracketType][idx].started_at = admin.firestore.FieldValue.serverTimestamp();
                if (board) bracket[bracketType][idx].board = board;
                found = true;

                // Check if this triggers mingle end
                if (bracketType === 'winners' && bracket[bracketType][idx].round === 2) {
                    checkMingleStatus(bracket);
                    mingleEnded = !bracket.mingle_active;
                }
            }
        });

        if (!found) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        await tournamentRef.update({ bracket });

        res.json({
            success: true,
            match_id,
            status: 'in_progress',
            mingle_ended: mingleEnded
        });

    } catch (error) {
        console.error('Start match error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Recalculate all stats for a tournament
 * POST /recalculateTournamentStats
 * Body: { tournament_id: string }
 */
exports.recalculateTournamentStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ error: 'Missing tournament_id' });
        }

        const result = await recalculateTournamentStats(tournament_id);

        res.json({
            success: true,
            matchesProcessed: result.matchesProcessed,
            playersUpdated: result.playersUpdated
        });

    } catch (error) {
        console.error('Error recalculating tournament stats:', error);
        res.status(500).json({ error: error.message });
    }
});
