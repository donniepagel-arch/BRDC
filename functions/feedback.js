/**
 * Feedback/Debug Report Module
 * Allows users to submit feedback from any page
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Save feedback/debug report
 */
exports.submitFeedback = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            page,           // Which page the feedback is from
            message,        // The feedback text
            user_agent,     // Browser info
            screen_size,    // Screen dimensions
            url,            // Full URL
            player_id       // Optional: logged in player ID
        } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const feedbackRef = await db.collection('feedback').add({
            page: page || 'unknown',
            message: message.trim(),
            user_agent: user_agent || null,
            screen_size: screen_size || null,
            url: url || null,
            player_id: player_id || null,
            status: 'new',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            feedback_id: feedbackRef.id,
            message: 'Feedback submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all feedback (for admin review)
 */
exports.getFeedback = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const status = req.query.status || 'new';
        const limit = parseInt(req.query.limit) || 50;

        let query = db.collection('feedback')
            .orderBy('created_at', 'desc')
            .limit(limit);

        if (status !== 'all') {
            query = query.where('status', '==', status);
        }

        const feedbackSnap = await query.get();

        const feedback = [];
        feedbackSnap.forEach(doc => {
            const data = doc.data();
            feedback.push({
                id: doc.id,
                ...data,
                created_at: data.created_at?.toDate?.() || null
            });
        });

        res.json({
            success: true,
            feedback,
            count: feedback.length
        });

    } catch (error) {
        console.error('Error getting feedback:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update feedback status (mark as reviewed, fixed, etc.)
 */
exports.updateFeedbackStatus = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { feedback_id, status, notes } = req.body;

        if (!feedback_id || !status) {
            return res.status(400).json({ error: 'Missing feedback_id or status' });
        }

        const validStatuses = ['new', 'reviewed', 'in_progress', 'fixed', 'wont_fix'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await db.collection('feedback').doc(feedback_id).update({
            status,
            notes: notes || null,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Feedback status updated'
        });

    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ error: error.message });
    }
});
