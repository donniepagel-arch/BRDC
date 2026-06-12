# Real-Device (Android) Testing — 2026-06-07

Hands-on testing on the attached **Samsung Galaxy A12 (SM_A125U, R58T20EY46B)**, Android 10,
Chrome 148, over USB. This is the first real-device pass — it caught a bug desktop/Playwright
missed.

## Toolchain established (reusable)
- ADB at `C:\Users\gcfrp\AppData\Local\Android\Sdk\platform-tools\adb.exe` (runs from bash via
  full path; `exec-out screencap -p > file` writes valid PNGs — PowerShell `>` corrupts them).
- Chrome remote debugging over USB: `adb forward tcp:9222 localabstract:chrome_devtools_remote`.
- **`scripts/qa/droid-eval.mjs`** — runs a JS expression on the device's BRDC tab via CDP
  (Node 24 built-in WebSocket, no deps; auto-discovers the burningriverdarts target). Put the
  expression in `scripts/qa/_expr.js` and run `node scripts/qa/droid-eval.mjs`.
- **`scripts/qa/droid-tap.mjs`** — CDP input driver (kept for future use).
- Screencap: `adb exec-out screencap -p > reports/droid-*.png`, then Read the PNG.
- Close stray tabs: `curl http://localhost:9222/json/close/<id>`.

## 🔴 Found + fixed + verified (deployed SW v72)
**Casual scorer "501 SCORER" / "CRICKET SCORER" title was invisible (dark-on-dark).**
- `scorer-vnext.css` set `.setup-title` to `var(--sv-ink)` = `#172033` (dark) via a grouped rule;
  on the dark casual-setup screen that's ~1.1:1 contrast — effectively unreadable.
- The *scoring* screen is fine (its `.game-title`/`.thrower-name` get re-lightened to
  `rgb(255,250,242)` — confirmed by measurement), so this was isolated to the setup title.
- Fix: `.scorer-vnext-page .setup-title { color:#ff469a !important; ... }` (restores the intended
  pink). Verified on device — title now `rgb(255,70,154)`, clearly readable. Affects **both**
  x01 + cricket casual setup (shared CSS). `scorer-vnext.css?v=2`.
- Why it matters: the casual scorer runs on phones at the venue — this is a high-touch surface.

## ✅ Verified good on real hardware (signed-out)
- **Rendering**: Home, Triples, Events, Scorer-setup wizard all render correctly — warm theme +
  diagonal hatch, snapshot card, bottom nav, headlines. Touch targets on the scorer keypad are
  ~56×51 CSS px (above the 44px min).
- **Public data loads signed-out**: Triples standings (11 rows) + playoff bracket populate
  (~10s for the bracket query on mobile — see perf note).
- **Scorer scoring logic works on device**: drove a 501 leg via the device DOM — scores +
  averages computed correctly (180/180/100 → 41, AVG 153.3).
- **Scoring screen readable**: game title + thrower names are light-on-dark (good dark theme).

## 🟡 Notes / for your call
- **Device is NOT logged into BRDC** (signed-out). The full authed *league player* experience
  (your dashboard data, match cards, challenges, write paths) couldn't be tested. **To do a deep
  authed device pass, log the device into BRDC** (Google sign-in) when you're back and I can drive
  the real authed flows on hardware. I did not attempt the OAuth login myself (credentials are
  yours).
- **Perf note**: the Triples playoff-bracket query takes ~10s to render on the A12 (mid-range
  device). Worth a look at query size / loading skeleton so it doesn't read as "stuck."
- **`am start` opens a new Chrome tab each call** — caused tab-management churn during testing.
  Not a product issue; just a testing-harness note (close stray tabs via `/json/close`).

## Suggested next (device)
1. You log the device into BRDC → I run the deep **authed** real-device pass (the core value).
2. Re-check the casual scorer setup on cricket visually (fix is shared, should be done).
3. Real touch-gesture tests (swipes, the scorer keypad rapid entry) once authed flows are covered.

Net overnight (device): toolchain built + 1 real, venue-relevant bug fixed and shipped + a clean
real-device baseline for the signed-out surfaces.

---

## UPDATE — Deep AUTHED pass (device logged in as donniepagel@gmail.com)

Ran the full authed league-player experience on the real device. **Everything works.**

| Surface | Result |
|---------|--------|
| **Home** | ✅ "Hey Donnie", real stats (52.6 / 2.48 / #6 / 1 challenge), dark PLAYOFFS hero card (pink kicker + divider) renders great |
| **Arena** | ✅ Challenges populate — Matt Pagel challenge shows **"Accepted!"**; lobby + in-person + send-challenge all render |
| **Clubhouse** | ✅ "Signed in as Donnie Pagel", stats 10/1/0/51, no errors |
| **Profile** | ✅ Resolves to own profile (Donnie Pagel, Level A, Captain) with full stats |
| **Triples** | ✅ (earlier) standings + playoff bracket populate |

### Overnight fixes confirmed working on real device (authed)
- **Fresh-listings skeleton fix** (v68): `freshListingsStuck:false` — empty state shows, no stuck loaders.
- **Profile bare-URL fix**: opening Profile with no `?id=` resolves to the signed-in user's own profile.
- **Scorer title fix** (v72): "501 SCORER" readable pink on dark.

### Observations / for your call
- **Mobile load perf**: authed Home stats took ~14s to populate on the A12 (dashes show meanwhile);
  Triples bracket ~10s. Mid-range device + multiple sequential queries. Consider skeleton loaders
  or query batching so it doesn't read as "stuck/empty" on slower phones. (Perf, not a bug.)
- **Arena uses a dark theme** while the rest of the app is warm-light. Likely an intentional
  "competitive floor" gaming aesthetic — confirm it's intended vs. should match the standard.

### Verdict
The vNext app — signed-out AND authed — runs correctly on real Android hardware. Core flows
(dashboard, league, arena/challenges, clubhouse, profile, casual scorer) all functional and
readable. The only fix needed this session (scorer title) is shipped. Remaining items are a perf
polish and one theme-direction question (Arena) for you.
