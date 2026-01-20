/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications for BRDC Darts
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
    apiKey: "AIzaSyDN1aYhoVt3OX5EafsNTVB09i8VFx7QM1U",
    authDomain: "brdc-v2.firebaseapp.com",
    projectId: "brdc-v2",
    storageBucket: "brdc-v2.firebasestorage.app",
    messagingSenderId: "726670872282",
    appId: "1:726670872282:web:913d19c8cb3b24bf919fe3"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || 'BRDC Darts';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/images/gold_logo.png',
        badge: '/images/gold_logo.png',
        tag: payload.data?.tag || 'brdc-notification',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        actions: getActionsForType(payload.data?.type)
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get notification actions based on type
function getActionsForType(type) {
    switch (type) {
        case 'challenge':
            return [
                { action: 'accept', title: 'Accept' },
                { action: 'decline', title: 'Decline' }
            ];
        case 'message':
            return [
                { action: 'reply', title: 'Reply' },
                { action: 'view', title: 'View' }
            ];
        case 'match_reminder':
            return [
                { action: 'confirm', title: 'Confirm' },
                { action: 'view', title: 'View Details' }
            ];
        default:
            return [];
    }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);

    event.notification.close();

    const data = event.notification.data || {};
    let targetUrl = '/pages/dashboard.html';

    // Determine target URL based on notification type
    switch (data.type) {
        case 'challenge':
            targetUrl = '/pages/messages.html';
            break;
        case 'message':
            if (data.conversation_id) {
                targetUrl = `/pages/conversation.html?id=${data.conversation_id}`;
            } else if (data.room_id) {
                targetUrl = `/pages/chat-room.html?id=${data.room_id}`;
            } else {
                targetUrl = '/pages/messages.html';
            }
            break;
        case 'match_reminder':
            if (data.match_id) {
                targetUrl = `/pages/league-match.html?match_id=${data.match_id}`;
            }
            break;
        case 'match_result':
            if (data.league_id) {
                targetUrl = `/pages/league-view.html?league_id=${data.league_id}`;
            }
            break;
    }

    // Handle action buttons
    if (event.action === 'accept' && data.challenge_id) {
        // Accept challenge action
        targetUrl = `/pages/messages.html?action=accept&challenge=${data.challenge_id}`;
    } else if (event.action === 'decline' && data.challenge_id) {
        targetUrl = `/pages/messages.html?action=decline&challenge=${data.challenge_id}`;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url.includes('brdc') && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Open new window if not
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// Listen for push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW] Push subscription changed');
    // Re-subscribe logic could go here
});
