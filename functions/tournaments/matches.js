/**
 * Submit Match Result Cloud Function
 * REFACTORED to work with new unified structure
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

exports.submitMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }

    try {
        const { tournament_id, match_id, player1_score, player2_score } = req.body;

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

        // Update match
        bracket.matches[matchIndex] = {
            ...match,
            score: {
                player1: player1_score,
                player2: player2_score
            },
            winner: winner,
            status: 'completed',
            completedAt: admin.firestore.Timestamp.now()
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
