# Runtime And Secrets Inventory

Date: 2026-04-11
Project: BRDC / `brdc-v2`

## Current Deploy Status

- full `firebase deploy --only functions --project brdc-v2` now succeeds
- targeted hosting/function deploys also succeed
- current production runtime remains `nodejs20`
- `functions/package.json` now uses `firebase-functions` `^6.6.0`
- `functions/package.json` now uses `firebase-admin` `^13.6.0`
- `functions-v2-canary/package.json` already uses `node` `22` and `firebase-functions` `^6.6.0`
- the default codebase now uses explicit `firebase-functions/v1` imports across active 1st Gen modules

## Active Secret Sources Found

### `functions/.env`

Current keys present:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `ADMIN_PIN`
- `SENDGRID_API_KEY`
- `FROM_EMAIL`

Risk:
- deployable, but not the long-term safe source of truth
- local file presence creates drift risk across machines
- now treated as local fallback and rotation source, not the intended production source of truth for messaging credentials

### Secret-Aware Shared Helper

The codebase already contains a shared helper at:
- [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)

Observed behavior:
- prefers managed-secret access when available
- falls back to `process.env`

This means the repo already has the right migration path implemented in code.

## Managed Secret Status

As of 2026-04-14, the messaging credential set is present in Firebase Secret Manager for project `brdc-v2` and has been refreshed from the current local `.env` values.

Secrets confirmed in Secret Manager:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SENDGRID_API_KEY`
- `FROM_EMAIL`

Rotation status:
- all five secrets now have an active version `2`
- the repo helper in [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js) already prefers Secret Manager over env fallback
- no code change or redeploy was required to enable that preference because the live helper already supports it

Practical classification:
- Firebase Secret Manager is now the production source of truth for the messaging credential set
- `functions/.env` remains a local-admin fallback only until production smoke verification is completed

## Active Secret Consumers Found

### Messaging / Notification Paths

- [message-digest.js](E:\projects\brdc-firebase\functions\message-digest.js)
- [push-notifications.js](E:\projects\brdc-firebase\functions\push-notifications.js)
- [registration-notifications.js](E:\projects\brdc-firebase\functions\registration-notifications.js)
- [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)

### Admin / Auth / League Messaging Surfaces

Already documented as part of the managed-secret modernization work:
- [global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)
- [admin-functions.js](E:\projects\brdc-firebase\functions\admin-functions.js)
- [leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- [phase-5-6-7.js](E:\projects\brdc-firebase\functions\phase-5-6-7.js)

## Other Sensitive Config Surfaces

### Application Default Credentials In Scripts

Several local admin scripts read:
- `GOOGLE_APPLICATION_CREDENTIALS`
- Firebase CLI application default credentials under `%APPDATA%\firebase\...`

Examples:
- [check-firestore-structure.js](E:\projects\brdc-firebase\scripts\check-firestore-structure.js)
- [check-match-dates.js](E:\projects\brdc-firebase\scripts\check-match-dates.js)
- [check-match-scores.js](E:\projects\brdc-firebase\scripts\check-match-scores.js)

Assessment:
- acceptable for local admin scripts
- not part of deployed runtime config

### Service Account File Path References

Found in migration/admin scripts:
- [migrate-to-firebase-auth.js](E:\projects\brdc-firebase\scripts\migrate-to-firebase-auth.js)

Assessment:
- local admin tooling only
- should remain out of any live deploy path

### Frontend Hardcoded PayPal SDK Client ID

Found in:
- [player-registration.html](E:\projects\brdc-firebase\public\pages\player-registration.html)

Assessment:
- public client identifier, not a secret
- still should be inventoried as environment-bound config

## `functions.config()` State

Current scan result:
- no active `functions.config()` code references found in `functions/` or `functions-v2-canary/`
- one stale migration comment in [`phase-5-6-7.js`](E:\projects\brdc-firebase\functions\phase-5-6-7.js) was cleaned during this pass

Important note:
- the deploy-time Runtime Config deprecation warning was traced to an orphaned project Runtime Config key:
  - top-level key: `invoker`
  - nested key: `allow`
- there were no repo references to `functions.config()` or `invoker.allow`
- the orphaned `invoker.allow` key was removed from the Firebase project on 2026-04-11
- after removal and redeploy, the Runtime Config deprecation warning no longer appeared during `firebase deploy --only functions --project brdc-v2`

## Runtime Modernization Blockers

Concrete blockers now confirmed in source:

- the main `functions` codebase remains heavily 1st Gen HTTP style (`functions.https.onRequest(...)`)
- the main stable line still contains explicit 1st Gen scheduler usage in [`secure-auth.js`](E:\projects\brdc-firebase\functions\src\secure-auth.js) via `functions.pubsub.schedule(...)`
- the live project layout in [`firebase.json`](E:\projects\brdc-firebase\firebase.json) intentionally splits stable `nodejs20` functions from `nodejs22` canary functions
- the 2nd Gen path is currently isolated to selected surfaces such as:
  - [`generateLeagueFeed.js`](E:\projects\brdc-firebase\functions\generateLeagueFeed.js)
  - [`chat-system.js`](E:\projects\brdc-firebase\functions\chat-system.js) Firestore trigger import
  - [`functions-v2-canary\index.js`](E:\projects\brdc-firebase\functions-v2-canary\index.js)

Practical implication:

- the next safe upgrade is not an in-place flip of the default codebase to Node 22
- the next safe move is either:
  - expand the canary pattern to another narrow domain, or
  - prepare a controlled dependency/runtime branch for the default codebase with explicit 1st Gen compatibility testing

Runtime modernization progress already completed:

- default package upgraded from `firebase-functions` `^5.1.1` / `firebase-admin` `^12.0.0`
- active default 1st Gen modules pinned to `firebase-functions/v1`
- full production deploy succeeded after the SDK upgrade and import split
- the Node 22 canary surface now includes both auth handlers and import/debug HTTP handlers in [functions-v2-canary\index.js](E:\projects\brdc-firebase\functions-v2-canary\index.js)
- direct ad hoc `process.env` reads in active live code were reduced to the shared helper in [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)
- the development-only `debug_pin` response field was removed from [player-profile.js](E:\projects\brdc-firebase\functions\player-profile.js)

## Classification

### Keep Temporarily

- `functions/.env`
  Reason: keep only as local fallback and emergency rotation source while post-rotation smoke verification is completed

### Managed Secrets In Use

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SENDGRID_API_KEY`
- `FROM_EMAIL`

### Review / Reclassify

- `ADMIN_PIN`
  Reason: this may belong in a more explicit admin-access model rather than broad env storage

## Recommended Next Actions

1. Move the default codebase off Node 20 before the runtime deprecation date.
2. Run one production SMS and one production email smoke test so the post-rotation path is verified end to end against Secret Manager-backed credentials.
3. Remove any remaining production dependence on `.env` for the messaging path once smoke verification is complete.
4. Decide whether `ADMIN_PIN` should be retired entirely now that director/admin access is on Firebase email/password.
5. Document one approved local-admin credential pattern for scripts so credential handling stops drifting.

## Batch 1 Outcome

- deploy state is clean
- no active `functions.config()` usage found
- messaging secret migration is effectively complete at the infrastructure layer
- runtime modernization is now narrowed to the Node 20 -> Node 22 migration path, not the SDK/config surface
