/**
 * Service Worker Registration
 * Add this script to every page for offline support
 *
 * Usage:
 * <script src="/js/sw-register.js"></script>
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered:', registration.scope);

                // Check for updates every 60 seconds
                setInterval(() => {
                    registration.update();
                }, 60000);

                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            console.log('🔄 New version available! Reload to update.');

                            // Optional: Show update notification
                            if (confirm('A new version of BRDC is available. Reload now?')) {
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('❌ Service Worker registration failed:', error);
            });
    });
}

// Handle offline/online status
window.addEventListener('online', () => {
    console.log('✅ Back online');
    document.body.classList.remove('offline');

    // Optional: Show reconnected notification
    showToast('Connected', 'success');
});

window.addEventListener('offline', () => {
    console.log('⚠️ Offline mode');
    document.body.classList.add('offline');

    // Optional: Show offline notification
    showToast('Offline - Limited functionality', 'warning');
});

// Simple toast notification (optional)
function showToast(message, type = 'info') {
    // Only show toast if function exists on page
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    }
}
