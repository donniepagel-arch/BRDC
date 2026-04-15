# Match Data Import Guide

## Canonical Path

Use the cloud-function pipeline below as the source of truth for match imports:

1. `parseDartConnectRecap`
2. `validateImportMatchData`
3. `importMatchData`

For local helper scripts, use these files:

- `import-dc-match.js`
  Primary generic importer for DartConnect web recap data.
- `import-match-from-rtf.js`
  Legacy fallback for older RTF-based exports when a recap page is not available.
- `fetch-dc-matches.js`
  Fixture fetch helper for saving DartConnect recap/game-detail HTML into `temp/dc-web`.
- `audit-match-imports.js`
  Read-only audit helper for verifying imported match completeness before any repair.

## Recommended Usage

### 1. Fetch recap detail pages when needed

```bash
cd E:\projects\brdc-firebase\scripts
node fetch-dc-matches.js
```

### 2. Run the generic DartConnect importer

```bash
cd E:\projects\brdc-firebase\scripts
node import-dc-match.js
```

### 3. Use the RTF fallback only for historical edge cases

```bash
cd E:\projects\brdc-firebase\scripts
node import-match-from-rtf.js
```

## Current Rules

- Throws are the source of truth.
- Do not import precomputed aggregated stats as authoritative match data.
- Match identity must resolve against the BRDC schedule, not whatever names happen to appear in the recap.
- Old one-off scripts are archived and should not be reused for new imports.

## Manual Repair Scripts

These remain in place for controlled repair work, but they are not the default import flow:

- `smart-reimport.js`
- `reimport-all-matches.js`
- `reset-and-reimport-weeks-1-3.js`

Use them only when the match-level audit shows an existing import needs repair.

Classification:

- `smart-reimport.js`
  Reusable targeted repair helper for a single audited match.
- `reimport-all-matches.js`
  Historical batch repair for a bounded set of early matches. Not for routine use.
- `reset-and-reimport-weeks-1-3.js`
  Destructive reset-and-rebuild utility. Requires explicit operator review before any live run.

## Archived / Do Not Use

The following scripts have been moved under `scripts/_archive_review/import-legacy-2026-04-14/`:

- `DEPRECATED-convert-rtf-to-match-json.js`
- `import-from-dc-web.js`
- `import-dpagel-vs-ragnoni.js`
- `import-eo-vs-neon.js`
- `import-nkull-vs-drussano.js`
- `import-weeks-9-10.js`
- `import-stats-to-firestore.js`

These were one-off or superseded approaches and are retained only for reference.

The following script has been moved under `scripts/_archive_review/manual-repair-legacy-2026-04-14/`:

- `fix-partlo-pagel-score.js`
- `fix-partlo-pagel.js`
- `import-mezlak-eo-proper.js`
- `import-pagel-match.js`
- `import-all-matches.js`
- `reimport-russano-ragnoni.js`

These were one-off repair or pre-contract payload scripts and should not remain in the active tool surface.
