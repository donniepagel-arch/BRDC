# Triples Draft Standings Repair

Date: 2026-04-09
League: `aOq4Y0ETxPZ66tM1uUtP` (`Triples Draft`)

## Scope

This repair rebuilt team standings for Triples Draft from completed match records only.

It did **not**:
- modify raw match history
- modify `games[].legs[].throws[]`
- rebuild player stats
- run broad stat recalculation jobs

## Why

The prior audit showed that team standings stored on team docs were stale relative to completed matches.

Examples from the audit:
- `D. Russano` stored `5-1`, computed `9-1`
- `K. Yasenchak` stored `5-1`, computed `8-2`
- `N. Kull` stored `0-6`, computed `2-8`

## Source Of Truth Used

Completed match docs under:

`leagues/{leagueId}/matches/{matchId}`

For this league, standings were recomputed from completed matches using:
- match outcome for `wins/losses/ties`
- match score for `games_won/games_lost`
- leg totals for `legs_won/legs_lost`

League settings in Firestore indicated:
- `point_system: "game_based"`

So `points` was aligned to `games_won`.

## Fields Updated On Team Docs

Each team doc in `leagues/aOq4Y0ETxPZ66tM1uUtP/teams/*` was updated with:
- `wins`
- `losses`
- `ties`
- `games_won`
- `games_lost`
- `set_wins`
- `set_losses`
- `legs_won`
- `legs_lost`
- `points`
- `points_for`
- `points_against`
- `standings_updated_at`

## Verified Live Results

Read back from Firestore after the repair:

| Team | W-L | Games | Legs | Points |
|---|---:|---:|---:|---:|
| D. Russano | 9-1 | 62-28 | 122-85 | 62 |
| K. Yasenchak | 8-2 | 53-37 | 118-95 | 53 |
| E. O | 7-2 | 46-35 | 107-82 | 46 |
| J. Ragnoni | 6-4 | 54-36 | 124-93 | 54 |
| N. Mezlak | 5-4 | 46-35 | 109-83 | 46 |
| D. Pagel | 4-5 | 40-40 | 95-106 | 40 |
| Make A Wish | 3-7 | 35-52 | 95-121 | 35 |
| D. Partlo | 2-8 | 38-52 | 105-109 | 38 |
| N. Kull | 2-8 | 34-54 | 88-123 | 34 |
| neon nightmares | 2-7 | 21-60 | 63-129 | 21 |

## Status

Triples Draft team standings are now aligned to completed matches.

Player stats remain a separate cleanup task.
