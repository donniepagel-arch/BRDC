# BRDC Auth Cutover Plan

This plan defines the path from the current mixed auth deployment to a permanent 2nd Gen auth surface.

## Current State

### 1st Gen Stable Auth Names

The legacy 1st Gen auth line is still live under:

- `recoverPin`
- `registerNewPlayer`
- `registerPlayerSimple`

These are exported from:

- [global-auth.js](E:\projects\brdc-firebase\functions\global-auth.js)

### 2nd Gen Canary Auth Names

The new 2nd Gen auth line is live under:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`

These are exported from:

- [functions-v2-canary\index.js](E:\projects\brdc-firebase\functions-v2-canary\index.js)

### Shared Logic

Both lines now use the same shared handler logic:

- [functions\src\auth-http-handlers.js](E:\projects\brdc-firebase\functions\src\auth-http-handlers.js)
- [functions-v2-canary\src\auth-http-handlers.js](E:\projects\brdc-firebase\functions-v2-canary\src\auth-http-handlers.js)

## Current Frontend Caller Map

### Already On 2nd Gen Canary

- self-service registration:
  - [register.html](E:\projects\brdc-firebase\public\pages\register.html) -> `registerNewPlayerV2Canary`
  - [signup.html](E:\projects\brdc-firebase\public\pages\signup.html) -> direct canary URL
- simple registration:
  - [game-setup.html](E:\projects\brdc-firebase\public\pages\game-setup.html) -> `registerPlayerSimpleV2Canary`
  - [messages.html](E:\projects\brdc-firebase\public\pages\messages.html) -> `registerPlayerSimpleV2Canary`

### Not Using BRDC Cloud Function Recovery

These do not need BRDC auth cutover work because they use Firebase Auth password reset directly:

- [player-profile\profile-header.js](E:\projects\brdc-firebase\public\js\player-profile\profile-header.js)
- [player-profile.html](E:\projects\brdc-firebase\public\pages\player-profile.html)

## Recommended Permanent Naming

Do not keep `V2Canary` as the user-facing permanent surface.

The final 2nd Gen auth names should be:

- `recoverPinV2`
- `registerNewPlayerV2`
- `registerPlayerSimpleV2`

Reason:

- they clearly indicate the runtime generation line
- they are stable enough for production callers
- they avoid pretending to be the old 1st Gen names before retirement is complete

## Safe Cutover Strategy

### Stage 1: Expand Real Traffic On Canary

Current objective:

- keep exercising the 2nd Gen lane through low-risk registration flows
- keep the 1st Gen line untouched as fallback

Done:

- signup and simple registration callers are already on the canary path

### Stage 2: Promote Canary To Stable 2nd Gen Names

Next execution batch:

1. add new 2nd Gen stable names in [functions-v2-canary\index.js](E:\projects\brdc-firebase\functions-v2-canary\index.js):
   - `recoverPinV2`
   - `registerNewPlayerV2`
   - `registerPlayerSimpleV2`
2. deploy those new names alongside the canary names
3. leave the old 1st Gen names untouched

This gives three layers at once:

- 1st Gen legacy
- 2nd Gen canary
- 2nd Gen stable

### Stage 3: Move Frontend Callers From Canary To Stable 2nd Gen Names

After the new stable names are deployed:

1. switch:
   - [register.html](E:\projects\brdc-firebase\public\pages\register.html)
   - [signup.html](E:\projects\brdc-firebase\public\pages\signup.html)
   - [game-setup.html](E:\projects\brdc-firebase\public\pages\game-setup.html)
   - [messages.html](E:\projects\brdc-firebase\public\pages\messages.html)
2. deploy Hosting
3. verify the stable 2nd Gen names receive live traffic

### Stage 4: Hold Period

Leave the 1st Gen auth names in place during a hold period.

Recommended hold period:

- at least one normal user cycle with successful registrations on the stable 2nd Gen names

During the hold period, monitor:

- registration success rate
- notification writes
- obvious email/SMS failures

### Stage 5: Retire Canary Names

Only after stable 2nd Gen names are confirmed:

1. update any remaining callers off `V2Canary`
2. remove:
   - `recoverPinV2Canary`
   - `registerNewPlayerV2Canary`
   - `registerPlayerSimpleV2Canary`

### Stage 6: Decide Legacy 1st Gen Retirement

Only after the stable 2nd Gen names are proven and no rollback is needed:

1. audit whether any external clients still call:
   - `recoverPin`
   - `registerNewPlayer`
   - `registerPlayerSimple`
2. if none do, schedule retirement
3. if unknown, leave the legacy names in place longer

## Rollback

The rollback path must stay simple.

If the stable 2nd Gen names misbehave:

1. point frontend callers back to:
   - `registerNewPlayerV2Canary`
   - `registerPlayerSimpleV2Canary`
   or directly back to the 1st Gen names if needed
2. redeploy Hosting only
3. do not delete any auth function generation line during rollback

That keeps rollback to a caller-routing change rather than a function redeploy under pressure.

## Definition Of Done

The permanent auth cutover is complete only when:

- stable 2nd Gen auth names exist and are deployed
- all intended frontend callers point at the stable 2nd Gen names
- the canary names are no longer used by the frontend
- the 1st Gen names are either explicitly retained for compatibility or retired deliberately
- rollback instructions are documented and tested at least once as a simple caller switch
