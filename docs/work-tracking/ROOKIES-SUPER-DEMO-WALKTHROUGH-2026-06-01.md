# Rookies Super Demo Walkthrough - 2026-06-01

## Goal

Use this list to walk the Rookies SaaS demo end to end before porting the locked patterns back into BRDC vNext.

## Verified This Run

- [x] Deployed current Rookies frontend to `fortheloveofdarts`.
- [x] Matchmaker registration no-write QA passed on desktop and mobile.
- [x] Matchmaker runtime no-write QA passed on desktop and mobile.
- [x] Matchmaker runtime actions are wired: draw partners, start mingle, end mingle, Cupid Shuffle.
- [x] League setup no-write QA passed on desktop and mobile.
- [x] League setup exposes 701, best-of-9, master in/out, and roster size up to 8.
- [x] Create-event background QA passed mobile, tablet, and desktop layout checks.
- [x] Create-event intercepted payloads passed for blind draw and mixed doubles matchmaker.
- [x] Scorer setup background QA passed mobile, tablet, and desktop layout checks.
- [x] Scorer setup exposes cork rules, winner-choice behavior, free/double/master in/out, set mode gating, and knockout/bracket mode.
- [x] Full no-write playoff scorer replay passed: 24/24 saves captured and all player stats matched the theoretical fixture.
- [x] Create Event mobile pass: long preset/name controls now stack label-over-control on phone width and remain no-overflow.
- [x] Tournament Registration live visual pass: real Wing It Wednesdays registration loads player identity, email, phone, event option, payment, and alert preference without horizontal overflow.
- [x] Tournament Runtime live visual pass: real Wing It Wednesdays runtime loads director controls, board/check-in/bracket areas, and runtime links without horizontal overflow in the logged-in browser session.
- [x] Tournament Bracket live visual pass: bracket page now uses the Rookies/vNext shell instead of the unstyled fallback page.
- [x] Admin Portal live Brian pass: mobile hero no longer squeezes copy, league card has Manage/View, and Wing It Wednesdays appears as one series card with Manage Series/View.
- [x] Tournament View live pass: raw config labels are humanized (`Single elimination` instead of `single_elimination`) and the page has no horizontal overflow.
- [x] Double-elimination bracket no-write QA now covers winners bracket, losers bracket, and grand final rendering on desktop and mobile.
- [x] Contact Center live Brian pass: staff mode loads contacts, template preview mirrors the outgoing message, and no message was sent.
- [x] League Page regular-season standings live pass: standings render after data load, subtabs work, and no horizontal overflow.
- [x] League Page pass: playoff bracket is finals-first, stats are populated with player/team/category/game controls, league chat points to the league room, Manage workflow links are present, and Fill-ins is back as a first-class tab.
- [x] Match Hub live pass: Semifinals header/context, A/B first match order, roster/performance/rundown tabs, and X01/Cricket scorer launch return paths verified.
- [x] Scorer Setup live pass: knockout helper wrapping fixed, deployed, and setup QA re-run across mobile/tablet/desktop.
- [x] X01 live pass: starter modal copy now clarifies first thrower for each side, active thrower is visually clear, player scores are bright/readable, and calculator preview handles `19 x 3` as remaining 444 before commit.
- [x] Cricket live pass: starter modal copy now clarifies first thrower for each side, current thrower is visible, and 15s/bulls can be scored on the phone-width layout.
- [x] Create League live pass: loaded director settings, confirmed roster size 1-8, add set, mixed/cork-choice leg editor, in/out rules, cork options, playoffs/third-place, and notification settings.
- [x] Remaining no-write auto QA passed live: X01 outshot/keypad layout, X01 leg-win modal, X01 save/return payload, Cricket closeout-darts modal, Cricket save/return payload with `closeout_darts=2`, and Create League save payload.
- [x] Create League mixed-round save fix deployed: closed mixed/cork-choice leg editors now preserve their stored leg list in the payload.
- [x] Mixed set labels standardized: `501/C/CH` is the preset, `Custom set` is available in league/event/scorer setup, and CH choice only offers games already played earlier in the set while preserving X01 in/out rules.
- [x] Matchmaker vNext player-facing pages added: Mingle and TV Display now live under `/rookies/pages/matchmaker-mingle-vnext.html` and `/rookies/pages/matchmaker-tv-vnext.html`.
- [x] Matchmaker links are wired from Tournament View, Runtime, and Bracket when `matchmaker_enabled` is true.
- [x] Generic tournament registration no-write QA passed: required name/email/phone/event enables submit and calls `registerForTournament`.
- [x] Generic tournament runtime no-write QA passed: generate blind draw, generate bracket, check-in, assign board, and submit result all call the expected Cloud Functions through interception.
- [x] Matchmaker Mingle no-write QA passed: default Board tab, Singles tab, and Breakups tab render the expected data without exposing inactive panes.
- [x] Matchmaker TV no-write QA passed: partner reveal mode, match call mode switching, desktop layout, and mobile layout passed.
- [x] Rookies crawler audit passed after deploy: 60 page checks across desktop/tablet/mobile, 20 discovered-link checks, no page failures, no overflow, no bad text, and no unignored console errors.
- [x] Rookies Android real-device demo QA passed on SM_A125U: dashboard, admin portal/login gate, contact center, league page, match hub, scorer setup, create league, create event presets, tournament view/runtime/bracket, Wing It registration voting, X01 calculator, X01 cork modal, Cricket cork modal, and Cricket 15/bull controls all loaded with no Android horizontal overflow.
- [x] Latest full no-write QA rerun passed after Android availability: super demo fixture, background create/scorer/admin audit, and remaining scorer/create-league QA all passed with no findings.

Latest QA outputs:

- `reports/rookies-superdemo-flow-qa/2026-06-01T03-24-18-931Z`
- `reports/rookies-superdemo-flow-qa/2026-06-01T04-51-35-876Z`
- `reports/rookies-superdemo-flow-qa/2026-06-01T12-06-57-323Z`
- `reports/rookies-superdemo-bg-qa/2026-06-01T04-52-00-484Z`
- `reports/rookies-superdemo-bg-qa/2026-06-01T12-46-29-239Z`
- `reports/rookies-superdemo-bg-qa/2026-06-01T14-36-44-578Z`
- `reports/rookies-superdemo-flow-qa/2026-06-01T15-43-50-093Z`
- `reports/rookies-superdemo-bg-qa/2026-06-01T15-43-50-091Z`
- `reports/rookies-remaining-auto-qa/2026-06-01T13-16-34-900Z`
- `reports/rookies-remaining-auto-qa/2026-06-01T13-18-43-452Z`
- `reports/rookies-remaining-auto-qa/2026-06-01T13-33-33-334Z`
- `reports/rookies-remaining-auto-qa/2026-06-01T14-58-03-902Z`
- `reports/rookies-remaining-auto-qa/2026-06-01T15-43-50-121Z`
- `reports/rookies-superdemo-flow-qa/2026-06-01T15-00-44-892Z`
- `reports/rookies-overnight/2026-06-01T15-08-06-963Z/report.json`
- `reports/rookies-android-demo-qa/2026-06-01T16-11-49-471Z/report.json`
- `temp/qa/playoff-match-night-report.md`
- `temp/qa/playoff-scorer-replay-comparison.json`

Latest deploy:

- `firebase deploy --only hosting --config firebase.fortheloveofdarts-project-hosting.json --project fortheloveofdarts`
- Completed June 1, 2026 after matchmaker vNext pages, tournament/runtime link wiring, no-write QA expansion, and Mingle tab visibility fix.

Device caveat:

- Android automation now runs through the local SDK path at `C:\Users\gcfrp\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- Director-only Android pages currently validate the login-gated public state when the Android Chrome session is not logged in as Brian. The logged-in Brian/staff view remains best checked in the in-app browser or a signed-in phone session.

## Walkthrough Order

### 1. Dashboard / Player Hub

- [ ] Open `https://fortheloveofdarts.com/rookies/dashboard/` as Brian Beach.
- [ ] Confirm Brian sees the player view, Staff Mode, and Admin Portal access.
- [ ] Confirm playoff cards show finals/third-place first, current matches emphasized, and regular season separate from playoffs.
- [ ] Confirm Clubhouse starts on Play and uses Talk / Play / Catch up.
- [ ] Confirm event and league cards use the same visual hierarchy we set on page 1.

### 2. Admin Portal

- [x] Open `/rookies/pages/director-home-vnext.html`.
- [x] Confirm the top nav says Admin Portal.
- [x] Confirm league cards have Manage and View only.
- [x] Confirm Wing It Wednesdays appears as one series card, not many weekly event cards.
- [x] Confirm event series cards have Manage Series and View.
- [x] Confirm Contact opens `/rookies/pages/contact-center-vnext.html`.

Note: headless QA cannot validate this signed-in view without Brian's auth/session context, so this needs a real logged-in pass.

### 3. Contact Center

- [x] Open `/rookies/pages/contact-center-vnext.html`.
- [x] Confirm the step order is Message, Audience, Delivery, Review.
- [x] Confirm text/email/site-message options are clear.
- [x] Confirm preview reads like the actual outgoing message, not a new section.
- [x] Do not send a real text/email during demo QA unless test interception is active.

### 4. League Page

- [x] Open `/rookies/pages/triples-vnext.html?league_id=rookies-demo-2026-triples`.
- [x] Confirm tabs match the dashboard hierarchy.
- [x] Confirm Standings has Playoffs and Regular Season subtabs.
- [x] Confirm playoff bracket/card order and content match dashboard.
- [x] Confirm stats tabs use the underline treatment and include the richer OG-style stat coverage.
- [x] Confirm Chat opens league chat, not team chat.
- [x] Confirm Manage tab is only visible to director/staff and has the workflow actions needed for league operations.
- [x] Confirm Fill-ins tab is polished and sign-up is prominent.

### 5. Match Hub

- [x] Open `/rookies/pages/match-hub-vnext.html?league_id=rookies-demo-2026-triples&match_id=playoff_2026_sf_2v3`.
- [x] Confirm header says Semifinals and shows previous matchup record/context.
- [x] Confirm match order starts with A/B where appropriate, not C players.
- [x] Confirm performance shows league performance totals.
- [x] Confirm rosters include individual 3DA/MPR.
- [x] Confirm match rundown replaces vague match context.
- [x] Launch X01 and Cricket scorers from the hub and return without losing match context.

### 6. Scorer Setup

- [x] Open `/rookies/pages/scorer-setup-vnext.html`.
- [x] Confirm team names and roster entry are clear.
- [x] Confirm legs and sets use steppers.
- [x] Confirm set mode only appears when sets are enabled.
- [x] Confirm cork rules are complete and understandable.
- [x] Confirm free/double/master in/out rules are present.
- [x] Confirm knockout/bracket generation options are present.
- [x] Confirm the setup page is the source for casual scorer launches; league and online-match launches can pass through this setup or use match-hub/runtime links when context already exists.

### 7. X01 Scorer

- [x] Open a match-hub-launched X01 scorer.
- [x] Confirm active thrower is obvious from a distance.
- [x] Confirm player scores are white/bright gold and readable.
- [x] Confirm calculator mode works: example `19 x 3` subtracts 57 and shows remaining until the next input or back.
- [x] Confirm outshot suggestion does not deform the keypad.
- [x] Confirm starter modal is readable on iPhone-sized screens and clarifies first thrower for each side.
- [x] Confirm leg-win modal is readable on iPhone-sized screens.
- [x] Confirm save/return path sends the correct league/match result payload without duplicate/redundant confirmations.

Automated no-write replay passed for a full 9-set theoretical playoff night.

### 8. Cricket Scorer

- [x] Open a match-hub-launched Cricket scorer.
- [x] Confirm 15s and bulls can be scored.
- [x] Confirm current thrower is clear.
- [x] Confirm side scores are not squished on iPhone-sized screens.
- [x] Confirm win darts modal is readable and records closeout darts correctly.
- [x] Confirm save/return path sends the correct league/match result payload.

### 9. Create League

- [x] Open `/rookies/pages/create-league-vnext.html?league_id=rookies-demo-2026-triples`.
- [x] Confirm roster format allows up to 8.
- [x] Confirm add/remove set works.
- [x] Confirm mixed format legs/sets are clear.
- [x] Confirm `501/C/CH` preset label, `Custom set`, and editable 501 in/out rules are present.
- [x] Confirm columns/rounds have titles.
- [x] Confirm 301/501/701, Cricket, and mixed setup options are available.
- [x] Confirm free/double/master in/out rules are available.
- [x] Confirm cork rules match scorer setup.
- [x] Confirm save/update payload is correct before using it on a real league.

### 10. Create Event

- [x] Open `/rookies/pages/create-tournament-vnext.html?preset=blind_draw`.
- [x] Confirm blind draw template is compact and not overwhelming.
- [x] Confirm boards available/unavailable boards are present.
- [x] Confirm blind draw doubles, draw pool, house player, and bracket generation options are present.
- [x] Confirm runtime features are present: rooms, check-in, self-report, notifications, video placeholders, score assist placeholders.
- [x] Confirm Wing It registration voting can be enabled with options, question text, and required-vote behavior.
- [x] Open `/rookies/pages/create-tournament-vnext.html?preset=mixed_doubles_matchmaker`.
- [x] Confirm matchmaker template uses the same compact scorer-setup visual language.
- [x] Confirm matchmaker settings are present: single/partner registration, partner matching, breakup/rematch, summaries, nudge limit, winners/losers games, mingle cutoff.
- [x] Confirm event setup uses the same `501/C/CH` and `Custom set` language as league/scorer setup.
- [x] Do not submit a real create form unless using a deliberate test event.

### 11. Tournament View / Registration / Runtime / Bracket

- [x] Open a generic blind draw tournament view.
- [x] Confirm view, register, runtime, bracket links make sense.
- [x] Open registration and confirm email/phone are required.
- [x] Confirm notification preference can be chosen during registration.
- [x] Confirm Wing It registration voting appears during signup, blocks submit when required, and submits the selected vote payload.
- [x] Confirm runtime shows Wing It vote totals and lets the director lock/save the final format.
- [x] Open matchmaker registration and confirm single and partner modes both read clearly.
- [x] Open runtime and confirm board availability, check-in, call/notify, scorer launch, submit result, confirm/dispute, lock/regenerate, and delete controls are understandable.
- [x] Open bracket and confirm the real blind draw single-elimination bracket renders correctly.
- [x] Confirm double-elimination bracket rendering with a real or stubbed double-elimination event.
- [x] Confirm generic registration submit path with no-write interception.
- [x] Confirm generic runtime director actions with no-write interception.
- [x] Confirm matchmaker-specific Mingle and TV pages are linked and render.

### 12. Known Remaining Manual Checks

- [ ] Real-device iPhone scorer modal feel.
- [x] Real-device Android scorer modal/control feel on SM_A125U.
