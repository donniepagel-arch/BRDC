/**
 * Submit Match Result Cloud Function
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.submitMatchResult = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }
    
    try {
        const { match_id, player1_score, player2_score } = req.body;
        
        if (!match_id) {
            return res.status(400).json({ error: 'Missing match_id' });
        }
        
        // Get match
        const matchRef = admin.firestore().collection('matches').doc(match_id);
        const match = await matchRef.get();
        
        if (!match.exists) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        const matchData = match.data();
        
        // Determine winner
        const winner_id = player1_score > player2_score ? 
            matchData.player1_id : matchData.player2_id;
        
        // Update match
        await matchRef.update({
            player1_score,
            player2_score,
            winner_id,
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Advance bracket (find next match)
        const nextRound = matchData.round + 1;
        const nextPosition = Math.floor(matchData.position / 2);
        
        const nextMatchSnapshot = await admin.firestore()
            .collection('matches')
            .where('tournament_id', '==', matchData.tournament_id)
            .where('round', '==', nextRound)
            .where('position', '==', nextPosition)
            .limit(1)
            .get();
        
        if (!nextMatchSnapshot.empty) {
            const nextMatch = nextMatchSnapshot.docs[0];
            const isPlayer1Slot = matchData.position % 2 === 0;
            
            await nextMatch.ref.update({
                [isPlayer1Slot ? 'player1_id' : 'player2_id']: winner_id,
                [isPlayer1Slot ? 'player1_name' : 'player2_name']: 
                    player1_score > player2_score ? matchData.player1_name : matchData.player2_name
            });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
