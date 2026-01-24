# Dashboard.html Refactoring Plan

**File:** `public/pages/dashboard.html`
**Total Lines:** ~15,160 lines
**Analysis Date:** 2026-01-22

---

## 1. Current Structure

The dashboard.html file is a monolithic single-page application containing HTML, CSS, and JavaScript all in one file. Here is the breakdown:

### File Composition

| Section | Line Range | Lines | Description |
|---------|------------|-------|-------------|
| HTML Head + CSS | 1-6680 | ~6,680 | All styles inline in `<style>` tag |
| HTML Body (markup) | 6681-8208 | ~1,527 | Page structure and templates |
| JavaScript Module | 8209-15155 | ~6,946 | All application logic |
| External Script Tags | 15156-15159 | 4 | nav-menu.js, stats-helpers.js, feedback.js |

### Major HTML Sections

| Section | Line | Purpose |
|---------|------|---------|
| Initial Loader | 6682 | Loading screen while checking session |
| Login Page | 6713 | PIN-based authentication UI |
| Dashboard Content | 6738 | Main dashboard container |
| Profile Header | 6749 | Player avatar, name, quick stats |
| Tonight's Match Banner | 6779 | Contextual match card for game day |
| Verify Stats Card | 6786 | CTA for stat verification |
| Quick Links Row | 6797 | Navigation shortcuts (Online Play, Matchmaker, etc.) |
| Main Tab Container | 6829 | Tab navigation (Schedule, Captain, Director, Trader) |
| Schedule Tab | 6839 | Calendar + events view |
| Captain Tab | 6975 | Team management for captains |
| Activity Tab | 7473 | Leagues, tournaments, history, stats |
| Director Tab | 7624 | League director controls |
| Trader Tab | 7774 | Dart marketplace listings |
| Settings Tab | 7925 | User preferences and account |
| Chat Bubble | 8177 | Floating messaging button |
| Director Modal | 8197 | League selection modal |

### CSS Organization (within `<style>` tag)

| Section | Line Range | Purpose |
|---------|------------|---------|
| Header Bar | 46-78 | Top navigation styling |
| Chat Bubble | 79-283 | Floating chat menu styles |
| League/Tournament Cards | 284-420 | Event card styling |
| Team Cards Grid | 421-496 | Team display grid |
| Login Page | 504-637 | Authentication form styles |
| Profile Header | 639-745 | User profile section |
| Verify Stats Card | 794-948 | Stats verification CTA |
| Settings Tab | 995-1329 | Settings form styling |
| Tabs | 1330-1472 | Main navigation tabs |
| History Tab | 1473-1585 | Match history display |
| Stats Tab | 1586-1734 | Statistics display |
| Game Day Control | 1735-1951 | Director game day UI |
| Calendar Styles | 2061-2428 | Full calendar system |
| Match Card Layout | 2497-3027 | Match card components |
| Events View | 3143-3391 | Events list styling |
| Team Selector | 3779-3890 | Team dropdown |
| Captain Sub-tabs | 4373-4477 | Captain section tabs |
| Roster Tab | 4478-4911 | Roster management styles |
| Contact Tab | 4912-5201 | Captain messaging UI |
| Settings Tab (Captain) | 5202-5426 | Captain settings |
| Availability Modal | 5427-5556 | Player availability |
| Fill-in Modal | 5557-5874 | Sub request workflow |
| Listing Form (Trader) | 6330-6569 | Marketplace listing form |
| Skeleton Loading | 6570-6653 | Loading state animations |
| Mobile Responsive | 6654-6678 | Responsive breakpoints |

### JavaScript Function Categories

| Category | Function Count | Example Functions |
|----------|---------------|-------------------|
| Authentication | 4 | `login()`, `logout()`, `showFallbackLogin()` |
| Dashboard Core | 5 | `initDashboard()`, `loadDashboard()`, `renderDashboard()` |
| Navigation | 4 | `switchTab()`, `switchCaptainSubtab()`, `navigateTo()` |
| Calendar | 12 | `loadCalendar()`, `renderWeekView()`, `changeMonth()`, `showDayEvents()` |
| Events View | 8 | `loadEventsView()`, `renderEventsView()`, `filterEvents()` |
| Match Cards | 10 | `renderMatchCard()`, `loadMatchCard()`, `loadEventsMatchCard()` |
| Tonight's Match | 5 | `loadTonightsMatch()`, `tonightsConfirmAttendance()` |
| Schedule/Team | 6 | `loadTeamSchedule()`, `renderTeamScheduleEnhanced()` |
| Captain - Roster | 8 | `loadCaptainTeam()`, `renderTeamRosterList()`, `renderAvailabilityGrid()` |
| Captain - Subs | 10 | `renderGotoSubs()`, `renderSubPool()`, `openFillinRequest()` |
| Captain - Contact | 8 | `sendCaptainComposedMessage()`, `quickRemindTeam()` |
| Captain - Settings | 5 | `loadCaptainSettings()`, `saveTeamNameFromSettings()` |
| Director | 12 | `populateDirectorTab()`, `loadGamedayData()`, `openSubstitutionModal()` |
| Messaging | 8 | `loadRecentMessages()`, `toggleChatMenu()`, `openConversation()` |
| Settings/Profile | 15 | `populateSettingsForm()`, `togglePrivacy()`, `saveField()` |
| Stats | 5 | `loadDetailedStats()`, `loadStatsForFilter()`, `loadAchievements()` |
| Activity Tab | 4 | `loadLeaguesTab()`, `loadMatchHistory()`, `loadTournamentsTab()` |
| Trader | 10 | `loadTraderTab()`, `renderMyListings()`, `submitListing()` |
| Utilities | 8 | `formatMessageTime()`, `updateUnreadBadge()`, `getTimeAgo()` |

---

## 2. Proposed Modules

### JavaScript Modules to Extract

| Module Name | Responsibility | Key Functions | Est. Lines |
|-------------|---------------|---------------|------------|
| `dashboard-auth.js` | Login, logout, session management | `login()`, `logout()`, `initDashboard()`, `loadDashboard()`, `showLoginPage()`, `showDashboard()` | ~150 |
| `dashboard-calendar.js` | Calendar rendering and navigation | `loadCalendar()`, `renderWeekView()`, `renderCalendar()`, `changeWeek()`, `changeMonth()`, `showDayEvents()`, `toggleCalendarExpand()`, `loadCalendarEvents()` | ~400 |
| `dashboard-events.js` | Events view and filtering | `loadEventsView()`, `renderEventsView()`, `filterEvents()`, `showEventsView()`, `loadTonightsMatch()`, `updateTonightsCountdown()` | ~500 |
| `dashboard-match-cards.js` | Match card rendering (all types) | `renderMatchCard()`, `loadMatchCard()`, `loadEventsMatchCard()`, `renderLeagueMatchCard()`, `loadMatchEventCardContent()` | ~600 |
| `dashboard-schedule.js` | Schedule tab and team schedule | `loadTeamSchedule()`, `loadAllTeamsView()`, `renderTeamScheduleEnhanced()`, `updateAvailability()` | ~300 |
| `dashboard-captain-roster.js` | Captain tab roster management | `loadCaptainTeam()`, `renderTeamRosterList()`, `renderAvailabilityGrid()`, `renderGotoSubs()`, `renderSubPool()`, `filterSubPool()` | ~350 |
| `dashboard-captain-subs.js` | Fill-in request workflow | `openFillinRequest()`, `populateFillinSubList()`, `goToFillinStep()`, `sendFillinRequests()`, `pollFillinResponses()` | ~300 |
| `dashboard-captain-contact.js` | Captain messaging/communication | `sendCaptainComposedMessage()`, `quickRemindTeam()`, `textUnconfirmedPlayers()`, `toggleRecipient()`, `loadMessageTemplate()` | ~250 |
| `dashboard-captain-settings.js` | Captain settings management | `loadCaptainSettings()`, `saveTeamNameFromSettings()`, `handleTeamPhotoSelect()` | ~150 |
| `dashboard-director.js` | Director tab and game day control | `populateDirectorTab()`, `loadGamedayData()`, `renderGamedayMatches()`, `openSubstitutionModal()`, `confirmSubstitution()`, `sendDirectorMessage()` | ~400 |
| `dashboard-messaging.js` | Chat and DM functionality | `loadRecentMessages()`, `renderRecentMessages()`, `toggleChatMenu()`, `loadChatBubbles()`, `updateUnreadBadge()` | ~300 |
| `dashboard-settings.js` | User settings and profile | `populateSettingsForm()`, `loadPrivacySettings()`, `saveField()`, `togglePrivacy()`, `toggleNotification()`, `generateNewPin()`, `exportMyData()` | ~400 |
| `dashboard-stats.js` | Stats display and calculations | `loadDetailedStats()`, `loadStatsForFilter()`, `loadAchievements()`, `updateVerifyStatsCard()` | ~250 |
| `dashboard-activity.js` | Activity tab (leagues, history, tournaments) | `loadLeaguesTab()`, `loadMatchHistory()`, `filterMatchHistory()`, `loadTournamentsTab()`, `switchActivitySubTab()` | ~350 |
| `dashboard-trader.js` | Dart marketplace functionality | `loadTraderTab()`, `renderMyListings()`, `showListingForm()`, `submitListing()`, `editListing()`, `markAsSold()`, `deleteListing()` | ~350 |
| `dashboard-utils.js` | Shared utility functions | `formatMessageTime()`, `getTimeAgo()`, `navigateTo()`, `viewPlayer()`, `viewTeam()` | ~100 |

### CSS Modules to Extract

| Module Name | Responsibility | Est. Lines |
|-------------|---------------|------------|
| `dashboard-base.css` | CSS variables, reset, container, header | ~200 |
| `dashboard-auth.css` | Login page, form inputs | ~150 |
| `dashboard-profile.css` | Profile header, avatar, verify card | ~300 |
| `dashboard-tabs.css` | Tab container, sub-tabs styling | ~200 |
| `dashboard-calendar.css` | Calendar grid, week view, month view, legend | ~400 |
| `dashboard-events.css` | Events list, filters, single day view | ~250 |
| `dashboard-match-cards.css` | Match card layout, team sides, scores, roster | ~600 |
| `dashboard-captain.css` | Captain tab, roster section, availability grid, sub pool | ~600 |
| `dashboard-director.css` | Director section, game day control, modals | ~300 |
| `dashboard-messaging.css` | Chat bubble, messages section, DM circles | ~250 |
| `dashboard-settings.css` | Settings sections, privacy toggles, profile fields | ~400 |
| `dashboard-trader.css` | Marketplace listings, listing form | ~300 |
| `dashboard-modals.css` | Modal containers, fill-in modal, playlist modal | ~350 |
| `dashboard-skeletons.css` | Skeleton loading states | ~100 |
| `dashboard-responsive.css` | Media queries for all breakpoints | ~100 |

---

## 3. Shared Dependencies

### Global State Variables
These variables are used across multiple modules and would need to be shared:

| Variable | Used By | Description |
|----------|---------|-------------|
| `currentPlayer` | All modules | Logged-in player data |
| `dashboardData` | Most modules | Full dashboard response from API |
| `selectedTeamId` | Schedule, Captain | Currently selected team |
| `selectedCaptainTeamId` | Captain modules | Captain's selected team |
| `selectedCaptainLeagueId` | Captain modules | Captain's selected league |
| `captainTeamData` | Captain modules | Captain team data from API |
| `currentLeagueId` | Schedule, Events | Current league context |
| `allTeams` | Schedule, Events | All teams player is on |
| `myListings` | Trader | User's marketplace listings |
| `calendarEvents` | Calendar, Events | Loaded calendar events |
| `currentMonth`, `currentYear` | Calendar | Calendar navigation state |
| `selectedWeekStart` | Calendar | Week view navigation |

### Shared Utility Functions
These functions are used by multiple modules:

| Function | Used By |
|----------|---------|
| `formatMessageTime()` | Messaging, Activity |
| `getTimeAgo()` | Captain Contact, Messaging |
| `navigateTo()` | Events, Match Cards, Profile |
| `viewPlayer()` | Match Cards, Schedule |
| `viewTeam()` | Match Cards, Schedule |

### External Dependencies

| Import | Source | Used For |
|--------|--------|----------|
| `callFunction` | `/js/firebase-config.js` | Cloud function calls |
| `uploadImage` | `/js/firebase-config.js` | Image uploads |
| `showLoading`, `hideLoading` | `/js/firebase-config.js` | Loading indicators |
| `db` | `/js/firebase-config.js` | Direct Firestore access |
| `collection`, `doc`, `getDoc`, etc. | Firebase Firestore SDK | Firestore operations |
| `initializePushNotifications` | `/js/push-notifications.js` | Push notification setup |

### DOM Element IDs
Critical DOM elements that multiple modules interact with:

| Element ID | Used By |
|------------|---------|
| `loginPage`, `dashboardContent` | Auth |
| `welcomeName`, `playerAvatar` | Profile, Auth |
| `calendarWeekDays`, `calendarDays` | Calendar |
| `eventsListContainer`, `singleDayView` | Events |
| `captainTeamSelect` | Captain modules |
| `directorLeagueSelect` | Director |

---

## 4. Refactoring Order (Recommended)

The recommended order prioritizes:
1. Modules with fewer dependencies (lowest risk)
2. Self-contained functionality
3. Clearest boundaries

| Order | Module | Risk | Rationale |
|-------|--------|------|-----------|
| 1 | `dashboard-utils.js` | Low | Pure utility functions, no state |
| 2 | `dashboard-trader.js` | Low | Self-contained, minimal external deps |
| 3 | `dashboard-stats.js` | Low | Read-only display, clear boundaries |
| 4 | `dashboard-messaging.js` | Low | Isolated feature, clear API |
| 5 | `dashboard-settings.js` | Low | Standalone settings management |
| 6 | `dashboard-activity.js` | Low | Tabs are self-contained |
| 7 | `dashboard-director.js` | Medium | Has modals but self-contained |
| 8 | `dashboard-captain-settings.js` | Medium | Small, isolated within captain |
| 9 | `dashboard-captain-contact.js` | Medium | Clear messaging boundaries |
| 10 | `dashboard-captain-subs.js` | Medium | Modal workflow, some shared state |
| 11 | `dashboard-captain-roster.js` | Medium | Core captain functionality |
| 12 | `dashboard-calendar.js` | Medium | Complex but isolated UI |
| 13 | `dashboard-schedule.js` | Medium | Depends on match cards |
| 14 | `dashboard-events.js` | High | Tightly coupled with match cards |
| 15 | `dashboard-match-cards.js` | High | Used by multiple modules |
| 16 | `dashboard-auth.js` | High | Core, touches everything |

### CSS Extraction Order

| Order | CSS Module | Risk | Rationale |
|-------|------------|------|-----------|
| 1 | `dashboard-skeletons.css` | Low | Standalone animations |
| 2 | `dashboard-responsive.css` | Low | Media queries, easy to test |
| 3 | `dashboard-trader.css` | Low | Self-contained feature |
| 4 | `dashboard-modals.css` | Low | Reusable modal styles |
| 5 | `dashboard-messaging.css` | Low | Isolated chat styles |
| 6 | `dashboard-director.css` | Medium | Director-specific |
| 7 | `dashboard-settings.css` | Medium | Settings forms |
| 8 | `dashboard-captain.css` | Medium | Large but isolated |
| 9 | `dashboard-tabs.css` | Medium | Shared tab styling |
| 10 | `dashboard-profile.css` | Medium | Profile header |
| 11 | `dashboard-auth.css` | Medium | Login page |
| 12 | `dashboard-events.css` | High | Events list |
| 13 | `dashboard-calendar.css` | High | Complex calendar UI |
| 14 | `dashboard-match-cards.css` | High | Core card styles, used everywhere |
| 15 | `dashboard-base.css` | High | Foundation styles |

---

## 5. Estimated Effort

### JavaScript Module Extraction

| Module | Complexity | Effort | Notes |
|--------|------------|--------|-------|
| `dashboard-utils.js` | Simple | 1 hour | Copy functions, add exports |
| `dashboard-trader.js` | Simple | 2 hours | Self-contained, minimal deps |
| `dashboard-stats.js` | Simple | 2 hours | Read-only, clear separation |
| `dashboard-messaging.js` | Simple | 2 hours | Isolated messaging logic |
| `dashboard-settings.js` | Medium | 3 hours | Many small functions |
| `dashboard-activity.js` | Medium | 3 hours | Multiple sub-tabs |
| `dashboard-director.js` | Medium | 4 hours | Modal interactions |
| `dashboard-captain-settings.js` | Simple | 2 hours | Small module |
| `dashboard-captain-contact.js` | Medium | 3 hours | Message composition |
| `dashboard-captain-subs.js` | Medium | 4 hours | Multi-step modal flow |
| `dashboard-captain-roster.js` | Medium | 4 hours | Core captain feature |
| `dashboard-calendar.js` | Complex | 5 hours | Multiple views, state |
| `dashboard-schedule.js` | Medium | 3 hours | Team schedule logic |
| `dashboard-events.js` | Complex | 5 hours | Filtering, multiple card types |
| `dashboard-match-cards.js` | Complex | 6 hours | Many card variations, used everywhere |
| `dashboard-auth.js` | Complex | 4 hours | Core initialization, session |

**Total JS Effort:** ~53 hours (approximately 7-8 developer days)

### CSS Module Extraction

| Module | Complexity | Effort | Notes |
|--------|------------|--------|-------|
| `dashboard-skeletons.css` | Simple | 0.5 hours | |
| `dashboard-responsive.css` | Simple | 0.5 hours | |
| `dashboard-trader.css` | Simple | 1 hour | |
| `dashboard-modals.css` | Simple | 1 hour | |
| `dashboard-messaging.css` | Simple | 1 hour | |
| `dashboard-director.css` | Medium | 1.5 hours | |
| `dashboard-settings.css` | Medium | 1.5 hours | |
| `dashboard-captain.css` | Medium | 2 hours | Large section |
| `dashboard-tabs.css` | Medium | 1 hour | |
| `dashboard-profile.css` | Medium | 1 hour | |
| `dashboard-auth.css` | Simple | 1 hour | |
| `dashboard-events.css` | Medium | 1.5 hours | |
| `dashboard-calendar.css` | Complex | 2 hours | Many states |
| `dashboard-match-cards.css` | Complex | 2.5 hours | Core styles |
| `dashboard-base.css` | Medium | 1 hour | Variables, reset |

**Total CSS Effort:** ~19 hours (approximately 2-3 developer days)

### Overall Effort Summary

| Category | Effort | Risk Level |
|----------|--------|------------|
| JS Extraction | 53 hours | Medium-High |
| CSS Extraction | 19 hours | Medium |
| Integration Testing | 16 hours | High |
| Regression Testing | 8 hours | Medium |
| **Total** | **~96 hours** | **Medium-High** |

**Recommended Approach:** Incremental extraction over multiple sprints, with thorough testing after each module extraction.

---

## 6. Additional Recommendations

### State Management
Consider implementing a simple state management pattern:

```javascript
// dashboard-state.js
export const state = {
    currentPlayer: null,
    dashboardData: null,
    // ... other shared state
};

export function setState(key, value) {
    state[key] = value;
    // Optionally emit events for reactive updates
}
```

### Module Loader Pattern
Create a main entry point that initializes modules:

```javascript
// dashboard-main.js
import { initAuth } from './dashboard-auth.js';
import { initCalendar } from './dashboard-calendar.js';
// ... other imports

export async function initDashboard() {
    await initAuth();
    initCalendar();
    // ... initialize other modules based on user role
}
```

### Testing Strategy
1. Create unit tests for utility functions first
2. Create integration tests for each tab/feature
3. Use feature flags to gradually enable modular code
4. Keep the monolithic file as a fallback during transition

### CSS Strategy
1. Use CSS custom properties (already in use) for theming
2. Consider using CSS modules or scoped styles if build system supports it
3. Maintain a single source of truth for design tokens

---

## 7. Files to Create

### JavaScript Modules (16 files)
```
public/js/dashboard/
  dashboard-auth.js
  dashboard-calendar.js
  dashboard-events.js
  dashboard-match-cards.js
  dashboard-schedule.js
  dashboard-captain-roster.js
  dashboard-captain-subs.js
  dashboard-captain-contact.js
  dashboard-captain-settings.js
  dashboard-director.js
  dashboard-messaging.js
  dashboard-settings.js
  dashboard-stats.js
  dashboard-activity.js
  dashboard-trader.js
  dashboard-utils.js
  dashboard-state.js (optional, for shared state)
  dashboard-main.js (optional, entry point)
```

### CSS Modules (15 files)
```
public/css/dashboard/
  dashboard-base.css
  dashboard-auth.css
  dashboard-profile.css
  dashboard-tabs.css
  dashboard-calendar.css
  dashboard-events.css
  dashboard-match-cards.css
  dashboard-captain.css
  dashboard-director.css
  dashboard-messaging.css
  dashboard-settings.css
  dashboard-trader.css
  dashboard-modals.css
  dashboard-skeletons.css
  dashboard-responsive.css
```

---

*This document is for planning purposes only. No code changes have been made.*
