# BRDC vNext — Test Plan

Date: 2026-06-05
Live site: https://burningriverdarts.com
Scope: the full vNext app after the nav redesign (5-tab nav, Clubhouse, Arena), the feature batch, the scorers, the create/manage flows, and the email/OAuth (no-PIN) auth.

## How to use this
- **Mark each:** ✅ pass · ⚠️ issue (note it) · ⛔ blocked · ⏭️ skipped.
- **Devices:** test on **iPhone Safari**, **Android Chrome**, and **desktop** at minimum. The nav switches at 860px (bottom bar below, top bar above).
- **Accounts/roles:** ideally test as **(a) a plain player**, **(b) a captain**, **(c) a director/admin** (Donnie). Role changes what's visible (Manage, team tools, etc.).
- **Stale screen?** Pull-to-refresh / hard-reload — the service worker can serve a cached copy.
- **Reference data:** League `aOq4Y0ETxPZ66tM1uUtP` (2026 Triples) · Match `sgmoL4GyVUYP67aOS7wm` (Pagel v Pagel) · your account = admin/director.
- ⚠️ **Write-safety:** sections marked **[WRITE]** create/send real data. Go small (a throwaway test league/event, a 1-person audience) and don't blast the whole roster.

---

## 0. Smoke test (~5 min — "does it basically work")
- [ ] Open `burningriverdarts.com` signed out → you get a login gate, not a broken page.
- [ ] Sign in with **email + password** → lands logged in.
- [ ] Sign out, sign in with **Google** → lands logged in.
- [ ] All 5 tabs (Home/League/Play/Events/Clubhouse) open without a blank screen or console crash.
- [ ] No PIN is ever requested anywhere.

---

## 1. Navigation (the redesign)
- [ ] **Mobile:** bottom tab bar with 5 slots; **Play** is the raised center button; compact top header with title + search/bell/avatar.
- [ ] **Desktop (>860px):** top bar with the 5 tabs + utility on the right; **no left sidebar** anywhere.
- [ ] Each tab highlights as **active** on its own pages (e.g. open a team page → League stays active; open the cricket scorer → it's full-screen, no nav).
- [ ] **Avatar menu** opens/closes (tap avatar; tap outside or Esc to close): Profile, Settings, Log out.
- [ ] **Manage** section in the avatar menu: **visible for director/admin**, **absent for a plain player**. Admin sees Site admin; non-admin director does not.
- [ ] **Scorers full-screen:** x01 + cricket scorers show **no nav bars**, only their own back/exit button.
- [ ] Rotate phone / resize desktop window across 860px → nav swaps cleanly, no doubled bars, no leftover blank strip.

---

## 2. Auth — email/OAuth only (PINs retired)
- [ ] Email login works; Google login works; logout returns to a signed-out state.
- [ ] **No PIN entry** appears on any page (scorer setup, registration, director login, etc.).
- [ ] **Role gating:** plain player → no Manage, no director pages. Director → Manage minus Site admin. Admin/owner → full Manage incl. Site admin.
- [ ] On the OG pages that still exist (game-setup, event-view, league registration), the **"Sign in with Email/Google"** option works alongside any legacy field.

---

## 3. Home
- [ ] Loads your dashboard: greeting, your stats (3DA/MPR), your next match (if any), standings/recognition.
- [ ] "Online matches" widget loads with **no console index error** (that was fixed).
- [ ] Tapping your next match / a result drills into the right place (match hub / league).

---

## 4. League → My Leagues → league hub
- [ ] **My Leagues** shows **Current** (2026 Triples League — your team + Captain/role badge), **Past** (if any), **Open to join** (if any), or an **empty state** if you're in none.
- [ ] Tap your league card → **league hub** loads.
- [ ] Hub sub-tabs all work: **Standings** (regular + playoff split), **Schedule** (weeks, match cards), **Stats** (Players/Teams × A/B/C × Performance/Awards/Leaderboard × 01/**Cricket** — confirm cricket **High Marks** now shows real 9M/8M/7M/6M/5M values, not dashes), **Teams**, **Fill-ins**, **Chat**, **Manage** (director-gated).
- [ ] Tap a team → team page; tap a match → match hub (with full report tabs for completed matches).

---

## 5. Play → Arena
- [ ] **Your league match** card appears if you have one scheduled (one tap → its scorer); hidden if not.
- [ ] **Score a game here** → opens scorer setup.
- [ ] **Online now** — shows who's online (or "no one online" empty state).
- [ ] **Challenges** — your sent/received challenges list. **[WRITE]** Issue a challenge to one player (online or offline) → confirm an **offline** player gets it as a message/notification they can accept later. Don't spam.
- [ ] **Mini-tournaments** — loads (empty state OK if none). *(Was index-building; should be clean now.)*
- [ ] **Watch live** — loads (empty state OK if none). *(Same — index.)*
- [ ] Quick-match / Host a board — note current behavior (Host currently routes to scorer setup; flagged as in-flight).

---

## 6. Events
- [ ] Events index loads real events (league nights + tournaments + Wing It).
- [ ] Open a tournament → tournament view (bracket/teams/info); register entry point present.
- [ ] Wing It Wednesdays surfaces as an event.

---

## 7. Clubhouse (talk & trade)
- [ ] Title is **Clubhouse**; sub-nav = **Lobby / Chat / Trade / Members** (no Challenges/Online — those moved to Arena).
- [ ] **Lobby** is the default landing (who's here / banter / fresh listings / activity), not a DM list.
- [ ] **Chat** — rooms work (Direct / League / Team / Events); open a thread, see history. **[WRITE]** send one test message.
- [ ] **Trade** — listings grid + category filters; "Create listing" → the create page. **[WRITE]** optionally create one test listing.
- [ ] **Members** — people directory (51 members) with real stats; tap a person → profile / message / challenge actions.

---

## 8. Scorers — the rule matrix ⭐ (the real coverage gap)
Launch from scorer-setup (or a league match). For each, play enough to verify the **rule**, then check the result. **[WRITE]** only when you intend to save a real result; otherwise just verify behavior and exit without saving.

**X01 — game types:**
- [ ] **501**, **301**, **701** each start at the right score.
- [ ] **Custom X01** (e.g. 401) — accepts the custom value and starts there.

**X01 — in/out rules (the important ones):**
- [ ] **Double-out:** finishing on a single **busts** (doesn't win); finishing on a double **wins**.
- [ ] **Master-out:** finishing on a **double OR triple** both win.
- [ ] **Straight/Free-out:** any finish wins.
- [ ] **Double-in:** scoring **doesn't start** until a double opens; pre-double throws score 0.
- [ ] **Bust** handling: overscoring past 0 (or leaving 1 on double-out) busts, turn passes, score restored.
- [ ] **Undo** reverts the last entry correctly.

**X01 — formats & flow:**
- [ ] **Mixed format** (501/C/CH legs): each leg loads as its configured game type in sequence.
- [ ] **Corks Choice (CH):** cork winner is prompted to choose the game; chosen game starts.
- [ ] **Doubles** (2v2): turn order alternates correctly between partners.
- [ ] **Flip / swap-start** function works (the new in-scorer flip).
- [ ] Leg/set progression: legs counter increments, set advances, match completes at the right count.
- [ ] iPhone feel: starter-modal readable, outshot hint doesn't deform the numpad, running scores legible, current thrower obvious.

**Cricket:**
- [ ] Marks register for 15–20 + bull (singles=1, doubles=2, triples=3); numbers **close at 3 marks**.
- [ ] Points score only when you're open and opponent is open; **cork** flow (pick winner → start) works; **closeout** marks highlight.
- [ ] MPR updates; undo works.

**Save → report → stats (end-to-end) [WRITE]:**
- [ ] Finish a leg/match and **save** → returns to match hub, the result shows, and player **stats update** correctly (3DA/MPR/legs). Use a casual/test context if you don't want to touch a real league match.

---

## 9. Create flows (director) [WRITE — use throwaway data]
- [ ] **Create league:** owner = your email (no PIN); tiebreaker up/down ordering; blackout dates via the date-picker chips; image 5MB guard + preview; submit → league created with correct fields.
- [ ] **Create tournament:** **Triples (3v3)** selectable; **Custom X01 any value**; **starter config** (flip/home/league-dependent + default starter); image guard; bracket formats incl. **double elimination**; submit → event created; matchmaker path still routes correctly.
- [ ] **Draft save** + **Template save** (per user); confirm a saved template is retrievable, and that as owner you can see saved templates (private, not public).

---

## 10. Director / operator flows [WRITE — careful]
- [ ] **Tournament runtime:** generate bracket, check-in, board assign, start/confirm a result, send a reminder (small audience).
- [ ] **Contact center:** load recipients; **send a broadcast to a 1-person audience first** (it hits real SMS/email) before any wider send.
- [ ] **League import:** paste a DartConnect recap → parse (dry-run) → import → stats recalc; verify set/leg hierarchy.
- [ ] **Recompute stats:** now requires director/admin auth (an unauthenticated call is rejected) — confirm it still works for you and the numbers are right.

---

## 11. End-to-end journeys (the real test)
- [ ] **New player:** sign up/login → Home empty-ish → League shows "open to join" → register → appears in a league.
- [ ] **League night:** Home "next match" → match hub → launch scorer → score X01 + cricket sets → save → results + stats land in the league hub.
- [ ] **Social loop:** Clubhouse → Members → tap a player → challenge → they get it → (later) accept in Arena.
- [ ] **Director night:** Manage → create event → runtime → run check-in/board assign → results flow back.

---

## 12. Device / responsive matrix
- [ ] iPhone Safari — nav, scorer, Clubhouse, Arena all usable one-handed; no horizontal scroll.
- [ ] Android Chrome — same.
- [ ] Desktop — top-bar nav; no left sidebar; pages use the width well.
- [ ] No horizontal overflow on any page at phone width.

---

## Known in-flight (do NOT file these as bugs)
- **Arena → Mini-tournaments / Watch-live**: were index-building; show "Could not load…" until the Firestore index finishes, then clean empty states.
- **Arena → Host a board**: currently routes to scorer setup (standalone open-hosting not built yet).
- **Settings** (avatar menu): stub — no settings page yet.
- **Spectator mode**: depends on the scorer's `?spectate` handling — partial.
- **OG pages** (game-setup, event-view, league-view, etc.) still exist and still work; the vNext flow now points at vNext equivalents, but the OG pages are reachable directly.

---

## Bug report format (so fixes are fast)
For each issue: **Page/URL · device · what you did · what happened · what you expected · screenshot + any console error.**
