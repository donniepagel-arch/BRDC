# BRDC Site Navigation Analysis
**Generated:** February 3, 2026
**Total Pages:** 64 HTML files

---

## Navigation Structure Overview

### Entry Point
**index.html** - PIN-based login page
- Players enter 8-digit PIN
- Redirects to dashboard on success
- No registration flow (handled separately)

---

## Primary Navigation Areas

### 1. PLAYER DASHBOARD (`dashboard.html`)
**Purpose:** Central hub for players after login

**Key Sections:**
- Player Stats (3DA, MPR, Win %)
- Schedule Stories (upcoming/past matches)
- League Feed (activity stream)
- Match Night Banner (when active)

**Navigation Options From Dashboard:**
- View specific league → `league-view.html`
- Captain dashboard → `captain-dashboard.html` (if captain)
- Director dashboard → `league-director.html` (if director)
- Profile → `player-profile.html`
- Friends → `friends.html`
- Chat → `chat-room.html`

---

### 2. LEAGUE SYSTEM

#### **League Discovery & Creation**
- `leagues.html` - Browse all leagues
- `create-league.html` - Create new league (directors)

#### **League Management (Directors)**
- `league-director.html` - Main director dashboard
  - Settings, schedule, teams, players
  - Match management
  - Statistics overview
- `draft-room.html` - Conduct draft for draft leagues

#### **League Participation (Players)**
- `league-view.html` - League overview, standings, schedule
- `league-team.html` - Team roster and details
- `league-scoreboard.html` - Live match scoreboard

#### **Match Scoring**
- `league-501.html` - 501 scorer for league matches
- `league-cricket.html` - Cricket scorer for league matches
- `game-setup.html` - Pre-match setup

---

### 3. TOURNAMENT SYSTEM

#### **Tournament Discovery & Creation**
- `browse-events.html` - Browse tournaments
- `create-tournament.html` - Create tournament (directors)

#### **Tournament Participation**
- `bracket.html` - View tournament bracket
- `knockout.html` - Knockout tournament format

#### **Match Play**
- `cricket.html` - Cricket scorer (tournaments/practice)
- `501.html` - 501 scorer (tournaments/practice)

---

### 4. CAPTAIN TOOLS
**Purpose:** Team management for captains

**captain-dashboard.html** includes:
- Team roster management
- Player availability tracking
- Match night coordination
- Sub/fill-in management
- Team communication

---

### 5. SOCIAL FEATURES

#### **Communication**
- `friends.html` - Friends list and management
- `chat-room.html` - Group chat rooms
- `conversation.html` - Private messages

#### **Community**
- `events-hub.html` - Community events
- `community-events.html` - Event listings
- `event-view.html` - Event details

---

### 6. MARKETPLACE
**dart-trader** system for buying/selling:
- `dart-trader.html` - Main marketplace
- `dart-trader-listing.html` - Item listings

---

### 7. ADMIN/SYSTEM

#### **Administration**
- `admin.html` - System admin dashboard
- `bot-management.html` - AI bot configuration
- `director-dashboard.html` - Director overview

#### **Utilities**
- `glossary.html` - Darts terminology
- `debug-review.html` - System debugging

---

## Navigation Patterns Observed

### Pattern 1: Role-Based Access
Different entry points based on player role:
- **Regular Player** → Dashboard → League View → Match Play
- **Captain** → Dashboard → Captain Dashboard → Team Management
- **Director** → Dashboard → League Director → Configuration

### Pattern 2: Match Flow
Consistent match progression:
1. View Schedule (dashboard or league-view)
2. Match Setup (game-setup)
3. Scoring (league-501 / league-cricket)
4. Results (league-scoreboard)
5. Back to Dashboard/League

### Pattern 3: League Lifecycle
League creation to completion:
1. Create League (create-league)
2. Draft Players (draft-room) *if draft league*
3. Manage (league-director)
4. Play Matches (league scoring pages)
5. View Standings (league-view)

---

## Navigation Issues Identified

### 🔴 CRITICAL ISSUES

1. **No Clear Back Navigation**
   - Many pages lack "back" or "home" buttons
   - Users may get lost in deep flows
   - Recommendation: Add breadcrumbs or back buttons

2. **Inconsistent Entry Points**
   - Some features accessible from multiple places
   - Others hidden behind specific flows
   - Recommendation: Standardize navigation patterns

3. **Role Confusion**
   - Not always clear what role player has in each league
   - Captain/Director status not prominently displayed
   - Recommendation: Add role badges or indicators

### ⚠️ HIGH PRIORITY

4. **Mobile Navigation**
   - 64 pages but no consistent mobile menu
   - Bottom nav or hamburger menu needed
   - Recommendation: Implement responsive navigation

5. **Search/Filter**
   - No global search
   - Can't search for leagues, players, or matches
   - Recommendation: Add search functionality

6. **Dashboard Overload**
   - Dashboard tries to show everything
   - Can be overwhelming for multi-league players
   - Recommendation: Add filtering/organization

### 📝 MEDIUM PRIORITY

7. **Redundant Pages**
   - Multiple scorer pages (league-501, 501, cricket, league-cricket)
   - Could be consolidated
   - Recommendation: Unify scoring interface

8. **Missing Contextual Help**
   - New users don't know where to start
   - No tooltips or onboarding
   - Recommendation: Add contextual help

9. **Deep Linking Issues**
   - Hard to share specific match or league
   - URL structure could be clearer
   - Recommendation: Improve URL patterns

---

## Recommended Navigation Structure

### Mobile Bottom Navigation (Primary)
```
┌─────────────────────────────────────┐
│ 🏠 Home  ⚡ Leagues  🎯 Events  👤 Me │
└─────────────────────────────────────┘
```

### Desktop Header Navigation
```
BRDC Logo | Leagues | Tournaments | Social | Profile | [User Menu ▼]
```

### User Menu (Dropdown)
- My Profile
- My Teams
- Captain Dashboard (if captain)
- Director Dashboard (if director)
- Settings
- Logout

### Breadcrumbs (Context Awareness)
```
Home > Leagues > Winter Triple Draft > Team: N. Mezlak > Match Scorer
```

---

## Page Categorization

### **Core User Flows (18 pages)**
- index, dashboard, league-view, league-501, league-cricket
- captain-dashboard, league-director, draft-room
- player-profile, game-setup, league-scoreboard
- create-league, create-tournament, bracket
- friends, chat-room, conversation, events-hub

### **Admin/System (8 pages)**
- admin, bot-management, director-dashboard
- debug-review, glossary

### **Marketplace (2 pages)**
- dart-trader, dart-trader-listing

### **Secondary Features (36 pages)**
- Various tournament formats, community features
- Additional scoring interfaces
- Event management

---

## Next Steps

### Immediate Fixes
1. Add back/home buttons to all pages
2. Implement breadcrumb navigation
3. Add role indicators (Captain/Director badges)
4. Create mobile bottom nav

### Short Term
5. Add global search
6. Consolidate redundant pages
7. Implement contextual help
8. Improve URL structure

### Long Term
9. User onboarding flow
10. Progressive disclosure for complex features
11. Accessibility improvements
12. Navigation analytics

---

*Analysis based on 64 HTML pages in public/pages directory*
*Recommendations prioritized by impact and feasibility*
