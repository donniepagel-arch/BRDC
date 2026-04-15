# Importer Audit

Date: 2026-04-14
Project: BRDC / `brdc-v2`

## Bottom Line

The canonical BRDC importer path is in the right place now, but the repo still contains overlapping legacy import surfaces that should not remain ambiguous going into any data-repair phase.

Current working rule remains correct:
- schedule anchors structure
- throws anchor stats
- canonical player IDs anchor identity

## Canonical Live Import Surface

The intended live import flow is:

1. `parseDartConnectRecap`
2. `validateImportMatchData`
3. `importMatchData`

Those are intentionally exported from:
- [functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)

And re-exported at the root entrypoint from:
- [functions\index.js](E:\projects\brdc-firebase\functions\index.js)

This path already enforces the important contract pieces:
- recap parsing requires `leagueId + matchId`
- recap structure is compared to the scheduled BRDC match
- placeholder player labels block import
- `throws` are stored as the import truth source
- parse metadata is stored on the match for audit
- non-schedule-anchored direct imports are tagged as `manual_review_import`, not canonical recap imports

## Confirmed Good Alignment

### 1. Schedule-Anchored Recap Parsing

[functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js) requires schedule context for recap parsing and blocks mismatched parsed group counts against scheduled game counts.

That matches:
- [DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md](E:\projects\brdc-firebase\docs\DARTCONNECT-IMPORT-CONTRACT-2026-04-09.md)

### 2. Throws-First Match Storage

The canonical `importMatchData` handler in
[functions\import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
stores:
- `import_truth_source: 'throws'`
- `import_contract_version`
- `import_validation`
- `import_parse_summary`
- `import_source`
- `import_review_status`

This is the correct storage shape for later audit and stat rebuild work.

### 3. League Stats Rebuild Logic Recognizes Throws As Canonical

The active league stats logic in
[functions\leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
explicitly states:
- throws are canonical
- imported `player_stats` are fallback-only when a leg has no throw-level data

That is the correct rule.

## Remaining Risk Surfaces

### 1. Shadowed Legacy League-Local Import Handler

[functions\leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
still contains an older league-local import implementation, but as of 2026-04-14 it is no longer exported as a public Cloud Function.

The file itself labels it:
- `LEGACY / SHADOWED HANDLER`

Risk:
- it still uses `admin_pin`
- it still lives next to active league logic
- it creates ambiguity during maintenance and code search
- a future edit could accidentally touch the wrong import path

Assessment:
- this should not be treated as canonical
- it has now been quarantined from the public export surface
- the remaining work is archival cleanup, not production-risk cleanup

### 2. Pre-Aggregated Stats Import Endpoint

[functions\leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
previously exposed:
- `importAggregatedStats`

Risk:
- it writes stats docs directly
- it can bypass the throws-first rebuild rule
- it keeps alive the old DartConnect-totals mentality the product is trying to get away from

Assessment:
- this was not acceptable as part of the normal importer workflow
- on 2026-04-14 it was removed from source export and deleted from production
- any future use of pre-aggregated imports should require a separately named manual/admin tool, not a canonical import endpoint

### 3. Script Sprawl Around Historical Imports

The repo still contains many one-off importer scripts under:
- [scripts](E:\projects\brdc-firebase\scripts)

Examples:
- `import-from-dc-web.js`
- `import-dc-match.js`
- `import-all-matches.js`
- match-specific one-off scripts

Risk:
- they encode old orientation assumptions
- they reflect multiple import eras
- they make it too easy to reintroduce inconsistent import behavior

Assessment:
- these should be classified into:
  - keep as canonical utility
  - archive as historical
  - delete as junk

### 4. Admin-Only Direct Match Import Bypass

[functions\admin-functions.js](E:\projects\brdc-firebase\functions\admin-functions.js)
still exposes:
- `adminImportMatchData`

Risk:
- it writes match data directly
- it does not represent the canonical parse/validate/import contract
- it can be mistaken for an approved import surface because it is admin-authenticated

Assessment:
- acceptable as a controlled admin escape hatch only
- not acceptable as the normal BRDC import path
- should be clearly labeled as noncanonical in code and docs

## Recommended Next Actions

1. Prove the canonical live caller path for normal import work is only:
   - `parseDartConnectRecap`
   - `validateImportMatchData`
   - `importMatchData`

2. Audit the `scripts/` importer set and split it into:
   - canonical helpers
   - archived historical scripts
   - trash

3. Keep `adminImportMatchData` explicitly marked as a review-only admin bypass, not a production import workflow.

4. Before any Phase 3 repair work, run one match-level audit on a known messy import and confirm:
   - scheduled layout matches parsed groups
   - stale leading placeholder groups are trimmed
   - throw owners resolve to canonical BRDC players
   - unresolved names surface as warnings, not silent writes

## Working Conclusion

The system is now close to a defensible importer architecture, but not yet clean enough to call finished.

The main risk is no longer parser ignorance.

The main risk is overlapping legacy surfaces that could let the wrong import path or wrong stats-write path survive into the next repair cycle.
