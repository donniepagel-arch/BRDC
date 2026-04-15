const admin = require('firebase-admin');

/**
 * Verifies a Firebase ID token from the Authorization header and returns the player.
 * Replacement for verifyPlayerPin() across all cloud functions.
 * @param {import('express').Request} req
 * @returns {Promise<{id: string, [key: string]: any}|null>}
 */
async function verifyFirebaseAuth(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        const players = admin.firestore().collection('players');

        let snap = await players
            .where('firebase_uid', '==', decoded.uid)
            .limit(1)
            .get();

        if (snap.empty) {
            if (!decoded.email) return null;

            const email = String(decoded.email).trim().toLowerCase();
            snap = await players
                .where('email', '==', email)
                .limit(1)
                .get();

            if (snap.empty) return null;

            await snap.docs[0].ref.set({
                firebase_uid: decoded.uid
            }, { merge: true });
        }

        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (err) {
        console.error('[verifyFirebaseAuth] Token verification failed:', err.message);
        return null;
    }
}

module.exports = { verifyFirebaseAuth };
