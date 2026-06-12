// Minimal service worker — just enables PWA installability. We deliberately
// do not cache anything: the relay stream is always live, and the static
// shell is small and changes when we ship updates.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* default: hit network */ });
