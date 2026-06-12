# BRDC vNext Port Plan

Date: 2026-06-02
Author: Claude Code (Opus orchestrating; Sonnet inventory pass)
Source handoff: `docs/work-tracking/HANDOFF-CLAUDE-CODE-VNEXT-PORT-2026-06-02.md`

Goal: bring BRDC vNext production pages (`public/`) up to the polish AND feature
completeness of the Rookies super demo (`sites/fortheloveofdarts-public/rookies/`),
keeping real BRDC auth / writes / data, QA each flow no-write first, then consider
replacing BRDC main.

## Verified Environment Facts

- Real repo root: `E:\projects\brdc-firebase` (CLAUDE.md's `C:\Users\gcfrp\projects\brdc-firebase` does NOT exist).
- Branch `main`, ~217 changed/untracked files (dirty worktree — do not revert/clean broadly).
- `.firebaserc` default is now `dashboard-ll`; `brdc-v2` is marked `suspended`.
  **Deploy target for BRDC vNext must be confirmed before any deploy** (handoff says live site is `brdc-v2.web.app`).

## Key Finding: Part Polish, Part Feature-Completion

BRDC `public/` is NOT just a cosmetic gap behind Rookies. Several core pages are
stubs whose real logic lives only in the Rookies copy:

| Asset | BRDC | Rookies | Gap |
|-------|------|---------|-----|
| `css/market-events-scorer-vnext.css` | 948 | 5015 | 5× stub |
| `js/scorer-setup-vnext.js` | 132 | 973 | stub (no player-search/bot/knockout) |
| `js/create-tournament-vnext.js` | 143 | 547 | stub form |
| `css/scorer-vnext.css` | 240 | 755 | 3× |
| `css/triples-vnext.css` / `js/triples-vnext.js` | 1035 / 860 | 1835 / 1624 | large |
| `js/home-vnext.js` | 1282 | 2171 | large |
| `js/tournament-runtime-vnext.js` | 614 | 1022 | large |
| `js/tournament-register-vnext.js` | 234 | 522 | large |
| `js/match-hub-vnext.js` / `css` | 684 / 577 | 895 / 691 | moderate |
| `js/messages-vnext.js` / `css` | 535 / 764 | 871 / 1029 | moderate |

Identical (no port needed): admin, captain-dashboard (js+css), dart-trader x3,
league-team (js+css), members, player-profile-vnext.css.

## De-Risking Fact: Zero Demo-Bleed in BRDC Production

`public/pages|js|css` contains NONE of the demo scaffolding. The only `demo_mode`
references in `public/` are defensive guards in `public/components/brdc-navigation.js`
(lines 711, 806, 823) that *suppress* real notifications when a demo session is
detected — correct, keep them.

All demo scaffolding is isolated to `sites/`. When porting any Rookies file, STRIP:
`rookies-demo-2026`, `rookies-wing-it`, `demo_brian_beach`, `brian@rookies.example`,
`demo_mode: true`, `source_type: 'rookies_demo'`, and the `firebase-config.js`
no-write interceptor. Replace hardcoded Rookies league IDs with BRDC's
`aOq4Y0ETxPZ66tM1uUtP` or a `?league_id=` param fallback.

## Per-Page Readiness

WRITE-RISK pages (touch Firestore writes / SMS / email — QA must intercept writes
or be an explicitly approved controlled live test):
- captain-dashboard (`sendFillinRequests`)
- create-tournament (`createTournament`)
- dart-trader-create (`addDoc`/`updateDoc`)
- league-cricket scorer (`submitGameResult`/`finalizeMatch`/`submitMatchResult`)
- x01 scorer (`submitGameResult`/`finalizeMatch`/`savePickupGame`)
- messages (`sendDirectMessage`)
- player-profile (`updateGlobalPlayer`)
- tournament-register (`registerForTournament`, `sms_opt_in`)
- tournament-runtime (`sendTournamentRuntimeReminder`/`generateBracket`/lifecycle)
- triples (`registerFillin`)

NEEDS-DATA-AUTH-ADAPTATION (mostly hardcoded Rookies league ID → BRDC):
events, home, league-director, league-team, match-hub, members, scorer-setup,
tournament-view.

QA-ONLY (already close, read-only): admin, dart-trader-vnext, dart-trader-listing.

MISSING from BRDC (create from Rookies, stripping demo bits):
contact-center, create-league, director-home, league-import, matchmaker-mingle,
matchmaker-tv, wing-it-wednesdays.

## Recommended Port Order (small batches, QA after each)

1. **Shared design foundation first** — port the diverged shared CSS
   (`market-events-scorer-vnext.css`, `scorer-vnext.css`, `triples-vnext.css`,
   `home-vnext.css`, `match-hub-vnext.css`, `messages-vnext.css`) so every page
   inherits the polish before page-specific edits. CSS is low-write-risk.
2. ~~Public/player **home + navigation**~~ — **DEFERRED TO LAST** (2026-06-02, user
   not sold on the Rookies landing direction; revisit the landing/home design at the
   end). Shared navigation polish will be picked up alongside whichever page needs it.
3. **League page** (`triples-vnext`) — large js gap, read-mostly.
4. **Match hub** (`match-hub-vnext`).
5. **Scorer setup** (`scorer-setup-vnext`) — feature-build, not just polish.
6. **X01 scorer**, then **Cricket scorer** — WRITE-RISK, no-write QA mandatory.
7. **Admin/director portal** + create the **contact-center** page — WRITE/notify risk.
8. **Create league** (new) + **create tournament** (stub → full).
9. **Tournament** view / register / runtime, then matchmaker mingle/tv + wing-it.
10. No-write QA throughout; controlled live QA only after no-write passes.
11. Only then consider replacing BRDC main.

## Acceptance Checklist

Carried from handoff — port is not ready until these pass with BRDC data: signed-out
home loads; real player login; dashboard loads real identity; nav correct per role;
league loads real data; standings split regular/playoff; stats from
`leagues/{leagueId}/stats/{playerId}`; match hub correct game order; X01 + Cricket
scorers save correctly; scorer-setup exposes all rule controls; create-league
preserves mixed/cork-choice legs; create-event supports all formats; registration
requires phone/email where needed; runtime writes intercepted or controlled; contact
center does not send during QA; no mobile horizontal overflow; Android + iPhone
scorer usable.
