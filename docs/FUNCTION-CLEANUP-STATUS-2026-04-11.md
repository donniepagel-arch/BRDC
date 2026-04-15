# Function Cleanup Status - 2026-04-11

## Completed in this pass

- Restored full `functions` deploy health for `brdc-v2`.
- Fixed a latent runtime bug in [`functions/src/messaging-config.js`](E:\projects\brdc-firebase\functions\src\messaging-config.js):
  - added `sendManagedSms(to, body)`
  - added `sendManagedEmail(to, subject, body, textOverride)`
  - exported both helpers for existing callers
- Refactored [`functions/registration-notifications.js`](E:\projects\brdc-firebase\functions\registration-notifications.js):
  - removed direct Twilio/SendGrid env wiring
  - routed SMS/email through the shared messaging helper
  - exported `sendSMS` and `sendEmail` for existing dynamic imports in [`functions/phase-5-6-7.js`](E:\projects\brdc-firebase\functions\phase-5-6-7.js)
- Extracted tournament-day handlers from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) into [`functions/tournament-day.js`](E:\projects\brdc-firebase\functions\tournament-day.js)
- Extracted template/draft handlers from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) into [`functions/templates-and-drafts.js`](E:\projects\brdc-firebase\functions\templates-and-drafts.js)
- Extracted league admin utility handlers from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) into [`functions/league-admin-utilities.js`](E:\projects\brdc-firebase\functions\league-admin-utilities.js)
- Extracted chat utility handler from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) into [`functions/chat-utilities.js`](E:\projects\brdc-firebase\functions\chat-utilities.js)
- Extracted the remaining inline callable from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) into [`functions/player-notification.js`](E:\projects\brdc-firebase\functions\player-notification.js)
- Removed commented one-off debug/data-fix stubs from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js)
- Removed commented one-off debug/data-fix stubs from [`functions/leagues/index.js`](E:\projects\brdc-firebase\functions\leagues\index.js)
- Removed stale Runtime Config setup guidance from [`functions/phase-5-6-7.js`](E:\projects\brdc-firebase\functions\phase-5-6-7.js)
- Upgraded the default functions package in [`functions/package.json`](E:\projects\brdc-firebase\functions\package.json):
  - `firebase-functions` `^5.1.1` -> `^6.6.0`
  - `firebase-admin` `^12.0.0` -> `^13.6.0`
- Converted active 1st Gen modules in the default codebase to explicit `firebase-functions/v1` imports, including extracted helper modules and [`functions/src/secure-auth.js`](E:\projects\brdc-firebase\functions\src\secure-auth.js)
- Removed the orphaned Firebase project Runtime Config key `invoker.allow`
- Normalized disabled legacy notification modules to the shared helper path:
  - [`functions/message-digest.js`](E:\projects\brdc-firebase\functions\message-digest.js)
  - [`functions/notifications.js`](E:\projects\brdc-firebase\functions\notifications.js)
  - [`functions/push-notifications.js`](E:\projects\brdc-firebase\functions\push-notifications.js)
- Deployed the helper fix live with:
  - `firebase deploy --only functions --project brdc-v2`
  - `firebase deploy --only functions:sendPlayerNotification --project brdc-v2`
  - repeated full `firebase deploy --only functions --project brdc-v2` validation after the SDK upgrade, explicit `v1` import split, and Runtime Config cleanup

## Why this fix mattered

Several deployed modules imported `sendManagedSms` and/or `sendManagedEmail`, but the shared helper did not export them. That meant notification flows could deploy successfully and still fail only at runtime when the code path was hit.

Confirmed callers:

- [`functions/admin-functions.js`](E:\projects\brdc-firebase\functions\admin-functions.js)
- [`functions/leagues/index.js`](E:\projects\brdc-firebase\functions\leagues\index.js)
- [`functions/phase-5-6-7.js`](E:\projects\brdc-firebase\functions\phase-5-6-7.js)

## Active export surface

The default codebase export surface is still broad and mixed. `functions/index.js` currently combines:

- tournament operations
- league operations
- player/captain/bot domains
- secure auth + global auth
- admin
- messaging/chat/presence/social/friends
- imports/debug utilities
- draft / pickup / knockout / feedback
- matchmaker and tournament-day helpers
- templates/drafts helper registration
- notable performances / stats verification / posts
- many standalone `https.onRequest` handlers appended directly in `index.js`

Post-cleanup status:

- the standalone live handler bodies have been removed from [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js)
- `index.js` is now primarily pass-through exports and module registration
- historical commented one-off fix stubs were removed in this pass
- the default codebase now deploys successfully on the newer Firebase SDK line while preserving the existing 1st Gen/live function names

This is deployable now, and the structural extraction goal for `index.js` has been met for this pass.

## Secret and runtime config status

Repository search results for 2026-04-11:

- No direct `functions.config()` references found in `functions/` or `functions-v2-canary/`
- Shared messaging/secret access is now centralized for active and legacy notification paths touched in this pass

Assessment:

- [`functions/message-digest.js`](E:\projects\brdc-firebase\functions\message-digest.js) is currently disabled in [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) and now uses the shared helper
- [`functions/push-notifications.js`](E:\projects\brdc-firebase\functions\push-notifications.js) is currently disabled in [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) and now uses the shared helper
- [`functions/notifications.js`](E:\projects\brdc-firebase\functions\notifications.js) remains disabled in [`functions/index.js`](E:\projects\brdc-firebase\functions\index.js) and now uses the shared helper
- [`functions/registration-notifications.js`](E:\projects\brdc-firebase\functions\registration-notifications.js) is active indirectly through [`functions/phase-5-6-7.js`](E:\projects\brdc-firebase\functions\phase-5-6-7.js) and now uses the shared helper path

The Firebase deploy warning about deprecated Runtime Config was traced to an orphaned project config key (`invoker.allow`). That key was removed, and the warning no longer appeared on the final full functions deploy.

## Quarantine candidates

Low-risk candidates for next backend cleanup pass:

1. Route all active SMS/email sending through [`functions/src/messaging-config.js`](E:\projects\brdc-firebase\functions\src\messaging-config.js) only.
2. Keep [`functions/message-digest.js`](E:\projects\brdc-firebase\functions\message-digest.js) and [`functions/push-notifications.js`](E:\projects\brdc-firebase\functions\push-notifications.js) disabled until either:
   - they are migrated to the shared helper and modern scheduler surface, or
   - they are deleted as dead code.
3. Keep dead historical fix logic out of active entrypoints and preserve history in git instead of commented code.

## Recommended next cleanup order

1. Move the default codebase off Node 20 before the April 30, 2026 deprecation date.
2. Identify dead exports that are not linked from frontend or admin tools.
3. Decide whether to expand the 2nd Gen canary beyond auth or prepare a broader live cutover plan.
4. Continue secret/config hardening so the `.env` fallback stops being the main operational dependency.
