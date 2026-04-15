# Firebase Runtime And Config Modernization

This document records the current Firebase runtime/config state and the safe next modernization step.

## Current State

- Functions runtime in repo: `nodejs20`
- `firebase-functions`: `^5.1.1`
- `firebase-admin`: `^12.0.0`
- live frontend primarily calls Cloud Functions directly
- no active `functions.config()` usage remains in the scanned source

## Real Risks Right Now

The highest current risk is not runtime syntax. It is config hygiene:

- local secrets exist in `functions/.env`
- a local service account file exists at `functions/service-account-key.json`
- function temp artifacts still exist in `functions/`
- deploy docs were partially stale

Those problems make broad runtime upgrades riskier because configuration and secret handling are not yet fully normalized.

## Safe Modernization Order

1. keep the current runtime stable while cleaning config handling
2. move Twilio and SendGrid secrets to managed config
3. stop relying on local `.env` for deployed behavior
4. remove or quarantine stale function-side artifacts
5. only then evaluate runtime/tooling upgrades

## Managed Secret Target

The first managed-config migration target should be:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SENDGRID_API_KEY`
- `FROM_EMAIL`

These are used broadly enough across the functions codebase that centralizing them removes the biggest deployment ambiguity.

## Current Managed-Secret Migration

The first code path moved onto the shared managed-secret-capable helper is the active comms surface:

- [global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)
- [notifications.js](E:\projects\brdc-firebase\functions\notifications.js)
- [admin-functions.js](E:\projects\brdc-firebase\functions\admin-functions.js)
- [leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- [phase-5-6-7.js](E:\projects\brdc-firebase\functions\phase-5-6-7.js)
- [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)

Behavior:

- prefer Secret Manager first
- fall back to local `process.env` if managed secrets are unavailable
- continue simulating SMS/email cleanly when neither source is configured

This keeps deploys safe while moving active comms off scattered raw env reads.

## Verified Managed-Secret Cutover

The following functions were redeployed successfully during the cutover:

- `recoverPin`
- `registerNewPlayer`
- `registerPlayerSimple`

And the remaining active comms modules were updated to the same helper:

- admin PIN update SMS flow
- league captain reschedule SMS flow
- active phase-5-6-7 SMS/email admin and league messaging flows

Runtime proof:

- managed secrets were created in `brdc-v2`
- the helper now prefers Secret Manager first
- a disposable live `registerNewPlayer` invocation executed the real email path
- the notification log showed `email_sent: false`, which confirms a real attempted send on the invalid test address instead of the simulated fallback
- the disposable test player and notification log were removed afterward

## Deferred Work

These are still deferred, not ignored:

- replacing remaining legacy function overlap
- removing one-off population and repair handlers from production modules
- broader runtime/toolchain upgrades after managed config is in place

## Runtime Canary Result

A narrow runtime canary was attempted against the auth trio by moving the repo to:

- `runtime: nodejs22`
- `firebase-functions: ^6.6.0`
- `firebase-admin: ^13.6.0`

The canary did not fail on the auth code itself. It exposed two platform-level constraints:

1. one legacy scheduler in [src\secure-auth.js](E:\projects\brdc-firebase\functions\src\secure-auth.js) still used `functions.pubsub.schedule` and had to be updated to `onSchedule`
2. the deploy then failed with:
   - `Error: [recoverPin(us-central1)] Upgrading from 1st Gen to 2nd Gen is not yet supported.`

That means the real blocker is not just package age. It is that the current BRDC functions surface is still deployed as 1st Gen, while the attempted `nodejs22` move pushes the canary into a 2nd Gen migration path that Firebase will not perform in place for existing function names.

## Safe Next Runtime Plan

Do not attempt another in-place runtime jump on the current function names.

The safe next plan is:

1. keep the production surface on the stable `nodejs20` / current package line for now
2. prepare a separate 2nd Gen migration batch using:
   - new canary function names, or
   - a separate functions codebase/source
3. verify auth/comms behavior on the new 2nd Gen canary names
4. cut traffic over deliberately
5. retire the old 1st Gen names only after verification

This avoids an unsupported in-place 1st Gen -> 2nd Gen upgrade on live function names.

The concrete execution plan for that next batch is in:

- [FUNCTIONS-2ND-GEN-CANARY-PLAN-2026-04-10.md](E:\projects\brdc-firebase\docs\FUNCTIONS-2ND-GEN-CANARY-PLAN-2026-04-10.md)

## 2nd Gen Auth Canary Status

The separate 2nd Gen auth canary has now been created and verified:

- codebase: `v2canary`
- source: [functions-v2-canary](E:\projects\brdc-firebase\functions-v2-canary)
- deployed names:
  - `recoverPinV2Canary`
  - `registerNewPlayerV2Canary`
  - `registerPlayerSimpleV2Canary`

Verification result:

- disposable live registration through the new `registerNewPlayerV2Canary` path succeeded
- Firestore side effects were present and correct
- disposable test data was removed immediately after verification

This means BRDC now has a proven 2nd Gen auth lane without changing the current 1st Gen production auth names.
