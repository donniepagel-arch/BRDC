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
const { submitMatchResult, recalculateTournamentStats } = require('./tournaments/matches');

// Export tournament functions
exports.createTournament = createTournament;
exports.addBotToTournament = addBotToTournament;
exports.updateTournamentSettings = updateTournamentSettings;
exports.deleteTournament = deleteTournament;
exports.generateBracket = generateBracket;
exports.submitMatchResult = submitMatchResult;
exports.recalculateTournamentStats = recalculateTournamentStats;

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
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const notificationFunctions = require('./notifications');
// Object.assign(exports, notificationFunctions);

// Admin Functions
const adminFunctions = require('./admin-functions');
Object.assign(exports, adminFunctions);

// Messaging System (Phase 1 Social Platform)
const messagingFunctions = require('./messaging');
Object.assign(exports, messagingFunctions);

// Chat Rooms (Phase 1 Social Platform)
const chatRoomFunctions = require('./chat-rooms');
Object.assign(exports, chatRoomFunctions);

// Message Digest (Phase 1 Social Platform - SMS notifications)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const messageDigestFunctions = require('./message-digest');
// Object.assign(exports, messageDigestFunctions);

// Presence System (Phase 2 Social Platform)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const presenceFunctions = require('./presence');
// Object.assign(exports, presenceFunctions);

// Social Features (Phase 3 Social Platform - reactions, cheers, achievements)
const socialFunctions = require('./social');
Object.assign(exports, socialFunctions);

// Online Play (Phase 4 Social Platform - challenges, online matches)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const onlinePlayFunctions = require('./online-play');
// Object.assign(exports, onlinePlayFunctions);

// Mini Tournaments (Phase 5 Social Platform - quick brackets in scorer)
const miniTournamentFunctions = require('./mini-tournaments');
Object.assign(exports, miniTournamentFunctions);

// Advanced Features (Phase 6 - spectate, replay, handicap, bounty board)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const advancedFeaturesFunctions = require('./advanced-features');
// Object.assign(exports, advancedFeaturesFunctions);

// Stats Unification (Phase 7 - unified average, leaderboards, practice mode)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const statsUnificationFunctions = require('./stats-unification');
// Object.assign(exports, statsUnificationFunctions);

// Match Import Functions (temporary - for DartConnect data import)
const importMatchFunctions = require('./import-matches');
Object.assign(exports, importMatchFunctions);

// Test Import Functions (temporary - verify imported data)
const testImportFunctions = require('./test-import');
Object.assign(exports, testImportFunctions);

// Phase functions (legacy - keeping for backwards compatibility)
const phase12 = require('./phase-1-2');
const phase34 = require('./phase-3-4');
const phase567 = require('./phase-5-6-7');

Object.assign(exports, phase12, phase34, phase567);

// Pickup Games (casual game tracking)
const pickupGamesFunctions = require('./pickup-games');
Object.assign(exports, pickupGamesFunctions);

// 8-Team Knockout Tournaments
const knockoutFunctions = require('./knockout');
Object.assign(exports, knockoutFunctions);

// Feedback/Debug Reports
const feedbackFunctions = require('./feedback');
Object.assign(exports, feedbackFunctions);

// Matchmaker Tournaments (partner matching, mixed doubles, breakup mechanics)
const matchmakerFunctions = require('./matchmaker');
Object.assign(exports, matchmakerFunctions);

// Notable Performances (homepage featured performances)
const notablePerformancesFunctions = require('./notable-performances');
Object.assign(exports, notablePerformancesFunctions);

// Push Notifications (tiered: FCM > SMS > Email)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const pushNotificationFunctions = require('./push-notifications');
// Object.assign(exports, pushNotificationFunctions);


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

/**
 * Fix team names in a league to match captain-based naming
 * POST /fixLeagueTeamNames
 * Body: { league_id, team_names: { "Team 1": "D. Russano", ... } }
 */
exports.fixLeagueTeamNames = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { league_id, team_names } = req.body;

      if (!league_id || !team_names) {
        return res.status(400).json({ success: false, error: 'Missing league_id or team_names' });
      }

      console.log('Fixing team names for league:', league_id);
      console.log('Name mappings:', team_names);

      // Update team documents
      const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
      console.log(`Found ${teamsSnap.size} teams`);

      const teamUpdates = [];
      const batch = db.batch();

      teamsSnap.forEach(doc => {
        const data = doc.data();
        const oldName = data.team_name;
        const newName = team_names[oldName];

        if (newName) {
          batch.update(doc.ref, { team_name: newName });
          teamUpdates.push({ docId: doc.id, oldName, newName });
          console.log(`  ${oldName} -> ${newName}`);
        }
      });

      if (teamUpdates.length > 0) {
        await batch.commit();
        console.log(`Updated ${teamUpdates.length} team documents`);
      }

      // Update match documents
      const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();
      console.log(`Found ${matchesSnap.size} matches`);

      let matchUpdateCount = 0;
      // Process in batches of 500
      let matchBatch = db.batch();
      let batchCount = 0;

      for (const doc of matchesSnap.docs) {
        const match = doc.data();
        const updateFields = {};

        if (match.home_team_name && team_names[match.home_team_name]) {
          updateFields.home_team_name = team_names[match.home_team_name];
        }
        if (match.away_team_name && team_names[match.away_team_name]) {
          updateFields.away_team_name = team_names[match.away_team_name];
        }

        if (Object.keys(updateFields).length > 0) {
          matchBatch.update(doc.ref, updateFields);
          matchUpdateCount++;
          batchCount++;

          if (batchCount >= 500) {
            await matchBatch.commit();
            matchBatch = db.batch();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await matchBatch.commit();
      }

      console.log(`Updated ${matchUpdateCount} match documents`);

      res.json({
        success: true,
        teams_updated: teamUpdates.length,
        matches_updated: matchUpdateCount,
        updates: teamUpdates
      });

    } catch (error) {
      console.error('Error fixing team names:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Fix match team IDs - populate home_team_id and away_team_id based on team names
 * POST /fixMatchTeamIds
 * Body: { league_id }
 */
exports.fixMatchTeamIds = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { league_id } = req.body;

      if (!league_id) {
        return res.status(400).json({ success: false, error: 'Missing league_id' });
      }

      console.log('Fixing match team IDs for league:', league_id);

      // Get all teams and build name -> ID map
      const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
      const teamNameToId = {};
      const teamIdToName = {};

      teamsSnap.forEach(doc => {
        const data = doc.data();
        const teamName = data.team_name;
        if (teamName) {
          teamNameToId[teamName] = doc.id;
          teamIdToName[doc.id] = teamName;
        }
      });

      console.log('Team mappings:', teamNameToId);

      // Get all matches
      const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();
      console.log(`Found ${matchesSnap.size} matches`);

      let updatedCount = 0;
      let matchBatch = db.batch();
      let batchCount = 0;
      const sampleMatches = [];

      for (const doc of matchesSnap.docs) {
        const match = doc.data();
        const updateFields = {};

        // Log first few matches for debugging
        if (sampleMatches.length < 3) {
          sampleMatches.push({
            id: doc.id,
            home_team_name: match.home_team_name,
            away_team_name: match.away_team_name,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
            week: match.week
          });
        }

        // Look up team ID from team name
        const homeTeamId = teamNameToId[match.home_team_name];
        const awayTeamId = teamNameToId[match.away_team_name];

        if (homeTeamId && match.home_team_id !== homeTeamId) {
          updateFields.home_team_id = homeTeamId;
        }
        if (awayTeamId && match.away_team_id !== awayTeamId) {
          updateFields.away_team_id = awayTeamId;
        }

        if (Object.keys(updateFields).length > 0) {
          matchBatch.update(doc.ref, updateFields);
          updatedCount++;
          batchCount++;

          if (batchCount >= 500) {
            await matchBatch.commit();
            matchBatch = db.batch();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await matchBatch.commit();
      }

      console.log(`Updated ${updatedCount} match documents with team IDs`);

      res.json({
        success: true,
        matches_updated: updatedCount,
        total_matches: matchesSnap.size,
        team_mappings: teamNameToId,
        sample_matches: sampleMatches
      });

    } catch (error) {
      console.error('Error fixing match team IDs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Update match dates based on league start_date and blackout_dates
 * POST /updateMatchDates
 * Body: { league_id, start_date? } - if no start_date, uses league's existing start_date
 */
exports.updateMatchDates = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { league_id, start_date } = req.body;

      if (!league_id) {
        return res.status(400).json({ success: false, error: 'Missing league_id' });
      }

      // Get league data for start_date and blackout_dates
      const leagueDoc = await db.collection('leagues').doc(league_id).get();
      if (!leagueDoc.exists) {
        return res.status(404).json({ success: false, error: 'League not found' });
      }

      const league = leagueDoc.data();
      const useStartDate = start_date || league.start_date;

      if (!useStartDate) {
        return res.status(400).json({ success: false, error: 'No start_date provided and league has no start_date set' });
      }

      console.log('Updating match dates for league:', league_id, 'with start_date:', useStartDate);

      const newStartDate = new Date(useStartDate);
      if (isNaN(newStartDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid start_date format' });
      }

      // Get blackout dates as a Set for fast lookup
      const blackoutDates = new Set(league.blackout_dates || []);
      console.log('Blackout dates:', Array.from(blackoutDates));

      const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();

      if (matchesSnap.empty) {
        return res.json({ success: true, matches_updated: 0, message: 'No matches found' });
      }

      // Group matches by week
      const matchesByWeek = new Map();
      matchesSnap.forEach(doc => {
        const match = doc.data();
        const week = match.week || 1;
        if (!matchesByWeek.has(week)) {
          matchesByWeek.set(week, []);
        }
        matchesByWeek.get(week).push({ ref: doc.ref, data: match });
      });

      // Sort weeks and calculate dates, skipping blackout dates
      const weeks = Array.from(matchesByWeek.keys()).sort((a, b) => a - b);
      const matchBatch = db.batch();
      let matchesUpdated = 0;
      const sampleDates = [];
      let skippedWeeks = 0;

      let currentDate = new Date(newStartDate);

      for (const week of weeks) {
        // Skip blackout dates
        let dateStr = currentDate.toISOString().split('T')[0];
        while (blackoutDates.has(dateStr)) {
          console.log(`Week ${week}: Skipping blackout date ${dateStr}`);
          skippedWeeks++;
          currentDate.setDate(currentDate.getDate() + 7);
          dateStr = currentDate.toISOString().split('T')[0];
        }

        // Update all matches for this week
        const weekMatches = matchesByWeek.get(week);
        for (const { ref, data } of weekMatches) {
          matchBatch.update(ref, { match_date: dateStr });
          matchesUpdated++;

          if (sampleDates.length < 10) {
            sampleDates.push({ week, old_date: data.match_date, new_date: dateStr });
          }
        }

        // Move to next week
        currentDate.setDate(currentDate.getDate() + 7);
      }

      await matchBatch.commit();
      console.log(`Updated ${matchesUpdated} match dates, skipped ${skippedWeeks} blackout weeks`);

      res.json({
        success: true,
        matches_updated: matchesUpdated,
        start_date: useStartDate,
        blackout_dates: Array.from(blackoutDates),
        skipped_weeks: skippedWeeks,
        sample_dates: sampleDates
      });

    } catch (error) {
      console.error('Error updating match dates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Update a player's team assignment in a league
 * POST /updatePlayerTeam
 * Body: { league_id, player_id, team_id }
 */
exports.updatePlayerTeam = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { league_id, player_id, team_id } = req.body;

      if (!league_id || !player_id || !team_id) {
        return res.status(400).json({ success: false, error: 'Missing league_id, player_id, or team_id' });
      }

      // Update in league players subcollection
      const leaguePlayerRef = db.collection('leagues').doc(league_id).collection('players').doc(player_id);
      const leaguePlayerDoc = await leaguePlayerRef.get();

      if (leaguePlayerDoc.exists) {
        await leaguePlayerRef.update({ team_id });
        console.log(`Updated league player ${player_id} to team ${team_id}`);
      }

      // Also update in global players if they have league association
      const globalPlayerRef = db.collection('players').doc(player_id);
      const globalPlayerDoc = await globalPlayerRef.get();

      if (globalPlayerDoc.exists) {
        const playerData = globalPlayerDoc.data();
        const updatePayload = {};

        // Always update team_id if player has this league_id or no league
        if (playerData.league_id === league_id || !playerData.league_id) {
          updatePayload.team_id = team_id;
          updatePayload.league_id = league_id;
          console.log(`Will update global player ${player_id} team_id to ${team_id}`);
        }

        // Check leagues array
        if (playerData.leagues) {
          const updatedLeagues = playerData.leagues.map(l => {
            if (l.league_id === league_id || l.id === league_id) {
              return { ...l, team_id };
            }
            return l;
          });
          updatePayload.leagues = updatedLeagues;
          console.log(`Will update player leagues array`);
        }

        // Check involvements.leagues array (used by dashboard)
        if (playerData.involvements && playerData.involvements.leagues) {
          const updatedInvLeagues = playerData.involvements.leagues.map(l => {
            if (l.id === league_id || l.league_id === league_id) {
              return { ...l, team_id };
            }
            return l;
          });
          updatePayload['involvements.leagues'] = updatedInvLeagues;
          console.log(`Will update player involvements.leagues array`);
        }

        if (Object.keys(updatePayload).length > 0) {
          await globalPlayerRef.update(updatePayload);
          console.log(`Updated global player ${player_id}:`, Object.keys(updatePayload));
        }
      }

      res.json({ success: true, player_id, team_id });

    } catch (error) {
      console.error('Error updating player team:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Fix all player team assignments in a league
 * Maps players to teams based on their name appearing in the team roster
 * POST /fixAllPlayerTeams
 * Body: { league_id, team_rosters?: { team_name: [player_names] } }
 */
exports.fixAllPlayerTeams = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { league_id, team_rosters } = req.body;

      if (!league_id) {
        return res.status(400).json({ success: false, error: 'Missing league_id' });
      }

      console.log('Fixing all player teams for league:', league_id);

      // Get all teams in the league
      const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
      console.log(`Found ${teamsSnap.size} teams`);

      // Build a map of player names to team IDs
      const playerNameToTeam = {};
      const teamData = {};
      const teamByName = {};

      teamsSnap.forEach(doc => {
        const team = doc.data();
        teamData[doc.id] = { ...team, docRef: doc.ref };
        teamByName[team.team_name] = doc.id;

        // Get player names from team roster
        const playerNames = team.player_names || [];

        playerNames.forEach((name) => {
          if (name) {
            const normalizedName = name.toLowerCase().trim();
            playerNameToTeam[normalizedName] = {
              team_id: doc.id,
              team_name: team.team_name
            };
          }
        });

        // Also check captain
        if (team.captain_name) {
          const normalizedCaptain = team.captain_name.toLowerCase().trim();
          playerNameToTeam[normalizedCaptain] = {
            team_id: doc.id,
            team_name: team.team_name
          };
        }
      });

      // If team_rosters provided, update team documents and build mapping from that
      if (team_rosters && Object.keys(team_rosters).length > 0) {
        console.log('Using provided team_rosters');
        for (const [teamName, roster] of Object.entries(team_rosters)) {
          const teamId = teamByName[teamName];
          if (teamId) {
            // Update team document with player_names
            await teamData[teamId].docRef.update({ player_names: roster });
            console.log(`Updated team ${teamName} with roster:`, roster);

            // Add to mapping
            roster.forEach(name => {
              const normalizedName = name.toLowerCase().trim();
              playerNameToTeam[normalizedName] = {
                team_id: teamId,
                team_name: teamName
              };
            });
          } else {
            console.log(`Team not found: ${teamName}`);
          }
        }
      }

      console.log('Player name to team mapping:', Object.keys(playerNameToTeam).length, 'entries');
      console.log('Mapping keys:', Object.keys(playerNameToTeam));

      // Get all players in the league
      const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
      console.log(`Found ${playersSnap.size} players in league`);

      const updates = [];
      const unmatched = [];
      const alreadyCorrect = [];

      for (const playerDoc of playersSnap.docs) {
        const player = playerDoc.data();
        const playerName = (player.name || '').toLowerCase().trim();

        // Check if player name matches a team roster
        const teamInfo = playerNameToTeam[playerName];

        if (!teamInfo) {
          unmatched.push({ player_id: playerDoc.id, name: player.name, current_team_id: player.team_id });
          continue;
        }

        if (player.team_id === teamInfo.team_id) {
          alreadyCorrect.push({ player_id: playerDoc.id, name: player.name, team_id: player.team_id, team_name: teamInfo.team_name });
          continue;
        }

        if (teamInfo && player.team_id !== teamInfo.team_id) {
          console.log(`Player ${player.name}: ${player.team_id} -> ${teamInfo.team_id} (${teamInfo.team_name})`);

          // Update league player document
          await playerDoc.ref.update({ team_id: teamInfo.team_id });

          // Also update global player if exists
          const globalPlayerRef = db.collection('players').doc(playerDoc.id);
          const globalPlayerDoc = await globalPlayerRef.get();

          if (globalPlayerDoc.exists) {
            const globalPlayer = globalPlayerDoc.data();
            const updatePayload = {};

            // Update team_id
            if (globalPlayer.league_id === league_id || !globalPlayer.league_id) {
              updatePayload.team_id = teamInfo.team_id;
              updatePayload.league_id = league_id;
            }

            // Update involvements.leagues
            if (globalPlayer.involvements && globalPlayer.involvements.leagues) {
              const updatedInvLeagues = globalPlayer.involvements.leagues.map(l => {
                if (l.id === league_id || l.league_id === league_id) {
                  return { ...l, team_id: teamInfo.team_id, team_name: teamInfo.team_name };
                }
                return l;
              });
              updatePayload['involvements.leagues'] = updatedInvLeagues;
            }

            if (Object.keys(updatePayload).length > 0) {
              await globalPlayerRef.update(updatePayload);
            }
          }

          updates.push({
            player_id: playerDoc.id,
            player_name: player.name,
            old_team_id: player.team_id,
            new_team_id: teamInfo.team_id,
            team_name: teamInfo.team_name
          });
        }
      }

      console.log(`Updated ${updates.length} players`);
      console.log(`Unmatched: ${unmatched.length}, Already correct: ${alreadyCorrect.length}`);

      res.json({
        success: true,
        players_checked: playersSnap.size,
        players_updated: updates.length,
        updates,
        unmatched,
        already_correct: alreadyCorrect
      });

    } catch (error) {
      console.error('Error fixing player teams:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});
