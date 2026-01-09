/**
 * Generate Tournament Bracket Cloud Function
 * REFACTORED to work with new unified structure
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

exports.generateBracket = functions.https.onRequest(async (req, res) => {
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

        // Get tournament
        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();

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

        // Generate bracket based on format
        let bracket = {};

        if (tournamentData.format === 'single-elimination' || tournamentData.format === 'single_elimination') {
            bracket = generateSingleElimination(players, tournament_id);
        } else {
            return res.status(400).json({ error: 'Format not yet supported' });
        }

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
                name: player1.name
            } : null,
            player2: player2 ? {
                id: player2.id,
                name: player2.name
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
                board: null,
                feedsFrom: {
                    match1: `match-${previousRoundMatches * (round - 2) + 1 + (i * 2)}`,
                    match2: `match-${previousRoundMatches * (round - 2) + 2 + (i * 2)}`
                }
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
