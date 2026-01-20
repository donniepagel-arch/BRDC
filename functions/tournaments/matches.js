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
