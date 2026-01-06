/**
 * Generate Tournament Bracket Cloud Function
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

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
        
        // Get registrations
        const regsSnapshot = await admin.firestore()
            .collection('registrations')
            .where('tournament_id', '==', tournament_id)
            .where('checked_in', '==', true)
            .get();
        
        const players = regsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (players.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 checked-in players' });
        }
        
        // Generate bracket based on format
        let matches = [];
        
        if (tournamentData.format === 'single_elimination') {
            matches = generateSingleElimination(players, tournament_id);
        } else {
            return res.status(400).json({ error: 'Format not yet supported' });
        }
        
        // Save matches to Firestore
        const batch = admin.firestore().batch();
        
        matches.forEach(match => {
            const matchRef = admin.firestore().collection('matches').doc();
            batch.set(matchRef, match);
        });
        
        // Update tournament
        batch.update(tournamentRef, {
            bracket_generated: true,
            bracket_generated_at: admin.firestore.FieldValue.serverTimestamp(),
            player_count: players.length
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            matches_created: matches.length,
            players: players.length
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

function generateSingleElimination(players, tournament_id) {
    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    // Calculate rounds needed
    const totalRounds = Math.ceil(Math.log2(shuffled.length));
    const firstRoundMatches = Math.ceil(shuffled.length / 2);
    
    const matches = [];
    let matchNumber = 1;
    
    // Create first round
    for (let i = 0; i < firstRoundMatches; i++) {
        const player1 = shuffled[i * 2];
        const player2 = shuffled[i * 2 + 1];
        
        matches.push({
            tournament_id,
            match_number: matchNumber++,
            round: 1,
            position: i,
            player1_id: player1?.id || null,
            player1_name: player1?.player_name || 'BYE',
            player2_id: player2?.id || null,
            player2_name: player2?.player_name || 'BYE',
            player1_score: null,
            player2_score: null,
            winner_id: null,
            status: 'pending',
            board_number: null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    
    // Create subsequent rounds (empty matches)
    let previousRoundMatches = firstRoundMatches;
    for (let round = 2; round <= totalRounds; round++) {
        const roundMatches = Math.ceil(previousRoundMatches / 2);
        
        for (let i = 0; i < roundMatches; i++) {
            matches.push({
                tournament_id,
                match_number: matchNumber++,
                round,
                position: i,
                player1_id: null,
                player1_name: 'TBD',
                player2_id: null,
                player2_name: 'TBD',
                player1_score: null,
                player2_score: null,
                winner_id: null,
                status: 'pending',
                board_number: null,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        previousRoundMatches = roundMatches;
    }
    
    return matches;
}
