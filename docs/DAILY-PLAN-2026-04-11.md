# BRDC Daily Plan

Date: 2026-04-11
Project: BRDC / `brdc-v2`

## Goal For Today

Stabilize the live BRDC stack, remove deploy friction, and leave one clear path for import, stats, and QA work.

## Rules For Today

- Finish each batch completely before moving to the next.
- Sequence for every batch: inspect, patch, deploy, verify, document.
- Do not run overlapping deploys.
- Keep write ownership separate when work is parallelized.
- Use the schedule-anchored, throws-first model as the source of truth.

## Parallel Tracks

### Track A: Live Verification

Owner: frontend / QA pass

Scope:
- `dashboard.html`
- `league-view.html`
- `league-director.html`
- `match-hub.html`
- `messages.html`
- chat drawer on desktop pages
- `dart-trader.html`
- scorer entry points

Output:
- one updated regression checklist
- one pass/fail snapshot for current live routes

### Track B: Runtime And Secret Inventory

Owner: infra / config

Scope:
- `functions/.env`
- deploy-time config sources
- hardcoded secret locations
- Firebase params/secrets migration targets

Output:
- inventory of active secrets
- classify each as keep temporarily / move to params / move to secrets / remove

### Track C: Functions Inventory And Legacy Quarantine

Owner: backend infra

Scope:
- active exported functions
- legacy or dead functions still in codebase
- scheduler functions
- deploy blockers and oversized blast-radius areas

Output:
- active vs legacy map
- quarantine/delete candidates
- deploy-risk notes

### Track D: Import And Stats Mainline

Owner: backend implementation

Scope:
- DartConnect import entrypoints
- throws-first import contract
- stats schema normalization
- leaderboard and match-hub consistency

Output:
- one canonical import path
- one normalized stats field contract
- repaired mismatches found during QA

## Execution Order

### Batch 1

- Save daily plan
- confirm live BRDC baseline
- inventory runtime/secrets
- inventory active vs legacy functions

### Batch 2

- clean runtime/config strategy
- reduce deploy risk from legacy functions and schedulers
- document active deployment path

### Batch 3

- harden import pipeline
- normalize stats schema
- verify repaired match/stat flows

### Batch 4

- run browser regression pass
- update docs with final status
- list remaining blockers and next-day carryover

## What Can Run In Parallel

- Track A with Track B
- Track A with Track C
- Track B with Track C
- regression checklist drafting with any inspection-only work

## What Must Stay Serialized

- deploys
- edits to the same function modules
- import parser changes and live reimports
- stats pipeline writes and post-recalc verification

## Tonight Deliverables

- `docs/DAILY-PLAN-2026-04-11.md`
- updated live verification checklist
- runtime/secret inventory
- active-vs-legacy functions inventory
- canonical import/stats follow-up list
- clean deploy status note

## Current Status

- Week 9 match repair completed and verified
- visible BRDC fixes deployed
- full functions deploy unblocked
- today starts from a deployable repo state

## Immediate Next Step

Run Batch 1:
- baseline live verification
- runtime/secret inventory
- active vs legacy function inventory
