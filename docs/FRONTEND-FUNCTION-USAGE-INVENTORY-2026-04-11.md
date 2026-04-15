# Frontend Function Usage Inventory - 2026-04-11

## Scope

This inventory captures the most important live frontend-to-function relationships found in the BRDC web app during the 2026-04-11 scan.

Base call pattern:

- [`public/js/firebase-config.js`](E:\projects\brdc-firebase\public\js\firebase-config.js) builds requests to `https://us-central1-brdc-v2.cloudfunctions.net/{functionName}`

## Current Cutover Status

The live frontend remains overwhelmingly pinned to the default 1st Gen function surface.

Confirmed Node 22 / canary-adjacent callers in current frontend source:

- [`public/pages/register.html`](E:\projects\brdc-firebase\public\pages\register.html)
  - `registerNewPlayerV2`
- [`public/pages/signup.html`](E:\projects\brdc-firebase\public\pages\signup.html)
  - direct POST to `registerNewPlayerV2`
- [`public/pages/messages.html`](E:\projects\brdc-firebase\public\pages\messages.html)
  - `registerPlayerSimpleV2`
- [`public/pages/game-setup.html`](E:\projects\brdc-firebase\public\pages\game-setup.html)
  - `registerPlayerSimpleV2`

No frontend callers were found yet for:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`
- `getMatchDetailsV2Canary`
- `getMatchDetailsV2`

Practical interpretation:

- auth registration has partial caller cutover through the stable V2 names
- recovery and import/debug canary endpoints are deployed but not yet used by the live frontend
- most product routes still depend on the default `nodejs20` codebase and must stay in the regression set

## High-value route groups

### Admin

- [`public/pages/admin.html`](E:\projects\brdc-firebase\public\pages\admin.html)
- Key functions:
  - `adminGetDashboard`
  - `adminUpdateLeague`
  - `adminUpdateTournament`
  - `adminDeleteLeague`
  - `adminDeleteTournament`
  - `adminClearData`
  - `adminGetMembers`
  - `adminUpdateMemberPermissions`
  - `adminGetPlayers`
  - `adminDeletePlayer`
  - `adminUpdatePlayer`
  - `adminGetFeedback`
  - `adminUpdateFeedback`
  - `adminDeleteFeedback`
  - `adminAddFeedback`
  - `getBots`
  - `registerBot`
  - `deleteBot`
  - `deleteAllBots`

### League creation / drafts

- [`public/pages/create-league.html`](E:\projects\brdc-firebase\public\pages\create-league.html)
- Key functions:
  - `getMemberPermissions`
  - `playerLogin`
  - `saveLeagueDraft`
  - `createLeague`

### Tournament creation / templates / drafts

- [`public/pages/create-tournament.html`](E:\projects\brdc-firebase\public\pages\create-tournament.html)
- Key functions:
  - `playerLogin`
  - `getMemberPermissions`
  - `saveTournamentTemplate`
  - `getTournamentTemplates`
  - `getTournamentTemplate`
  - `deleteTournamentTemplate`
  - `saveTournamentDraft`
  - `getTournamentDraft`

### Director dashboard

- [`public/pages/director-dashboard.html`](E:\projects\brdc-firebase\public\pages\director-dashboard.html)
- Key functions:
  - `getPlayerSession`
  - `getLeagueDraft`
  - `getTournamentDraft`
  - `deleteLeagueDraft`
  - `deleteTournamentDraft`
  - `generateBracket`
  - `getBots`
  - `addBotToTournament`
  - `updateTournamentSettings`
  - `deleteTournament`
  - `addEventToTournament`

### League ops / scoring

- [`public/pages/league-scoreboard.html`](E:\projects\brdc-firebase\public\pages\league-scoreboard.html)
- Key functions:
  - `submitLeagueMatchScore`
  - `finalizeLeagueMatch`

- [`public/js/player-profile/profile-stats.js`](E:\projects\brdc-firebase\public\js\player-profile\profile-stats.js)
- Key functions:
  - `getPlayerStatsFiltered`
  - `getPlayerStats`

- [`public/js/chat-drawer.js`](E:\projects\brdc-firebase\public\js\chat-drawer.js)
- Key functions:
  - `getConversationMessages`
  - `markConversationRead`
  - `getChatRoomMessages`
  - `markChatRoomRead`
  - `sendDirectMessage`
  - `sendChatMessage`
  - `getConversations`
  - `getPlayerChatRooms`
  - `getPlayers`
  - `createGroupChatRoom`

### Messaging / navigation

- [`public/pages/messages.html`](E:\projects\brdc-firebase\public\pages\messages.html)
- [`public/components/brdc-navigation.js`](E:\projects\brdc-firebase\public\components\brdc-navigation.js)
- [`public/js/fb-nav.js`](E:\projects\brdc-firebase\public\js\fb-nav.js)
- Key functions:
  - `getPlayerSession`
  - `getPlayerChatRooms`
  - `getConversations`
  - `startConversation`
  - `searchPlayersForChat`
  - `getUnreadNotificationCount`
  - `getNotifications`
  - `markNotificationRead`
  - `markAllNotificationsRead`

### Captain workflow

- [`public/pages/captain-dashboard.html`](E:\projects\brdc-firebase\public\pages\captain-dashboard.html)
- Key functions:
  - `getCaptainDashboard`
  - `getPlayerSession`
  - `updateTeamName`
  - `sendTeamInvite`
  - `setMatchLineup`
  - `sendFillinRequests`
  - `confirmFillin`
  - `sendCaptainMessageV2`
  - `setPlayerAvailability`

### Matchmaker

- [`public/pages/matchmaker-director.html`](E:\projects\brdc-firebase\public\pages\matchmaker-director.html)
- [`public/pages/matchmaker-register.html`](E:\projects\brdc-firebase\public\pages\matchmaker-register.html)
- [`public/pages/matchmaker-view.html`](E:\projects\brdc-firebase\public\pages\matchmaker-view.html)
- Key functions:
  - `getMatchmakerStatus`
  - `getMatchmakerTeams`
  - `matchmakerRegister`
  - `checkInPlayer`
  - `deleteMatchmakerRegistration`
  - `markNoShow`
  - `matchmakerDrawPartners`
  - `matchmakerBreakup`
  - `matchmakerRematch`
  - `getHeartbrokenTeams`
  - `getMingleStatus`
  - `sendPlayerNotification`
  - `runCupidShuffle`
  - `startMinglePeriod`
  - `endMinglePeriod`

## Functions directly affected by current cleanup

These are live and should stay in the regression set after each backend refactor:

- `bulkCheckIn`
- `addWalkIn`
- `getTournamentSummary`
- `undoCheckIn`
- `addEventToTournament`
- `saveLeagueTemplate`
- `getLeagueTemplates`
- `getLeagueTemplate`
- `deleteLeagueTemplate`
- `saveLeagueDraft`
- `getLeagueDraft`
- `deleteLeagueDraft`
- `saveTournamentTemplate`
- `getTournamentTemplates`
- `getTournamentTemplate`
- `deleteTournamentTemplate`
- `saveTournamentDraft`
- `getTournamentDraft`
- `deleteTournamentDraft`

## Immediate testing priority after backend refactors

1. [`public/pages/create-tournament.html`](E:\projects\brdc-firebase\public\pages\create-tournament.html)
2. [`public/pages/create-league.html`](E:\projects\brdc-firebase\public\pages\create-league.html)
3. [`public/pages/director-dashboard.html`](E:\projects\brdc-firebase\public\pages\director-dashboard.html)
4. [`public/pages/admin.html`](E:\projects\brdc-firebase\public\pages\admin.html)
5. [`public/pages/league-scoreboard.html`](E:\projects\brdc-firebase\public\pages\league-scoreboard.html)

## 2026-04-12 QA / Caller-Audit Execution Order

Run these first because they either changed recently or sit directly on the runtime boundary:

1. [`public/pages/register.html`](E:\projects\brdc-firebase\public\pages\register.html)
2. [`public/pages/signup.html`](E:\projects\brdc-firebase\public\pages\signup.html)
3. [`public/pages/messages.html`](E:\projects\brdc-firebase\public\pages\messages.html)
4. [`public/pages/game-setup.html`](E:\projects\brdc-firebase\public\pages\game-setup.html)
5. [`public/pages/admin.html`](E:\projects\brdc-firebase\public\pages\admin.html)
6. [`public/pages/league-director.html`](E:\projects\brdc-firebase\public\pages\league-director.html)
7. [`public/pages/match-hub.html`](E:\projects\brdc-firebase\public\pages\match-hub.html)
8. [`public/pages/league-cricket.html`](E:\projects\brdc-firebase\public\pages\league-cricket.html)
9. [`public/pages/dart-trader.html`](E:\projects\brdc-firebase\public\pages\dart-trader.html)

These nine routes now form the minimum useful regression set before any wider Node 22 caller cutover.
