# Function Surface Inventory

Date: 2026-04-11
Project: BRDC / `brdc-v2`

## Current State

- full functions deploy now succeeds
- orphaned live functions that blocked full deploy were removed
- `cleanupExpiredSessions` no longer blocks deploys

## Deploy Blockers Closed Today

### Closed

- unsupported 1st-gen to 2nd-gen upgrade path on `cleanupExpiredSessions`
- orphaned live functions that no longer existed in source

### How They Were Resolved

- [secure-auth.js](E:\projects\brdc-firebase\functions\src\secure-auth.js)
  `cleanupExpiredSessions` was moved back to a 1st-gen scheduler export:
  `functions.pubsub.schedule(...).onRun(...)`

- removed orphaned live functions:
  - `addOrgPlayer`
  - `adminUpdateSquare`
  - `approveOrgPlayer`
  - `claimSquare`
  - `createOrgEvent`
  - `deleteOrgEvent`
  - `importOrgPlayers`
  - `initSquaresGame`
  - `org-blast`
  - `orgBlast`
  - `recalculateMatchScore`
  - `registerForOrgEvent`
  - `removeOrgPlayer`
  - `sendOrgMessage`
  - `updateOrgEvent`
  - `updateOrgPlayer`

## Active Export Surface

The default codebase is still large and mixed. Broadly, it contains:

### Core BRDC Active Areas

- tournaments
- leagues
- player/auth
- admin
- messaging/chat
- presence/social/friends
- import/stats
- draft / matchmaker / knockout / pickup flows

### Active High-Risk Areas

These are large, frequently touched, or critical to deploy safety:
- [functions/index.js](E:\projects\brdc-firebase\functions\index.js)
- [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- [functions/import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- [functions/global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)
- [functions/admin-functions.js](E:\projects\brdc-firebase\functions\admin-functions.js)
- [functions/chat-rooms.js](E:\projects\brdc-firebase\functions\chat-rooms.js)
- [functions/phase-5-6-7.js](E:\projects\brdc-firebase\functions\phase-5-6-7.js)

## Known Overlap / Legacy Pressure Points

### Import / Recalc Overlap

Already documented in:
- [LEGACY-FUNCTION-QUARANTINE-2026-04-10.md](E:\projects\brdc-firebase\docs\LEGACY-FUNCTION-QUARANTINE-2026-04-10.md)

Current interpretation:
- canonical import flow: [import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- canonical scorer/manual match-write flow: [leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- historical overlap still exists in source and should be peeled apart later

### Large Legacy Surface Still In Default Codebase

Examples:
- [phase-5-6-7.js](E:\projects\brdc-firebase\functions\phase-5-6-7.js)
- [additional-functions.js](E:\projects\brdc-firebase\functions\additional-functions.js)
- [advanced-features.js](E:\projects\brdc-firebase\functions\advanced-features.js)
- [stats-unification.js](E:\projects\brdc-firebase\functions\stats-unification.js)

Assessment:
- not all of this is dead
- too much of it is still bundled into the same default deploy surface

## Scheduler Surface

### Active Scheduler-Like Functions Found

- [secure-auth.js](E:\projects\brdc-firebase\functions\src\secure-auth.js)
  - `cleanupExpiredSessions`
- [advanced-features.js](E:\projects\brdc-firebase\functions\advanced-features.js)
  - `cleanupExpiredChallenges`
- [notifications.js](E:\projects\brdc-firebase\functions\notifications.js)
  - scheduled reminder paths
- [message-digest.js](E:\projects\brdc-firebase\functions\message-digest.js)
  - digest / cleanup schedules

Assessment:
- scheduler exports should be tracked explicitly as a separate deployment-risk class

## Canary / Secondary Codebase

Present:
- [functions-v2-canary](E:\projects\brdc-firebase\functions-v2-canary)

Assessment:
- useful for controlled 2nd-gen migration
- should stay separate from default production codebase until cutover plans are explicit

Current canary coverage now includes:

- auth recovery/registration canaries in [`functions-v2-canary\index.js`](E:\projects\brdc-firebase\functions-v2-canary\index.js)
- import/debug canary endpoints:
  - `getMatchDetailsV2Canary`
  - `getMatchDetailsV2`

This means the Node 22 migration path is no longer auth-only.

Deployment status:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`
- `getMatchDetailsV2Canary`
- `getMatchDetailsV2`

All five are now deployed successfully in the separate `v2canary` codebase.

## Quarantined From Deploy Packaging

The default functions package now explicitly excludes obvious non-runtime artifacts through [`functions\.gcloudignore`](E:\projects\brdc-firebase\functions\.gcloudignore):

- `_archive_review/`
- `service-account-key.json`
- `STANDARDS.md`
- `phase-3-4-batch3.js`
- `phase-3-4-batch4.js`
- `phase-5-6-7-batch5.js`
- `phase-5-6-7-batch6-FINAL.js`

Assessment:

- these files are retained in the repo/workspace
- they no longer need to ride in the deployed default functions package

Additional hardening completed in this pass:

- removed the development-only `debug_pin` response field from [player-profile.js](E:\projects\brdc-firebase\functions\player-profile.js)
- confirmed active direct `process.env` secret-style reads are now centralized in [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)

## Recommended Classification

### Keep In Default Production Codebase

- core BRDC active user flows
- current admin and messaging surfaces
- active import and stats functions

### Quarantine Next

- broad legacy “phase” modules that overlap with newer function families
- old debug/admin helpers still deployed by default but rarely needed
- scheduler group that should be documented and deployed intentionally

### Move Toward Separate Codebases Or Modules

- canary 2nd-gen work
- long-tail experimental social/advanced feature groups
- admin/repair tooling not needed in normal production operation

## Recommended Next Actions

1. Produce one active export map from `functions/index.js` grouped by domain.
2. Mark each function as:
   - active user-facing
   - active admin-only
   - active scheduler
   - legacy overlap
   - quarantine candidate
3. Split scheduler and repair/admin-heavy surfaces into more deliberate deployment groups.
4. Reduce the default codebase to the smallest safe live surface.

## Batch 1 Outcome

- deploy blockers are cleared
- the function surface is now stable enough for a deliberate quarantine/refactor pass
- next work should focus on classification and shrinkage, not emergency deploy repair
