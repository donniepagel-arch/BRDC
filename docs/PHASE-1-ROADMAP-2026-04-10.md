# BRDC Phase 1 Roadmap

This document records the approved larger batch so BRDC work can proceed in coherent slices instead of one-off approvals.

## Batch Rule

Complete each task fully before moving to the next:

1. implement
2. verify
3. document
4. then advance

## Phase 1 Scope

Phase 1 is the product and data stability batch:

1. Lock the ingest and storage contract.
2. Finish import pipeline alignment.
3. Finish scorer and write-path alignment.
4. Verify one live end-to-end path without broad risky deploys.

## Phase 1 Tasks

### Task 1: Contract Lock

Goal:
- one canonical rule set for BRDC match data

Rules:
- scheduled match is source of truth for structure
- throws are source of truth for stats
- canonical `player_id` is source of truth for identity

Status:
- completed

Primary docs:
- [DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md](E:\projects\brdc-firebase\docs\DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md)
- [DATA-STRUCTURE.md](E:\projects\brdc-firebase\docs\DATA-STRUCTURE.md)

### Task 2: Import Pipeline Alignment

Goal:
- deterministic DartConnect import path

Completed:
- recap parsing anchored to scheduled match
- placeholder group trimming
- parsed-structure validation against scheduled game layout
- canonical player resolution on imported throws
- unresolved turn reporting
- import parse summary stored on imported matches

Primary code:
- [import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- [league-director.html](E:\projects\brdc-firebase\public\pages\league-director.html)

Status:
- completed

### Task 3: Scorer And Write-Path Alignment

Goal:
- scorer saves follow the same identity and throw rules as imports

Completed:
- `submitGameResult` normalizes player refs and leg throws before storage
- `recordLeg` normalizes leg throws before storage
- x01 scorer surfaces unresolved player warnings
- cricket scorer surfaces unresolved player warnings

Primary code:
- [index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- [x01-scorer.html](E:\projects\brdc-firebase\public\pages\x01-scorer.html)
- [league-cricket.html](E:\projects\brdc-firebase\public\pages\league-cricket.html)

Status:
- completed

### Task 4: Live Verification

Goal:
- verify one real live path after the Phase 1 changes

Verified:
- known Triples Draft recap sample parses live
- parsed groups match scheduled groups `9/9`
- unresolved turn players `0`
- sample imported throw owner resolves from `Kevin Y` to canonical player `Kevin Yasenchak`

Status:
- completed

## Phase 1 Outcome

BRDC now has one coherent match-data model:

- imports and scorers both write canonical player-linked throws
- unresolved identities surface as warnings
- standings and stats can be rebuilt from throws-first data
- ad hoc “AI figures it out” import behavior has been replaced with a deterministic guarded flow

## Next Phase Recommendation

Phase 2 should be recovery and cleanup:

1. rebuild and repair procedures
2. repo cleanup
3. remaining write-path audit for any legacy or sidecar match entry screens

After that:

Phase 3 should be Firebase runtime and config modernization:

1. migrate off `functions.config()`
2. normalize secrets and env handling
3. upgrade runtime and functions tooling
