/**
 * Admin Functions
 * Secure admin operations with PIN authentication
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Admin PIN from environment variable (set in .env file)
const ADMIN_PIN = process.env.ADMIN_PIN || functions.config().admin?.pin;

/**
 * Verify admin PIN
 */
function verifyAdminPin(pin) {
    if (!ADMIN_PIN) {
        console.error('ADMIN_PIN not configured in environment');
        return false;
    }
    // Normalize PIN (remove dashes)
    const normalizedPin = pin ? pin.replace(/-/g, '') : '';
    return normalizedPin === ADMIN_PIN;
}

/**
 * Admin login - verify PIN and return admin token
 */
exports.adminLogin = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        // Generate session token
        const sessionToken = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Store session
        await admin.firestore().collection('admin_sessions').doc(sessionToken).set({
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            expires_at: expiresAt,
            active: true
        });

        res.json({
            success: true,
            token: sessionToken,
            expires_at: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Verify admin session token
 */
async function verifyAdminSession(token) {
    if (!token) return false;

    try {
        const sessionDoc = await admin.firestore().collection('admin_sessions').doc(token).get();
        if (!sessionDoc.exists) return false;

        const session = sessionDoc.data();
        if (!session.active) return false;
        if (session.expires_at.toDate() < new Date()) return false;

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Clear all data except bots
 */
exports.adminClearData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, confirm } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (confirm !== 'DELETE_ALL_DATA') {
            return res.status(400).json({ success: false, error: 'Confirmation required. Send confirm: "DELETE_ALL_DATA"' });
        }

        const db = admin.firestore();
        const batch = db.batch();
        let deleteCount = 0;

        // Delete all leagues and subcollections
        const leaguesSnap = await db.collection('leagues').get();
        for (const leagueDoc of leaguesSnap.docs) {
            // Delete subcollections
            const subcollections = ['registrations', 'teams', 'matches', 'fillins', 'fillin_requests'];
            for (const subName of subcollections) {
                const subSnap = await db.collection('leagues').doc(leagueDoc.id).collection(subName).get();
                for (const subDoc of subSnap.docs) {
                    await subDoc.ref.delete();
                    deleteCount++;
                }
            }
            await leagueDoc.ref.delete();
            deleteCount++;
        }

        // Delete all tournaments and subcollections
        const tournamentsSnap = await db.collection('tournaments').get();
        for (const tournamentDoc of tournamentsSnap.docs) {
            const subcollections = ['events', 'registrations', 'matches', 'brackets'];
            for (const subName of subcollections) {
                const subSnap = await db.collection('tournaments').doc(tournamentDoc.id).collection(subName).get();
                for (const subDoc of subSnap.docs) {
                    await subDoc.ref.delete();
                    deleteCount++;
                }
            }
            await tournamentDoc.ref.delete();
            deleteCount++;
        }

        // Delete players (except bots)
        const playersSnap = await db.collection('players').get();
        for (const playerDoc of playersSnap.docs) {
            const player = playerDoc.data();
            if (!player.isBot) {
                await playerDoc.ref.delete();
                deleteCount++;
            }
        }

        // Delete notifications
        const notificationsSnap = await db.collection('notifications').get();
        for (const notifDoc of notificationsSnap.docs) {
            await notifDoc.ref.delete();
            deleteCount++;
        }

        res.json({
            success: true,
            message: `Cleared ${deleteCount} documents. Bots preserved.`
        });

    } catch (error) {
        console.error('Admin clear data error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a specific league
 */
exports.adminDeleteLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, league_id } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        const db = admin.firestore();
        const leagueRef = db.collection('leagues').doc(league_id);

        // Check if exists
        const leagueDoc = await leagueRef.get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        // Delete subcollections
        const subcollections = ['registrations', 'teams', 'matches', 'fillins', 'fillin_requests'];
        for (const subName of subcollections) {
            const subSnap = await leagueRef.collection(subName).get();
            for (const subDoc of subSnap.docs) {
                await subDoc.ref.delete();
            }
        }

        // Delete league document
        await leagueRef.delete();

        res.json({ success: true, message: 'League deleted' });

    } catch (error) {
        console.error('Admin delete league error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a specific tournament
 */
exports.adminDeleteTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, tournament_id } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'tournament_id required' });
        }

        const db = admin.firestore();
        const tournamentRef = db.collection('tournaments').doc(tournament_id);

        // Check if exists
        const tournamentDoc = await tournamentRef.get();
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Delete subcollections
        const subcollections = ['events', 'registrations', 'matches', 'brackets'];
        for (const subName of subcollections) {
            const subSnap = await tournamentRef.collection(subName).get();
            for (const subDoc of subSnap.docs) {
                await subDoc.ref.delete();
            }
        }

        // Delete tournament document
        await tournamentRef.delete();

        res.json({ success: true, message: 'Tournament deleted' });

    } catch (error) {
        console.error('Admin delete tournament error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a specific player
 */
exports.adminDeletePlayer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, player_id } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        const db = admin.firestore();
        const playerRef = db.collection('players').doc(player_id);

        const playerDoc = await playerRef.get();
        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const player = playerDoc.data();
        if (player.isBot) {
            return res.status(400).json({ success: false, error: 'Cannot delete bot players through this function' });
        }

        await playerRef.delete();

        res.json({ success: true, message: 'Player deleted' });

    } catch (error) {
        console.error('Admin delete player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get admin dashboard data
 */
exports.adminGetDashboard = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        const db = admin.firestore();

        // Get counts
        const [leaguesSnap, tournamentsSnap, playersSnap, botsSnap] = await Promise.all([
            db.collection('leagues').get(),
            db.collection('tournaments').get(),
            db.collection('players').where('isBot', '!=', true).get(),
            db.collection('players').where('isBot', '==', true).get()
        ]);

        // Get league details (with director info and PINs)
        const leagues = leaguesSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.league_name || data.name,
                status: data.status,
                type: data.league_type,
                director_name: data.director_name || data.manager_email || 'Unknown',
                admin_pin: data.admin_pin,
                director_pin: data.director_pin,
                director_player_id: data.director_player_id,
                venue_name: data.venue_name,
                created_at: data.created_at
            };
        });

        // Get tournament details (with director info and PINs)
        const tournaments = tournamentsSnap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.tournament_name || data.name,
                status: data.status,
                date: data.tournament_date || data.date,
                director_name: data.director_name || data.director_email || 'Unknown',
                director_pin: data.director_pin,
                director_player_pin: data.director_player_pin,
                venue_name: data.venue_name,
                created_at: data.created_at
            };
        });

        res.json({
            success: true,
            counts: {
                leagues: leaguesSnap.size,
                tournaments: tournamentsSnap.size,
                players: playersSnap.size,
                bots: botsSnap.size
            },
            leagues,
            tournaments
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register admin user with specific PIN
 * Creates the admin player profile linked to the admin PIN
 */
exports.adminRegisterSelf = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, name, email, phone } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!name || !email || !phone) {
            return res.status(400).json({ success: false, error: 'name, email, and phone required' });
        }

        const db = admin.firestore();
        const emailLower = email.toLowerCase().trim();
        const phoneClean = phone.replace(/\D/g, '');
        const phoneLast4 = phoneClean.slice(-4);

        // Check if admin player already exists
        const existingPlayer = await db.collection('players')
            .where('pin', '==', ADMIN_PIN)
            .limit(1)
            .get();

        if (!existingPlayer.empty) {
            // Update existing
            const playerDoc = existingPlayer.docs[0];
            await playerDoc.ref.update({
                name: name.trim(),
                email: emailLower,
                phone: phoneClean,
                phone_last4: phoneLast4,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            return res.json({
                success: true,
                player_id: playerDoc.id,
                message: 'Admin profile updated',
                pin: ADMIN_PIN
            });
        }

        // Create admin player
        const playerData = {
            name: name.trim(),
            email: emailLower,
            phone: phoneClean,
            phone_last4: phoneLast4,
            zip: null,
            pin: ADMIN_PIN,
            chosen_pin: '2911',
            isBot: false,
            isAdmin: true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
            },
            involvements: {
                leagues: [],
                tournaments: [],
                directing: [],
                captaining: []
            }
        };

        const playerRef = await db.collection('players').add(playerData);

        res.json({
            success: true,
            player_id: playerRef.id,
            pin: ADMIN_PIN,
            message: `Admin player "${name}" created with PIN ${ADMIN_PIN}`
        });

    } catch (error) {
        console.error('Admin register self error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league (admin only)
 */
exports.adminUpdateLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, league_id, updates } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        const db = admin.firestore();
        const leagueRef = db.collection('leagues').doc(league_id);

        const leagueDoc = await leagueRef.get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        // Only allow updating certain fields
        const allowedFields = ['director_pin', 'director_player_id', 'director_name', 'admin_pin', 'status'];
        const safeUpdates = {};
        for (const key of Object.keys(updates || {})) {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        }

        if (Object.keys(safeUpdates).length > 0) {
            safeUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();
            await leagueRef.update(safeUpdates);
        }

        res.json({ success: true, message: 'League updated' });

    } catch (error) {
        console.error('Admin update league error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update tournament (admin only)
 */
exports.adminUpdateTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, tournament_id, updates } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'tournament_id required' });
        }

        const db = admin.firestore();
        const tournamentRef = db.collection('tournaments').doc(tournament_id);

        const tournamentDoc = await tournamentRef.get();
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Only allow updating certain fields
        const allowedFields = ['director_pin', 'director_player_pin', 'director_name', 'status'];
        const safeUpdates = {};
        for (const key of Object.keys(updates || {})) {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        }

        if (Object.keys(safeUpdates).length > 0) {
            safeUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();
            await tournamentRef.update(safeUpdates);
        }

        res.json({ success: true, message: 'Tournament updated' });

    } catch (error) {
        console.error('Admin update tournament error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = exports;
