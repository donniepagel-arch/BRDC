# Handoff: Rookies Super Demo to BRDC vNext Port

Date: 2026-06-02  
Workspace in this Codex session: `E:\projects\brdc-firebase`  
Primary goal: use the polished Rookies SaaS demo as the reference implementation, then update BRDC vNext with that style and verify all core flows before any main-site replacement.

## Current State

The Rookies SaaS demo is live at:

- Public landing: `https://fortheloveofdarts.com/rookies/`
- Player dashboard: `https://fortheloveofdarts.com/rookies/dashboard/`
- Admin portal: `https://fortheloveofdarts.com/rookies/pages/director-home-vnext.html`
- League page: `https://fortheloveofdarts.com/rookies/pages/triples-vnext.html?league_id=rookies-demo-2026-triples`
- Match hub reference: `https://fortheloveofdarts.com/rookies/pages/match-hub-vnext.html?league_id=rookies-demo-2026-triples&match_id=playoff_2026_sf_2v3`
- Scorer setup: `https://fortheloveofdarts.com/rookies/pages/scorer-setup-vnext.html`
- Create league: `https://fortheloveofdarts.com/rookies/pages/create-league-vnext.html`
- Create event: `https://fortheloveofdarts.com/rookies/pages/create-tournament-vnext.html`
- Tournament runtime reference: `https://fortheloveofdarts.com/rookies/pages/tournament-runtime-vnext.html?tournament_id=rookies-wing-it-wednesdays-2026-05-27`

Latest Rookies deploy command used:

```powershell
firebase deploy --only hosting --config firebase.fortheloveofdarts-project-hosting.json --project fortheloveofdarts
```

Latest live Rookies landing versions:

- `/rookies/tenant/rookies-vnext.css?v=23`
- `/js/home-vnext.js?v=67`
- `/rookies/tenant/rookies-vnext.js?v=11`

## Confidence Level

Rookies sales demo / guided walkthrough: about 75-80%.

Porting directly to BRDC vNext without port-specific QA: about 55-65%.

Why confidence drops on BRDC:

- Rookies uses a branded tenant layer and curated demo IDs/data.
- Rookies has a fake Brian/session/no-write safety path that should not be copied into live BRDC production behavior.
- BRDC vNext needs real auth/session behavior, real player contact data, real league/event IDs, and real notification behavior.
- BRDC existing pages/nav/data may still use old CSS/JS conventions.
- The demo proves UI direction and much of the workflow, but does not prove production replacement readiness.

## Important Safety Rules

Do not blindly copy Rookies demo behavior into BRDC production.

Keep these separate:

- Rookies demo tenant behavior: fake Brian login, `demo_mode`, no-write Cloud Function interception, fake contact emails/phones, `rookies-demo-2026-triples`.
- BRDC production behavior: real auth, real player sessions, real writes, real notifications, real league IDs.

Before porting any page:

- Identify which code is shared vNext and which code is Rookies tenant-only.
- Move reusable design/system patterns into shared vNext assets.
- Keep tenant branding/demo auth/no-write code out of BRDC production pages.
- Use document IDs for lookups; never names.
- Use league stats source of truth: `leagues/{leagueId}/stats/{playerId}`.

## Current Rookies Design Direction

The latest Rookies public landing is intentionally dark and event/community focused.

Recent landing changes:

- Removed visible “demo” references.
- Dark signed-out public landing.
- Hero first: `Darts at Rookies`.
- Copy is no longer feature-list copy:
  - `Show up. Get drawn in. Talk a little trash. Play your match.`
- Wing It Wednesdays is a single event CTA banner under the hero.
- The activity section is flatter/editorial:
  - playoff/current item
  - recent result item
  - recognition/shoutout section with A/B/C level inclusion
- Signed-out public view hides old light dashboard/event sections.
- Player/admin utility links are quiet and secondary.

Live editorial landing URL used for final review:

```text
https://fortheloveofdarts.com/rookies/?editorial2=1
```

The user is “okay with it” and may tweak the landing personally later. Do not treat the landing as fully locked design canon, but do preserve the core principles:

- dark public/event/play surfaces
- one clear primary CTA
- community/FOMO/recognition over feature-list copy
- players at all levels should feel seen
- utility links should not compete with event/story content

## Key Files In The Rookies Demo

Rookies tenant shell:

- `sites/fortheloveofdarts-public/rookies/index.html`
- `sites/fortheloveofdarts-public/rookies/pages/home-vnext.html`
- `sites/fortheloveofdarts-public/rookies/tenant/rookies-vnext.css`
- `sites/fortheloveofdarts-public/rookies/tenant/rookies-vnext.js`

Shared Rookies/vNext modules used by many pages:

- `sites/fortheloveofdarts-public/js/home-vnext.js`
- `sites/fortheloveofdarts-public/js/triples-vnext.js`
- `sites/fortheloveofdarts-public/js/match-hub-vnext.js`
- `sites/fortheloveofdarts-public/js/scorer-setup-vnext.js`
- `sites/fortheloveofdarts-public/js/tournament-director-auth-vnext.js`
- `sites/fortheloveofdarts-public/js/create-league-vnext.js`
- `sites/fortheloveofdarts-public/js/create-tournament-vnext.js`
- `sites/fortheloveofdarts-public/js/tournament-register-vnext.js`
- `sites/fortheloveofdarts-public/js/tournament-runtime-vnext.js`
- `sites/fortheloveofdarts-public/js/tournament-view-vnext.js`
- `sites/fortheloveofdarts-public/js/messages-vnext.js`
- `sites/fortheloveofdarts-public/js/contact-center-vnext.js`

Shared vNext styles:

- `sites/fortheloveofdarts-public/css/home-vnext.css`
- `sites/fortheloveofdarts-public/css/market-events-scorer-vnext.css`
- `sites/fortheloveofdarts-public/css/triples-vnext.css`
- `sites/fortheloveofdarts-public/css/match-hub-vnext.css`
- `sites/fortheloveofdarts-public/css/scorer-vnext.css`
- `sites/fortheloveofdarts-public/css/messages-vnext.css`
- `sites/fortheloveofdarts-public/css/player-profile-vnext.css`

BRDC/current public vNext equivalents exist under:

- `public/pages/*-vnext.html`
- `public/js/*-vnext.js`
- `public/css/*-vnext.css`

The port likely needs to update those `public/` vNext files from the Rookies reference, not copy the whole `sites/fortheloveofdarts-public/rookies` tenant.

## Existing Context Docs To Read First

Read these before making code changes:

- `AGENTS.md`
- `docs/work-tracking/ROOKIES-SUPER-DEMO-PORT.md`
- `docs/work-tracking/ROOKIES-SUPER-DEMO-WALKTHROUGH-2026-06-01.md`
- `docs/work-tracking/ROOKIES-SUPER-DEMO-BG-QA-2026-06-01.md`
- `docs/work-tracking/OVERNIGHT-ROOKIES-QA-2026-05-31.md`
- `docs/work-tracking/IDEAS-BACKLOG.md`
- `docs/home-vnext-design-rules.md` if present
- `docs/home-vnext-rules.md` if present
- `docs/vnext-qa-checklist.md` if present

Also check latest user feedback if accessible:

- Firestore collection: `feedback`

## Worktree Warning

The worktree is very dirty. Many changed and untracked files predate the current session and may belong to the user or other agents.

Do not revert broad changes.
Do not run destructive git commands.
Do not “clean up” unrelated files.
Use scoped diffs and explicit files.

Run:

```powershell
git status --short
```

Expect many modified/untracked files.

## What Has Been Tested Recently

See the walkthrough doc for the full checklist. High-level recent passes:

- Rookies crawler audit: 60 page checks across desktop/tablet/mobile, no page failures, no overflow, no bad text, no unignored console errors.
- Android real-device demo QA passed on SM_A125U for dashboard, admin portal/login gate, contact center, league page, match hub, scorer setup, create league, create event presets, tournament view/runtime/bracket, Wing It registration voting, X01 calculator/modals, Cricket controls.
- Full no-write playoff scorer replay passed: 24/24 saves captured, all player stats matched theoretical fixture.
- Create event no-write QA passed for blind draw and mixed doubles matchmaker.
- Generic registration/runtime no-write QA passed.
- Create league no-write QA passed.
- Mixed set labels standardized as `501/C/CH`, with `Custom set`, and `CH` choice constrained to games already played earlier in the set.

Recent caveat:

- Latest landing visual work after June 1 QA has been deployed and DOM-verified, but it has not had a full crawler/device QA rerun after the final editorial landing changes.
- In-app browser screenshot tooling became unstable and timed out; DOM checks and live source checks were used for the final landing pass.

## Recommended BRDC vNext Port Strategy

Do not port everything at once.

Recommended order:

1. Inventory BRDC vNext pages and compare to Rookies vNext pages.
2. Create a BRDC vNext staging route or keep existing vNext routes separate from main.
3. Extract reusable design tokens/rules from Rookies into shared vNext CSS, not tenant-specific Rookies CSS.
4. Port the top-level public/player home first.
5. Port navigation behavior second.
6. Port league page and match hub.
7. Port scorer setup and scorers.
8. Port admin/director portal and contact center.
9. Port create league and create tournament.
10. Port tournament view/register/runtime/bracket/matchmaker pages.
11. Run no-write QA where possible.
12. Run live controlled QA only after no-write passes.
13. Only then consider replacing BRDC main.

## BRDC vNext Acceptance Checklist

The BRDC vNext port is not ready until these pass with BRDC data:

- Public landing/home loads signed out.
- Real player login works.
- Dashboard/player hub loads real player identity.
- Navigation routes make sense signed out, player signed in, director/admin signed in.
- League page loads real BRDC league data.
- Standings separate regular season from playoffs.
- Stats use `leagues/{leagueId}/stats/{playerId}`.
- Match hub loads real match context and correct game order.
- X01 scorer works from match hub and returns/saves correctly.
- Cricket scorer works from match hub and returns/saves correctly.
- Scorer setup exposes:
  - free/double/master in/out
  - cork rules
  - cork winner choice
  - set mode gating
  - steppers
  - custom set
  - `501/C/CH`
- Create league payload preserves mixed/cork-choice leg lists.
- Create event supports:
  - blind draw
  - weekly series
  - matchmaker
  - board availability
  - runtime controls
  - registration voting
  - custom format
- Tournament registration requires phone/email where appropriate.
- Runtime actions are either no-write intercepted in QA or carefully controlled live.
- Contact center does not accidentally send SMS/email during QA.
- Mobile widths have no horizontal overflow.
- Android and iPhone scorer controls are usable.

## Known Rookies Demo Specifics Not To Copy Blindly

Rookies demo uses:

- `rookies-demo-2026-triples`
- `rookies-wing-it-wednesdays-2026-05-27`
- `rookies-wing-it-wednesdays-2026-06-03`
- Brian fake login via `rookies` / `demo123`
- `demo_mode`
- `source_type: rookies_demo`
- fake player IDs like `demo_brian_beach`
- fake email fallback `brian@rookies.example`
- no-write response in `firebase-config.js` for many Cloud Functions

These are useful for demo safety. They are dangerous if copied into BRDC production flows.

## Deployment Notes

> **CORRECTION (2026-06-03):** The real public site is **`https://burningriverdarts.com`**, served by Firebase site **`brdc-live-0428`** in project **`dashboard-ll`** — NOT `brdc-v2.web.app`, and NOT a bare `firebase deploy`. Publish the live apex with:
> ```powershell
> firebase deploy --only hosting --config firebase.current-apex-hosting.json --project dashboard-ll
> ```
> Site map: burningriverdarts.com→brdc-live-0428(dashboard-ll); brdc-v2.web.app→brdc-v2; burningriverdarts.web.app→burningriverdarts(brdc-v2, now DISABLED); fortheloveofdarts.com→fortheloveofdarts. A 200 on a missing /pages/*.html is the SPA catch-all serving index.html — verify real content, not just status. The notes below are the original (partly-wrong) point-in-time guidance, kept for history.

Rookies demo hosting:

```powershell
firebase deploy --only hosting --config firebase.fortheloveofdarts-project-hosting.json --project fortheloveofdarts
```

BRDC v2 hosting likely uses the normal project and/or root Firebase config. Verify before deploying. AGENTS says:

```powershell
firebase deploy --only hosting
```

Live BRDC v2 site:

```text
https://brdc-v2.web.app
```

Do not deploy BRDC main replacement until vNext staging QA passes.

## Claude Code Takeover Prompt

Copy/paste this prompt into Claude Code:

```text
You are taking over a BRDC Firebase project. Work from the current project folder and first verify the correct path. In this Codex session the workspace was E:\projects\brdc-firebase, while AGENTS.md may mention C:\Users\gcfrp\projects\brdc-firebase; verify the actual repo root before changing files. Do not use any old duplicate repo.

Read AGENTS.md and these handoff docs first:
- docs/work-tracking/HANDOFF-CLAUDE-CODE-VNEXT-PORT-2026-06-02.md
- docs/work-tracking/ROOKIES-SUPER-DEMO-PORT.md
- docs/work-tracking/ROOKIES-SUPER-DEMO-WALKTHROUGH-2026-06-01.md
- docs/work-tracking/ROOKIES-SUPER-DEMO-BG-QA-2026-06-01.md
- docs/work-tracking/OVERNIGHT-ROOKIES-QA-2026-05-31.md
- docs/work-tracking/IDEAS-BACKLOG.md

Goal:
Update BRDC vNext using the Rookies SaaS demo style and working patterns, then get all core BRDC vNext flows working and tested before any main-site replacement.

Important:
The Rookies demo is a branded super demo, not production BRDC. Do not blindly copy demo/no-write behavior, fake Brian login, fake contact data, tenant branding, or demo IDs into BRDC production pages. Extract reusable UI/workflow patterns and adapt them to BRDC real data/auth.

Current Rookies reference:
- https://fortheloveofdarts.com/rookies/
- Latest Rookies landing versions: rookies-vnext.css?v=23, home-vnext.js?v=67, rookies-vnext.js?v=11.
- Rookies public landing is dark, event/community focused, and signed-out dashboard light sections are hidden.
- Public/event/play/scorer surfaces should generally be dark and focused.
- Management/data-heavy surfaces can be lighter/neutral if scanning lots of information is the priority.
- The page should create FOMO/community/recognition, not read like a software feature list.
- Players at all levels should be recognized.

Primary tasks:
1. Audit BRDC vNext files under public/pages, public/js, and public/css against the Rookies reference under sites/fortheloveofdarts-public.
2. Build a page-by-page port plan before broad edits.
3. Port shared design patterns from Rookies into BRDC vNext shared CSS/JS.
4. Preserve real BRDC auth/session/write behavior.
5. Port/test in this order:
   - public/player home and navigation
   - league page
   - match hub
   - scorer setup
   - X01 scorer
   - Cricket scorer
   - admin/director portal
   - contact center
   - create league
   - create event
   - tournament view/register/runtime/bracket/matchmaker
6. For each page, use the Rookies demo as the UX reference but replace tenant/demo-specific IDs and copy with BRDC-appropriate values.
7. Run syntax checks and targeted no-write Playwright/browser QA after each major flow.
8. Do not submit real create forms, send SMS/email, or mutate Firestore unless the test explicitly intercepts writes or the user approves a controlled live test.
9. Deploy only when appropriate and with the correct Firebase config/project.

Critical data rules:
- Use document IDs for lookups; never names.
- Stats source of truth is leagues/{leagueId}/stats/{playerId}.
- Use stats helper functions where available.
- For team rosters, query/filter league players by team_id.
- Do not use games[] display names to identify players.

Confidence:
- Rookies guided sales demo is about 75-80% confidence.
- BRDC vNext after a direct port is only about 55-65% until BRDC-specific QA passes.
- Do not treat the Rookies demo as proof that BRDC main can be replaced.

Deliverables:
- A BRDC vNext port plan/checklist.
- Implemented BRDC vNext page updates.
- QA report with pass/fail, screenshots if possible, and remaining risks.
- Clear deploy notes and live URLs.
```

## Immediate Next Step For Claude

Start by producing a BRDC vNext inventory:

- List all `public/pages/*-vnext.html`.
- Map each to its Rookies reference page under `sites/fortheloveofdarts-public/rookies/pages/` or `sites/fortheloveofdarts-public/rookies/index.html`.
- Identify shared JS/CSS each page uses.
- Mark each page:
  - ready to port
  - needs data/auth adaptation
  - needs QA only
  - risky because it can write/send notifications

Then port in small batches and verify after each batch.

