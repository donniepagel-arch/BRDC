/**
 * BRDC Notification API
 * HTTP endpoints for notification management
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

/**
 * Get unread notification count for a player
 */
exports.getUnreadNotificationCount = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const unreadSnap = await notificationsRef
                .where('read', '==', false)
                .count()
                .get();

            res.json({
                success: true,
                count: unreadSnap.data().count || 0
            });
        } catch (error) {
            console.error('Get unread notification count error:', error);
            res.json({ success: true, count: 0 });
        }
    });
});

/**
 * Get notifications for a player
 */
exports.getNotifications = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id, limit: queryLimit } = req.body;
        const playerId = player_id || player_pin;
        const limitNum = parseInt(queryLimit) || 20;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const notifSnap = await notificationsRef
                .orderBy('created_at', 'desc')
                .limit(limitNum)
                .get();

            const notifications = [];
            notifSnap.forEach(doc => {
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            res.json({
                success: true,
                notifications
            });
        } catch (error) {
            console.error('Get notifications error:', error);
            res.json({ success: true, notifications: [] });
        }
    });
});

/**
 * Mark a notification as read
 */
exports.markNotificationRead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { notification_id, player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!notification_id || !playerId) {
            return res.status(400).json({ error: 'Notification ID and player ID required' });
        }

        try {
            await db.collection('players').doc(playerId)
                .collection('notifications').doc(notification_id)
                .update({ read: true, read_at: admin.firestore.FieldValue.serverTimestamp() });

            res.json({ success: true });
        } catch (error) {
            console.error('Mark notification read error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

/**
 * Mark all notifications as read for a player
 */
exports.markAllNotificationsRead = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { player_pin, player_id } = req.body;
        const playerId = player_id || player_pin;

        if (!playerId) {
            return res.status(400).json({ error: 'Player ID required' });
        }

        try {
            const notificationsRef = db.collection('players').doc(playerId).collection('notifications');
            const unreadSnap = await notificationsRef.where('read', '==', false).get();

            const batch = db.batch();
            unreadSnap.forEach(doc => {
                batch.update(doc.ref, {
                    read: true,
                    read_at: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();

            res.json({ success: true, marked_count: unreadSnap.size });
        } catch (error) {
            console.error('Mark all notifications read error:', error);
            res.status(500).json({ error: error.message });
        }
    });
});
