# Orphan Pages Audit Report

**Date:** 2026-01-21
**Auditor:** Claude Code (Terminal 5)

## Summary

Audited 7 pages with no inbound navigation links. All pages are **fully functional** with proper styling and backend integration. None are broken or placeholder pages.

---

## Audit Results

### 1. stream-camera.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | WebRTC camera source for live streaming |
| **Backend** | Peer-to-peer WebRTC (no Firebase) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 17.7 KB |

**Description:**
Allows a device to broadcast its camera as a video source. Connects to a stream director via session codes. Features video preview, connection status, and camera controls.

**Recommendation:** **HIDE**
Keep for future live streaming feature. Not ready for public beta. Needs stream infrastructure.

---

### 2. stream-director.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Director dashboard for managing live streams |
| **Backend** | Peer-to-peer WebRTC (no Firebase) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 38.4 KB |

**Description:**
Controls live stream output with multi-camera switching, overlay management, and broadcast controls. Pairs with stream-camera.html for camera sources.

**Recommendation:** **HIDE**
Future feature for streaming league matches. Keep for later launch.

---

### 3. members.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Global member directory with search/sort |
| **Backend** | Firebase Firestore (players collection) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 23.1 KB |

**Description:**
Searchable/sortable table of all BRDC members with stats (3DA, MPR), level, and profile links. Has responsive design and sorting by multiple columns.

**Recommendation:** **LINK**
Add to nav-menu.js or dashboard quick links. Useful for finding players.

---

### 4. match-report.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Detailed post-match report/summary |
| **Backend** | Firebase Firestore (matches, stats) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 68 KB |

**Description:**
Shows detailed match breakdown with sets/legs, player performance stats, turn-by-turn data, and leaderboards. Follows design from CLAUDE.md RULE 14.

**Recommendation:** **LINK**
Should be linked from match-hub.html and league-view.html match cards. Critical for completed matches.

---

### 5. community-events.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Community events map and listing |
| **Backend** | Firebase Firestore (community_events collection) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 58 KB |

**Description:**
Interactive Leaflet map showing dart events in the area. Users can add events, filter by type (tournament, social, blind draw), and view event details. Full CRUD functionality.

**Recommendation:** **HIDE**
Future community feature. Collection community_events may not have data yet. Add to nav when ready.

---

### 6. dart-trader.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Marketplace for buying/selling dart equipment |
| **Backend** | Firebase Firestore (dart_trader_listings collection) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 32.9 KB |

**Description:**
Browse dart equipment listings with category filters (darts, flights, shafts, cases, dartboards, accessories). Grid layout with price, condition, and seller info.

**Recommendation:** **HIDE**
Future marketplace feature. Collection may be empty. Links to dart-trader-listing.html for details.

---

### 7. dart-trader-listing.html

| Attribute | Value |
|-----------|-------|
| **Status** | FUNCTIONAL |
| **Purpose** | Individual listing detail page |
| **Backend** | Firebase Firestore (dart_trader_listings collection) |
| **UI Quality** | Complete, production-ready |
| **File Size** | 27.6 KB |

**Description:**
Displays single listing with image gallery, price, description, seller info, and contact button. Supports listing status (active/sold).

**Recommendation:** **HIDE**
Child page of dart-trader.html. Keep with parent.

---

## Recommendations Summary

| Page | Action | Priority | Notes |
|------|--------|----------|-------|
| stream-camera.html | **HIDE** | Low | Future streaming feature |
| stream-director.html | **HIDE** | Low | Future streaming feature |
| members.html | **LINK** | High | Add to dashboard or nav |
| match-report.html | **LINK** | High | Link from match-hub/league-view |
| community-events.html | **HIDE** | Medium | Launch when events exist |
| dart-trader.html | **HIDE** | Medium | Launch when listings exist |
| dart-trader-listing.html | **HIDE** | Medium | Keep with dart-trader.html |

---

## Action Items

### Immediate (LINK)
1. Add members.html to dashboard quick links or nav-menu.js
2. Link match-report.html from completed matches in match-hub.html

### Future Launch
3. Enable community-events.html when events are populated
4. Enable dart-trader marketplace when listings are available
5. Enable streaming features when infrastructure is ready

---

## Notes

- All 7 pages have consistent BRDC styling
- No pages are broken or need removal
- Backend collections may need seeding for some features
- Comment out nav-menu.js entries reference these as "Coming soon"
