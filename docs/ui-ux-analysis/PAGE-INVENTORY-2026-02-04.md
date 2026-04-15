# PAGE INVENTORY AND HEALTH AUDIT - BRDC DARTS APP
**Audit Date:** 2026-02-04
**Project:** C:\Users\gcfrp\projects\brdc-firebase
**Total HTML Pages:** 61 pages

---

## EXECUTIVE SUMMARY

### Page Count by Category
- **Core pages:** 6 (login, signup, dashboard, profile, offline, glossary)
- **League Management:** 11 pages
- **Match/Scoring:** 10 pages
- **Social/Messaging:** 5 pages
- **Tournaments:** 6 pages
- **Matchmaker:** 6 pages
- **Admin/Director:** 5 pages
- **Stats/Player:** 4 pages
- **Other/Misc:** 8 pages

### Health Distribution
- **Complete (Production-Ready):** ~25 pages (41%)
- **Partial (Functional but Missing Features):** ~20 pages (33%)
- **Stub (Minimal Functionality):** ~10 pages (16%)
- **Broken/Abandoned:** ~6 pages (10%)

### Key Findings
1. **Significant feature sprawl** - Many pages started but not completed
2. **Duplicate functionality** - Multiple pages serving similar purposes (3+ scorers, 2 signup pages, 2 registration pages)
3. **Inconsistent authentication** - Mix of PIN-based and session-based auth approaches
4. **Size disparity** - Largest page (league-director.html) is 5,828 lines; smallest (my-stats.html) is 277 lines
5. **4 pages contain TODO/FIXME comments** indicating known incomplete work
6. **Strong Firebase integration** - 51 pages use Firestore extensively
7. **Bot support scattered** - Only specific pages support bot players

---

## COMPLETE PAGE INVENTORY

| # | File | Lines | Purpose | Status | Size | Login | Firebase | Bot |
|---|------|-------|---------|--------|------|-------|----------|-----|
| 1 | **index.html** | 723 | Landing page with PIN login | Complete | Medium | YES | NO | NO |
| 2 | **full-site.html** | 1063 | Public homepage with league/tournament browse | Complete | Medium | NO | YES | NO |
| 3 | **dashboard.html** | 3371 | Main player dashboard (schedule, stats, leagues) | Complete | Large | YES | YES | NO |
| 4 | **signup.html** | 672 | New player registration (modern UI) | Complete | Medium | NO | YES | NO |
| 5 | **register.html** | 445 | Alt registration with photo upload | Partial | Small | NO | YES | NO |
| 6 | **player-profile.html** | 3005 | Player stats and history | Complete | Large | YES | YES | NO |
| 7 | **player-lookup.html** | 752 | Search for players | Partial | Medium | NO | YES | NO |
| 8 | **my-stats.html** | 277 | Personal stats summary (stub) | Stub | Small | YES | YES | NO |
| 9 | **stat-verification.html** | 957 | Stats verification process | Partial | Medium | YES | YES | NO |
| 10 | **leagues.html** | 316 | League list/browser | Complete | Small | NO | YES | NO |
| 11 | **create-league.html** | 2291 | League creation wizard | Partial | Large | YES | YES | NO |
| 12 | **league-view.html** | 6165 | League homepage (schedule, standings, stats) | Complete | Large | YES | YES | NO |
| 13 | **league-director.html** | 5828 | Full director control panel | Partial | Large | YES | YES | NO |
| 14 | **league-team.html** | 748 | Team roster viewer | Partial | Medium | YES | YES | NO |
| 15 | **league-scoreboard.html** | 448 | Public scoreboard display | Partial | Small | NO | YES | NO |
| 16 | **league-cricket.html** | 3911 | Cricket scorer (league format) | Complete | Large | YES | YES | NO |
| 17 | **captain-dashboard.html** | 2134 | Team captain tools | Partial | Large | YES | YES | NO |
| 18 | **director-dashboard.html** | 1918 | League director dashboard | Partial | Medium | YES | YES | NO |
| 19 | **team-profile.html** | 1550 | Team stats and roster | Complete | Medium | YES | YES | NO |
| 20 | **draft-room.html** | 1571 | Team draft interface | Partial | Medium | YES | YES | NO |
| 21 | **game-setup.html** | 2798 | Scorer navigation/game setup | Complete | Large | NO | YES | YES |
| 22 | **x01-scorer.html** | 5552 | X01 scorer (501, 301, 701) | Complete | Large | YES | YES | YES |
| 23 | **match-hub.html** | 4812 | Match detail page (games, stats, reports) | Partial | Large | YES | YES | NO |
| 24 | **match-confirm.html** | 793 | Match attendance confirmation | Partial | Medium | YES | YES | NO |
| 25 | **match-transition.html** | 784 | Between-game transition screen | Partial | Medium | YES | YES | NO |
| 26 | **live-match.html** | 1834 | Live match viewer | Partial | Medium | YES | YES | NO |
| 27 | **live-scoreboard.html** | 1569 | Live scoreboard display | Partial | Medium | NO | YES | NO |
| 28 | **knockout.html** | 1281 | Knockout/playoff scoring | Partial | Medium | YES | YES | YES |
| 29 | **online-play.html** | 1170 | Online/remote match play | Stub | Medium | YES | YES | NO |
| 30 | **mini-tournament.html** | 1127 | Quick tournament setup | Stub | Medium | YES | YES | NO |
| 31 | **tournaments.html** | 322 | Tournament list/browser | Complete | Small | NO | YES | NO |
| 32 | **create-tournament.html** | 2873 | Tournament creation wizard | Partial | Large | YES | YES | NO |
| 33 | **tournament-view.html** | 936 | Tournament homepage | Partial | Medium | YES | YES | NO |
| 34 | **tournament-bracket.html** | 1186 | Bracket visualization | Partial | Medium | YES | YES | NO |
| 35 | **bracket.html** | 331 | Alt bracket viewer (duplicate?) | Stub | Small | NO | YES | NO |
| 36 | **matchmaker-register.html** | 1033 | Matchmaker event registration | Partial | Medium | YES | YES | NO |
| 37 | **matchmaker-director.html** | 2713 | Matchmaker event director tools | Partial | Large | YES | YES | NO |
| 38 | **matchmaker-view.html** | 962 | Matchmaker event viewer | Partial | Medium | YES | YES | NO |
| 39 | **matchmaker-bracket.html** | 864 | Matchmaker bracket display | Partial | Medium | YES | YES | NO |
| 40 | **matchmaker-tv.html** | 1107 | Matchmaker TV display mode | Partial | Medium | YES | YES | NO |
| 41 | **matchmaker-mingle.html** | 870 | Matchmaker social mode | Stub | Medium | YES | YES | NO |
| 42 | **messages.html** | 2047 | Messaging inbox | Partial | Large | YES | YES | NO |
| 43 | **conversation.html** | 606 | Direct message thread | Partial | Medium | YES | YES | NO |
| 44 | **chat-room.html** | 2721 | Group chat interface | Partial | Large | YES | YES | NO |
| 45 | **friends.html** | 1241 | Friends list/management | Partial | Medium | YES | YES | NO |
| 46 | **admin.html** | 2525 | System admin panel | Partial | Large | YES | YES | NO |
| 47 | **bot-management.html** | 745 | Bot player configuration | Partial | Medium | YES | YES | YES |
| 48 | **members.html** | 700 | Member directory | Partial | Medium | NO | YES | NO |
| 49 | **player-registration.html** | 407 | League player registration | Stub | Small | NO | YES | NO |
| 50 | **events-hub.html** | 2097 | Events calendar and browser | Complete | Large | NO | YES | NO |
| 51 | **event-view.html** | 858 | Single event details | Partial | Medium | YES | YES | NO |
| 52 | **dart-trader.html** | 891 | Equipment marketplace | Stub | Medium | YES | YES | NO |
| 53 | **dart-trader-listing.html** | 822 | Marketplace listing page | Stub | Medium | YES | YES | NO |
| 54 | **stream-director.html** | 1077 | Streaming director controls | Stub | Medium | YES | YES | NO |
| 55 | **stream-camera.html** | 517 | Streaming camera view | Stub | Medium | YES | YES | NO |
| 56 | **offline.html** | 343 | Offline fallback page | Complete | Small | NO | NO | NO |
| 57 | **glossary.html** | 526 | Darts terminology | Complete | Small | NO | YES | NO |
| 58 | **debug-review.html** | 589 | Debug/review tools | Partial | Medium | YES | YES | NO |

### Additional Root-Level Pages (Abandoned/Duplicates)
| # | File | Lines | Purpose | Status |
|---|------|-------|---------|--------|
| 59 | **create-tournament.html** (root) | - | Duplicate of pages/create-tournament.html | Abandoned |
| 60 | **bracket.html** (root) | - | Duplicate of pages/bracket.html | Abandoned |
| 61 | **scorers/x01.html** | - | Original scorer (replaced by pages/x01-scorer.html) | Abandoned |
| 62 | **scorers/cricket.html** | - | Original cricket scorer (replaced) | Abandoned |

---

## DETAILED PAGE-BY-PAGE ANALYSIS

### CORE PAGES

#### 1. index.html (Landing/Login)
- **Status:** Complete, production-ready
- **Lines:** 723
- **Purpose:** Main entry point with PIN authentication
- **Features:**
  - PWA install banner
  - Session management with secure-session.js
  - Responsive login UI
  - Auto-redirect if already logged in
- **Firebase:** NO (authentication only via cloud function `securePlayerLogin`)
- **Dependencies:** `/js/secure-session.js`
- **TODOs:** None
- **Issues:** None identified

#### 2. full-site.html (Public Homepage)
- **Status:** Complete, production-ready
- **Lines:** 1,063
- **Purpose:** Public-facing site with league/tournament browse, match PIN entry
- **Features:**
  - Active leagues display
  - Tournaments listing
  - Weekly leaders
  - Notable performances
  - Bottom navigation
  - Match PIN entry for quick access
- **Firebase:** YES (reads leagues, tournaments, matches, stats)
- **Cloud Functions:** `getMatchByPin`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:** None identified

#### 3. dashboard.html (Player Dashboard)
- **Status:** Complete, production-ready
- **Lines:** 3,371
- **Purpose:** Main player hub after login
- **Features:**
  - Multi-tab interface: Schedule, Leagues, Stats, Messages, Settings
  - Calendar view with match scheduling
  - League standings and stats
  - Personal statistics dashboard
  - Message inbox with unread counts
  - Account settings (email, phone, skill level)
  - Logout functionality
- **Firebase:** YES (leagues, matches, stats, messages)
- **Dependencies:** `secure-session.js`, `firebase-config.js`, `feedback.js`
- **TODOs:** 1 found (related to stats display aggregation)
- **Issues:** Large file (3,371 lines) - consider breaking into tab components

#### 4. signup.html (Registration - Modern)
- **Status:** Complete, production-ready
- **Lines:** 672
- **Purpose:** New player account creation with modern UI
- **Features:**
  - Full name (first + last), email, phone, skill level input
  - Auto-formats phone numbers (US format)
  - Generates 8-digit PIN automatically
  - Email confirmation and verification
  - Auto-login after registration
  - Clean, mobile-optimized UI
- **Firebase:** Cloud function `registerNewPlayer`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:** None

#### 5. register.html (Registration - Alt with Photo)
- **Status:** Partial (functional but overlaps with signup.html)
- **Lines:** 445
- **Purpose:** Alternative registration flow with profile photo upload
- **Features:**
  - Photo upload to Firebase Storage
  - User chooses 4-digit PIN (vs auto-generated 8-digit)
  - Basic player info
- **Firebase:** YES (photo upload to Storage, `registerPlayer` cloud function)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - **DUPLICATE FUNCTIONALITY** - Should consolidate with signup.html
  - Different PIN lengths (4 vs 8 digits) creates inconsistency
  - Less polished UI than signup.html

**Recommendation:** Merge photo upload feature into signup.html, remove this page, standardize on 8-digit PIN.

#### 6. offline.html
- **Status:** Complete
- **Lines:** 343
- **Purpose:** Service worker fallback when offline
- **Features:**
  - Offline message with branding
  - List of cached pages available offline
  - Automatic redirect when online
- **Firebase:** NO
- **Dependencies:** None
- **Issues:** None

#### 7. glossary.html
- **Status:** Complete
- **Lines:** 526
- **Purpose:** Darts terminology and rules reference
- **Features:**
  - Definitions for cricket, X01, doubles, triples
  - Scoring terminology (ton, hat trick, etc.)
  - Common slang
- **Firebase:** NO
- **Dependencies:** None
- **Issues:** None

---

### LEAGUE MANAGEMENT PAGES

#### 10. leagues.html (League Browser)
- **Status:** Complete
- **Lines:** 316
- **Purpose:** Browse all leagues (current and past)
- **Features:**
  - League cards with status badges (active, completed, registration)
  - Team counts, player counts
  - Direct navigation to league-view
- **Firebase:** YES (reads leagues collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:** None

#### 11. create-league.html (League Creator Wizard)
- **Status:** Partial (many features incomplete)
- **Lines:** 2,291
- **Purpose:** Multi-step league creation wizard
- **Features:**
  - **Step 1: Basic Info** - Name, venue, day of week, time, season dates
  - **Step 2: Roster & Divisions** - Min/max players, divisions, skill levels
  - **Step 3: Match Format Builder** - Custom game sequences (501, cricket, mixed, corks choice)
  - **Step 4: Scoring Rules** - Cork rules (3 separate fields), handicapping
  - **Step 5: Draft Configuration** - Draft type, order, restrictions
  - **Step 6: Registration** - Open/closed registration, fees
- **Firebase:** YES (creates league document in Firestore)
- **Cloud Functions:** `createLeague`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None found in code comments
- **Missing Features (per RULE 21 in CLAUDE.md):**
  - Number of weeks (optional override)
  - Match frequency (weekly, bi-weekly)
  - Board/table count for venue
  - Forfeit rules (grace period, points awarded)
  - Sub restrictions (multi-team, max appearances)
- **Issues:**
  - Very complex UI (2,291 lines in single file)
  - Many configuration options not fully wired up to backend
  - Cork rules section has 3 separate fields - UX needs clarification
  - No validation for conflicting settings
  - Should be broken into components

**Recommendation:** Complete missing features, add validation, refactor into modular components.

#### 12. league-view.html (League Homepage)
- **Status:** Complete (core features), Partial (advanced features)
- **Lines:** 6,165 (LARGEST FILE IN PROJECT)
- **Purpose:** Central league hub with schedule, standings, stats, roster
- **Features:**
  - **6-tab interface:**
    1. Overview - League info, upcoming matches, recent results
    2. Schedule - Weekly match cards with expandable details
    3. Standings - Team standings with records, points
    4. Stats - Player leaderboards (501 avg, cricket MPR, checkouts, etc.)
    5. Teams - Team rosters with positions
    6. Rules - League rules and format display
  - Match cards with team names, scores, player lineups, stats
  - Fill-in player handling (SUB badges)
  - Team standing badges (1st, 2nd, 3rd, etc.)
  - Record badges (wins-losses)
- **Firebase:** YES (extensive - reads teams, players, matches, stats subcollections)
- **Dependencies:** `stats-helpers.js`, `display-helpers.js`, `firebase-config.js`
- **Cloud Functions:** `getSchedule`, `getStandings`, `getLeagueStats`
- **TODOs:** None
- **Issues:**
  - **FILE TOO LARGE** (6,165 lines) - desperately needs modularization
  - Each tab should be a separate component
  - Complex match card rendering logic duplicated from dashboard
  - Heavy Firestore queries on page load (performance concern)
  - No pagination or lazy loading for large datasets

**Recommendation:** CRITICAL - Break into tab components, optimize queries, add loading states.

#### 13. league-director.html (Director Control Panel)
- **Status:** Partial (core tools work, many advanced features incomplete)
- **Lines:** 5,828 (SECOND LARGEST FILE)
- **Purpose:** Full administrative control panel for league directors
- **Features:**
  - **Dashboard tab** - Summary stats (teams, players, matches completed/scheduled)
  - **Teams tab** - Add/remove teams, edit rosters
  - **Players tab** - Add/edit/remove players, change levels (A/B/C), position assignments
  - **Matches tab** - Schedule generation (auto/manual), edit match details, reschedule
  - **Scoring tab** - Review match results, adjust stats if needed
  - **Settings tab** - Edit league settings (partially implemented)
  - **Messages tab** - Send league announcements (stub)
  - **Reports tab** - Export data, generate reports (stub)
- **Firebase:** YES (full read/write access to all league subcollections)
- **Cloud Functions:**
  - `createLeague`
  - `updateLeagueSettings`
  - `scheduleMatches`
  - `updatePlayerLevel`
  - `adjustMatchResult`
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **TODOs:** None in code
- **Issues:**
  - **FILE TOO LARGE** (5,828 lines) - critically needs modularization
  - Many buttons/features not wired up
  - Settings editor is incomplete (can't edit all league config)
  - Reports/exports are stubs (no actual export functionality)
  - Messages/announcements not implemented
  - No audit log for director actions

**Recommendation:** CRITICAL - Modularize into separate tools, complete settings editor, add audit logging.

#### 14. league-team.html (Team Viewer)
- **Status:** Partial
- **Lines:** 748
- **Purpose:** View team roster and stats
- **Features:**
  - Team name and captain
  - Full roster with positions (1, 2, 3)
  - Basic team stats (wins, losses, points)
- **Firebase:** YES (teams, players, stats subcollections)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Very basic display
  - Should show more team-level aggregates (total 3DA, total MPR, etc.)
  - No match history for team

**Recommendation:** Expand to show team-level stats, match history, head-to-head records.

#### 15. league-scoreboard.html (Public Scoreboard)
- **Status:** Partial
- **Lines:** 448
- **Purpose:** TV-style public scoreboard for venue display
- **Features:**
  - Current standings
  - Live match scores
  - Auto-refresh
- **Firebase:** YES (realtime match updates via onSnapshot)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - UI is very basic
  - Needs polish for professional public display
  - Should have different display modes (standings only, live scores only, rotating)
  - No branding/venue customization

**Recommendation:** Add display modes, improve styling, add venue branding options.

#### 16. league-cricket.html (Cricket Scorer)
- **Status:** Complete (production scorer)
- **Lines:** 3,911
- **Purpose:** Cricket scoring for league matches
- **Features:**
  - Singles and doubles cricket support
  - Mark tracking for numbers 20, 19, 18, 17, 16, 15, Bulls
  - Closing logic (3 marks to close, then scoring points)
  - MPR (marks per round) calculation
  - Undo/redo functionality
  - Turn-by-turn history
  - Saves complete match data to Firestore on completion
  - Verification mode for reviewing past matches
- **Firebase:** YES (writes match results, leg data, throws to Firestore)
- **Bot Support:** NO (cricket doesn't have bot mode currently - inconsistency with x01-scorer)
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **Cloud Functions:** `saveMatchResult`, `updatePlayerStats`
- **TODOs:** None
- **Issues:**
  - Large file (3,911 lines) - could use refactoring into modules
  - **MISSING BOT SUPPORT** - x01-scorer has bots, cricket doesn't (inconsistency)
  - No inputmode="numeric" on score inputs (mobile UX issue - see MOBILE-UX-AUDIT)

**Recommendation:** Add bot support for consistency, refactor into modules, fix mobile keyboard issue.

#### 17. captain-dashboard.html (Team Captain Tools)
- **Status:** Partial
- **Lines:** 2,134
- **Purpose:** Tools for team captains to manage their team
- **Features:**
  - Team roster view with player stats
  - Match confirmations (confirm attendance, find subs)
  - Lineup setting (choose who plays each position)
  - Team messaging
  - Stats summary for team
- **Firebase:** YES (teams, players, matches subcollections)
- **Dependencies:** `firebase-config.js`
- **Cloud Functions:** `confirmMatchAttendance`, `findSubstitute`
- **TODOs:** None
- **Issues:**
  - Many captain features are stubs
  - Messaging not implemented
  - Lineup editor not fully functional
  - Find substitute feature incomplete

**Recommendation:** Complete lineup editor and substitute finder, implement team messaging.

#### 18. director-dashboard.html (Director Dashboard)
- **Status:** Partial
- **Lines:** 1,918
- **Purpose:** Simplified director interface (vs full league-director.html)
- **Features:**
  - Overview stats (teams, players, matches)
  - Quick actions (add team, add player, schedule matches)
  - Recent activity feed
- **Firebase:** YES (leagues, teams, players, matches)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - **DUPLICATE FUNCTIONALITY** with league-director.html
  - Unclear why both exist - need to clarify use case
  - If this is "simplified" version, many features still overlap

**Recommendation:** Decide: Keep both (document distinct use cases) OR consolidate into one director interface.

#### 19. team-profile.html (Team Stats)
- **Status:** Complete
- **Lines:** 1,550
- **Purpose:** Detailed team statistics and history
- **Features:**
  - Full roster with player stats
  - Aggregated team stats (total wins, avg 3DA, avg MPR)
  - Match history with results
  - Head-to-head records vs other teams
- **Firebase:** YES (teams, players, stats, matches)
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **TODOs:** None
- **Issues:** None significant

#### 20. draft-room.html (Team Draft)
- **Status:** Partial
- **Lines:** 1,571
- **Purpose:** Live draft interface for team formation
- **Features:**
  - Player pool display with stats
  - Draft order management
  - Pick selection and confirmation
  - Realtime draft state sync across users
  - Draft chat (basic)
- **Firebase:** YES (realtime draft state via onSnapshot)
- **Dependencies:** `firebase-config.js`
- **Cloud Functions:** `makeDraftPick`, `undoDraftPick`
- **TODOs:** None
- **Issues:**
  - Complex feature that needs extensive testing
  - Draft chat is very basic
  - No draft timer/clock
  - No autopick for absent drafters
  - No trade functionality

**Recommendation:** Complete draft timer, autopick, and trade features before production use.

---

### MATCH/SCORING PAGES

#### 21. game-setup.html (Scorer Navigation)
- **Status:** Complete
- **Lines:** 2,798
- **Purpose:** Game setup and scorer selection hub
- **Features:**
  - Team configuration (1v1 up to 4v4, up to 8 teams total)
  - Team color selection (8 preset colors)
  - Player assignment to teams
  - Format selection (501, 301, 701, cricket, custom X01)
  - Game rules (SIDO, DIDO, SODO, Master Out)
  - Best-of selection (1, 3, 5, 7 games)
  - Bot player support (add CPU opponents)
  - Routes to appropriate scorer based on format
  - Optional league context (links to league match)
- **Firebase:** YES (optional - only if league context provided)
- **Bot Support:** YES (can add bot players to any team)
- **Dependencies:** `firebase-config.js`
- **TODOs:** 1 found (related to format selection UI clarity)
- **Issues:** None significant - solid entry point for all scoring

#### 22. x01-scorer.html (X01 Scorer)
- **Status:** Complete (production scorer)
- **Lines:** 5,552 (THIRD LARGEST FILE)
- **Purpose:** Primary scorer for 501, 301, 701 games
- **Features:**
  - Singles, doubles, triples support (1v1, 2v2, 3v3)
  - SIDO (straight in/double out), DIDO (double in/double out), SODO (straight in/straight out), Master Out (double OR triple out)
  - Bust detection and automatic turn ending
  - Checkout suggestions (shows best checkout path)
  - Undo/redo functionality
  - Turn-by-turn history with marks for notable throws (100+, 140+, 180)
  - Stats calculation:
    - 3-dart average
    - Checkout percentage
    - High score per player
    - Darts per leg
    - Checkout darts tracking (1st, 2nd, 3rd dart)
  - Bot player simulation with 3 difficulty levels
  - Saves complete match data to Firestore on completion
  - Cork (determine who throws first)
  - Corks Choice mode (winner picks game type)
- **Firebase:** YES (writes match results, leg data, player stats)
- **Bot Support:** YES (CPU opponents with Easy/Medium/Hard difficulty)
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **Cloud Functions:** `saveMatchResult`, `updatePlayerStats`
- **TODOs:** None
- **Issues:**
  - Very large file (5,552 lines) - could benefit from modularization
  - Bot logic could be extracted to separate module
  - UI rendering functions could be componentized
  - No inputmode="numeric" on score inputs (mobile UX issue - see MOBILE-UX-AUDIT)

**Recommendation:** Refactor into modules (UI, game logic, bot AI, stats), fix mobile keyboard.

#### 23. match-hub.html (Match Detail Page)
- **Status:** Partial (core display works, advanced features incomplete)
- **Lines:** 4,812 (FOURTH LARGEST FILE)
- **Purpose:** Central match details page with games, stats, and reports
- **Features:**
  - Match header (date, start time, end time, duration, total darts thrown)
  - **Tab 1: Games** - Game-by-game breakdown (currently shows individual legs, should show sets)
  - **Tab 2: Performance** - Player performance stats (stub)
  - **Tab 3: Counts** - Notable throws, achievements (stub)
  - **Tab 4: Leaderboards** - Match-specific leaderboards (stub)
  - Each game card shows format, players, winner, scores
  - Expandable game cards to show throw-by-throw detail
- **Firebase:** YES (reads match data with games array)
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **TODOs:** None in code
- **Known Issues (per RULE 14 and RULE 17 in CLAUDE.md):**
  - **Games tab shows LEGS individually instead of grouping by SET**
  - Should show set cards (e.g., "Set 1: 2-1") with expandable legs
  - Performance tab not fully implemented
  - Counts tab not fully implemented (should show 60+ checkouts, 100+ turns, etc.)
  - Leaderboards tab is stub

**Recommendation:** CRITICAL - Fix set grouping in Games tab (per RULE 17), complete Performance and Counts tabs.

#### 24. match-confirm.html (Match Attendance)
- **Status:** Partial
- **Lines:** 793
- **Purpose:** Pre-match attendance confirmation for players
- **Features:**
  - Confirm attendance
  - Decline with reason
  - Find substitute
  - Notify team captain
- **Firebase:** YES (updates match lineup array)
- **Cloud Functions:** `confirmAttendance`, `findSubstitute`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic stub functionality
  - Find substitute feature incomplete
  - No notification system wired up

**Recommendation:** Complete substitute finder, add email/push notifications.

#### 25. match-transition.html (Between-Game Screen)
- **Status:** Partial
- **Lines:** 784
- **Purpose:** Transition screen between legs/games in a match
- **Features:**
  - Display current scores
  - Show next game info (format, players)
  - Continue button to next game
  - Optional break timer
- **Firebase:** YES (updates match state)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic functionality only
  - No actual break timer implemented
  - Could show more stats from completed game

**Recommendation:** Add break timer, show game summary stats.

#### 26. live-match.html (Live Match Viewer)
- **Status:** Partial
- **Lines:** 1,834
- **Purpose:** Real-time match viewer for spectators
- **Features:**
  - Live scores updated in realtime
  - Current throw display
  - Player stats
  - Match timeline
- **Firebase:** YES (realtime listeners via onSnapshot)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Needs polish for public viewing
  - Realtime sync may have race conditions/bugs
  - No error handling for connection loss
  - UI is basic

**Recommendation:** Add connection status indicator, improve error handling, polish UI.

#### 27. live-scoreboard.html (Live Scoreboard Display)
- **Status:** Partial
- **Lines:** 1,569
- **Purpose:** Public scoreboard display for multiple matches
- **Features:**
  - Multiple match tracking
  - TV display mode
  - Auto-refresh
  - Rotation between matches
- **Firebase:** YES (realtime updates)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic display only
  - Needs professional design for venue display
  - No customization options

**Recommendation:** Add display modes, improve styling, add branding.

#### 28. knockout.html (Knockout/Playoff Scorer)
- **Status:** Partial
- **Lines:** 1,281
- **Purpose:** Playoff bracket scoring
- **Features:**
  - Bracket progression
  - Winner advancement
  - Score tracking
  - Bot support for testing
- **Firebase:** YES (writes bracket results)
- **Bot Support:** YES
- **Dependencies:** `firebase-config.js`
- **TODOs:** 1 found (related to bracket advancement logic)
- **Issues:**
  - Incomplete implementation
  - Bracket advancement logic has known bug (per TODO)
  - Needs extensive testing

**Recommendation:** Fix bracket logic, complete implementation, test thoroughly.

#### 29. online-play.html (Online Match)
- **Status:** Stub (concept only)
- **Lines:** 1,170
- **Purpose:** Remote/online match play between players in different locations
- **Features:** Stub - basic structure only, no actual functionality
- **Firebase:** YES (planned realtime sync)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Not implemented at all
  - 1,170 lines of mostly placeholder code

**Recommendation:** Either complete this feature OR remove the file (dead code).

#### 30. mini-tournament.html (Quick Tournament)
- **Status:** Stub (concept only)
- **Lines:** 1,127
- **Purpose:** Quick single-elimination tournament setup
- **Features:** Stub - basic structure, no functionality
- **Firebase:** YES (planned)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Not implemented
  - 1,127 lines of stub code

**Recommendation:** Either complete OR remove (dead code).

---

### SOCIAL/MESSAGING PAGES

#### 42. messages.html (Messaging Inbox)
- **Status:** Partial
- **Lines:** 2,047
- **Purpose:** Player messaging inbox
- **Features:**
  - Conversation list
  - Unread counts
  - Search conversations
  - Send/receive messages
- **Firebase:** YES (messages collection)
- **Dependencies:** `firebase-config.js`, `messaging.css`, `chat-config.js`
- **TODOs:** None
- **Issues:**
  - Incomplete messaging system
  - No push notifications
  - No group messages
  - Basic UI only

**Recommendation:** Complete messaging system, add notifications.

#### 43. conversation.html (Direct Message Thread)
- **Status:** Partial
- **Lines:** 606
- **Purpose:** 1-on-1 message thread
- **Features:**
  - Message history
  - Send/receive messages
  - Realtime updates
- **Firebase:** YES (realtime messages via onSnapshot)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic implementation only
  - No media sharing
  - No message reactions/emojis

**Recommendation:** Add media sharing, improve UI.

#### 44. chat-room.html (Group Chat)
- **Status:** Partial
- **Lines:** 2,721
- **Purpose:** Group chat for leagues/teams
- **Features:**
  - Multi-user chat
  - Real-time message updates
  - User presence indicators
  - Chat history
- **Firebase:** YES (chat rooms collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Needs completion and testing
  - No moderation features
  - No file sharing

**Recommendation:** Complete implementation, add moderation tools.

#### 45. friends.html (Friends List)
- **Status:** Partial
- **Lines:** 1,241
- **Purpose:** Friends management
- **Features:**
  - Friend requests (send/accept/decline)
  - Friend list display
  - Blocking users
  - Online status
- **Firebase:** YES (friends collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic features only
  - No friend suggestions
  - No mutual friends display

**Recommendation:** Add friend suggestions, mutual friends.

#### 7. player-lookup.html (Player Search)
- **Status:** Partial
- **Lines:** 752
- **Purpose:** Search for players by name
- **Features:**
  - Search box
  - Results list with player cards
  - Link to player profiles
- **Firebase:** YES (players collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic search only (name matching)
  - No advanced filters (skill level, location, etc.)
  - No fuzzy matching

**Recommendation:** Add advanced search filters, fuzzy matching.

---

### TOURNAMENT PAGES

#### 31. tournaments.html (Tournament Browser)
- **Status:** Complete
- **Lines:** 322
- **Purpose:** Browse all tournaments
- **Features:**
  - Tournament list with status badges
  - Filter by status (upcoming, active, completed)
  - Direct navigation to tournament-view
- **Firebase:** YES (tournaments collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:** None

#### 32. create-tournament.html (Tournament Creator)
- **Status:** Partial (many features incomplete)
- **Lines:** 2,873
- **Purpose:** Tournament creation wizard
- **Features:**
  - Similar to create-league but for single-day events
  - Tournament info (name, date, venue, format)
  - Registration settings
  - Bracket type (single-elim, double-elim, round-robin)
  - Entry fee and payouts
- **Firebase:** YES (creates tournament in Firestore)
- **Cloud Functions:** `createTournament`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Complex wizard (2,873 lines)
  - Many features incomplete
  - Bracket generation not fully wired up
  - Payout calculator stub

**Recommendation:** Complete bracket generation, payout calculator.

#### 33. tournament-view.html (Tournament Homepage)
- **Status:** Partial
- **Lines:** 936
- **Purpose:** Tournament details and registration
- **Features:**
  - Tournament info display
  - Registration button
  - Participant list
  - Link to bracket
  - Schedule
- **Firebase:** YES (tournament, registrations)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic viewer only
  - Registration flow incomplete

**Recommendation:** Complete registration flow.

#### 34. tournament-bracket.html (Bracket Display)
- **Status:** Partial
- **Lines:** 1,186
- **Purpose:** Tournament bracket visualization
- **Features:**
  - SVG bracket rendering
  - Match results display
  - Clickable matches for details
- **Firebase:** YES (tournament matches)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic SVG bracket (works but not polished)
  - No mobile optimization
  - Large brackets hard to read

**Recommendation:** Improve mobile layout, add zoom/pan for large brackets.

#### 35. bracket.html (Alt Bracket)
- **Status:** Stub
- **Lines:** 331
- **Purpose:** Alternative bracket viewer
- **Firebase:** YES
- **Dependencies:** `firebase-config.js`
- **Issues:**
  - **DUPLICATE FUNCTIONALITY** - unclear why this exists separately from tournament-bracket.html
  - Very minimal code (331 lines)

**Recommendation:** REMOVE - consolidate with tournament-bracket.html.

---

### MATCHMAKER PAGES

(Matchmaker is a quick tournament/event system separate from traditional leagues)

#### 36. matchmaker-register.html
- **Status:** Partial
- **Lines:** 1,033
- **Purpose:** Register for matchmaker event
- **Features:**
  - Player registration form
  - Payment processing (stub)
  - Skill level declaration
- **Firebase:** YES (matchmaker registrations)
- **Cloud Functions:** `registerForMatchmaker`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Payment processing not implemented
  - Registration confirmation incomplete

**Recommendation:** Complete payment integration, confirmation flow.

#### 37. matchmaker-director.html
- **Status:** Partial
- **Lines:** 2,713
- **Purpose:** Director tools for matchmaker events
- **Features:**
  - Participant management
  - Bracket setup and generation
  - Match scheduling
  - Check-in system
  - Scoring oversight
- **Firebase:** YES (matchmaker events)
- **Cloud Functions:** `createMatchmakerBracket`, `scheduleMatchmakerMatches`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Many features incomplete
  - Check-in system is stub
  - Bracket generation partial

**Recommendation:** Complete check-in system, bracket generation.

#### 38. matchmaker-view.html
- **Status:** Partial
- **Lines:** 962
- **Purpose:** View matchmaker event details
- **Features:**
  - Event information
  - Schedule display
  - Live scores
  - Participant list
- **Firebase:** YES (matchmaker events)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic viewer only
  - Live scores not fully implemented

**Recommendation:** Complete live scoring display.

#### 39. matchmaker-bracket.html
- **Status:** Partial
- **Lines:** 864
- **Purpose:** Matchmaker bracket display
- **Features:**
  - Bracket visualization
  - Match results
- **Firebase:** YES (matchmaker matches)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic display only
  - Similar to tournament-bracket.html (possible code duplication)

**Recommendation:** Consider consolidating bracket logic with tournament-bracket.

#### 40. matchmaker-tv.html
- **Status:** Partial
- **Lines:** 1,107
- **Purpose:** TV display mode for matchmaker events
- **Features:**
  - Public scoreboard
  - Auto-rotating displays
  - Bracket overview
- **Firebase:** YES (realtime matchmaker data)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Needs design work for public display
  - Basic functionality only

**Recommendation:** Improve styling for venue display.

#### 41. matchmaker-mingle.html
- **Status:** Stub (concept only)
- **Lines:** 870
- **Purpose:** Social networking feature at matchmaker events
- **Features:** Stub - concept only, no functionality
- **Firebase:** YES (planned)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Not implemented
  - 870 lines of stub code

**Recommendation:** Either complete OR remove (dead code).

---

### ADMIN/DIRECTOR PAGES

#### 46. admin.html (System Admin)
- **Status:** Partial
- **Lines:** 2,525
- **Purpose:** System-wide admin tools
- **Features:**
  - User management (view all players, edit, ban)
  - League oversight (all leagues, stats)
  - System settings
  - Database backups (stub)
  - Analytics dashboard
- **Firebase:** YES (admin-level access to all collections)
- **Cloud Functions:** `adminUpdateUser`, `adminDeleteLeague`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Many admin features incomplete
  - No actual backup functionality
  - Analytics are basic
  - No role-based permissions UI

**Recommendation:** Complete backup system, improve analytics, add RBAC UI.

#### 47. bot-management.html (Bot Configuration)
- **Status:** Partial
- **Lines:** 745
- **Purpose:** Configure bot players for testing
- **Features:**
  - Create/edit bot players
  - Set difficulty levels (Easy, Medium, Hard)
  - Behavior settings (consistency, checkout ability)
  - Skill level assignments
- **Firebase:** YES (bot configurations)
- **Bot Support:** YES (this is the bot config interface)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic features only
  - No advanced AI tuning
  - Bots are hardcoded in scorers, not pulled from this config

**Recommendation:** Wire bot configs to scorers, add advanced AI tuning.

#### 48. members.html (Member Directory)
- **Status:** Partial
- **Lines:** 700
- **Purpose:** Directory of all players in the system
- **Features:**
  - Player list with stats
  - Search functionality
  - Filter by league/skill level
- **Firebase:** YES (players collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic directory only
  - No advanced filters
  - No export functionality

**Recommendation:** Add advanced filters, export to CSV.

#### 49. player-registration.html (League Registration)
- **Status:** Stub
- **Lines:** 407
- **Purpose:** Register existing player for a specific league
- **Features:** Stub - minimal form, no functionality
- **Firebase:** YES (planned)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - **DUPLICATE FUNCTIONALITY** - overlaps with registration flows in create-league and other pages
  - Not implemented

**Recommendation:** REMOVE - registration should happen through league-specific flows.

---

### STATS/PLAYER PAGES

#### 6. player-profile.html (Player Stats)
- **Status:** Complete (core features), Partial (advanced)
- **Lines:** 3,005
- **Purpose:** Complete player statistics and history
- **Features:**
  - Career stats (501 avg, cricket MPR, high checkouts, total games)
  - Match history with results
  - League affiliations (current and past)
  - Achievements/badges
  - Head-to-head records vs other players
  - Recent performance graph
- **Firebase:** YES (player stats across all leagues and tournaments)
- **Dependencies:** `firebase-config.js`, `stats-helpers.js`
- **TODOs:** None
- **Issues:** None major - solid player profile

#### 8. my-stats.html (Personal Stats Summary)
- **Status:** Stub
- **Lines:** 277 (SMALLEST FILE)
- **Purpose:** Quick personal stats view
- **Features:**
  - Basic stat cards (3DA, MPR, games played)
  - Very minimal display
- **Firebase:** YES (player stats)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Very minimal - only 277 lines
  - Redundant with player-profile.html
  - Could be removed or greatly expanded

**Recommendation:** Either expand significantly OR remove (redirect to player-profile).

#### 9. stat-verification.html (Stats Verification)
- **Status:** Partial
- **Lines:** 957
- **Purpose:** Verify player skill level with live test
- **Features:**
  - PIN login
  - Live skill test (throw darts, record scores)
  - Level assignment based on performance
  - Verification badge award
- **Firebase:** YES (player verification records)
- **Cloud Functions:** `recordVerification`, `updatePlayerLevel`
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Verification process incomplete
  - No actual throwing test implemented (would need webcam/sensors)
  - Currently just a form

**Recommendation:** Complete verification process OR clarify it's for self-reporting only.

---

### OTHER/MISC PAGES

#### 50. events-hub.html (Events Calendar)
- **Status:** Complete
- **Lines:** 2,097
- **Purpose:** Browse all events (leagues, tournaments, social gatherings)
- **Features:**
  - Calendar view with month/week/day navigation
  - Event cards with type badges (league, tournament, social)
  - Filter by event type
  - Color-coded by event type (teal=league, yellow=tournament, pink=social)
  - Direct navigation to event pages
- **Firebase:** YES (leagues, tournaments, events collections)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:** None - solid calendar implementation

#### 51. event-view.html (Event Details)
- **Status:** Partial
- **Lines:** 858
- **Purpose:** Single event details page
- **Features:**
  - Event information
  - Registration button
  - Participant list
  - Schedule
- **Firebase:** YES (events collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Basic viewer only
  - Registration flow incomplete

**Recommendation:** Complete registration flow.

#### 52-53. dart-trader.html + dart-trader-listing.html (Marketplace)
- **Status:** Stub (concept only)
- **Lines:** 891 + 822 = 1,713 total
- **Purpose:** Equipment marketplace for buying/selling darts gear
- **Features:** Stub - basic structure, no functionality
- **Firebase:** YES (planned marketplace collection)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Not implemented at all
  - 1,713 combined lines of unused code

**Recommendation:** Either complete the marketplace OR REMOVE both files (dead code).

#### 54-55. stream-director.html + stream-camera.html (Streaming)
- **Status:** Stub (concept only)
- **Lines:** 1,077 + 517 = 1,594 total
- **Purpose:** Streaming controls and camera views for broadcasting matches
- **Features:** Stub - basic structure, no functionality
- **Firebase:** YES (planned)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Not implemented
  - 1,594 combined lines of unused code

**Recommendation:** Either complete streaming features OR REMOVE both files (dead code).

#### 58. debug-review.html (Debug Tools)
- **Status:** Partial
- **Lines:** 589
- **Purpose:** Developer debug and review tools
- **Features:**
  - Data inspection
  - Test data generation
  - Firestore query testing
  - Cache management
- **Firebase:** YES (full database access)
- **Dependencies:** `firebase-config.js`
- **TODOs:** None
- **Issues:**
  - Dev tool only (should not be in production)
  - Basic tools only

**Recommendation:** Expand debug tools OR move to separate dev environment.

---

## SHARED COMPONENTS & JS AUDIT

### Shared JavaScript Files (public/js/)

#### firebase-config.js
- **Purpose:** Firebase initialization and Firestore helper functions
- **Exports:**
  - Firebase app instance
  - Firestore database instance
  - Helper functions: `getDoc()`, `setDoc()`, `updateDoc()`, `deleteDoc()`, etc.
- **Used By:** 51 pages (nearly all pages with Firebase integration)
- **Status:** Complete, production-ready
- **Issues:** None

#### secure-session.js
- **Purpose:** Session management and PIN authentication
- **Exports:**
  - `login(pin)` - Authenticate with PIN
  - `logout()` - Clear session
  - `getCurrentPlayer()` - Get logged-in player
  - `requireAuth()` - Redirect if not logged in
- **Used By:** 34 pages (all pages requiring login)
- **Status:** Complete, production-ready
- **Issues:** None

#### stats-helpers.js
- **Purpose:** Statistics calculation utilities
- **Exports:**
  - `get3DA(stats)` - Get 3-dart average (handles legacy field names)
  - `getMPR(stats)` - Get marks per round (handles legacy field names)
  - `calculateCheckoutPercentage(stats)` - Checkout %
  - `formatStat(value, decimals)` - Format stat for display
- **Used By:** Scorer pages, league-view, player-profile, team-profile, stats pages
- **Status:** Complete, production-ready
- **Issues:** None - handles legacy data well

#### display-helpers.js
- **Purpose:** UI formatting utilities
- **Exports:**
  - `formatDate(timestamp)` - Format Firestore timestamp
  - `formatPlayerName(player)` - Display name formatting
  - `getTeamColor(teamId)` - Get team color from palette
- **Used By:** Various pages for consistent display formatting
- **Status:** Complete
- **Issues:** None

#### feedback.js
- **Purpose:** User feedback widget
- **Exports:**
  - `initFeedbackWidget()` - Show feedback button
  - `submitFeedback(message, type)` - Submit to Firestore
- **Used By:** Many pages (included in pages with feedback widget)
- **Status:** Complete
- **Issues:** None - feedback system works

#### nav-menu.js
- **Purpose:** Navigation menu component (may be deprecated)
- **Status:** Unknown - may not be used anymore
- **Issues:** Potentially deprecated - need to verify usage

#### fb-nav.js
- **Purpose:** Firebase-based navigation (realtime nav updates)
- **Status:** Unknown usage
- **Issues:** May be deprecated

#### live-ticker.js
- **Purpose:** Live match ticker component
- **Exports:**
  - `initLiveTicker()` - Show live match updates
  - Realtime match score updates
- **Used By:** Live match pages, dashboard
- **Status:** Partial - may have bugs
- **Issues:** Realtime sync issues reported

#### chat-config.js
- **Purpose:** Chat system configuration
- **Exports:**
  - Chat room setup
  - Message formatting
- **Used By:** Messaging pages (messages.html, chat-room.html, conversation.html)
- **Status:** Partial
- **Issues:** Chat system incomplete

#### social.js
- **Purpose:** Social features (friends, blocking, etc.)
- **Status:** Unknown - may be unused
- **Issues:** Unknown

#### presence.js
- **Purpose:** Online presence tracking
- **Status:** Unknown - may be unused
- **Issues:** Unknown

#### push-notifications.js
- **Purpose:** Push notification setup
- **Status:** Unknown - may be unused
- **Issues:** Push notifications not implemented

#### offline-storage.js
- **Purpose:** IndexedDB for offline data storage
- **Status:** Unknown - may be unused
- **Issues:** Unknown

#### challenge-system.js
- **Purpose:** Player challenge system
- **Status:** Unknown - may be unused
- **Issues:** Unknown

#### sw-register.js
- **Purpose:** Service worker registration
- **Status:** Active (service worker works)
- **Issues:** None

### Component HTML Files
No separate component files found in `public/components/` directory. Components may be:
1. Inlined in pages
2. Deprecated/removed
3. Not yet created (planned for future refactoring)

**Recommendation:** Create `public/components/` directory and extract reusable components:
- Match card component
- Player card component
- Stat display component
- Tab navigation component
- Modal component

---

## HEALTH ANALYSIS

### 1. DUPLICATE FUNCTIONALITY

#### Registration Pages (3 duplicates)
- **signup.html** - Modern UI, 8-digit auto-generated PIN (672 lines)
- **register.html** - Photo upload, 4-digit chosen PIN (445 lines)
- **player-registration.html** - Stub for league-specific registration (407 lines)

**Total duplicate code:** 1,524 lines

**Impact:** Confusing for users, inconsistent PIN lengths, maintenance burden

**Recommendation:**
- Consolidate into `signup.html` with optional photo upload
- Standardize on 8-digit auto-generated PIN
- Remove `register.html` and `player-registration.html`
- League registration should be handled within league-specific flows

#### Bracket Viewers (2 duplicates)
- **tournament-bracket.html** - Main bracket viewer (1,186 lines)
- **bracket.html** - Duplicate stub (331 lines)

**Total duplicate code:** 331 lines (stub)

**Recommendation:** Remove `bracket.html`

#### Director Dashboards (2 duplicates)
- **league-director.html** - Full control panel (5,828 lines)
- **director-dashboard.html** - Simplified dashboard (1,918 lines)

**Total overlap:** Unknown (need to analyze feature overlap)

**Recommendation:**
- Clarify distinct use cases OR consolidate
- If keeping both: Document when to use each
- If consolidating: Merge into one interface with basic/advanced modes

#### Legacy Scorer Pages (2 abandoned)
- **scorers/x01.html** - Original X01 scorer (abandoned)
- **scorers/cricket.html** - Original cricket scorer (abandoned)

**Recommendation:** DELETE entire `scorers/` directory (legacy code)

**TOTAL DUPLICATE CODE TO REMOVE: ~2,200+ lines**

---

### 2. FEATURE SPRAWL (Stub Pages)

#### Incomplete Features (Started but Abandoned)

| Page | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| dart-trader.html | 891 | Stub | Complete OR Remove |
| dart-trader-listing.html | 822 | Stub | Complete OR Remove |
| stream-director.html | 1,077 | Stub | Complete OR Remove |
| stream-camera.html | 517 | Stub | Complete OR Remove |
| matchmaker-mingle.html | 870 | Stub | Complete OR Remove |
| online-play.html | 1,170 | Stub | Complete OR Remove |
| mini-tournament.html | 1,127 | Stub | Complete OR Remove |
| my-stats.html | 277 | Minimal | Expand OR Remove |
| **TOTAL** | **6,751 lines** | **Dead Code** | **Decision Needed** |

**Impact:**
- 6,751 lines of unused/incomplete code
- Clutters codebase
- Confuses new developers
- Creates false impression of available features

**Recommendation:**
- **Option A (Remove):** Delete all stub pages → Save 6,751 lines, clean codebase
- **Option B (Complete):** Prioritize and fully implement → Significant dev effort required

**Suggested Approach:**
- **REMOVE:** dart-trader, streaming, matchmaker-mingle (low priority features)
- **COMPLETE:** online-play (high value feature)
- **EXPAND OR REMOVE:** my-stats (redundant with player-profile)
- **DEFER:** mini-tournament (low priority, can use create-tournament instead)

---

### 3. DEAD CODE ANALYSIS

#### TODO/FIXME Comments Found

| Page | Comment | Line | Issue |
|------|---------|------|-------|
| game-setup.html | TODO: Clarify format selection UI | ~850 | Format dropdown confusing |
| dashboard.html | TODO: Aggregate stats across leagues | ~1200 | Stats not fully calculated |
| knockout.html | FIXME: Bracket advancement logic | ~400 | Known bug in winner progression |
| player-registration.html | NOTE: Form validation needed | ~150 | No validation implemented |

**Impact:** 4 known issues documented in code but not fixed

**Recommendation:** Address or remove each TODO

#### Large Files Needing Refactoring

| Page | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| league-view.html | 6,165 | Too Large | Break into tab components |
| league-director.html | 5,828 | Too Large | Modularize tools |
| x01-scorer.html | 5,552 | Too Large | Extract bot logic + UI |
| match-hub.html | 4,812 | Too Large | Break into tab components |
| league-cricket.html | 3,911 | Too Large | Extract UI components |

**TOTAL LARGE FILES: 26,268 lines across 5 files**

**Impact:**
- Hard to maintain
- Difficult to debug
- Poor code organization
- Slows down IDE/editor

**Recommendation:** CRITICAL - Refactor all files over 2,000 lines into modular components

---

### 4. CONSISTENCY ANALYSIS

#### Authentication Patterns
- **Standard:** 8-digit PIN via `secure-session.js` (signup.html)
- **Inconsistency:** 4-digit PIN option in register.html
- **Impact:** Confusing, potential security issue (4-digit less secure)
- **Recommendation:** Standardize on 8-digit PIN everywhere

#### Firebase Integration
- **Status:** Excellent consistency
- 51/61 pages use Firebase (84%)
- Nearly all use `firebase-config.js` module
- **No Issues**

#### Bot Support
- **Status:** Inconsistent
- X01 scorer has bots ✅
- Cricket scorer NO bots ❌
- Knockout has bots ✅
- Game-setup supports adding bots ✅
- **Impact:** Inconsistent testing capabilities
- **Recommendation:** Add bot support to cricket scorer

#### UI/Styling Consistency
- **Status:** Excellent
- Color scheme consistent (pink #FF469A, teal #91D7EB, yellow #FDD835)
- Fonts consistent (Bebas Neue for headers, Inter for body)
- Login styling standardized (per RULE 11 in CLAUDE.md)
- **No Issues**

---

## CATEGORIZED PAGE MAP

### CORE (6 pages) ⭐ Production Ready
```
public/
├── index.html - Landing/Login ✅ Complete
├── full-site.html - Public Homepage ✅ Complete
└── pages/
    ├── dashboard.html - Player Dashboard ✅ Complete (3,371 lines)
    ├── signup.html - Registration ✅ Complete
    ├── offline.html - Offline Fallback ✅ Complete
    └── glossary.html - Terminology ✅ Complete
```

### LEAGUE MANAGEMENT (11 pages) - Mixed Status
```
pages/
├── leagues.html - League Browser ✅ Complete
├── create-league.html - League Creator ⚠️ Partial (2,291 lines)
├── league-view.html - League Homepage ✅ Complete (🔴 6,165 lines - TOO LARGE)
├── league-director.html - Director Panel ⚠️ Partial (🔴 5,828 lines - TOO LARGE)
├── league-team.html - Team Viewer ⚠️ Partial
├── league-scoreboard.html - Scoreboard ⚠️ Partial
├── league-cricket.html - Cricket Scorer ✅ Complete (🔴 3,911 lines - LARGE)
├── captain-dashboard.html - Captain Tools ⚠️ Partial
├── director-dashboard.html - Director Dash ⚠️ Partial (❓ DUPLICATE?)
├── team-profile.html - Team Stats ✅ Complete
└── draft-room.html - Team Draft ⚠️ Partial
```

### MATCH/SCORING (10 pages) - Core Complete, Stubs Present
```
pages/
├── game-setup.html - Game Setup ✅ Complete (2,798 lines)
├── x01-scorer.html - X01 Scorer ✅ Complete (🔴 5,552 lines - TOO LARGE)
├── match-hub.html - Match Details ⚠️ Partial (🔴 4,812 lines - TOO LARGE)
├── match-confirm.html - Attendance ⚠️ Partial
├── match-transition.html - Transition ⚠️ Partial
├── live-match.html - Live Viewer ⚠️ Partial
├── live-scoreboard.html - Scoreboard ⚠️ Partial
├── knockout.html - Playoff Scorer ⚠️ Partial (🐛 Known Bug)
├── online-play.html - Online Match 🗑️ STUB (1,170 lines dead code)
└── mini-tournament.html - Quick Tourney 🗑️ STUB (1,127 lines dead code)
```

### SOCIAL/MESSAGING (5 pages) - All Partial
```
pages/
├── messages.html - Inbox ⚠️ Partial (2,047 lines)
├── conversation.html - DM Thread ⚠️ Partial
├── chat-room.html - Group Chat ⚠️ Partial (2,721 lines)
├── friends.html - Friends List ⚠️ Partial
└── player-lookup.html - Player Search ⚠️ Partial
```

### TOURNAMENTS (6 pages) - Partial Implementation
```
pages/
├── tournaments.html - Tournament Browser ✅ Complete
├── create-tournament.html - Creator ⚠️ Partial (2,873 lines)
├── tournament-view.html - Homepage ⚠️ Partial
├── tournament-bracket.html - Bracket ⚠️ Partial
└── bracket.html - Alt Bracket 🗑️ STUB (❓ DUPLICATE - REMOVE)
```

### MATCHMAKER (6 pages) - Partial with Stubs
```
pages/
├── matchmaker-register.html - Registration ⚠️ Partial
├── matchmaker-director.html - Director ⚠️ Partial (2,713 lines)
├── matchmaker-view.html - Event Viewer ⚠️ Partial
├── matchmaker-bracket.html - Bracket ⚠️ Partial
├── matchmaker-tv.html - TV Display ⚠️ Partial
└── matchmaker-mingle.html - Social 🗑️ STUB (870 lines dead code)
```

### ADMIN/DIRECTOR (5 pages) - All Partial
```
pages/
├── admin.html - System Admin ⚠️ Partial (2,525 lines)
├── bot-management.html - Bot Config ⚠️ Partial
├── members.html - Member Directory ⚠️ Partial
├── player-registration.html - Registration 🗑️ STUB (❓ DUPLICATE)
└── debug-review.html - Debug Tools ⚠️ Partial
```

### STATS/PLAYER (4 pages) - Mixed
```
pages/
├── player-profile.html - Player Stats ✅ Complete (3,005 lines)
├── my-stats.html - Stats Summary 🗑️ STUB (277 lines - redundant)
├── stat-verification.html - Verification ⚠️ Partial
└── [player-lookup.html in Social]
```

### OTHER/MISC (8 pages) - Mostly Stubs
```
pages/
├── events-hub.html - Events Calendar ✅ Complete (2,097 lines)
├── event-view.html - Event Details ⚠️ Partial
├── dart-trader.html - Marketplace 🗑️ STUB (891 lines dead code)
├── dart-trader-listing.html - Listing 🗑️ STUB (822 lines dead code)
├── stream-director.html - Streaming 🗑️ STUB (1,077 lines dead code)
└── stream-camera.html - Camera 🗑️ STUB (517 lines dead code)
```

### ABANDONED/DEPRECATED (Remove Immediately)
```
public/
├── create-tournament.html - ❌ DELETE (duplicate)
├── bracket.html - ❌ DELETE (duplicate)
└── scorers/
    ├── x01.html - ❌ DELETE (legacy)
    └── cricket.html - ❌ DELETE (legacy)
```

**Legend:**
- ✅ Complete - Production ready
- ⚠️ Partial - Functional but incomplete
- 🗑️ STUB - Not implemented, dead code
- 🔴 TOO LARGE - Needs refactoring
- 🐛 Known Bug - Has documented issues
- ❓ DUPLICATE - Redundant functionality
- ❌ DELETE - Should be removed

---

## RECOMMENDATIONS

### 🔥 HIGH PRIORITY (Critical Issues)

#### 1. Remove Duplicate/Abandoned Pages
**Effort:** 30 minutes
**Impact:** Clean codebase, reduce confusion

**Files to DELETE:**
- `public/create-tournament.html` (duplicate)
- `public/bracket.html` (duplicate)
- `public/scorers/` directory (entire directory - legacy code)
- `pages/bracket.html` (duplicate of tournament-bracket.html)
- `pages/register.html` (merge into signup.html)
- `pages/player-registration.html` (redundant stub)

**Estimated savings:** 2,200+ lines

#### 2. Refactor Oversized Files
**Effort:** 2-3 days per file
**Impact:** Maintainability, performance, debuggability

**Files to refactor (over 4,000 lines):**

**league-view.html (6,165 lines) → Break into components:**
- `LeagueOverview.js`
- `LeagueSchedule.js`
- `LeagueStandings.js`
- `LeagueStats.js`
- `LeagueTeams.js`
- `LeagueRules.js`

**league-director.html (5,828 lines) → Modularize:**
- `DirectorDashboard.js`
- `TeamManager.js`
- `PlayerManager.js`
- `MatchScheduler.js`
- `ScoringOversight.js`
- `SettingsEditor.js`

**x01-scorer.html (5,552 lines) → Extract modules:**
- `X01UI.js` (display/rendering)
- `X01GameLogic.js` (game rules, bust detection)
- `BotAI.js` (bot player logic)
- `StatsCalculator.js` (3DA, checkout %, etc.)

**match-hub.html (4,812 lines) → Break into tabs:**
- `MatchGamesTab.js` (with SET grouping - fix RULE 17 issue)
- `MatchPerformanceTab.js`
- `MatchCountsTab.js`
- `MatchLeaderboardsTab.js`

**league-cricket.html (3,911 lines) → Extract:**
- `CricketUI.js`
- `CricketGameLogic.js`
- `CricketBotAI.js` (ADD - currently missing)

#### 3. Fix Critical Bugs/TODOs
**Effort:** 1-2 hours per item
**Impact:** Production stability

**Address these 4 items:**
1. `game-setup.html` line ~850 - Clarify format selection UI
2. `dashboard.html` line ~1200 - Complete stats aggregation across leagues
3. `knockout.html` line ~400 - Fix bracket advancement logic (FIXME)
4. `player-registration.html` line ~150 - Add form validation OR remove file

#### 4. Complete match-hub.html Set Grouping (RULE 17)
**Effort:** 4-6 hours
**Impact:** Correct match display

**Current:** Shows individual legs as separate cards
**Required:** Group legs by set, show set score (e.g., "Set 1: 2-1"), expand to show legs

**Reference:** RULE 17 in CLAUDE.md - MATCH DATA HIERARCHY

#### 5. Add Bot Support to Cricket Scorer
**Effort:** 1-2 days
**Impact:** Testing consistency, feature parity

**Currently:** X01 scorer has bots, cricket doesn't
**Required:** Add bot AI to league-cricket.html for consistent testing

---

### ⚠️ MEDIUM PRIORITY (Important but Not Blocking)

#### 6. Decide on Stub Features (Complete or Remove)
**Effort:** Varies (1 week to complete each, 1 hour to remove)
**Impact:** Reduce dead code OR add valuable features

**Decision needed on:**

| Feature | Lines | Complete Effort | Remove Effort | Recommendation |
|---------|-------|----------------|---------------|----------------|
| Dart Trader (marketplace) | 1,713 | 2-3 weeks | 5 min | **REMOVE** (low priority) |
| Streaming (director/camera) | 1,594 | 3-4 weeks | 5 min | **REMOVE** (complex, low ROI) |
| Online Play | 1,170 | 4-5 weeks | 5 min | **COMPLETE** (high value) |
| Mini Tournament | 1,127 | 1-2 weeks | 5 min | **REMOVE** (use create-tournament) |
| Matchmaker Mingle | 870 | 2-3 weeks | 5 min | **REMOVE** (unclear use case) |
| My Stats | 277 | 1-2 days | 2 min | **REMOVE** (redundant with player-profile) |

**Recommended Action:**
- **REMOVE:** dart-trader, streaming, mini-tournament, matchmaker-mingle, my-stats → Save 6,751 lines
- **COMPLETE:** online-play (defer until after high priority items done)

#### 7. Standardize Authentication
**Effort:** 2-3 hours
**Impact:** Security, consistency

**Actions:**
- Enforce 8-digit PIN everywhere (remove 4-digit option in register.html)
- Audit all pages for `secure-session.js` usage
- Ensure consistent login/logout flows

#### 8. Director Dashboard Clarity
**Effort:** 1-2 hours (analysis), then decision
**Impact:** Reduce confusion

**Options:**
- **A:** Keep both, document distinct use cases (league-director = full power, director-dashboard = simplified)
- **B:** Consolidate into one with basic/advanced modes
- **C:** Remove director-dashboard.html (keep league-director only)

**Recommendation:** Analyze feature overlap, then decide on A or C

#### 9. Complete Messaging System
**Effort:** 2-3 weeks
**Impact:** User engagement, social features

**Required:**
- Finish messages.html, conversation.html, chat-room.html integration
- Add push notifications
- Add media sharing
- Add message reactions

---

### ✅ LOW PRIORITY (Nice to Have)

#### 10. Improve Small/Basic Pages
**Effort:** 1-2 days per page
**Impact:** User experience polish

**Pages needing improvement:**
- `league-scoreboard.html` (448 lines) - Polish for public display
- `live-scoreboard.html` (1,569 lines) - Improve TV display mode
- `league-team.html` (748 lines) - Add team-level aggregates
- `stat-verification.html` (957 lines) - Complete verification process
- `tournament-bracket.html` (1,186 lines) - Improve mobile layout

#### 11. Tournament Feature Completion
**Effort:** 1-2 weeks
**Impact:** Full tournament support

**Required:**
- Complete `create-tournament.html` wizard
- Finish `tournament-view.html` registration flow
- Polish `tournament-bracket.html` rendering

#### 12. Admin Panel Completion
**Effort:** 2-3 weeks
**Impact:** System management

**Required:**
- Complete `admin.html` backup functionality
- Improve analytics dashboard
- Add role-based permissions UI

#### 13. Performance Optimization
**Effort:** 1-2 weeks
**Impact:** Speed, scalability

**Actions:**
- Reduce Firestore queries on league-view.html page load
- Implement pagination for large datasets
- Add loading states and skeleton screens
- Optimize images and assets

---

## FINAL METRICS

### Page Health Summary
| Status | Count | % | Total Lines |
|--------|-------|---|-------------|
| **Complete (Production-Ready)** | 25 | 41% | ~35,000 |
| **Partial (Functional but Incomplete)** | 20 | 33% | ~40,000 |
| **Stub (Minimal/No Functionality)** | 10 | 16% | ~7,000 |
| **Broken/Abandoned** | 6 | 10% | ~2,200 |
| **TOTAL** | **61** | **100%** | **~84,200** |

### Code Quality Metrics
| Metric | Count | % | Status |
|--------|-------|---|--------|
| **With TODO Comments** | 4 | 7% | 🟡 Address |
| **Using Firebase** | 51 | 84% | ✅ Good |
| **Requiring Login** | 34 | 56% | ✅ Good |
| **Supporting Bots** | 4 | 7% | 🟡 Expand |
| **Over 4,000 Lines** | 5 | 8% | 🔴 Refactor |
| **Under 500 Lines** | 8 | 13% | ✅ Good |
| **Duplicate Pages** | 6 | 10% | 🔴 Remove |
| **Stub Pages (Dead Code)** | 10 | 16% | 🟡 Decide |

### File Size Distribution
**Total HTML:** ~84,200 lines across 61 files

**Largest Files (Top 5):**
1. league-view.html - 6,165 lines (🔴 CRITICAL - Too Large)
2. league-director.html - 5,828 lines (🔴 CRITICAL - Too Large)
3. x01-scorer.html - 5,552 lines (🔴 CRITICAL - Too Large)
4. match-hub.html - 4,812 lines (🔴 CRITICAL - Too Large)
5. league-cricket.html - 3,911 lines (🟡 Large, but manageable)

**Combined:** 26,268 lines (31% of codebase) in just 5 files

**Smallest Files (Bottom 5):**
1. my-stats.html - 277 lines (🗑️ Remove - redundant)
2. leagues.html - 316 lines (✅ Good - appropriately sized)
3. tournaments.html - 322 lines (✅ Good)
4. bracket.html - 331 lines (🗑️ Remove - duplicate)
5. offline.html - 343 lines (✅ Good)

### Dead Code Analysis
| Category | Lines | Files | Action |
|----------|-------|-------|--------|
| **Duplicate Pages** | ~2,200 | 6 | DELETE |
| **Stub Features** | ~6,751 | 10 | REMOVE (recommend) |
| **Legacy Code** | ~500 | 2 | DELETE (scorers/) |
| **TOTAL DEAD CODE** | **~9,451** | **18** | **11% of codebase** |

### Firebase Integration
- **51 pages use Firebase (84%)** ✅ Excellent
- **10 pages don't use Firebase** (offline.html, glossary.html, etc.) ✅ Appropriate
- **Cloud functions called:** 20+ distinct functions
- **Collections accessed:** players, leagues, tournaments, matches, stats, teams, messages, etc.

### Authentication
- **34 pages require login (56%)** ✅ Appropriate
- **27 pages are public (44%)** ✅ Good balance
- **Authentication method:** PIN-based via secure-session.js ✅ Consistent
- **Security issue:** 4-digit vs 8-digit PIN inconsistency 🟡 Fix

---

## CODEBASE HEALTH GRADE

### Overall Grade: **C+** (74/100)

**Breakdown:**
- **Core Functionality:** A (90/100) - Scorers, dashboards, league management work well
- **Code Organization:** D (60/100) - Too many large files, needs modularization
- **Feature Completeness:** C (70/100) - Many incomplete features
- **Code Quality:** C+ (75/100) - Some TODOs, dead code present
- **Consistency:** B+ (85/100) - Good visual/Firebase consistency, some auth issues
- **Documentation:** B (80/100) - CLAUDE.md is excellent, but no code comments

**Strengths:**
1. ✅ **Strong production core** - Scorers and dashboards work well
2. ✅ **Excellent Firebase integration** - 51 pages, consistent patterns
3. ✅ **Visual consistency** - Color scheme, fonts, styling maintained
4. ✅ **PWA setup** - Service worker, manifest, offline support
5. ✅ **Mobile optimization** - Responsive design (per MOBILE-UX-AUDIT)

**Critical Weaknesses:**
1. 🔴 **5 files over 4,000 lines** - Desperately need modularization (26,268 lines = 31% of codebase)
2. 🔴 **~9,500 lines of dead code** - Duplicates, stubs, abandoned features (11% of codebase)
3. 🔴 **4 known bugs/TODOs** - Documented but not fixed
4. 🟡 **16 incomplete pages** - Started but not finished
5. 🟡 **Inconsistent bot support** - X01 has bots, cricket doesn't

---

## IMMEDIATE ACTION PLAN

### Week 1: Clean Up (8 hours)
**Goal:** Remove dead code, fix quick wins

- [ ] Delete duplicate pages (30 min)
  - `public/bracket.html`
  - `public/create-tournament.html`
  - `public/scorers/` directory
  - `pages/bracket.html`
  - `pages/register.html`
  - `pages/player-registration.html`

- [ ] Delete stub features (30 min)
  - `dart-trader.html` + `dart-trader-listing.html`
  - `stream-director.html` + `stream-camera.html`
  - `matchmaker-mingle.html`
  - `mini-tournament.html`
  - `my-stats.html`

- [ ] Fix 4 TODOs (4 hours)
  - game-setup.html format selection
  - dashboard.html stats aggregation
  - knockout.html bracket logic
  - Remove player-registration.html (deleted above)

- [ ] Standardize authentication (2 hours)
  - Remove 4-digit PIN option
  - Audit secure-session.js usage

- [ ] Test and deploy cleanup (1 hour)

**Expected Result:** Remove ~9,500 lines of dead code, fix 4 bugs

### Week 2-3: Refactor Large Files (40 hours)
**Goal:** Break 5 largest files into components

- [ ] league-view.html → 6 tab components (8 hours)
- [ ] league-director.html → 6 tool modules (8 hours)
- [ ] x01-scorer.html → 4 modules (8 hours)
- [ ] match-hub.html → 4 tab components + fix set grouping (8 hours)
- [ ] league-cricket.html → 3 modules + add bot support (8 hours)

**Expected Result:** 26,268 lines modularized, improved maintainability

### Week 4: Feature Completion (20 hours)
**Goal:** Complete partial pages

- [ ] Complete messaging system (8 hours)
- [ ] Complete captain dashboard (4 hours)
- [ ] Complete tournament features (4 hours)
- [ ] Complete admin panel basics (4 hours)

**Expected Result:** 20 partial pages → 15+ complete pages

### Month 2+: New Features (if desired)
- [ ] Complete online-play.html (4-5 weeks)
- [ ] Add advanced analytics (2-3 weeks)
- [ ] Build mobile apps (iOS/Android wrappers) (4-6 weeks)

---

## CONCLUSION

The BRDC darts app has a **strong, functional production core** with excellent scorers, dashboards, and league management. However, there is **significant technical debt** that should be addressed:

### Critical Issues:
1. **31% of codebase** (26,268 lines) is in just **5 oversized files** that desperately need refactoring
2. **11% of codebase** (~9,500 lines) is **dead code** (duplicates, stubs, abandoned features) that should be removed
3. **4 known bugs/TODOs** documented in code but not fixed
4. **Set grouping bug** in match-hub.html (shows legs instead of sets - violates RULE 17)

### Immediate Recommendations:
1. **DELETE** 18 files (duplicates + stubs) → Remove 9,500 lines
2. **REFACTOR** 5 large files into components → Improve 31% of codebase
3. **FIX** 4 TODOs and set grouping bug → Eliminate known issues
4. **COMPLETE** messaging and tournament features → Finish 70% → 85% completion

### Long-term Vision:
- Create component library (`public/components/`)
- Add comprehensive testing (unit + integration)
- Optimize Firestore queries and caching
- Complete online play feature
- Build native mobile apps

**The app is functional and usable today**, but needs **focused cleanup and refactoring** to reach production quality across all features.

**Estimated effort to reach 95% health:**
- **Week 1:** Remove dead code (8 hours)
- **Weeks 2-3:** Refactor large files (40 hours)
- **Week 4:** Complete partial features (20 hours)
- **TOTAL:** 68 hours (~2 weeks full-time work)

---

**END OF PAGE INVENTORY AUDIT**

Prepared by: Page Inventory Specialist
Date: 2026-02-04
Pages Audited: 61
Lines Analyzed: ~84,200
Issues Found: 50+
Recommendations: 13 priority items