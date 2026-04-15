# BRDC Phase 2 Roadmap

Phase 2 is the recovery and cleanup batch.

## Batch Rule

Complete each task fully before moving to the next:

1. implement
2. verify
3. document
4. then advance

## Phase 2 Scope

1. Lock rebuild and repair procedures.
2. Clean obvious BRDC repo clutter without touching active app/runtime paths.
3. Audit remaining match write paths and identify legacy overlap.

## Task 1: Rebuild And Repair Procedures

Goal:
- make league recovery repeatable instead of forensic

Deliverables:
- one operating procedure for standings rebuilds
- one operating procedure for player stats rebuilds
- one QA checklist for imports and repaired leagues

Primary doc:
- [REBUILD-AND-REPAIR-PROCEDURES-2026-04-10.md](E:\projects\brdc-firebase\docs\REBUILD-AND-REPAIR-PROCEDURES-2026-04-10.md)

Status:
- completed

## Task 2: Repo Cleanup

Goal:
- remove obvious root-level ad hoc clutter from the active repo surface

Rules:
- leave active app code, config, and supported tooling in place
- archive only clearly one-off, historical, or incident-specific root files
- do not archive `functions`, `public`, `docs`, `scripts`, `tests`, or core Firebase config

Status:
- completed

## Task 3: Write-Path Audit

Goal:
- identify which paths are canonical for match writes and which are legacy overlap

Primary doc:
- [WRITE-PATH-AUDIT-2026-04-10.md](E:\projects\brdc-firebase\docs\WRITE-PATH-AUDIT-2026-04-10.md)

Status:
- completed

## Phase 2 Outcome

BRDC now has:

- a documented recovery procedure for standings and player stats
- a cleaner repo root with obvious ad hoc clutter removed from the live surface
- a clear map of canonical vs legacy match write paths

## Next Phase Recommendation

Phase 3 should be Firebase runtime and config modernization:

1. migrate off deprecated `functions.config()`
2. normalize env and secret handling
3. align runtime/tooling versions
4. verify Hosting, Functions, and rules after modernization
