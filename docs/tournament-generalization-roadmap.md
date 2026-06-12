# Tournament Generalization Roadmap

## Current State

There are two overlapping tournament paths:

- the generic tournament stack
- the mixed-doubles / matchmaker stack

The mixed-doubles stack is still valid for partner draw and breakup behavior, but it should be treated as a preset, not as the product identity for tournaments in general.

## Target State

One tournament platform with selectable behavior:

- singles
- fixed doubles
- blind draw doubles
- mixed blind draw doubles
- triples / team events
- round robin groups
- single elimination
- double elimination
- custom multi-event tournaments

Preset behavior should sit on top of the generic platform, not replace it.

## What Is Already Moving In The Right Direction

- generic tournament creator remains available
- generic tournament view and bracket pages now have a player runtime surface
- runtime can expose:
  - registration status
  - active match
  - room link
  - tournament chat
  - scorer launch
  - challenge access

## Phase 1

Separate naming from capability.

- keep mixed-doubles logic working
- stop exposing Heartbreaker-style language on shared generic surfaces
- treat matchmaker behavior as a preset or mode

## Phase 2

Normalize creation and registration.

- store event type, team structure, and bracket format explicitly
- standardize registration shapes for:
  - single player
  - fixed team
  - partner-draw pool
- standardize chat room creation off tournament and event metadata

## Phase 3

Unify player runtime.

- one player runtime endpoint
- one runtime panel pattern
- one scorer launch pattern
- one chat / room access pattern

Mode-specific rules should only change the payload, not the overall experience.

## Phase 4

Unify director operations.

- one director dashboard
- one bracket management flow
- one room / board assignment flow
- one match launch path

## Immediate Next Engineering Tasks

1. Remove remaining matchmaker-only wording from shared pages and comments.
2. Add explicit team-structure controls to the generic creator UI.
3. Add player runtime cues to the director side so called matches are obvious.
4. Standardize tournament scoring config for:
   - singles
   - doubles
   - mixed formats
   - custom finals/semis rules
5. Build a live smoke checklist around the generic runtime, not the legacy mixed-doubles naming.

## Decision Rule

If a feature is only required for partner draw / breakup behavior, keep it inside that preset.
If a feature is needed for normal tournaments too, move it into the generic tournament stack.
