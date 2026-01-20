# Cloud Functions Inventory

**Last Updated:** 2026-01-18

## Summary

- **Total Functions:** ~275+
- **HTTP Triggered:** ~250+
- **Scheduled (pubsub):** ~15
- **Firestore Triggered:** ~8

---

## Functions by File

### /functions/index.js (Main Exports)
Re-exports functions from submodules plus:
- checkInPlayer, bulkCheckIn, addWalkIn
- submitLeagueMatchScore, getTournamentSummary
- undoCheckIn, addEventToTournament
- Template/Draft functions (save, get, delete for leagues/tournaments)
- debugListAllTemplates, debugCheckPin

### /functions/leagues/index.js (~50 functions)
| Function | Purpose |
|----------|---------|
| verifyLeaguePin | Verify director PIN |
| createLeague | Create new league |
| getLeague | Get league data |
| deleteLeague | Delete league |
| updateLeagueStatus | Update status |
| updateLeagueSettings | Update settings |
| registerPlayer | Register player |
| getPlayers | Get all players |
| addPlayer | Add player |
| bulkAddPlayers | Bulk add players |
| updatePlayer | Update player |
| deletePlayer | Delete player |
| bulkRemovePlayers | Bulk remove |
| createTeam | Create team |
| createTeamWithPlayers | Create with roster |
| getTeams | Get teams |
| getStandings | Get standings |
| generateSchedule | Auto-generate schedule |
| importSchedule | Import schedule |
| getSchedule | Get schedule |
| startMatch | Start match |
| getMatchByPin | Lookup by PIN |
| startGame | Start game |
| recordLeg | Record leg result |
| finalizeMatch | Finalize match |
| getPlayerStats | Get player stats |
| getLeaderboards | Get leaderboards |
| submitGameResult | Submit game result |
| captainLogin | Captain login |
| getCaptainTeam | Get captain's team |
| registerSubstitute | Register sub |
| getAvailableSubs | Get subs list |
| setMatchLineup | Set lineup |
| quickSubstitute | Quick swap |
| reportIssue | Report issue |
| completeMatch | Complete match |
| recalculatePlayerStats | Recalc single player stats from matches |
| recalculateLeagueStats | Recalc all player stats in a league |

### /functions/tournaments/ (3 files, ~10 functions)
| Function | File | Purpose |
|----------|------|---------|
| createTournament | create.js | Create tournament |
| addBotToTournament | create.js | Add bot |
| updateTournamentSettings | create.js | Update settings |
| deleteTournament | create.js | Delete tournament |
| generateBracket | brackets.js | Generate bracket |
| submitMatchResult | matches.js | Submit result |

### /functions/admin-functions.js (~20 functions)
- adminLogin, adminClearData, adminDeleteLeague
- adminDeleteTournament, adminGetPlayers, adminUpdatePlayer
- adminDeletePlayer, adminFixPlayerPin, adminGetDashboard
- adminRegisterSelf, adminUpdateLeague, adminUpdateTournament
- adminGetMembers, adminUpdateMemberPermissions
- adminGetFeedback, adminUpdateFeedback, adminAddFeedback, adminDeleteFeedback
- adminResetLeague, adminCreateBotFromPlayer

### /functions/player-profile.js (~10 functions)
- playerLogin, resetPlayerPin, updatePlayerPhoto
- getPlayerProfile, setPlayerAvailability
- getTeamAvailability, getCaptainDashboard
- permanentReplacement, searchPlayers, getGlobalLeaderboards

### /functions/global-auth.js (~15 functions)
- registerGlobalPlayer, registerPlayer, globalLogin
- recoverPin, getDashboardData, updateGlobalPlayer
- addLeagueInvolvement, updateLeagueInvolvement
- addTournamentInvolvement, createBotPlayer
- getAllPlayers, debugCaptain, updatePlayerSettings, registerPlayerSimple

### /functions/knockout.js (~6 functions)
- createKnockout, getKnockout, submitKnockoutMatch
- startKnockout, updateKnockoutTeam, getActiveKnockouts

### /functions/pickup-games.js (~3 functions)
- savePickupGame, getPickupStats, getPickupGames

### /functions/matchmaker.js (~7 functions)
- createMatchmakerTournament, matchmakerRegister
- getMatchmakerStatus, matchmakerDrawPartners
- matchmakerBreakup, matchmakerRematch, getMatchmakerTeams

### /functions/social.js (~12 functions)
- addReaction, removeReaction, sendCheer
- getPlayerCheers, getBiggestFans
- checkAndAwardAchievements, getPlayerAchievements
- setShowcaseAchievements, getAllAchievements
- updatePlayerStreak, getHotPlayers

### /functions/messaging.js (~8 functions)
- sendDirectMessage, getConversations
- getConversationMessages, markConversationRead
- startConversation, getUnreadCount
- searchPlayersForChat, updateMessagingPreferences

### /functions/chat-rooms.js (~12 functions)
- createLeagueChatRoom, createTeamChatRoom, createMatchChatRoom
- sendChatMessage, getChatRoomMessages
- getPlayerChatRooms, markChatRoomRead
- archiveChatRoom, pinChatMessage, getPinnedMessages
- updateRoomParticipants, createAllLeagueChatRooms

### /functions/presence.js (~8 functions)
- updatePresence, setPresenceStatus
- getOnlinePlayers, getPlayerPresence
- updatePlayerProfile, getPlayerPublicProfile
- cleanupStalePresence (scheduled), setOffline

### /functions/online-play.js (~9 functions)
- sendChallenge, respondToChallenge
- getPendingChallenges, getActiveOnlineMatches
- startOnlineMatch, recordOnlineLeg
- requestRematch, getOnlineMatchHistory, expireChallenges

### /functions/notifications.js (~10 functions)
- mondayMatchReminder (scheduled), morningMatchReminder (scheduled)
- sendMatchResultsEmail (Firestore trigger)
- handleSmsReply, sendPinRecoverySMS, sendSMSNotification
- sendMatchPinSMS, notifyLeaguePlayers
- sendTestNotification, notifyCaptainUnavailable

### /functions/push-notifications.js (~9 functions)
- onChallengeCreated (Firestore trigger)
- onNewMessage (Firestore trigger)
- onChatRoomMention (Firestore trigger)
- onChallengeAccepted (Firestore trigger)
- sendNotification, broadcastNotification
- getNotificationStats, updateFCMToken, updateNotificationPreferences

### /functions/stats-unification.js (~11 functions)
- calculateUnifiedStats, getGlobalLeaderboard
- getPlayerRankings, createSeasonSnapshot
- getSeasonRankings, getAllSeasons
- startPracticeSession, recordPracticeThrow
- endPracticeSession, getPracticeHistory
- weeklyStatsRecalculation (scheduled)

### /functions/advanced-features.js (~17 functions)
- startSpectating, stopSpectating, getLiveMatches
- saveMatchReplay, getMatchReplay, getFeaturedReplays, getPlayerReplays
- calculateHandicap, getMatchHandicap
- postPublicChallenge, getChallengeBoard, acceptBoardChallenge
- postBounty, getBountyBoard, claimBounty, completeBounty
- cleanupExpiredChallenges

### /functions/mini-tournaments.js (~7 functions)
- createMiniTournament, getMiniTournament
- recordMiniTournamentMatch, getMiniTournamentHistory
- searchPlayersForMiniTournament, createQuickBracket, updateBracketPlayers

### /functions/import-matches.js (~11 functions)
- createGlobalPlayersFromRosters, consolidatePlayerIds
- lookupPlayersByEmail, migrateLeagueToGlobalIds
- importMatchData, findMatch, listMatches
- fixMatchScores, updateToSetScores
- updateImportedMatchStats, setPlayerStatsFromPerformance

### /functions/bots.js (~7 functions)
- registerBot, getBots, updateBot, deleteBot
- deleteAllBots, updateBotStats, getBotPresets

### /functions/feedback.js (~3 functions)
- submitFeedback, getFeedback, updateFeedbackStatus

### /functions/message-digest.js (4 scheduled functions)
- dailyMessageDigest, weeklyMessageDigest
- processHighPriorityNotifications, cleanupOldNotifications

### Legacy Files
- /functions/phase-1-2.js - Double elim, blind draw
- /functions/phase-3-4.js - Payouts, boards, RR, Swiss
- /functions/phase-5-6-7.js - 60+ legacy league/tournament functions
