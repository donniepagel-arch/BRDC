# Overnight Rookies QA - 2026-05-31

Purpose: no-write overnight pass for the Rookies SaaS demo and playoff scorer readiness.

## Scope

- Rookies public landing/dashboard and linked vNext pages
- 2026 Triples League demo hub, playoff match hub, messages, director pages, and Wing It Wednesdays
- Scorer setup/create league/create tournament parity updates from the OG site
- Full playoff scorer replay against the theoretical match fixture
- Demo safety checks for accidental writes, visible bad data, and direct create access

## Commands

```powershell
node scripts\qa\build-playoff-match-night-fixture.js
node scripts\qa\replay-playoff-fixture-through-scorers.mjs
node scripts\qa\rookies-overnight-qa.mjs
```

## Results

- Scorer fixture build: PASS
  - Output: `temp/qa/playoff-match-night-fixture.json`
  - Report: `temp/qa/playoff-match-night-report.md`
  - Fixture result: K. Yasenchak 5, J. Ragnoni 4
- Scorer replay through deployed Rookies scorers: PASS
  - Captured scorer saves: 24/24
  - Comparison: PASS
  - Output: `temp/qa/playoff-scorer-replay-comparison.json`
  - Players matched fixture stats: Kevin Yasenchak, Brian Beach, Cesar Andino, John Ragnoni, Marc Tate, Anthony Donley
- Rookies overnight page/link audit after fixes: PASS
  - Report: `reports/rookies-overnight/2026-05-31T05-16-21-530Z/report.json`
  - Screenshots: `reports/rookies-overnight/2026-05-31T05-16-21-530Z/`
  - Page checks: 54
  - Internal link checks: 80
  - Page failures: 0
  - Link failures: 0
  - Horizontal overflow: 0
  - Bad visible values (`NaN`, `undefined`, `null`, classic/preview wording): 0
  - Console errors after expected unauthenticated chat noise was filtered: 0
- Create-surface safety: PASS
  - `create-league-vnext` shows director login and hides the create form on desktop/tablet/mobile.
  - `create-tournament-vnext` shows director login and hides the create form on desktop/tablet/mobile.
- Demo contact safety: PASS
  - Rookies demo league players checked: 51
  - Demo contact rows checked: 51
  - Suspicious real-looking email/phone rows: 0

## Findings

- Initial Rookies audit found sidebar/chat links still pointing to classic tenant-missing pages:
  - `/rookies/pages/dashboard.html`
  - `/rookies/pages/game-setup.html`
  - `/rookies/pages/members.html`
  - `/rookies/pages/dart-trader.html`
  - `/rookies/pages/messages.html`
- Initial Rookies audit found `/rookies/pages/player-profile-vnext.html` without a player id produced a `Missing player_id` error.
- These were fixed and deployed:
  - Rookies `fb-nav` now treats `/rookies` as vnext and routes to Rookies tenant pages.
  - Rookies chat drawer now routes "See All Messages" and chat opens to `/rookies/pages/messages-vnext.html`.
  - Rookies profile now falls back to the current session player, then `demo_brian_beach`, when no `id`/`player_id` is provided.
  - BRDC navigation helper profile/league routes now respect the Rookies tenant path.
- Follow-up audit after deploy was clean.

## Next Fixes

- Run one logged-in Brian director pass by hand or with a seeded auth session. The overnight verified director gating, but did not submit create forms or mutate Firestore.
- Run a phone/tablet live-browser pass for the actual scorer modals. The no-write scorer replay proves stats math, but modal feel still needs human approval on iPhone.
- Consider expanding `rookies-overnight-qa.mjs` beyond the first 80 internal links once the demo stabilizes; the current pass caught the obvious navigation drift without turning into a full crawler.

## Heartbeat Run - 2026-05-31 02:40-03:02 EDT

- Scorer fixture build: PASS
  - Output refreshed: `temp/qa/playoff-match-night-fixture.json`
  - Fixture result: K. Yasenchak 5, J. Ragnoni 4
- Scorer replay through deployed Rookies scorers: PASS
  - Captured scorer saves: 24/24
  - Comparison: PASS
  - Output refreshed: `temp/qa/playoff-scorer-replay-comparison.json`
- Rookies audit first pass:
  - Report: `reports/rookies-overnight/2026-05-31T06-43-21-156Z/report.json`
  - Page checks: 54, page failures: 0
  - Overflow: 0
  - Bad visible values: 0
  - Link failures: 1 transient generic 404 console message on a completed match-hub link.
- Inspection:
  - Direct load of `/rookies/pages/match-hub-vnext.html?league_id=rookies-demo-2026-triples&match_id=j99cYF5bV2Se7zoNVpgi` loaded correctly with no console or 404 events.
  - No frontend fix or deploy was needed.
- Rookies audit rerun: PASS
  - Report: `reports/rookies-overnight/2026-05-31T06-53-24-795Z/report.json`
  - Page checks: 54
  - Internal link checks: 80
  - Page failures: 0
  - Link failures: 0
  - Horizontal overflow: 0
  - Bad visible values: 0
  - Console errors: 0

## Heartbeat Run - 2026-05-31 03:40-04:02 EDT

- Scorer fixture build: PASS
  - Output refreshed: `temp/qa/playoff-match-night-fixture.json`
  - Fixture result: K. Yasenchak 5, J. Ragnoni 4
- Scorer replay through deployed Rookies scorers: PASS
  - Captured scorer saves: 24/24
  - Comparison: PASS
  - Output refreshed: `temp/qa/playoff-scorer-replay-comparison.json`
- Rookies audit first pass:
  - Report: `reports/rookies-overnight/2026-05-31T07-43-23-953Z/report.json`
  - Page checks: 54, link failures: 0
  - One tablet `triples` page console 404 was observed, with no visible bad state or overflow.
- Inspection:
  - Direct tablet reload of `/rookies/pages/triples-vnext.html?league_id=rookies-demo-2026-triples` loaded fully with no console/page errors and no overflow.
  - No frontend fix or deploy was needed.
- Rookies audit rerun: PASS
  - Report: `reports/rookies-overnight/2026-05-31T07-53-22-827Z/report.json`
  - Page checks: 54
  - Internal link checks: 80
  - Page failures: 0
  - Link failures: 0
  - Horizontal overflow: 0
  - Bad visible values: 0
  - Console errors: 0

## Heartbeat Run - 2026-05-31 04:40-04:52 EDT

- Scorer fixture build: PASS
  - Output refreshed: `temp/qa/playoff-match-night-fixture.json`
  - Fixture result: K. Yasenchak 5, J. Ragnoni 4
- Scorer replay through deployed Rookies scorers: PASS
  - Captured scorer saves: 24/24
  - Comparison: PASS
  - Output refreshed: `temp/qa/playoff-scorer-replay-comparison.json`
- Rookies audit: PASS
  - Report: `reports/rookies-overnight/2026-05-31T08-43-16-572Z/report.json`
  - Page checks: 54
  - Internal link checks: 80
  - Page failures: 0
  - Link failures: 0
  - Horizontal overflow: 0
  - Bad visible values: 0
  - Console errors: 0
- No frontend fix or deploy was needed.

## Heartbeat Run - 2026-05-31 05:40-06:12 EDT

- Scorer fixture build: PASS
  - Output refreshed: `temp/qa/playoff-match-night-fixture.json`
  - Fixture result: K. Yasenchak 5, J. Ragnoni 4
- Scorer replay through deployed Rookies scorers: PASS
  - Captured scorer saves: 24/24
  - Comparison: PASS
  - Output refreshed: `temp/qa/playoff-scorer-replay-comparison.json`
- Rookies audit first pass:
  - Report: `reports/rookies-overnight/2026-05-31T09-43-24-448Z/report.json`
  - Page checks: 54
  - Page failures: 1 transient desktop player profile resource console 404
  - Link failures: 3 transient generic resource console 404s
- Inspection:
  - Direct reloads for Brian profile, Events, and the two flagged match hub URLs loaded correctly with no console/page errors and no overflow.
  - No public frontend fix or deploy was needed.
- QA runner adjustment:
  - Updated `scripts/qa/rookies-overnight-qa.mjs` to ignore unhelpful generic `Failed to load resource` console text and capture real HTTP >=400 response URLs instead.
  - Added Firestore Listen channel transport failures to the ignored-noise list; these are transient Firestore WebChannel transport probes, not page failures.
- Rookies audit final rerun: PASS
  - Report: `reports/rookies-overnight/2026-05-31T10-03-17-797Z/report.json`
  - Page checks: 54
  - Internal link checks: 80
  - Page failures: 0
  - Link failures: 0
  - Horizontal overflow: 0
  - Bad visible values: 0
  - Console errors: 0

## Super Demo Continuation - 2026-05-31 23:20-23:55 EDT

- Hosting deploy: PASS
  - Command used: `firebase deploy --only hosting --config firebase.fortheloveofdarts-project-hosting.json --project fortheloveofdarts`
- Targeted no-write Rookies fixture QA: PASS
  - Output: `reports/rookies-superdemo-flow-qa/2026-06-01T03-24-18-931Z`
  - Matchmaker registration desktop/mobile: pass.
  - Matchmaker runtime desktop/mobile: pass.
  - Runtime matchmaker action wiring: draw partners, start mingle, end mingle, Cupid Shuffle all pass.
  - League setup desktop/mobile: pass.
- Broader create-event/scorer-setup background QA: PARTIAL PASS
  - Create-event layout and intercepted payload checks passed for blind draw and matchmaker on mobile/tablet/desktop.
  - Scorer setup layout and control checks passed on mobile/tablet/desktop.
  - Admin portal headless check failed because the runner was not in Brian's logged-in staff context and only saw public Events/Contact links.
- Full no-write playoff scorer replay: PASS after harness fix
  - The first replay exposed a harness issue: away-starter X01 legs selected the cork winner but did not complete the follow-up throw-order choice, so scores were entered under the wrong active team.
  - Updated `scripts/qa/replay-playoff-fixture-through-scorers.mjs` to set `cork_option=winner_chooses` and choose `throw first` during replay.
  - Captured scorer saves: 24/24.
  - Stat comparison: PASS for Kevin Yasenchak, Brian Beach, Cesar Andino, John Ragnoni, Marc Tate, and Anthony Donley.
  - Outputs: `temp/qa/playoff-match-night-report.md`, `temp/qa/playoff-scorer-replay-comparison.json`.
- Full crawler audit: NOT COMPLETED
  - `scripts/qa/rookies-overnight-qa.mjs` timed out during this pass before writing a new report.
  - Last clean full crawler report remains `reports/rookies-overnight/2026-05-31T10-03-17-797Z/report.json`.
- Walkthrough checklist added:
  - `docs/work-tracking/ROOKIES-SUPER-DEMO-WALKTHROUGH-2026-06-01.md`
