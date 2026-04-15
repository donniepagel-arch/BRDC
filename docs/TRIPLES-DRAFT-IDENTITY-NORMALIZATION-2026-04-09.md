# Triples Draft Identity Normalization

Date: 2026-04-09
League: `aOq4Y0ETxPZ66tM1uUtP` (`Triples Draft`)

## Goal

Move the live stat rebuild path toward the correct model:

- throws are the source of truth
- imported names are aliases
- stats attach to canonical internal player IDs
- substitutes and imported short-name variants resolve into the same player identity

## What Changed

The live BRDC backend in [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js) now includes a league player resolver that:

- normalizes player names
- handles common first-name variants and short-name imports
- prefers league player docs with a real `team_id`
- resolves string player names and object player refs to canonical league player identities

That resolver is now used by:

- `recalculateLeagueStats`
- `recalculatePlayerStats`
- `recalcPlayerStats`

Those functions were deployed live to Firebase.

## Live Verification

The live `recalculateLeagueStats` endpoint was invoked successfully for Triples Draft and returned:

- `matches_processed: 48`
- `games_processed: 414`
- `legs_processed: 940`
- `players_updated: 42`
- `unresolved_players: []`

That confirms the live backend can now resolve imported player-name variants without falling off the rails.

## Important Result

The throws-first rebuild now produces `42` canonical player stats docs for Triples Draft.

That is lower than the broader mixed-data repair set because four players appear in imported side/player summaries but **never appear in raw throws**:

- `Gary Schmidt`
- `Matt Hulec`
- `Mike Gonzalez`
- `Vince Walker`

Verified live:
- `throws: 0`
- `player_stats: present`
- `home_away_lists: present`

So these are not identity-resolution failures anymore. They are import completeness gaps.

## What This Means

The system is now behaving more honestly:

- if a player is represented in raw throws, they can be resolved and rebuilt into canonical stats
- if a player exists only in imported summaries, they no longer get silently blended into a throws-derived cache

That is the correct direction for the long-term model you described.

## Remaining Gap

The remaining Triples Draft issue is now specifically:

- some imported matches preserved roster/summary data for certain players
- but did not preserve throw-level player identity for those players

So their stats cannot be fully rebuilt from source truth without either:
- recovering the missing throw attribution from import logic, or
- explicitly deciding on a one-time fallback policy for incomplete imported matches

## Status

The backend now has a real identity-normalization layer for imported league stat rebuilds.

The next task is not more generic cleanup. It is deciding the policy for incomplete imported matches:

1. strict throws-only stats, accepting that some imported players remain missing
2. or a flagged fallback mode that uses imported summaries only when throws are absent
