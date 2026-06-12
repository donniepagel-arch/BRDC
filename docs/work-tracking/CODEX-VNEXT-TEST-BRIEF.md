# Codex Task Brief — Complete vNext Test (functional + visual)

You are testing the **BRDC (Burning River Darts Club) vNext** web app end-to-end: every page,
every flow, functional correctness AND visual/design conformance. Produce one structured report.
This brief is self-contained — assume no prior context.

---

## 0. Environment & ground rules

- **Repo:** `C:\Users\gcfrp\projects\brdc-firebase` (work from here). Node + Playwright are installed.
- **Live site (what you test):** `https://burningriverdarts.com` — served by Firebase site
  `brdc-live-0428` (project `dashboard-ll`). This is PRODUCTION.
- **DO NOT deploy.** **DO NOT** run `firebase deploy`. You are testing, not shipping.
- **DO NOT corrupt prod data.** See §5 (write-path safety) — it is strict.
- **Fix-or-flag policy:** Fix only *trivial, unambiguous, isolated* bugs (e.g. a typo, a dead link,
  a stuck-skeleton empty-state). Anything design-opinion, cross-cutting, schema/rules, or risky →
  **flag in the report, do not change.** When you do fix, note it in the report; still do not deploy.
- **SPA gotcha:** a `200` on `/pages/<x>.html` can be the catch-all serving `index.html`. Verify
  real content (page `<title>` or a visible header), not just HTTP status.

---

## 1. THE SCREENSHOT METHODOLOGY (critical — read before any visual work)

Normal screenshot tools **time out** on these pages: the live authed pages hold open Firestore
websockets + presence heartbeats + a service worker, so they **never reach `networkidle`/`document_idle`**.
You MUST use this pattern (it's already proven in `scripts/qa/_oneshot-home.mjs`):

```js
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport:{width:390,height:1400}, isMobile:true, deviceScaleFactor:2 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});  // NOT networkidle
await p.waitForTimeout(8000);   // let JS render; bump to 12000 for triples/league pages (slow queries)
await p.screenshot({ path: OUT, fullPage: true });
await b.close();
```

- Capture at **mobile width 390** (primary form factor) AND spot-check **desktop 1280**.
- A fresh Playwright context is **signed-out** — it only shows login/empty/public states. That is
  fine for layout/console/link checks. For **authed** visual verification you need a logged-in
  session (see §4). You (the human running Codex) can also just review the signed-out captures plus
  the authed report notes.
- Read each PNG and assess it. Existing helper to copy/adapt: `scripts/qa/_oneshot-home.mjs`
  (env: `SHOT_URL`, `SHOT_OUT`, `SHOT_W`). The 30-page console/overflow/skeleton sweeper is
  `scripts/qa/_overnight-qa.mjs` → writes `reports/overnight-qa.json` — RUN THIS FIRST, it's the
  fastest triage.

---

## 2. The 30 vNext pages (test every one)

home · triples · leagues · league-team · match-hub · player-profile · events · tournament-view ·
tournament-register · tournament-runtime · create-league · create-tournament · league-import ·
arena · messages (Clubhouse) · members · scorer-setup · x01-scorer · league-cricket ·
dart-trader · dart-trader-create · dart-trader-listing · admin · director-home · league-director ·
captain-dashboard · contact-center · matchmaker-mingle · matchmaker-tv · wing-it-wednesdays
(all are `/pages/<name>-vnext.html`).

For EACH page, check:
- **Loads** with real content (not the SPA fallback); correct `<title>`.
- **No JS/page errors** in console (the expected signed-out `No auth token` / `NOT_SIGNED_IN` is
  noise, not a bug). Use `page.on('console')` + `page.on('pageerror')`.
- **No stuck skeletons** after load (loaders must resolve to content OR a proper empty state).
- **No horizontal overflow** (`scrollWidth > clientWidth`).
- **No broken internal links** (collect `a[href^="/pages/"]`, verify each target file exists in
  `public/pages/`).
- **Visual conformance** to the design standard (§3).

---

## 3. Visual / design standard (the "correct" look)

Full spec: `docs/work-tracking/VNEXT-DESIGN-STANDARD-2026-06-06.md`. Summary to check against:

- **Background (every page EXCEPT scorers & Arena):** warm cream gradient + a faint **diagonal
  hatch** texture + a pink glow top-left. The retired **olive parchment** (`#ece2cd/#e1d6bd/#d4c8ac`)
  must NOT appear anywhere. Flag any page still olive or missing the hatch.
- **Headline hero:** pink kicker (11–12px, 900, uppercase, `#ed3f91`) + big Bebas Neue headline.
- **Cards:** warm paper `#fffaf2`, radius 24px, **feathered shadow**
  (`0 1px 0 rgba(255,255,255,.7) inset, 0 2px 6px rgba(23,32,51,.06), 0 20px 46px rgba(23,32,51,.13)`).
  Every card's **title is a pink kicker INSIDE the card, first element, with a divider line beneath**.
- **One dark focal card** per page is allowed (e.g. Home's PLAYOFFS/match-night hero).
- **Bottom nav** present (Home·League·Play·Events·Clubhouse) with the gold dartboard Play button;
  only scorers go full-screen (nav suppressed).
- **INTENTIONALLY DARK (do NOT flag as inconsistent):** **Arena** (deliberate "focused competition
  mode") and the **scorers** (x01 + cricket). For the dark surfaces, instead check **CONTRAST**:
  the important stuff (scores, current player/turn, keypad, leg/set) must be BRIGHT and easily
  readable on dark. Flag any dark-on-dark / low-contrast important element. (Known issue area:
  `scorer-vnext.css` is a light reskin layered over the scorer's dark theme — watch for dark
  `var(--sv-ink)` text landing on the dark scorer surface, e.g. `.team-score`, `.points-cell`,
  `.modal-title`.)

---

## 4. Auth (to test the real league-player experience)

Most value is in the **authed** state. Account: `donniepagel@gmail.com` (Google sign-in). The human
running this can log in once in a persistent Chrome profile and point Playwright at it
(`chromium.launchPersistentContext(userDataDir, ...)`), OR drive a USB Android device via Chrome
remote-debugging — both are documented in `docs/work-tracking/ANDROID-DEVICE-TEST-2026-06-07.md`
(`adb forward tcp:9222 localabstract:chrome_devtools_remote`; helper `scripts/qa/droid-eval.mjs`
runs JS on the device tab via CDP). If you cannot get an authed session, do the full signed-out
pass and clearly mark which checks need auth.

Authed pages to confirm render real data: home (stats/playoff hero), triples (standings+bracket),
arena (challenges), messages (hero counts + lobby), player-profile (own profile via bare URL,
no `?id=`), match-hub (with a real `match_id`).

---

## 5. Write-path testing — STRICT SAFETY (prod data)

Test these flows but DO NOT damage prod:
- **create-league / create-tournament:** the canonical save path is the **`createLeague` cloud
  function** (mirror OG `create-league.html`), NOT a client `setDoc`. Verify the form validates +
  submits. If you actually create anything, name it **`ZZ TEST — delete me`** and list it in the
  report for cleanup. Prefer dry-run (stop at submit) if unsure.
- **contact-center / any "send" (email/broadcast/DM):** these message **REAL league members**.
  Test compose/preview/validation **up to** the send button — **DO NOT click send.** Report that
  the path is verified-not-fired.
- **scorer save → stats:** use a **CASUAL** game only (never a real league `match_id` — that writes
  standings). Verify the casual save→stats path.
- **dart-trader:** create/edit listings write to prod. A listing **update** rule was just tightened
  (only the owner — whose player doc carries the editor's `firebase_uid` — may edit). Verify a
  legit owner edit works and (if testable) a non-owner edit is denied. Use `ZZ TEST` listings.

---

## 6. Recently fixed — VERIFY these (don't re-report as new bugs)

- **Home perf:** optimistic localStorage cache → stats render ~0.36s (was ~11.5s). Also Profile,
  Triples, Clubhouse got the same cache. `getHomeBundle` cloud function + `minInstances:1` kill cold
  starts. Verify the app feels fast on a fresh open (and on repeat opens stats are instant).
- **"Missing X_id" graceful states** on league-team / match-hub / matchmaker-mingle / matchmaker-tv /
  tournament-register / tournament-view (open each with NO url param → should show a friendly
  "No … selected — …" message, not a raw error).
- **Profile bare URL** (no `?id=`) → resolves to the signed-in user's own profile.
- **Clubhouse "Fresh listings"** with 0 listings → shows empty state, not stuck skeletons.
- **Scorer casual-setup title** ("501 SCORER" / "CRICKET SCORER") → bright pink, readable on dark.
- **Whole-app warm theme + diagonal texture + feathered card shadows + pink-kicker card titles
  with dividers** (Home is the reference).

## 7. Known OPEN items (note status, don't "fix")

- **scorer-setup wizard** theme (currently a stepped Players→Game→Start wizard on a dark surface) —
  a dark-vs-light design decision is pending the owner. Just report how it reads.
- Possible remaining **dark-on-dark** spots inside the scorers beyond the title (see §3).

---

## 8. Report format (deliver this)

A single `docs/work-tracking/CODEX-VNEXT-TEST-RESULTS-<date>.md` with:
1. **Summary table:** page | functional (✅/⚠️/❌) | visual (✅/⚠️/❌) | notes.
2. **Findings list**, each: `[SEVERITY P0–P3] page :: category(functional|visual|perf|write-path) ::
   what :: evidence (screenshot path / console text / repro URL) :: suggested fix`.
3. **Screenshots** saved under `reports/codex-vnext/` (mobile 390 for every page; desktop spot-checks).
4. **Write-path results** (what was verified, what was fired vs not-fired, any `ZZ TEST` entities to clean up).
5. **Verification of §6 fixes** (each: still good? regressed?).
6. **Top 5 things to fix next**, prioritized.

Be skeptical and specific. "Looks fine" is not a finding; a screenshot + a sentence is. Prioritize
P0/P1 (broken/unusable) over P2/P3 (polish).
