# BRDC Project Status

**Last Updated:** 2026-01-19

---

## Vision & Architecture

**Goal:** A global dart club management platform that can scale beyond Cleveland to any dart community worldwide.

**Design Principles:**
- Build features with global scale in mind
- Keep data structures flexible for multi-region/multi-organization use
- Stats system should be source-agnostic (league, tournament, social all use same schema)

**Stats Sources:**
- **League** - Official league matches
- **Tournament** - Tournament matches
- **Social** - Any logged game that isn't league/tournament (pickup games, chat challenges, casual play)
- **Combined** - Aggregate of all sources

**Player Profile Stats Toggle:** League | Tournament | Social | Combined

---

## Quick Reference

| Area | Status | Functions | Pages | Notes |
|------|--------|-----------|-------|-------|
| Leagues | ✅ Active | ~50 | 12 | DartConnect-parity stats |
| Tournaments | ✅ Active | ~10 | 8 | Bracket system working |
| Matchmaker | ✅ Active | ~7 | 4 | Partner draw working |
| Knockout | ✅ Active | ~6 | 1 | 8-team format working |
| Player Profiles | ✅ Active | ~15 | 5 | DC stats tracking (display pending) |
| Messaging | ✅ Active | ~20 | 3 | DMs and chat rooms |
| Social | ✅ Active | ~12 | - | Reactions, cheers, achievements |
| Pickup Games | ✅ Active | ~3 | 2 | DartConnect-parity stats + bots |
| Bot Players | ✅ Active | ~3 | - | Full stats tracking |
| Mini Tournaments | ✅ Active | ~7 | 1 | Quick bracket tournaments |
| Online Play | ✅ Active | ~9 | 1 | Challenges & remote matches |
| Live Streaming | ✅ Active | 1 service | 2 | Full RTMP output to YouTube/Twitch |

---

## Inventory Summary

### Cloud Functions: ~275 total
See [FUNCTIONS.md](./FUNCTIONS.md) for complete list.

| Category | Count | Files |
|----------|-------|-------|
| League Management | ~50 | leagues/index.js |
| Tournament Management | ~10 | tournaments/*.js |
| Admin | ~20 | admin-functions.js |
| Player/Auth | ~25 | player-profile.js, global-auth.js |
| Messaging | ~20 | messaging.js, chat-rooms.js |
| Social | ~12 | social.js |
| Notifications | ~20 | notifications.js, push-notifications.js |
| Stats | ~11 | stats-unification.js |
| Advanced | ~17 | advanced-features.js |
| Import/Migration | ~11 | import-matches.js |
| Legacy | ~60+ | phase-*.js |

### Frontend Pages: 50 total
See [PAGES.md](./PAGES.md) for complete list.

| Category | Count |
|----------|-------|
| Admin/Management | 5 |
| League | 6 |
| Tournament | 6 |
| Matchmaker | 4 |
| Player | 7 |
| Match/Scoring | 12 |
| Messaging | 3 |
| General | 5 |

### Firestore Collections: 25+
See [DATA-STRUCTURE.md](./DATA-STRUCTURE.md) for complete schema.

---

## Current Architecture

### Player ID Strategy ✅ IMPLEMENTED
- Single global player ID used everywhere
- `players/{globalId}` is the master record
- Same ID used in leagues, tournaments, stats, matches
- Verified consistent for trips league (2026-01-18)

### Stats Storage ✅ IMPLEMENTED (DartConnect Parity)
**Architecture:**
- Stats live IN matches (source of truth) with throw-by-throw detail
- Incremental updates on match completion (`updatePlayerStatsFromMatch`)
- Full recalculate function (`recalculatePlayerStats`, `recalculateLeagueStats`)
- "Refresh Stats" button on player profile page
- Stats stored in both league subcollection and global player document
- Bot stats stored in `bots/{botId}.game_stats`

**DartConnect-Parity Stats (47 X01 + 22 Cricket fields):**
- X01: 3DA, First9, AFin, Tons (T00-T80), HSI, HDO, CO%, WD%/AD%, O-3DA
- X01 Checkout Ranges: 80+, 120+, 140+, 161+ tracking
- Cricket: MPR, Miss%, T&B%, 5M-9M rounds, 3B-6B bulls, HT, high_mark_round, low_rounds

**Key Functions:**
- `updatePlayerStatsFromMatch(leagueId, match)` - Called on finalizeMatch/completeMatch
- `recalculatePlayerStats` - Full rebuild from all completed matches
- `recalculateLeagueStats` - Recalculate all players in a league
- `updatePickupPlayerStats` - Pickup/casual game stats
- `updateBotStats` - Bot player stats tracking

---

## Active Tasks

### In Progress
- None

### Next Up
- [ ] Player Profile phase 4: Filter by source, stats breakdown, achievements
- [ ] Integrate live match data with stream overlay
- [ ] Online play with video (remote matches with auto-director)

---

## Dashboard Redesign (2026-01-19) - COMPLETED

**Priority:** Mobile & tablet first - this is where users access the app most

### Header Section - DONE
- [x] Removed "Ready to Throw Some Darts" card - clean avatar layout
- [x] Avatar with stats text next to it (501 avg, MPR)
- [x] Link to full stats page
- [x] Clean, minimal mobile-first design

### Remove Stats Tab - DONE
- [x] Stats tab removed
- [x] Stats summary (501 avg, MPR) now in header next to avatar
- [x] Removed "Play Darts" button

### Settings Tab (NEW) - DONE
- [x] Added Settings tab to dashboard
- [x] Profile editing (first name, last name, phone, email)
- [x] Contact preference toggle (SMS/Email) moved to Settings

### Schedule Tab - Calendar View - DONE
- [x] Converted to calendar view
- [x] Shows league matches and registered tournaments
- [x] Click on day shows popup with event details
- [x] Events link to league-view or tournament-view pages

### Leagues Tab - Team Cards - DONE
- [x] Shows cards with: League name, Team name, Record (W-L)
- [x] Click card goes to league-team.html page

### NEW PAGE: league-team.html - DONE
- [x] Created league-team.html page
- [x] Shows team info within league context
- [x] Team schedule with upcoming/past matches
- [x] Team record and position
- [x] Team roster with player stats
- [x] Team stats breakdown (aggregated from all players)

### Tournaments Tab
- [x] Fixed links to tournament-view.html

### Recently Completed
- [x] **RTMP Streaming Output (2026-01-19)**
  - [x] Created `streaming-relay/` Cloud Run service
  - [x] WebSocket server accepts video chunks from browser
  - [x] FFmpeg transcodes WebM to H.264/AAC for RTMP
  - [x] Supports YouTube Live and Twitch
  - [x] Updated `stream-director.html` with MediaRecorder capture
  - [x] Relay connection UI with status display
  - [x] Real-time bitrate and data sent stats
- [x] **Mini Tournaments UI (2026-01-19)**
  - [x] Created `mini-tournament.html` - Quick bracket tournaments
  - [x] Create tab: Add 2-8 players, set game type, generate bracket
  - [x] Join tab: Enter tournament PIN to join existing tournament
  - [x] History tab: View past tournaments
  - [x] Bracket display with visual match cards
  - [x] Winner selection modal for recording results
  - [x] Auto-advancing BYE matches
- [x] **Online Play/Challenges UI (2026-01-19)**
  - [x] Created `online-play.html` - Remote matches system
  - [x] PIN-based player login with stats display
  - [x] Challenges tab: View received/sent challenges, accept/decline
  - [x] Matches tab: View active matches, start scoring
  - [x] Send Challenge tab: Search players, send challenges
  - [x] History tab: View completed match history
  - [x] User streak and stats bar
- [x] **Audit pages for player_ids format compatibility (2026-01-19)**
  - [x] Updated dashboard.html to support both players[] and player_ids[] formats
  - [x] Updated league-standings.html to support both formats
  - [x] Updated league-view.html to support both formats
  - [x] Updated player-profile.html to support both formats (2 locations)
  - [x] Updated team-profile.html to support both formats
  - [x] player-public.html already had both format support
- [x] **Bot selection in casual scorers (2026-01-19)**
  - [x] Added bot dropdown UI to x01.html casual scorer
  - [x] Added bot dropdown UI to cricket.html casual scorer
  - [x] Both support selecting registered bots with difficulty display
- [x] Created project documentation structure (2026-01-18)
- [x] Audited all cloud functions (275+)
- [x] Audited all frontend pages (48)
- [x] Documented Firestore schema with throw-by-throw detail
- [x] Fixed player-public.html team structure support (2026-01-18)
- [x] Migrated trips league to global IDs (2026-01-18)
- [x] Verified ID consistency (2026-01-18)
- [x] Created `updatePlayerStatsFromMatch` function (2026-01-18)
- [x] Created `recalculatePlayerStats` function (2026-01-18)
- [x] Created `recalculateLeagueStats` function (2026-01-18)
- [x] Wired stats update to finalizeMatch (2026-01-18)
- [x] Wired stats update to completeMatch (2026-01-18)
- [x] Added "Refresh Stats" button to player-public.html (2026-01-18)
- [x] Verified pickup game save flow in x01.html & cricket.html (2026-01-18)
- [x] Verified pickup stats display in player profile (2026-01-18)
- [x] **DartConnect-Parity Stats Implementation (2026-01-19)**
  - [x] Updated `getEmptyPickupStats()` with 47 X01 + 22 Cricket fields
  - [x] Updated `updatePickupPlayerStats()` for all new fields
  - [x] Updated `updateBotStats()` for bot stats tracking
  - [x] Updated `league-501.html` scorer with HSI, ton_points, checkout ranges, with/against darts
  - [x] Updated `league-cricket.html` scorer with six_mark_rounds, high_mark_round, with/against darts
  - [x] Updated `updatePlayerStatsFromMatch()` in leagues/index.js
  - [x] Updated `player-public.html` with full DC stats display
  - [x] Updated `tournaments/stats.js` with DC-parity schema and processing
  - [x] Deployed all functions and hosting

---

## Known Issues

- [x] ~~Some pages use old `player_ids` array format (need audit)~~ - FIXED: All pages now support both formats
- [x] ~~Mini tournaments have functions but no UI~~ - FIXED: mini-tournament.html created
- [x] ~~Online play has functions but no UI~~ - FIXED: online-play.html created

---

## Feature Roadmap

### Phase 1: Stats Refactor ✅ COMPLETE
1. ✅ Create unified stats update function
2. ✅ Wire to league match completion
3. ✅ Wire to tournament match completion
4. ✅ Add recalculate function
5. ✅ Update player profile UI with full DC stats display

### Phase 1b: DartConnect Parity ✅ COMPLETE
1. ✅ Full DC-compatible stats schema (47 X01 + 22 Cricket fields)
2. ✅ Checkout % ranges (80+, 120+, 140+, 161+)
3. ✅ With/Against Darts (LWD, LAD, WD%, AD%)
4. ✅ HSI (High Straight In), Ton Points, O-3DA
5. ✅ Bot stats tracking

### Phase 2: Tournament Stats Pipeline ✅ COMPLETE
1. ✅ Tournament matches store DC-parity stats
2. ✅ Tournament stats aggregate in player profile (all tournaments)
3. ✅ Tournament leaderboard UI (DC-style) exists
4. ✅ recalculateTournamentStats function added

### Phase 3: Pickup Games ✅ COMPLETE
1. ✅ Pickup game save flow working
2. ✅ DartConnect-parity stats tracking
3. ✅ Bot player support
4. ✅ Display all stats in player profile

### Phase 4: Player Profile Enhancements
1. Filter by source (League/Tournament/Pickup)
2. Stats breakdown display
3. Achievement showcase

### Phase 5: Live Streaming ✅ COMPLETE
**Goal:** Stream dart matches live to YouTube/Twitch with video compositing

**Components:**
1. ✅ Phone as board camera (stream-camera.html)
2. ✅ Tablet as thrower camera (stream-camera.html)
3. ✅ Video compositing canvas (stream-director.html)
4. ✅ Scorer overlay (basic done, match integration pending)
5. ✅ "Go Live" button with relay connection
6. ✅ RTMP output via Cloud Run streaming relay

**Pages:**
- `/pages/stream-camera.html` - Camera source (phone/tablet)
- `/pages/stream-director.html` - Director & compositor

**Cloud Run Service:**
- `streaming-relay/` - WebSocket → FFmpeg → RTMP relay

**Future:** Online play with video - players can compete remotely with auto-director switching

---

## File Structure

```
brdc-firebase/
├── docs/                        # 📚 Documentation
│   ├── PROJECT-STATUS.md        # This file - main tracking
│   ├── FUNCTIONS.md             # Cloud functions inventory
│   ├── PAGES.md                 # Frontend pages inventory
│   └── DATA-STRUCTURE.md        # Firestore schema
├── functions/                   # ☁️ Cloud Functions
│   ├── index.js                 # Main exports
│   ├── leagues/                 # League functions
│   ├── tournaments/             # Tournament functions
│   ├── admin-functions.js       # Admin operations
│   ├── player-profile.js        # Player auth/profile
│   ├── global-auth.js           # Global registration
│   ├── messaging.js             # Direct messages
│   ├── chat-rooms.js            # Group chat
│   ├── social.js                # Reactions/cheers
│   ├── notifications.js         # SMS/email notifications
│   ├── push-notifications.js    # FCM push
│   ├── stats-unification.js     # Unified stats
│   ├── knockout.js              # 8-team knockout
│   ├── matchmaker.js            # Partner draw
│   ├── pickup-games.js          # Casual games
│   ├── online-play.js           # Online challenges
│   ├── bots.js                  # Bot players
│   ├── import-matches.js        # Data migration
│   └── ...
├── streaming-relay/             # 📺 RTMP Streaming Service
│   ├── server.js                # WebSocket → FFmpeg → RTMP
│   ├── Dockerfile               # Cloud Run container
│   ├── package.json             # Dependencies
│   └── deploy.sh                # Deployment script
├── public/                      # 🌐 Frontend
│   ├── pages/                   # HTML pages (50 files)
│   ├── js/                      # JavaScript modules
│   ├── css/                     # Stylesheets
│   └── images/                  # Assets
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Database indexes
└── firebase.json                # Firebase config
```

---

## Session Notes

### 2026-01-19 (Current Session - RTMP Streaming)
- **RTMP Streaming Output Implementation**
  - Created `streaming-relay/` directory with Cloud Run service
    - `server.js` - WebSocket server that pipes video to FFmpeg
    - `Dockerfile` - Node.js + FFmpeg container
    - `deploy.sh` - Cloud Run deployment script
    - `README.md` - Documentation
  - Updated `stream-director.html`:
    - Added relay server connection UI
    - Added MediaRecorder to capture canvas as WebM
    - Added WebSocket streaming to relay server
    - Added real-time stats (bitrate, data sent)
    - Added stream status indicators
  - Architecture: Browser → WebSocket → Cloud Run → FFmpeg → RTMP
  - Supports YouTube Live and Twitch platforms
- **Files Created:**
  - `streaming-relay/server.js` - WebSocket + FFmpeg relay
  - `streaming-relay/Dockerfile` - Container config
  - `streaming-relay/package.json` - Dependencies
  - `streaming-relay/deploy.sh` - Deployment script
  - `streaming-relay/README.md` - Documentation
- **Files Modified:**
  - `public/pages/stream-director.html` - Added streaming capture

### 2026-01-19 (Earlier - Mini Tournaments & Online Play UI)
- **Mini Tournaments UI**
  - Created `public/pages/mini-tournament.html`
  - Features:
    - Create tab: Add 2-8 players by name, select game type (501/Cricket), start tournament
    - Join tab: Enter 6-digit tournament PIN to view/participate
    - History tab: View completed tournaments
    - Bracket visualization with match cards showing players and scores
    - Winner selection modal for recording match results
    - Auto-advances BYE matches in first round
    - Uses functions: createMiniTournament, getMiniTournament, recordMiniTournamentMatch, getMiniTournamentHistory
- **Online Play/Challenges UI**
  - Created `public/pages/online-play.html`
  - Features:
    - PIN-based login for players
    - User stats bar showing name, average, and current streak
    - Challenges tab: View received and sent challenges, accept/decline with swipe or buttons
    - Matches tab: View active matches ready to play
    - Send Challenge tab: Search for players, set game parameters, send challenge
    - History tab: View completed match results
    - Uses functions: getPendingChallenges, respondToChallenge, getActiveOnlineMatches, sendChallenge, getOnlineMatchHistory
- **Files Created:**
  - `public/pages/mini-tournament.html` - Quick bracket tournaments
  - `public/pages/online-play.html` - Online challenges & matches

### 2026-01-19 (Earlier - Streaming)
- **Phase 1 Live Streaming Implementation**
  - Created `stream-camera.html` - Camera source page for phone/tablet
    - Camera selection and preview
    - Role selection (Board Camera or Thrower Camera)
    - WebRTC connection to stream director via Firestore signaling
    - Session code entry to join streaming session
  - Created `stream-director.html` - Director page for compositing
    - Creates streaming session with 6-character code
    - Receives two video feeds via WebRTC
    - Canvas compositing with multiple layout options:
      - Side by Side (board left, thrower right)
      - Picture-in-Picture (board main + thrower PIP)
      - Picture-in-Picture (thrower main + board PIP)
      - Board Only
    - Basic scorer overlay (placeholder for match integration)
    - Go Live button (UI ready, RTMP not yet implemented)
    - FPS counter and connection status
  - Added Firestore rules for `streaming_sessions` collection
  - WebRTC signaling uses Firestore for offer/answer/ICE candidate exchange
- **Files Created:**
  - `public/pages/stream-camera.html` - Camera source
  - `public/pages/stream-director.html` - Director/compositor
- **Files Modified:**
  - `firestore.rules` - Added streaming_sessions rules

### 2026-01-19 (Current Session - Continued)
- **Player ID Format Compatibility Audit**
  - System has two team player formats:
    - OLD: `player_ids[]`, `player_names[]`, `player_levels[]` (parallel arrays)
    - NEW: `players[]` (array of objects with {id, name, level})
  - Updated all pages to normalize player data and support both formats
  - Pages updated: dashboard.html, league-standings.html, league-view.html, player-profile.html (2 places), team-profile.html
  - player-public.html already had dual format support
- **Bot Selection in Casual Scorers**
  - Added bot dropdown buttons to x01.html setup screen (Player 1 & Player 2)
  - Added bot dropdown buttons to cricket.html scoring interface
  - CSS styles for bot buttons, dropdowns, and selection states
  - JS functions: loadRegisteredBots, toggleBotDropdown, selectBot, clearBot
  - Both scorers now call getBots API and display available bots with difficulty levels
  - Selected bot disables name input and sets isBot flag on gameState
  - Bot selection is passed through to savePickupGame for stats tracking
- **Files Modified:**
  - `public/pages/x01.html` - Bot selection UI + JS
  - `public/pages/cricket.html` - Bot selection UI + JS
  - `public/pages/dashboard.html` - Dual format support
  - `public/pages/league-standings.html` - Dual format support
  - `public/pages/league-view.html` - Dual format support
  - `public/pages/player-profile.html` - Dual format support (2 locations)
  - `public/pages/team-profile.html` - Dual format support

### 2026-01-19 (Earlier)
- **DartConnect-Parity Stats Implementation**
  - Implemented full DC-compatible stats schema (47 X01 + 22 Cricket fields)
  - Added checkout % tracking for ranges: 80-119, 120-139, 140-160, 161-170
  - Added With/Against Darts tracking (who threw first)
  - Added HSI (High Straight In), Ton Points, O-3DA (Opponent Average)
  - Added cricket six_mark_rounds, high_mark_round, low_rounds
- **Bot Stats Tracking**
  - Bot profiles now track full game_stats
  - Stats visible on bot profile pages
- **Player Profile Display**
  - Full DC-compatible stats display in player-public.html
  - Summary cards: 3DA, First9, MPR, CO%, 180s, HDO
  - X01 Detailed: Averages, records, legs/win rate, tons breakdown, checkouts by range
  - Cricket Detailed: Core stats, legs/win rate, mark rounds, bull rounds
  - With/Against Darts stats for both games
- **Tournament Stats**
  - Updated `tournaments/stats.js` with full DC-parity schema
  - All new fields: HSI, checkout ranges, with/against darts, opponent tracking
  - Tournament leaderboard already has DC-style UI
  - Player profile now loads stats from ALL tournaments (aggregated)
  - Added `recalculateTournamentStats` function for rebuilding stats
- **Files Modified:**
  - `functions/pickup-games.js` - Stats schema + pickup/bot processing
  - `functions/leagues/index.js` - League stats processing
  - `functions/tournaments/stats.js` - Tournament stats processing
  - `public/pages/league-501.html` - X01 scorer with new fields
  - `public/pages/league-cricket.html` - Cricket scorer with new fields
  - `public/pages/player-public.html` - Full DC stats display
- **Deployed:** All functions and hosting

### 2026-01-18
- Established documentation structure
- Completed full codebase audit
- Confirmed player ID consistency
- Fixed player-public.html to support both team structures
- Discussed stats architecture refactor:
  - Stats live in matches (source of truth)
  - Player profile aggregates on demand
  - Incremental updates + recalculate button
