/**
 * BRDC Notification API
 * HTTP endpoints for notification management
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const { verifyFirebaseAuth } = require('./src/firebase-auth-helper');

const db = admin.firestore();

/**
 * Get unread notification count for a player
 */
exports.getUnreadNotificationCount = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const playerId = authPlayer.id;

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

        const { limit: queryLimit } = req.body;
        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const playerId = authPlayer.id;
        const limitNum = parseInt(queryLimit) || 20;

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

        const { notification_id } = req.body;
        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const playerId = authPlayer.id;

        if (!notification_id) {
            return res.status(400).json({ error: 'Notification ID required' });
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

        const authPlayer = await verifyFirebaseAuth(req);
        if (!authPlayer) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const playerId = authPlayer.id;

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
