/**
 * BRDC Additional Functions
 * Essential tournament day operations
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ============================================================================
// 1. CHECK IN PLAYER
// ============================================================================

/**
 * Check in a single player for tournament
 */
exports.checkInPlayer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, registration_id } = req.body;
        
        if (!tournament_id || !registration_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'tournament_id and registration_id are required' 
            });
        }
        
        // Update registration
        await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('registrations').doc(registration_id)
            .update({
                checked_in: true,
                check_in_time: admin.firestore.FieldValue.serverTimestamp()
            });
        
        res.json({
            success: true,
            message: 'Player checked in successfully'
        });
        
    } catch (error) {
        console.error('Error checking in player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// 2. BULK CHECK IN
// ============================================================================

/**
 * Check in multiple players at once
 */
exports.bulkCheckIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, registration_ids } = req.body;
        
        if (!tournament_id || !registration_ids || !Array.isArray(registration_ids)) {
            return res.status(400).json({ 
                success: false, 
                error: 'tournament_id and registration_ids array are required' 
            });
        }
        
        // Use batch to update multiple registrations
        const batch = admin.firestore().batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        
        registration_ids.forEach(reg_id => {
            const ref = admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('registrations').doc(reg_id);
            
            batch.update(ref, {
                checked_in: true,
                check_in_time: timestamp
            });
        });
        
        await batch.commit();
        
        res.json({
            success: true,
            checked_in_count: registration_ids.length,
            message: `${registration_ids.length} players checked in successfully`
        });
        
    } catch (error) {
        console.error('Error bulk checking in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// 3. ADD WALK-IN
// ============================================================================

/**
 * Add walk-in player on tournament day
 */
exports.addWalkIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { 
            tournament_id, 
            event_id, 
            full_name, 
            phone, 
            email,
            amount_paid 
        } = req.body;
        
        if (!tournament_id || !event_id || !full_name) {
            return res.status(400).json({ 
                success: false, 
                error: 'tournament_id, event_id, and full_name are required' 
            });
        }
        
        // Get event details for entry fee
        const eventDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('events').doc(event_id)
            .get();
        
        if (!eventDoc.exists) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        
        const event = eventDoc.data();
        const entryFee = event.entry_fee || 0;
        const paid = (amount_paid || 0) >= entryFee;
        
        // Create walk-in registration
        const registration = {
            tournament_id,
            event_id,
            event_name: event.event_name,
            full_name,
            phone: phone || '',
            email: email || '',
            paid,
            amount_paid: amount_paid || 0,
            amount_owed: paid ? 0 : (entryFee - (amount_paid || 0)),
            checked_in: true, // Walk-ins are auto-checked-in
            check_in_time: admin.firestore.FieldValue.serverTimestamp(),
            registration_type: 'walk_in',
            status: 'active',
            sms_opt_in: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const regRef = await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('registrations')
            .add(registration);
        
        res.json({
            success: true,
            registration_id: regRef.id,
            registration,
            message: 'Walk-in added and checked in successfully'
        });
        
    } catch (error) {
        console.error('Error adding walk-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// 4. SUBMIT LEAGUE MATCH SCORE
// ============================================================================

/**
 * Submit score for league match and update team records
 */
exports.submitLeagueMatchScore = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { league_id, match_id, home_score, away_score } = req.body;
        
        if (!league_id || !match_id || home_score === undefined || away_score === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'league_id, match_id, home_score, and away_score are required' 
            });
        }
        
        // Get match details
        const matchRef = admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }
        
        const match = matchDoc.data();
        
        // Update match
        await matchRef.update({
            home_score,
            away_score,
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Update team records
        const batch = admin.firestore().batch();
        
        const homeTeamRef = admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        
        const awayTeamRef = admin.firestore()
            .collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);
        
        if (home_score > away_score) {
            // Home team wins
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points_for: admin.firestore.FieldValue.increment(home_score),
                points_against: admin.firestore.FieldValue.increment(away_score)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                points_for: admin.firestore.FieldValue.increment(away_score),
                points_against: admin.firestore.FieldValue.increment(home_score)
            });
        } else if (away_score > home_score) {
            // Away team wins
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points_for: admin.firestore.FieldValue.increment(away_score),
                points_against: admin.firestore.FieldValue.increment(home_score)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                points_for: admin.firestore.FieldValue.increment(home_score),
                points_against: admin.firestore.FieldValue.increment(away_score)
            });
        } else {
            // Tie (both teams get points but no win/loss)
            batch.update(homeTeamRef, {
                points_for: admin.firestore.FieldValue.increment(home_score),
                points_against: admin.firestore.FieldValue.increment(away_score)
            });
            batch.update(awayTeamRef, {
                points_for: admin.firestore.FieldValue.increment(away_score),
                points_against: admin.firestore.FieldValue.increment(home_score)
            });
        }
        
        await batch.commit();
        
        res.json({
            success: true,
            match: {
                home_team: match.home_team_name,
                away_team: match.away_team_name,
                home_score,
                away_score,
                winner: home_score > away_score ? match.home_team_name : 
                       away_score > home_score ? match.away_team_name : 'Tie'
            },
            message: 'Match score submitted and team records updated'
        });
        
    } catch (error) {
        console.error('Error submitting league match score:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// 5. GET TOURNAMENT SUMMARY
// ============================================================================

/**
 * Get complete tournament overview in one call
 */
exports.getTournamentSummary = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const tournament_id = req.body.tournament_id || req.query.tournament_id;
        
        if (!tournament_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'tournament_id is required' 
            });
        }
        
        // Get tournament
        const tournamentDoc = await admin.firestore()
            .collection('tournaments').doc(tournament_id).get();
        
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }
        
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
        
        // Get all subcollections in parallel
        const [eventsSnapshot, regsSnapshot, matchesSnapshot] = await Promise.all([
            admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('events').get(),
            admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('registrations').get(),
            admin.firestore()
                .collection('tournaments').doc(tournament_id)
                .collection('matches').get()
        ]);
        
        // Calculate stats
        const registrations = [];
        let totalRevenue = 0;
        let checkedInCount = 0;
        let paidCount = 0;
        
        regsSnapshot.forEach(doc => {
            const reg = doc.data();
            registrations.push({ id: doc.id, ...reg });
            totalRevenue += (reg.amount_paid || 0);
            if (reg.checked_in) checkedInCount++;
            if (reg.paid) paidCount++;
        });
        
        const events = [];
        eventsSnapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });
        
        const matches = [];
        let completedMatches = 0;
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            matches.push({ id: doc.id, ...match });
            if (match.status === 'completed') completedMatches++;
        });
        
        res.json({
            success: true,
            tournament,
            stats: {
                events: eventsSnapshot.size,
                registrations: regsSnapshot.size,
                matches: matchesSnapshot.size,
                completed_matches: completedMatches,
                checked_in: checkedInCount,
                paid: paidCount,
                unpaid: regsSnapshot.size - paidCount,
                total_revenue: totalRevenue
            },
            events,
            registrations,
            matches
        });
        
    } catch (error) {
        console.error('Error getting tournament summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// BONUS: UNDO CHECK-IN (Helpful utility)
// ============================================================================

/**
 * Undo player check-in (in case of mistake)
 */
exports.undoCheckIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(204).send('');
    
    try {
        const { tournament_id, registration_id } = req.body;
        
        if (!tournament_id || !registration_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'tournament_id and registration_id are required' 
            });
        }
        
        await admin.firestore()
            .collection('tournaments').doc(tournament_id)
            .collection('registrations').doc(registration_id)
            .update({
                checked_in: false,
                check_in_time: null
            });
        
        res.json({
            success: true,
            message: 'Check-in undone successfully'
        });
        
    } catch (error) {
        console.error('Error undoing check-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
