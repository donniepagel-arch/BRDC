# Standing Authorization Workflow

Date: 2026-04-14
Project: BRDC / `brdc-v2`

## Purpose

This file is the operating rule for BRDC work so sessions do not stall on repeated approval requests.

It defines:
- what work is pre-approved
- what still requires an interruption
- how work should be grouped into phases
- how to invoke the rule at the start of a session

## Standing Authorization

When this workflow is active, the operator grants blanket approval for:
- non-destructive cleanup
- debugging
- code changes
- configuration changes
- Firebase index/rules/config updates
- deploys
- verification and smoke testing
- documentation updates
- safe local scripts

This standing approval applies across the current BRDC roadmap unless explicitly revoked.

## Phased Authorization Model

### Phase 1: Safe Cleanup And Alignment

Scope:
- repo/config drift cleanup
- Firestore index alignment
- runtime/secrets inventory
- dead-file cleanup
- documentation updates

Allowed without re-approval:
- edit repo files
- remove obvious temp/generated junk
- update Firebase indexes/rules
- deploy non-data-impacting config changes

### Phase 2: Bug Fixing And Production Stabilization

Scope:
- frontend bugs
- Cloud Function bugs
- auth/rules/index issues
- hosting/functions deploys
- production smoke checks

Allowed without re-approval:
- patch frontend/backend code
- deploy hosting/functions
- run verification scripts
- fix production-breaking config issues

### Phase 3: Data Repair And Normalization

Scope:
- standings/stat recalculation
- importer repair
- throw-data normalization
- player/sub/fill-in normalization
- controlled backfills

Allowed without re-approval:
- prepare and run repair scripts
- perform reversible or clearly scoped data corrections
- fix mismatched imported records when the source of truth is clear

Extra caution:
- if the intended data mutation is ambiguous, historically risky, or could overwrite valid league history, stop and confirm first

### Phase 4: Structural Modernization

Scope:
- runtime upgrades
- function retirement
- Firebase architecture cleanup
- auth modernization
- project structure reorganization

Allowed without re-approval:
- refactors
- staged migrations
- controlled runtime upgrades
- retirement of clearly unused code after validation

### Phase 5: QA Hardening

Scope:
- test plans
- browser QA scripts
- regression coverage
- monitoring/checklists

Allowed without re-approval:
- read-only QA
- test artifact creation
- regression harness work
- documentation of test procedures

## Stop Conditions

Interrupt the operator only for:
- destructive deletes outside obvious junk/temp/archive scope
- ambiguous live data mutations
- actions that require a human login or credential handoff
- domain or traffic-routing changes that could impact live users
- uncertain production changes where the correct business outcome is not technically provable from the repo and live state

## Working Rule

Default behavior:
- proceed through approved work without asking again
- complete each task end-to-end where practical
- deploy and verify when the change is clearly in scope
- document material decisions in `docs/`

Do not stop merely to ask:
- whether to continue debugging
- whether to deploy a fix already within scope
- whether to update docs after a completed change
- whether to run non-destructive validation

## Session Invocation

Use one of these at the start of a session:

Short form:

`Use the standing authorization workflow in docs/STANDING-AUTHORIZATION-WORKFLOW.md and proceed until you hit a listed stop condition.`

Direct form:

`I approve all non-destructive cleanup, debugging, code changes, verification, Firebase config/index/rules updates, deploys, and documentation updates across the BRDC roadmap. Only stop for destructive actions, ambiguous live data mutations, account/login steps, or anything that could change production business data incorrectly.`

## Current Phase

Active phase: `Phase 2: Bug Fixing And Production Stabilization`

Reason:
- the repo and Firebase project are now mostly aligned
- the remaining highest-value work is live bug reduction, production hardening, and verification
- data repair should follow only after the app surfaces and import paths are stable

## Current Queue

### In Progress

- production stabilization across BRDC frontend and Firebase surfaces
- cleanup of remaining auth/config/runtime inconsistencies
- verification of messaging, director, chat, and scorer flows after recent fixes

### Next Up

1. Fix visible frontend regressions that still affect live use.
2. Finish production smoke validation for messaging/email paths after managed-secret rotation.
3. Reduce chat drawer/loading-state issues and other persistent non-fatal UI errors.
4. Audit importer and match-processing paths before any broad data repair pass.

### Deferred Until Phase 3

- standings/stat recalculation
- importer-driven data backfills
- historical match repair
- player/sub/fill-in normalization writes

## Updating The Phase

When the work focus changes:
- update `Active phase`
- rewrite `In Progress`
- reorder `Next Up`
- move anything risky or data-mutating into `Deferred Until Phase 3` unless the source of truth is clear

## Notes

- This file is a workflow rule, not a substitute for good judgment.
- If a task is low-risk but not urgent, it may still be grouped into the current phase rather than handled immediately.
- If a later session changes priorities, keep the workflow and change the roadmap, not the approval model.
