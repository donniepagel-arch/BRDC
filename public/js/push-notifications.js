/**
 * BRDC Push Notification Client Library
 * Handles FCM token management and notification permissions
 */

// Firebase messaging instance (lazy loaded)
let messagingInstance = null;

// VAPID key for FCM (public key)
// You'll need to generate this in Firebase Console > Project Settings > Cloud Messaging
const VAPID_KEY = 'BOB_P5xO-RXyvDqZYuVgRMCXiX7wYBhCIiWWR-NVTXshUFtif_YspGW6fxaMA6wYXKdk4PanSGG1Kk27XxUNCFA'; // TODO: Replace with actual VAPID key

/**
 * Initialize Firebase Messaging
 */
async function initializeMessaging() {
    if (messagingInstance) return messagingInstance;

    try {
        // Dynamically import Firebase Messaging
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');

        // Check if Firebase app is already initialized
        let app;
        if (getApps().length === 0) {
            app = initializeApp({
                apiKey: "AIzaSyDN1aYhoVt3OX5EafsNTVB09i8VFx7QM1U",
                authDomain: "brdc-v2.firebaseapp.com",
                projectId: "brdc-v2",
                storageBucket: "brdc-v2.firebasestorage.app",
                messagingSenderId: "726670872282",
                appId: "1:726670872282:web:913d19c8cb3b24bf919fe3"
            });
        } else {
            app = getApps()[0];
        }

        messagingInstance = getMessaging(app);

        // Set up foreground message handler
        onMessage(messagingInstance, (payload) => {
            handleForegroundMessage(payload);
        });

        return messagingInstance;
    } catch (error) {
        console.error('Error initializing messaging:', error);
        return null;
    }
}

/**
 * Handle foreground messages (when app is open)
 */
function handleForegroundMessage(payload) {
    const { title, body } = payload.notification || payload.data || {};
    const data = payload.data || {};

    // Show in-app notification toast
    showNotificationToast(title, body, data);

    // Update badges if needed
    if (data.type === 'challenge') {
        updateLobbyBadge();
    } else if (data.type === 'message') {
        updateMessagesBadge();
    }
}

/**
 * Show in-app notification toast
 */
function showNotificationToast(title, body, data = {}) {
    // Remove existing toast
    const existing = document.querySelector('.brdc-notification-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'brdc-notification-toast';
    toast.innerHTML = `
        <div class="toast-icon">${getIconForType(data.type)}</div>
        <div class="toast-content">
            <div class="toast-title">${title || 'BRDC'}</div>
            <div class="toast-body">${body || ''}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">x</button>
    `;

    // Add click handler
    toast.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toast-close')) {
            navigateToNotification(data);
            toast.remove();
        }
    });

    // Add styles if not present
    if (!document.getElementById('notification-toast-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-toast-styles';
        styles.textContent = `
            .brdc-notification-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                left: 20px;
                max-width: 400px;
                margin: 0 auto;
                background: linear-gradient(135deg, #16213e, #1e2a47);
                border: 2px solid #FF469A;
                border-radius: 12px;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(255, 70, 154, 0.3);
                animation: slideIn 0.3s ease-out;
                cursor: pointer;
            }
            @keyframes slideIn {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .toast-icon {
                font-size: 28px;
                flex-shrink: 0;
            }
            .toast-content {
                flex: 1;
                min-width: 0;
            }
            .toast-title {
                font-family: 'Bebas Neue', cursive;
                font-size: 16px;
                color: #FF469A;
                margin-bottom: 4px;
            }
            .toast-body {
                font-size: 14px;
                color: #f0f0f0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .toast-close {
                background: none;
                border: none;
                color: rgba(255,255,255,0.5);
                font-size: 20px;
                cursor: pointer;
                padding: 4px;
            }
        `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function getIconForType(type) {
    switch (type) {
        case 'challenge': return '!';
        case 'message': return 'M';
        case 'match_reminder': return '@';
        case 'match_result': return 'W';
        default: return 'B';
    }
}

function navigateToNotification(data) {
    switch (data.type) {
        case 'challenge':
            window.location.href = '/pages/messages.html';
            break;
        case 'message':
            if (data.conversation_id) {
                window.location.href = `/pages/conversation.html?id=${data.conversation_id}`;
            } else if (data.room_id) {
                window.location.href = `/pages/chat-room.html?id=${data.room_id}`;
            } else {
                window.location.href = '/pages/messages.html';
            }
            break;
        case 'match_reminder':
            if (data.match_id) {
                window.location.href = `/pages/league-match.html?match_id=${data.match_id}`;
            }
            break;
    }
}

function updateLobbyBadge() {
    const badge = document.getElementById('lobbyBadge');
    if (badge) {
        const current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
        badge.style.display = 'flex';
    }
}

function updateMessagesBadge() {
    const badge = document.getElementById('directBadge');
    if (badge) {
        const current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
        badge.style.display = 'flex';
    }
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if denied
 */
async function requestNotificationPermission() {
    // Check if notifications are supported
    if (!('Notification' in window)) {
        return null;
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
        return null;
    }

    try {
        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            return null;
        }

        // Register service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Initialize messaging
        const messaging = await initializeMessaging();
        if (!messaging) {
            console.error('Failed to initialize messaging');
            return null;
        }

        // Get FCM token
        const { getToken } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        return token;

    } catch (error) {
        console.error('Error getting notification permission:', error);
        return null;
    }
}

/**
 * Save FCM token to player's Firestore document
 * @param {string} playerId - Player document ID
 * @param {string} fcmToken - FCM token to save
 */
async function saveFCMToken(playerId, fcmToken) {
    if (!playerId || !fcmToken) return false;

    try {
        const { db, doc, setDoc } = await import('/js/firebase-config.js');

        // Save to fcm_tokens collection (players collection is write-restricted)
        await setDoc(doc(db, 'fcm_tokens', playerId), {
            token: fcmToken,
            player_id: playerId,
            updated_at: new Date(),
            platform: detectPlatform(),
            notifications_enabled: true
        });

        return true;

    } catch (error) {
        console.error('Error saving FCM token:', error);
        return false;
    }
}

/**
 * Detect platform for analytics
 */
function detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Mac/.test(ua)) return 'mac';
    return 'web';
}

/**
 * Check if notifications are enabled
 */
function areNotificationsEnabled() {
    return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get current notification permission status
 */
function getNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * Show prompt to enable notifications
 */
async function showNotificationPrompt(playerId) {
    // Don't show if already granted or denied
    const permission = getNotificationPermission();
    if (permission === 'granted' || permission === 'denied') {
        return permission === 'granted';
    }

    // Check if user dismissed prompt recently (stored in localStorage)
    const lastDismissed = localStorage.getItem('brdc_notification_prompt_dismissed');
    if (lastDismissed) {
        const dismissedDate = new Date(lastDismissed);
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
            // Don't show prompt again for 7 days
            return false;
        }
    }

    // Create prompt UI
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'notification-prompt-overlay';
        overlay.innerHTML = `
            <div class="notification-prompt">
                <div class="prompt-icon">B</div>
                <h3>Enable Notifications</h3>
                <p>Get notified when:</p>
                <ul>
                    <li>Someone challenges you to a game</li>
                    <li>You receive a new message</li>
                    <li>Your match is about to start</li>
                    <li>Match results are posted</li>
                </ul>
                <div class="prompt-buttons">
                    <button class="prompt-btn enable">ENABLE</button>
                    <button class="prompt-btn skip">NOT NOW</button>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .notification-prompt-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                z-index: 10001;
            }
            .notification-prompt {
                background: #16213e;
                border: 3px solid #FF469A;
                border-radius: 16px;
                padding: 30px;
                max-width: 360px;
                text-align: center;
            }
            .prompt-icon {
                width: 64px;
                height: 64px;
                margin: 0 auto 20px;
                background: linear-gradient(135deg, #FF469A, #91D7EB);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
            }
            .notification-prompt h3 {
                font-family: 'Bebas Neue', cursive;
                font-size: 28px;
                color: #FF469A;
                margin-bottom: 12px;
            }
            .notification-prompt p {
                color: #8a8aa3;
                margin-bottom: 8px;
            }
            .notification-prompt ul {
                text-align: left;
                color: #f0f0f0;
                padding-left: 20px;
                margin-bottom: 24px;
            }
            .notification-prompt li {
                margin: 8px 0;
                font-size: 14px;
            }
            .prompt-buttons {
                display: flex;
                gap: 12px;
            }
            .prompt-btn {
                flex: 1;
                padding: 14px;
                border-radius: 8px;
                font-family: 'Bebas Neue', cursive;
                font-size: 18px;
                cursor: pointer;
                border: 2px solid #000;
            }
            .prompt-btn.enable {
                background: linear-gradient(180deg, #FF469A, #d63384);
                color: white;
            }
            .prompt-btn.skip {
                background: rgba(255,255,255,0.1);
                color: #8a8aa3;
            }
        `;
        document.head.appendChild(styles);
        document.body.appendChild(overlay);

        // Handle enable button
        overlay.querySelector('.prompt-btn.enable').addEventListener('click', async () => {
            overlay.remove();
            const token = await requestNotificationPermission();
            if (token && playerId) {
                await saveFCMToken(playerId, token);
            }
            resolve(!!token);
        });

        // Handle skip button
        overlay.querySelector('.prompt-btn.skip').addEventListener('click', () => {
            localStorage.setItem('brdc_notification_prompt_dismissed', new Date().toISOString());
            overlay.remove();
            resolve(false);
        });
    });
}

/**
 * Initialize push notifications for a player
 * Call this after successful login
 */
async function initializePushNotifications(playerId) {
    // Check if already enabled
    if (areNotificationsEnabled()) {
        const token = await requestNotificationPermission();
        if (token) {
            await saveFCMToken(playerId, token);
        }
        return true;
    }

    // Show prompt
    return await showNotificationPrompt(playerId);
}

// Export functions
export {
    initializePushNotifications,
    requestNotificationPermission,
    saveFCMToken,
    areNotificationsEnabled,
    getNotificationPermission,
    showNotificationPrompt,
    showNotificationToast
};
