# Triples Draft Player Stats Audit

Date: 2026-04-09
League: `aOq4Y0ETxPZ66tM1uUtP` (`Triples Draft`)

## Scope

This audit compared:
- raw completed match history under `leagues/{leagueId}/matches`
- cached player stats under `leagues/{leagueId}/stats`
- current backend recalculation logic in [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js)

This audit did **not** modify live player stats.

## What The Raw Match Data Actually Looks Like

Completed Triples Draft matches are team-oriented at the top level:
- `home_team_id`
- `away_team_id`
- `home_team_name`
- `away_team_name`
- `home_score`
- `away_score`

Per-player truth exists deeper inside each game and leg:
- `games[].home_players`
- `games[].away_players`
- `games[].legs[].player_stats`
- `games[].legs[].throws[]`

That nested leg data contains the real player-level darts, points, and marks totals.

## What The Cached Stats Collection Looks Like

The live `leagues/{leagueId}/stats` collection currently has `47` docs.

The pattern is broken but consistent:
- `gamesWon`-type counts are often populated
- `matches`, `losses`, `legs`, `darts`, `points`, and `marks` are mostly `0`
- one duplicate exists for `Jennifer Malek`

Example:
- `Anthony Donley`
  - raw match history computes `matches=8`, `gamesWon=23`, `legsWon=48`, `darts=1647`, `points=8773`, `marks=825`
  - live stats doc shows only `gamesWon=23`, with the rest effectively empty

## Strongest Finding

All compared player stats were mismatched.

Computed from raw completed matches:
- players found in raw history: `58`

Live cached stats docs:
- docs present: `47`

Comparison result:
- mismatches: `58 / 58`

This means the current cached player stats are not trustworthy as a complete representation of Triples Draft history.

## Why The Current Recalc Path Misses This League

The current function `recalculatePlayerStatsFromMatches()` in [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js#L759) checks membership like this:

- `homePlayers.some(p => p.id === playerId)`
- `awayPlayers.some(p => p.id === playerId)`

That only works when `game.home_players` and `game.away_players` contain player objects with IDs.

Triples Draft imported matches store those arrays as player-name strings, for example:
- `"Eddie Olschansky"`
- `"Jeff Boss"`
- `"Dan Partlo"`

So the current recalc function can silently skip imported Triples Draft participation even though the raw per-player leg data exists.

## Name / Identity Drift

Raw completed matches include multiple short-name variants that do not line up cleanly with current canonical player docs.

Examples found in raw history but not in cached stats docs:
- `Brian S`
- `Cesar A`
- `Eddie O`
- `Eric D`
- `Jenn Malek`
- `Kevin Y`
- `Matthew Pagel`
- `Matty Wentz`
- `Mike Jarvis`
- `Nicholas Mezlak`
- `Steph Kull`

There is also one spelling mismatch already visible in live stats:
- raw history: `Kevin McKelvey`
- stats doc: `Kevin Mckelvey`

So the player stats problem is **not** just stale counters. It is also an identity-normalization problem.

## Safe Conclusion

For Triples Draft:
- raw player truth still exists in completed match history
- cached player stats are incomplete and partially fragmented by name variation
- the current generic player recalc endpoint is not safe to trust for this league as-is

## Safe Next Repair

The next correct fix is a league-specific player stats rebuild for Triples Draft:

1. Build a canonical name-to-player-id map from the league `players` collection plus team rosters.
2. Add explicit alias handling for short-name variants found in imported matches.
3. Recompute player stats from:
   - `games[].legs[].player_stats`
   - `games[].legs[].throws[]`
4. Write repaired stats back by canonical `player_id`.
5. Keep this separate from global stats until the league repair is verified.

## Status

Triples Draft standings are repaired.

Triples Draft player stats are **not** yet repaired, but the audit now shows:
- where the canonical source lives
- why the current cached stats are wrong
- why the generic recalc endpoint is insufficient for this imported league
