# BRDC HTML Pages Cleanup Report
**Generated:** January 27, 2026
**Total Pages:** 69
**Total Lines:** ~95,000

---

## Executive Summary

The BRDC codebase has accumulated duplicate and overlapping pages over time. This report identifies consolidation opportunities while preserving all distinct functionality.

---

## 1. ALREADY CONVERTED TO REDIRECTS (Completed)

| Page | Now Redirects To | Status |
|------|------------------|--------|
| `pages/league-501.html` | `pages/x01-scorer.html` | Done |
| `pages/cricket.html` | `pages/league-cricket.html` | Done |
| `pages/match-night.html` | `pages/match-hub.html` | Done |
| `scorers/x01.html` | `pages/x01-scorer.html` | Done |
| `scorers/cricket.html` | `pages/league-cricket.html` | Done |
| `pages/x01.html` | `pages/x01-scorer.html` | Done |
| `bracket.html` (root) | `pages/tournament-bracket.html` | Done |
| `pages/match-report.html` | `pages/match-hub.html` | Done (merged features) |
| `pages/schedule.html` | `pages/events-hub.html?filter=my` | Done (Events Hub) |
| `pages/browse-events.html` | `pages/events-hub.html?filter=all` | Done (Events Hub) |
| `pages/community-events.html` | `pages/events-hub.html?filter=social` | Done (Events Hub) |

---

## 2. REGISTRATION PAGES - ALL SERVE DIFFERENT PURPOSES

**DO NOT CONSOLIDATE** - Each serves a distinct function:

| Page | Lines | Purpose | Keep? |
|------|-------|---------|-------|
| `register.html` | 445 | **New Player Registration** - Create BRDC site account/profile | **KEEP** |
| `signup.html` | 672 | **Join BRDC Club** - Sign up as club member (more detailed, has PWA support) | **KEEP** |
| `player-registration.html` | 407 | **Event/Tournament Registration** - Register for specific event with PayPal payment | **KEEP** |

**Analysis:**
- `register.html` - Basic site account creation
- `signup.html` - Full club membership signup with branding ("Cleveland's home for competitive darts")
- `player-registration.html` - Event-specific registration with `?event_id=X&tournament_id=Y` params, includes PayPal SDK for entry fees

---

## 3. SCORER PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `x01-scorer.html` | 5,207 | **PRIMARY** X01/501 scorer with impossible score validation | **KEEP** |
| `league-cricket.html` | 3,699 | **PRIMARY** Cricket scorer | **KEEP** |
| `x01.html` | 20 | Redirect stub | **DONE** → x01-scorer.html |
| `scorer-hub.html` | 955 | Scorer entry point/launcher | **KEEP** |
| `game-setup.html` | 2,780 | Pre-game configuration | **KEEP** |

**Action Item:** Convert `x01.html` to redirect to `x01-scorer.html`

---

## 4. MATCH MANAGEMENT PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `match-hub.html` | ~4,800 | **PRIMARY** Match reports, game launcher, full match flow + H2H + print | **KEEP** |
| `match-report.html` | 20 | Redirect stub | **DONE** → match-hub.html |
| `match-confirm.html` | 792 | Pre-game player confirmation | **KEEP** |
| `match-transition.html` | 783 | Between-game transition | **KEEP** |
| `stat-verification.html` | 957 | Verify/edit match stats | **KEEP** |
| `live-match.html` | 1,810 | Live match viewing | **KEEP** |

**MERGED (Jan 27, 2026):** match-report.html features merged into match-hub.html:
- H2H tab with player comparison and First 9 average
- Print/Share button with optimized print stylesheet
- Player filtering across all tabs
- First 9 average tracking in Performance tab

match-hub.html is now the single source of truth for match reports.

---

## 5. TOURNAMENT & EVENT PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `events-hub.html` | ~2,500 | **PRIMARY** Unified events page with filters, views | **KEEP** (NEW) |
| `schedule.html` | 22 | Redirect stub | **DONE** → events-hub.html?filter=my |
| `browse-events.html` | 22 | Redirect stub | **DONE** → events-hub.html?filter=all |
| `community-events.html` | 22 | Redirect stub | **DONE** → events-hub.html?filter=social |
| `event-view.html` | 858 | Single event detail | **KEEP** |
| `tournaments.html` | 322 | Tournament list | **KEEP** |
| `tournament-view.html` | 936 | Single tournament detail | **KEEP** |
| `tournament-bracket.html` | 1,186 | Tournament dashboard (events, leaderboard, players) | **KEEP** |
| `bracket.html` (pages) | 331 | Actual bracket visualization | **KEEP** |
| `bracket.html` (root) | 20 | Redirect stub | **DONE** → tournament-bracket.html |
| `knockout.html` | 1,281 | Knockout bracket games | **KEEP** - casual/quick use |
| `mini-tournament.html` | 1,127 | Quick mini-tournament | **KEEP** - casual/quick use |
| `create-tournament.html` | 2,873 | Tournament creation | **KEEP** |

**CONSOLIDATED (Jan 27, 2026):** Events Hub unifies 3 pages:
- `schedule.html` (1,302 lines) - Personal match calendar
- `browse-events.html` (497 lines) - Official leagues/tournaments browser
- `community-events.html` (1,641 lines) - Community events with map

**events-hub.html features:**
- Filter pills: My Events | Tournaments | Leagues | Social | All
- Dart type filter: Steel | Soft | All
- View modes: List | Calendar | Map
- Add Event button (community submissions)
- Context-aware cards (league matches show opponent stats, tournaments show entry fee/spots)
- Mobile-first, touch-optimized design
- Lazy-loaded Leaflet map

**Lines saved:** ~940 (3,440 original → 2,500 unified)

**ASSESSED - bracket.html vs tournament-bracket.html:** DIFFERENT functions!
- `bracket.html` → actual match bracket visualization (visual column layout)
- `tournament-bracket.html` → tournament dashboard with Events/Leaderboard/Players tabs (no bracket display)
- Note: tournament-bracket.html is misleadingly named - it's really a tournament dashboard

---

## 6. LEAGUE & TEAM PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `league-view.html` | 5,041 | **PRIMARY** League overview | **KEEP** |
| `league-director.html` | 5,804 | League admin (teams, schedules, standings) | **KEEP** |
| `leagues.html` | 292 | League list/browser | **KEEP** |
| `league-team.html` | 747 | Simpler team view | **CONVERT TO REDIRECT** → team-profile.html |
| `league-scoreboard.html` | 448 | League standings display | **KEEP** |
| `create-league.html` | 2,290 | League creation | **KEEP** |
| `team-profile.html` | 1,549 | Full team profile with standings, level filtering, leaderboards | **KEEP** |
| `captain-dashboard.html` | 1,699 | Captain management | **KEEP** |
| `director-dashboard.html` | 1,917 | Tournament director (brackets, events) | **KEEP** |
| `draft-room.html` | 1,570 | Team draft | **KEEP** |

**ASSESSED - league-team vs team-profile:** team-profile is SUPERSET
- `league-team.html` has: Schedule, Roster, Stats (basic)
- `team-profile.html` has: Roster, Stats, Matches, Standings + level filtering + leaderboards
- Every feature in league-team exists in team-profile in better form
- **RECOMMENDATION:** Convert league-team.html to redirect

**ASSESSED - director-dashboard vs league-director:** DIFFERENT data models!
- `director-dashboard.html` → Tournament director (brackets, events, eliminations)
- `league-director.html` → League director (teams, weekly schedules, standings)
- Uses different Firestore collections (`tournaments` vs `leagues`)
- Both needed for their respective competition types

---

## 7. MATCHMAKER PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `matchmaker-view.html` | 962 | Matchmaker main view | **KEEP** |
| `matchmaker-register.html` | 1,033 | Matchmaker registration | **KEEP** |
| `matchmaker-director.html` | 2,713 | Matchmaker admin | **KEEP** |
| `matchmaker-bracket.html` | 864 | Matchmaker bracket | **KEEP** |
| `matchmaker-mingle.html` | 870 | Social/mingle feature | **KEEP** |
| `matchmaker-tv.html` | 1,107 | TV display | **KEEP** |

**Note:** Matchmaker is a distinct feature set - all pages needed.

---

## 8. MESSAGING PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `messages.html` | 2,027 | Message inbox | **KEEP** |
| `conversation.html` | 690 | Individual conversation | **KEEP** |
| `chat-room.html` | 2,558 | Group chat | **KEEP** |
| `friends.html` | 1,240 | Friends list | **KEEP** |

---

## 9. STREAMING & LIVE PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `live-scoreboard.html` | 1,568 | Live score display | **KEEP** |
| `stream-director.html` | 1,077 | Stream control | **KEEP** |
| `stream-camera.html` | 548 | Camera feed | **KEEP** |

---

## 10. ADMIN & UTILITY PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `admin.html` | 2,479 | Site admin | **KEEP** |
| `bot-management.html` | 745 | AI bot config | **KEEP** |
| `members.html` | 700 | Member directory | **KEEP** |
| `glossary.html` | 327 | Darts terms | **KEEP** |
| `offline.html` | 92 | Offline fallback | **KEEP** |

---

## 11. MARKETPLACE PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `dart-trader.html` | 891 | Marketplace main | **KEEP** (if feature is active) |
| `dart-trader-listing.html` | 822 | Individual listing | **KEEP** (if feature is active) |

---

## 12. OTHER PAGES

| Page | Lines | Purpose | Action |
|------|-------|---------|--------|
| `index.html` | 747 | Login/home | **KEEP** |
| `full-site.html` | 1,048 | Orphaned mobile dashboard | **SAFE TO DELETE** |
| `dashboard.html` | 2,058 | Player dashboard | **KEEP** |
| `player-profile.html` | 2,843 | Player profile | **KEEP** |
| `my-stats.html` | 676 | Personal stats | **KEEP** |
| `player-lookup.html` | 751 | Search players | **KEEP** |
| `online-play.html` | 1,170 | Online multiplayer | **KEEP** (if feature is active) |
| `virtual-darts/index.html` | 2,892 | VR Darts practice | **KEEP** |

**ASSESSED - full-site.html:** ORPHANED
- No incoming links from any page in codebase
- Only self-references (its own nav links to itself)
- Not in firebase.json rewrites
- Not in any navigation menu
- Functionality overlap with index.html and dashboard.html
- **RECOMMENDATION:** Safe to delete or add redirect to index.html

---

## RECOMMENDED IMMEDIATE ACTIONS

### High Confidence - COMPLETED

1. ~~**`pages/x01.html`** → Convert to redirect to `x01-scorer.html`~~ **DONE**
2. ~~**`bracket.html` (root)** → Convert to redirect to `pages/tournament-bracket.html`~~ **DONE**

### Assessment Complete - Results

| Item | Result | Recommendation |
|------|--------|----------------|
| 3. schedule + browse-events + community-events | **CONSOLIDATED** - Unified into events-hub.html | **DONE** → 3 redirects |
| 4. match-report vs match-hub | **MERGED** - All features now in match-hub | **DONE** → redirect |
| 5. pages/bracket vs tournament-bracket | **DIFFERENT** - bracket view vs dashboard | **KEEP BOTH** |
| 6. league-team vs team-profile | **SUPERSET** - team-profile has all features | **CONVERT** league-team → redirect |
| 7. director-dashboard vs league-director | **DIFFERENT** - tournaments vs leagues | **KEEP BOTH** |
| 8. full-site.html | **ORPHANED** - no incoming links | **DELETE** or redirect |

### Ready to Execute

9. **`league-team.html`** → Convert to redirect to `team-profile.html` (saves ~747 lines)
10. **`full-site.html`** → Delete or convert to redirect to `index.html` (saves ~1,048 lines)

---

## SUMMARY

| Category | Action | Count |
|----------|--------|-------|
| Already Done | Redirects created | 11 |
| Ready to Convert | Confirmed duplicates | 1 (league-team) |
| Ready to Delete | Orphaned pages | 1 (full-site) |
| Assessment Complete | Keep Both | 4 pairs assessed |
| Keep As-Is | Distinct functionality | 57 |
| New Pages | Events Hub | 1 |
| **Total** | | **70** |

**Lines already saved:** ~7,140 (previous + Events Hub consolidation ~940 lines)
**Ready to save:** ~1,795 additional lines (league-team + full-site)

---

## NOTES

- Registration pages (register, signup, player-registration) all serve different purposes
- Matchmaker is a complete separate feature - keep all 6 pages
- Scorer consolidation already done (league-501 → x01-scorer)
- Always check for incoming links before converting to redirects

## ASSESSMENT DETAILS

### Events Hub Consolidation (Jan 27, 2026)
Three event-related pages consolidated into `events-hub.html`:
- `schedule.html` (1,302 lines) → Personal match calendar, week view
- `browse-events.html` (497 lines) → Official BRDC leagues/tournaments
- `community-events.html` (1,641 lines) → Community events with Leaflet map

Data sources unified:
- `leagues/{id}/matches` - User's league matches (My Events filter)
- `tournaments` - Official tournaments (Tournaments filter)
- `leagues` - League registration info (Leagues filter)
- `pickup_games` + `community_events` - Social events (Social filter)

All old URLs redirect with appropriate filter param preserved.
**Verdict:** CONSOLIDATED - events-hub.html is single source of truth

### match-report.html vs match-hub.html
- **MERGED (Jan 27, 2026):** All unique match-report features merged into match-hub
- Features added to match-hub: H2H tab, player filter, print button/stylesheet, First 9 average
- match-report.html converted to redirect preserving URL parameters
- **Verdict:** MERGED - match-report.html now redirects to match-hub.html

### pages/bracket.html vs tournament-bracket.html
- `bracket.html` displays actual match bracket (visual columns)
- `tournament-bracket.html` is a dashboard with Events/Leaderboard/Players tabs (no bracket!)
- Note: tournament-bracket.html is misleadingly named
- **Verdict:** KEEP BOTH - completely different functions

### league-team.html vs team-profile.html
- team-profile has everything league-team has PLUS standings, level filtering, leaderboards
- No unique features in league-team
- **Verdict:** CONVERT league-team to redirect

### director-dashboard.html vs league-director.html
- `director-dashboard.html` manages tournaments (brackets, events, eliminations)
- `league-director.html` manages leagues (teams, weekly schedules, standings)
- Different Firestore collections, different data models
- **Verdict:** KEEP BOTH - serve different competition types

### full-site.html
- Orphaned page - no incoming links from anywhere in codebase
- Only self-references in its own navigation
- Not in firebase.json, not in any menu
- **Verdict:** SAFE TO DELETE (or redirect to index.html)
