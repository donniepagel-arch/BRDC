# Overnight QA Sweep + Fixes — 2026-06-06 → 07

Ran an automated QA pass over **all 30 vNext pages** (Playwright: console/page errors,
horizontal overflow, stuck skeletons, broken nav), fixed the clear bugs, and verified the
scorer hand-off. Raw data: `reports/overnight-qa.json`. All fixes deployed live (SW **v71**).

## ✅ Fixed + deployed + verified

### 1. "Missing X_id" dead-ends → graceful states (6 pages)
Same bug class you caught on Profile: loaded without their URL param, these pages threw a raw
`Missing <x>_id` that rendered verbatim in the UI. Now they show a human, actionable message.
Verified live on all 6:
| Page | Before | After |
|------|--------|-------|
| league-team | `Missing team_id` | "No team selected — open a team from your league standings." |
| match-hub | `Missing match_id` | "No match selected — open a match from the schedule." |
| matchmaker-mingle | `Missing tournament_id` | "No tournament selected — pick one from Events." |
| matchmaker-tv | `Missing tournament_id` | "No tournament selected — pick one from Events." |
| tournament-register | `Missing tournament_id` | "No tournament selected — pick one from Events." |
| tournament-view | `Missing tournament_id` | "No tournament selected — pick one from Events." |

(Low-risk — only touches the no-param error path, which was already broken. JS versions bumped,
syntax-checked. A nicer version would add a clickable link in each state — easy follow-up.)

### 2. Scorer Start → scorer hand-off (verified, was unflagged)
Drove the wizard to Start in Playwright: it navigated to `x01-scorer-vnext.html` with the
players in the URL and landed on the scorer showing **"DONNIE 501 vs MATT 501, SET 1 LEG 1,
SI/DO"**. Players + game type carry through correctly. ✔

## 🟡 Found — logged for your call (not fixed overnight)

### A. Stuck skeletons when signed-out (6 pages)
`captain-dashboard` (6), `messages`/Clubhouse (14), `director-home` (2), `contact-center` (1),
`league-director` (1), `tournament-runtime` (1) leave skeleton loaders up when **signed-out**.
These are mostly auth-gated admin pages — signed-out they should show a **"sign in" state**
(like Profile now does) instead of perpetual skeletons. Left for you because the proper fix
needs authed verification per page (didn't want to touch auth flows I can't fully test while
you're asleep). Real signed-in users are unaffected; this is signed-out polish.

### B. home-vnext one-off 404 — did NOT reproduce
The first sweep logged a single 404 on home-vnext; a focused network capture afterward showed
**zero** failures. Likely a transient/data-dependent miss. Flagging only; nothing to chase yet.

## 🟢 Clean across all 30 pages
- No JS crashes / page errors (besides the expected signed-out `No auth token` noise)
- No horizontal overflow
- No broken navigation / no failed page loads
- Nav renders correctly everywhere

## Scorer-setup (deliberately deferred per plan)
As agreed, I did **not** make the design-opinion changes overnight (theme-warming, header slim,
Step-2 density). Those are queued in `ASSESSMENT-scorer-setup-2026-06-06.md` for when you can
react. The wizard structure + the [hidden]/disclosure fixes from last night are live and solid.

## Suggested order when you're back
1. Decide on scorer-setup polish (warm theme + slim header + Step-2 trim) — biggest visible win.
2. Signed-out "sign in" states for the 6 skeleton pages (quick once we test authed together).
3. Add clickable links to the 6 new graceful states.
4. Resume the authed functional walkthrough (remaining: create-league/tournament submit, contact
   center send, league-import, write-path scorer save→stats).

Net: 6 real bugs fixed + deployed, 1 flow verified, full-app QA baseline captured. Nothing risky
shipped. 🌙
