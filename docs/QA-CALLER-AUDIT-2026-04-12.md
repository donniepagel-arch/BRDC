# BRDC QA And Caller Audit - 2026-04-12

## Objective

Define the next execution pass after runtime cleanup:

- verify the pages most exposed to recent backend changes
- identify which live routes are still pinned to the default `nodejs20` function surface
- identify which routes already use the safer V2 auth path

## Source-Based Caller Findings

### Confirmed V2 Auth Callers

These frontend routes already call the newer V2 auth endpoints:

- [`public/pages/register.html`](E:\projects\brdc-firebase\public\pages\register.html)
  - `registerNewPlayerV2`
- [`public/pages/signup.html`](E:\projects\brdc-firebase\public\pages\signup.html)
  - direct POST to `registerNewPlayerV2`
- [`public/pages/messages.html`](E:\projects\brdc-firebase\public\pages\messages.html)
  - `registerPlayerSimpleV2`
- [`public/pages/game-setup.html`](E:\projects\brdc-firebase\public\pages\game-setup.html)
  - `registerPlayerSimpleV2`

### Deployed Canary Endpoints With No Current Frontend Callers

No current frontend callers were found for:

- `recoverPinV2Canary`
- `registerNewPlayerV2Canary`
- `registerPlayerSimpleV2Canary`
- `getMatchDetailsV2Canary`
- `getMatchDetailsV2`

### Default Live Surface Still Carrying Most Product Risk

These routes still depend on the default function surface and should be treated as the primary regression set:

- [`public/pages/admin.html`](E:\projects\brdc-firebase\public\pages\admin.html)
- [`public/pages/league-director.html`](E:\projects\brdc-firebase\public\pages\league-director.html)
- [`public/pages/match-hub.html`](E:\projects\brdc-firebase\public\pages\match-hub.html)
- [`public/pages/league-cricket.html`](E:\projects\brdc-firebase\public\pages\league-cricket.html)
- [`public/pages/x01-scorer.html`](E:\projects\brdc-firebase\public\pages\x01-scorer.html)
- [`public/pages/dart-trader.html`](E:\projects\brdc-firebase\public\pages\dart-trader.html)
- [`public/pages/create-league.html`](E:\projects\brdc-firebase\public\pages\create-league.html)
- [`public/pages/create-tournament.html`](E:\projects\brdc-firebase\public\pages\create-tournament.html)
- [`public/pages/director-dashboard.html`](E:\projects\brdc-firebase\public\pages\director-dashboard.html)

## Next QA Pass

### Tier 1: Runtime Boundary / Recently Changed

1. [`public/pages/register.html`](E:\projects\brdc-firebase\public\pages\register.html)
2. [`public/pages/signup.html`](E:\projects\brdc-firebase\public\pages\signup.html)
3. [`public/pages/messages.html`](E:\projects\brdc-firebase\public\pages\messages.html)
4. [`public/pages/game-setup.html`](E:\projects\brdc-firebase\public\pages\game-setup.html)

Reason:

- these are the only confirmed routes already using the V2 auth path
- they are the cleanest place to catch auth-regression fallout before broader cutover work

### Tier 2: Business-Critical Live Ops

5. [`public/pages/admin.html`](E:\projects\brdc-firebase\public\pages\admin.html)
6. [`public/pages/league-director.html`](E:\projects\brdc-firebase\public\pages\league-director.html)
7. [`public/pages/match-hub.html`](E:\projects\brdc-firebase\public\pages\match-hub.html)
8. [`public/pages/league-cricket.html`](E:\projects\brdc-firebase\public\pages\league-cricket.html)
9. [`public/pages/dart-trader.html`](E:\projects\brdc-firebase\public\pages\dart-trader.html)

Reason:

- these routes were involved in the recent production fixes
- they still depend on the default live function surface
- they carry the highest operator and league-data risk

### Tier 3: Deferred But Still Important

10. [`public/pages/create-league.html`](E:\projects\brdc-firebase\public\pages\create-league.html)
11. [`public/pages/create-tournament.html`](E:\projects\brdc-firebase\public\pages\create-tournament.html)
12. [`public/pages/director-dashboard.html`](E:\projects\brdc-firebase\public\pages\director-dashboard.html)
13. [`public/pages/league-scoreboard.html`](E:\projects\brdc-firebase\public\pages\league-scoreboard.html)

Reason:

- these are still important for backend-refactor safety
- they can follow immediately after Tier 1 and Tier 2 if no blocking regressions appear

## Recommended Next Engineering Move After QA

If Tier 1 passes cleanly:

1. decide whether `recoverPin` should get a stable V2 frontend caller path next
2. keep `getMatchDetailsV2*` as non-user-facing canary endpoints until match-hub diagnostics need them
3. begin managed-secret migration behind [`functions/src/messaging-config.js`](E:\projects\brdc-firebase\functions\src\messaging-config.js)

If Tier 1 fails:

1. fix the caller or wrapper mismatch first
2. do not broaden Node 22 caller cutover until the auth boundary is stable again

## Bottom Line

The runtime cleanup work is far enough along to proceed, but the product is not broadly cut over to Node 22 yet.

The safe next step is:

- run the QA pass above
- fix anything found
- only then move more callers or more functions toward the Node 22 line
