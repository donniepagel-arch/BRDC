/**
 * BRDC Tournament & League System - Firebase Cloud Functions
 * Main entry point for all backend functions
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({origin: ['https://brdc-v2.web.app', 'https://brdc-v2.firebaseapp.com', 'https://burningriverdarts.com', 'https://www.burningriverdarts.com']});

admin.initializeApp();

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Tournament Functions
const { createTournament, addBotToTournament, updateTournamentSettings, deleteTournament } = require('./tournaments/create');
const { generateBracket, generateDoubleEliminationBracket, swapBracketPositions, regenerateBracket } = require('./tournaments/brackets');
const { submitMatchResult, recalculateTournamentStats, submitDoubleElimMatchResult, startDoubleElimMatch } = require('./tournaments/matches');

// Export tournament functions
exports.createTournament = createTournament;
exports.addBotToTournament = addBotToTournament;
exports.updateTournamentSettings = updateTournamentSettings;
exports.deleteTournament = deleteTournament;
exports.generateBracket = generateBracket;
exports.generateDoubleEliminationBracket = generateDoubleEliminationBracket;
exports.swapBracketPositions = swapBracketPositions;
exports.regenerateBracket = regenerateBracket;
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

// 🔒 SECURE AUTHENTICATION FUNCTIONS (NEW - Enhanced Security)
const secureAuth = require('./src/secure-auth');
exports.securePlayerLogin = secureAuth.securePlayerLogin;
exports.validateSession = secureAuth.validateSession;
exports.secureLogout = secureAuth.secureLogout;
exports.cleanupExpiredSessions = secureAuth.cleanupExpiredSessions;

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

// REMOVED: One-time migration function - see git history
// const { fixPartloPagel } = require('./fix-partlo-pagel');
// exports.fixPartloPagel = fixPartloPagel;

// REMOVED: One-time migration function - see git history
// const { recalculateMatchScore } = require('./recalculate-match-score');
// exports.recalculateMatchScore = recalculateMatchScore;

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

// REMOVED: One-time migration function - see git history
// const cleanupFunctions = require('./cleanup-league');
// Object.assign(exports, cleanupFunctions);

// Import match functions - selectively export only actively-used functions
// (migration functions like consolidatePlayerIds, migrateLeagueToGlobalIds etc. removed)
const importMatchFunctions = require('./import-matches');
exports.importMatchData = importMatchFunctions.importMatchData;
exports.validateImportMatchData = importMatchFunctions.validateImportMatchData;
exports.parseDartConnectRecap = importMatchFunctions.parseDartConnectRecap;
exports.updateImportedMatchStats = importMatchFunctions.updateImportedMatchStats;
exports.recalculateAllLeagueStats = importMatchFunctions.recalculateAllLeagueStats;
exports.listMatches = importMatchFunctions.listMatches;
exports.findMatch = importMatchFunctions.findMatch;
// Admin/debug import inspection endpoint kept for audit/reimport scripts.
const importDebugFunctions = require('./import-debug');
exports.getMatchDetails = importDebugFunctions.getMatchDetails;

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

// REMOVED: One-time migration function - see git history
// const populateMatchDataFunctions = require('./populate-match-data');
// Object.assign(exports, populateMatchDataFunctions);

// REMOVED: One-time migration function - see git history
// const populateWeek1Functions = require('./populate-week1-matches');
// Object.assign(exports, populateWeek1Functions);

// REMOVED: One-time migration function - see git history
// const populatePartloFunctions = require('./populate-partlo-match');
// Object.assign(exports, populatePartloFunctions);

// REMOVED: One-time migration function - see git history
// const populateMassimianiFunctions = require('./populate-massimiani-match');
// Object.assign(exports, populateMassimianiFunctions);

// REMOVED: One-time migration function - see git history
// const populateMezlakFunctions = require('./populate-mezlak-match');
// Object.assign(exports, populateMezlakFunctions);

// Matchmaker Tournaments (partner matching, mixed doubles, breakup mechanics, heartbreaker)
const matchmakerFunctions = require('./matchmaker');
Object.assign(exports, matchmakerFunctions);

// Player notification callable
const playerNotificationFunctions = require('./player-notification');
Object.assign(exports, playerNotificationFunctions);

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

// Tournament-day helper operations
const tournamentDayFunctions = require('./tournament-day');
Object.assign(exports, tournamentDayFunctions);

// Template and draft helper operations
const templatesAndDraftsFunctions = require('./templates-and-drafts');
Object.assign(exports, templatesAndDraftsFunctions);

// League admin utility operations
const leagueAdminUtilityFunctions = require('./league-admin-utilities');
Object.assign(exports, leagueAdminUtilityFunctions);

// Chat utility operations
const chatUtilityFunctions = require('./chat-utilities');
Object.assign(exports, chatUtilityFunctions);

// ===================================================================
// TOURNAMENT DAY OPERATIONS (REFACTORED)
// ===================================================================

// checkInPlayer is exported from matchmaker.js (supports registration-based check-in)
