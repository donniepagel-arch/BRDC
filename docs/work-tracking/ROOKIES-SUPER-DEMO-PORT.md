# Rookies Super Demo Port

## Goal

Use the Rookies branded vNext site as the polished SaaS reference implementation, then port the successful patterns back into BRDC vNext for testing before replacing the current BRDC main site.

## Create Event Port Status

Completed on 2026-05-31:

- Rookies create-event page uses the compact dark scorer setup style.
- Blind draw, weekly series, and mixed doubles matchmaker presets are present.
- Board availability fields are present: boards available and unavailable boards.
- Blind draw fields are present: draw type, draw pool, house player, runtime bracket generation.
- Runtime fields are present: chat, rooms, check-in, self-report, challenges, notifications, video placeholders, score assist placeholders.
- Format fields are present: event type, bracket format, game, legs, leg mode, sets, set mode, in/out rules, start/cork rules, cork option, cork order, winner choice behavior, late-round overrides.
- Multiple events can be added in the Rookies builder.
- Tournament image and event image fields are present and wired to Firebase Storage upload before create.
- Mixed-leg rows are generated dynamically from the total legs value.
- Backend `createTournament` persists board, draw, series, runtime, event, mixed-leg, playoff override, and image fields.

Verified without submitting create forms:

- Mobile and desktop load without horizontal overflow.
- Add event works.
- Mixed legs regenerate when total legs changes.
- Preset remains `blind_draw`.
- Draw type remains `blind_draw_doubles`.
- Dark field styling matches the scorer setup direction.

Completed on 2026-05-31:

- Renamed the create-event preset selector to the clearer `Start from` template selector.
- Updated the matchmaker template label to `Mixed doubles matchmaker`.
- Added matchmaker-specific settings to the Rookies create-event page: partner matching, breakup/rematch flow, summaries, nudge limit, winners game/best-of, losers game/best-of, and mingle cutoff.
- Added `mixed_doubles` as an entry type in the event format editor.
- Wired the matchmaker template payload to `createMixedDoublesMatchmakerTournament`.
- Updated the matchmaker create function to respect director-configured matchmaker options instead of hardcoding every setting.

Verified with intercepted no-write create test:

- The live Rookies builder calls `createMixedDoublesMatchmakerTournament`, not generic `createTournament`.
- No Firestore tournament was created during the test; the Cloud Function request was intercepted and fulfilled locally.
- Payload includes `preset: mixed_doubles_matchmaker`, `matchmaker_enabled: true`, `entry_type: mixed_doubles`, `format: double_elimination`, `winners_game_type: cricket`, `winners_best_of: 3`, `losers_game_type: 501`, `losers_best_of: 1`, `mingle_cutoff: wc_r2_last_start`, `boards_available: 12`, `draw_type: manual_teams`, and `draw_pool: checked_in_only`.
- Desktop and mobile checks had no horizontal overflow.

## Remaining Port Work

- Template/draft workflow: OG page shows Save Template, Load Template, and Save Draft controls, but the current OG code marks templates as temporarily unavailable during auth migration. Decide whether to rebuild this as a real vNext feature or leave it out of the demo.
- Runtime visual parity: tournament runtime now has a matchmaker-first panel and compact operation cards, but generic tournament action flow still needs a no-write action pass.
- Registration page parity: matchmaker registration now requires email/phone/gender and supports single or partner entries. Generic registration still needs a no-write submit pass.
- Bracket page parity: confirm single elimination, double elimination, blind draw teams, board assignments, and scorer launch all look and behave demo-ready.
- Matchmaker parity: create setup is now wired, but older matchmaker pages still contain specialized mingle, partner draw, breakup/rematch, board, TV, and registration flows. These should be ported into the Rookies vNext director/runtime surfaces before selling the full matchmaker story.
- BRDC vNext port: once Rookies super demo patterns are locked, apply them back to BRDC vNext and test before replacing the current BRDC main site.

## Super Demo QA - 2026-06-01

Completed:

- Deployed Rookies frontend to `fortheloveofdarts`.
- Deployed `matchmakerRegister` function with phone persistence for nested matchmaker registration records.
- Fixed tournament runtime meta assignment drift.
- Hid the Rookies floating hub badge on tournament registration/runtime pages where it covered live controls.
- Renamed the matchmaker registration event section to `Entry / Choose entry type`.
- Reran targeted no-write fixture QA:
  - Matchmaker registration desktop/mobile: pass.
  - Matchmaker runtime desktop/mobile: pass.
  - Runtime matchmaker actions: draw partners, start mingle, end mingle, Cupid Shuffle all wired.
  - League setup desktop/mobile: pass.
  - Output: `reports/rookies-superdemo-flow-qa/2026-06-01T03-24-18-931Z`.
- Reran create-event/scorer-setup background QA:
  - Create-event payloads for blind draw and matchmaker: pass.
  - Scorer setup cork/in/out/bracket controls: pass.
  - Expected logged-out admin portal limitation remains for headless QA.
- Fixed the scorer replay harness so cork option flow explicitly chooses `throw first` when testing away-starter legs.
- Reran full no-write playoff scorer replay:
  - Captured scorer saves: 24/24.
  - Stat comparison: pass for all six players.
  - Outputs: `temp/qa/playoff-match-night-report.md` and `temp/qa/playoff-scorer-replay-comparison.json`.
- Added walkthrough checklist: `docs/work-tracking/ROOKIES-SUPER-DEMO-WALKTHROUGH-2026-06-01.md`.

Remaining manual/live checks:

- Logged-in Brian admin portal validation.
- iPhone and Android scorer modal feel.
- Generic tournament registration no-write submit coverage.
- Generic tournament runtime no-write action coverage.
- Full Rookies crawler audit timed out during this pass; rerun after the next page block settles.
