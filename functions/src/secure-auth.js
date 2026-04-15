/**
 * Secure Authentication Functions for BRDC
 * Handles session token generation, validation, and secure PIN authentication
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Session token expiration (7 days)
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically secure session token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Enhanced Player Login with Secure Session Tokens
 * Replaces the old playerLogin function
 */
exports.securePlayerLogin = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { pin } = req.body;

        if (!pin || typeof pin !== 'string' || pin.length !== 8 || !/^\d+$/.test(pin)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format. Must be 8 digits.'
            });
        }

        // Query Firestore for player with this PIN
        const db = admin.firestore();
        const playersRef = db.collection('players');
        const snapshot = await playersRef.where('pin', '==', pin).limit(1).get();

        if (snapshot.empty) {
            return res.status(401).json({
                success: false,
                error: 'Invalid PIN. Please try again.'
            });
        }

        const playerDoc = snapshot.docs[0];
        const playerData = playerDoc.data();

        // Generate secure session token
        const sessionToken = generateSessionToken();
        const expiresAt = Date.now() + SESSION_EXPIRY;

        // Store session in Firestore
        await db.collection('sessions').doc(sessionToken).set({
            player_id: playerDoc.id,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            expires_at: new Date(expiresAt),
            ip_address: req.ip,
            user_agent: req.get('user-agent') || 'unknown'
        });

        // Return session data (NO PIN!)
        return res.status(200).json({
            success: true,
            session_token: sessionToken,
            player: {
                id: playerDoc.id,
                name: playerData.name || `${playerData.first_name} ${playerData.last_name}`,
                first_name: playerData.first_name,
                last_name: playerData.last_name,
                email: playerData.email,
                phone: playerData.phone
                // PIN is NEVER sent to client
            }
        });

    } catch (error) {
        console.error('Secure login error:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error. Please try again.'
        });
    }
});

/**
 * Validate Session Token
 * Checks if a session token is valid and not expired
 */
exports.validateSession = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ valid: false, error: 'Method not allowed' });
    }

    try {
        const sessionToken = req.get('X-Session-Token');

        if (!sessionToken) {
            return res.status(401).json({ valid: false, error: 'No session token provided' });
        }

        const db = admin.firestore();
        const sessionDoc = await db.collection('sessions').doc(sessionToken).get();

        if (!sessionDoc.exists) {
            return res.status(401).json({ valid: false, error: 'Invalid session' });
        }

        const sessionData = sessionDoc.data();
        const now = Date.now();
        const expiresAt = sessionData.expires_at.toMillis();

        if (now > expiresAt) {
            // Session expired - delete it
            await sessionDoc.ref.delete();
            return res.status(401).json({ valid: false, error: 'Session expired' });
        }

        // Session is valid
        return res.status(200).json({
            valid: true,
            player_id: sessionData.player_id
        });

    } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({ valid: false, error: 'Server error' });
    }
});

/**
 * Logout - Invalidate Session Token
 */
exports.secureLogout = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false });
    }

    try {
        const sessionToken = req.get('X-Session-Token');

        if (sessionToken) {
            const db = admin.firestore();
            await db.collection('sessions').doc(sessionToken).delete();
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(200).json({ success: true }); // Always succeed for logout
    }
});

/**
 * Cleanup Expired Sessions (Scheduled Function)
 * Runs daily to remove expired session tokens
 */
exports.cleanupExpiredSessions = functions.pubsub.schedule('every 24 hours').onRun(async () => {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();

        const expiredSessions = await db.collection('sessions')
            .where('expires_at', '<', now)
            .get();

        const batch = db.batch();
        expiredSessions.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log(`Cleaned up ${expiredSessions.size} expired sessions`);
        return null;
    });
