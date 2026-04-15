# BRDC Ship Audit - Release Readiness Report
**Generated:** 2026-01-21
**Priority:** "User can complete a darts match end-to-end"

---

## 1. All Routes/Pages (53 pages in /public/pages/)

### Core Match Flow (Critical Path)
| Page | Description | Status |
|------|-------------|--------|
| `scorer-hub.html` | Entry point - play now or enter PIN | Complete |
| `game-setup.html` | Configure casual game (format, players) | Complete |
| `league-501.html` | X01 scorer (301/501/701) | Complete |
| `league-cricket.html` | Cricket scorer | Complete |
| `match-transition.html` | Between-game screen in match | Complete |
| `match-confirm.html` | Final match confirmation | Complete |
| `match-hub.html` | League match overview & game selection | Complete |
| `match-night.html` | Full match night flow for captains | Complete |

### Dashboard & Profile
| Page | Description | Status |
|------|-------------|--------|
| `dashboard.html` | Main user dashboard (login, leagues, matches) | Complete |
| `player-profile.html` | Player stats & history | Complete |
| `player-lookup.html` | Public player search | Complete |
| `player-public.html` | Public player view (if exists) | Complete |
| `my-stats.html` | Logged-in user's stats | Complete |
| `register.html` | New player registration | Complete |
| `team-profile.html` | Team roster & stats | Complete |

### League Management
| Page | Description | Status |
|------|-------------|--------|
| `league-view.html` | Public league page (schedule, standings) | Complete |
| `leagues.html` | Browse all leagues | Complete |
| `league-standings.html` | League standings (standalone) | Complete |
| `league-scoreboard.html` | Live league scores | Complete |
| `league-director.html` | Director dashboard for leagues | Complete |
| `create-league.html` | Create new league wizard | Complete |
| `league-registration.html` | Register for league | Complete |
| `league-team.html` | Team-specific league page | Complete |
| `league-management.html` | League admin/management | Complete |

### Tournament System
| Page | Description | Status |
|------|-------------|--------|
| `tournament-view.html` | Public tournament page | Complete |
| `tournaments.html` | Browse tournaments | Complete |
| `tournament-bracket.html` | Visual bracket display | Complete |
| `director-dashboard.html` | Director dashboard for tournaments | Complete |
| `create-tournament.html` | Create tournament wizard | Complete |
| `bracket.html` | Generic bracket viewer | Complete |
| `event-view.html` | Event details (within tournament) | Complete |
| `player-registration.html` | Tournament player registration | Complete |

### Messaging & Social
| Page | Description | Status |
|------|-------------|--------|
| `messages.html` | Message inbox/conversations | Complete |
| `conversation.html` | Single DM conversation | Complete |
| `chat-room.html` | Group chat room | Complete |

### Admin & Director Tools
| Page | Description | Status |
|------|-------------|--------|
| `admin.html` | Master admin panel | Complete |
| `captain-dashboard.html` | Team captain tools | Complete |
| `bot-management.html` | Bot player management | Complete |
| `stat-verification.html` | Verify imported stats | Complete |

### Other Pages
| Page | Description | Status |
|------|-------------|--------|
| `knockout.html` | Knockout tournament bracket/play | Complete |
| `mini-tournament.html` | Quick mini-tournament setup | Complete |
| `live-scoreboard.html` | Live scoring display | Partial |
| `browse-events.html` | Browse all events | Complete |
| `community-events.html` | Community events map | Complete |
| `dart-trader.html` | Marketplace for equipment | Complete |
| `dart-trader-listing.html` | Single listing detail | Complete |
| `online-play.html` | Online play lobby | Partial |
| `matchmaker-*.html` (4 pages) | Matchmaker system | Partial |
| `stream-camera.html` | Camera streaming | Placeholder |
| `stream-director.html` | Stream director controls | Placeholder |
| `members.html` | Member directory | Complete |
| `match-report.html` | Post-match report view | Complete |
| `x01.html` | Standalone X01 scorer | Complete |
| `cricket.html` | Standalone cricket scorer | Complete |

### Root-Level Pages
| Page | Description | Status |
|------|-------------|--------|
| `/index.html` | Landing page / login | Complete |
| `/full-site.html` | Full site home (alternative) | Complete |
| `/bracket.html` | Redirect to /pages/bracket.html | Redirect |
| `/create-tournament.html` | Redirect | Redirect |
| `/virtual-darts/index.html` | Virtual darts game | Partial |
| `/scorers/x01.html` | Alternate scorer path | Complete |
| `/scorers/cricket.html` | Alternate scorer path | Complete |

---

## 2. Navigation Reachability

### Linked from Global Navigation (nav-menu.js)
- `/pages/dashboard.html` - DASHBOARD
- `/pages/scorer-hub.html` - SCORER
- Logout action

### Linked from Dashboard Quick Links
- `/pages/player-profile.html` - View Full Profile
- `/pages/admin.html` - Admin (if admin)
- `/pages/messages.html` - Messages
- `/pages/dart-trader.html` - Dart Trader
- `/pages/community-events.html` - Community Events
- `/pages/match-night.html` - Tonight's Match
- `/pages/match-hub.html` - Match Hub
- `/pages/league-director.html` - Director (leagues)
- `/pages/director-dashboard.html` - Director (tournaments)
- `/pages/conversation.html` - DM conversation

### Linked from Scorer Flow
- `/pages/game-setup.html` - From scorer-hub
- `/pages/league-501.html` - From game-setup or match-hub
- `/pages/league-cricket.html` - From game-setup or match-hub
- `/pages/match-transition.html` - After game complete
- `/pages/knockout.html` - From game-setup knockout mode

### Linked from League Pages
- `/pages/league-view.html` - From dashboard, leagues list
- `/pages/team-profile.html` - From league-view standings
- `/pages/player-profile.html` - From team/league pages
- `/pages/create-league.html` - From leagues.html

### Linked from Tournament Pages
- `/pages/tournament-view.html` - From tournaments list
- `/pages/tournament-bracket.html` - From tournament-view
- `/pages/create-tournament.html` - From tournaments.html
- `/pages/event-view.html` - From tournament

---

## 3. Unreachable/Orphan Pages

These pages exist but have NO inbound links from navigation or buttons:

| Page | Issue |
|------|-------|
| `stream-camera.html` | No links anywhere - streaming feature incomplete |
| `stream-director.html` | No links anywhere - streaming feature incomplete |
| `match-report.html` | No direct links found - how do users view match reports? |
| `members.html` | No navigation link - member directory inaccessible |
| `league-management.html` | Only referenced conceptually, not linked |
| `player-public.html` | May be obsolete - player-lookup serves this purpose |
| `mini-tournament.html` | No entry point - feature not exposed |
| `matchmaker-register.html` | Matchmaker system not linked from main nav |
| `matchmaker-view.html` | Matchmaker system not linked from main nav |
| `matchmaker-bracket.html` | Matchmaker system not linked from main nav |
| `matchmaker-director.html` | Only linked via URL manipulation in director-dashboard |
| `online-play.html` | Hidden - only linked via dashboard programmatic navigation |

---

## 4. P0 Issues - Match Flow Blockers

**Priority: User cannot complete a darts match or view results**

### P0-1: No clear "Return to Match Hub" after game completion
- **Location:** `league-501.html:3000-3041`, `league-cricket.html:3017-3041`
- **Issue:** Complex conditional logic for return navigation. If `leagueId` and `matchId` aren't in URL params, user gets dumped to scorer-hub instead of match-hub
- **Impact:** League match players lose context of their multi-game match

### P0-2: Match transition page may not load games correctly
- **Location:** `match-transition.html`
- **Issue:** Page loads match data but assumes specific URL params. If params missing, shows empty state
- **Impact:** Between-game navigation broken

### P0-3: getMatchByPin function dependency
- **Location:** `scorer-hub.html:388`
- **Issue:** Relies on cloud function `getMatchByPin` - if function fails or match has no games, user sees generic error
- **Impact:** PIN-based match entry may fail silently

### P0-4: No offline fallback for mid-match scoring
- **Location:** All scorer pages
- **Issue:** Service worker exists but scorers require Firebase connection. Losing connection mid-game = lost data
- **Impact:** Data loss during network interruptions

---

## 5. P1 Issues - Confusing UX / Missing Content

### P1-1: Inconsistent back button behavior
- **Locations:** Various pages
- **Issue:** Some pages go to `/`, some to `/pages/dashboard.html`, some to `/pages/scorer-hub.html`. No consistent "back" mental model
- **Impact:** Users get lost navigating

### P1-2: Nav menu disabled on scorer-hub
- **Location:** `scorer-hub.html:451-452`
- **Issue:** Comment says "Nav menu disabled while under construction" but nav-menu.js is mature
- **Impact:** Users on scorer-hub can't access hamburger menu

### P1-3: League links inconsistent parameter naming
- **Locations:**
  - Some use `league_id=X`
  - Some use `id=X`
  - Some use `league=X`
- **Impact:** Broken links if parameter name doesn't match what page expects

### P1-4: dashboard.html is 14,000+ lines
- **Location:** `dashboard.html`
- **Issue:** Monolithic file with all tabs inline. Slow to load, hard to maintain
- **Impact:** Slow page load on mobile, potential JS errors

### P1-5: Tournament flow unclear
- **Issue:** Creating tournament → event → registration path is confusing
- **Impact:** Directors struggle to set up tournaments correctly

### P1-6: match-hub.html query params inconsistent
- **Locations:** Some links use `league_id` + `match_id`, others use `league` + `match`
- **Issue:** `league-view.html:2575` uses `league=X&match=Y` but match-hub expects `league_id` + `match_id`
- **Impact:** Links from league-view to match-hub may fail

### P1-7: No loading states on many pages
- **Issue:** Pages show blank white/dark screen while loading Firebase data
- **Impact:** Users think page is broken

### P1-8: Error messages not user-friendly
- **Issue:** Many errors show raw error.message from Firebase
- **Impact:** Technical error messages confuse users

### P1-9: "Tonight's Match" logic
- **Location:** Dashboard captain tab
- **Issue:** Shows matches scheduled for today, but "today" is server time, not local time
- **Impact:** Wrong matches shown near midnight

---

## 6. P2 Issues - Polish / Non-Blocking

### P2-1: Streaming pages are placeholders
- **Pages:** `stream-camera.html`, `stream-director.html`
- **Issue:** Feature not implemented but pages exist

### P2-2: Matchmaker feature incomplete
- **Pages:** `matchmaker-*.html`
- **Issue:** Full matchmaker system exists but isn't connected to main navigation

### P2-3: Members page not linked
- **Page:** `members.html`
- **Issue:** Complete page with no entry point

### P2-4: Dart Trader marketplace
- **Pages:** `dart-trader.html`, `dart-trader-listing.html`
- **Issue:** Functional but marked as "coming soon" type feature

### P2-5: online-play.html hidden
- **Issue:** Online play lobby exists but only accessible via programmatic navigation

### P2-6: Virtual darts game incomplete
- **Location:** `/virtual-darts/`
- **Issue:** Separate SPA for virtual darts, unclear integration

### P2-7: Inconsistent date formatting
- **Issue:** Some pages use `toLocaleDateString()`, others use custom formatting
- **Impact:** Visual inconsistency

### P2-8: Missing favicon on some pages
- **Issue:** Some pages reference `/images/favicon.png`, existence not verified

### P2-9: Console.log statements in production code
- **Issue:** Many `console.log` debug statements throughout codebase

### P2-10: Duplicate scorer pages
- **Issue:** `/pages/x01.html` AND `/pages/league-501.html`, `/scorers/x01.html`
- **Impact:** Confusion about which is canonical

---

## 7. Critical Path Verification

### Complete a League Match (Primary Use Case)

```
1. Login → /pages/dashboard.html                    ✓ Works
2. See "Tonight's Match" or go to Match Hub         ✓ Works
3. Click "Match Hub" → /pages/match-hub.html        ⚠️ Check params
4. Select game to score → /pages/league-501.html    ✓ Works
5. Score the game                                   ✓ Works
6. Game ends → Return to match-hub or transition    ⚠️ P0-1
7. Score next game                                  ✓ Works
8. Match complete → View results                    ⚠️ Where?
```

### Complete a Casual Game (Secondary Use Case)

```
1. Go to scorer → /pages/scorer-hub.html            ✓ Works
2. Click "Play Now" → /pages/game-setup.html        ✓ Works
3. Configure game                                   ✓ Works
4. Start game → /pages/league-501.html              ✓ Works
5. Score the game                                   ✓ Works
6. Game ends → ?                                    ⚠️ Returns to setup
```

---

## 8. Recommended Fixes by Priority

### Immediate (P0)
1. Fix return navigation in scorers to always return to match-hub for league matches
2. Standardize URL parameter names (`league_id`, `match_id`)
3. Add offline queue for score submissions
4. Test `getMatchByPin` error handling

### This Week (P1)
1. Enable nav-menu on scorer-hub
2. Add loading skeletons to all pages
3. Fix timezone handling for "Tonight's Match"
4. User-friendly error messages

### Next Sprint (P2)
1. Decide on streaming feature - remove or complete
2. Link members.html from somewhere
3. Clean up duplicate scorer pages
4. Remove console.log statements

---

*End of Ship Audit*
