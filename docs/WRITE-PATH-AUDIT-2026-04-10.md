# BRDC Write-Path Audit

This document records the current match-write surface after Phase 1 and Phase 2 cleanup.

## Canonical Match Write Paths

These are the active paths BRDC should use for match data writes:

- `parseDartConnectRecap`
- `validateImportMatchData`
- `importMatchData`
- `recordLeg`
- `submitGameResult`

These now follow the same rule set:

- schedule anchors structure
- throws anchor stats
- canonical `player_id` anchors identity
- unresolved names surface as warnings

## Canonical UI Surfaces

Current UI pages using the normalized write model:

- [league-director.html](E:\projects\brdc-firebase\public\pages\league-director.html)
- [x01-scorer.html](E:\projects\brdc-firebase\public\pages\x01-scorer.html)
- [league-cricket.html](E:\projects\brdc-firebase\public\pages\league-cricket.html)

## Confirmed Export Surface

The root functions entrypoint exports the active import flow from `import-matches.js`, not from `functions/leagues/index.js`:

- [index.js](E:\projects\brdc-firebase\functions\index.js)

Relevant lines:
- `importMatchData`
- `validateImportMatchData`
- `parseDartConnectRecap`
- `updateImportedMatchStats`
- `recalculateAllLeagueStats`
- `getMatchDetails` as a separate import-debug endpoint for admin scripts

## Legacy Overlap Still Present In Source

`functions/leagues/index.js` still contains older overlapping handlers, including:

- legacy `importMatchData`
- legacy `recalculateLeagueStats`
- older incremental stat update helpers attached to scorer flows

These do not currently define the canonical import surface because the exported live import endpoints come from `functions/import-matches.js`.

Exact quarantine points:

- the early `recalculateLeagueStats` block is shadowed by the later export in the same module
- the league-local `importMatchData` block is shadowed at the root by `functions/index.js` re-exporting the canonical import flow from `functions/import-matches.js`

Detailed quarantine note:

- [LEGACY-FUNCTION-QUARANTINE-2026-04-10.md](E:\projects\brdc-firebase\docs\LEGACY-FUNCTION-QUARANTINE-2026-04-10.md)
- [IMPORT-MATCHES-PEEL-OUT-2026-04-10.md](E:\projects\brdc-firebase\docs\IMPORT-MATCHES-PEEL-OUT-2026-04-10.md)

Current import-module shape:

- canonical live import path remains in [functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- peeled admin/debug subset now lives in [functions\import-matches-admin.js](E:\projects\brdc-firebase\functions\import-matches-admin.js)
- import inspection endpoint lives in [functions\import-debug.js](E:\projects\brdc-firebase\functions\import-debug.js)
- non-canonical performance-total writes now also sit behind [functions\import-matches-admin.js](E:\projects\brdc-firebase\functions\import-matches-admin.js)

## Current Risk Areas

1. Duplicate import and recalc logic still exists in source, which makes the repo harder to reason about.
2. `finalizeMatch` and older incremental stat helpers can still produce derived updates separately from the throws-first rebuild path.
3. Several helper and population scripts under `functions/` were archived into `_archive_review` and should not be treated as current production write paths.
4. `match-hub.html` launches scorer flows without explicitly calling `startMatch`, relying on `submitGameResult` to auto-expand game slots.

## Match Hub Classification

`match-hub.html` is not a separate scoring backend. It is:

- a read/report page
- an attendance write page
- a launcher into the canonical scorer flow

Its direct write is limited to match attendance metadata. The detailed audit is in:

- [MATCH-HUB-WRITE-AUDIT-2026-04-10.md](E:\projects\brdc-firebase\docs\MATCH-HUB-WRITE-AUDIT-2026-04-10.md)

## Phase 2 Conclusion

For active operational use, treat only these as canonical:

- import via `import-matches.js`
- scorer writes via `recordLeg`
- scorer writes via `submitGameResult`

Treat these as legacy overlap until a later cleanup pass:

- duplicate `importMatchData` in `functions/leagues/index.js`
- duplicate `recalculateLeagueStats` in `functions/leagues/index.js`
- archived one-off population and repair scripts under `functions/_archive_review/legacy-function-scripts-2026-04-10`

## Recommended Next Cleanup

When Phase 3 platform work is complete, the next code cleanup should be:

1. remove or quarantine duplicate legacy import/recalc handlers
2. isolate one-off repair scripts away from production modules
3. document one canonical write architecture in `FUNCTIONS.md`
4. later, normalize the `match-hub` scorer-launch handshake if you want the initialization path to be explicit instead of implicit
