# BRDC Phase 3 Roadmap

Phase 3 is the Firebase runtime and config modernization batch.

## Batch Rule

Complete each task fully before moving to the next:

1. implement
2. verify
3. document
4. then advance

## Phase 3 Scope

1. lock down local secret and config handling
2. remove obvious runtime/config doc drift
3. identify the safe managed-config migration target
4. defer risky broad function upgrades until the config surface is clean

## Task 1: Config Hygiene

Goal:
- stop live secrets and local temp artifacts from being treated like repo content

Deliverables:
- stronger ignore rules
- checked-in env template only
- deploy docs that match the real function routing model

Status:
- completed

## Task 2: Managed Config Migration Plan

Goal:
- define the target for moving local `.env` secrets into managed Firebase or Google Cloud config

Primary doc:
- [FIREBASE-RUNTIME-CONFIG-MODERNIZATION-2026-04-10.md](E:\projects\brdc-firebase\docs\FIREBASE-RUNTIME-CONFIG-MODERNIZATION-2026-04-10.md)

Status:
- completed

Implemented in this phase:

- shared messaging config helper added for auth/notification code
- helper prefers local env vars, then falls back to Secret Manager lookup
- narrow deployment target is the player comms path, not the full functions surface

## Phase 3 Outcome

BRDC now has:

- stronger local secret hygiene
- deploy docs that reflect the live routing model
- an explicit modernization target instead of vague runtime-upgrade work

## Recommended Next Step

The next contained modernization action should be:

1. move Twilio and SendGrid secrets to managed config
2. remove dependence on local `.env` for deployed functions
3. then test a narrow function deploy before any broader toolchain shift
