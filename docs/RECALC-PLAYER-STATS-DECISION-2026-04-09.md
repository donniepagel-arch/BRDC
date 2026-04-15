# recalcPlayerStats Decision

Date: 2026-04-09
Project: `brdc-v2`

## Decision

Keep `recalcPlayerStats` as a backward-compatible alias to the repo's current `recalculatePlayerStats` handler.

## Why

- production still had a live `recalcPlayerStats` endpoint
- the current repo only had `recalculatePlayerStats`
- no current frontend references the old name, but the old endpoint may still be used by external admin or legacy flows
- deleting it or leaving it unmanaged would create avoidable drift

## Implementation

Added compatibility alias in [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js):

- `exports.recalcPlayerStats = exports.recalculatePlayerStats;`

## Deployment

Deployed only the alias endpoint:

```powershell
firebase deploy --only functions:recalcPlayerStats --project brdc-v2
```

Result:

- `recalcPlayerStats(us-central1)` updated successfully

## Practical Outcome

- the legacy production endpoint is now backed by current repo code
- future repo-based cleanup is less likely to drop this endpoint by accident
- no broader Functions deploy was required

## Follow-Up

No further action is needed on this endpoint unless you later decide to retire the alias deliberately.
