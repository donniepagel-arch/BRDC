# Import Script Classification

Date: 2026-04-14

## Objective

Reduce importer sprawl so normal work follows one canonical path and old one-off scripts stop competing with live tooling.

## Canonical Import Surface

Cloud functions:

- `parseDartConnectRecap`
- `validateImportMatchData`
- `importMatchData`

Primary local helpers:

- `scripts/import-dc-match.js`
- `scripts/import-match-from-rtf.js`
- `scripts/fetch-dc-matches.js`
- `scripts/audit-match-imports.js`

## Keep In Place

These scripts are still useful and remain in the main `scripts/` directory:

- `import-dc-match.js`
- `import-match-from-rtf.js`
- `fetch-dc-matches.js`
- `audit-match-imports.js`
- `smart-reimport.js`
- `reimport-all-matches.js`
- `reset-and-reimport-weeks-1-3.js`

Classification inside the kept set:

- `smart-reimport.js`
  Reusable targeted repair helper.
- `reimport-all-matches.js`
  Historical bounded batch repair utility.
- `reset-and-reimport-weeks-1-3.js`
  Destructive recovery script that must stay out of routine workflows.

## Archived For Review

These scripts were moved to `scripts/_archive_review/import-legacy-2026-04-14/`:

- `DEPRECATED-convert-rtf-to-match-json.js`
- `import-from-dc-web.js`
- `import-dpagel-vs-ragnoni.js`
- `import-eo-vs-neon.js`
- `import-nkull-vs-drussano.js`
- `import-weeks-9-10.js`
- `import-stats-to-firestore.js`

Additional one-off manual repair scripts were moved to `scripts/_archive_review/manual-repair-legacy-2026-04-14/`:

- `fix-partlo-pagel-score.js`
- `fix-partlo-pagel.js`
- `import-mezlak-eo-proper.js`
- `import-pagel-match.js`
- `import-all-matches.js`
- `reimport-russano-ragnoni.js`

Reason:

- one-off match imports
- direct stats-writing path that conflicts with throws-first data rules
- superseded generic import logic
- deprecated converter output no longer aligned with the live import contract

## Operational Rule

Normal import work should start from the schedule and run through the canonical parse, validate, and import functions. Archived scripts are reference material only and should not be used for new production imports without a deliberate review.

## Next Cleanup Target

Audit the remaining manual repair scripts so each one is explicitly classified as:

- safe recurring tool
- one-time repair script to archive
- destructive repair utility requiring explicit operator review
