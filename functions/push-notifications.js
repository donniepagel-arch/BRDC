/**
 * BRDC Push Notification System
 * Tiered notification delivery: Push > SMS > Email
 */

const functions = require('firebase-functions/v1');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { verifyFirebaseAuth } = require('./src/firebase-auth-helper');
const { sendManagedSms, sendManagedEmail } = require('./src/messaging-config');

// Initialize if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Send push notification via FCM
 */
async function sendPushNotification(fcmToken, title, body, data = {}) {
    if (!fcmToken) return { success: false, error: 'No FCM token' };

    try {
        const message = {
            token: fcmToken,
            notification: {
                title,
                body
            },
            data: {
                ...data,
                title,
                body,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            webpush: {
                notification: {
                    title,
                    body,
                    icon: '/images/gold_logo.png',
                    badge: '/images/gold_logo.png',
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: data.link || '/pages/dashboard.html'
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('Push notification sent:', response);
        return { success: true, method: 'push', messageId: response };

    } catch (error) {
        console.error('Push notification error:', error.code, error.message);

        // If token is invalid, remove it from database
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            // Token is stale, could clean it up here
            console.log('Invalid FCM token, should be removed');
        }

        return { success: false, error: error.message, code: error.code };
    }
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, body) {
    const result = await sendManagedSms(to, body);
    return {
        method: 'sms',
        ...result
    };
}

/**
 * Send Email via SendGrid
 */
async function sendEmail(to, subject, html, text) {
    const result = await sendManagedEmail(to, subject, html, text);
    return {
        method: 'email',
        ...result
    };
}

/**
 * Get player notification preferences and tokens
 */
async function getPlayerNotificationInfo(playerId) {
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) return null;

    const player = playerDoc.data();

    return {
        id: playerId,
        name: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Player',
        fcm_token: player.fcm_token || null,
        phone: player.phone || null,
        email: player.email || null,
        notifications_enabled: player.notifications_enabled !== false, // Default true
        notification_preferences: player.notification_preferences || {
            push: true,
            sms: true,
            email: true
        }
    };
}

/**
 * Send notification with tiered fallback
 * Priority: Push (free) > SMS (costs $) > Email (free, low priority)
 */
async function sendTieredNotification(playerId, notification) {
    const { title, body, data = {}, type = 'general' } = notification;

    // Get player info
    const playerInfo = await getPlayerNotificationInfo(playerId);
    if (!playerInfo) {
        console.log('Player not found:', playerId);
        return { success: false, error: 'Player not found' };
    }

    if (!playerInfo.notifications_enabled) {
        console.log('Notifications disabled for player:', playerId);
        return { success: false, error: 'Notifications disabled' };
    }

    const prefs = playerInfo.notification_preferences;
    let result = { success: false, method: null };

    // Try Push first (free!)
    if (prefs.push && playerInfo.fcm_token) {
        result = await sendPushNotification(playerInfo.fcm_token, title, body, {
            ...data,
            type,
            player_id: playerId
        });

        if (result.success) {
            await logNotification(playerId, type, 'push', result);
            return result;
        }
        console.log('Push failed, trying SMS fallback');
    }

    // Fallback to SMS (costs money, but reliable)
    if (prefs.sms && playerInfo.phone) {
        const smsBody = `BRDC: ${title} - ${body}`;
        result = await sendSMS(playerInfo.phone, smsBody);

        if (result.success) {
            await logNotification(playerId, type, 'sms', result);
            return result;
        }
        console.log('SMS failed, trying email fallback');
    }

    // Final fallback to Email (free, but often ignored)
    if (prefs.email && playerInfo.email) {
        const emailHtml = generateEmailHtml(title, body, type, data);
        result = await sendEmail(playerInfo.email, `BRDC: ${title}`, emailHtml);

        if (result.success) {
            await logNotification(playerId, type, 'email', result);
            return result;
        }
    }

    console.log('All notification methods failed for player:', playerId);
    return { success: false, error: 'All methods failed' };
}

/**
 * Generate HTML email content
 */
function generateEmailHtml(title, body, type, data) {
    const typeColors = {
        challenge: '#FF469A',
        message: '#91D7EB',
        match_reminder: '#FDD835',
        match_result: '#4CAF50',
        general: '#FF469A'
    };

    const color = typeColors[type] || typeColors.general;

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #f0f0f0; padding: 30px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://brdc-v2.web.app/images/gold_logo.png" alt="BRDC" style="width: 60px; height: 60px;">
            </div>
            <h2 style="color: ${color}; margin: 0 0 10px; font-size: 24px;">${title}</h2>
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">${body}</p>
            <a href="https://brdc-v2.web.app/pages/dashboard.html" style="display: inline-block; padding: 14px 28px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Open BRDC</a>
            <p style="color: #8a8aa3; font-size: 12px; margin-top: 30px;">
                You received this because you have notifications enabled.
                <a href="https://brdc-v2.web.app/pages/settings.html" style="color: #91D7EB;">Manage preferences</a>
            </p>
        </div>
    `;
}

/**
 * Log notification for analytics
 */
async function logNotification(playerId, type, method, result) {
    try {
        await db.collection('notification_logs').add({
            player_id: playerId,
            type,
            method,
            success: result.success,
            message_id: result.messageId || result.sid || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error logging notification:', error);
    }
}

// ========================================
// NOTIFICATION TRIGGERS
// ========================================

/**
 * Send notification when a challenge is created
 */
exports.onChallengeCreated = onDocumentCreated(
    'challenges/{challengeId}',
    async (event) => {
        const snap = event.data;
        if (!snap) return null;
        const challenge = snap.data();
        const challengeId = event.params.challengeId;

        if (!challenge.target_id) return null;

        await sendTieredNotification(challenge.target_id, {
            title: 'New Challenge!',
            body: `${challenge.challenger_name} wants to play ${challenge.game_type || '501'}`,
            type: 'challenge',
            data: {
                challenge_id: challengeId,
                challenger_id: challenge.challenger_id,
                challenger_name: challenge.challenger_name,
                game_type: challenge.game_type,
                link: '/pages/messages.html'
            }
        });

        return null;
    }
);

/**
 * Send notification when a new direct message is sent
 */
exports.onNewMessage = onDocumentCreated(
    'conversations/{conversationId}/messages/{messageId}',
    async (event) => {
        const snap = event.data;
        if (!snap) return null;
        const message = snap.data();
        const conversationId = event.params.conversationId;

        // Don't notify sender
        if (!message.recipient_id || message.recipient_id === message.sender_id) {
            return null;
        }

        // Get sender name
        const senderName = message.sender_name || 'Someone';

        await sendTieredNotification(message.recipient_id, {
            title: 'New Message',
            body: `${senderName}: ${(message.text || '').substring(0, 50)}${message.text?.length > 50 ? '...' : ''}`,
            type: 'message',
            data: {
                conversation_id: conversationId,
                sender_id: message.sender_id,
                sender_name: senderName,
                link: `/pages/conversation.html?id=${conversationId}`
            }
        });

        return null;
    }
);

/**
 * Send notification when mentioned in a chat room
 */
exports.onChatRoomMention = onDocumentCreated(
    'chat_rooms/{roomId}/messages/{messageId}',
    async (event) => {
        const snap = event.data;
        if (!snap) return null;
        const message = snap.data();
        const roomId = event.params.roomId;

        // Check for mentions in message
        const mentions = message.mentions || [];
        if (mentions.length === 0) return null;

        // Get room info
        const roomDoc = await db.collection('chat_rooms').doc(roomId).get();
        const roomName = roomDoc.exists ? roomDoc.data().name : 'Chat';

        // Notify each mentioned player
        for (const playerId of mentions) {
            if (playerId === message.sender_id) continue;

            await sendTieredNotification(playerId, {
                title: `Mentioned in ${roomName}`,
                body: `${message.sender_name}: ${(message.text || '').substring(0, 50)}`,
                type: 'message',
                data: {
                    room_id: roomId,
                    sender_id: message.sender_id,
                    link: `/pages/chat-room.html?id=${roomId}`
                }
            });
        }

        return null;
    }
);

/**
 * Send notification when challenge is accepted
 */
exports.onChallengeAccepted = onDocumentUpdated(
    'challenges/{challengeId}',
    async (event) => {
        if (!event.data) return null;
        const before = event.data.before.data();
        const after = event.data.after.data();

        // Only trigger when status changes to 'accepted'
        if (before.status === 'accepted' || after.status !== 'accepted') {
            return null;
        }

        // Notify the challenger
        await sendTieredNotification(after.challenger_id, {
            title: 'Challenge Accepted!',
            body: `${after.target_name} accepted your ${after.game_type || '501'} challenge!`,
            type: 'challenge',
            data: {
                challenge_id: event.params.challengeId,
                target_id: after.target_id,
                target_name: after.target_name,
                link: '/pages/messages.html'
            }
        });

        return null;
    }
);

// ========================================
// HTTP ENDPOINTS
// ========================================

/**
 * Manual notification endpoint (for admin/testing)
 */
exports.sendNotification = functions.https.onRequest(async (req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { player_id, title, body, type, data } = req.body;

        if (!player_id || !title) {
            return res.status(400).json({ error: 'player_id and title required' });
        }

        try {
            const result = await sendTieredNotification(player_id, {
                title,
                body: body || '',
                type: type || 'general',
                data: data || {}
            });

            res.json(result);
        } catch (error) {
            console.error('Send notification error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Broadcast notification to multiple players
 */
exports.broadcastNotification = functions.https.onRequest(async (req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { player_ids, title, body, type, data } = req.body;

        // Verify admin
        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!authPlayer.is_admin && !authPlayer.is_master_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!player_ids || !Array.isArray(player_ids) || !title) {
            return res.status(400).json({ error: 'player_ids array and title required' });
        }

        const results = { sent: 0, failed: 0, details: [] };

        for (const playerId of player_ids) {
            try {
                const result = await sendTieredNotification(playerId, {
                    title,
                    body: body || '',
                    type: type || 'general',
                    data: data || {}
                });

                if (result.success) {
                    results.sent++;
                } else {
                    results.failed++;
                }
                results.details.push({ player_id: playerId, ...result });
            } catch (error) {
                results.failed++;
                results.details.push({ player_id: playerId, success: false, error: error.message });
            }
        }

        res.json({ success: true, ...results });
    });
});

/**
 * Get notification stats
 */
exports.getNotificationStats = functions.https.onRequest(async (req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        try {
            // Count push-enabled players
            const pushEnabledSnap = await db.collection('players')
                .where('fcm_token', '!=', null)
                .get();

            // Count total players
            const totalPlayersSnap = await db.collection('players').get();

            // Get recent notification logs
            const recentLogs = await db.collection('notification_logs')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const methodCounts = { push: 0, sms: 0, email: 0 };
            recentLogs.forEach(doc => {
                const method = doc.data().method;
                if (method) methodCounts[method]++;
            });

            res.json({
                success: true,
                stats: {
                    total_players: totalPlayersSnap.size,
                    push_enabled: pushEnabledSnap.size,
                    push_coverage: Math.round((pushEnabledSnap.size / totalPlayersSnap.size) * 100) + '%',
                    recent_notifications: recentLogs.size,
                    method_breakdown: methodCounts
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Update player's FCM token
 */
exports.updateFCMToken = functions.https.onRequest(async (req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { fcm_token } = req.body;

        if (!fcm_token) {
            return res.status(400).json({ error: 'fcm_token required' });
        }

        try {
            const authPlayer = await verifyFirebaseAuth(req);
            if (!authPlayer) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const playerId = authPlayer.id;

            // Update player document
            await db.collection('players').doc(playerId).update({
                fcm_token: fcm_token,
                fcm_updated_at: admin.firestore.FieldValue.serverTimestamp(),
                notifications_enabled: true
            });

            // Also save to fcm_tokens collection
            await db.collection('fcm_tokens').doc(playerId).set({
                token: fcm_token,
                player_id: playerId,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true, player_id: playerId });
        } catch (error) {
            console.error('Update FCM token error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Update notification preferences
 */
exports.updateNotificationPreferences = functions.https.onRequest(async (req, res) => {
    const cors = require('cors')({ origin: true });

    cors(req, res, async () => {
        const { preferences } = req.body;

        try {
            const authPlayer = await verifyFirebaseAuth(req);
            if (!authPlayer) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const playerId = authPlayer.id;

            // Update preferences
            await db.collection('players').doc(playerId).update({
                notification_preferences: {
                    push: preferences.push !== false,
                    sms: preferences.sms !== false,
                    email: preferences.email !== false
                },
                notifications_enabled: preferences.enabled !== false
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Update preferences error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

// Export the core function for use in other modules
module.exports.sendTieredNotification = sendTieredNotification;
module.exports.sendPushNotification = sendPushNotification;
