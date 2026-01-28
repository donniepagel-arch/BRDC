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
const { generateBracket, generateDoubleEliminationBracket } = require('./tournaments/brackets');
const { submitMatchResult, recalculateTournamentStats, submitDoubleElimMatchResult, startDoubleElimMatch } = require('./tournaments/matches');

// Export tournament functions
exports.createTournament = createTournament;
exports.addBotToTournament = addBotToTournament;
exports.updateTournamentSettings = updateTournamentSettings;
exports.deleteTournament = deleteTournament;
exports.generateBracket = generateBracket;
exports.generateDoubleEliminationBracket = generateDoubleEliminationBracket;
exports.submitMatchResult = submitMatchResult;
exports.recalculateTournamentStats = recalculateTournamentStats;
exports.submitDoubleElimMatchResult = submitDoubleElimMatchResult;
exports.startDoubleElimMatch = startDoubleElimMatch;

// League Functions (NEW - Triples Draft League System)
const leagueFunctions = require('./leagues/index');
Object.assign(exports, leagueFunctions);

// League Feed Generation
const { generateLeagueFeed } = require('./generateLeagueFeed');
exports.generateLeagueFeed = generateLeagueFeed;

// Player Profile & Captain Functions
const playerFunctions = require('./player-profile');
Object.assign(exports, playerFunctions);

// Captain Portal Functions (availability, go-to subs, fill-in workflow)
const captainFunctions = require('./captain-functions');
Object.assign(exports, captainFunctions);

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

// Notification API (HTTP endpoints for notification management)
const notificationApiFunctions = require('./notification-api');
Object.assign(exports, notificationApiFunctions);

// Data Migration Functions (one-time scripts to normalize data)
const migrationFunctions = require('./migrations');
Object.assign(exports, migrationFunctions);

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
const presenceFunctions = require('./presence');
Object.assign(exports, presenceFunctions);

// Social Features (Phase 3 Social Platform - reactions, cheers, achievements)
const socialFunctions = require('./social');
Object.assign(exports, socialFunctions);

// Friend System (Social Connections - friend requests, blocking, discovery)
const friendsFunctions = require('./friends');
Object.assign(exports, friendsFunctions);

// Online Play (Phase 4 Social Platform - challenges, online matches)
// Scheduler function disabled in online-play.js, but HTTP functions are enabled
const onlinePlayFunctions = require('./online-play');
Object.assign(exports, onlinePlayFunctions);

// Mini Tournaments (Phase 5 Social Platform - quick brackets in scorer)
const miniTournamentFunctions = require('./mini-tournaments');
Object.assign(exports, miniTournamentFunctions);

// Advanced Features (Phase 6 - spectate, replay, handicap, bounty board)
// TEMPORARILY DISABLED - uses firebase-functions v2 scheduler not compatible with v4
// const advancedFeaturesFunctions = require('./advanced-features');
// Object.assign(exports, advancedFeaturesFunctions);

// Stats Unification (Phase 7 - unified average, leaderboards, practice mode)
// Scheduler function disabled in stats-unification.js, but HTTP functions are enabled
const statsUnificationFunctions = require('./stats-unification');
Object.assign(exports, statsUnificationFunctions);

// Draft System (Real-time player drafts for Draft Leagues)
const draftFunctions = require('./draft');
Object.assign(exports, draftFunctions);

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

// Chat Phase 2: Live Match Ticker & Overlays
const chatLiveMatchesFunctions = require('./chat-live-matches');
Object.assign(exports, chatLiveMatchesFunctions);

// Chat Phase 3: Challenge System & Spectator Rooms
const chatChallengesFunctions = require('./chat-challenges');
Object.assign(exports, chatChallengesFunctions);

// Chat System: Discord-like Channels (new unified chat system)
const chatSystemFunctions = require('./chat-system');
Object.assign(exports, chatSystemFunctions);

// Populate Match Data (one-time data import)
const populateMatchDataFunctions = require('./populate-match-data');
Object.assign(exports, populateMatchDataFunctions);

// Week 1 Match Data (Yasenchak vs Kull, etc.)
const populateWeek1Functions = require('./populate-week1-matches');
Object.assign(exports, populateWeek1Functions);

// Partlo vs Olschansky Match Data
const populatePartloFunctions = require('./populate-partlo-match');
Object.assign(exports, populatePartloFunctions);

// Massimiani vs Ragnoni Match Data
const populateMassimianiFunctions = require('./populate-massimiani-match');
Object.assign(exports, populateMassimianiFunctions);

// Mezlak vs Russano Match Data
const populateMezlakFunctions = require('./populate-mezlak-match');
Object.assign(exports, populateMezlakFunctions);

// Matchmaker Tournaments (partner matching, mixed doubles, breakup mechanics, heartbreaker)
const matchmakerFunctions = require('./matchmaker');
Object.assign(exports, matchmakerFunctions);

// Notable Performances (homepage featured performances)
const notablePerformancesFunctions = require('./notable-performances');
Object.assign(exports, notablePerformancesFunctions);

// Stats Verification (verified skill ratings for subs/fill-ins)
const statsVerificationFunctions = require('./stats-verification');
Object.assign(exports, statsVerificationFunctions);

// Social Feed Posts (posts, reactions, comments, feed aggregation)
const postsFunctions = require('./posts');
Object.assign(exports, postsFunctions);

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
// REMOVED: Debug function - uncomment if needed for troubleshooting
// exports.debugListAllTemplates = functions.https.onRequest((req, res) => { ... });

// DEBUG: Check what player_id a PIN resolves to
// REMOVED: Debug function - uncomment if needed for troubleshooting
// exports.debugCheckPin = functions.https.onRequest((req, res) => { ... });

/**
 * Fix team names in a league to match captain-based naming
 * REMOVED: One-time data fix function - already run
 * POST /fixLeagueTeamNames
 */
// exports.fixLeagueTeamNames = functions.https.onRequest((req, res) => { ... });

/**
 * Fix match team IDs - populate home_team_id and away_team_id based on team names
 * REMOVED: One-time data fix function - already run
 * POST /fixMatchTeamIds
 */
// exports.fixMatchTeamIds = functions.https.onRequest((req, res) => { ... });

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
 * REMOVED: One-time data fix function - already run
 * POST /fixAllPlayerTeams
 */
// exports.fixAllPlayerTeams = functions.https.onRequest((req, res) => { ... });

/**
 * Mark players as fill-ins (is_sub: true)
 * Used to fix players who are fill-ins but weren't marked properly
 */
exports.markPlayersAsFillins = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { league_id, player_ids } = req.body;

    if (!league_id || !player_ids || !Array.isArray(player_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Required: league_id and player_ids (array)'
      });
    }

    const updates = [];
    const batch = admin.firestore().batch();

    for (const playerId of player_ids) {
      const playerRef = admin.firestore()
        .collection('leagues').doc(league_id)
        .collection('players').doc(playerId);

      const playerDoc = await playerRef.get();
      if (playerDoc.exists) {
        batch.update(playerRef, {
          is_sub: true,
          team_id: null  // Ensure no team assignment
        });
        updates.push({ id: playerId, name: playerDoc.data().name });
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Marked ${updates.length} players as fill-ins`,
      updated: updates
    });

  } catch (error) {
    console.error('Error marking players as fill-ins:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add fill-in players to match lineup with substitution info
 * Used to add fill-ins to imported matches that don't have lineup data
 * fillins: [{ player_id, team: 'home' | 'away', replacing_player_id, position }]
 */
exports.addFillinsToMatchLineup = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { league_id, match_id, fillins } = req.body;
    // fillins: [{ player_id, team: 'home' | 'away', replacing_player_id, position }]

    if (!league_id || !match_id || !fillins || !Array.isArray(fillins)) {
      return res.status(400).json({
        success: false,
        error: 'Required: league_id, match_id, fillins (array with player_id, team, replacing_player_id, position)'
      });
    }

    const matchRef = admin.firestore()
      .collection('leagues').doc(league_id)
      .collection('matches').doc(match_id);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const match = matchDoc.data();
    let homeLineup = match.home_lineup || [];
    let awayLineup = match.away_lineup || [];

    // Fetch player data for each fill-in
    const addedToHome = [];
    const addedToAway = [];

    for (const fillin of fillins) {
      const playerRef = admin.firestore()
        .collection('leagues').doc(league_id)
        .collection('players').doc(fillin.player_id);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) continue;

      const player = playerDoc.data();
      const lineupEntry = {
        player_id: fillin.player_id,
        player_name: player.name,
        is_sub: true,
        replacing_player_id: fillin.replacing_player_id || null,
        position: fillin.position || 'S'
      };

      if (fillin.team === 'home') {
        // Check if already in lineup
        if (!homeLineup.some(p => p.player_id === fillin.player_id)) {
          homeLineup.push(lineupEntry);
          addedToHome.push({ name: player.name, replacing: fillin.replacing_player_id });
        }
      } else if (fillin.team === 'away') {
        if (!awayLineup.some(p => p.player_id === fillin.player_id)) {
          awayLineup.push(lineupEntry);
          addedToAway.push({ name: player.name, replacing: fillin.replacing_player_id });
        }
      }
    }

    await matchRef.update({
      home_lineup: homeLineup,
      away_lineup: awayLineup
    });

    res.json({
      success: true,
      message: `Added fill-ins to match ${match_id}`,
      homeLineup: addedToHome,
      awayLineup: addedToAway
    });

  } catch (error) {
    console.error('Error adding fill-ins to lineup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * List matches for a league week (helper function)
 */
exports.listLeagueMatches = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { league_id, week } = req.body;

    if (!league_id) {
      return res.status(400).json({ success: false, error: 'Required: league_id' });
    }

    let query = admin.firestore()
      .collection('leagues').doc(league_id)
      .collection('matches');

    if (week) {
      query = query.where('week', '==', week);
    }

    const matchesSnap = await query.get();
    const matches = [];

    matchesSnap.forEach(doc => {
      const data = doc.data();
      matches.push({
        id: doc.id,
        week: data.week,
        home_team_id: data.home_team_id,
        away_team_id: data.away_team_id,
        status: data.status,
        home_score: data.home_score,
        away_score: data.away_score,
        has_home_lineup: !!(data.home_lineup && data.home_lineup.length > 0),
        has_away_lineup: !!(data.away_lineup && data.away_lineup.length > 0)
      });
    });

    res.json({ success: true, matches });

  } catch (error) {
    console.error('Error listing matches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get player stats filtered by source
 * GET /getPlayerStatsFiltered?player_id=xxx&source=league|tournament|social|combined
 *
 * Returns stats in the canonical format expected by displayStats():
 * x01_total_points, x01_total_darts, x01_legs_played, x01_legs_won, etc.
 * cricket_total_marks, cricket_total_darts, cricket_legs_played, etc.
 */
exports.getPlayerStatsFiltered = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { player_id, source } = req.method === 'POST' ? req.body : req.query;

      if (!player_id) {
        return res.status(400).json({ success: false, error: 'player_id required' });
      }

      const playerDoc = await db.collection('players').doc(player_id).get();
      if (!playerDoc.exists) {
        return res.status(404).json({ success: false, error: 'Player not found' });
      }

      const player = playerDoc.data();
      const involvements = player.involvements || {};
      const searchPin = player.pin;
      const searchName = player.name;

      // Helper to create empty stats object with all expected fields
      const createEmptyStats = () => ({
        x01_total_points: 0,
        x01_total_darts: 0,
        x01_legs_played: 0,
        x01_legs_won: 0,
        x01_first9_points: 0,
        x01_first9_darts: 0,
        x01_best_leg: null,
        x01_high_score: null,
        x01_high_checkout: null,
        x01_checkout_opps: 0,
        x01_checkouts: 0,
        x01_checkout_totals: 0,
        x01_tons_100: 0,
        x01_tons_120: 0,
        x01_tons_140: 0,
        x01_tons_160: 0,
        x01_tons_180: 0,
        x01_one_seventy_ones: 0,
        x01_ton_plus_checkouts: 0,
        cricket_total_marks: 0,
        cricket_total_darts: 0,
        cricket_legs_played: 0,
        cricket_legs_won: 0,
        cricket_missed_darts: 0,
        cricket_triple_bull_darts: 0,
        cricket_five_mark_rounds: 0,
        cricket_seven_mark_rounds: 0,
        cricket_eight_mark_rounds: 0,
        cricket_nine_mark_rounds: 0,
        cricket_three_bulls: 0,
        cricket_hat_tricks: 0
      });

      // Helper to aggregate stats from multiple sources
      const aggregateStats = (target, source) => {
        if (!source) return;

        // X01 stats - sum most, take best for high scores
        target.x01_total_points += source.x01_total_points || 0;
        target.x01_total_darts += source.x01_total_darts || 0;
        target.x01_legs_played += source.x01_legs_played || 0;
        target.x01_legs_won += source.x01_legs_won || 0;
        target.x01_first9_points += source.x01_first9_points || 0;
        target.x01_first9_darts += source.x01_first9_darts || 0;
        target.x01_checkout_opps += source.x01_checkout_opps || source.x01_checkout_attempts || 0;
        target.x01_checkouts += source.x01_checkouts || source.x01_checkouts_hit || 0;
        target.x01_checkout_totals += source.x01_checkout_totals || 0;
        target.x01_tons_100 += source.x01_tons_100 || 0;
        target.x01_tons_120 += source.x01_tons_120 || 0;
        target.x01_tons_140 += source.x01_tons_140 || 0;
        target.x01_tons_160 += source.x01_tons_160 || 0;
        target.x01_tons_180 += source.x01_tons_180 || 0;
        target.x01_one_seventy_ones += source.x01_one_seventy_ones || 0;
        target.x01_ton_plus_checkouts += source.x01_ton_plus_checkouts || 0;

        // Best leg (lower is better)
        const sourceBestLeg = source.x01_best_leg;
        if (sourceBestLeg && sourceBestLeg < 999) {
          if (!target.x01_best_leg || sourceBestLeg < target.x01_best_leg) {
            target.x01_best_leg = sourceBestLeg;
          }
        }

        // High scores (higher is better)
        if (source.x01_high_score && (!target.x01_high_score || source.x01_high_score > target.x01_high_score)) {
          target.x01_high_score = source.x01_high_score;
        }
        if (source.x01_high_checkout && (!target.x01_high_checkout || source.x01_high_checkout > target.x01_high_checkout)) {
          target.x01_high_checkout = source.x01_high_checkout;
        }

        // Cricket stats
        target.cricket_total_marks += source.cricket_total_marks || 0;
        target.cricket_total_darts += source.cricket_total_darts || 0;
        target.cricket_legs_played += source.cricket_legs_played || 0;
        target.cricket_legs_won += source.cricket_legs_won || 0;
        target.cricket_missed_darts += source.cricket_missed_darts || 0;
        target.cricket_triple_bull_darts += source.cricket_triple_bull_darts || 0;
        target.cricket_five_mark_rounds += source.cricket_five_mark_rounds || 0;
        target.cricket_seven_mark_rounds += source.cricket_seven_mark_rounds || 0;
        target.cricket_eight_mark_rounds += source.cricket_eight_mark_rounds || 0;
        target.cricket_nine_mark_rounds += source.cricket_nine_mark_rounds || 0;
        target.cricket_three_bulls += source.cricket_three_bulls || 0;
        target.cricket_hat_tricks += source.cricket_hat_tricks || 0;
      };

      // Helper to find player in league and get their stats
      const getLeagueStats = async (leagueId) => {
        try {
          // Find player in league by PIN first, then by name
          let leaguePlayerDoc;

          if (searchPin) {
            const byPin = await db.collection('leagues')
              .doc(leagueId)
              .collection('players')
              .where('pin', '==', searchPin)
              .limit(1)
              .get();
            if (!byPin.empty) leaguePlayerDoc = byPin.docs[0];
          }

          if (!leaguePlayerDoc) {
            const byName = await db.collection('leagues')
              .doc(leagueId)
              .collection('players')
              .where('name', '==', searchName)
              .limit(1)
              .get();
            if (!byName.empty) leaguePlayerDoc = byName.docs[0];
          }

          if (!leaguePlayerDoc) return null;

          // Get stats from stats collection
          const statsDoc = await db.collection('leagues')
            .doc(leagueId)
            .collection('stats')
            .doc(leaguePlayerDoc.id)
            .get();

          if (statsDoc.exists) {
            return statsDoc.data();
          }
          return null;
        } catch (e) {
          console.error(`Error fetching league ${leagueId} stats:`, e.message);
          return null;
        }
      };

      let stats = createEmptyStats();

      // Gather league IDs from involvements
      const leagueIds = new Set();
      (involvements.leagues || []).forEach(l => leagueIds.add(l.id));
      (involvements.captaining || []).forEach(c => leagueIds.add(c.league_id));
      (involvements.directing || []).filter(d => d.type === 'league').forEach(d => leagueIds.add(d.id));

      switch (source) {
        case 'league':
          // Get stats from all leagues the player is in
          for (const leagueId of leagueIds) {
            const leagueStats = await getLeagueStats(leagueId);
            if (leagueStats) {
              aggregateStats(stats, leagueStats);
            }
          }
          stats.source = 'league';
          break;

        case 'tournament':
          // Tournament stats - search player's tournament involvement
          // For now, return empty stats as tournament stats aren't tracked separately yet
          stats.source = 'tournament';
          break;

        case 'social':
          // Social/online play stats - not tracked in league stats collections
          // For now, return empty stats as online play stats aren't aggregated yet
          stats.source = 'social';
          break;

        case 'combined':
        default:
          // Combined: aggregate all available stats
          // Start with league stats (most comprehensive)
          for (const leagueId of leagueIds) {
            const leagueStats = await getLeagueStats(leagueId);
            if (leagueStats) {
              aggregateStats(stats, leagueStats);
            }
          }

          // If no league stats found, check unified_stats on player doc
          if (stats.x01_legs_played === 0 && stats.cricket_legs_played === 0) {
            const unifiedStats = player.unified_stats || player.stats;
            if (unifiedStats) {
              aggregateStats(stats, unifiedStats);
            }
          }

          stats.source = 'combined';
          break;
      }

      res.json({
        success: true,
        player_id,
        player_name: player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
        stats
      });

    } catch (error) {
      console.error('Error getting filtered stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});
