# BRDC Import-Matches Peel-Out

This note records the handlers still living inside
[functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
that are not part of the canonical live root export surface.

## Canonical Live Import Surface

The root entrypoint intentionally re-exports only these handlers from
[functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js):

- `importMatchData`
- `validateImportMatchData`
- `parseDartConnectRecap`
- `updateImportedMatchStats`
- `recalculateAllLeagueStats`
- `listMatches`
- `findMatch`

That mapping lives in [functions\index.js](E:\projects\brdc-firebase\functions\index.js).

## Peeled Out In This Pass

These handlers were moved into
[functions\import-matches-admin.js](E:\projects\brdc-firebase\functions\import-matches-admin.js):

- `createGlobalPlayersFromRosters`
- `consolidatePlayerIds`
- `migrateLeagueToGlobalIds`
- `lookupPlayersByEmail`
- `fixMatchScores`
- `updateToSetScores`
- `debugMatchData`
- `debugPlayerStats`
- `syncPlayerNames`
- `clearLeagueStats`
- `setPlayerStatsFromPerformance`

`functions/import-matches.js` now keeps only thin compatibility assignments for
those names, which makes the active import flow easier to scan without changing
the root live export surface.

## Remaining Decision

The main remaining decision in this area is no longer extraction. It is whether
some of the handlers now living in
[functions\import-matches-admin.js](E:\projects\brdc-firebase\functions\import-matches-admin.js)
should eventually be archived instead of retained as manual/admin tools.

## Why These Moves Matter

- they are not part of the root live export surface
- they are mixed into the same file as the canonical import path
- several use permissive HTTP patterns and would be high-risk if re-exposed
- they make the active import module harder to reason about

## Extraction Rule

When peeling these out:

1. do not rename or rewrite the canonical live import exports
2. do not change request/response shapes for the active import handlers
3. move omitted admin/debug handlers first
4. only extract shared helpers if an active handler and an admin handler both need them
5. treat Firebase deletion/retirement as a separate later step from repo extraction

## Adjacent Debug Exception

[functions\import-debug.js](E:\projects\brdc-firebase\functions\import-debug.js)
now holds the only intentionally live admin/debug import inspection endpoint:

- `getMatchDetails`

The dead legacy test helper was archived to:

- [functions\_archive_review\test-import-legacy-2026-04-10.js](E:\projects\brdc-firebase\functions\_archive_review\test-import-legacy-2026-04-10.js)
