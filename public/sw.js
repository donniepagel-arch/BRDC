/**
 * BRDC Service Worker
 * Provides offline caching and IndexedDB storage for game data
 * v29 - Added Virtual Darts offline support, improved fallback page
 */

const CACHE_VERSION = 'brdc-v29';
const CACHE_NAME = `brdc-cache-${CACHE_VERSION}`;

// Critical pages - scorer pages prioritized for offline use
const CRITICAL_PAGES = [
    '/',
    '/pages/league-501.html',      // Primary scorer - CRITICAL
    '/pages/league-cricket.html',  // Primary scorer - CRITICAL
    '/pages/x01.html',             // Casual scorer
    '/pages/cricket.html',         // Casual scorer
    '/pages/scorer-hub.html',      // Scorer navigation
    '/pages/game-setup.html',      // Game setup
    '/pages/match-night.html',     // Match night flow
    '/pages/knockout.html',        // Knockout games
    '/pages/dashboard.html',       // Player dashboard
    '/pages/login.html',           // Login page
    '/pages/match-hub.html',       // Match details
    '/pages/league-view.html',     // League overview
    '/pages/player-profile.html',  // Player stats
    '/pages/team-profile.html',    // Team stats
    '/pages/messages.html',        // Messaging
    '/pages/captain-dashboard.html', // Captain tools
    '/pages/league-director.html', // Director tools
    '/pages/my-stats.html',        // Personal stats
    '/pages/leagues.html',         // League list
    '/pages/tournaments.html',     // Tournament list
    '/pages/browse-events.html',   // Event browser
    '/pages/members.html',         // Member directory
    '/pages/offline.html'          // Offline fallback
];

// Virtual Darts - fully offline capable game
const VIRTUAL_DARTS_ASSETS = [
    '/virtual-darts/index.html',
    '/virtual-darts/styles.css',
    '/virtual-darts/config.js',
    '/virtual-darts/achievements.js',
    // Phase 1 - Core
    '/virtual-darts/js/phase1/dartboard.js',
    '/virtual-darts/js/phase1/swipeDetector.js',
    '/virtual-darts/js/phase1/physics.js',
    '/virtual-darts/js/phase1/practiceMode.js',
    '/virtual-darts/js/phase1/main.js',
    // Phase 2 - Aim & Strategy
    '/virtual-darts/js/phase2/outshotTables.js',
    '/virtual-darts/js/phase2/aimSystem.js',
    '/virtual-darts/js/phase2/autoSuggest.js',
    '/virtual-darts/js/phase2/tipEngine.js',
    '/virtual-darts/js/phase2/cricketLogic.js',
    '/virtual-darts/js/phase2/bobs27.js',
    // Phase 3 - Advanced
    '/virtual-darts/js/phase3/collision.js',
    '/virtual-darts/js/phase3/ochePosition.js',
    '/virtual-darts/js/phase3/animations.js',
    // Phase 4 - Integration
    '/virtual-darts/js/phase4/profileManager.js',
    '/virtual-darts/js/phase4/gameLogger.js',
    '/virtual-darts/js/phase4/statsTracker.js',
    // Phase 5 - Polish
    '/virtual-darts/js/phase5/tutorial.js',
    // Data files
    '/virtual-darts/data/outshots.json',
    '/virtual-darts/data/wedgeShots.json',
    '/virtual-darts/data/cricketRules.json'
];

// All JavaScript files - critical for app functionality
const JS_ASSETS = [
    '/js/firebase-config.js',
    '/js/stats-helpers.js',
    '/js/feedback.js',
    '/js/offline-storage.js',
    '/js/nav-menu.js',
    '/js/social.js',
    '/js/challenge-system.js',
    '/js/chat-config.js',
    '/js/live-ticker.js',
    '/js/presence.js',
    '/js/push-notifications.js'
];

// CSS files
const CSS_ASSETS = [
    '/css/brdc-styles.css',
    '/css/messaging.css'
];

// Images and static assets
const STATIC_ASSETS = [
    '/images/gold_logo.png',
    '/images/favicon.png',
    '/images/skull-logo.png',
    '/images/skull-logo-with-text.png',
    '/images/white_logo.jpg',
    '/manifest.json'
];

// Combine all assets for precaching
const PRECACHE_ASSETS = [
    ...CRITICAL_PAGES,
    ...VIRTUAL_DARTS_ASSETS,
    ...JS_ASSETS,
    ...CSS_ASSETS,
    ...STATIC_ASSETS
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker v29...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching', PRECACHE_ASSETS.length, 'assets');
                // Cache assets individually to handle failures gracefully
                return Promise.allSettled(
                    PRECACHE_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[SW] Failed to cache:', url, err.message);
                            return null;
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Cache install failed:', err))
    );
});

// Activate event - clean ALL old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker v29...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('brdc-cache-') && name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
            .then(() => {
                // Notify all clients that SW is updated
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
                    });
                });
            })
    );
});

// Fetch event - strategy varies by resource type
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests (Firebase, APIs, etc.)
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('cloudfunctions.net')) return;
    if (url.pathname.includes('__')) return; // Firebase internal

    // Scorer pages: CACHE-FIRST (critical for offline scoring)
    const isScorerPage = url.pathname.includes('league-501') ||
                         url.pathname.includes('league-cricket') ||
                         url.pathname.includes('x01.html') ||
                         url.pathname.includes('cricket.html') ||
                         url.pathname.includes('scorer-hub');

    if (isScorerPage) {
        event.respondWith(cacheFirstWithNetworkUpdate(request));
        return;
    }

    // Virtual Darts: CACHE-FIRST (fully offline capable game)
    if (url.pathname.startsWith('/virtual-darts/')) {
        event.respondWith(cacheFirstWithNetworkUpdate(request));
        return;
    }

    // HTML pages: NETWORK-FIRST with offline fallback
    if (request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/') {
        event.respondWith(networkFirstWithOfflineFallback(request));
        return;
    }

    // JS files: STALE-WHILE-REVALIDATE (serve cached, update in background)
    if (url.pathname.endsWith('.js')) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    // CSS, images, fonts: CACHE-FIRST with background update
    if (url.pathname.match(/\.(css|png|jpg|jpeg|svg|gif|ico|woff2?|ttf|eot)$/)) {
        event.respondWith(cacheFirstWithNetworkUpdate(request));
        return;
    }

    // Default: STALE-WHILE-REVALIDATE
    event.respondWith(staleWhileRevalidate(request));
});

/**
 * Cache-first strategy with background network update
 * Best for: Static assets, scorer pages (critical offline)
 */
async function cacheFirstWithNetworkUpdate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Always try to update cache in background
    const networkPromise = fetch(request)
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }

    // No cache, wait for network
    const networkResponse = await networkPromise;
    if (networkResponse) {
        return networkResponse;
    }

    // Offline with no cache
    return createOfflineResponse(request);
}

/**
 * Network-first strategy with offline fallback
 * Best for: HTML pages that change frequently
 */
async function networkFirstWithOfflineFallback(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache, return offline page
        return createOfflineResponse(request);
    }
}

/**
 * Stale-while-revalidate strategy
 * Best for: JS files, API responses
 * Returns cached immediately, updates in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch fresh copy in background
    const fetchPromise = fetch(request)
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    // Return cached immediately, or wait for network
    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetchPromise;
    if (networkResponse) {
        return networkResponse;
    }

    return createOfflineResponse(request);
}

/**
 * Create offline response based on request type
 */
async function createOfflineResponse(request) {
    const url = new URL(request.url);

    // For HTML pages, try offline page first
    if (request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html')) {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match('/pages/offline.html');
        if (offlinePage) {
            return offlinePage;
        }

        // Fallback to scorer-hub for scorer pages
        if (url.pathname.includes('league-') || url.pathname.includes('scorer')) {
            const scorerHub = await cache.match('/pages/scorer-hub.html');
            if (scorerHub) return scorerHub;
        }
    }

    // Generic offline response
    return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Offline - BRDC</title>
            <style>
                body {
                    font-family: system-ui, sans-serif;
                    background: #1a1a2e;
                    color: #eee;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .offline-container {
                    text-align: center;
                    max-width: 400px;
                }
                h1 { color: #20b2aa; margin-bottom: 10px; }
                p { color: #888; line-height: 1.6; }
                .icon { font-size: 64px; margin-bottom: 20px; }
                .btn {
                    display: inline-block;
                    background: #e91e8c;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <div class="icon">📡</div>
                <h1>You're Offline</h1>
                <p>Your scores are saved locally and will sync when you reconnect.</p>
                <p>Scoring pages work offline - try opening the scorer directly.</p>
                <a href="/pages/scorer-hub.html" class="btn">Open Scorer</a>
            </div>
        </body>
        </html>`,
        {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/html' }
        }
    );
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data?.type === 'CACHE_URLS') {
        // Allow app to request additional URLs to cache
        const urls = event.data.urls || [];
        caches.open(CACHE_NAME).then(cache => {
            urls.forEach(url => {
                cache.add(url).catch(err => {
                    console.warn('[SW] Failed to cache:', url);
                });
            });
        });
    }
});

// Background sync for pending game data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-game-data') {
        event.waitUntil(syncPendingGameData());
    }
});

async function syncPendingGameData() {
    console.log('[SW] Syncing pending game data...');
    // Notify clients to sync their IndexedDB data
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_GAME_DATA' });
    });
}

// Periodic cache cleanup (remove stale entries)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupCache());
    }
});

async function cleanupCache() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();

    // Remove entries older than 7 days that aren't in precache list
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const request of requests) {
        const url = new URL(request.url);
        const isPrecached = PRECACHE_ASSETS.some(asset => url.pathname === asset);

        if (!isPrecached) {
            // For non-precached items, we could check headers for age
            // For now, just log what we'd clean
            console.log('[SW] Cache cleanup candidate:', url.pathname);
        }
    }
}
