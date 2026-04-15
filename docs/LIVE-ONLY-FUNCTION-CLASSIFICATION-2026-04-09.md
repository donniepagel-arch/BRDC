# BRDC Live-Only Function Classification

Date: 2026-04-09
Project: `brdc-v2`
Scope: classify the 15 functions that are deployed live but do not appear in the current repo export surface.

## Summary

The current repo does not contain direct source matches for any of the 15 live-only functions.

That means these are not normal "present but unexported" functions in the local codebase. They are most likely one of:

- older production functions from code no longer present locally
- functions that were deployed from another repo or local machine state
- renamed live endpoints that have since been replaced in the repo

## Live-Only Set

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

## Classification

### 1. Likely Old Organization/Event Cluster

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

Why:

- none of these names exist in the repo tree
- the naming is internally consistent and looks like a feature family
- the current frontend does not reference these names
- the current repo does not appear to have an active organization-management module exporting these endpoints

Interpretation:

- this looks like a retired or external organization/events subsystem that is still deployed in production

### 2. Likely Old Squares/Side-Game Cluster

- `adminUpdateSquare`
- `claimSquare`
- `initSquaresGame`

Why:

- none of these names exist in the repo tree
- they form a coherent side-feature cluster
- the repo has no current source for them, even though other board/payout/tournament functions are present

Interpretation:

- this looks like a live leftover from a feature branch or earlier deploy

### 3. Likely Legacy Alias / Rename

- `recalcPlayerStats`

Why:

- the repo does contain [recalculatePlayerStats](E:\projects\brdc-firebase\functions\leagues\index.js)
- live uses the shorter `recalcPlayerStats` name instead
- no direct `recalcPlayerStats` source exists in the repo

Interpretation:

- production is probably carrying an older function name for a capability that still exists locally under a renamed endpoint

## Related Repo Evidence

The repo does contain adjacent but differently named functions:

- payout and board functions exist in:
  - [phase-3-4.js](E:\projects\brdc-firebase\functions\phase-3-4.js)
  - examples: `applyPayoutPreset`, `assignBoards`, `getBoardStatus`

- player stat recalculation exists in:
  - [leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
  - example: `recalculatePlayerStats`

But there are no direct source matches for the live-only 15 names themselves.

## Practical Conclusion

These 15 functions should be treated as production drift until proven otherwise.

The safest cleanup order is:

1. determine whether any live clients still call them
2. if not, tag them as retirement candidates
3. if yes, identify their real source of truth before any Functions cleanup deploy

## Immediate Recommendation

Do not delete or overwrite these functions yet.

Instead:

- document them as drift
- check logs or usage if available
- only then decide whether to preserve, re-source, or retire them
