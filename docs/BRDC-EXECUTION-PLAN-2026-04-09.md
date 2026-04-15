# BRDC Execution Plan

Date: 2026-04-09
Project: `brdc-v2`

## Working Rule

Complete each task fully before moving to the next one.

For each task:

1. define the scope
2. inspect the current code/config/live behavior
3. make the smallest correct change
4. verify locally or against Firebase as appropriate
5. document the result
6. only then open the next task

## Current Priority Order

### Task 1: Close out live-only function drift planning

Goal:

- finish the current function-drift investigation cleanly
- leave a precise action list for production cleanup

Done:

- live vs repo diff
- live-only classification
- retirement-risk classification
- usage check via Firebase logs

Closeout:

- treat these 14 as first retirement candidates:
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
- leave `recalcPlayerStats` alone for now

Definition of done:

- this plan exists
- the candidate list is explicit
- the exception list is explicit

### Task 2: Prepare production retirement procedure for the 14 low-risk functions

Goal:

- define exactly how to retire those 14 without risking the live site

Steps:

1. capture the live function names and current status
2. define rollback path before any deletion
3. decide whether retirement means:
   - delete functions from production
   - or leave them live temporarily but document them as unmanaged drift
4. if deletion is chosen, do it as one controlled batch
5. verify main BRDC flows after retirement

Verification checklist:

- homepage/login works
- dashboard works
- league pages work
- messages work
- events work
- tournament flows still load

Definition of done:

- either the 14 functions are retired safely
- or a deliberate hold decision is documented with reasons

### Task 3: Handle `recalcPlayerStats` separately

Goal:

- decide whether to preserve, alias, or retire the legacy stats endpoint

Steps:

1. compare the live legacy name with the repo's current stats endpoint
2. decide whether compatibility is needed
3. if needed, reintroduce a controlled alias in repo
4. if not needed, retire it later as a separate change

Definition of done:

- one explicit path chosen for the legacy stats endpoint

### Task 4: Resume repo cleanup

Goal:

- keep shrinking repo clutter without touching unfinished feature work

Priority:

1. archive obvious historical tracked artifacts
   - `old site*`
   - `DartConnect*`
   - `dcleaderboard*`
   - `dcmatchreport*`
2. keep current app/docs/functions intact
3. do not archive speculative "zombie" feature work unless it is clearly historical

Definition of done:

- historical artifacts are moved out of the active repo surface
- repo root and key directories are easier to navigate

### Task 5: Harden the next most important live pages

Goal:

- apply the same error-visibility approach used on league view to other fragile pages

Candidates:

- dashboard
- match-hub
- messages
- player-profile

Definition of done:

- pages fail visibly instead of hanging silently

## Operating Sequence

Going forward, work strictly in this sequence:

1. finish the current task completely
2. verify it
3. document it
4. only then move to the next task

## Recommended Next Action

Start Task 2.

That means preparing the exact production retirement procedure for the 14 low-risk live-only drift functions, including rollback and post-checks.
