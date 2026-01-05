/**
 * Create Tournament Cloud Function
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.createTournament = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const {
            name,
            date,
            venue,
            format,
            entry_type,
            entry_fee,
            best_of,
            double_out,
            double_in,
            starting_score,
            payout_1st,
            payout_2nd,
            payout_3rd,
            payout_4th,
            sms_enabled
        } = req.body;
        
        // Validate required fields
        if (!name || !date || !format) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: name, date, format' 
            });
        }
        
        // Generate director PIN (4 digits)
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Create tournament document
        const tournamentData = {
            name,
            date,
            venue: venue || '',
            format,
            entry_type: entry_type || 'individual',
            entry_fee: parseFloat(entry_fee) || 0,
            best_of: parseInt(best_of) || 3,
            double_out: double_out !== false,
            double_in: double_in === true,
            starting_score: parseInt(starting_score) || 501,
            payout_1st: parseFloat(payout_1st) || 50,
            payout_2nd: parseFloat(payout_2nd) || 30,
            payout_3rd: parseFloat(payout_3rd) || 20,
            payout_4th: parseFloat(payout_4th) || 0,
            sms_enabled: sms_enabled === true,
            sms_credits: sms_enabled ? 100 : 0,
            director_pin: pin,
            status: 'created',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            bracket_generated: false,
            player_count: 0
        };
        
        const tournamentRef = await admin.firestore()
            .collection('tournaments')
            .add(tournamentData);
        
        console.log('Tournament created:', tournamentRef.id);
        
        res.json({
            success: true,
            tournament_id: tournamentRef.id,
            pin: pin,
            message: 'Tournament created successfully'
        });
        
    } catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
