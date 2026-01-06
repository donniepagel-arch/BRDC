/**
 * Create Tournament Cloud Function
 * Accepts tournament data with events
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.createTournament = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    try {
        console.log('=== CREATE TOURNAMENT REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const data = req.body;
        
        // Validate required fields
        if (!data.tournament_name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing tournament_name' 
            });
        }
        
        if (!data.tournament_date) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing tournament_date' 
            });
        }
        
        if (!data.email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing email' 
            });
        }
        
        // Generate director PIN (4 digits)
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Create tournament document
        const tournamentData = {
            tournament_name: data.tournament_name,
            tournament_date: data.tournament_date,
            tournament_time: data.tournament_time || '',
            venue_name: data.venue_name || '',
            venue_address: data.venue_address || '',
            tournament_details: data.tournament_details || '',
            director_name: data.full_name || 'Unknown',
            director_email: data.email,
            director_phone: data.phone || '',
            director_pin: pin,
            status: 'created',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            event_count: data.events?.length || 0
        };
        
        console.log('Creating tournament:', tournamentData);
        
        const tournamentRef = await admin.firestore()
            .collection('tournaments')
            .add(tournamentData);
        
        const tournamentId = tournamentRef.id;
        console.log('Tournament created with ID:', tournamentId);
        
        // Create events if provided
        let eventsCreated = 0;
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
            console.log('Creating', data.events.length, 'events');
            
            const batch = admin.firestore().batch();
            
            data.events.forEach((event, index) => {
                const eventRef = admin.firestore()
                    .collection('tournaments')
                    .doc(tournamentId)
                    .collection('events')
                    .doc();
                
                const eventData = {
                    tournament_id: tournamentId,
                    event_number: index + 1,
                    event_name: event.event_name || `Event ${index + 1}`,
                    entry_type: event.entry_type || 'individual',
                    format: event.format || 'single_elim',
                    game: event.game || '501',
                    best_of: parseInt(event.best_of) || 3,
                    cork_rules: event.cork_rules || 'alternate',
                    in_option: event.in_option || 'free',
                    out_option: event.out_option || 'double',
                    entry_fee: parseFloat(event.entry_fee) || 0,
                    start_time: event.start_time || '',
                    event_details: event.event_details || '',
                    status: 'pending',
                    player_count: 0,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                };
                
                console.log(`Event ${index + 1}:`, eventData.event_name);
                batch.set(eventRef, eventData);
                eventsCreated++;
            });
            
            await batch.commit();
            console.log('All events created successfully');
        }
        
        const response = {
            success: true,
            tournament_id: tournamentId,
            pin: pin,
            message: 'Tournament created successfully',
            events_created: eventsCreated
        };
        
        console.log('Sending success response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('Error creating tournament:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
