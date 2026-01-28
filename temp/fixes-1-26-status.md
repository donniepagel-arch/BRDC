# Fixes 1-26 AM - Status Assessment

## General Site Fixes

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Pages keep asking for pin after login | **NOT ADDRESSED** | Session management issue |
| ❌ 'matchmaker' should be like other events | **NOT ADDRESSED** | Menu structure |
| ❌ Scorer hub pulling old scorer | **NOT ADDRESSED** | Need to review |
| ❌ 'Practice mode' → 'VR-darts', add back button | **NOT ADDRESSED** | Naming/navigation |

## Dashboard.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Schedule cards need event title | **NOT ADDRESSED** | Missing league/tournament names |
| ❌ Detailed info modal doesn't pop up | **NOT ADDRESSED** | |
| ❌ Show entire league schedule | **NOT ADDRESSED** | Currently limited? |
| ❌ Stat card needs link to profile page | **NOT ADDRESSED** | |
| ❌ News feed doesn't populate | **NOT ADDRESSED** | |
| ❌ Show friend requests in news feed | **NOT ADDRESSED** | |
| ❌ CORS error: getUnreadNotificationCount | **NOT ADDRESSED** | Cloud function CORS headers |

## Browse-events.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Information doesn't populate | **NOT ADDRESSED** | |
| ❌ Import statement error | **NOT ADDRESSED** | Module loading issue |

## community-events.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Move add event button inline with view toggles | **NOT ADDRESSED** | Layout |
| ❌ Remove 'your name' field (auto-populate) | **NOT ADDRESSED** | |
| ❌ Map view needs filters | **NOT ADDRESSED** | |
| ❌ Firestore index error | **NOT ADDRESSED** | Need to create index |
| ❌ Storage permission error | **NOT ADDRESSED** | Firebase rules |

## live-scoreboard.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Import statement error | **NOT ADDRESSED** | |
| ❌ Firebase not initialized error | **NOT ADDRESSED** | |

## online-play.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shouldn't ask for pin if logged in | **NOT ADDRESSED** | Session check |
| ❌ Index error | **NOT ADDRESSED** | Firestore index |
| ❌ getPendingChallenges 500 error | **NOT ADDRESSED** | Cloud function bug |

## leaderboards.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Copy of homepage? | **NOT ADDRESSED** | Need discussion |

## schedule.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Same as calendar page? Doesn't load | **NOT ADDRESSED** | |
| ❌ Export error with stats-helpers.js | **NOT ADDRESSED** | Module export issue |

## settings.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shows homepage clone | **NOT ADDRESSED** | |
| ❌ Active league card doesn't populate | **NOT ADDRESSED** | |

## notification-settings.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shows home screen clone | **NOT ADDRESSED** | |

## league-view.html

| Issue | Status | Notes |
|-------|--------|-------|
| ❌ Shouldn't need director login if logged in | **NOT ADDRESSED** | Too many login prompts |

---

## Summary

**Total Issues: 31**
- ✅ Addressed: **0**
- ❌ Not Addressed: **31**

## What We DID Work On Today

Today's work focused entirely on the **match data import system**:
1. ✅ Fixed RTF parser to detect doubles games (20 parsing errors fixed)
2. ✅ Implemented checkout_darts tracking for accurate 3DA calculations
3. ✅ Imported all Week 2 matches
4. ✅ Created working import pipeline with proper documentation

**None of the issues in "fixes 1-26 am.rtf" have been addressed yet.**

## Priority Recommendations

Based on severity and user impact:

**HIGH PRIORITY:**
1. Pages asking for pin after login (affects entire user experience)
2. CORS errors (breaks functionality)
3. Firestore index errors (prevents data loading)
4. Storage permission errors (blocks features)

**MEDIUM PRIORITY:**
5. News feed not populating
6. Schedule cards missing event titles
7. Friend requests display
8. Module import errors

**LOW PRIORITY:**
9. Navigation improvements (back buttons, menu structure)
10. UI cleanup (homepage clones, layout tweaks)
