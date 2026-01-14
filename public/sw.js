/**
 * BRDC Service Worker
 * Provides offline caching and IndexedDB storage for game data
 */

const CACHE_VERSION = 'brdc-v1';
const CACHE_NAME = `brdc-cache-${CACHE_VERSION}`;

// Files to cache for offline use
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
    '/images/white_logo.jpg',
    '/images/favicon.png',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Cache install failed:', err))
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
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
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and Firebase/external requests
    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('cloudfunctions.net')) return;

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    // Fetch in background to update cache
                    fetch(request)
                        .then((response) => {
                            if (response.ok) {
                                caches.open(CACHE_NAME)
                                    .then((cache) => cache.put(request, response));
                            }
                        })
                        .catch(() => {});
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetch(request)
                    .then((response) => {
                        // Cache successful responses
                        if (response.ok && url.pathname.match(/\.(html|js|css|png|jpg|svg)$/)) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return offline page for HTML requests
                        if (request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('/pages/scorer-hub.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
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
    // This will be handled by the IndexedDB sync logic in the app
}
