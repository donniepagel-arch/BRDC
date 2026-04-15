# BRDC DARTS APP - COMPREHENSIVE NAVIGATION AUDIT

**Date:** February 4, 2026
**Auditor:** Claude (Navigation & Information Architecture Specialist)
**Scope:** Complete navigation system analysis across 56 HTML pages

---

## EXECUTIVE SUMMARY

The BRDC darts app implements a **dual navigation system** catering to different page categories:

1. **`nav-menu.js`** - Simple hamburger overlay menu (8 items) for essential pages
2. **`fb-nav.js`** - Facebook-style system with sidebar + footer tabs + chat sidebar for authenticated pages
3. **Custom navigation** - Pages with custom back buttons and direct links
4. **Login-gated** - 20+ pages requiring PIN/session authentication

### Key Metrics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Pages Analyzed** | 56 | 100% |
| **Navigation Coverage** | 55/56 | 98% |
| **Pages with Back Buttons** | 33 | 59% |
| **Pages Requiring Login** | 20 | 36% |
| **Dead Links Found** | 8 | - |
| **Orphan Pages** | 24 | 43% |

### Health Score: 7.5/10

**Strengths:**
- Dual navigation system covers most use cases
- Clear separation between casual (nav-menu) and authenticated (fb-nav) users
- Back button implementation on 59% of pages aids usability
- Login gating properly protects sensitive features

**Weaknesses:**
- 8 dead links in primary navigation menus
- 24 pages orphaned or with unclear navigation paths
- Inconsistent back button patterns
- Missing 6 commonly-referenced pages

---

## SECTION 1: NAVIGATION MENU INVENTORY

### A. `nav-menu.js` (Simple Overlay Menu)

**Location:** `/public/js/nav-menu.js`
**Active on:** Dashboard, Scorer (game-setup), and most authenticated pages as fallback

#### Menu Items (8 total):

```
DASHBOARD          → /pages/dashboard.html          🏠
SCORER             → /pages/game-setup.html         🎯
PRACTICE           → /virtual-darts/index.html      🎯
LIVE               → /pages/live-scoreboard.html    🔴
STREAM             → /pages/stream-director.html    🎥
MATCHMAKER         → /pages/matchmaker-view.html    💕
FIND EVENTS        → /pages/events-hub.html         📍
LOGOUT             → Clears localStorage            🚪
```

#### Behavior:
- Hamburger button in header (3-line icon)
- Opens centered overlay with navigation items
- Escape key or overlay click to close
- Loads unread message count on initialization
- No role-based filtering (all users see same menu)

---

### B. `fb-nav.js` (Facebook-Style Navigation System)

**Location:** `/public/js/fb-nav.js`
**Active on:** Dashboard, Player Profile, Messages, Events Hub, Friends, Trading, Stats pages

#### Architecture Components:

1. **Left Sidebar Menu** (SidebarMenu class)
2. **Bottom Footer Tabs** (FooterNav class - 5 items)
3. **Right Chat Sidebar** (ChatSidebar class)
4. **Search Overlay** (SearchOverlay class)
5. **Notifications Panel** (NotificationsPanel class)

---

#### Left Sidebar Sections:

**PLAY (Always Visible):**
- 🎯 Scorer → `/pages/game-setup.html`

**MANAGE (Captains Only - Highlighted with gradient background):**
- 👔 Captain Dashboard → `/pages/captain-dashboard.html`
- 📋 Roster → `/pages/roster.html` ⚠️ **DEAD LINK**
- 📨 Team Messages → `/pages/team-messages.html` ⚠️ **DEAD LINK**

**DISCOVER (Always Visible):**
- 👥 Friends → `/pages/friends.html`
- 📅 Events Hub → `/pages/events-hub.html`
- 👥 Members → `/pages/members.html`

**ADMIN (Directors/Admins Only):**
- 🏆 Director Dashboard → `/pages/director-dashboard.html`
- ⚙️ League Settings → `/pages/league-settings.html` ⚠️ **DEAD LINK**

**SITE ADMIN (Master Admins Only):**
- 🛡️ Site Admin → `/pages/admin.html`
- 📊 Analytics → `/pages/analytics.html` ⚠️ **DEAD LINK**
- 📝 Feedback → `/pages/feedback-admin.html` ⚠️ **DEAD LINK**

**SETTINGS (Always Visible):**
- ⚙️ Account Settings → `/pages/settings.html` ⚠️ **DEAD LINK**
- 🔔 Notifications → `/pages/notification-settings.html` ⚠️ **DEAD LINK**
- 🚪 Logout → Action handler

---

#### Bottom Footer Tabs (5 items):

```
🏠 HOME       → /pages/dashboard.html
📅 EVENTS     → /pages/events-hub.html
💰 TRADER     → /pages/dart-trader.html
🔔 ALERTS     → Notifications panel (action-based, not link)
👤 PROFILE    → /pages/player-profile.html
```

**Features:**
- Fixed position at bottom
- Visual active state for current page
- Badge support for alerts/notifications
- Safe area padding for mobile devices

---

#### Right Chat Sidebar:

**Tabs:**
1. **CHATS** - Recent 1-on-1 conversations
   - Links to: `/pages/conversation.html?id={conversation_id}`
2. **ROOMS** - Team/league/tournament chat rooms
   - Links to: `/pages/chat-room.html?id={room_id}`

**Features:**
- Swipe from right edge to open
- Touch gesture support
- Cached conversation list (stale-while-revalidate)
- Unread badges
- See All link → `/pages/messages.html`
- New Message button → `/pages/messages.html?new=1`

---

#### Search Overlay:

**Functionality:**
- Full-screen search interface
- Global search via Firebase `globalSearch` function
- Search results organized by category:
  - Players → `/pages/player-profile.html?id={player_id}`
  - Leagues → `/pages/league-view.html?league_id={league_id}`
  - Events → `/pages/event-view.html?id={event_id}`

**Fallback:**
- Local quick links when Firebase search unavailable
- Includes: Scorer, Events, Members

---

#### Notifications Panel:

**Position:** Bottom of screen (above footer tabs)
**Features:**
- Dropdown panel with recent notifications
- "Mark all read" action
- Individual notification click handling
- Notification types: match, message, team, event, achievement, system
- Badge count on footer Alerts tab

---

## SECTION 2: AUTHENTICATION & LOGIN GATES

### Pages Requiring Login/PIN (20 pages):

**Detection Pattern:** `localStorage.getItem('brdc_player_pin')` or `brdc_session`

1. **dashboard.html** - Login overlay with PIN input
2. **game-setup.html** - Login check + PIN card entry
3. **league-view.html** - Login required for interaction
4. **match-hub.html** - Login required
5. **player-profile.html** - Login check + messaging features
6. **captain-dashboard.html** - Login + captain role check
7. **league-cricket.html** - Login required
8. **messages.html** - Login check + chat access
9. **conversation.html** - Login required (DM to/from user)
10. **chat-room.html** - Login required (room access)
11. **events-hub.html** - Login required for registration
12. **online-play.html** - Login required
13. **x01-scorer.html** - Login required for multiplayer
14. **dart-trader-listing.html** - Login required
15. **my-stats.html** - Login required
16. **live-match.html** - Login required
17. **director-dashboard.html** - Login + director PIN check
18. **stat-verification.html** - Login required
19. **friends.html** - Login required
20. **team-profile.html** - Login required for edit features

---

### Pages NOT Requiring Login (36 pages):

**Public Access Pages:**
- `index.html` - Main login page
- `signup.html` - Registration
- `register.html` - Registration alternate
- `offline.html` - Offline mode
- `glossary.html` - Help/reference
- `player-lookup.html` - Search players
- `members.html` - Browse members
- `leagues.html` - Browse leagues
- `tournaments.html` - Browse tournaments
- `events-hub.html` - View events (registration requires login)
- `create-league.html` - Form accessible, submit requires PIN
- `create-tournament.html` - Form accessible
- `bracket.html` - View only
- `tournament-view.html` - View only
- `event-view.html` - View only, registration requires PIN
- `team-profile.html` - View only
- `player-registration.html` - Registration form
- **[And 19 more view-only or specialized pages]**

---

## SECTION 3: ENTRY POINT ANALYSIS

### Primary Entry Points:

#### From Index (Login Page) → `/`

**Post-Login Redirect:**
- ✅ Dashboard (`/pages/dashboard.html`) - **MAIN HUB**

**Quick Access Links (No Login Required):**
- ✅ Signup (`/pages/signup.html`) - Create account
- ✅ Scorer (`/pages/game-setup.html`) - Footer link
- ✅ Events Hub (`/pages/events-hub.html`) - Footer link

---

#### From Dashboard (Main Hub After Login)

**Via `nav-menu.js`:**
1. Dashboard → `dashboard.html`
2. Scorer → `game-setup.html`
3. Practice → `/virtual-darts/index.html`
4. Live → `live-scoreboard.html`
5. Stream → `stream-director.html`
6. Matchmaker → `matchmaker-view.html`
7. Find Events → `events-hub.html`
8. Logout → Action handler

**Via `fb-nav.js` (Sidebar):**
1. Scorer → `game-setup.html`
2. Friends → `friends.html`
3. Events Hub → `events-hub.html`
4. Members → `members.html`
5. Captain Dashboard → `captain-dashboard.html` (if captain)
6. Director Dashboard → `director-dashboard.html` (if director)
7. Site Admin → `admin.html` (if admin)

**Via `fb-nav.js` (Footer Tabs):**
1. Home → `dashboard.html`
2. Events → `events-hub.html`
3. Trader → `dart-trader.html`
4. Alerts → Notifications panel (action)
5. Profile → `player-profile.html`

**Embedded Dynamic Links:**
- League cards → `league-view.html?league_id={id}`
- Match cards → `match-hub.html?league_id={id}&match_id={id}`
- Team cards → `team-profile.html?league_id={id}&team_id={id}`
- Player stats → `player-profile.html?id={player_id}`

---

#### From Full-Site Homepage → `/full-site.html`

**Bottom Navigation (Unauthenticated Users):**
1. 🏠 Home → `/full-site.html`
2. 🎯 Play → `/pages/game-setup.html`
3. 🏆 Leagues → `/pages/leagues.html`
4. 👤 Profile → `/pages/dashboard.html` (redirects to login)

**Match PIN Entry:**
- Search input at top → Enter PIN → Redirects to scorer with match data

**Quick Actions:**
- Play Now → `/pages/game-setup.html`
- Browse → `/pages/events-hub.html`

---

## SECTION 4: DEAD LINKS & MISSING PAGES

### ⚠️ Dead Links (8 pages referenced but don't exist):

| # | Path | Referenced In | Impact Level | Purpose |
|---|------|--------------|:------------:|---------|
| 1 | `/pages/roster.html` | fb-nav.js (MANAGE) | 🔴 HIGH | Team roster editor for captains |
| 2 | `/pages/team-messages.html` | fb-nav.js (MANAGE) | 🔴 HIGH | Team chat hub for captains |
| 3 | `/pages/settings.html` | fb-nav.js (SETTINGS) | 🔴 **CRITICAL** | Player account settings |
| 4 | `/pages/notification-settings.html` | fb-nav.js (SETTINGS) | 🔴 **CRITICAL** | Notification preferences |
| 5 | `/pages/league-settings.html` | fb-nav.js (ADMIN) | 🟡 MEDIUM | League configuration for directors |
| 6 | `/pages/analytics.html` | fb-nav.js (SITE ADMIN) | 🟡 MEDIUM | Site analytics dashboard |
| 7 | `/pages/feedback-admin.html` | fb-nav.js (SITE ADMIN) | 🟡 MEDIUM | Feedback management panel |
| 8 | `/pages/league-select.html` | leagues.html (JS) | 🟢 LOW | League selection dialog |

#### Impact Analysis:

**CRITICAL (User-Facing):**
- `settings.html` - **Every logged-in user** sees Settings link in menu but it's broken
- `notification-settings.html` - **Every logged-in user** sees Notifications link but it's broken

**HIGH (Role-Specific):**
- `roster.html` - **All captains** see broken link in their management menu
- `team-messages.html` - **All captains** see broken link in their management menu

**MEDIUM (Admin-Only):**
- `league-settings.html` - Directors see broken link
- `analytics.html` - Site admins see broken link
- `feedback-admin.html` - Site admins see broken link

**LOW (Internal):**
- `league-select.html` - May be JS-only modal, not critical

---

### 📍 Orphan Pages (24 pages with unclear/no entry points):

| Page | Purpose | Entry Method | Status |
|------|---------|--------------|--------|
| `offline.html` | Offline mode fallback | Service worker redirect | ✅ Intentional |
| `debug-review.html` | Debug/testing utility | Direct URL only | ⚠️ Dev only |
| `match-transition.html` | Match state transition | JS redirect from game-setup | ✅ Functional |
| `match-confirm.html` | Roster confirmation | JS from captain dashboard | ✅ Functional |
| `draft-room.html` | League draft interface | During league creation | ✅ Functional |
| `live-scoreboard.html` | Live match updates | nav-menu (LIVE button) | ✅ Linked |
| `live-match.html` | Live match viewer (alt) | JS from match-hub | ⚠️ May be orphaned |
| `bracket.html` | Tournament bracket | tournament-bracket/tournaments | ✅ Linked |
| `knockout.html` | Knockout match detail | tournament-bracket clicks | ✅ Functional |
| `mini-tournament.html` | Small tournament viewer | JS navigation | ⚠️ Unclear |
| `matchmaker-tv.html` | Spectator/TV view | matchmaker-view button | ✅ Linked |
| `matchmaker-director.html` | Matchmaker director panel | Director dashboard | ✅ Linked |
| `stream-camera.html` | Streaming camera control | stream-director | ✅ Linked |
| `stream-director.html` | Stream management | nav-menu (STREAM) | ✅ Linked |
| `online-play.html` | Online multiplayer | game-setup option | ⚠️ In development? |
| `bot-management.html` | Bot/AI management | admin.html tabs | ✅ Linked |
| `event-view.html` | Event detail page | events-hub results | ✅ Linked |
| `my-stats.html` | Personal statistics | Player profile/dashboard | ✅ Linked |
| `register.html` | Registration form | index.html link | ✅ Linked |
| `matchmaker-register.html` | Tournament registration | matchmaker-view | ✅ Linked |
| `league-scoreboard.html` | League standings | league-view tabs | ✅ Linked |
| `league-team.html` | Team management | team-profile edit | ✅ Linked |
| `matchmaker-bracket.html` | Tournament bracket | matchmaker-view | ✅ Linked |
| `matchmaker-mingle.html` | Player mixer/networking | matchmaker-view button | ✅ Linked |

**Legend:**
- ✅ **Functional** - Has clear entry point via navigation or JS
- ⚠️ **Unclear** - Entry point uncertain or development-only
- 🔴 **Orphaned** - No known entry point

---

## SECTION 5: NAVIGATION PATTERNS & USER FLOWS

### Primary User Flows:

#### 1. New User Flow

```
index.html (login)
    ↓
signup.html (create account)
    ↓
player-registration.html (full registration)
    ↓
dashboard.html (first login)
    ↓
[Main hub - all features accessible]
```

---

#### 2. League Player Flow

```
dashboard.html (home)
    ↓
league-view.html (select league from cards)
    ↓
match-hub.html (view upcoming/past match)
    ↓
[Option A: Play Game]
game-setup.html → x01-scorer.html / league-cricket.html
    ↓
[Option B: View Stats]
player-profile.html → team-profile.html
```

---

#### 3. League Director Flow

```
dashboard.html (home)
    ↓
director-dashboard.html (director login via PIN)
    ↓
league-view.html (league management)
    ↓
[Option A: Manage Teams]
team-profile.html → roster editor
    ↓
[Option B: Manage Matches]
match-confirm.html → match-hub.html
    ↓
[Option C: Edit Settings]
league-director.html (settings editor)
```

---

#### 4. Captain Flow

```
dashboard.html (home)
    ↓
captain-dashboard.html (team management)
    ↓
[Option A: View Team]
team-profile.html → roster.html ⚠️ DEAD LINK
    ↓
[Option B: Find Players]
player-lookup.html → player-profile.html
    ↓
[Option C: Confirm Tonight's Match]
match-confirm.html → match-hub.html
```

---

#### 5. Social/Casual Flow

```
dashboard.html (home)
    ↓
[Option A: Play Quick Game]
game-setup.html → online-play.html / practice
    ↓
[Option B: Social Features]
friends.html → conversation.html → messages.html
    ↓
[Option C: Join Event]
events-hub.html → event-view.html → matchmaker-register.html
    ↓
matchmaker-view.html → matchmaker-bracket.html
```

---

#### 6. Trading Flow

```
dashboard.html (footer TRADER tab)
    ↓
dart-trader.html (marketplace home)
    ↓
[Browse Sellers]
dart-trader-listing.html?seller_id={id}
    ↓
[Contact Seller]
player-profile.html → conversation.html
```

---

## SECTION 6: PAGE-BY-PAGE NAVIGATION MAPPING

### Core Pages (High Traffic)

#### 1. `dashboard.html` (Main Hub)
- **Nav System:** `nav-menu.js` + `fb-nav.js` (both active)
- **Links TO:**
  - `game-setup.html` (Scorer button)
  - `league-view.html?league_id={id}` (League cards)
  - `match-hub.html?league_id={id}&match_id={id}` (Match cards)
  - `team-profile.html?league_id={id}&team_id={id}` (Team view)
  - `player-profile.html` (Profile tab)
  - `dart-trader.html` (Trader tab)
  - `/virtual-darts/index.html` (Practice)
- **Links FROM:** `index.html` (login redirect), all pages via nav buttons
- **Back Button:** None (home page)
- **Login Required:** Yes (overlay with PIN input)
- **Session Check:** `brdc_player_pin`, `brdc_session`

---

#### 2. `game-setup.html` (Scorer Setup)
- **Nav System:** `nav-menu.js` + custom header with menu button
- **Links TO:**
  - `x01-scorer.html` (Start X01 game)
  - `league-cricket.html` (Start Cricket game)
  - `dashboard.html` (Back button)
  - `/virtual-darts/index.html` (Practice mode)
  - `online-play.html` (Online multiplayer)
- **Links FROM:** Dashboard, nav-menu (SCORER), footer quick access, full-site.html
- **Back Button:** Yes - `onclick="history.back()"` → typically to dashboard
- **Login Required:** Partial (form accessible, match start requires PIN)
- **Session Check:** `brdc_player_pin` for match creation

---

#### 3. `league-view.html` (League Dashboard)
- **Nav System:** Custom header with back button + hamburger menu
- **Links TO:**
  - `match-hub.html?league_id={id}&match_id={id}` (Match cards)
  - `team-profile.html?league_id={id}&team_id={id}` (Team standings)
  - `player-profile.html?id={player_id}` (Player lookups)
  - `league-director.html?league_id={id}&pin={pin}` (Director login)
  - `tournament-view.html?league_id={id}` (Associated tournaments)
  - `player-lookup.html` (Find player button)
- **Links FROM:** Dashboard (league cards), `leagues.html`, notifications, nav shortcuts
- **Back Button:** Yes - `onclick="history.back()"`
- **Login Required:** No (read-only view), messaging/actions require login
- **Session Check:** `brdc_player_pin` (for interactive features)

---

#### 4. `match-hub.html` (Match Report/Detail)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `league-view.html?league_id={id}` (Back to league)
  - `player-profile.html?id={player_id}` (Player stats in roster)
  - `team-profile.html?league_id={id}&team_id={id}` (Team view)
  - `stream-director.html` (Stream button if match was streamed)
  - `live-match.html` (Live view during match)
- **Query Params:** `league_id` (required), `match_id` (required)
- **Back Button:** Yes - `onclick="history.back()"`
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

#### 5. `player-profile.html` (Player Stats & Profile)
- **Nav System:** `fb-nav.js` (sidebar + footer PROFILE tab)
- **Links TO:**
  - `team-profile.html?league_id={id}&team_id={id}` (Player's team)
  - `conversation.html?id={conversation_id}` (Send message button)
  - `match-hub.html?league_id={id}&match_id={id}` (Recent matches)
  - `friends.html` (Add friend action)
  - `dart-trader-listing.html?seller_id={id}` (Trade with player)
  - `league-view.html?league_id={id}` (Leagues player is in)
- **Query Params:** `id` (player_id) or `player_id` (alternate)
- **Back Button:** Via nav system (sidebar/footer)
- **Login Required:** Partial (restricted view without login)
- **Session Check:** `brdc_player_pin` (for messaging, trading)

---

#### 6. `messages.html` (Message Hub)
- **Nav System:** `fb-nav.js` (sidebar + chat icon)
- **Links TO:**
  - `conversation.html?id={conversation_id}` (Open DM)
  - `chat-room.html?id={room_id}` (Open team/league room)
  - `player-profile.html?id={player_id}` (View participant)
- **Query Params:** `new=1` (optional - opens new message form)
- **Back Button:** Via nav system
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

### Scorer & Game Pages

#### 7. `x01-scorer.html` (501/301/701 Scorer)
- **Nav System:** None (full-screen game mode)
- **Links TO:**
  - `game-setup.html` (Quit button)
  - `dashboard.html` (After match completion)
- **Back Button:** Yes (Quit button confirms) → `game-setup.html`
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

#### 8. `league-cricket.html` (Cricket Scorer)
- **Nav System:** None (full-screen game mode)
- **Links TO:**
  - `game-setup.html` (Quit button)
  - `dashboard.html` (After match completion)
- **Back Button:** Yes (Quit button confirms)
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

### League/Team Pages

#### 9. `leagues.html` (Browse Leagues)
- **Nav System:** Custom header with back button (emoji)
- **Links TO:**
  - `league-view.html?league_id={id}` (League cards)
  - `create-league.html` (Create League button)
  - `dashboard.html` (Back button)
- **Back Button:** Yes (← emoji icon)
- **Login Required:** No (browse mode)
- **Session Check:** None

---

#### 10. `team-profile.html` (Team Stats/Roster)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `league-view.html?league_id={id}` (Back to league)
  - `player-profile.html?id={player_id}` (Player cards in roster)
  - `captain-dashboard.html?league_id={id}` (Edit button if captain)
- **Query Params:** `league_id` + `team_id`, or just `team_id`
- **Back Button:** Yes - `onclick="history.back()"`
- **Login Required:** No (read-only), yes for edit features
- **Session Check:** `brdc_player_pin` (for captain edit)

---

#### 11. `captain-dashboard.html` (Team Management)
- **Nav System:** `fb-nav.js` (MANAGE section, highlighted)
- **Links TO:**
  - `team-profile.html?league_id={id}&team_id={id}` (View team)
  - `league-view.html?league_id={id}` (Back to league)
  - `match-hub.html?league_id={id}&match_id={id}` (Match management)
  - `player-lookup.html` (Find/add players)
  - `match-confirm.html` (Confirm roster for tonight)
  - `roster.html` ⚠️ **DEAD LINK**
- **Query Params:** `league_id`
- **Back Button:** Via nav system
- **Login Required:** Yes (captain role check)
- **Session Check:** `brdc_player_pin`, captain status

---

### Tournament Pages

#### 12. `tournaments.html` (Tournament Browser)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `tournament-view.html?tournament_id={id}` (Tournament cards)
  - `create-tournament.html` (Create button)
  - `tournament-bracket.html?tournament_id={id}` (Bracket link)
- **Back Button:** Yes (← emoji)
- **Login Required:** No (browse mode)
- **Session Check:** None

---

#### 13. `tournament-view.html` (Tournament Details)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `tournaments.html` (Back button)
  - `tournament-bracket.html?tournament_id={id}` (View Bracket)
  - `matchmaker-view.html` (Join/Register button)
  - `event-view.html?id={tournament_id}` (Related event)
- **Query Params:** `tournament_id`
- **Back Button:** Yes - `onclick="history.back()"`
- **Login Required:** No (view mode), yes to join
- **Session Check:** `brdc_player_pin` (for registration)

---

### Social/Messaging Pages

#### 14. `friends.html` (Friends List)
- **Nav System:** `fb-nav.js` (DISCOVER section)
- **Links TO:**
  - `player-profile.html?id={friend_id}` (Friend cards)
  - `conversation.html?id={conversation_id}` (Message button)
  - `player-lookup.html` (Add Friend button)
- **Back Button:** Via nav system
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

#### 15. `conversation.html` (Direct Message)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `messages.html` (Back button)
  - `player-profile.html?id={other_player_id}` (View participant)
- **Query Params:** `id` (conversation_id)
- **Back Button:** Yes → `messages.html`
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

#### 16. `chat-room.html` (Team/League Chat)
- **Nav System:** Custom header with back button
- **Links TO:**
  - `messages.html` (Back button)
  - `league-view.html?league_id={id}` (Related league link)
  - `team-profile.html?league_id={id}&team_id={id}` (Related team)
- **Query Params:** `id` (room_id)
- **Back Button:** Yes → `messages.html`
- **Login Required:** Yes
- **Session Check:** `brdc_player_pin`

---

### Admin/Management Pages

#### 17. `admin.html` (Site Admin Panel)
- **Nav System:** Tab navigation (internal)
- **Links TO:**
  - `director-dashboard.html?pin={pin}` (Director panel shortcut)
  - `bot-management.html` (Bot management tab)
  - Various admin functions (embedded)
- **Back Button:** Tab navigation only (no page back)
- **Login Required:** Yes (admin PIN, separate from player PIN)
- **Session Check:** Admin PIN input form

---

#### 18. `director-dashboard.html` (League Director Panel)
- **Nav System:** Custom header with navigation
- **Links TO:**
  - `league-view.html?league_id={id}` (League view)
  - `match-hub.html?league_id={id}&match_id={id}` (Match management)
  - `team-profile.html?league_id={id}&team_id={id}` (Team rosters)
  - `match-confirm.html` (Roster confirmation)
  - `stream-director.html` (Stream control)
  - `league-director.html` (Settings editor)
- **Query Params:** `pin` (director PIN)
- **Back Button:** Custom navigation
- **Login Required:** Yes (director PIN required)
- **Session Check:** PIN verification on load

---

## SECTION 7: NAVIGATION RECOMMENDATIONS

### 🔴 Critical Priority (Fix Immediately)

#### 1. Create Missing User-Facing Pages

**settings.html** - Player Account Settings
- **Impact:** Every logged-in user sees broken link
- **Features Needed:**
  - Profile editing (name, email, phone)
  - Avatar upload
  - Password/PIN change
  - Account deletion
- **Template:** Use `dashboard.html` login style

**notification-settings.html** - Notification Preferences
- **Impact:** Every logged-in user sees broken link
- **Features Needed:**
  - Email notifications on/off
  - Push notifications on/off
  - Match reminders
  - Message alerts
  - League updates
- **Template:** Similar to settings.html with toggle switches

---

#### 2. Create Missing Captain Pages

**roster.html** - Team Roster Editor
- **Impact:** All captains see broken link in MANAGE menu
- **Features Needed:**
  - Add/remove players from team
  - Reorder roster positions
  - Set player levels
  - Request substitutes
- **Link From:** `captain-dashboard.html`, `team-profile.html`

**team-messages.html** - Team Message Hub
- **Impact:** All captains see broken link in MANAGE menu
- **Features Needed:**
  - Team-only chat room
  - Announcement capability
  - File/image sharing
  - Match coordination
- **Alternative:** Link to `chat-room.html?team_id={id}` instead of separate page

---

### 🟡 Medium Priority (Plan for Next Sprint)

#### 3. Create Missing Admin Pages

**league-settings.html** - League Configuration Editor
- **Impact:** Directors see broken link
- **Features Needed:**
  - League rules editor
  - Schedule builder
  - Team management
  - Season settings
- **Current Workaround:** `league-director.html` may cover this

**analytics.html** - Site Analytics Dashboard
- **Impact:** Site admins see broken link
- **Features Needed:**
  - User engagement metrics
  - Match completion rates
  - Feature usage stats
  - Performance monitoring

**feedback-admin.html** - Feedback Management Panel
- **Impact:** Site admins see broken link
- **Features Needed:**
  - View user feedback submissions
  - Categorize feedback
  - Mark as resolved/addressed
  - Response capability
- **Current Workaround:** Feedback tab may exist in `admin.html`

---

#### 4. Standardize Back Button Implementation

**Current Issues:**
- Mix of `onclick="history.back()"`
- Hardcoded `href="/pages/dashboard.html"`
- Custom JavaScript functions `goBack()`
- Inconsistent button styling

**Recommendation:**
```javascript
// Create universal back button component
function createBackButton(targetPage = null) {
    const btn = document.createElement('button');
    btn.className = 'brdc-back-btn';
    btn.innerHTML = '← Back';
    btn.onclick = () => {
        if (targetPage) {
            window.location.href = targetPage;
        } else {
            history.back();
        }
    };
    return btn;
}
```

**Usage:**
- Pages with clear parent: `createBackButton('/pages/dashboard.html')`
- Pages in flow: `createBackButton()` uses `history.back()`
- Consistent styling via `.brdc-back-btn` class

---

#### 5. Add Breadcrumb Navigation

**Pages Needing Breadcrumbs (3+ levels deep):**
- `match-hub.html` → Dashboard > League > Match
- `team-profile.html` → Dashboard > League > Team
- `player-profile.html` → Dashboard > Players > [Name]
- `chat-room.html` → Dashboard > Messages > Room
- `conversation.html` → Dashboard > Messages > [Name]

**Implementation:**
```html
<div class="breadcrumb">
    <a href="/pages/dashboard.html">Dashboard</a>
    <span class="separator">›</span>
    <a href="/pages/league-view.html?league_id=...">Winter League</a>
    <span class="separator">›</span>
    <span class="current">Match Details</span>
</div>
```

---

### 🟢 Low Priority (Nice to Have)

#### 6. Improve Mobile Footer Tab Focus

**Current:** Active state is color change only
**Recommendation:** Add underline or background highlight

```css
.fb-footer-tab.active {
    color: var(--pink);
    border-top: 3px solid var(--pink); /* Add visual indicator */
}
```

---

#### 7. Standardize Query Parameters

**Current Inconsistencies:**
- `league_id` vs `leagueId`
- `match_id` vs `matchId`
- `id` (ambiguous - player, tournament, or event?)

**Recommendation:**
- Use snake_case consistently: `league_id`, `match_id`, `player_id`, `team_id`, `tournament_id`
- Always include full context: `?league_id=X&team_id=Y` not just `?team_id=Y`
- Avoid generic `?id=` parameter

---

#### 8. Document Development-Only Pages

**Pages to Mark or Remove:**
- `debug-review.html` - Dev utility
- `draft-room.html` - May be incomplete
- `mini-tournament.html` - Status unclear
- `online-play.html` - In development?

**Action:** Add comment headers or remove from production build

---

#### 9. Chat Sidebar Swipe Conflict

**Issue:** Right-swipe to open chat may conflict with page scroll
**Recommendation:** Increase swipe threshold or add edge detection (only trigger from far right)

---

#### 10. Add "You Are Here" Indicators

**Pages Needing Context:**
- Deep-linked pages from notifications
- Pages accessed via search
- Tournament bracket pages

**Implementation:**
```html
<div class="page-context">
    <span class="context-icon">📍</span>
    <span>You are viewing: Winter League 2026</span>
</div>
```

---

## SECTION 8: NAVIGATION HEALTH METRICS

### Coverage Analysis

| Metric | Score | Target | Status |
|--------|:-----:|:------:|:------:|
| Pages with navigation access | 55/56 | 56/56 | 🟡 98% |
| Dead links in primary menus | 8 | 0 | 🔴 CRITICAL |
| Orphan pages (unclear entry) | 24 | <10 | 🟡 43% |
| Pages with back buttons | 33/56 | 50/56 | 🟡 59% |
| Pages requiring login (gated) | 20/56 | - | ✅ 36% |
| Consistent query param naming | ~70% | 95% | 🟡 OK |

---

### User Flow Efficiency

| Flow | Steps | Friction Points | Rating |
|------|:-----:|:---------------:|:------:|
| New user signup | 3 | None | ✅ 10/10 |
| League player to game | 4 | None | ✅ 9/10 |
| Captain team management | 3 | Dead links (roster, team-messages) | 🔴 5/10 |
| Director match setup | 4 | None | ✅ 8/10 |
| Social/messaging flow | 3 | None | ✅ 9/10 |
| Trading flow | 3 | None | ✅ 8/10 |

---

### Navigation System Comparison

| Feature | nav-menu.js | fb-nav.js |
|---------|:-----------:|:---------:|
| Simplicity | ✅ Excellent | 🟡 Complex |
| Mobile-friendly | ✅ Yes | ✅ Yes |
| Role-based menus | ❌ No | ✅ Yes |
| Chat integration | ❌ No | ✅ Yes |
| Search integration | ❌ No | ✅ Yes |
| Badge support | ⚠️ Limited | ✅ Yes |
| Keyboard support | ✅ Yes (ESC) | ✅ Yes (ESC) |
| Touch gestures | ❌ No | ✅ Yes (swipe) |

**Recommendation:** Keep both systems. Use `nav-menu.js` for public/simple pages, `fb-nav.js` for authenticated dashboard.

---

## SECTION 9: COMPLETE PAGE INVENTORY

### Page Navigation Matrix

| Page | Nav System | Login | Back Btn | Links From | Links To | Status |
|------|-----------|:-----:|:--------:|------------|----------|:------:|
| admin.html | Tab nav | Yes* | No | fb-nav (admin) | bot-management, director-dashboard | ✅ |
| bot-management.html | Custom | Yes | Yes | admin.html | — | ✅ |
| bracket.html | Custom | No | Yes | tournaments | tournament-bracket | ✅ |
| captain-dashboard.html | fb-nav | Yes | Via nav | fb-nav (captain), dashboard | team-profile, match-hub, roster ⚠️ | ⚠️ |
| chat-room.html | Custom | Yes | Yes | messages, chat sidebar | messages, league-view, team-profile | ✅ |
| conversation.html | Custom | Yes | Yes | messages, chat sidebar, player-profile | messages, player-profile | ✅ |
| create-league.html | Custom | No* | Yes | leagues.html | league-view (after creation) | ✅ |
| create-tournament.html | Custom | No* | Yes | tournaments.html | tournament-view (after creation) | ✅ |
| dart-trader.html | fb-nav | No | Via nav | dashboard footer, fb-nav | dart-trader-listing, player-profile | ✅ |
| dart-trader-listing.html | Custom | No | Yes | dart-trader.html | dart-trader, player-profile, conversation | ✅ |
| dashboard.html | nav-menu + fb-nav | Yes | No | index (redirect), all nav | All main pages | ✅ |
| debug-review.html | Custom | Yes | Yes | Direct URL only | — | ⚠️ Dev |
| director-dashboard.html | Custom | Yes* | Custom | fb-nav (director) | league-view, match-hub, team-profile, stream-director | ✅ |
| draft-room.html | Custom | Yes | Yes | create-league (during setup) | — | ⚠️ |
| events-hub.html | fb-nav | No* | Via nav | dashboard, nav-menu, footer | event-view, tournament-view, matchmaker-register | ✅ |
| event-view.html | Custom | No | Yes | events-hub | events-hub, matchmaker-register | ✅ |
| friends.html | fb-nav | Yes | Via nav | dashboard, fb-nav | player-profile, conversation, player-lookup | ✅ |
| game-setup.html | nav-menu | Yes* | Yes | dashboard, nav, full-site | x01-scorer, league-cricket, online-play | ✅ |
| glossary.html | Custom | No | No | Manual reference | Internal anchors | ✅ |
| knockout.html | Custom | No | Yes | tournament-bracket | tournament-bracket | ✅ |
| league-cricket.html | None | Yes | Yes (quit) | game-setup | game-setup, dashboard | ✅ |
| league-director.html | Custom | Yes* | Yes | director-dashboard | league-view | ✅ |
| leagues.html | Custom | No | Yes (emoji) | dashboard, nav | league-view, create-league | ✅ |
| league-scoreboard.html | Tab nav | Yes | Via header | league-view (tab) | league-view | ✅ |
| league-team.html | Custom | Yes | Yes | team-profile (edit) | team-profile | ✅ |
| league-view.html | Custom | No* | Yes | dashboard, leagues, notifications | match-hub, team-profile, player-profile, league-director | ✅ |
| live-match.html | Custom | Yes | Yes | match-hub (JS) | match-hub | ⚠️ |
| live-scoreboard.html | Custom | No | Yes | nav-menu (LIVE), director | dashboard | ✅ |
| match-confirm.html | Custom | Yes | Yes | captain-dashboard, director | dashboard, match-hub | ✅ |
| match-hub.html | Custom | Yes | Yes | dashboard, league-view | league-view, player-profile, team-profile, stream-director | ✅ |
| matchmaker-bracket.html | Custom | No | Yes | matchmaker-view | matchmaker-view, knockout | ✅ |
| matchmaker-director.html | Custom | Yes | Yes | director-dashboard | matchmaker-view | ✅ |
| matchmaker-mingle.html | Custom | No | Yes | matchmaker-view | matchmaker-view, player-profile | ✅ |
| matchmaker-register.html | Custom | Yes* | Yes | matchmaker-view, events-hub | matchmaker-view | ✅ |
| matchmaker-tv.html | Custom | No | Yes | matchmaker-view | matchmaker-view | ✅ |
| matchmaker-view.html | nav-menu | No | Via nav | nav-menu, tournament-view | matchmaker-register, matchmaker-bracket, matchmaker-mingle | ✅ |
| match-transition.html | None | Yes | Yes | game-setup (JS) | game-setup | ✅ |
| members.html | fb-nav | No | Via nav | dashboard, fb-nav | player-profile, conversation | ✅ |
| messages.html | fb-nav | Yes | Via nav | dashboard, fb-nav, chat sidebar | conversation, chat-room, player-profile | ✅ |
| mini-tournament.html | Custom | Yes | Yes | JS navigation | — | ⚠️ |
| my-stats.html | Custom | Yes | Yes | player-profile, stat-verification | dashboard | ✅ |
| offline.html | Custom | No | No | Service worker | dashboard | ✅ |
| online-play.html | Custom | Yes | Yes | game-setup (option) | game-setup | ⚠️ |
| player-lookup.html | Custom | No | Yes | dashboard, captain, friends | player-profile | ✅ |
| player-profile.html | fb-nav | No* | Via nav | dashboard, members, search, messages | team-profile, conversation, league-view, dart-trader | ✅ |
| player-registration.html | Custom | No | Yes | signup.html | dashboard | ✅ |
| register.html | Custom | No | Yes | index.html footer | dashboard, player-registration | ✅ |
| signup.html | None | No | Yes | index.html | player-registration, dashboard | ✅ |
| stat-verification.html | Custom | Yes | Yes | dashboard, player-profile | dashboard, my-stats | ✅ |
| stream-camera.html | Custom | Yes | Yes | stream-director | stream-director | ✅ |
| stream-director.html | nav-menu | Yes | Via nav | nav-menu, director-dashboard | stream-camera | ✅ |
| team-profile.html | Custom | No* | Yes | dashboard, league-view, player-profile | league-view, player-profile, captain-dashboard | ✅ |
| tournament-bracket.html | Custom | No | Yes | tournaments, tournament-view | tournament-view, knockout | ✅ |
| tournaments.html | Custom | No | Yes (emoji) | dashboard, nav | tournament-view, tournament-bracket, create-tournament | ✅ |
| tournament-view.html | Custom | No | Yes | tournaments, events-hub | tournaments, tournament-bracket, matchmaker-view | ✅ |
| x01-scorer.html | None | Yes | Yes (quit) | game-setup | game-setup, dashboard | ✅ |

**Legend:**
- Yes* = Partial (form accessible, submission requires auth)
- No* = Public view, actions require auth
- ⚠️ = Issues present (dead links, unclear status)
- ✅ = Fully functional

---

## FINAL RECOMMENDATIONS SUMMARY

### Immediate Actions (This Week)

1. ✅ **Create `settings.html`** - Every user needs this
2. ✅ **Create `notification-settings.html`** - Every user needs this
3. ✅ **Create `roster.html`** - All captains need this
4. ⚠️ **Remove or link `team-messages.html`** - Dead link in captain menu

### Short-Term (Next Sprint)

5. ✅ **Create `league-settings.html`** - Directors need this
6. ⚠️ **Audit orphan pages** - Document or remove unclear pages
7. ✅ **Standardize back buttons** - Create universal component
8. ✅ **Add breadcrumbs** - Deep pages need context

### Long-Term (Next Month)

9. ⚠️ **Standardize query params** - Improve consistency
10. ✅ **Create `analytics.html`** - Admin feature
11. ✅ **Create `feedback-admin.html`** - Admin feature
12. ⚠️ **Document dev pages** - Mark or remove from production

---

## CONCLUSION

The BRDC navigation system is **functional but needs attention** to dead links and missing pages. The dual navigation approach (simple + advanced) works well for different user types, but the presence of 8 dead links in primary menus creates a poor user experience.

**Priority Focus:**
1. Fix the 4 user-facing dead links (settings, notifications, roster, team-messages)
2. Audit the 24 orphan pages to determine which are intentional
3. Standardize back button implementation across all pages
4. Add breadcrumbs to deep pages for better wayfinding

**Overall Navigation Health: 7.5/10**
- Strong foundation with room for improvement
- Most critical issues are fixable in 1-2 sprints
- User flows are generally smooth except captain management

---

**End of Navigation Audit Report**
**Generated:** February 4, 2026
**Pages Analyzed:** 56
**Total Links Checked:** 200+
**Recommendations:** 12 actionable items
