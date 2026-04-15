# BRDC Functions 2nd Gen Canary Plan

This plan defines the safe path for moving BRDC Functions from the current 1st Gen deployment line to a 2nd Gen runtime without risking the live auth, messaging, and league flows.

## Why A Separate Canary Is Required

The direct runtime canary already established the real platform constraint:

- the current live BRDC functions are deployed as 1st Gen
- moving the repo to `nodejs22` triggered a 2nd Gen deploy path
- Firebase refused the in-place upgrade on live names:
  - `recoverPin(us-central1)] Upgrading from 1st Gen to 2nd Gen is not yet supported`

So the migration cannot be done by changing the runtime on the current exported function names.

## Current Stable Line

- repo runtime: `nodejs20`
- `firebase-functions`: `^5.1.1`
- `firebase-admin`: `^12.0.0`
- auth/comms secret handling already modernized through [messaging-config.js](E:\projects\brdc-firebase\functions\src\messaging-config.js)

That production line should stay intact until the separate canary has been proven.

## Canary Scope

Start with the narrow auth trio only:

- `recoverPin`
- `registerNewPlayer`
- `registerPlayerSimple`

These are the right canary targets because:

- they already run through the managed-secret helper
- they are low-blast-radius compared to leagues/admin
- they are easy to verify end-to-end

## Canary Naming

Do not reuse the live names.

Use new 2nd Gen canary names:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`

## Recommended Structure

Use a separate Functions codebase/source instead of mutating the monolithic live one in place.

Recommended repo shape:

```text
functions\                 # current 1st Gen stable line
functions-v2-canary\       # separate 2nd Gen auth canary
```

And in `firebase.json`, model it as a separate functions codebase when the canary batch begins.

## Shared Logic Rule

Do not fork business logic if it can be avoided.

The canary should reuse shared auth logic, not re-implement it. The clean pattern is:

1. extract reusable request handlers or service functions from [global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)
2. keep the current 1st Gen exports pointing at that logic
3. create 2nd Gen `onRequest` wrappers in the canary codebase that point at the same logic

That keeps behavior aligned while allowing a new deploy surface.

## Known Blockers Already Found

These issues are already known and should be addressed before the canary deploy:

1. legacy scheduler usage
   - [secure-auth.js](E:\projects\brdc-firebase\functions\src\secure-auth.js) had to be moved from `functions.pubsub.schedule` to `onSchedule`
   - there may be similar legacy scheduler assumptions elsewhere

2. repo-wide module analysis assumptions
   - a full local `index.js` load hit [feedback.js](E:\projects\brdc-firebase\functions\feedback.js), which assumes a configured Storage bucket at module load time
   - that did not block the narrow auth canary, but it is a warning sign for broader 2nd Gen migration work

3. monolithic export surface
   - [index.js](E:\projects\brdc-firebase\functions\index.js) aggregates a very large mixed-generation surface
   - this is another reason the canary should be isolated in a separate codebase

## Execution Order

### Task 1: Extract shared auth handlers

Create a shared auth service layer that contains the logic currently embedded in:

- [recoverPin](E:\projects\brdc-firebase\functions\global-auth.js)
- [registerNewPlayer](E:\projects\brdc-firebase\functions\global-auth.js)
- [registerPlayerSimple](E:\projects\brdc-firebase\functions\global-auth.js)

The target is shared request handlers or lower-level service functions, not duplicate endpoint logic.

### Task 2: Create the separate canary codebase

Add a new `functions-v2-canary` package with:

- its own `package.json`
- runtime `nodejs22`
- `firebase-functions` current v2-capable line
- only the canary auth exports

### Task 3: Deploy new canary names only

Deploy:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`

Do not alter the existing live names in this batch.

### Task 4: Verify end-to-end

Verify:

- request/response behavior matches the current 1st Gen path
- Twilio/SendGrid secret resolution still works
- Firestore writes/notification logs behave the same way

### Task 5: Decide cutover strategy

Only after canary verification:

- either switch frontend callers to the new names
- or prepare a later rename/retirement batch for the 1st Gen line

## Definition Of Done

The canary batch is complete only when all of these are true:

- the new 2nd Gen auth canary names deploy successfully
- one disposable end-to-end registration/recovery test succeeds
- the current 1st Gen auth names remain untouched and working
- behavior differences, if any, are documented before any caller cutover

## Current Canary Result

Tasks 1 through 4 are now complete for the auth canary:

- shared auth handlers were extracted from [global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)
- the extracted logic now lives in:
  - [functions\src\auth-http-handlers.js](E:\projects\brdc-firebase\functions\src\auth-http-handlers.js)
  - [functions-v2-canary\src\auth-http-handlers.js](E:\projects\brdc-firebase\functions-v2-canary\src\auth-http-handlers.js)
- a separate `v2canary` codebase was added under [functions-v2-canary](E:\projects\brdc-firebase\functions-v2-canary)
- these 2nd Gen canary functions are deployed live:
  - `recoverPinV2Canary`
  - `registerNewPlayerV2Canary`
  - `registerPlayerSimpleV2Canary`

Disposable verification was completed against `registerNewPlayerV2Canary`:

- the function returned success and created a disposable player
- Firestore showed the expected `player_signup` notification record
- the disposable player and notification record were deleted immediately after verification

One deployment adjustment was required:

- the 2nd Gen HTTP canary needed explicit `invoker: 'public'` in [functions-v2-canary\index.js](E:\projects\brdc-firebase\functions-v2-canary\index.js) so the HTTP endpoint could be exercised directly

The current state is now:

- live 1st Gen auth names unchanged
- live 2nd Gen canary auth names working
- shared auth behavior verified on both lines

The canary surface has now been expanded beyond auth with a narrow import/debug endpoint:

- `getMatchDetailsV2Canary`
- `getMatchDetailsV2`

This is intentionally low blast radius and gives the migration path a second non-auth proving ground under the Node 22 `v2canary` codebase.

Current status for that expansion:

- the shared request logic lives in [functions-v2-canary\src\import-debug-http-handlers.js](E:\projects\brdc-firebase\functions-v2-canary\src\import-debug-http-handlers.js)
- both import/debug canary endpoints deployed successfully on 2026-04-11
- the live stable 1st Gen `getMatchDetails` path remains untouched

## Not In This Batch

Do not include these in the first 2nd Gen canary:

- leagues functions
- messaging/admin bulk messaging
- tournament functions
- scorer or import flows
- repo-wide runtime cleanup

This batch is still intentionally narrow, but it is no longer auth-only.
