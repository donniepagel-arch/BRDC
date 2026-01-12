/**
 * BRDC Tournament & League System - Firebase Cloud Functions
 * Main entry point for all backend functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

admin.initializeApp();

const db = admin.firestore();

// Tournament Functions
const { createTournament } = require('./tournaments/create');
const { generateBracket } = require('./tournaments/brackets');
const { submitMatchResult } = require('./tournaments/matches');

// Export tournament functions
exports.createTournament = createTournament;

exports.generateBracket = generateBracket;
exports.submitMatchResult = submitMatchResult;

// League Functions (NEW - Triples Draft League System)
const leagueFunctions = require('./leagues/index');
Object.assign(exports, leagueFunctions);

// Phase functions (legacy - keeping for backwards compatibility)
const phase12 = require('./phase-1-2');
const phase34 = require('./phase-3-4');
const phase567 = require('./phase-5-6-7');

Object.assign(exports, phase12, phase34, phase567);


// ===================================================================
// TOURNAMENT DAY OPERATIONS (REFACTORED)
// ===================================================================

// Check in a single player
exports.checkInPlayer = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerId, playerName } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      // Get existing player data or create new
      const tournament = tournamentDoc.data();
      const existingPlayer = tournament.players?.[playerId] || {};
      
      await tournamentRef.update({
        [`players.${playerId}`]: {
          ...existingPlayer,
          name: playerName || existingPlayer.name || playerId,
          checkedIn: true,
          checkInTime: admin.firestore.FieldValue.serverTimestamp()
        }
      });
      
      res.json({ success: true, message: 'Player checked in successfully' });
    } catch (error) {
      console.error('Error checking in player:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Bulk check-in multiple players
exports.bulkCheckIn = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerIds, players } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
      const updates = {};
      
      // Support both formats:
      // 1. playerIds array (simple IDs, use ID as name)
      // 2. players array with {id, name}
      if (players && Array.isArray(players)) {
        players.forEach(player => {
          updates[`players.${player.id}`] = {
            name: player.name || player.id,
            checkedIn: true,
            checkInTime: admin.firestore.FieldValue.serverTimestamp(),
            paid: player.paid || false
          };
        });
      } else if (playerIds && Array.isArray(playerIds)) {
        playerIds.forEach(playerId => {
          updates[`players.${playerId}`] = {
            name: playerId, // Use ID as name if no name provided
            checkedIn: true,
            checkInTime: admin.firestore.FieldValue.serverTimestamp(),
            paid: false
          };
        });
      }
      
      await tournamentRef.update(updates);
      
      const count = players?.length || playerIds?.length || 0;
      res.json({ 
        success: true, 
        message: `${count} players checked in successfully`,
        checkedInCount: count
      });
    } catch (error) {
      console.error('Error bulk checking in players:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Add walk-in player on tournament day
exports.addWalkIn = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { tournamentId, playerName, playerEmail, playerPhone } = req.body;
      
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }
      
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
exports.submitLeagueMatchScore = functions.https.onRequest((req, res) => {
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
exports.getTournamentSummary = functions.https.onRequest((req, res) => {
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
        tournamentName: tournament.tournament_name,
        tournamentDate: tournament.tournament_date,
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
exports.undoCheckIn = functions.https.onRequest((req, res) => {
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

// ===================================================================
// ADD EVENT TO TOURNAMENT
// ===================================================================

exports.addEventToTournament = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { 
        tournament_id, 
        event_name, 
        format, 
        bracket_type, 
        max_players, 
        entry_fee, 
        event_details 
      } = req.body;
      
      // Validate required fields
      if (!tournament_id || !event_name || !format || !bracket_type) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: tournament_id, event_name, format, bracket_type' 
        });
      }
      
      // Check if tournament exists
      const tournamentRef = db.collection('tournaments').doc(tournament_id);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        return res.status(404).json({ 
          success: false, 
          error: 'Tournament not found' 
        });
      }
      
      // Create event document in subcollection
      const eventRef = await db
        .collection('tournaments')
        .doc(tournament_id)
        .collection('events')
        .add({
          event_name,
          format,
          bracket_type,
          max_players: max_players || 32,
          entry_fee: entry_fee || 0,
          event_details: event_details || '',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          status: 'registration_open',
          current_registrations: 0,
          bracket_generated: false
        });
      
      // Update tournament event_count
      await tournamentRef.update({
        event_count: admin.firestore.FieldValue.increment(1)
      });
      
      console.log('Event added successfully:', eventRef.id);
      
      return res.json({
        success: true,
        event_id: eventRef.id,
        message: 'Event added successfully'
      });
      
    } catch (error) {
      console.error('Error adding event:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
});
