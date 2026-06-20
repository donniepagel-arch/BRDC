# BRDC Development Rules

> **Lean core.** Full rule bodies (data model, UI layouts, import, stat formulas) live in
> [`docs/CLAUDE-RULES-REFERENCE.md`](docs/CLAUDE-RULES-REFERENCE.md). The index at the bottom says which rule to open when.

---

## 🚨 WORKING DIRECTORY
The real working copy is **`E:\projects\brdc-firebase`** (holds `firebase.json` + `.git`; all deploys run from here).
The old `C:\Users\gcfrp\projects\brdc-firebase` / `C:\Users\gcfrp\brdc-firebase` paths **do not exist** — never use them.

## 🚀 DEPLOY (RULE 0 — the user never tests locally; always deploy frontend changes)
**Live site = `https://burningriverdarts.com`** → Firebase site `brdc-live-0428` in project `dashboard-ll`.
```bash
# Frontend → apex (the ONLY command that reaches burningriverdarts.com):
firebase deploy --only hosting --config firebase.current-apex-hosting.json --project dashboard-ll
# Backend:
firebase deploy --only functions   # (functions/Firestore live in project brdc-v2)
```
- A bare `firebase deploy --only hosting` hits the WRONG site — always use the apex config above.
- After a frontend change, **bump `public/sw.js` CACHE_VERSION** or the service worker serves stale assets.
- A `200` on a missing `/pages/*.html` is the SPA catch-all serving index.html — verify real content (title / `?v=` tag), not just status.
- OAuth only works on authorized domains (`burningriverdarts.com` yes; preview `*.web.app` no).

**Domain → site → project → config:**
| Domain | Site | Project | Config |
|---|---|---|---|
| **burningriverdarts.com** (live) | `brdc-live-0428` | `dashboard-ll` | `firebase.current-apex-hosting.json` |
| brdc-v2.web.app | `brdc-v2` | `brdc-v2` | `firebase.brdc-v2-production-hosting.json` |
| fortheloveofdarts.com (Rookies demo) | `fortheloveofdarts` | `fortheloveofdarts` | `firebase.fortheloveofdarts-project-hosting.json` |

## 🧪 TEST DATA (RULE 13 — use Pagel v Pagel Week 1)
| Item | ID |
|---|---|
| League (2026 Triples) | `aOq4Y0ETxPZ66tM1uUtP` |
| Match (Pagel v Pagel W1) | `sgmoL4GyVUYP67aOS7wm` |
| Home team (M. Pagel) | `mgR4e3zldLsM9tAnXmK8` |
| Away team (D. Pagel) | `U5ZEAT55xiNM9Otarafx` |

---

## CORE DATA RULES (the ones that bite — full detail in the reference doc)

- **IDs, never names** (RULE 1). Look data up by document ID. Names ("Jenn M" vs "Jennifer Malek") are display-only and inconsistent. Never derive identity from the `games[]` array (it stores names).
- **One stats source** (RULE 2): `leagues/{leagueId}/stats/{playerId}`. No fallback chains. `aggregated_stats` is dead.
- **Use `stats-helpers.js`** (`get3DA()`, `getMPR()`) — they handle legacy field names. (RULE 3)
- **Missing data → placeholder**, don't be clever: `'-'` for stats, `'Unknown'` for names. Log, don't break the UI. (RULE 5)
- **Two player collections**: `/players/{id}` (global: pin/email/lifetime) vs `/leagues/{id}/players/{id}` (league: team_id/level/position). Same id, different data. (RULE 12)
- **team_id lives on the player**, not player_ids on the team — get a roster by filtering players where `team_id === teamId`. (RULE 4)
- **Dates**: always `match_date`; parse `ts?.toDate?.() ?? new Date(ts)`. (RULE 6)

**Firestore map:** `/players/{id}` · `/leagues/{id}/{teams,players,matches,stats,registrations}` · `/tournaments/{id}/{players,matches}`. ⭐ source of truth for stats = `leagues/{id}/stats/{playerId}`. (RULE 12)

**Standings order** (Triples): match wins → set wins → leg wins → head-to-head. Display `(15)7-2(8)` = 7 sets/15 legs vs 2 sets/8 legs. (RULE 3)

---

## HOW I WORK HERE

- **Orchestrate, don't grind**: break big work into parallel sub-agent tasks (Task tool) when it helps; do small/targeted edits directly. (RULE #1)
- **Capture ideas immediately**: anything discussed-but-not-built → append to `docs/work-tracking/IDEAS-BACKLOG.md` (dated, with context + priority). Conversation memory is volatile.
- **Session start**: skim recent `docs/work-tracking/SESSION-*.md` + `IDEAS-BACKLOG.md`; surface pending items.

---

## 📖 DETAILED RULES INDEX → [`docs/CLAUDE-RULES-REFERENCE.md`](docs/CLAUDE-RULES-REFERENCE.md)
Open the reference doc for the full body of any of these:

| Rule | Covers — read it when you're… |
|---|---|
| 1–7 | IDs/names, one-stats-source, **canonical field names** (matches/players/teams/stats tables), team-player queries, missing-data, dates, pre-code checklist |
| 8 | Match-card border colors per event type |
| 9 | **Dashboard match-card layout** (7-col grid, badges, roster, footer) — touching dashboard schedule cards |
| 10 | **League schedule card** (league-view.html, `loadLeagueMatchCard`) |
| 11 | Login page styling (the dashboard.html standard) |
| 12 | **Firestore data map** (full collection tree, load patterns, gotchas) |
| 13 | Test/reference IDs + URLs (also summarized above) |
| 14 | Match-hub design (4 tabs, header metadata) |
| 15 | **Match import system** (`scripts/import-match-from-rtf.js`, `temp/parse-rtf.js`, import data shape) |
| 16 | Stat calc — **checkout_darts** (correct 3DA), notable-throw categories |
| 17 | **Sets vs legs hierarchy** — grouping `games[]` by set for match-hub display |
| 18 | Checkout / double-in **categories** (60-99/100-139/140-160/161+) + tracking |
| 19 | Cricket **closeout categories** (5M–9M) |
| 20 | Leg-card display elements (cork badge, ★OUT/★CLOSED, Left:) |
| 21 | create-league field decisions (cork rules, roster, fields to add/remove) |
| 22 | Game-options consistency across create-league/tournament/scorer |
| 23 | **onclick `event` shadowing gotcha** — debugging `X.stopPropagation is not a function` |
| 24 | DartConnect RTF parsing (home/away varies, TEAM_ROSTERS, 9-set triples format) |
