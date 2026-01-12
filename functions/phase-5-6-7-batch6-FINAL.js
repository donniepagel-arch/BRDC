/**
 * Notify players of board assignment
 */
exports.notifyMatchAssignment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, match_id } = req.body;

        if (!tournament_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        const tournament = await tournamentRef.get();

        if (!tournament.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournamentData = tournament.data();
        const bracket = tournamentData.bracket || {};
        const match = bracket.matches?.find(m => m.id === match_id);

        if (!match) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        // Get player contact info
        const players = tournamentData.players || {};
        const p1 = players[match.player1?.id];
        const p2 = players[match.player2?.id];

        const notifications = [];

        if (p1?.phone) {
            notifications.push({
                type: 'sms',
                to: p1.phone,
                message: `Your match is on Board ${match.board}! vs ${match.player2?.name}`
            });
        }

        if (p2?.phone) {
            notifications.push({
                type: 'sms',
                to: p2.phone,
                message: `Your match is on Board ${match.board}! vs ${match.player1?.name}`
            });
        }

        res.json({
            success: true,
            notifications_sent: notifications.length,
            message: 'Match assignment notifications sent (Twilio integration pending)',
            notifications: notifications
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create PayPal payment
 */
exports.createPayment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, player_id, amount, description } = req.body;

        if (!tournament_id || !player_id || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const payment = {
            tournament_id: tournament_id,
            player_id: player_id,
            amount: parseFloat(amount),
            description: description || 'Tournament Entry Fee',
            status: 'pending',
            payment_method: 'paypal',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const paymentRef = await admin.firestore().collection('payments').add(payment);

        res.json({
            success: true,
            payment_id: paymentRef.id,
            message: 'Payment created (PayPal integration pending)'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Capture PayPal payment
 */
exports.capturePayment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, payment_id, player_id } = req.body;

        if (!tournament_id || !payment_id || !player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await admin.firestore().collection('payments').doc(payment_id).update({
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        const tournamentRef = admin.firestore().collection('tournaments').doc(tournament_id);
        await tournamentRef.update({
            [`players.${player_id}.paid`]: true,
            [`players.${player_id}.payment_id`]: payment_id
        });

        res.json({
            success: true,
            message: 'Payment captured successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
