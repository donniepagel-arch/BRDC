# Non-Frontend Function Classification

Date: 2026-04-09
Project: `brdc-v2`

This document classifies the live/backend function surface that is not directly referenced by the current frontend inventory.

It is a safety document, not a deletion plan.

## Keep: event-driven or scheduled infrastructure

These are not expected to appear in frontend calls and should be treated as backend infrastructure:

- `generateLeagueFeed`
  - Callable/v2 workflow helper
  - explicitly exported in `functions/index.js`
- `onChatMessageCreated`
  - Firestore trigger in `functions/chat-system.js`
- `cleanupExpiredSessions`
  - scheduled/auth cleanup from `functions/src/secure-auth.js`

Potentially still meant to exist, but currently disabled in `functions/index.js`:

- `mondayMatchReminder`
- `morningMatchReminder`
- `sendMatchResultsEmail`
- `dailyMessageDigest`
- `weeklyMessageDigest`
- `processHighPriorityNotifications`
- `cleanupOldNotifications`
- `cleanupExpiredChallenges`
- `onChallengeCreated`
- `onNewMessage`
- `onChatRoomMention`
- `onChallengeAccepted`

These should not be removed blindly if they still exist live. They need explicit intent:
- either re-adopt in repo exports
- or mark as retired and delete from production in a controlled pass

## Keep: admin/manual/operational endpoints

These may not appear in normal frontend inventory but are plausible operator tools, migration helpers, or maintenance endpoints.

Examples from the repo/export surface:

- `checkMigrationStatus`
- `migrateTeamPlayersToDocuments`
- `recalculateTeamStandings`
- `importMatchData`
- `updateImportedMatchStats`
- `recalculateAllLeagueStats`
- `listMatches`
- `findMatch`
- `getMatchDetails`

These should be treated as:
- `manual keep` if they are still part of operations
- `retire candidate` only after confirming they are no longer used in admin workflows

## Legacy overlap: duplicated feature families

There are several areas where the backend appears to carry more than one generation of implementation.

### Notifications

Likely overlapping families:

- `functions/notification-api.js`
- `functions/notifications.js`
- `functions/push-notifications.js`

Observed risk:
- multiple endpoints with similar names such as unread/read notification actions
- mixed v1 HTTP and event/scheduled behavior

### Chat

Likely overlapping families:

- `functions/messaging.js`
- `functions/chat-rooms.js`
- `functions/chat-system.js`
- `functions/chat-live-matches.js`
- `functions/chat-challenges.js`

Observed risk:
- multiple overlapping concepts for rooms/channels/messages/challenges
- likely deliberate layering, but still a large drift surface

### League and phase modules

Likely overlapping families:

- `functions/leagues/index.js`
- `functions/phase-5-6-7.js`
- legacy batch files for similar capabilities

Observed risk:
- endpoints with similar conceptual ownership across “league” and “phase” implementations

## Retire candidates: clearly historical or one-time scripts

These are the safest long-term retirement candidates, but only after confirming they are not still deployed and used manually:

- one-off match population/fix functions
- one-time migration helpers
- backup/import variants
- temporary batch-phase duplicates

Examples visible in the repo history/comments:

- populate/fix scripts that are already marked as removed from `functions/index.js`
- commented-out one-time exports in `functions/index.js`

If any of these still exist live, they are strong candidates for:
- documenting
- disabling from repo
- then deleting from production explicitly

## Highest-risk mismatch

`functions/index.js` currently comments out several modules as “temporarily disabled” or “removed”, while production appears to carry a broader live function inventory.

That means:
- production is not guaranteed to match the repo’s declared intent
- a blanket functions deploy could unintentionally remove or replace live behaviors

## Recommended next pass

1. Generate a precise diff:
   - live function names
   - repo-exported function names from `functions/index.js`
2. Split the diff into:
   - `live only`
   - `repo only`
   - `shared`
3. Review `live only` first:
   - infrastructure keep
   - manual keep
   - retire candidate

Until that diff exists, function retirement should remain read-only planning, not production action.
