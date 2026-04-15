# BRDC Legacy Function Quarantine

This note records the legacy function surface that still exists in source but is
not part of the canonical live BRDC write path.

## Shadowed Handler Overlap

These handlers are still defined in [functions\leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js), but they are not the canonical live import/recalc surface:

- early `exports.recalculateLeagueStats`
- legacy `exports.importMatchData`

Why they are quarantined:

- the root entrypoint in [functions\index.js](E:\projects\brdc-firebase\functions\index.js) exports the canonical import flow from [functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- the later `exports.recalculateLeagueStats` in `functions\leagues\index.js` overwrites the earlier one inside the same module

Safe interpretation:

- canonical import flow lives in `functions/import-matches.js`
- canonical scorer/manual write flow lives in `recordLeg` and `submitGameResult`
- shadowed handlers stay in source only as historical overlap until a later extraction/removal pass

## Archived One-Off Scripts

These files were moved out of the live `functions` root into:

- [functions\_archive_review\legacy-function-scripts-2026-04-10](E:\projects\brdc-firebase\functions\_archive_review\legacy-function-scripts-2026-04-10)

They are not wired into the current root export surface:

- [functions\cleanup-league.js](E:\projects\brdc-firebase\functions\cleanup-league.js)
- [functions\fix-partlo-pagel.js](E:\projects\brdc-firebase\functions\fix-partlo-pagel.js)
- [functions\recalculate-match-score.js](E:\projects\brdc-firebase\functions\recalculate-match-score.js)
- [functions\populate-match-data.js](E:\projects\brdc-firebase\functions\populate-match-data.js)
- [functions\populate-week1-matches.js](E:\projects\brdc-firebase\functions\populate-week1-matches.js)
- [functions\populate-partlo-match.js](E:\projects\brdc-firebase\functions\populate-partlo-match.js)
- [functions\populate-massimiani-match.js](E:\projects\brdc-firebase\functions\populate-massimiani-match.js)
- [functions\populate-mezlak-match.js](E:\projects\brdc-firebase\functions\populate-mezlak-match.js)
- [functions\fix-cors-final.js](E:\projects\brdc-firebase\functions\fix-cors-final.js)
- [functions\fix-cors-simple.js](E:\projects\brdc-firebase\functions\fix-cors-simple.js)
- [functions\fix-phase-cors.js](E:\projects\brdc-firebase\functions\fix-phase-cors.js)
- [functions\import-matches-backup.js](E:\projects\brdc-firebase\functions\import-matches-backup.js)
- [functions\index.js.broken](E:\projects\brdc-firebase\functions\index.js.broken)

## Keep For Now

These are mixed/legacy-looking, but still have current value:

- [functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- [functions\test-import.js](E:\projects\brdc-firebase\functions\test-import.js)

`test-import.js` should eventually be split so the live debug endpoint can stay without carrying dead test helpers in the same file.
