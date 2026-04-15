# DartConnect Import Contract

This is the current BRDC rule for imported league matches and scorer-written match data.

## Canonical Truth

- `games[].legs[].throws[]` is the source of truth.
- Scheduled BRDC match structure is the source of truth for orientation and slot layout.
- Canonical `player_id` is the source of truth for identity.
- All derived league stats must be rebuilt from throws.
- `player_stats`, side summaries, and imported totals are non-authoritative.

## Canonical Match Flow

1. Start from the scheduled BRDC match.
2. Parse DartConnect into BRDC game and leg shape.
3. Trim stale leading placeholder groups when recap data includes unsaved earlier matches.
4. Validate parsed structure against the scheduled BRDC match layout.
5. Normalize every throw into `games[].legs[].throws[]`.
6. Resolve every imported throw owner to canonical BRDC player identity where possible.
7. Store canonical `player`, `player_name`, and `player_id` on each throw.
8. Preserve the original imported name as `imported_player_label`.
9. Store parse and validation metadata on the match for audit.
10. Rebuild standings and player stats from throws.

## What Must Not Happen

- Do not let an AI freeform "figure out" the final stored match structure from a link.
- Do not import a DartConnect recap without `leagueId + matchId`.
- Do not trust recap orientation over the scheduled BRDC match.
- Do not mix `throws` and imported `player_stats` as competing sources of truth.
- Do not silently invent player identity from side placement alone when the import is ambiguous.
- Do not let scorer/manual write paths store freeform player names when canonical player IDs are available.

## Fallback Rule

- If a historical leg has no throw-level data at all, `player_stats` may be used as a temporary fallback.
- That fallback is a compatibility path, not the desired steady state.
- Current desired state is throws-first with explicit unresolved-player reporting instead of silent fallback.

## Required Audit Metadata

Imported matches should carry:

- `import_source`
- `import_review_status`
- `import_truth_source: "throws"`
- `import_contract_version`
- `import_validation`
- `import_parse_summary`

`import_parse_summary` should include:

- `recap_url`
- `games_url`
- `trimmed_placeholder_groups`
- `parsed_group_count`
- `scheduled_game_count`
- `schedule_match_id`
- `summary_only_legs`
- `unresolved_turn_players`
- `unresolved_turn_player_count`

## Import Classification

- Canonical schedule-anchored recap imports should store:
  - `import_source: "dartconnect_recap_canonical"`
  - `import_review_status: "validated_canonical"`
- Direct fallback imports without schedule-anchored parse metadata should store:
  - `import_source: "manual_review_import"`
  - `import_review_status: "manual_review_required"`

Manual-review imports are allowed as a compatibility path, but they are not equivalent to canonical recap imports.

## Validation Endpoints

Use:

- `validateImportMatchData`
- `parseDartConnectRecap`

They check:

- whether games and legs exist
- whether legs have throw-level data
- whether throws are missing player attribution
- whether throws are missing canonical `player_id`
- whether the payload is summary-only in places that should be throws-first
- whether the recap page exposes reliable home/away team labels
- whether parsed recap groups match the scheduled BRDC game count
- whether throw owners still contain placeholder `Home` / `Away` labels

## DartConnect Recap Reality

The recap URL format at `recap.dartconnect.com/matches/...` is not the true source by itself.

Current parser behavior:

- `parseDartConnectRecap` converts recap URLs to the `games` detail view
- parses turn-by-turn game detail, not just summary tabs
- trims leading placeholder-only groups when old unsaved matches are present
- anchors to the scheduled BRDC match
- blocks import when the parsed structure does not match the scheduled layout
- resolves imported turn names to canonical BRDC player IDs where possible
- reports unresolved turn owners instead of silently accepting them

## Current Code Alignment

The active import and write path now follows this rule in:

- [import-matches.js](E:\projects\brdc-firebase\functions\import-matches.js)
- [index.js](E:\projects\brdc-firebase\functions\leagues\index.js)
- [league-director.html](E:\projects\brdc-firebase\public\pages\league-director.html)
- [x01-scorer.html](E:\projects\brdc-firebase\public\pages\x01-scorer.html)
- [league-cricket.html](E:\projects\brdc-firebase\public\pages\league-cricket.html)

The approved operating rule is now:

- schedule anchors structure
- throws anchor stats
- canonical player IDs anchor identity
- unresolved names must surface as warnings, not hidden drift
