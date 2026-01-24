# BRDC Dependency Map and Change Impact Reference

This document maps all dependencies in the BRDC darts application. Consult this before making changes to understand the ripple effects.

---

## Part 1: Frontend to Backend Dependencies

### Page -> Cloud Function Mapping

#### Authentication & Profile Pages

```
dashboard.html ->
  - globalLogin
  - getDashboardData
  - updateGlobalPlayer
  - recoverPin
  - generateNewPin
  - deletePlayerAccount
  - getConversations
  - getUnreadCount
  - setPlayerAvailability
  - updatePlayerAvailability
  - getCaptainTeamData
  - updateTeamName
  - setMatchLineup
  - sendCaptainMessage
  - updateSeasonAvailability
  - addGotoSub / removeGotoSub
  - sendFillinRequests / getFillinResponses / confirmFillin
  - quickSubstitute
  - sendDirectorMessage
  - getPlayerUpcomingMatches
  - getTeamScheduleEnhanced

player-profile.html ->
  - getDashboardData
  - playerLogin
  - resetPlayerPin
  - getPlayerPublicProfile
  - getPlayerAchievements
  - updatePlayerProfile
  - updatePlayerPhoto
  - getPlayerStatsFiltered
  - getPlayerStats
  - getSchedule
  - requestFillins

register.html ->
  - registerPlayer

game-setup.html ->
  - playerLogin
  - registerPlayerSimple
  - getBots
  - createKnockout
```

#### League Management Pages

```
league-director.html ->
  - verifyLeaguePin
  - getTeams
  - getSchedule
  - startMatch
  - finalizeMatch
  - generateSchedule
  - updateLeagueStatus
  - deleteLeague
  - getStandings
  - getLeaderboards
  - getPlayers
  - updatePlayer
  - addPlayer
  - bulkAddPlayers
  - bulkRemovePlayers
  - deletePlayer
  - getBots
  - addBotToLeague
  - updateMatchDates
  - updateLeagueSettings
  - createTeamWithPlayers
  - notifyLeaguePlayers
  - conductLeagueDraft
  - sendCustomLeagueMessage

league-view.html ->
  - verifyLeaguePin
  - playerLogin
  - registerFillin
  - registerForLeague

create-league.html ->
  - getMemberPermissions
  - playerLogin
  - createLeague
  - saveLeagueTemplate
  - getLeagueTemplates
  - getLeagueTemplate
  - deleteLeagueTemplate
  - getLeagueDraft
  - saveLeagueDraft
  - deleteLeagueDraft

captain-dashboard.html ->
  - getCaptainDashboard
  - captainLogin
  - updateTeamName
  - sendTeamInvite
  - setMatchLineup
  - permanentReplacement
```

#### Scoring Pages

```
league-501.html ->
  - getMatchByPin
  - submitGameResult
  - submitMatchResult
  - submitKnockoutMatch
  - savePickupGame
  - submitVerification

league-cricket.html ->
  - submitGameResult
  - submitMatchResult
  - submitVerification
  - savePickupGame

scorer-hub.html ->
  - getMatchByPin

match-hub.html ->
  (Direct Firestore queries to leagues/{id}/matches, leagues/{id}/players)

match-night.html ->
  - getMatchByPIN
  - getMatchNightData
  - startRound

match-transition.html ->
  - completeMatch
```

#### Tournament Pages

```
create-tournament.html ->
  - playerLogin
  - getMemberPermissions
  - createTournament
  - saveTournamentTemplate
  - getTournamentTemplates
  - getTournamentTemplate
  - deleteTournamentTemplate
  - saveTournamentDraft
  - getTournamentDraft

director-dashboard.html ->
  - getLeagueDraft
  - getTournamentDraft
  - deleteLeagueDraft
  - deleteTournamentDraft
  - generateBracket
  - getBots
  - addBotToTournament
  - updateTournamentSettings
  - deleteTournament
  - addEventToTournament
  - submitMatchResult

tournament-view.html ->
  - playerLogin
  - registerForTournament
```

#### Knockout & Matchmaker Pages

```
knockout.html ->
  - getKnockout
  - startKnockout
  - updateKnockoutTeam

matchmaker-register.html ->
  - getMatchmakerStatus
  - matchmakerRegister

matchmaker-director.html ->
  - getMatchmakerStatus
  - getMatchmakerTeams
  - matchmakerDrawPartners
  - matchmakerBreakup
  - matchmakerRematch
  - updateTournamentSettings

matchmaker-view.html ->
  - getMatchmakerStatus
  - getMatchmakerTeams

matchmaker-bracket.html ->
  - getMatchmakerTeams
```

#### Messaging & Social Pages

```
messages.html ->
  - getConversations
  - registerPlayerSimple
  - getPlayerChatRooms
  - startConversation
  - searchPlayersForChat

conversation.html ->
  - getConversationMessages
  - markConversationRead
  - sendDirectMessage

chat-room.html ->
  - getPlayerChatRooms
  - getChatRoomMessages
  - markChatRoomRead
  - getChatRoomParticipants
  - sendChatMessage
  - setTypingStatus
  - addMessageReaction
  - editChatMessage
  - deleteChatMessage
  - toggleChatRoomMute
  - getPinnedMessages
```

#### Admin Pages

```
admin.html ->
  - adminGetDashboard
  - adminUpdateLeague
  - adminUpdateTournament
  - adminDeleteLeague
  - adminDeleteTournament
  - adminClearData
  - getBots
  - registerBot
  - deleteBot
  - deleteAllBots
  - adminGetMembers
  - adminUpdateMemberPermissions
  - adminGetPlayers
  - adminDeletePlayer
  - adminUpdatePlayer
  - adminGetFeedback
  - adminUpdateFeedback
  - adminDeleteFeedback
  - adminAddFeedback

bot-management.html ->
  - getBots
  - registerBot
  - deleteBot
```

#### Utility Pages

```
player-lookup.html ->
  - searchPlayers
  - getGlobalLeaderboards

my-stats.html ->
  - getPlayerProfile

stat-verification.html ->
  - getPlayerByPin
  - getVerificationStatus
  - getBots

members.html ->
  - getPlayerStats
```

---

## Part 2: Shared Code Dependencies

### JavaScript Files Used By Multiple Pages

```
firebase-config.js (51 pages)
  -> ALL pages that need database access
  -> Exports: db, collection, addDoc, query, where, getDocs, doc, getDoc,
     onSnapshot, updateDoc, setDoc, deleteDoc, orderBy, limit, serverTimestamp,
     storage, ref, uploadBytes, getDownloadURL, callFunction, showLoading, hideLoading, uploadImage

nav-menu.js (16 pages)
  -> dashboard.html
  -> match-night.html
  -> league-view.html
  -> league-director.html
  -> bot-management.html
  -> admin.html
  -> director-dashboard.html
  -> tournament-bracket.html
  -> league-cricket.html
  -> league-501.html
  -> create-league.html
  -> live-scoreboard.html
  -> scorer-hub.html
  -> game-setup.html
  -> tournament-view.html
  -> create-tournament.html

stats-helpers.js (5 pages)
  -> player-profile.html
  -> dashboard.html
  -> team-profile.html
  -> league-view.html
  -> captain-dashboard.html
  Exports: get3DA, getMPR, getFirst9Avg, getAvgCheckout, getPlayerName,
           getTeamName, getTeamRecord, getOrdinal, formatStats, format3DA, formatMPR, getLegWinPct

presence.js (1 page)
  -> player-profile.html

social.js (1 page)
  -> player-profile.html
```

### CSS Dependencies

```
brdc-styles.css (14 pages)
  -> player-profile.html
  -> team-profile.html
  -> admin.html
  -> captain-dashboard.html
  -> messages.html
  -> tournament-bracket.html
  -> bracket.html
  -> chat-room.html
  -> league-scoreboard.html
  -> conversation.html
  -> player-registration.html
  -> sw.js (referenced)

messaging.css (3 pages)
  -> player-profile.html
  -> chat-room.html
  -> conversation.html

Inline Styles (heavy usage):
  -> dashboard.html (~600+ lines inline)
  -> league-501.html (~300+ lines inline)
  -> league-cricket.html (~300+ lines inline)
  -> league-view.html (~400+ lines inline)
  -> match-hub.html (~300+ lines inline)
```

---

## Part 3: Data Flow Dependencies (Firestore Collections)

### Core Collections and Affected Pages

```
players/{playerId}
  AFFECTS:
    - dashboard.html (player profile, settings)
    - player-profile.html (public profile, stats)
    - player-lookup.html (search results)
    - game-setup.html (player selection)
    - register.html (registration)
    - admin.html (player management)
    - members.html (member directory)

  WRITTEN BY:
    - registerGlobalPlayer, registerPlayer, registerPlayerSimple
    - updateGlobalPlayer, updatePlayerProfile, updatePlayerPhoto
    - addLeagueInvolvement, updateLeagueInvolvement
    - adminUpdatePlayer

leagues/{leagueId}
  AFFECTS:
    - league-view.html
    - league-director.html
    - create-league.html
    - dashboard.html (active leagues)
    - browse-events.html
    - leagues.html

  WRITTEN BY:
    - createLeague
    - updateLeagueSettings, updateLeagueStatus
    - deleteLeague

leagues/{leagueId}/teams/{teamId}
  AFFECTS:
    - league-view.html (standings, teams)
    - team-profile.html
    - league-director.html (team management)
    - dashboard.html (captain section)
    - captain-dashboard.html

  WRITTEN BY:
    - createTeamWithPlayers
    - updateTeamName
    - fixLeagueTeamNames

leagues/{leagueId}/players/{playerId}
  AFFECTS:
    - league-view.html (rosters, leaderboards)
    - league-director.html (player management)
    - player-profile.html (league stats)
    - dashboard.html (team roster)
    - match-hub.html (lineup selection)

  WRITTEN BY:
    - addPlayer, bulkAddPlayers
    - updatePlayer, deletePlayer
    - registerForLeague, registerFillin
    - fixAllPlayerTeams

leagues/{leagueId}/matches/{matchId}
  AFFECTS:
    - match-hub.html
    - league-501.html, league-cricket.html (scoring)
    - dashboard.html (tonight's match, schedule)
    - league-view.html (schedule, results)
    - league-director.html (match management)
    - match-night.html
    - match-transition.html
    - scorer-hub.html

  WRITTEN BY:
    - generateSchedule
    - startMatch, finalizeMatch, completeMatch
    - submitGameResult, submitMatchResult
    - setMatchLineup
    - updateMatchDates

leagues/{leagueId}/stats/{playerId}
  AFFECTS:
    - player-profile.html (career stats)
    - team-profile.html (team aggregates)
    - league-view.html (leaderboards)
    - dashboard.html (player stats card)
    - members.html (stats display)

  WRITTEN BY:
    - updatePlayerStatsFromMatch (called by submitMatchResult)
    - Manual imports via import-matches.js

tournaments/{tournamentId}
  AFFECTS:
    - tournament-view.html
    - director-dashboard.html
    - create-tournament.html
    - bracket.html
    - browse-events.html
    - tournaments.html

  WRITTEN BY:
    - createTournament
    - updateTournamentSettings
    - deleteTournament
    - generateBracket

conversations/{conversationId}
  AFFECTS:
    - messages.html
    - conversation.html
    - dashboard.html (unread count)

  WRITTEN BY:
    - startConversation
    - sendDirectMessage

chat_rooms/{roomId}
  AFFECTS:
    - chat-room.html
    - messages.html (room list)

  WRITTEN BY:
    - sendChatMessage
    - markChatRoomRead
```

---

## Part 4: URL Parameter Dependencies

### Pages Using URL Parameters

```
league-view.html
  - league_id (required)

league-team.html
  - league_id (required)
  - team_id (required)

league-director.html
  - league_id OR pin

event-view.html
  - tournament_id (required)
  - event_id (required)

match-confirm.html
  - pin (match PIN, required)

director-dashboard.html
  - pin (tournament PIN)

league-scoreboard.html
  - match_id (required)

live-scoreboard.html
  - tv=1 (TV mode flag)

dart-trader-listing.html
  - id (listing ID)

x01.html (knockout mode)
  - knockout=true
  - p1, p2 (player names)
  - bestOf, startScore

cricket.html (knockout mode)
  - knockout=true
  - p1, p2 (player names)

dashboard.html
  - tab=trader (opens dart trader tab)
```

---

## Part 5: Change Impact Reference

### IF YOU CHANGE: Player Stats Schema

```
ALSO UPDATE:
  - functions/leagues/index.js (updatePlayerStatsFromMatch - lines 101-450)
  - functions/player-profile.js (getPlayerProfile, getCaptainDashboard)
  - functions/global-auth.js (getDashboardData)
  - public/pages/player-profile.html (stats display)
  - public/pages/team-profile.html (team aggregation)
  - public/pages/league-view.html (leaderboards)
  - public/pages/dashboard.html (stats card)
  - public/js/stats-helpers.js (calculation functions)

FIRESTORE:
  - leagues/{id}/stats/{playerId}
  - players/{id}/stats (aggregated)
```

### IF YOU CHANGE: Match Data Structure

```
ALSO UPDATE:
  - functions/leagues/index.js (submitMatchResult, submitGameResult)
  - functions/index.js (submitLeagueMatchScore)
  - public/pages/match-hub.html (match display)
  - public/pages/league-501.html (scoring)
  - public/pages/league-cricket.html (scoring)
  - public/pages/match-night.html (match flow)
  - public/pages/dashboard.html (tonight's match section)
  - public/pages/league-view.html (schedule display)
  - public/pages/league-director.html (match management)

FIRESTORE:
  - leagues/{id}/matches/{matchId}
  - leagues/{id}/matches/{matchId}/games/{gameId}
```

### IF YOU CHANGE: Player Authentication/PIN System

```
ALSO UPDATE:
  - functions/global-auth.js (globalLogin, registerPlayer, recoverPin)
  - functions/player-profile.js (playerLogin)
  - functions/leagues/index.js (verifyLeaguePin, checkLeagueAccess)
  - public/pages/dashboard.html (login flow)
  - public/pages/game-setup.html (player selection)
  - public/pages/register.html (registration)
  - public/js/nav-menu.js (logout, session storage)

STORAGE KEYS:
  - localStorage: brdc_player_pin, brdc_player_id, brdc_player_name, brdc_session
```

### IF YOU CHANGE: Team Structure

```
ALSO UPDATE:
  - functions/leagues/index.js (createTeamWithPlayers, getTeams)
  - functions/player-profile.js (getCaptainDashboard)
  - functions/captain-functions.js
  - public/pages/league-view.html (team display)
  - public/pages/team-profile.html
  - public/pages/dashboard.html (captain section)
  - public/pages/captain-dashboard.html
  - public/pages/league-director.html (team management)

FIRESTORE:
  - leagues/{id}/teams/{teamId}
  - leagues/{id}/players/{playerId}.team_id
```

### IF YOU CHANGE: URL Parameter Names

```
PAGES THAT LINK TO CHANGED PARAMETERS:

league_id used in links from:
  - dashboard.html (league cards)
  - leagues.html (league list)
  - browse-events.html
  - player-profile.html

team_id used in links from:
  - league-view.html (standings table)
  - dashboard.html (team links)

match_id used in links from:
  - league-view.html (schedule)
  - dashboard.html (tonight's match)
  - league-director.html

tournament_id used in links from:
  - tournaments.html
  - browse-events.html
  - director-dashboard.html
```

### IF YOU CHANGE: Messaging System

```
ALSO UPDATE:
  - functions/messaging.js (all message functions)
  - functions/chat-rooms.js (chat room functions)
  - public/pages/messages.html
  - public/pages/conversation.html
  - public/pages/chat-room.html
  - public/pages/dashboard.html (unread badge)
  - public/js/nav-menu.js (badge update)

FIRESTORE:
  - conversations/{id}
  - conversations/{id}/messages/{msgId}
  - chat_rooms/{id}
  - chat_rooms/{id}/messages/{msgId}
```

### IF YOU CHANGE: Navigation Menu Items

```
ALSO UPDATE:
  - public/js/nav-menu.js (menuItems array, lines 8-23)

AFFECTS ALL PAGES USING nav-menu.js (16 pages)
```

---

## Part 6: High-Risk Change Zones

### Ranked by Ripple Effect

1. **functions/leagues/index.js** - 40+ exported functions, affects all league operations
   - Stats calculation (updatePlayerStatsFromMatch)
   - Match management (submitMatchResult, submitGameResult)
   - Player management
   - Schedule generation

2. **public/js/firebase-config.js** - Core dependency, affects 51 files
   - callFunction() is the main backend interface
   - Any change breaks all API calls

3. **functions/global-auth.js** - Authentication system, affects login on all protected pages
   - globalLogin
   - getDashboardData
   - Player registration

4. **functions/player-profile.js** - Player data, affects profile pages + captain features
   - getPlayerProfile
   - getCaptainDashboard
   - Player search

5. **public/pages/dashboard.html** - Most complex page, 14000+ lines
   - Calls 30+ different Cloud Functions
   - Touches all player-related features

6. **public/js/stats-helpers.js** - Stats calculations, affects 5 pages
   - get3DA, getMPR calculation logic
   - Field name fallbacks for legacy data

7. **leagues/{id}/stats/{playerId}** collection schema - Stats storage
   - Read by: player-profile, team-profile, league-view, dashboard
   - Written by: updatePlayerStatsFromMatch, import scripts

8. **leagues/{id}/matches/{matchId}** collection schema - Match data
   - Read by: 8+ pages (scoring, display, management)
   - Written by: scoring functions, schedule functions

---

## Part 7: Function Export Map

### functions/index.js Exports

```javascript
// Tournament Functions
createTournament, addBotToTournament, updateTournamentSettings, deleteTournament
generateBracket, submitMatchResult, recalculateTournamentStats

// League Functions (from ./leagues/index)
// ~40 functions including:
createLeague, verifyLeaguePin, getTeams, getSchedule, startMatch,
finalizeMatch, submitGameResult, updatePlayerStatsFromMatch, etc.

// Player Profile Functions (from ./player-profile)
playerLogin, resetPlayerPin, updatePlayerPhoto, getPlayerProfile,
setPlayerAvailability, getTeamAvailability, getCaptainDashboard,
permanentReplacement, searchPlayers, getGlobalLeaderboards

// Global Auth Functions (from ./global-auth)
registerGlobalPlayer, registerPlayer, globalLogin, recoverPin,
getDashboardData, updateGlobalPlayer, updatePlayerPrivacy,
generateNewPin, deletePlayerAccount, addLeagueInvolvement,
addTournamentInvolvement, createBotPlayer, getAllPlayers, etc.

// Captain Functions (from ./captain-functions)
// Fill-in workflow, availability, go-to subs

// Bot Functions (from ./bots)
getBots, registerBot, deleteBot, deleteAllBots

// Messaging Functions (from ./messaging)
getConversations, startConversation, sendDirectMessage, getUnreadCount, etc.

// Chat Room Functions (from ./chat-rooms)
getPlayerChatRooms, getChatRoomMessages, sendChatMessage, etc.

// Presence Functions (from ./presence)
updatePresence, getOnlinePlayers

// Social Functions (from ./social)
reactions, cheers, achievements

// Mini Tournament Functions (from ./mini-tournaments)
createMiniTournament, etc.

// Knockout Functions (from ./knockout)
createKnockout, getKnockout, startKnockout, submitKnockoutMatch

// Feedback Functions (from ./feedback)
submitFeedback, getFeedback

// Matchmaker Functions (from ./matchmaker)
matchmakerRegister, matchmakerDrawPartners, matchmakerBreakup, etc.

// Notable Performances (from ./notable-performances)
getNotablePerformances, etc.

// Stats Verification (from ./stats-verification)
getVerificationStatus, submitVerification

// Admin Functions (from ./admin-functions)
adminGetDashboard, adminUpdateLeague, adminDeletePlayer, etc.

// Direct exports in index.js:
checkInPlayer, bulkCheckIn, addWalkIn, submitLeagueMatchScore,
getTournamentSummary, undoCheckIn, addEventToTournament,
saveLeagueTemplate, getLeagueTemplates, saveTournamentTemplate,
getTournamentTemplates, fixLeagueTeamNames, fixMatchTeamIds,
updateMatchDates, updatePlayerTeam, fixAllPlayerTeams, etc.
```

---

## Version History

- 2026-01-21: Initial dependency map created
