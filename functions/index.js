/**
 * BRDC Tournament System - Firebase Cloud Functions
 * Main entry point for all backend functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Tournament Functions
const { createTournament } = require('./tournaments/create');
const { generateBracket } = require('./tournaments/brackets');
const { submitMatchResult } = require('./tournaments/matches');

// Export all functions
exports.createTournament = createTournament;
exports.generateBracket = generateBracket;
exports.submitMatchResult = submitMatchResult;

// Phase functions
const phase12 = require('./phase-1-2');
const phase34 = require('./phase-3-4');
const phase567 = require('./phase-5-6-7');

Object.assign(exports, phase12, phase34, phase567);


// ============================================================================
// ADDITIONAL TOURNAMENT DAY FUNCTIONS
// ============================================================================

exports.checkInPlayer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { tournament_id, registration_id } = req.body;
        if (!tournament_id || !registration_id) {
            return res.status(400).json({ success: false, error: 'tournament_id and registration_id required' });
        }
        await admin.firestore().collection('tournaments').doc(tournament_id).collection('registrations').doc(registration_id).update({ checked_in: true, check_in_time: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ success: true, message: 'Player checked in successfully' });
    } catch (error) {
        console.error('Error checking in player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.bulkCheckIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { tournament_id, registration_ids } = req.body;
        if (!tournament_id || !registration_ids || !Array.isArray(registration_ids)) {
            return res.status(400).json({ success: false, error: 'tournament_id and registration_ids array required' });
        }
        const batch = admin.firestore().batch();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        registration_ids.forEach(reg_id => {
            const ref = admin.firestore().collection('tournaments').doc(tournament_id).collection('registrations').doc(reg_id);
            batch.update(ref, { checked_in: true, check_in_time: timestamp });
        });
        await batch.commit();
        res.json({ success: true, checked_in_count: registration_ids.length, message: `${registration_ids.length} players checked in` });
    } catch (error) {
        console.error('Error bulk checking in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.addWalkIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { tournament_id, event_id, full_name, phone, email, amount_paid } = req.body;
        if (!tournament_id || !event_id || !full_name) {
            return res.status(400).json({ success: false, error: 'tournament_id, event_id, and full_name required' });
        }
        const eventDoc = await admin.firestore().collection('tournaments').doc(tournament_id).collection('events').doc(event_id).get();
        if (!eventDoc.exists) return res.status(404).json({ success: false, error: 'Event not found' });
        const event = eventDoc.data();
        const entryFee = event.entry_fee || 0;
        const paid = (amount_paid || 0) >= entryFee;
        const registration = {
            tournament_id, event_id, event_name: event.event_name, full_name,
            phone: phone || '', email: email || '', paid,
            amount_paid: amount_paid || 0, amount_owed: paid ? 0 : (entryFee - (amount_paid || 0)),
            checked_in: true, check_in_time: admin.firestore.FieldValue.serverTimestamp(),
            registration_type: 'walk_in', status: 'active', sms_opt_in: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        const regRef = await admin.firestore().collection('tournaments').doc(tournament_id).collection('registrations').add(registration);
        res.json({ success: true, registration_id: regRef.id, registration, message: 'Walk-in added successfully' });
    } catch (error) {
        console.error('Error adding walk-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.submitLeagueMatchScore = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { league_id, match_id, home_score, away_score } = req.body;
        if (!league_id || !match_id || home_score === undefined || away_score === undefined) {
            return res.status(400).json({ success: false, error: 'league_id, match_id, home_score, away_score required' });
        }
        const matchRef = admin.firestore().collection('leagues').doc(league_id).collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) return res.status(404).json({ success: false, error: 'Match not found' });
        const match = matchDoc.data();
        await matchRef.update({ home_score, away_score, status: 'completed', completed_at: admin.firestore.FieldValue.serverTimestamp() });
        const batch = admin.firestore().batch();
        const homeTeamRef = admin.firestore().collection('leagues').doc(league_id).collection('teams').doc(match.home_team_id);
        const awayTeamRef = admin.firestore().collection('leagues').doc(league_id).collection('teams').doc(match.away_team_id);
        if (home_score > away_score) {
            batch.update(homeTeamRef, { wins: admin.firestore.FieldValue.increment(1), points_for: admin.firestore.FieldValue.increment(home_score), points_against: admin.firestore.FieldValue.increment(away_score) });
            batch.update(awayTeamRef, { losses: admin.firestore.FieldValue.increment(1), points_for: admin.firestore.FieldValue.increment(away_score), points_against: admin.firestore.FieldValue.increment(home_score) });
        } else if (away_score > home_score) {
            batch.update(awayTeamRef, { wins: admin.firestore.FieldValue.increment(1), points_for: admin.firestore.FieldValue.increment(away_score), points_against: admin.firestore.FieldValue.increment(home_score) });
            batch.update(homeTeamRef, { losses: admin.firestore.FieldValue.increment(1), points_for: admin.firestore.FieldValue.increment(home_score), points_against: admin.firestore.FieldValue.increment(away_score) });
        } else {
            batch.update(homeTeamRef, { points_for: admin.firestore.FieldValue.increment(home_score), points_against: admin.firestore.FieldValue.increment(away_score) });
            batch.update(awayTeamRef, { points_for: admin.firestore.FieldValue.increment(away_score), points_against: admin.firestore.FieldValue.increment(home_score) });
        }
        await batch.commit();
        res.json({ success: true, match: { home_team: match.home_team_name, away_team: match.away_team_name, home_score, away_score, winner: home_score > away_score ? match.home_team_name : away_score > home_score ? match.away_team_name : 'Tie' }, message: 'Match score submitted' });
    } catch (error) {
        console.error('Error submitting league match score:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.getTournamentSummary = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const tournament_id = req.body.tournament_id || req.query.tournament_id;
        if (!tournament_id) return res.status(400).json({ success: false, error: 'tournament_id required' });
        const tournamentDoc = await admin.firestore().collection('tournaments').doc(tournament_id).get();
        if (!tournamentDoc.exists) return res.status(404).json({ success: false, error: 'Tournament not found' });
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
        const [eventsSnapshot, regsSnapshot, matchesSnapshot] = await Promise.all([
            admin.firestore().collection('tournaments').doc(tournament_id).collection('events').get(),
            admin.firestore().collection('tournaments').doc(tournament_id).collection('registrations').get(),
            admin.firestore().collection('tournaments').doc(tournament_id).collection('matches').get()
        ]);
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
        eventsSnapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
        const matches = [];
        let completedMatches = 0;
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            matches.push({ id: doc.id, ...match });
            if (match.status === 'completed') completedMatches++;
        });
        res.json({ success: true, tournament, stats: { events: eventsSnapshot.size, registrations: regsSnapshot.size, matches: matchesSnapshot.size, completed_matches: completedMatches, checked_in: checkedInCount, paid: paidCount, unpaid: regsSnapshot.size - paidCount, total_revenue: totalRevenue }, events, registrations, matches });
    } catch (error) {
        console.error('Error getting tournament summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.undoCheckIn = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
        const { tournament_id, registration_id } = req.body;
        if (!tournament_id || !registration_id) return res.status(400).json({ success: false, error: 'tournament_id and registration_id required' });
        await admin.firestore().collection('tournaments').doc(tournament_id).collection('registrations').doc(registration_id).update({ checked_in: false, check_in_time: null });
        res.json({ success: true, message: 'Check-in undone successfully' });
    } catch (error) {
        console.error('Error undoing check-in:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
