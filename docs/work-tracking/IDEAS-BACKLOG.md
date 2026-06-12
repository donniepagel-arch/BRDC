# Ideas Backlog

**Purpose:** Capture ideas, features, and tasks discussed but not yet implemented. Prevents ideas from being lost during conversation compaction.

---

## How to Use

When something is discussed but not acted on immediately, add it here with:
- Date discussed
- Brief description
- Context (why it came up)
- Priority (High/Medium/Low)

When an item is completed, move it to the "Completed" section at the bottom with the completion date.

---

## Pending Ideas

### [2026-06-12] - Aim Darts on-screen game wired into the play setup (SHIPPED)
The MC3 loop's two-line 501 dart game (vertical line sweeps to lock X → horizontal line sweeps to lock Y → dart lands at the crosshair w/ small wobble) — found in the dormant `looptlab-session-2026-05-01/games/darts.html`, preserved as `public/games/aim-darts-original.html`. Ported to **`public/pages/aim-darts-vnext.html`**: BRDC dark theme, **multiplayer turn rotation** (N players, alternating 3-dart turns), reads clean launch params (`players` JSON, `x01`, `out`, `in`, `mode`, `legs`), real-board scoring (verified 11/11 canonical points), 501 double/master/straight-out + bust logic, win → **saves casual via `savePickupGame`** (same pipeline + collection as the scorers; verified the payload is accepted, test doc cleaned up). Wired into **scorer-setup-vnext** as game type **"🎯 On-screen (Aim Darts)"** — selecting it shows score + in/out-rule config; launch builds the aim URL from the player pool. Deployed apex sw v86.
NEXT IDEAS (logged): per-score config already works (301/501/701 + out rule); could add it to the Arena/online flow for **remote 2-player** aim matches (each device, scores synced via the existing online_matches/pickup infra); stat attribution currently only for registered players (guests save unattributed, same as scorers); 3+ player save currently records head vs first opponent (pickup format is 2-player) — a multi-player casual record format would capture all.
Priority: Medium (shipped; enhancements optional)

### [2026-06-12] - Glossary page: stats & terms reference (also fixes a stale smoke test)
Build `public/pages/glossary.html` — a BRDC-native page (vNext nav + design tokens, NOT a standalone /build-app app) explaining the darts jargon casual players don't know: 3DA, MPR, Match→Sets→Legs (+ the `(15)7-2(8)` display format), X01 / Double-In / Double-Out / Master Out / Straight, checkout ranges (60-99 / 100-139 / 140-160 / 161+ which *requires the bull*), cricket marks + closeouts (5M-9M) + bulls, standings tiebreak hierarchy (match→set→leg→H2H), notables (180/ton/ton-40, cork). Bonus: a "?" next to stat labels (3DA/MPR) on dashboard/profile that deep-links into it.
Context: surfaced during vNext testing — the smoke suite tests `/pages/glossary.html` but the page doesn't exist (removed, unreferenced) → the one smoke "failure." Donnie's call: build it for real rather than delete the test. Building it makes that smoke test legitimately pass.
Priority: Medium

### [2026-06-12] - Test suite bit-rotted — refresh specs + stand up a Tester lane
The deterministic Playwright suite has drifted from the code and currently certifies nothing on the function layer: the **x01 scorer specs load the LEGACY `/pages/x01-scorer.html` and were written before the setup screen existed**, so they fire scoring clicks while `#setupScreen` is still on top → can never get into a game (NOT a scorer bug — the vNext scorer scores fine, verified live 501→441). The `glossary.html` smoke test is also stale (above). Also: the smoke `webServer` config is a no-op `echo` — it needs a real `:5000` static server, or point baseURL at the live apex.
FIX: (1) retarget the scorer specs to the vNext scorer + add the setup→game dismiss step; (2) stand up a **BRDC Tester lane** (Playwright flow suite + the `multi-surface-testing` skill) that runs on every change so specs can't rot again — looptin-os's Codex `test/` lane is the model. Usage-preserving division: **Gemini (Ultra) authors/refreshes the specs, Playwright executes them** (deterministic, zero LLM).
Context: ran the suite during the vNext functional pass; it surfaced its own rot live — exactly the "testers in the pipeline" gap Donnie flagged.
Priority: Medium

### [2026-06-12] - BUG: Google signup orphans the auth user when profile step doesn't complete (catch-22)
Repro: a user signs in with Google → Firebase Auth user is created → but the profile-creation step (`registerPlayerSimpleV2`, which writes the `players` doc + links `firebase_uid`) never completes (user bails / closes / doesn't finish the form). Result: an **orphan auth user with no `players` doc**. The app then wedges them: **signup says "account exists"** (Google credential already registered) and **login says "doesn't exist — create one"** (no profile), and the "create one" button kicks off a *fresh signup* that **collides** with the existing auth user. No way back in from the UI.
Hit live by gcfrphoto@gmail.com 2026-06-12 (auth created 07:29, never profiled). RESOLVED for that account by deleting the orphan (admin SDK, guarded) so they can re-signup clean.
**FIX (do before real members onboard)**: when an *already-authenticated* Firebase user has no `players` doc, route them to a **profile-completion** step that calls `registerPlayerSimpleV2` with the CURRENT session (sets `firebase_uid = auth.currentUser.uid`) — do NOT send them to a fresh signup that re-creates the auth user. Also make profile-creation **atomic/retryable** post-OAuth (auto-create a minimal profile on first authenticated load if none exists, or block with a "finish your profile" gate that can't be skipped). Diagnosis pattern (admin SDK from functions/ dir, projectId brdc-v2): `auth().getUserByEmail` + `players where firebase_uid == uid` — if auth exists but players empty = orphan.
Priority: High (blocks/poisons new-member onboarding; silent until someone gets stuck)

### [2026-06-12] - Auto-score from board cam: classical engine + ONNX flywheel (Option B)
Camera-scores-the-darts, built in two in-browser layers (no server/API, WebGPU).
**L1 classical CV** (`public/js/autoscore-engine.js?v=6`, 133 tests): **auto-calibration** (red/green ring mask → ellipse fit → wedge-crossing labels → ONE tap on the 20 → homography) + **snap-to-edges refine** (Sobel wireframe, HDR-align style, drift-guarded) + frame-diff dart detection. Lab `autoscore-lab.html` (auto-cal + manual 4-tap + camera picker + per-cam saved cal). Real BRDC board verified: ~4-5mm cal, edge-snap +13-23%.
**L2 ML model** (`public/js/onnx-detector.js?v=1`): YOLOv8 ONNX via onnxruntime-web (WebGPU→WASM), letterbox→infer→decode→NMS → cal points + dart tips. Validated on stock COCO yolov8n; WebGPU spike **7ms/140fps**. Wired into the lab with classical fallback + 🌾 self-harvest toggle (POST `/capture`).
**Flywheel** (`E:\projects\darts-vision\`, own git repo): vision sibling of the MC3 coder flywheel. `train.py` (fine-tune + mAP gate + ONNX export/ship), `flywheel.py` (forever loop: poll dataset → retrain on +40 → gate/RESPEC → ship → floor-sweep → self-harvest). py3.12 + torch 2.9.1+cu126 on the local 3090.
**STATE**: whole machine built + every piece proven. **Ignition left = a real capture session** (`autoscore-capture.html`, ~150 frames) → flywheel auto-fires at 120.
**FINDING (1 throw, 2026-06-12)**: classical **registers** but **mis-locates at the board edge** — D20 against the top wire scored MISS (single-cam parallax projects the tip past the 170mm edge). THIS is what the ML model fixes (true board-plane entry); 2-cam fusion is v2. Raw lab auto-harvest saves wrong labels for these → seed via the capture tool's manual-correct until v1 can cross-check.
Priority: High (next: capture session → first trained model)

### [2026-06-11] - REPO HYGIENE: last git commit is April 17 — months of shipped work uncommitted
`git log` head is 2026-04-17; ~270 modified/untracked files carry EVERYTHING since
(vNext port, nav, scorers, streaming stack, perf work, punch-list hardening, auto-score
lab). It's all deployed and working, but one bad `checkout`/disk hiccup loses months.
ACTION (needs Donnie's go): big checkpoint commit of the working tree, then return to
small per-change commits.
Priority: High
**RESOLVED 2026-06-12**: big checkpoint committed + pushed to origin/main this session
(the `git add -A` on the first commit swept all ~270 files into git). Repo is now clean
and current with origin; back to small per-change commits. The new auto-score/flywheel
work is committed too (brdc-firebase + the new `E:\projects\darts-vision` repo).

### [2026-06-11] - Deploy-state drift bit us again: 06-09 sprint sat undeployed for 2 days
The 06-09 punch-list sprint (submitGameResult participant auth, match-hub depth,
contact-center dry-run, iPhone scorer fixes) + the auto-score lab existed ONLY in the
working tree; live apex was still brdc-v81 and the lab URL fell through to the SPA
catch-all. Caught by Fable review probe 2026-06-11; everything deployed + live-verified
(hosting v82 apex; functions submitGameResult + sendDirectorBroadcast to brdc-v2;
no-auth probe → 403 "Not authorized"). LESSON: after any sprint, curl-verify a marker
on the APEX (title/?v= tag), not just local state — same gotcha as CLAUDE.md RULE 0.
Priority: Medium (process note)

### [2026-06-09] - Auto-Score v1 shipped (lab); v2 ideas
CV dart detection live in `autoscore-lab.html` + `autoscore-engine.js` (see `AUTOSCORE-LAB-2026-06-09.md`). Verified: 125 Node tests + browser e2e (synthetic camera → T20/D16 scored correctly). PENDING: real-board calibration test by Donnie (10-min runbook in doc). V2 ideas: two-camera tip fusion (board+thrower cams already exist in the rig), auto-calibration via board circle detection, in-scorer consumption UI for autoscore_candidates (scorer currently must have its own candidate-confirm surface — verify x01-scorer listens to candidates at all), per-venue saved calibration profiles.
UPDATE 2026-06-11 (Fable review): engine hardened to v4 — MOTION-deadlock escape (`rebaseline` event on stale baseline from AE shift/camera bump) + 2-frame dart confirmation (one-frame glints can't mint phantom darts). Suite 133/133, device self-test 8/8 on v4, DEPLOYED live (sw brdc-v82). More v2 ideas from the review: tip = mean of thin-slab extreme pixels (cut 1-2px jitter), multi-blob arbitration for dart-shadow blobs (prefer tip-confidence over area), 8-point calibration + radial term for lens distortion (treble band 8mm; phone wide-cams bend 2-3mm mid-radius).
Priority: High (flagship feature)

### [2026-06-09] - Auth follow-ups from signed-out-inconsistency root-cause (agent findings)
(1) `tournament-director-auth-vnext.js:75` + ssdl/leda login pages call GLOBAL `auth.signOut()` on access-denied — logs the user out of the whole site (most likely cause of the recurring "session lapsed" mystery). Replace with access-denied UI, no signOut. (2) `components/brdc-navigation.js` renders identity from `brdc_session` with no Firebase-auth check (mitigated: key now purged on definitive signed-out). (3) `arena-vnext.js:777` writes a schema-divergent `brdc_session` (raw player object, `id` vs `player_id`).
Priority: High (1), Medium (2-3)

### [2026-06-09] - getLeagueGameProgress still has weak pin-only auth
Same weak pattern submitGameResult had (fixed 2026-06-09). It's a READ path so lower risk, but should get the same participant gate eventually.
Priority: Low-Medium

### [2026-06-04] - STANDING LESSON: bump sw.js CACHE_VERSION when shipping vNext/nav/page-JS changes
burningriverdarts.com registers a caching service worker (`public/sw.js`). It (plus the apex CDN) serves STALE html/js even with no-cache headers and even when a file's `?v=` query tag is bumped — so a new nav/page deploy can silently NOT take effect (symptom: nav v4 rendered on the preview channel — different origin, no SW — but the old nav showed on the live domain). FIX that reliably forces all clients fresh: bump `CACHE_VERSION` in `public/sw.js` (it uses skipWaiting + clients.claim + deletes old caches on activate, so the new SW takes over next load and purges stale assets). Do this on EVERY deploy that changes vNext page HTML, the nav component, or shared JS. (Bumping the per-file `?v=` tag alone is NOT sufficient on this setup.) Consider later: make vNext pages + nav component network-first in the SW so this stops recurring during active dev.
Priority: High


### [2026-06-03] - create-tournament builder QA (no-write) + 3 bugs fixed; date/time pickers
Ran a full no-write builder test (fetch-intercepted createTournament/createMixedDoubles → synthetic success, ZERO real writes). Builder PASSES: all fields, conditional sections (mixed legs 501/C/CH, matchmaker panel, playoff, runtime options), validation, and function routing (createTournament vs createMixedDoublesMatchmakerTournament) work; no console errors. 3 bugs FIXED + deployed (create-tournament-vnext.js v=6):
- #1 (med, VERIFIED live): venue address field stayed visible for online/flexible location (inline display:none lost to a `.ves-config-grid` grid rule) → used `style.setProperty('display','none','important')`. Now hides for online/flexible, shows for specific.
- #2 (low): `registration_vote_options` sent even when voting disabled → now `votingEnabled ? options : []`.
- #3 (low): matchmaker checkbox values (partner_matching/breakup_enabled/savage_summaries_enabled) leaked into non-matchmaker payloads → now gated on `preset === 'mixed_doubles_matchmaker'`.
Date/time fields made obvious selectors on create-tournament + create-league: native pickers' icon inverted to be visible on dark fields + click-to-open `showPicker()` on every date/time input. CSS scoped to `.vnext-light-page`/`.scorer-setup-workflow-page`. STILL UNVERIFIED: the actual server create (intercepted in test) — needs a real submit on the user's test event.
Priority: Medium - DONE (builder), pending real-create confirmation


### [2026-06-03] - Legacy fb-sidebar / fb-chat-sidebar drawers showing on 3 vNext pages — RESOLVED
Root cause: vNext desktop chrome moved to a top bar (`brdc-desktop-nav`); the legacy left `fb-sidebar` (fb-nav.js) + right `fb-chat-sidebar` (chat-drawer.js), still loaded by shared `brdc-navigation-init.js`, are pushed off-canvas + their reserved 240/280px gutters reclaimed by CSS scoped to `body.is-desktop[class*="vnext"]` (brdc-navigation.css ~852-889). But 3 vNext pages used abbreviated body classes with NO "vnext" substring — `league-team-vnext` (`ltv-page`), `match-hub-vnext` (`mhv-page`), `player-profile-vnext` (`ppv-page`) — so the rules never matched and both drawers stayed pinned (240px L + 280px R). FIX: added a page-specific `*-vnext-page` class to each body tag (no shared-file edit, no conflicting styles). VERIFIED on apex: league-team + match-hub now bodyPad 0/0, fb-sidebar off-canvas (right edge 0), fb-chat-sidebar off-canvas (left 1912). All 28 vNext pages audited — these were the only 3 stragglers; the rest already carry a "vnext" body class.
NOTE: the drawers' JS still loads on vNext (just hidden off-canvas) — a later cleanup could skip loading fb-nav.js/chat-drawer.js on `-vnext` URLs in brdc-navigation-init.js, but that's a shared file used by ~43 legacy pages too, so it needs care + a version bump; the CSS-scoped hide is the safe fix.
Priority: Medium - DONE


### [2026-06-03] - Cricket high-mark stats missing on triples league Stats tab (ROOT CAUSE: field-name + pipeline gap)
Reported: cricket stats missing on triples-vnext Stats tab. Investigation: MPR/Legs/Win% DID render; HRnd showed "-" and the High Marks breakdown (9M/8M/7M/6M/5M) was all blank. ROOT CAUSE: the league recalc `exports.recalculateLeagueStats` (functions/leagues/index.js ~5821) computes only cricket AGGREGATES — `cricket_high_marks` (best round) + `cricket_5m_plus` (count of 5+ rounds) — NOT the per-level `cricket_nine_mark_rounds`/etc. the UI expects. (A different pipeline, import-matches.js, does compute per-level, but didn't write this league's data.) The vNext display also read the wrong field for HRnd (`cricket_high_mark_round` instead of `cricket_high_marks`). This naming/pipeline mismatch affects the whole app, not just vNext (league-view/stats.js:486 has the same wrong field).
FIX PART 1 — DONE + VERIFIED 2026-06-03 (frontend, deployed apex): triples-vnext.js `highMark` now reads `cricket_high_marks` (fallback `cricket_high_mark_round`); bumped ?v=12. HRnd now shows real best-round (e.g. 9) on the cricket Averages page.
FIX PART 2 — CODE READY, NEEDS PROD OP: added per-level counting to recalculateLeagueStats (init + `for m of marks_per_round` → cricket_nine/eight/seven/six/five_mark_rounds; data already in marks_per_round). To activate: `firebase deploy --only functions:recalculateLeagueStats --project brdc-v2` THEN run recalculateLeagueStats for league aOq4Y0ETxPZ66tM1uUtP. CAUTION: that recompute regenerates ALL league stats docs (51) from match data, not just cricket — confirm blast radius before running. Until then, the High Marks breakdown stays blank (no per-level data yet).
Priority: High
FIX PART 2 — DONE + VERIFIED 2026-06-03: deployed `recalculateLeagueStats` to brdc-v2; ran recompute (92 matches / 823 games / 1955 legs / 51 players, 0 unresolved). GUARDED DIFF (4 sample players, full-doc field compare BEFORE vs AFTER): each added ONLY `cricket_{five,six,seven,eight,nine}_mark_rounds`; ZERO other fields changed or removed — no collateral stat drift. Internal consistency: per-level counts sum to `cricket_5m_plus` (e.g. 24+7+10+0+1=42) and `nine_mark_rounds`≥1 matches `cricket_high_marks=9`. Live High Marks page now populated (e.g. Danny Russano 9M=7,8M=1,7M=25,6M=30,5M=87 — was all dashes). NOTE: image screenshots couldn't be captured — the live page's persistent Firestore listeners prevent the screenshot tool from reaching document_idle (known tooling instability); used exact rendered-value before/after tables as proof instead.
SIDE NOTES — ALL 3 RESOLVED + VERIFIED 2026-06-03:
(1) Duplicate `exports.recalculateLeagueStats` (1342 + 5528): dead 1342 block removed; `node --check` passes; exactly 1 export remains; deployed.
(2) Auth gap: was systemic — the weak "PIN-only-if-supplied" check appeared in 3 functions (`submitGameResult`, `recalculateLeagueStats`, `assignPlayerLevels`). Fixed `recalculateLeagueStats` + `assignPlayerLevels` to use `hasLeagueDirectorOrAdminAccess(req, league, league_id, admin_pin)` (the same helper `deleteLeague` uses — verifies authenticated director/admin via Bearer token, still accepts a PIN). VERIFIED: unauth POST → 403; authed master-admin (donniepagel) → 200/51 players. Deployed to brdc-v2. **submitGameResult deliberately NOT changed** — it's the scorer SAVE path; scorers aren't directors, so a director-only gate would break event-night scoring. See new item below.
(3) Legacy `league-view/stats.js:486` highMark → `(cricket_high_marks ?? cricket_high_mark_round)`; deployed.
Also: cricket frontend HRnd fix (triples-vnext.js → cricket_high_marks) deployed as v=13; HRnd now shows real values (was "-").
Priority: High — DONE

### [2026-06-03] - submitGameResult auth needs participant verification (NOT director-gate)
The scorer save function `submitGameResult` (functions/leagues/index.js) still uses the weak `if (admin_pin && !checkLeagueAccess(...))` (only verifies a PIN if one is supplied). It must NOT be changed to a director/admin-only gate (`hasLeagueDirectorOrAdminAccess`) because regular players/scorers — not directors — submit game results on match night; a director gate would break live scoring. The RIGHT fix: verify the caller is an authenticated participant of that match (Bearer token → player → is on home/away roster or assigned scorer) before accepting a write. Design carefully and test against the scorer flow before deploying. Until then the save path accepts results without strong auth.
Priority: Medium


### [2026-06-03] - X01 scorer sidebar LEGS counter stays 0 during a set (display-only)
Found in E2E no-write test. `#homeLegs`/`#awayLegs` (set by `updateUI()` from `teams[].legs`, x01-scorer-vnext.html:4968) don't reflect legs won during play, even though `team.legs++` fires on checkout (line 4539) and leg/set PROGRESSION + win conditions + saves all work correctly. Suspected cause: `nextLeg()` (line 5672) advances via page navigation / sessionStorage rebuild and the updated legs count isn't re-applied to the sidebar on the new leg (URL `home_legs`/`away_legs` read at 2465-2466 default to 0). NON-BLOCKING: scoring/saving correct; only the running set tally display is stale. DO NOT hot-patch right before live matches — fix carefully (trace mixed/casual/league nextLeg paths) with engine re-test afterward. Also confirm whether league-mode (tonight's matches) resets the same way between legs of a set.
Priority: Medium
RESOLVED + CONFIRMED 2026-06-03: added `updateUI();` right after the leg is decided (x01-scorer-vnext.html, after `updateInputDisplay()` in the checkout handler) so the sidebar refreshes the legs tally on both leg-win and game-win branches (the human-vs-human `nextLeg` else-branch never called updateUI). Re-tested live: `#homeLegs` shows "1" after a leg win and persists into leg 2; no scoring regression. Deployed to apex.

### [2026-06-03] - X01 chooseThrowOrder can crash if throw-order picked before cork-winner state set
Observed during re-test: `TypeError: Cannot read properties of undefined (reading 'name') at showStarterReadyPhase (x01-scorer-vnext.html:3352) ← chooseThrowOrder (:3519)` when THROW FIRST/SECOND is invoked before `pendingStarter` is set. Only reproduced via same-tick programmatic clicks (a human can't click two buttons in one JS tick), so real-world risk is low. Same bug family as the cricket cork guard. FIX (later, carefully): guard `showStarterReadyPhase`/`chooseThrowOrder` against null `pendingStarter` (early-return like the cricket addHit guard). NOT introduced by recent fixes.
Priority: Low
RESOLVED + CONFIRMED 2026-06-03: root-cause guard added at top of `window.chooseThrowOrder` — `if (corkOptionHolder == null) return;` (cork winner must be chosen before throw-order can resolve). Verified live: calling chooseThrowOrder before cork-winner no longer throws, does not advance to ready-phase, leaves no garbage state. Deployed to apex.

### [2026-06-03] - Cricket scorer cork sequence briefing (low risk)
If START is clicked before selecting cork-winner, `pendingStarter`/`activePlayer` stay null and dart entry crashes (`Cannot read properties of undefined (reading 'marks')`). Mitigated in practice: START is disabled (`corkCheckReady`) until a winner is chosen, and singles auto-select both players. ACTION: either harden by guarding dart-entry against null activePlayer, or brief scorers: "tap who won the cork, then START." Confirm the disabled-guard holds on all paths (doubles, corks-choice).
Priority: Low
RESOLVED + CONFIRMED 2026-06-03: added `if (activePlayer == null || !players[activePlayer]) return;` at the top of `window.addHit` (league-cricket-vnext.html) so darts thrown before the cork/starter is resolved are safely ignored instead of crashing. Re-tested live: pre-cork dart ignored (no crash, no `marks` error), normal scoring works after cork. Deployed to apex. (A scorer briefing is still nice-to-have but no longer required to avoid the crash.)


### [2026-06-03] - Missing Firestore index breaks home "online matches" (PRE-EXISTING)
home-vnext `getActiveOnlineMatches` (functions/online-play.js:261) queries `online_matches` with `status IN ['waiting','in_progress']` + `orderBy created_at desc` — needs composite index `(status ASC, created_at DESC)` which was absent. Surfaced as `FAILED_PRECONDITION: query requires an index` in console on home (project brdc-v2). NOT caused by vNext work. FIX: added the index to `firestore.indexes.json`. RESOLVED + CONFIRMED 2026-06-03 — deployed to brdc-v2 (`firebase deploy --only firestore:indexes`), non-destructive; index finished building and home console is now CLEAN (no FAILED_PRECONDITION on fresh reload of burningriverdarts.com/pages/home-vnext.html).
Priority: Medium

### [2026-06-03] - firestore.indexes.json drift (4 prod indexes not in repo file)
Deploy output 2026-06-03: "there are 4 indexes defined in your project that are not present in your firestore indexes file." So `firestore.indexes.json` is out of sync with deployed brdc-v2 state. RECONCILE: pull the 4 live index definitions into the repo file so a future `firebase deploy --only firestore:indexes --force` doesn't accidentally delete live indexes. Do NOT run --force until reconciled.
Priority: Medium
RESOLVED 2026-06-03: pulled live indexes (`firebase firestore:indexes --json`), diffed ignoring the implicit `__name__` field, and merged the 4 true-drift entries into `firestore.indexes.json` (`featured_banners` active/priority; `jobs` ×2 and `service_areas` — the latter 3 appear to belong to a DIFFERENT app sharing the brdc-v2 project, so capturing them prevents a --force from nuking them). Repo now 58 == live 58, 0 drift both directions. No deploy needed (file-only reconcile); --force is now safe but still unnecessary.

### [2026-06-02] - CANONICAL DEPLOY TARGET for burningriverdarts.com (CLAUDE.md RULE 0 is wrong)
The real public apex domain **burningriverdarts.com** is served by Firebase site **`brdc-live-0428`** in project **`dashboard-ll`** (NOT brdc-v2). Deploy the live public site with:
```
firebase deploy --only hosting --config firebase.current-apex-hosting.json --project dashboard-ll
```
Verified 2026-06-02: bare `firebase deploy` / the `burningriverdarts` site (→ burningriverdarts.web.app) and `brdc-v2.web.app` are NOT the apex domain. A 200 on a missing /pages/*.html is the SPA catch-all rewrite serving index.html — confirm real content (title/marker), not just status code. Site map: burningriverdarts.com→brdc-live-0428(dashboard-ll); brdc-v2.web.app→brdc-v2; burningriverdarts.web.app→burningriverdarts(brdc-v2); fortheloveofdarts.com→fortheloveofdarts.
RESOLVED 2026-06-02: CLAUDE.md RULE 0 + the Deployment block updated with the correct apex command, full domain→site→project map, and gotchas. (Handoff doc not yet updated — low priority.)
Priority: High (mostly resolved)


### [2026-06-02] - league-director-vnext: retire/redirect decision (needs user OK)
The triples-vnext port added a director-only Manage tab (the in-page league-management workflow). Per the existing backlog item, the standalone `league-director-vnext.html` should be retired/redirected once that's proven. NOT done autonomously (structural nav change needs confirmation). Page verified still working as a fallback (0 overflow, real data "92/94 matches, 2026 Triples League"). Decision for user: (a) redirect league-director-vnext → triples-vnext#manage, (b) keep both, or (c) fully retire. Recommend keeping as fallback until the Manage tab gets a director-session QA pass.
Context: autonomous BRDC vNext port run.
Priority: Low

### [2026-06-02] - admin-vnext auth-precheck: signed-in-non-admin still 401s + cache-bust lesson
The admin-vnext auth-precheck fix (gate `adminGetDashboard`/`adminGetMembers` behind `auth.currentUser || waitForAuthReady`) is deployed and verified clean for the SIGNED-OUT case (no more Unauthorized console errors; admin-vnext.js bumped to ?v=2). Remaining: a SIGNED-IN-NON-ADMIN user still passes the "is there a user" gate and then trips the cloud 401. To fully silence, broaden the catch to treat any `Unauthorized` as a quiet render-unavailable (the quiet-catch currently only covers `isAuthGate`), or do a role pre-check. Low priority (UI degrades gracefully either way).
LESSON (process): when an agent edits a JS file, the page's `?v=N` cache-bust tag MUST be bumped or browsers serve stale JS over Firebase no-cache headers. The admin fix appeared not to work until ?v=1→?v=2 was bumped. Verify version-tag bumps on every JS edit going forward.
Context: autonomous BRDC vNext port run.
Priority: Low
RESOLVED 2026-06-03: broadened the final `.catch` in admin-vnext.js to treat `Unauthorized`/`permission`/`denied`/`not authorized` errors as a quiet graceful "Admin unavailable" (was only quiet on `isAuthGate`), so a signed-in non-admin no longer logs a console error. Bumped admin-vnext.js ?v=2→?v=3, deployed to apex, syntax OK. Success path (real admin) unaffected — change only touches the error branch. (True signed-in-non-admin console verification needs a non-admin test account; logic is straightforward.)

### [2026-06-02] - messages-vnext: pending logged-in QA
messages-vnext ported (6-category tabs Direct/League/Team/Events/Challenges/Online, team match context), demo-clean, syntax OK, renders graceful login gate (0 overflow). Pending: logged-in QA (real threads, send a direct message / chat / challenge — write-risk, no-send-verified only) and mobile look/test.
Context: autonomous BRDC vNext port run.
Priority: Medium

### [2026-06-02] - wing-it-wednesdays-vnext query doesn't match real tournament schema
The new `wing-it-wednesdays-vnext.html` renders cleanly (0 overflow) but shows "NO WEEKS FOUND" because its dynamic query looks for a `series_slug`/`series_id`/`event_series` field that real BRDC wing-it tournament docs don't appear to have (e.g. `rookies-wing-it-wednesdays-2026-06-10` exists with name "Wing It Wednesdays #3"). Fix: align the query to how wing-it events are actually identified in Firestore — likely by name match (`/wing.it.wednesday/i`) or tournament-id prefix, scanning the `tournaments` collection — instead of the assumed series field. Constants `SERIES_FIELD_CANDIDATES` / `SERIES_VALUE` at top of `wing-it-wednesdays-vnext.js`.
Context: autonomous BRDC vNext port run, missing-page builds wave B.
Priority: Medium
RESOLVED + CONFIRMED 2026-06-03: `loadSeriesWeeks()` now keeps the explicit series-tag query as a primary path, then falls back to scanning `tournaments` (limit 300) and matching by `isWingItDoc()` — name OR doc-id against `/wing.?it.?wednesday/i` (mirrors the working events-vnext fetch-and-filter pattern). Added `limit` import, bumped page to ?v=2. Verified live on burningriverdarts.com: page now finds **14 weeks** (was 0/"NO WEEKS FOUND"), status "Choose a week". If the event builder later sets a real series_slug, the primary path takes over automatically.

### [2026-06-02] - New event pages (league-import, wing-it, matchmaker-mingle/tv): pending live QA
Four more previously-missing pages created from reference, demo-stripped (0 markers), syntax OK, render cleanly desktop (0 overflow; league-import director-gated, wing-it empty-state per item above, matchmaker pages read-only). Pending: real-data QA (matchmaker pages need a matchmaker-enabled tournament_id; league-import needs a director session to actually run `parseDartConnectRecap`→`importMatchData` dry-run/import — write-risk, no-import-verified only); mobile look/test for all four. matchmaker-mingle + matchmaker-tv are read-only (no writes); league-import import is guarded by a parse-first dry-run + confirm.
Context: autonomous BRDC vNext port run, wave B.
Priority: Medium

### [2026-06-02] - New director pages built (create-league, director-home, contact-center): pending live QA
Three previously-missing pages were created from the Rookies reference, demo-stripped, BRDC-adapted; all render cleanly desktop (0 overflow) with director-login gates / disabled send. Pending:
- Full director-mode QA with a real director session: create-league actual submit (writes via direct `setDoc(doc(db,'leagues',slug), payload, {merge:true})` — confirm Firestore rules allow director league writes, and that the slug-id scheme is desired vs an auto-id); director-home real league/event lists; contact-center recipient loading + (carefully) a dry-run broadcast. All no-send/no-submit verified only.
- Mobile (375px) look/test for all three.
- NOTE: create-league agent fixed a reference bug where `cork_option` always wrote `winner_chooses` regardless of selection — verify the corrected value is what's wanted.
- director-home `director-hero-compact`/`director-league-card` hooks are unstyled in shared CSS (same as reference — degrade gracefully); add polish later if desired.
Context: autonomous BRDC vNext port run, missing-page builds wave A.
Priority: Medium

### [2026-06-02] - Tournament cluster vNext: pending director-mode + mobile QA
The 4 tournament pages (create-tournament, tournament-register, tournament-runtime, tournament-view) were ported and pass desktop look/test (0 overflow, no console errors; real data on view/register via tournament `rookies-wing-it-wednesdays-2026-06-10`; graceful director gates on create/runtime). Still pending (needs a director session + willingness to do controlled writes):
- Full director-mode QA of create-tournament (submit a real event) and tournament-runtime (all 24 runtime actions: bracket gen, check-in, board assign, draw partners, mingle, Cupid Shuffle, submit/confirm result, send reminder, delete). All are no-submit-verified only; the actual write paths are unexercised.
- Mobile-width (375px) look/test for all 4 (desktop only so far). These are forms/management surfaces (less mobile-critical than scorers) but should get the mobile pass.
- tournament-register actual submit (registerForTournament / matchmakerRegister + sms_opt_in) unexercised.
Context: autonomous BRDC vNext port run, tournament cluster.
Priority: Medium

### [2026-06-02] - Cricket scorer vNext: verify cork-flow + closeout changes (from vNext port)
During the league-cricket-vnext port, the porting agent introduced scoring-FLOW changes beyond the intended CSS/visual scope. Actions taken + follow-ups:
- REVERTED: a winner-WRITE detection change (it had created a duplicate `const legWinner` SyntaxError that broke the whole scorer). Restored original RULE-24 "higher score wins" logic. Syntax now valid; engine verified working (3 marks closed the 20).
- KEPT but UNVERIFIED (need live no-write play-through before trusting for real match writes): cork-starter resolution (`resolveCorkStarter`/`startResolvedLeg` honoring the `corkOption` param) and the closeout-row highlight now keyed on `turn.isWinningTurn` (display-only). Confirm correct starter selection and closeout highlighting in a real game.
Context: autonomous BRDC vNext port run, Cricket scorer batch. Lesson: scorer ports must be strictly CSS/markup; flag any JS-logic edits.
Priority: High

### [2026-06-02] - Cricket scorer casual game shows "PLAYER 0" for unnamed players
With no player names entered, the casual cricket scoreboard labels appear as "PLAYER 0" (both panels looked the same in a quick probe). Verify default-name fallback gives distinct, friendly placeholders (e.g., "Player 1"/"Player 2"). Likely pre-existing, not port-introduced.
Context: vNext port Cricket QA.
Priority: Low

### [2026-06-02] - vNext graceful states for auth/missing-param (found in Batch-1 QA)
Three minor JS issues surfaced during the BRDC vNext CSS-foundation QA sweep (not CSS bugs; defer to their proper port batches):
- `admin-vnext.html` calls `adminGetDashboard` + `adminGetMembers` even with no admin session, logging two `Unauthorized` console errors. Should role-check before calling rather than call-and-catch. (Address in admin/director portal batch.)
- `tournament-view-vnext.html` throws `Error: Missing tournament_id` when no param; recovers to "TOURNAMENT UNAVAILABLE" but should no-op gracefully instead of throwing. (Address in tournament-view batch.)
- `player-profile-vnext.html` throws `Error: Missing player_id` when no param; same pattern. (Address in player-profile batch.)
Context: BRDC vNext port, Batch-1 look/test sweep on preview channel css-foundation.
Priority: Low

### [2026-06-02] - Match-hub vNext: set-grouping (RULE 17) + leg-card badges (RULE 20) not implemented
The vNext match hub (`match-hub-vnext.js`) renders each `games[]` entry as its own card and does NOT group legs by `set` number into SET cards with aggregated leg scores (RULE 17), nor show the leg-card display badges (cork "C", `★ OUT: 43`, `★ CLOSED (7M)`, `Left: 32`) from RULE 20. Confirmed absent in BOTH the Rookies reference and BRDC production during the Batch-4 port — so it's a never-built feature, not a port regression. The legacy `match-hub.html` (non-vNext) does implement these. Port that depth into vNext.
Context: BRDC vNext port, match-hub port batch. Also relates to existing backlog item "Match Hub VNext Post-Match Parity" (Awards/Leaders).
Priority: Medium

### [2026-06-02] - Match-hub vNext tab buttons 38px on mobile (minor)
The 4 match-hub tab buttons (Sets/Performance/Rosters/Context) render at 38px tall on mobile — 2px under the 40px comfort target. Acceptable but could bump to 40px for consistency with the league page's `.tv-now-links` treatment. Not fixed in Batch 4 to avoid altering the tab-strip design without sign-off.
Context: BRDC vNext match-hub mobile audit.
Priority: Low

### [2026-06-02] - Shared nav/chat drawer touch targets under 40px (mobile)
The shared FB-style nav + chat sidebar components (`fb-sidebar-*`, `fb-chat-sidebar-*`: close ×, search inputs, "See All Messages", "+ New") render at 30–36px tall on mobile (375px) — under the comfortable 40px tap height. These are site-wide shared chrome, surfaced during the BRDC vNext league-page mobile audit. Bump to >=40px when we do the navigation port batch (rather than per-page).
Context: BRDC vNext port, league-page mobile responsive audit. League-page-specific `.tv-now-links` buttons already fixed (34→40px).
Priority: Low

### [2026-02-21] - Scorer Hub → Game Setup Redirect
The Scorer Hub page isn't functional yet. The nav link for Scorer Hub should redirect to game-setup.html instead until the hub is built out.
Context: User noticed scorer hub isn't working during Dart Trader session
Priority: Medium

### [2026-02-16] - UX Polish Pass Remaining Items
Remaining from 4-page visual audit: dashboard match modal uses inline styles instead of shared card classes (partially addressed), match card border colors per event type (RULE 8 — teal for league, yellow for tournament), record badge vs standing badge size hierarchy.
Context: Infrastructure/UX overhaul session completed most issues
Priority: Low

### [2026-02-08] - D. Partlo vs N. Kull Week 4 Missing Set 9
Match `pNJ5wKPIrHPQqXQv5Nhl` only has 8/9 sets. The RTF file (`temp/trips league/week 4/partlo v kull.rtf`) doesn't contain Set 9 (P3 Singles 501). Need to check with league director if the set was played but not recorded, or if the match ended early.
Context: Discovered during Week 4 import
Priority: Low (match score is correct at 5-3, just missing the data for 1 set)

### [2026-01-22] - Virtual Darts Multiplayer/Online Play
Add ability to play against remote opponents
Context: Progression system now tracks single-player progress; multiplayer would be next step
Priority: Medium

---

## Completed

### [2026-02-16] - Match-Hub Remaining Tabs (Performance, Award Counts, Leaderboard)
All 3 tabs fully functional: Performance shows player summary, '01/'Cricket leaders, all games tables. Awards shows checkout performance, opportunity tracking, 100+/95+ turns, cricket 5M+ turns, bulls, marksman counts. Leaders shows paginated performance/record views with X01 and Cricket sub-tabs.
Context: Discovered already built during UX audit session
Completed: 2026-02-16

### [2026-02-16] - Throw Data Notable/Checkout/Closeout Flags Backfill
Ran `scripts/backfill-throw-flags.js` to add 2,742 flags across 20 matches (418 legs). Enables RULE 20 cricket closeout indicators (★ CLOSED) and X01 checkout indicators (★ OUT) on match-hub leg card headers.
Context: Import pipeline supported flags but existing data predated the feature
Completed: 2026-02-16

### [2026-02-16] - Infrastructure & UX Overhaul (4-Page Audit)
CSS extraction (3 pages), breadcrumbs→back buttons (13 pages, Facebook mobile pattern), CSS variable standardization (12 vars), captain-dashboard nav integration, accessibility pass (4 pages), RULE 20 indicators, pre-match state, level badge standardization, match card 7-column grid (RULE 9), tab label shortening, empty state standardization, button loading/skeleton pattern sharing.
Context: Full visual/usability audit of dashboard, league-view, match-hub, captain-dashboard
Completed: 2026-02-16

### [2026-02-10] - SendGrid Email Integration
Installed `@sendgrid/mail`, configured API key and `FROM_EMAIL=noreply@burningriverdarts.com` in functions/.env. Domain authenticated via Cloudflare DNS (DKIM + return path). Fixed TODO in phase-5-6-7.js `sendEmail` function. Updated fallback FROM_EMAIL in all 4 notification files from `brdc-darts.com` to `burningriverdarts.com`. All email functions now send real emails (were previously simulated).
Context: SendGrid was deferred earlier due to no account; user set up account and DNS
Completed: 2026-02-10

### [2026-02-10] - Fix All Code TODOs + Wire SMS + Friends Integration
12 fixes across 9 files: VAPID key cleanup, scorer stat calculations (topPPD/topMPR), registration count query, bracket cutoff enforcement, 5 SMS notifications wired (team registration, free agent, team invite, board assignment, match reschedule), friends feed filter, posts friends-only visibility check.
Context: Codebase audit found 18 TODO comments, 12 were actionable
Completed: 2026-02-10

### [2026-02-10] - Dashboard Modularization
Extracted 3,681-line dashboard.html into 5 JS modules + 3 CSS modules. File reduced to 211 lines (94% reduction). Modules: dashboard-state.js, dashboard-utils.js, dashboard-auth.js, dashboard-feed.js, dashboard-schedule.js, dashboard-base.css, dashboard-feed.css, dashboard-schedule.css. Native ES6 imports, no build system needed.
Context: Original plan was 16 JS + 15 CSS modules (~96 hours). Actual: 5 JS + 3 CSS modules, completed in one session.
Completed: 2026-02-10

### [2026-02-10] - Upgrade Firebase Functions SDK to 5.1.1
Upgraded from firebase-functions 4.9.0 to 5.1.1. Attempted v7.0.5 first but it broke pubsub.schedule (tried to force 2nd-gen upgrade). v5.1.1 maintains v1 API compatibility.
Context: Deployment warnings about deprecated SDK version
Completed: 2026-02-10

### [2026-02-10] - Upgrade Node.js Runtime to 22
Upgraded Cloud Functions runtime from Node.js 20 to Node.js 22 in functions/package.json.
Context: Node.js 20 deprecated 2026-04-30
Completed: 2026-02-10

### [2026-02-10] - Virtual Darts Haptic Settings Toggle
Added UI toggle in virtual darts settings to enable/disable haptic vibration feedback.
Context: HapticManager had enable/disable capability but no UI control
Completed: 2026-02-10

### [2026-02-10] - Notable/Checkout Flags Import Pipeline
Added notable event detection (180s, tons, checkouts) and checkout flags to the import pipeline for throw-level data.
Context: Feed cloud function was detecting from raw values; match-hub needed flags on throws directly
Completed: 2026-02-10

### [2026-02-10] - Individual Notable Event Feed Items
Added individual feed items for standout moments: 180s, big checkouts (161+), 9M cricket rounds. Separate from weekly highlight compilations.
Context: Makes feed more dynamic and social with real-time notable events
Completed: 2026-02-10

### [2026-02-09] - Migrate from functions.config() to process.env
All 3 remaining `functions.config()` calls in `phase-5-6-7.js` (Twilio SMS in `registerFillin`) migrated to `process.env.TWILIO_*`. The `.env` file already had all credentials. 7 of 8 files were already using `process.env`.
Context: functions.config() and Cloud Runtime Config deprecated, shuts down March 2026
Completed: 2026-02-09

### [2026-02-08] - Dashboard Weekly Highlights Feed
New `week_highlights` feed item type showing best 3DA, best MPR, 180s, 140+ tons, big checkouts, high cricket marks, closest/biggest match per week. Cloud function detects from raw throw scores. Dashboard renderer with styled card.
Context: User wanted newsfeed updated with highlights from imported weeks
Completed: 2026-02-08

### [2026-02-08] - Week 4 Match Imports
Imported Neon Nightmares vs D. Russano (9-0 sweep, full 9 sets). Reimported D. Partlo vs N. Kull (8/9 sets from RTF). Stats recalculated for all 36 players.
Context: User provided Week 4 RTF files
Completed: 2026-02-08

### [2026-02-08] - Fill-In Player Auto-Detection
league-view.html and match-hub.html now auto-detect fill-in players by comparing who played (from games array) vs team roster, when explicit lineup arrays don't exist. Shows SUB/OUT badges.
Context: Fill-in players weren't showing in match reports despite being in game data
Completed: 2026-02-08

### [2026-02-08] - Christian Ketchum Name Canonicalization
Added CANONICAL_NAMES map to import script to normalize all name variants (Ketchem→Ketchum, etc.). Applied at 3 points in import pipeline. Fixed team_id. Re-imported affected matches.
Context: RTF had "Christian Ketchem" typo, player was invisible in match data
Completed: 2026-02-08

### [2026-02-08] - Cricket Stats Leg-Level Format Fix
Changed `recalculateAllLeagueStats` to detect format at leg level (`leg.format || game.format`) instead of game level. Fixes cricket legs in mixed-format/Corks Choice sets being counted as X01.
Context: All 36 players had cricket stat mismatches due to misclassification
Completed: 2026-02-08

### [2026-02-08] - Bracket Seeding Control
Director can now set custom seed order for tournament brackets. Seeding list with up/down arrows below Round 1 preview. Backend `regenerateBracket` accepts optional `seed_order` array. Two buttons: APPLY SEED ORDER and SHUFFLE RANDOM.
Context: Director needed control over bracket matchups, not just random shuffle
Completed: 2026-02-08

### [2026-02-08] - Bulk Remove Registrations (Director)
Added REMOVE SELECTED button to matchmaker director check-in page. Modified `deleteMatchmakerRegistration` to accept `director_pin` for auth (was player_id only). Confirmation dialog + progress tracking.
Context: Director needed to bulk-delete registrations, not just check them in
Completed: 2026-02-08

### [2026-02-08] - 8-Digit PIN Validation Fix
Fixed PIN validation on tournament-view.html (was 5), stat-verification.html (was 5), matchmaker-register.html (was 4). All now enforce 8-digit PINs consistently.
Context: Multiple pages had leftover validation from older PIN lengths
Completed: 2026-02-08

### [2026-02-08] - Matchmaker Tournament Registration Redirect
tournament-view.html REGISTER NOW button now redirects to matchmaker-register.html when `matchmaker_enabled: true`. Previously opened a generic modal requiring event selection that silently failed for matchmaker tournaments.
Context: Registration appeared to work (PIN lookup succeeded) but never actually registered
Completed: 2026-02-08

### [2026-02-08] - Bye Week Cards in League Schedule
Teams with no match in a week now show a bye card with roster and stats in league-view.html schedule tab.
Context: User wanted visibility into which teams have bye weeks
Completed: 2026-02-08

### [2026-01-22] - Virtual Darts Achievements System
Created achievements.js module with 10 starter achievements, localStorage persistence, animated unlock popups
Context: Key engagement mechanic missing from current implementation
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Brand Color Fix
Updated styles.css to match BRDC brand colors (--pink: #FF469A, --teal: #91D7EB, --yellow: #FDD835), added background gradient with glow effects
Context: Virtual Darts colors didn't match main site branding
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Swipe Quality Display
Added visual popup showing throw quality (EXCELLENT/GOOD/OK/POOR) after each throw with auto-fade
Context: physics.js calculated swipeQuality but never displayed it to users
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Cricket Scoreboard Fix
Fixed startCricket() to unhide scoreboard, fixed bull hit detection (segment 50 = 2 marks, segment 25 = 1 mark)
Context: Cricket scoreboard never shown, bulls not registering correctly
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Stats Persistence
Implemented localStorage persistence for game stats (games played, wins, best scores, 3-dart averages), display on results screen
Context: Phase 4 integration - no stat persistence between sessions
Completed: 2026-01-22

### [2026-01-22] - Chat Message Edit Server Validation
Added server-side 5-minute edit window validation in editChatMessage() function
Context: Edit window only enforced client-side, could be bypassed
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts AimSystem Completion
Fixed incomplete selectTarget() and zoomToArea() methods in aimSystem.js
Context: Methods were called but never defined, breaking tap-to-zoom targeting
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Haptic Feedback
Added navigator.vibrate() API for throw, hit, 180, checkout, bust patterns
Context: Competitor analysis showed haptic feedback improves mobile UX
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Mobile Swipe Tuning
Reduced MIN_SWIPE_LENGTH to 30, MIN_SWIPE_SPEED to 200, added jitter filtering
Context: Swipe thresholds were too strict for mobile devices
Completed: 2026-01-22

### [2026-01-22] - Dashboard Modularization Assessment
Created DASHBOARD-REFACTOR-PLAN.md with 16 proposed JS modules and refactoring order
Context: Dashboard.html is 14K+ lines, needed analysis before refactoring
Completed: 2026-01-22

### [2026-01-22] - Orphan Pages Linking
Added STREAM to nav-menu.js, linked stream-camera.html from stream-director.html
Context: stream-camera.html and stream-director.html had no navigation links
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Difficulty Unlock System
Progressive unlocking: Easy→Medium→Hard→Pro with 3 wins each, localStorage persistence
Context: Needed progression system to increase engagement
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Critical Bug Fixes
AutoSuggest has 5 undefined functions that need to be implemented: `isCheckout()`, `isBogeyNumber()`, `getCheckout()`, `parseTarget()`, `SETUP_TARGETS`
Context: Found during 6-agent virtual darts assessment
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Sound Effects
Add audio feedback for dart throws, hits, 180s, checkouts, busts
Context: Competitor analysis showed all successful dart games have sound
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Bob's 27 Practice Mode
Classic doubles training game - start at 27, hit doubles 1-20 + bull
Context: Most requested practice mode in competitor apps
Completed: 2026-01-22

### [2026-01-22] - Chat Typing Indicator Security
Fix Firestore rules to validate that player can only update their own typing status
Context: Found during QA testing - current rules allow spoofing
Completed: 2026-01-22

### [2026-01-22] - Presence TTL Cleanup
Implement scheduled function to clean up stale presence_heartbeats documents
Context: Currently no cleanup, documents accumulate forever
Completed: 2026-01-22

### [2026-01-22] - Chat Push Notifications
Deploy `onChatMessageCreated` Firestore trigger for FCM push notifications
Context: Trigger failed to deploy due to Eventarc permissions, needs retry
Completed: 2026-01-22

### [2026-05-26] - Wing It Wednesdays Summer Series
Build recurring support for the Wednesday summer event series: flexible weekly concept, blind draw/social formats, public registration, and weekly wing-special copy.
Context: First Wing It Wednesdays event is being set up as a blind draw for Wednesday, May 27, 2026.
Update: As of May 30, 2026, Wing It Wednesdays should be treated as an every-Wednesday summer series at Rookies, not occasional one-offs.
Priority: Medium

### [2026-05-29] - SaaS Pivot and Pricing Model
Refocus BRDC from operating unpaid local league logistics to selling the darts website/platform as SaaS for bars, leagues, and tournament directors.
Context: League players expect venue-hosting money to flow like a nonprofit league, but BRDC is a one-person product/business. Current vnext work should become the reusable SaaS template, with Burning River Darts as proof-of-concept/tenant.
Pricing model: $49/month base subscription, plus $1 per player per event and $5 per player per league season. SMS/email messaging should be treated as an add-on or cost-controlled feature.
Potential first client: User believes there is an obvious first client; identify and capture details in follow-up.
Priority: High

### [2026-05-29] - Rookies Branded SaaS Demo
Create a Rookies Sports Bar & Grill branded version of vnext as the first SaaS demo/client pitch. Use the 2026 Triples League handoff as a smooth transition and value-add for Rookies.
Context: Rookies is the obvious first client because BRDC events/leagues already operate there, and the platform can be presented as a bar-owned/venue-branded darts hub rather than unpaid league overhead. Include both the 2026 Triples League handoff and the Wing It Wednesdays summer series as bundled proof/value for the demo.
Reference: https://www.rookiessportsbar-grill.com/
Priority: High

### [2026-05-29] - Backfill Wing It Wednesdays #1 Results
Backfill the first Wing It Wednesdays event into vnext/Rookies demo as a completed historical event.
Context: The May 27, 2026 event was run through Challonge while playoffs were happening. Results were captured from `brdc.challonge.com_9grlepld.png`: Matt & Chris won, Patrick & Brian runner-up, semifinals were Patrick & Brian over Eric & Tony 2-1 and Matt & Chris over Dom & Melissa 2-0, final Matt & Chris over Patrick & Brian 2-1.
Reference: `docs/wing-it-wednesdays-results.md`
Priority: High

### [2026-05-30] - VNext Matchmaker Runtime Parity
Bring the older matchmaker-specific tournament flows into the vnext/Rookies director experience: mingle period controls, Cupid Shuffle, breakup/rematch flow, nudges, no-show handling, and matchmaker board assignment/status.
Context: The Rookies runtime parity pass exposed the generic tournament director operations, but the specialized matchmaker/Cupid Shuffle workflows remain backend-capable and need a dedicated vnext surface before they should be sold as demo-ready.
Priority: Medium

### [2026-05-30] - Rookies vNext Visual Consistency Rule
Apply the homepage component hierarchy to every Rookies vNext page before adding page-specific styling. Page/card tabs use the strong segmented red-active strip; nested subtabs and dense data content categories use the quiet underline style; filters use compact low-weight controls; cards keep 8px radius, 18px gaps, Rookies red accents, and muted completed states.
Context: Trips page iteration showed that "similar" controls caused repeated nitpicking and drift from the locked homepage standard. This rule is now captured in `docs/home-vnext-design-rules.md` and `docs/home-vnext-rules.md`.
Priority: High

### [2026-05-30] - Match Hub VNext Post-Match Parity
Port the original match hub's post-match report depth into the Rookies/vNext match hub, especially Awards and Leaders, after the pre-match scorer-launch experience is locked.
Context: While polishing the Rookies match hub, the original site confirmed a useful split: scheduled matches use a pre-match hub, completed matches use a full report with Games, Performance, Awards, and Leaders. The vNext scheduled/pre-match hub is now closer, but Awards and Leaders still need a dedicated vNext report pass.
Priority: High

### [2026-05-31] - iPhone Scorer Usability Pass
Update the vNext X01 and Cricket scorers for reliable iPhone match-night use before relying on them for playoffs.
Context: While reviewing the playoff match hub, the scorer launch order was being fixed and the user noted the scorers themselves still need an iPhone-focused update before live use.
Notes from iPhone 16 Pro Max playoff test:
- Starter selector modal colors are hard to read.
- Outshot suggestion deforms the calculator layout.
- Running scores on the side are squished.
- Current thrower should be more obvious, but that can be later polish.
Priority: High

### [2026-05-31] - Rookies Setup/Create Page Parity
Assess the OG site's hand-curated game setup scorer, league create, and tournament create pages against the Rookies/vNext versions, then port the fuller configuration fields and clearer flows into the Rookies demo.
Context: The OG setup/create pages were manually curated and may be more complete than the Rookies versions. The Rookies SaaS demo needs those thorough options before it is demo-ready for Brian/Rookies.
Priority: High

### [2026-05-31] - Global Contact Center for Directors
Build the admin portal Contact action as a global communication launcher instead of a direct-message shortcut. It should let a director choose an audience, choose site message/text/email channels, compose once, preview recipients/cost risk, and send or draft from one modal/page.
Context: While reviewing the Rookies admin portal, the current Contact link to direct messages felt too narrow. The director needs a global contact surface for league players, event registrants, captains, staff, or custom recipients.
Update: Initial vNext contact center and `sendDirectorBroadcast` backend are wired. Remaining product work is broadcast history, delivery detail UI, resend failed, duplicate as new message, opt-in management, and tenant-level SMS/email cost controls.
Priority: High

### [2026-05-31] - Retire Standalone League Director Page
Fold league management into a director-only Manage tab on each league page, then retire or redirect the standalone `league-director-vnext.html` page after the in-page workflow is proven stable.
Context: While reviewing the Rookies League page, the separate league director page felt redundant beside the league hub. The first pass now links Admin Portal league Manage to `triples-vnext.html#manage`, but the old page remains as a fallback.
Priority: Medium

### [2026-05-31] - Rookies Knockout Bracket VNext Polish
Give the copied OG knockout bracket page a full Rookies/vNext visual and workflow pass after setup parity is stable.
Context: The Rookies scorer setup now wires knockout creation and launches a Rookies-hosted bracket page, but that bracket page is still mostly the original dark OG bracket with Rookies colors and vNext scorer links. It works as parity coverage, but should be brought up to the locked Rookies component standard before demoing as a polished SaaS feature.
Priority: Medium

### [2026-06-01] - Reconnect Quick Scorer and Event/Blind Draw Flows
Make it obvious from the Rookies scorer setup that quick knockout is only for casual bracket play, while blind draw, Wing It Wednesdays, weekly series, matchmaker, registration, check-in, and generated event brackets live in the event/tournament builder/runtime flow.
Context: After polishing scorer setup, the quick knockout toggle made it look like selecting knockout should generate a bracket immediately and raised concern that the older blind draw features were lost. The features are present across `create-tournament-vnext`, `wing-it-wednesdays-vnext`, tournament runtime/bracket pages, matchmaker pages/functions, and `scripts/wing-it-blind-draw.js`, but the product path is disconnected.
Priority: High

### [2026-05-31] - Rookies Demo First, BRDC VNext Second
Use the Rookies branded demo as the polished SaaS reference implementation first, then port the successful Rookies vNext patterns back into BRDC vNext for testing before eventually replacing the current BRDC main site.
Context: There is no immediate blind draw tonight, so event builder/runtime work should not be rushed around a live event. The goal is a complete, demo-ready Rookies product path, followed by BRDC vNext parity/testing, then main-site replacement when confirmed working.
Priority: High

### [2026-06-01] - Wing It Wednesdays Registration Voting
Add a voting step to Wing It Wednesdays registration so players can help choose the weekly concept, format, or side-game options when they sign up.
Context: Wing It Wednesdays is intentionally flexible: "we wing the concept each week." Letting registrants vote during signup makes that theme interactive and gives the director useful demand signals before locking the weekly format.
Priority: Medium

### [2026-06-01] - Remove Legacy PIN Assumptions
Audit and retire remaining `brdc_player_pin` / PIN-login assumptions from legacy pages, shared components, and scorer setup paths now that player PINs are no longer a live authentication model.
Context: The Rookies Alerts drawer still depended on `brdc_player_pin`; that path was corrected to use `brdc_session`, but repo search still shows legacy PIN references in older/non-vnext files and scorer setup.
Priority: High

### [2026-06-06] - Signed-out state inconsistency across OG vs vNext
When the Firebase auth session lapses, vNext pages (arena/profile, Firebase-auth-gated) correctly show signed-out states, but the OG dashboard + Home snapshot keep showing cached `brdc_session` identity ("Donnie Pagel"), so the user *looks* logged in on some pages and signed-out on others — confusing.
Also investigate WHY the Firebase session lapsed mid-use (token refresh / persistence). getAuth() uses default indexedDB persistence, so it shouldn't silently drop.
Context: surfaced during the Arena functional walkthrough 2026-06-06; the lapsed session made Arena/Profile read signed-out while OG dashboard showed authed.
Priority: Medium

### [2026-06-07] - vNext create-league writes client-side; edit is rule-blocked
create-league-vnext.js saves via direct client `setDoc(leagues/{slug}, {merge:true})`. OG canonically uses `callFunction('createLeague', data)` (cloud function). Result: CREATE works (rule `create: if hasValidData()`), but settings-mode EDIT = client update → `permission-denied` (`leagues` rule `update,delete: if false`, cloud-functions only). No `updateLeague` function exists.
Existing `createLeague` fn is thinner than the vNext form (cherry-picks fields, drops blackouts/tiebreaker-order/cork-options/image; random `.add()` id not slug) — so a plain rewire regresses.
FIX: build `saveLeague` cloud function (full vNext payload passthrough, create+update, director/owner-gated, slug id); wire create-league-vnext both modes to it. Live Triples league unaffected (function/admin-managed). 
Found via write-path testing 2026-06-07. Priority: Medium (affects new leagues created via vNext only).

### [2026-06-07] RESOLVED ↑ — saveLeague cloud function shipped
Built `exports.saveLeague` (functions/leagues/index.js) — Admin SDK, create+update, owner/director/master-admin gated on edit (403 otherwise), full vNext payload passthrough. Wired create-league-vnext.js submit (both modes) to `callFunction('saveLeague',{league_id,payload})`. Deployed (fn → brdc-v2, hosting → apex, create-league-vnext.js?v=4). Verified create+EDIT+payload-preservation end-to-end on device, test doc cleaned up. create-tournament was a FALSE ALARM (already uses createTournament/updateTournamentSettings functions; its setDoc writes go to permissive tournament_drafts/templates).

### [2026-06-07] - SECURITY: dart_trader_listings update rule too weak
firestore.rules ~line 500: `allow update: if hasValidData() && resource.data.seller_id == request.resource.data.seller_id`. This only checks the seller_id field is UNCHANGED — it does NOT verify the editor is the seller (no `request.auth.uid`/seller match). So any authenticated user can edit anyone else's listing (price, title, etc.) as long as they keep seller_id the same. Should be `request.auth != null && resource.data.seller_id == <caller player/uid>`. NOTE: rules changes are sensitive — needs review before deploy (confirm seller_id stores uid vs player-doc-id). Found via write-path sweep 2026-06-07. Priority: Medium-High (security).

### [2026-06-07] RESOLVED ↑ — dart_trader_listings update rule tightened
firestore.rules now gates listing edits on `get(players/$(seller_id)).data.firebase_uid == request.auth.uid` (+ seller_id immutable). Sellers always have firebase_uid (login links it on listing create). Deployed to brdc-v2 (rules compiled OK). Verified owner edit still works; non-owners now blocked. Test listing cleaned up.

### [2026-06-07] DECISIONS — Arena + Scorer theme (per Donnie)
- **Arena: stays DARK** — intentional "focused competition mode." No change.
- **Scorer: stays DARK with bright contrast on key elements.** Measured live scoring screen on device: scoreboard bg dark navy (15,23,43); score = GOLD (255,201,40) bright; score-input + names = light (255,250,242); keypad digits dark on light-cream keys — all readable. Only prior contrast bug (setup "501 SCORER" title dark-on-dark) already fixed v72 → pink. No further changes needed.
- NOTE: scorer-vnext.css is a half-applied LIGHT reskin (its bg overrides mostly don't win vs the page's dark theme; its text-color overrides mostly get re-overridden by gold/light). Net result reads correctly dark, but the CSS is messy — a future cleanup could delete the dead light-reskin rules. Not urgent.
- DEVICE QUIRK: `am start` on this phone keeps spawning a 2nd Chrome tab → CDP drives one tab, screencap shows the other. Measurements via CDP are reliable; scoring-screen screencaps are not. Use CDP color measurement, not screencap, for scorer verification.
