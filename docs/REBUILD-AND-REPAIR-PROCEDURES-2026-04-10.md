# BRDC Rebuild And Repair Procedures

This is the current recovery procedure for league standings and player stats.

## Canonical Rules

- Scheduled match structure is the source of truth for orientation and slot layout.
- `games[].legs[].throws[]` is the source of truth for stats.
- Canonical `player_id` is the source of truth for identity.
- Team standings are derived from completed matches.
- `leagues/{leagueId}/stats/{playerId}` is a cached derived view.
- Imported `player_stats` and side summaries are non-authoritative.

## Before Any Repair

1. Identify the target league and exact failure mode.
2. Confirm whether the issue is:
   - raw match data missing
   - cached standings wrong
   - cached player stats wrong
   - import attribution incomplete
3. Preserve a backup of any cached stats set before rewriting it.
4. Do not delete raw match history to fix a cache problem.

## Standings Repair Procedure

Use when:
- team wins, losses, points, or game totals do not match completed match history

Procedure:
1. Read all completed `leagues/{leagueId}/matches`.
2. Ignore scheduled or in-progress matches.
3. Recompute standings from completed match results only.
4. Write corrected team standings back to `leagues/{leagueId}/teams`.
5. Verify a few known teams against raw completed matches.

Current example:
- [TRIPLES-DRAFT-STANDINGS-REPAIR-2026-04-09.md](E:\projects\brdc-firebase\docs\TRIPLES-DRAFT-STANDINGS-REPAIR-2026-04-09.md)

## Player Stats Repair Procedure

Use when:
- player stats drift from raw match history
- duplicate stats docs exist by alias or misspelling
- imported leagues mixed names and IDs

Procedure:
1. Build or confirm league player identity resolution.
2. Recompute player stats from completed match throws only.
3. Write repaired stats by canonical `player_id`.
4. Preserve original imported labels only as audit context.
5. Remove duplicate non-canonical stats docs after the rebuilt canonical set is verified.

Current examples:
- [TRIPLES-DRAFT-PLAYER-STATS-AUDIT-2026-04-09.md](E:\projects\brdc-firebase\docs\TRIPLES-DRAFT-PLAYER-STATS-AUDIT-2026-04-09.md)
- [TRIPLES-DRAFT-PLAYER-STATS-REPAIR-2026-04-09.md](E:\projects\brdc-firebase\docs\TRIPLES-DRAFT-PLAYER-STATS-REPAIR-2026-04-09.md)

## Import QA Procedure

Use when:
- importing DartConnect data
- checking whether an imported match can be trusted

Procedure:
1. Start from the scheduled BRDC match.
2. Parse the DartConnect recap into the game-detail source.
3. Trim stale leading placeholder groups if present.
4. Validate parsed group count against scheduled game count.
5. Resolve turn owners to canonical player IDs.
6. Block import if unresolved player identity or structural mismatch remains.
7. Store parse and validation metadata on the imported match.

Primary contract:
- [DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md](E:\projects\brdc-firebase\docs\DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md)

## Safe Repair Order

When a league looks wrong, use this order:

1. verify raw match history exists
2. remove known bad test data
3. repair standings from completed matches
4. repair player stats from throws
5. verify the UI surfaces reflect the rebuilt data

## What Not To Do

- Do not run broad stats recalculation without understanding the league’s identity resolution.
- Do not treat imported side summaries as equal to throws.
- Do not repair cached stats by merging into already-bad cached stats.
- Do not archive or delete raw match records as part of standings/stat repair.

## Current Operational Endpoints

- `recalculateLeagueStats`
- `recalculatePlayerStats`
- `recalcPlayerStats`
- `parseDartConnectRecap`
- `validateImportMatchData`
- `importMatchData`

## Verification Standard

A repair is only complete when:

1. the rebuilt data reads back correctly from Firestore
2. at least one live UI surface reflects the corrected result
3. the procedure and outcome are documented in `docs/`
