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
const { createTournament, addBotToTournament, updateTournamentSettings, deleteTournament } = require('./tournaments/create');
const { generateBracket } = require('./tournaments/brackets');
const { submitMatchResult } = require('./tournaments/matches');

// Export tournament functions
exports.createTournament = createTournament;
exports.addBotToTournament = addBotToTournament;
exports.updateTournamentSettings = updateTournamentSettings;
exports.deleteTournament = deleteTournament;
exports.generateBracket = generateBracket;
exports.submitMatchResult = submitMatchResult;

// League Functions (NEW - Triples Draft League System)
const leagueFunctions = require('./leagues/index');
Object.assign(exports, leagueFunctions);

// Player Profile & Captain Functions
const playerFunctions = require('./player-profile');
Object.assign(exports, playerFunctions);

// Bot Player Management Functions (legacy - keeping for backwards compatibility)
const botFunctions = require('./bots');
Object.assign(exports, botFunctions);

// Global Player Authentication & Registration
const globalAuthFunctions = require('./global-auth');
Object.assign(exports, globalAuthFunctions);

// Notification Functions (scheduled reminders, SMS/email)
const notificationFunctions = require('./notifications');
Object.assign(exports, notificationFunctions);

// Admin Functions
const adminFunctions = require('./admin-functions');
Object.assign(exports, adminFunctions);

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

// ===================================================================
// TEMPLATE & DRAFT FUNCTIONS
// ===================================================================

// Helper to remove undefined values from an object (recursive)
function cleanUndefined(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Helper to verify director PIN and get player ID
async function verifyDirectorPin(pin) {
  const playersSnapshot = await db.collection('players')
    .where('pin', '==', pin)
    .limit(1)
    .get();

  if (playersSnapshot.empty) {
    return null;
  }

  return playersSnapshot.docs[0].id;
}

// ===== LEAGUE TEMPLATES =====

exports.saveLeagueTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_name, template_data } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      await db.collection('league_templates').add({
        player_id: playerId,
        name: template_name,
        data: cleanUndefined(template_data),
        events_count: template_data?.events?.length || 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, message: 'Template saved' });
    } catch (error) {
      console.error('Error saving league template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getLeagueTemplates = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      console.log('getLeagueTemplates called with PIN:', authPin ? 'provided' : 'missing');

      const playerId = await verifyDirectorPin(authPin);
      console.log('Verified player_id:', playerId);

      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      // Simple query without orderBy to avoid index issues
      const templatesSnapshot = await db.collection('league_templates')
        .where('player_id', '==', playerId)
        .get();

      console.log('Templates found:', templatesSnapshot.size);

      const templates = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        events_count: doc.data().events_count || 0,
        created_at: doc.data().created_at?.toDate?.() || doc.data().created_at || new Date()
      }));

      // Sort in JS instead
      templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({ success: true, templates });
    } catch (error) {
      console.error('Error getting league templates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getLeagueTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_id } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const templateDoc = await db.collection('league_templates').doc(template_id).get();
      if (!templateDoc.exists) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      const template = templateDoc.data();
      if (template.player_id !== playerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      res.json({ success: true, template: { id: templateDoc.id, ...template } });
    } catch (error) {
      console.error('Error getting league template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.deleteLeagueTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_id } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const templateDoc = await db.collection('league_templates').doc(template_id).get();
      if (!templateDoc.exists) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      if (templateDoc.data().player_id !== playerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      await db.collection('league_templates').doc(template_id).delete();
      res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
      console.error('Error deleting league template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ===== LEAGUE DRAFTS =====

exports.saveLeagueDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, draft_data } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      // Check for existing draft
      const existingDrafts = await db.collection('league_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (!existingDrafts.empty) {
        // Update existing draft
        await db.collection('league_drafts').doc(existingDrafts.docs[0].id).update({
          data: cleanUndefined(draft_data),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new draft
        await db.collection('league_drafts').add({
          player_id: playerId,
          data: cleanUndefined(draft_data),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ success: true, message: 'Draft saved' });
    } catch (error) {
      console.error('Error saving league draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getLeagueDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const draftsSnapshot = await db.collection('league_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (draftsSnapshot.empty) {
        return res.json({ success: true, draft: null });
      }

      const draftDoc = draftsSnapshot.docs[0];
      res.json({
        success: true,
        draft: {
          id: draftDoc.id,
          ...draftDoc.data(),
          updated_at: draftDoc.data().updated_at?.toDate?.()?.toISOString() || null
        }
      });
    } catch (error) {
      console.error('Error getting league draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.deleteLeagueDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const draftsSnapshot = await db.collection('league_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (!draftsSnapshot.empty) {
        await db.collection('league_drafts').doc(draftsSnapshot.docs[0].id).delete();
      }

      res.json({ success: true, message: 'Draft deleted' });
    } catch (error) {
      console.error('Error deleting league draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ===== TOURNAMENT TEMPLATES =====

exports.saveTournamentTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_name, template_data } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      await db.collection('tournament_templates').add({
        player_id: playerId,
        name: template_name,
        data: cleanUndefined(template_data),
        events_count: template_data?.events?.length || 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, message: 'Template saved' });
    } catch (error) {
      console.error('Error saving tournament template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getTournamentTemplates = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      console.log('getTournamentTemplates called with PIN:', authPin ? 'provided' : 'missing');

      const playerId = await verifyDirectorPin(authPin);
      console.log('Verified player_id:', playerId);

      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      // Simple query without orderBy to avoid index issues
      const templatesSnapshot = await db.collection('tournament_templates')
        .where('player_id', '==', playerId)
        .get();

      console.log('Tournament templates found:', templatesSnapshot.size);

      const templates = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        events_count: doc.data().events_count || 0,
        created_at: doc.data().created_at?.toDate?.() || doc.data().created_at || new Date()
      }));

      // Sort in JS instead
      templates.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({ success: true, templates });
    } catch (error) {
      console.error('Error getting tournament templates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getTournamentTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_id } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const templateDoc = await db.collection('tournament_templates').doc(template_id).get();
      if (!templateDoc.exists) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      const template = templateDoc.data();
      if (template.player_id !== playerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      res.json({ success: true, template: { id: templateDoc.id, ...template } });
    } catch (error) {
      console.error('Error getting tournament template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.deleteTournamentTemplate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, template_id } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const templateDoc = await db.collection('tournament_templates').doc(template_id).get();
      if (!templateDoc.exists) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      if (templateDoc.data().player_id !== playerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      await db.collection('tournament_templates').doc(template_id).delete();
      res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
      console.error('Error deleting tournament template:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ===== TOURNAMENT DRAFTS =====

exports.saveTournamentDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin, draft_data } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      // Check for existing draft
      const existingDrafts = await db.collection('tournament_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (!existingDrafts.empty) {
        // Update existing draft
        await db.collection('tournament_drafts').doc(existingDrafts.docs[0].id).update({
          data: cleanUndefined(draft_data),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new draft
        await db.collection('tournament_drafts').add({
          player_id: playerId,
          data: cleanUndefined(draft_data),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({ success: true, message: 'Draft saved' });
    } catch (error) {
      console.error('Error saving tournament draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.getTournamentDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const draftsSnapshot = await db.collection('tournament_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (draftsSnapshot.empty) {
        return res.json({ success: true, draft: null });
      }

      const draftDoc = draftsSnapshot.docs[0];
      res.json({
        success: true,
        draft: {
          id: draftDoc.id,
          ...draftDoc.data(),
          updated_at: draftDoc.data().updated_at?.toDate?.()?.toISOString() || null
        }
      });
    } catch (error) {
      console.error('Error getting tournament draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

exports.deleteTournamentDraft = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin, director_pin } = req.body;
      const authPin = pin || director_pin;

      const playerId = await verifyDirectorPin(authPin);
      if (!playerId) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
      }

      const draftsSnapshot = await db.collection('tournament_drafts')
        .where('player_id', '==', playerId)
        .limit(1)
        .get();

      if (!draftsSnapshot.empty) {
        await db.collection('tournament_drafts').doc(draftsSnapshot.docs[0].id).delete();
      }

      res.json({ success: true, message: 'Draft deleted' });
    } catch (error) {
      console.error('Error deleting tournament draft:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// DEBUG: List all templates to see player_ids
exports.debugListAllTemplates = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const leagueTemplates = await db.collection('league_templates').get();
      const tournamentTemplates = await db.collection('tournament_templates').get();

      const result = {
        league_templates: leagueTemplates.docs.map(doc => ({
          id: doc.id,
          player_id: doc.data().player_id,
          name: doc.data().name
        })),
        tournament_templates: tournamentTemplates.docs.map(doc => ({
          id: doc.id,
          player_id: doc.data().player_id,
          name: doc.data().name
        }))
      };

      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// DEBUG: Check what player_id a PIN resolves to
exports.debugCheckPin = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { pin } = req.body;
      if (!pin) {
        return res.status(400).json({ success: false, error: 'Missing pin' });
      }

      const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

      if (playersSnapshot.empty) {
        return res.json({ success: false, error: 'PIN not found', player_id: null });
      }

      const playerDoc = playersSnapshot.docs[0];
      res.json({
        success: true,
        player_id: playerDoc.id,
        player_name: playerDoc.data().first_name + ' ' + playerDoc.data().last_name,
        player_email: playerDoc.data().email
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});
