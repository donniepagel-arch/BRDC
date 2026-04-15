# BRDC Live-Only Function Usage Check

Date: 2026-04-09
Project: `brdc-v2`
Method: `firebase functions:log`

## What Was Checked

I queried recent logs for the 14 low-risk retirement candidates:

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

I also queried:

- known active functions for sanity check:
  - `generateLeagueFeed`
  - `onChatMessageCreated`
- stats endpoints:
  - `recalcPlayerStats`
  - `recalculatePlayerStats`

## Result

All queried sets returned:

`No log entries found.`

## Interpretation

This does **not** prove the functions are unused.

It only proves that recent Firebase function log retrieval did not surface entries for them. Since the same empty result came back for known-active functions, the log stream is not strong enough here to use as a retirement decision by itself.

## Practical Conclusion

The usage check does not overturn the earlier retirement-risk assessment.

The best evidence still is:

- the 14 org/squares functions do not exist in the current repo
- the frontend does not reference them
- the visible page inventory does not map to those features

So they remain the strongest retirement candidates, but this log pass is neutral rather than confirmatory.

## Recommendation

If we want a higher-confidence retirement decision, the next best options are:

1. inspect production function source history or older deploy sources if available
2. check monitoring/analytics that are independent of Firebase function logs
3. retire the 14 candidates in a controlled batch only if you are comfortable treating them as stale production drift
