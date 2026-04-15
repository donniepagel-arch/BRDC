# League Data Safety Audit

Date: 2026-04-09
Project: `brdc-v2`
Goal: define what league data is canonical, what is derived, and what can be rebuilt safely later.

## Bottom Line

You should not lose the underlying league history from the work we have done so far.

The repo’s own data model says:

- match records are the main league record
- turn-by-turn throw data inside matches is the deepest source of truth
- stats documents are cached / computed
- standings are derived from match outcomes and team records, not the deepest raw source

So if standings or player stats are currently wrong, they are fixable later as long as the underlying match and throw data still exists.

## Canonical Data

### 1. League match documents

Per [DATA-STRUCTURE.md](E:\projects\brdc-firebase\docs\DATA-STRUCTURE.md):

- `leagues/{leagueId}/matches/{matchId}` stores:
  - schedule
  - home/away teams
  - match score
  - game list
  - leg detail

This is the main league competition record.

### 2. Throw-by-throw leg data

Per [DATA-STRUCTURE.md](E:\projects\brdc-firebase\docs\DATA-STRUCTURE.md), the deepest canonical layer is:

- `leagues/{leagueId}/matches/{matchId}/games[].legs[].throws[]`

That document explicitly labels `throws[]` as:

- `SOURCE OF TRUTH`

This is what protects you best. If throws exist, much of the rest can be recalculated.

### 3. League player identity

Per [CODING-RULES.md](E:\projects\brdc-firebase\docs\CODING-RULES.md):

- canonical player identity is `leagues/{leagueId}/players/{playerId}`
- stats must be keyed by player ID, not player name

That means player IDs are the stable join key. Name strings in imported games are not trustworthy as canonical identifiers.

## Derived / Rebuildable Data

### 1. Embedded leg stats

Per [DATA-STRUCTURE.md](E:\projects\brdc-firebase\docs\DATA-STRUCTURE.md):

- `home_stats`
- `away_stats`
- `cricket_stats`

are computed from throws and can be recalculated.

### 2. League player stats

Per [DATA-STRUCTURE.md](E:\projects\brdc-firebase\docs\DATA-STRUCTURE.md):

- `leagues/{leagueId}/stats/{playerId}`

is a cached per-player season stats collection.

These docs are useful, but they are not the deepest source of truth.

### 3. Global player stats

The backend also writes rolled-up stats into:

- `players/{playerId}.stats`

These are also derived and should be treated as rebuildable summaries, not canonical match truth.

### 4. Standings

Standings are functionally derived from:

- match results
- team assignments
- player/team relationships

They may be displayed in multiple pages, but the stable input is the match and team data, not the rendered standings table itself.

## Known Risk Areas

### 1. Re-running stats can corrupt cached values if done wrong

Per [STATS-FIX-REPORT.md](E:\projects\brdc-firebase\docs\work-tracking\root-history\STATS-FIX-REPORT.md):

- `updateImportedMatchStats` previously merged into existing stats instead of replacing them
- this doubled values when recalculation was re-run

That means:

- recalculation is possible
- but it is not automatically safe unless cached stats are cleared or rebuilt correctly

### 2. Name-based imports are a known source of mismatch

Per [CODING-RULES.md](E:\projects\brdc-firebase\docs\CODING-RULES.md):

- names differ across Players, Stats, Games arrays, and DartConnect imports
- name-based lookups cause missing stats

So imported game participant names should be treated as messy input, not canonical identity.

### 3. Doubles/triples attribution has known historical bugs

Repo history and work-tracking note that some doubles/triples stat attribution has been wrong in past calculations.

That affects confidence in cached stats, not the existence of the underlying match history.

## What We Did Not Do

During this cleanup cycle, we did not:

- delete league match documents
- delete throws
- clear stats collections
- run a league-wide recalculation pass
- run a standings reset
- run a broad functions deploy that rewrites league data

So this audit does not show evidence that your raw league history was erased by our work.

## Practical Safety Model

Treat the data in this order:

1. safest source:
   - `leagues/{leagueId}/matches/{matchId}`
   - especially `games[].legs[].throws[]`

2. stable structural context:
   - `leagues/{leagueId}/players/{playerId}`
   - `leagues/{leagueId}/teams/{teamId}`

3. rebuildable caches:
   - `leagues/{leagueId}/stats/{playerId}`
   - `players/{playerId}.stats`
   - standings views / summaries

## Recommended Next Step

Before any calculation cleanup:

1. pick one live league as the audit league
2. confirm its match docs still contain:
   - match scores
   - games
   - leg data
   - throws where expected
3. compare that with:
   - `stats/{playerId}`
   - displayed standings
4. then decide whether the fix path is:
   - targeted stats rebuild
   - standings rebuild
   - import repair

## Working Conclusion

Yes: the repo structure supports keeping the current league history intact while fixing bad standings or stats later.

The main caution is not data loss.

The main caution is accidentally re-running cached-stat builders in a way that double-counts or merges bad data again.
