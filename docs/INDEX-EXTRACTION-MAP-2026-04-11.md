# Index Extraction Map - 2026-04-11

## Current state

[`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) currently contains 53 direct `exports.* =` assignments.

Post-cleanup state:

- [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) now contains 25 direct `exports.* =` assignments
- no live inline `https.onRequest` or `https.onCall` handler bodies remain in `index.js`
- the only inline matches are commented historical debug/data-fix stubs

Many early exports are simple pass-throughs from imported domain modules. The large inline standalone handler block has now been extracted.

## Direct export groups

### Pass-through / domain exports

- tournament core exports at lines 21-32
- `generateLeagueFeed` at line 40
- secure auth exports at lines 56-59
- import helpers at lines 145-154
- `sendPlayerNotification` callable at line 212

These are not the main cleanup problem.

### Previously extracted standalone handler block

The following handlers used to be implemented directly inside [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) and are now extracted:

- `bulkCheckIn`
- `addWalkIn`
- `submitLeagueMatchScore`
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
- `updateMatchDates`
- `updatePlayerTeam`
- `markPlayersAsFillins`
- `addFillinsToMatchLineup`
- `listLeagueMatches`
- `getPlayerStatsFiltered`
- `createGroupChatRoom`
- `sendPlayerNotification`

## Recommended extraction order

### Batch 1: tournament-day helpers

Status:

- completed and deployed on 2026-04-11

- `bulkCheckIn`
- `addWalkIn`
- `getTournamentSummary`
- `undoCheckIn`
- `addEventToTournament`

Target module:

- [`functions/tournament-day.js`](E:\projects\brdc-firebase\functions\tournament-day.js)

Reason:

- cohesive scope
- low frontend coupling
- minimal overlap with league stats logic

Result:

- `bulkCheckIn`
- `addWalkIn`
- `getTournamentSummary`
- `undoCheckIn`
- `addEventToTournament`

now live behind [`functions/tournament-day.js`](E:\projects\brdc-firebase\functions\tournament-day.js), with [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) reduced to module registration for that batch.

### Batch 2: templates and drafts

Status:

- completed and deployed on 2026-04-11

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

Target module:

- [`functions/templates-and-drafts.js`](E:\projects\brdc-firebase\functions\templates-and-drafts.js)

Reason:

- self-contained auth and Firestore access pattern
- low risk if extracted without logic changes

Result:

- the full template/draft block now lives in [`functions/templates-and-drafts.js`](E:\projects\brdc-firebase\functions\templates-and-drafts.js)
- [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) now registers that module instead of owning those handlers inline

### Batch 3: league admin utilities

Status:

- completed and deployed on 2026-04-11

- `submitLeagueMatchScore`
- `updateMatchDates`
- `updatePlayerTeam`
- `markPlayersAsFillins`
- `addFillinsToMatchLineup`
- `listLeagueMatches`
- `getPlayerStatsFiltered`

Target module:

- [`functions/league-admin-utilities.js`](E:\projects\brdc-firebase\functions\league-admin-utilities.js)

Reason:

- shared league data shape
- moderate coupling to standings/stats logic
- should be extracted only after batch 1 and 2 reduce file churn

Result:

- the full league admin utility block now lives in [`functions/league-admin-utilities.js`](E:\projects\brdc-firebase\functions\league-admin-utilities.js)
- [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) now registers that module instead of owning those handlers inline

### Batch 4: chat utility

Status:

- completed and deployed on 2026-04-11

- `createGroupChatRoom`

Target module:

- [`functions/chat-utilities.js`](E:\projects\brdc-firebase\functions\chat-utilities.js)

Reason:

- tiny, isolated final extraction

Result:

- `createGroupChatRoom` now lives in [`functions/chat-utilities.js`](E:\projects\brdc-firebase\functions\chat-utilities.js)
- [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) now registers the chat utility module instead of keeping that handler inline

### Batch 5: player notification callable

Status:

- completed and deployed on 2026-04-11

- `sendPlayerNotification`

Target module:

- [`functions/player-notification.js`](E:\projects\brdc-firebase\functions\player-notification.js)

Reason:

- small isolated callable
- referenced by [`public/pages/matchmaker-director.html`](E:\projects\brdc-firebase\public\pages\matchmaker-director.html)
- safe final step to remove live handler bodies from `index.js`

Result:

- `sendPlayerNotification` now lives in [`functions/player-notification.js`](E:\projects\brdc-firebase\functions\player-notification.js)
- [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) now registers that module instead of owning the callable body inline

## Notification cleanup status

Notification code is cleaner than at the start of the day:

- active shared helper fixed in [`functions/src/messaging-config.js`](E:\projects\brdc-firebase\functions\src\messaging-config.js)
- active registration path refactored in [`functions/registration-notifications.js`](E:\projects\brdc-firebase\functions\registration-notifications.js)
- legacy disabled modules standardized on the shared helper:
  - [`functions/message-digest.js`](E:\projects\brdc-firebase\functions\message-digest.js)
  - [`functions/notifications.js`](E:\projects\brdc-firebase\functions\notifications.js)
  - [`functions/push-notifications.js`](E:\projects\brdc-firebase\functions\push-notifications.js)

## Safe next action

Next safe action:

- move runtime modernization onto the critical path:
  - upgrade `firebase-functions`
  - move off Node 20 before the April 30, 2026 deprecation date
  - trace and eliminate the remaining Runtime Config deprecation warning
- inventory dead/commented one-off fixes and decide what should be deleted vs archived
