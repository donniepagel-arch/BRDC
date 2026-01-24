# PWA / Service Worker Audit

**Date:** 2026-01-21
**Status:** AUDIT ONLY - No modifications made

---

## Summary

The BRDC app has a basic PWA setup but only caches a small subset of pages. This severely limits offline functionality.

---

## What's Currently Cached

### Static Assets in sw.js (CACHE_VERSION: brdc-v26)

```javascript
const STATIC_ASSETS = [
    '/',
    '/pages/game-setup.html',
    '/pages/league-501.html',
    '/pages/league-cricket.html',
    '/pages/scorer-hub.html',
    '/pages/match-night.html',
    '/pages/dashboard.html',
    '/js/firebase-config.js',
    '/css/brdc-styles.css',
    '/images/gold_logo.png',
    '/images/favicon.png',
    '/manifest.json'
];
```

**Total: 12 assets (6 HTML pages)**

### Caching Strategy

| Content Type | Strategy |
|--------------|----------|
| HTML, JS | Network-first (fallback to cache) |
| CSS, Images, Fonts | Cache-first (fallback to network) |

---

## What's Missing from Cache

### HTML Pages Not Cached (47 of 53)

The following pages will NOT work offline:

**High Priority (Core User Flows):**
- `login.html` - User cannot log in offline
- `match-hub.html` - Match management/viewing
- `league-view.html` - League standings/schedule
- `player-profile.html` - Player stats
- `team-profile.html` - Team roster/stats
- `browse-events.html` - Event discovery
- `tournament-view.html` - Tournament brackets

**Medium Priority (Admin/Setup):**
- `create-league.html`
- `create-tournament.html`
- `draft-board.html`
- `director-dashboard.html`
- `team-management.html`
- `schedule-generator.html`

**Lower Priority (Utility/Edge Cases):**
- `matchmaker-*.html` (4 pages)
- `messages.html` / `chat-room.html`
- `stat-verification.html`
- `event-view.html`
- `player-lookup.html`
- Many more...

### JavaScript Files Not Cached

- `/js/stats-helpers.js` - Used across many pages
- `/js/feedback.js` - Used on all pages
- Any other JS modules

### CSS Files Not Cached

- Only `/css/brdc-styles.css` is cached
- Individual page `<style>` blocks are embedded (OK)

---

## Potential Stale Cache Issues

### 1. CACHE_VERSION Management
Current version: `brdc-v26`

**Concern:** Version must be manually updated with each deployment. If forgotten:
- Users keep serving old cached files
- Bug fixes don't propagate
- Feature mismatches between cached/live code

### 2. Network-First for HTML
This is correct for dynamic content, but:
- If offline, only 6 pages work
- API calls (Firebase) fail completely offline
- No offline data persistence

### 3. No Cache Invalidation on Deploy
The service worker activates and deletes old caches on version change, but:
- Firebase hosting already handles CDN caching
- Double-caching can cause version drift
- No way to force-refresh without changing CACHE_VERSION

---

## Manifest.json Status

**Status:** ✅ Properly configured

```json
{
    "name": "BRDC Dart Scorer",
    "short_name": "BRDC",
    "start_url": "/pages/scorer-hub.html",
    "display": "standalone",
    "background_color": "#1a1a2e",
    "theme_color": "#FF469A",
    "icons": [...],
    "gcm_sender_id": "103953800507"
}
```

**Notes:**
- `start_url` is `/pages/scorer-hub.html` which IS cached ✅
- Push notification support configured (gcm_sender_id)
- Icons properly defined (192x192, 512x512)

---

## Service Worker Registration

**Status:** ✅ Registered on major pages

Found registration in:
- `dashboard.html`
- `scorer-hub.html`
- `game-setup.html`
- `league-501.html`
- `league-cricket.html`
- `match-night.html`
- `match-hub.html`
- `league-view.html`

**Registration code:**
```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
```

---

## Recommendations

### Immediate (Low Effort, High Impact)

1. **Add critical pages to STATIC_ASSETS:**
   ```javascript
   const STATIC_ASSETS = [
       // ... existing ...
       '/pages/login.html',
       '/pages/match-hub.html',
       '/pages/league-view.html',
       '/pages/player-profile.html',
       '/pages/team-profile.html',
       '/js/stats-helpers.js',
       '/js/feedback.js'
   ];
   ```

2. **Automate CACHE_VERSION bumps:**
   - Add build step or use timestamp: `brdc-v${Date.now()}`
   - Or hash content for automatic invalidation

### Medium Term

3. **Cache all HTML pages:**
   - ~53 pages total, small file sizes
   - Or use runtime caching to cache on first visit

4. **Add offline indicator:**
   - Show banner when offline
   - Disable features that require network

5. **Cache Firebase data:**
   - Use Firestore persistence: `firebase.firestore().enablePersistence()`
   - Already available in Firebase SDK

### Long Term

6. **Background sync for scoring:**
   - Queue game scores when offline
   - Sync when back online
   - Critical for scorer pages

7. **Workbox migration:**
   - Replace manual SW with Workbox
   - Better caching strategies
   - Built-in precaching

---

## Risk Assessment

| Issue | Severity | Impact |
|-------|----------|--------|
| Only 6/53 pages cached | HIGH | Most of app unusable offline |
| No Firebase persistence | MEDIUM | No data access offline |
| Manual cache versioning | LOW | Potential stale content |
| No offline indicator | LOW | User confusion when offline |

---

## Files Reviewed

- `/public/sw.js` - Service worker
- `/public/manifest.json` - PWA manifest
- `/public/pages/*.html` (53 files) - Page count
- Service worker registration in 8+ pages

---

## Next Steps

1. Review this audit with team
2. Prioritize which pages to cache
3. Consider Firestore persistence for offline data
4. Implement changes in separate PR
