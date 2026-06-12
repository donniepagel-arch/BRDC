# Codex vNext Test Results - 2026-06-06

Target tested: `https://burningriverdarts.com` (`brdc-live-0428`, project `dashboard-ll`)

Scope: complete 30-page vNext signed-out sweep, mobile screenshots for every page, desktop spot checks, Android authed spot checks, source/design scans, module syntax checks, and write-path safety review. No deploy was run. No create/send/scoring write was fired.

Artifacts:
- Raw signed-out sweep: `reports/overnight-qa.json`
- Screenshot + audit JSON: `reports/codex-vnext/2026-06-06/signedout-results.json`
- Screenshots: `reports/codex-vnext/2026-06-06/*.png`

## Executive Summary

Overall confidence: high for read/render/navigation and medium-high for live use. The vNext shell is broadly stable: all 30 pages load real content, mobile horizontal overflow is zero, vNext JS module syntax passes, no local `/pages/` links rendered to missing files, and the warm theme scan found no retired olive parchment colors in vNext sources.

The main remaining issues are not P0/P1 blockers. They are signed-out empty-state polish and write-path QA limitations: Clubhouse and Captain Dashboard still show skeleton-style placeholders when signed out; some no-param pages show friendly states but still log caught console errors; live create/send/write flows were not fired in production.

## Summary Table

| Page | Functional | Visual | Notes |
|---|---:|---:|---|
| admin-vnext | PASS | PASS | Loads real Site Admin content; no overflow/errors. |
| arena-vnext | PASS | PASS | Intentional dark mode; Android signed-in content populated; no overflow/errors. |
| captain-dashboard-vnext | WARN | WARN | Signed-out state leaves 6 skeleton placeholders and shows inactive management UI. |
| contact-center-vnext | PASS | PASS | Signed-out/director gate clean; Android authed form and recipients render. Send not fired. |
| create-league-vnext | PASS | PASS | Signed-out/director gate clean; Android authed form renders; submit uses `saveLeague`. Submit not fired. |
| create-tournament-vnext | PASS | PASS | Signed-out/director gate clean; Android authed builder renders; submit uses create functions. Submit not fired. |
| dart-trader-create-vnext | PASS | PASS | Signed-out auth noise only; create not fired. |
| dart-trader-listing-vnext | PASS | PASS | No-param listing-unavailable state is clean. |
| dart-trader-vnext | PASS | PASS | Android authed read path renders empty marketplace cleanly. |
| director-home-vnext | PASS | PASS | Signed-out gate clean; Android director mode renders. Authed still reports 2 skeleton-class placeholders. |
| events-vnext | PASS | PASS | Public event list loads; no overflow/errors. Very long mobile page, but functional. |
| home-vnext | PASS | PASS | Android authed: "Hey Donnie", stats, playoffs card, no console errors. One skeleton-class element remains after load. |
| league-cricket-vnext | PASS | PASS | Casual cricket setup is readable dark mode; no overflow/errors. |
| league-director-vnext | PASS | PASS | Loads real 2026 Triples League content; no overflow/errors. |
| league-import-vnext | PASS | PASS | Director-gated import page loads cleanly; no import fired. |
| league-team-vnext | PASS | PASS | Friendly no-team state renders; still logs caught console error. |
| leagues-vnext | PASS | PASS | My Leagues public/signed-out state loads cleanly. |
| match-hub-vnext | PASS | WARN | Real match authed Android renders full match report. No-param state is friendly, but empty tab shell remains and logs caught console error. |
| matchmaker-mingle-vnext | PASS | PASS | Friendly no-tournament state renders; still logs caught console error. |
| matchmaker-tv-vnext | PASS | PASS | Friendly no-tournament state renders; still logs caught console error. |
| members-vnext | PASS | PASS | Public member list loads; no overflow/errors. |
| messages-vnext | WARN | WARN | Android authed Clubhouse content works and Fresh Listings empty state is fixed. Signed-out state still shows 8 skeleton placeholders and native-looking tiny buttons. |
| player-profile-vnext | PASS | PASS | Android bare URL resolves to Donnie Pagel profile; signed-out auth noise only. |
| scorer-setup-vnext | PASS | PASS | Dark setup page is readable; no overflow/errors. |
| tournament-register-vnext | PASS | PASS | Friendly no-tournament state renders; still logs caught console error. Registration not submitted. |
| tournament-runtime-vnext | PASS | PASS | Runtime page loads cleanly signed out; runtime actions not fired. |
| tournament-view-vnext | PASS | PASS | Friendly no-tournament state renders; still logs caught console error. |
| triples-vnext | PASS | PASS | Android authed: real standings/bracket/snapshot render; no overflow/errors. |
| wing-it-wednesdays-vnext | PASS | PASS | Public page loads; no overflow/errors. |
| x01-scorer-vnext | PASS | PASS | Dark scorer/setup is readable; no overflow/errors. Casual scoring was not completed/saved in this pass. |

## Findings

### [P2] messages-vnext :: visual/functional :: signed-out Clubhouse keeps skeleton loaders

Evidence: `reports/codex-vnext/2026-06-06/messages-vnext-mobile.png`; audit shows `skeletons: 8` after a 12s wait. The page says "Log in to use the Clubhouse" but the lobby/chat/listings/activity panels still render placeholder skeleton bars. The small `Open chat`, `All listings`, and `All members` controls also appear as browser-default buttons and break the vNext button/card system.

Suggested fix: when signed out, render a deliberate login/preview empty state for each Clubhouse panel, or hide gated panels until authenticated. Restyle the small action buttons with the shared vNext button classes.

### [P2] captain-dashboard-vnext :: visual/functional :: signed-out captain view looks partially loaded

Evidence: `reports/codex-vnext/2026-06-06/captain-dashboard-vnext-mobile.png`; audit shows `skeletons: 6` after load. The page says "Log in from the dashboard first" but continues to show roster, fill-in, schedule, request, and team-profile editing surfaces with placeholder rows.

Suggested fix: make the signed-out state a proper gate, matching director/login pages: short message plus link back to Home/Login. Do not expose management/editing blocks until a captain session exists.

### [P3] match-hub-vnext :: visual :: no-param state leaves an empty report shell

Evidence: `reports/codex-vnext/2026-06-06/match-hub-vnext-desktop.png`. With no `match_id`, the page correctly says "No match selected - open a match from the schedule," but below it still renders an empty tab card (`Sets`, `Performance`, `Rosters`, `Context`) with no data.

Suggested fix: for no-param state, hide the report tabs and show only the empty-state card plus a schedule/league link.

### [P3] no-param graceful states :: console hygiene :: friendly UI still logs caught errors

Evidence: `signedout-results.json` console entries for `league-team-vnext`, `match-hub-vnext`, `matchmaker-mingle-vnext`, `matchmaker-tv-vnext`, `tournament-register-vnext`, and `tournament-view-vnext`.

These are not user-facing crashes, and the UI now shows friendly messages as intended. They still log as `console.error`, which pollutes QA output and makes real errors harder to spot.

Suggested fix: use `console.info` or no log for expected no-param empty states; reserve `console.error` for unexpected failures.

### [P3] contact-center-vnext :: write-path safety :: no UI dry-run mode

Evidence: `public/js/contact-center-vnext.js` sends `sendDirectorBroadcast` with `require_live_send: true` and `dry_run: false` after confirmation. Android authed page rendered the real recipient list (`115` all contacts), but send was not fired.

Suggested fix: add an explicit "Preview/dry run" action that calls the same backend with `dry_run: true`, so future QA can validate coverage and channel counts without risking real SMS/email/site messages.

## Write-Path Results

| Flow | Result | Fired? | Notes |
|---|---:|---:|---|
| Create League | VERIFIED TO EDGE | No | Source submits through `callFunction('saveLeague', { league_id, payload })`; Android authed form unlocks and shows enabled `Create draft league`. No submit clicked. |
| Create Tournament/Event | VERIFIED TO EDGE | No | Source routes to `createTournament` or `createMixedDoublesMatchmakerTournament`; Android authed form unlocks and shows enabled `Create event`. No submit clicked. |
| Contact Center | VERIFIED TO EDGE | No | Android authed recipient/message UI renders real audience counts. Send not clicked. UI currently hardcodes live send after confirmation. |
| League Import | VISUAL/GATE ONLY | No | Signed-out/director gate renders. No parse/import fired. |
| Tournament Runtime | VISUAL/GATE ONLY | No | Signed-out runtime page loads. No bracket/check-in/result/reminder actions fired. |
| Dart Trader | STATIC + READ ONLY | No | Listing update rule now gates updates by seller player's `firebase_uid`. Marketplace read path renders on Android. No test listing created/edited. |
| Casual Scorer Save -> Stats | NOT FIRED THIS PASS | No | X01/Cricket scorer pages render and are readable. I did not complete/save a casual game in production. |

No `ZZ TEST` entities were created in this pass, so there is no cleanup list.

## Recently Fixed Items Verification

| Item | Status | Evidence |
|---|---:|---|
| Home optimistic/cache performance | PASS with caveat | Android authed Home rendered real stats/playoff data with no console errors. This pass did not do a timed cold/warm benchmark. |
| Missing `X_id` graceful states | PASS | All six no-param pages render friendly empty states. Console hygiene still P3. |
| Profile bare URL resolves signed-in user | PASS | Android authed `player-profile-vnext.html` resolved to Donnie Pagel. |
| Clubhouse Fresh Listings empty state | PASS authed, WARN signed-out | Android authed Clubhouse shows "No listings right now." Signed-out page still has skeleton placeholders elsewhere. |
| Scorer casual setup title readable | PASS | Signed-out mobile screenshots show pink readable `501 SCORER` and `CRICKET SCORER` titles on dark backgrounds. |
| Warm theme + hatch + card system | PASS overall | Source scan found no retired olive colors in vNext sources; screenshots match warm hatch standard except intentionally dark Arena/scorers. |

## Checks Run

Commands and methods:
- `node scripts/qa/_overnight-qa.mjs`
- Custom Playwright screenshot/audit pass using `domcontentloaded` plus fixed waits, mobile `390x1200`, desktop spot checks.
- Android CDP authed spot checks via `adb forward tcp:9222 localabstract:chrome_devtools_remote`.
- vNext source scan: no `#ece2cd`, `#e1d6bd`, `#d4c8ac`, or `background-attachment: fixed` in vNext sources.
- vNext JS syntax check as ES modules: passed for all `public/js/*-vnext.js`.
- Static write-path inspection of create league, create tournament, contact center, dart trader rules.

## Top 5 Next Fixes

1. Replace signed-out Clubhouse skeletons with intentional empty/login states and restyle the small native buttons.
2. Replace signed-out Captain Dashboard skeleton/editing surfaces with a proper login gate.
3. Add a contact-center dry-run/preview send path so broadcast coverage can be tested safely.
4. Hide the Match Hub report shell when no match is selected, and make all no-param empty states console-clean.
5. Run one controlled casual scorer save-to-stats test only after agreeing on the exact test player/game cleanup plan.

