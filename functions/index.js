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


// ===================================================================
// TOURNAMENT DAY OPERATIONS
// ===================================================================

// Check in a single player
exports.checkInPlayer = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerId } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      await tournamentRef.update({
        [`players.${playerId}.checkedIn`]: true,
        [`players.${playerId}.checkInTime`]: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true, message: 'Player checked in successfully' });
    } catch (error) {
      console.error('Error checking in player:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Bulk check-in multiple players
exports.bulkCheckIn = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerIds } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      const updates = {};
      playerIds.forEach(playerId => {
        updates[`players.${playerId}.checkedIn`] = true;
        updates[`players.${playerId}.checkInTime`] = admin.firestore.FieldValue.serverTimestamp();
      });
      
      await tournamentRef.update(updates);
      
      res.json({ 
        success: true, 
        message: `${playerIds.length} players checked in successfully`,
        checkedInCount: playerIds.length
      });
    } catch (error) {
      console.error('Error bulk checking in players:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Add walk-in player on tournament day
exports.addWalkIn = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerName, playerEmail, playerPhone } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      const tournament = tournamentDoc.data();
      const playerId = `walkin_${Date.now()}`;
      
      await tournamentRef.update({
        [`players.${playerId}`]: {
          name: playerName,
          email: playerEmail || null,
          phone: playerPhone || null,
          registrationTime: admin.firestore.FieldValue.serverTimestamp(),
          checkedIn: true,
          checkInTime: admin.firestore.FieldValue.serverTimestamp(),
          isWalkIn: true,
          paid: false
        }
      });
      
      res.json({ 
        success: true, 
        message: 'Walk-in player added successfully',
        playerId: playerId
      });
    } catch (error) {
      console.error('Error adding walk-in player:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Submit league match score
exports.submitLeagueMatchScore = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { leagueId, matchId, team1Score, team2Score } = req.body;
      
      const leagueRef = db.collection('leagues').doc(leagueId);
      const leagueDoc = await leagueRef.get();
      
      if (!leagueDoc.exists) {
        return res.status(404).json({ error: 'League not found' });
      }
      
      const league = leagueDoc.data();
      const match = league.schedule.find(m => m.id === matchId);
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      // Update match result
      match.team1Score = team1Score;
      match.team2Score = team2Score;
      match.completed = true;
      match.completedAt = admin.firestore.Timestamp.now();
      
      // Update standings
      const standings = league.standings || {};
      const team1 = match.team1;
      const team2 = match.team2;
      
      if (!standings[team1]) standings[team1] = { wins: 0, losses: 0, points: 0 };
      if (!standings[team2]) standings[team2] = { wins: 0, losses: 0, points: 0 };
      
      if (team1Score > team2Score) {
        standings[team1].wins++;
        standings[team1].points += 2;
        standings[team2].losses++;
      } else {
        standings[team2].wins++;
        standings[team2].points += 2;
        standings[team1].losses++;
      }
      
      await leagueRef.update({
        schedule: league.schedule,
        standings: standings
      });
      
      res.json({ 
        success: true, 
        message: 'Match score submitted and standings updated',
        standings: standings
      });
    } catch (error) {
      console.error('Error submitting league match score:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Get tournament summary (overview for tournament day)
exports.getTournamentSummary = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId } = req.query;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      const tournament = tournamentDoc.data();
      const players = tournament.players || {};
      
      const totalPlayers = Object.keys(players).length;
      const checkedInPlayers = Object.values(players).filter(p => p.checkedIn).length;
      const walkIns = Object.values(players).filter(p => p.isWalkIn).length;
      const paidPlayers = Object.values(players).filter(p => p.paid).length;
      
      const summary = {
        tournamentName: tournament.name,
        tournamentDate: tournament.date,
        format: tournament.format,
        totalPlayers: totalPlayers,
        checkedInPlayers: checkedInPlayers,
        walkIns: walkIns,
        paidPlayers: paidPlayers,
        pendingPayments: totalPlayers - paidPlayers,
        bracketGenerated: !!tournament.bracket,
        tournamentStarted: tournament.started || false,
        tournamentCompleted: tournament.completed || false
      };
      
      res.json(summary);
    } catch (error) {
      console.error('Error getting tournament summary:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Undo check-in (in case of mistakes)
exports.undoCheckIn = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerId } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      await tournamentRef.update({
        [`players.${playerId}.checkedIn`]: false,
        [`players.${playerId}.checkInTime`]: admin.firestore.FieldValue.delete()
      });
      
      res.json({ success: true, message: 'Check-in undone successfully' });
    } catch (error) {
      console.error('Error undoing check-in:', error);
      res.status(500).json({ error: error.message });
    }
  });
});
