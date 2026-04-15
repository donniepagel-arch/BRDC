# Triples Draft Player Stats Repair

Date: 2026-04-09
League: `aOq4Y0ETxPZ66tM1uUtP` (`Triples Draft`)

## Scope

This repair rebuilt the Triples Draft `leagues/{leagueId}/stats` cache from completed match history.

It did **not**:
- modify raw match docs
- modify `games[].legs[].throws[]`
- modify standings again
- run a global player stats rebuild

## Why

The prior audit showed:
- all checked player stats were mismatched against raw match history
- the generic recalc path in [functions/leagues/index.js](E:\projects\brdc-firebase\functions\leagues\index.js) is not safe for this league because imported matches use player-name strings, not player objects with IDs
- the live stats cache was fragmented by short names and spelling variants

## Backup

The pre-repair stats snapshot was written locally to:

[triples-draft-stats-backup-2026-04-09.json](E:\projects\brdc-firebase\docs\data\triples-draft-stats-backup-2026-04-09.json)

## Repair Implementation

Repair script added:

[repair-triples-draft-player-stats.js](E:\projects\brdc-firebase\scripts\repair-triples-draft-player-stats.js)

The script:
- loaded league `players`, `teams`, `matches`, and existing `stats`
- built a canonical name-to-player-id map
- applied explicit aliases for imported short-name drift
- recomputed player stats from completed match history
- removed duplicate/non-canonical stats docs
- rewrote canonical stats docs with a repair marker

## Alias Normalization Used

The rebuild normalized these imported names:

- `Brian S` -> `Brian Smith`
- `Cesar A` -> `Cesar Andino`
- `Dave Brunner` -> `David Brunner`
- `Dillon Ullises` -> `Dillon Ulisses`
- `Eddie O` -> `Eddie Olschansky`
- `Eric D` -> `Eric Duale`
- `Jenn Malek` -> `Jennifer Malek`
- `Joshua kelly` -> `Josh Kelly`
- `Kevin McKelvey` -> `Kevin Mckelvey`
- `Kevin Y` -> `Kevin Yasenchak`
- `Matthew Pagel` -> `Matt Pagel`
- `Matty Wentz` -> `Matthew Wentz`
- `Mike Gonzalez` -> `Michael Gonzalez`
- `Mike Jarvis` -> `Michael Jarvis`
- `Nate Kull` -> `Nathan Kull`
- `Nicholas Mezlak` -> `Nick Mezlak`
- `Steph Kull` -> `Stephanie Kull`

## Result

After repair:
- live stats doc count: `45`
- duplicate player-name docs: `0`

Verified sample rows now carry:
- rebuilt match counts
- rebuilt game counts
- rebuilt x01/cricket leg counts
- rebuilt averages
- `repair_source: "triples-draft-match-history-2026-04-09"`

## Verified Live Examples

- `Dan Partlo`
  - `matches_played: 10`
  - `games_won: 19`
  - `x01_three_dart_avg: 57.19`
  - `cricket_mpr: 2.69`

- `Kevin Yasenchak`
  - `matches_played: 10`
  - `games_won: 32`
  - `x01_three_dart_avg: 45.42`
  - `cricket_mpr: 3.58`

- `Jennifer Malek`
  - duplicate stats docs removed
  - canonical stats doc retained under player id `7Hj4KWNpm0GviTYbwfbM`

## Status

Triples Draft player stats cache is now rebuilt to a canonical per-player set for this league.

The next cleanup question is whether this league-specific repair logic should be generalized into the main backend import/recalc path so future imported leagues do not drift the same way.
