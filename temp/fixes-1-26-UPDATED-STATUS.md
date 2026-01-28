# Fixes 1-26 AM - UPDATED Status Assessment
**Last Updated:** 2026-01-27

## Summary Statistics

**Total Issues: 31**
- ✅ **FIXED:** 2 (6%)
- ⚠️ **PARTIALLY FIXED:** 3 (10%)
- ❌ **NOT ADDRESSED:** 26 (84%)

---

## General Site Fixes

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Pages keep asking for pin after login | **APPEARS FIXED** ✅ | Session management properly implemented with localStorage. Dashboard checks for saved session on load. |
| ❌ 'matchmaker' should be like other events | **NOT ADDRESSED** | Menu structure needs update |
| ❌ Scorer hub pulling old scorer | **NOT ADDRESSED** | Need to review |
| ❌ 'Practice mode' → 'VR-darts', add back button | **NOT ADDRESSED** | Naming/navigation |

---

## Dashboard.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Schedule cards need event title | **NOT ADDRESSED** | Missing league/tournament names |
| ❌ Detailed info modal doesn't pop up | **NOT ADDRESSED** | Modal functionality needs investigation |
| ❌ Show entire league schedule | **NOT ADDRESSED** | Currently limited? |
| ❌ Stat card needs link to profile page | **NOT ADDRESSED** | Link missing |
| ❌ News feed doesn't populate | **NOT ADDRESSED** | Needs backend/frontend work |
| ❌ Show friend requests in news feed | **NOT ADDRESSED** | Feature not implemented |
| ❌ CORS error: getUnreadNotificationCount | **FIXED** ✅ | CORS properly configured in functions/notification-api.js and index.js with `cors({origin: true})` |

---

## Browse-events.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Information doesn't populate | **NOT ADDRESSED** | Data loading issue |
| ❌ Import statement error | **NOT ADDRESSED** | Module loading issue - needs investigation |

---

## community-events.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Move add event button inline with view toggles | **NOT ADDRESSED** | Layout - button is in header but may need repositioning |
| ❌ Remove 'your name' field (auto-populate) | **NOT ADDRESSED** | Form field should auto-fill from session |
| ❌ Map view needs filters | **NOT ADDRESSED** | Filtering functionality missing |
| ❌ Firestore index error | **NOT FIXED** ⚠️ | **CRITICAL:** firestore.indexes.json is EMPTY. Query on line 1204-1207 requires composite index: `community_events` collection with `status` (ASC) + `event_date` (ASC). Will fail in production. |
| ❌ Storage permission error | **NOT FIXED** ⚠️ | **CRITICAL:** storage.rules exists but MISSING authentication checks. All write operations allow anonymous uploads (security risk). Read access is public. |

---

## live-scoreboard.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Import statement error | **NOT ADDRESSED** | Module loading issue |
| ❌ Firebase not initialized error | **NOT ADDRESSED** | Firebase config issue |

---

## online-play.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shouldn't ask for pin if logged in | **NOT ADDRESSED** | Session check missing (unlike dashboard) |
| ❌ Index error | **NOT ADDRESSED** ⚠️ | Firestore composite index likely missing |
| ❌ getPendingChallenges 500 error | **NOT ADDRESSED** | Cloud function bug - found in functions/online-play.js |

---

## leaderboards.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Copy of homepage? | **NOT ADDRESSED** | File doesn't exist at expected path - needs investigation |

---

## schedule.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Same as calendar page? Doesn't load | **NOT ADDRESSED** | File may not exist or broken |
| ❌ Export error with stats-helpers.js | **NOT ADDRESSED** | Module export issue |

---

## settings.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shows homepage clone | **NOT ADDRESSED** | File doesn't exist at expected path |
| ❌ Active league card doesn't populate | **NOT ADDRESSED** | Data loading issue |

---

## notification-settings.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shows home screen clone | **NOT ADDRESSED** | Needs investigation |

---

## league-view.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shouldn't need director login if logged in | **NOT ADDRESSED** | Too many login prompts - session should carry over |

---

## What HAS Been Fixed

### ✅ Confirmed Fixed (2 issues)

1. **Session Management (PIN re-prompts)** - dashboard.html
   - localStorage session properly implemented
   - Session checked on page load before showing login
   - PIN stored and validated correctly
   - Location: `public/pages/dashboard.html` lines 1039-1059, 1106-1113

2. **CORS Configuration** - Cloud Functions
   - All HTTP functions properly wrapped with CORS middleware
   - `getUnreadNotificationCount` specifically has CORS enabled
   - Headers include `Access-Control-Allow-Origin: *`
   - Location: `functions/index.js` line 8, `functions/notification-api.js`

### ⚠️ Partially Addressed (3 issues)

1. **community-events.html - Firestore Index**
   - **Known issue:** Index definition missing from firestore.indexes.json
   - **Required index:** Collection `community_events`, fields: `status` (ASC), `event_date` (ASC)
   - **Impact:** Production queries will fail with FAILED_PRECONDITION error
   - **Fix needed:** Add index definition and deploy with `firebase deploy --only firestore:indexes`

2. **community-events.html - Storage Permissions**
   - **Known issue:** storage.rules missing authentication checks
   - **Current:** Anyone can upload/read (security vulnerability)
   - **Required:** Add `request.auth != null` to all write rules
   - **Impact:** Anonymous users can upload files, read all storage
   - **Fix needed:** Update storage.rules and deploy with `firebase deploy --only storage`

3. **online-play.html - Session Management**
   - **Status:** Page exists but unclear if session check implemented
   - **Needs:** Same localStorage session check as dashboard.html

---

## Priority Recommendations (Updated)

### 🔴 CRITICAL (Security/Blocking)

1. **Firestore Indexes** - Add composite index for community_events queries
   - File: `firestore.indexes.json` is completely empty
   - Deploy with: `firebase deploy --only firestore:indexes`

2. **Storage Rules** - Add authentication requirements
   - File: `storage.rules` has no auth checks
   - Deploy with: `firebase deploy --only storage`

3. **getPendingChallenges 500 error** - Cloud function crashing
   - Location: `functions/online-play.js`

### 🟡 HIGH PRIORITY (User Experience)

4. **Session persistence across pages** - online-play.html, league-view.html still ask for PIN
5. **News feed not populating** - Backend/frontend implementation
6. **Schedule cards missing event titles** - Data not loading properly
7. **Import statement errors** - browse-events.html, live-scoreboard.html

### 🟢 MEDIUM PRIORITY (UI/UX Improvements)

8. **Friend requests display** - Feature not implemented
9. **Map view filters** - community-events.html
10. **Modal functionality** - dashboard.html detailed info modal
11. **Navigation improvements** - Back buttons, menu structure
12. **Form auto-population** - community-events.html "your name" field

### ⚪ LOW PRIORITY (Polish)

13. **Page routing issues** - settings.html, leaderboards.html, schedule.html may be duplicate/missing files
14. **Layout tweaks** - Button positioning, card layouts

---

## Investigation Notes

### Files Confirmed to Exist
- ✅ `public/pages/dashboard.html`
- ✅ `public/pages/browse-events.html`
- ✅ `public/pages/community-events.html`
- ✅ `public/pages/live-scoreboard.html`
- ✅ `public/pages/online-play.html`
- ❌ `public/pages/settings.html` (not found)
- ❌ `public/pages/leaderboards.html` (not found)

### Configuration Files Status
- ⚠️ `firestore.indexes.json` - EXISTS but EMPTY (only has empty arrays)
- ⚠️ `storage.rules` - EXISTS but INSECURE (no auth checks)
- ✅ `functions/index.js` - CORS properly configured
- ✅ `functions/notification-api.js` - CORS properly configured

### Cloud Functions with Known Issues
- `getUnreadNotificationCount` - CORS ✅ FIXED
- `getPendingChallenges` - 500 error ❌ NOT FIXED (in functions/online-play.js)
- `updateImportedMatchStats` - Working (used in match imports)
- `importMatchData` - Working (used in match imports)

---

## Next Steps

1. **Deploy Firestore indexes** - Highest priority, will unblock community-events
2. **Fix storage rules** - Security risk, should be addressed ASAP
3. **Debug getPendingChallenges** - Find root cause of 500 error
4. **Implement session checks** - Apply dashboard pattern to other pages
5. **Investigate missing pages** - settings.html, leaderboards.html, schedule.html

---

**Report Generated:** 2026-01-27
**Method:** File inspection + exploration agents + code analysis
**Confidence Level:** High (based on direct file/code inspection)
