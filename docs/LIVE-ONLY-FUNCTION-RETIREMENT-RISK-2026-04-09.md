# BRDC Live-Only Function Retirement Risk

Date: 2026-04-09
Project: `brdc-v2`
Scope: assess the 15 live-only deployed functions for retirement risk using the current repo, page inventory, and local feature traces.

## Bottom Line

Most of the live-only functions now look like low-usage or dead production drift.

The current repo provides:

- no frontend references to the 15 live-only function names
- no backend source definitions for the 15 live-only function names
- no visible page inventory that maps to an active org/events or squares subsystem

The only one that should be treated more carefully is `recalcPlayerStats`, because the repo has the same capability under a different current name: [recalculatePlayerStats](E:\projects\brdc-firebase\functions\leagues\index.js).

## Evidence Used

### 1. Frontend references

Direct searches of `public/` found no references to the 15 live-only function names.

### 2. Backend source

Direct searches of the repo's `functions/` tree found no definitions for those 15 exact names.

### 3. Visible page inventory

The current page set includes darts app surfaces like:

- dashboard
- events
- leagues
- messages
- matchmaker
- tournament pages
- trader pages
- stream pages

But there is no visible org/events admin surface or squares game surface in the current page inventory under [public/pages](E:\projects\brdc-firebase\public\pages).

### 4. Adjacent current capabilities

- the repo has current payout/board support in [phase-3-4.js](E:\projects\brdc-firebase\functions\phase-3-4.js)
- the repo has current stat recalculation in [leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js)

That suggests at least one live-only function (`recalcPlayerStats`) is an old endpoint name for a current capability.

## Risk Tiers

### Low-Risk Retirement Candidates

These have no repo source, no frontend references, and no obvious active page surface:

- `addOrgPlayer`
- `approveOrgPlayer`
- `createOrgEvent`
- `deleteOrgEvent`
- `importOrgPlayers`
- `orgBlast`
- `registerForOrgEvent`
- `removeOrgPlayer`
- `sendOrgMessage`
- `updateOrgEvent`
- `updateOrgPlayer`
- `adminUpdateSquare`
- `claimSquare`
- `initSquaresGame`

Interpretation:

- these look like old feature islands still deployed in production
- they should be considered retirement candidates first

### Medium-Risk Candidate

- `recalcPlayerStats`

Interpretation:

- likely a legacy endpoint name for the current repo capability `recalculatePlayerStats`
- should not be retired until we confirm no clients or admin flows still use the old name

## Recommended Cleanup Order

1. Preserve `recalcPlayerStats` for now.
2. Treat the 14 org/squares functions as the first retirement review set.
3. If production logging or usage checks show no traffic, retire those 14 before doing broader backend cleanup.
4. Later, decide whether `recalcPlayerStats` should be:
   - kept as a compatibility alias
   - reintroduced explicitly in the repo as an alias
   - or retired after confirmed non-use

## Practical Recommendation

If we do a production cleanup pass, do it in this order:

- Phase A: review or disable the 14 low-risk org/squares endpoints
- Phase B: separately handle `recalcPlayerStats`

That avoids breaking a possibly still-used stats path while removing the clearest drift first.
