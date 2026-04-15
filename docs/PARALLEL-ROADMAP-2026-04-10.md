# BRDC Parallel Task Roadmap

This roadmap groups the remaining BRDC work into parallel tracks so progress can be made without losing the rule that each individual task must still be completed end-to-end before moving on within a track.

## Track 1: Live Product And Data Integrity

Purpose:

- keep league data, imports, scorer writes, and rebuild procedures stable

Current state:

- throws-first model is enforced
- canonical player identity is enforced in imports and scorer writes
- Triples Draft standings and stats were rebuilt
- import QA is visible in director tools

Next tasks:

1. audit any remaining manual edit paths that can still mutate match or stats data outside the canonical write path
2. add per-match import QA drilldown for flagged players/legs
3. document one league repair playbook from raw throws to standings/stats verification

## Track 2: Auth And Runtime Migration

Purpose:

- move authentication and signup off the 1st Gen function line safely

Current state:

- 2nd Gen canary codebase exists at [functions-v2-canary](E:\projects\brdc-firebase\functions-v2-canary)
- deployed canary auth names:
  - `recoverPinV2Canary`
  - `registerNewPlayerV2Canary`
  - `registerPlayerSimpleV2Canary`
- self-service signup and simple registration callers now point at the 2nd Gen canary path

Next tasks:

1. promote the auth canary to stable 2nd Gen names
2. move frontend callers from `V2Canary` names to stable 2nd Gen names
3. hold the 1st Gen names as rollback/compatibility while traffic proves out

Detailed plan:

- [AUTH-CUTOVER-PLAN-2026-04-10.md](E:\projects\brdc-firebase\docs\AUTH-CUTOVER-PLAN-2026-04-10.md)

## Track 3: Repo And Surface Cleanup

Purpose:

- reduce legacy overlap and make the codebase easier to reason about

Current state:

- historical root exports and ad hoc ops clutter were archived
- docs are much cleaner
- some monolithic legacy overlap still remains in `functions/`
- the shadowed import/recalc handlers in `functions/leagues/index.js` are now explicitly quarantined in code and docs
- clear one-off function scripts were moved into `functions/_archive_review/legacy-function-scripts-2026-04-10`
- `getMatchDetails` now lives in `functions/import-debug.js`, and the dead test helper was archived out of the live functions root
- a first safe subset of admin/debug handlers has been peeled out of `functions/import-matches.js` into `functions/import-matches-admin.js`
- the remaining player-ID migration handlers have now also been peeled into `functions/import-matches-admin.js`
- `setPlayerStatsFromPerformance` has now also been moved behind the same admin boundary

Next tasks:

1. identify duplicated or dead auth/import helper logic that is now superseded by shared modules
2. classify whether any additional admin/debug endpoints should be retired from Firebase, separate from repo cleanup
3. build a site-wide feature test inventory and execution plan

## Track 4: Platform Modernization

Purpose:

- finish the Firebase runtime modernization without risking live behavior

Current state:

- managed secrets are in place
- active comms/auth paths are secret-manager capable
- direct in-place 1st Gen to 2nd Gen upgrade is confirmed unsupported

Next tasks:

1. keep expanding isolated 2nd Gen codebases instead of mutating the monolith in place
2. decide the permanent 2nd Gen auth naming/cutover strategy
3. only after auth stabilizes, choose the next narrow 2nd Gen canary surface

## Priority Order

The recommended order across tracks is:

1. Track 2 narrow auth cutover
2. Track 1 manual-write-path integrity checks
3. Track 3 repo cleanup around duplicated helpers
4. Track 4 broader platform migration planning

That keeps the highest-value live surfaces moving without reopening platform risk too early.
