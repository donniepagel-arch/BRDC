# BRDC Live vs Repo Functions Diff

Date: 2026-04-09
Project: `brdc-v2`
Scope: compare live deployed Firebase functions against the repo-intended export surface from `functions/index.js` and its merged modules.

## Summary

- Repo-intended exports: 478
- Live deployed functions: 431
- Shared: 416
- Live only: 15
- Repo only: 62

This is a much healthier result than the earlier rough pass. Most of the function surface is aligned. The remaining drift is concentrated in a small live-only cluster plus a larger repo-only cluster that is mostly disabled, scheduled, trigger-driven, or legacy/admin code.

## Key Findings

1. The repo and production are mostly aligned.
   - 416 functions exist in both places.
   - The major production drift is no longer "hundreds of mystery functions." It is a small live-only set.

2. The remaining live-only functions do not currently appear in the repo export surface or in the repo tree as normal exported functions.
   - That strongly suggests production is still carrying an older deployed bundle or functions from code that is no longer present locally.

3. The repo-only set is larger, but most of it does not automatically mean production is broken.
   - Several categories are intentionally not active in `functions/index.js`, or are scheduler-heavy / legacy / one-off utility code.
   - `functions/index.js` explicitly comments out some module families as disabled.

## Evidence In Repo

Representative export wiring in [functions/index.js](E:\projects\brdc-firebase\functions\index.js):

- legacy phase bundles are still merged for backward compatibility:
  - line 158: `// Phase functions (legacy - keeping for backwards compatibility)`
  - lines 159-163: `phase12`, `phase34`, `phase567`, then `Object.assign(exports, phase12, phase34, phase567);`

- some module families are explicitly disabled:
  - lines 66-68: `notifications`
  - lines 91-93: `message-digest`
  - lines 125-127: `advanced-features`
  - lines 303-305: `push-notifications`

- some one-off or partial export sections are intentionally commented out:
  - lines 154-156: old test-import bundle export
  - line 140: old cleanup bundle export
  - lines 191-207: several populate/import bundles left out of the main export path

## Live-Only Functions

These are deployed in production but were not found in the repo export surface:

- `addOrgPlayer`
- `adminUpdateSquare`
- `approveOrgPlayer`
- `claimSquare`
- `createOrgEvent`
- `deleteOrgEvent`
- `importOrgPlayers`
- `initSquaresGame`
- `orgBlast`
- `recalcPlayerStats`
- `registerForOrgEvent`
- `removeOrgPlayer`
- `sendOrgMessage`
- `updateOrgEvent`
- `updateOrgPlayer`

Interpretation:

- `Org*` and `*Org*` functions look like an older organization/events feature cluster that is live but not represented in the current repo export graph.
- `adminUpdateSquare`, `claimSquare`, and `initSquaresGame` look like a separate squares feature that is live but not represented in the current repo export graph.
- `recalcPlayerStats` is likely a legacy naming variant alongside the current `recalculatePlayerStats`.

These 15 functions are the cleanest production drift candidates to investigate first.

## Repo-Only Functions

These appear in the repo export surface but are not live right now:

- `acceptBoardChallenge`
- `broadcastNotification`
- `calculateHandicap`
- `claimBounty`
- `cleanupExpiredChallenges`
- `cleanupLeagueMatches`
- `cleanupOldNotifications`
- `completeBounty`
- `createTestSinglesLeague`
- `dailyMessageDigest`
- `debugCaptain`
- `debugCheckPin`
- `debugListAllTemplates`
- `expireChallenges`
- `fixAllPlayerTeams`
- `fixDirectorInvolvements`
- `fixLeagueTeamNames`
- `fixMatchTeamIds`
- `fixPartloPagel`
- `getBountyBoard`
- `getChallengeBoard`
- `getFeaturedReplays`
- `getMatchHandicap`
- `getMatchReplay`
- `getNotificationStats`
- `getPlayerReplays`
- `handleSmsReply`
- `mondayMatchReminder`
- `morningMatchReminder`
- `notifyCaptainUnavailable`
- `onChallengeAccepted`
- `onChallengeCreated`
- `onChatRoomMention`
- `onNewMessage`
- `partloOlschanskyGames`
- `partloOlschanskyMetadata`
- `populateMassimianRagnoniMatch`
- `populateMezlakRussanoMatch`
- `populatePagelMatch`
- `populatePartloOlschanskyMatch`
- `populateYasenchakKullMatch`
- `postBounty`
- `postPublicChallenge`
- `processHighPriorityNotifications`
- `saveMatchReplay`
- `sendDirectorMessage`
- `sendMatchPinSMS`
- `sendMatchResultsEmail`
- `sendNotification`
- `sendPinRecoverySMS`
- `sendPushNotification`
- `sendSMSNotification`
- `sendTestNotification`
- `sendTieredNotification`
- `startSpectating`
- `stopSpectating`
- `testRecalculateStats`
- `updateFCMToken`
- `weeklyMessageDigest`
- `weeklyStatsRecalculation`
- `yasenchakKullGames`
- `yasenchakKullMetadata`

Interpretation:

- Several are scheduled or notification-related, which fits the disabled-module comments in `functions/index.js`.
- Several are one-off import/populate utilities that should not be assumed to belong in production.
- Several are replay/challenge/bounty style features that may simply never have been deployed from the current repo state.

This list is not a deletion list. It is a review list.

## Recommended Next Step

Review the 15 live-only functions first.

That should answer three questions:

1. Are they still intentionally used?
2. If yes, where is their source of truth?
3. If no, can they be retired from production safely?

Only after that should anything be pruned or a broader Functions deploy be considered.
