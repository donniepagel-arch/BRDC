/**
 * Admin Functions
 * Secure admin operations with PIN authentication
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Admin PIN from environment variable (set in .env file)
const ADMIN_PIN = process.env.ADMIN_PIN;

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
 * Get all players (for admin management)
 */
exports.adminGetPlayers = functions.https.onRequest(async (req, res) => {
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
        // Get all players and filter bots in code to avoid composite index requirement
        const playersSnap = await db.collection('players')
            .orderBy('created_at', 'desc')
            .limit(1000)
            .get();

        const players = [];
        playersSnap.forEach(doc => {
            const data = doc.data();
            // Skip bots
            if (data.isBot === true) return;
            players.push({
                id: doc.id,
                name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                email: data.email,
                phone: data.phone,
                pin: data.pin,
                games_played: data.games_played || 0,
                created_at: data.created_at
            });
        });

        res.json({ success: true, players });

    } catch (error) {
        console.error('Admin get players error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update a specific player (admin only)
 */
exports.adminUpdatePlayer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, player_id, updates } = req.body;

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

        // Build update object with allowed fields
        const updateData = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (updates.name) updateData.name = updates.name.trim();
        if (updates.email !== undefined) updateData.email = updates.email.trim();
        if (updates.phone !== undefined) updateData.phone = updates.phone.trim();
        if (updates.player_pin) updateData.pin = updates.player_pin.trim();

        await playerRef.update(updateData);

        res.json({ success: true, message: 'Player updated' });

    } catch (error) {
        console.error('Admin update player error:', error);
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
 * Fix a player's PIN to be phone-based and notify them via SMS
 */
exports.adminFixPlayerPin = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, player_name, send_sms } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!player_name) {
            return res.status(400).json({ success: false, error: 'player_name required' });
        }

        const db = admin.firestore();

        // Find player by name (case-insensitive search)
        const playersSnap = await db.collection('players').get();
        let playerDoc = null;
        let playerData = null;

        for (const doc of playersSnap.docs) {
            const data = doc.data();
            const fullName = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
            if (fullName.toLowerCase().includes(player_name.toLowerCase())) {
                playerDoc = doc;
                playerData = data;
                break;
            }
        }

        if (!playerDoc) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Get phone number
        const phone = playerData.phone;
        if (!phone) {
            return res.status(400).json({ success: false, error: 'Player has no phone number' });
        }

        // Generate new PIN: last 4 of phone + 4 random digits
        const cleanPhone = phone.replace(/\D/g, '');
        const phoneLast4 = cleanPhone.slice(-4);
        const randomPart = String(Math.floor(1000 + Math.random() * 9000));
        const newPin = phoneLast4 + randomPart;

        // Check PIN is unique
        const existingPlayer = await db.collection('players').where('pin', '==', newPin).limit(1).get();
        const existingBot = await db.collection('bots').where('pin', '==', newPin).limit(1).get();

        if (!existingPlayer.empty || !existingBot.empty) {
            // Try again with different random
            const randomPart2 = String(Math.floor(1000 + Math.random() * 9000));
            const newPin2 = phoneLast4 + randomPart2;
            await playerDoc.ref.update({ pin: newPin2, pin_updated_at: admin.firestore.FieldValue.serverTimestamp() });

            // Send SMS if requested
            if (send_sms !== false) {
                await sendPinUpdateSMS(phone, playerData.name || playerData.first_name, newPin2);
            }

            return res.json({
                success: true,
                player_id: playerDoc.id,
                player_name: playerData.name || `${playerData.first_name} ${playerData.last_name}`,
                old_pin: playerData.pin,
                new_pin: newPin2,
                sms_sent: send_sms !== false
            });
        }

        // Update PIN
        await playerDoc.ref.update({ pin: newPin, pin_updated_at: admin.firestore.FieldValue.serverTimestamp() });

        // Send SMS if requested
        if (send_sms !== false) {
            await sendPinUpdateSMS(phone, playerData.name || playerData.first_name, newPin);
        }

        res.json({
            success: true,
            player_id: playerDoc.id,
            player_name: playerData.name || `${playerData.first_name} ${playerData.last_name}`,
            old_pin: playerData.pin,
            new_pin: newPin,
            sms_sent: send_sms !== false
        });

    } catch (error) {
        console.error('Admin fix player PIN error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper function to send PIN update SMS
async function sendPinUpdateSMS(phone, name, newPin) {
    const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

    if (!TWILIO_SID || !TWILIO_TOKEN) {
        console.log('PIN update SMS (simulated):', { phone, name, newPin });
        return { success: true, simulated: true };
    }

    try {
        const twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
        const message = `BRDC: Hey ${name}! Your player PIN has been updated to ${newPin}. Use this PIN to log in and track your stats. See you at the boards!`;
        const result = await twilioClient.messages.create({
            body: message,
            to: phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, ''),
            from: TWILIO_PHONE
        });
        console.log('PIN update SMS sent:', result.sid);
        return { success: true, sid: result.sid };
    } catch (err) {
        console.error('PIN update SMS error:', err);
        return { success: false, error: err.message };
    }
}

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

        // Get counts - get all players and filter in code to avoid index requirement
        const [leaguesSnap, tournamentsSnap, allPlayersSnap] = await Promise.all([
            db.collection('leagues').get(),
            db.collection('tournaments').get(),
            db.collection('players').get()
        ]);

        // Separate bots from players
        let playerCount = 0;
        let botCount = 0;
        allPlayersSnap.forEach(doc => {
            if (doc.data().isBot === true) {
                botCount++;
            } else {
                playerCount++;
            }
        });

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
                players: playerCount,
                bots: botCount
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

/**
 * Get all members with their permissions
 */
exports.adminGetMembers = functions.https.onRequest(async (req, res) => {
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
        // Get all players and filter bots in code
        const playersSnap = await db.collection('players').get();

        const members = playersSnap.docs
            .filter(d => d.data().isBot !== true)
            .map(d => {
            const data = d.data();
            // Default permissions for non-admin players
            const defaultPerms = {
                can_create_leagues: false,
                can_create_tournaments: true,
                max_tournament_players: 8,
                max_tournament_events: 2
            };
            return {
                id: d.id,
                name: data.name || 'Unknown',
                email: data.email || '',
                phone: data.phone || '',
                pin: data.pin,
                isAdmin: data.isAdmin || false,
                created_at: data.created_at,
                permissions: data.isAdmin ? {
                    can_create_leagues: true,
                    can_create_tournaments: true,
                    max_tournament_players: 999,
                    max_tournament_events: 99
                } : (data.permissions || defaultPerms)
            };
        });

        res.json({ success: true, members });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update member permissions (admin only)
 */
exports.adminUpdateMemberPermissions = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, player_id, permissions } = req.body;

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

        // Validate and sanitize permissions
        const validatedPermissions = {
            can_create_leagues: Boolean(permissions?.can_create_leagues),
            can_create_tournaments: permissions?.can_create_tournaments !== false,
            max_tournament_players: Math.max(1, Math.min(999, parseInt(permissions?.max_tournament_players) || 8)),
            max_tournament_events: Math.max(1, Math.min(99, parseInt(permissions?.max_tournament_events) || 2))
        };

        await playerRef.update({
            permissions: validatedPermissions,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Permissions updated', permissions: validatedPermissions });

    } catch (error) {
        console.error('Update permissions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get member permissions by PIN (used by frontend to check limits)
 */
exports.getMemberPermissions = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_pin } = req.body;

        if (!player_pin) {
            return res.status(400).json({ success: false, error: 'player_pin required' });
        }

        const db = admin.firestore();

        // Normalize PIN
        const normalizedPin = player_pin.replace(/-/g, '');

        // Check if admin
        if (normalizedPin === ADMIN_PIN) {
            return res.json({
                success: true,
                isAdmin: true,
                permissions: {
                    can_create_leagues: true,
                    can_create_tournaments: true,
                    max_tournament_players: 999,
                    max_tournament_events: 99
                }
            });
        }

        // Find player by PIN
        const playerSnap = await db.collection('players')
            .where('pin', '==', normalizedPin)
            .limit(1)
            .get();

        if (playerSnap.empty) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const player = playerSnap.docs[0].data();

        // Default permissions
        const defaultPerms = {
            can_create_leagues: false,
            can_create_tournaments: true,
            max_tournament_players: 8,
            max_tournament_events: 2
        };

        res.json({
            success: true,
            isAdmin: player.isAdmin || false,
            permissions: player.isAdmin ? {
                can_create_leagues: true,
                can_create_tournaments: true,
                max_tournament_players: 999,
                max_tournament_events: 99
            } : (player.permissions || defaultPerms)
        });

    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all feedback/bug reports (admin only)
 */
exports.adminGetFeedback = functions.https.onRequest(async (req, res) => {
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
        const feedbackSnap = await db.collection('feedback')
            .orderBy('created_at', 'desc')
            .limit(500)
            .get();

        const feedback = feedbackSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ success: true, feedback });

    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update feedback status (admin only)
 */
exports.adminUpdateFeedback = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, feedback_id, status } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!feedback_id) {
            return res.status(400).json({ success: false, error: 'feedback_id required' });
        }

        const validStatuses = ['new', 'reviewed', 'resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const db = admin.firestore();
        await db.collection('feedback').doc(feedback_id).update({
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Feedback updated' });

    } catch (error) {
        console.error('Update feedback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add feedback manually (admin only)
 */
exports.adminAddFeedback = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, page, message } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!message) {
            return res.status(400).json({ success: false, error: 'message required' });
        }

        const db = admin.firestore();
        const feedbackRef = await db.collection('feedback').add({
            page: page || 'admin-added',
            message: message,
            status: 'new',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_admin: true
        });

        res.json({ success: true, id: feedbackRef.id });

    } catch (error) {
        console.error('Add feedback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete feedback (admin only)
 */
exports.adminDeleteFeedback = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, feedback_id } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!feedback_id) {
            return res.status(400).json({ success: false, error: 'feedback_id required' });
        }

        const db = admin.firestore();
        await db.collection('feedback').doc(feedback_id).delete();

        res.json({ success: true, message: 'Feedback deleted' });

    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reset a league - clears all matches, teams, players, stats, schedule
 * Keeps the league document but resets it to initial state
 */
exports.adminResetLeague = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, league_id, league_name } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        const db = admin.firestore();
        let leagueRef;
        let leagueDoc;

        // Find league by ID or name (case-insensitive partial match)
        if (league_id) {
            leagueRef = db.collection('leagues').doc(league_id);
            leagueDoc = await leagueRef.get();
        } else if (league_name) {
            // First try exact match
            let snapshot = await db.collection('leagues')
                .where('name', '==', league_name)
                .limit(1)
                .get();

            // If not found, search all leagues for partial/case-insensitive match
            if (snapshot.empty) {
                const allLeagues = await db.collection('leagues').get();
                const searchName = league_name.toLowerCase();
                for (const doc of allLeagues.docs) {
                    const name = (doc.data().name || '').toLowerCase();
                    if (name.includes(searchName) || searchName.includes(name)) {
                        leagueDoc = doc;
                        leagueRef = doc.ref;
                        break;
                    }
                }
            } else {
                leagueDoc = snapshot.docs[0];
                leagueRef = leagueDoc.ref;
            }
        }

        if (!leagueDoc || !leagueDoc.exists) {
            // List available leagues to help user
            const allLeagues = await db.collection('leagues').get();
            const names = allLeagues.docs.map(d => d.data().name).filter(Boolean);
            return res.status(404).json({
                success: false,
                error: 'League not found',
                available_leagues: names
            });
        }

        const leagueData = leagueDoc.data();
        const leagueId = leagueDoc.id;

        // Delete all subcollections
        const subcollections = ['teams', 'players', 'matches', 'stats', 'schedule'];
        let totalDeleted = 0;

        for (const subcol of subcollections) {
            const snapshot = await leagueRef.collection(subcol).get();
            const batch = db.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                // For matches, also delete nested games subcollection
                if (subcol === 'matches') {
                    const gamesSnapshot = await doc.ref.collection('games').get();
                    for (const gameDoc of gamesSnapshot.docs) {
                        batch.delete(gameDoc.ref);
                        count++;
                    }
                }
                batch.delete(doc.ref);
                count++;
            }

            if (count > 0) {
                await batch.commit();
                totalDeleted += count;
            }
        }

        // Reset league document to initial state
        await leagueRef.update({
            current_week: 0,
            schedule_generated: false,
            schedule_weeks: 0,
            total_matches: 0,
            completed_matches: 0,
            status: 'setup',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: `League "${leagueData.name}" has been reset`,
            league_id: leagueId,
            documents_deleted: totalDeleted
        });

    } catch (error) {
        console.error('Reset league error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a bot from a player's stats
 * Copies the player's skill profile to create a matching bot
 */
exports.adminCreateBotFromPlayer = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, player_id, league_id, bot_name } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        const db = admin.firestore();

        // Get player's league stats (most detailed) or global stats
        let playerStats = null;
        let playerName = bot_name;

        if (league_id) {
            // Get stats from specific league
            const statsDoc = await db.collection('leagues').doc(league_id)
                .collection('stats').doc(player_id).get();
            if (statsDoc.exists) {
                playerStats = statsDoc.data();
                playerName = playerName || playerStats.player_name;
            }
        }

        // If no league stats, try to get from player's global profile
        if (!playerStats) {
            const playerDoc = await db.collection('players').doc(player_id).get();
            if (playerDoc.exists) {
                const player = playerDoc.data();
                playerStats = player.stats || {};
                playerName = playerName || player.name;
            }
        }

        if (!playerStats) {
            return res.status(404).json({ success: false, error: 'Player stats not found' });
        }

        // Calculate X01 skills from player stats
        const x01Skills = {
            x01_three_dart_avg: 55, // default
            pct_100_plus: 25,
            pct_140_plus: 8,
            pct_171_plus: 1,
            checkout_pct_low: 45,
            checkout_pct_81: 30,
            checkout_pct_101: 18,
            checkout_pct_141: 8,
            double_in_success_pct: 20
        };

        // Calculate 3-dart average
        if (playerStats.x01_total_darts > 0 && playerStats.x01_total_points > 0) {
            x01Skills.x01_three_dart_avg = Math.round(playerStats.x01_total_points / playerStats.x01_total_darts * 3);
        }

        // Calculate ton percentages (turns based - estimate from leg data)
        const totalTurns = playerStats.x01_total_darts ? Math.floor(playerStats.x01_total_darts / 3) : 0;
        if (totalTurns > 0) {
            x01Skills.pct_100_plus = Math.round((playerStats.x01_tons || 0) / totalTurns * 100);
            const ton40plus = (playerStats.x01_ton_40 || 0) + (playerStats.x01_ton_60 || 0) + (playerStats.x01_ton_80 || 0);
            x01Skills.pct_140_plus = Math.round(ton40plus / totalTurns * 100);
            x01Skills.pct_171_plus = Math.round((playerStats.x01_ton_80 || 0) / totalTurns * 100);
        }

        // Calculate tiered checkout percentages
        if (playerStats.x01_checkout_attempts_low > 0) {
            x01Skills.checkout_pct_low = Math.round(
                (playerStats.x01_checkout_successes_low || 0) / playerStats.x01_checkout_attempts_low * 100
            );
        }
        if (playerStats.x01_checkout_attempts_81 > 0) {
            x01Skills.checkout_pct_81 = Math.round(
                (playerStats.x01_checkout_successes_81 || 0) / playerStats.x01_checkout_attempts_81 * 100
            );
        }
        if (playerStats.x01_checkout_attempts_101 > 0) {
            x01Skills.checkout_pct_101 = Math.round(
                (playerStats.x01_checkout_successes_101 || 0) / playerStats.x01_checkout_attempts_101 * 100
            );
        }
        if (playerStats.x01_checkout_attempts_141 > 0) {
            x01Skills.checkout_pct_141 = Math.round(
                (playerStats.x01_checkout_successes_141 || 0) / playerStats.x01_checkout_attempts_141 * 100
            );
        }

        // Fallback: if no tiered data, use overall checkout %
        if (!playerStats.x01_checkout_attempts_low && playerStats.x01_checkout_attempts > 0) {
            const overallPct = Math.round((playerStats.x01_checkouts_hit || 0) / playerStats.x01_checkout_attempts * 100);
            // Estimate tiers based on overall (higher scores are harder)
            x01Skills.checkout_pct_low = Math.min(90, overallPct + 15);
            x01Skills.checkout_pct_81 = overallPct;
            x01Skills.checkout_pct_101 = Math.max(5, overallPct - 12);
            x01Skills.checkout_pct_141 = Math.max(2, overallPct - 25);
        }

        // Calculate Cricket skills from player stats
        const cricketSkills = {
            miss_pct: 25,
            triple_bull_pct: 15,
            pct_5_mark_plus: 20,
            pct_7_mark_plus: 8,
            pct_9_mark_plus: 2
        };

        if (playerStats.cricket_total_darts > 0) {
            cricketSkills.miss_pct = Math.round(
                (playerStats.cricket_missed_darts || 0) / playerStats.cricket_total_darts * 100
            );
            cricketSkills.triple_bull_pct = Math.round(
                (playerStats.cricket_triple_bull_darts || 0) / playerStats.cricket_total_darts * 100
            );
        }

        if (playerStats.cricket_total_rounds > 0) {
            cricketSkills.pct_5_mark_plus = Math.round(
                (playerStats.cricket_five_mark_rounds || 0) / playerStats.cricket_total_rounds * 100
            );
            cricketSkills.pct_7_mark_plus = Math.round(
                (playerStats.cricket_seven_mark_rounds || 0) / playerStats.cricket_total_rounds * 100
            );
            cricketSkills.pct_9_mark_plus = Math.round(
                (playerStats.cricket_nine_mark_rounds || 0) / playerStats.cricket_total_rounds * 100
            );
        }

        // Clamp all values to valid ranges
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        x01Skills.x01_three_dart_avg = clamp(x01Skills.x01_three_dart_avg, 20, 120);
        x01Skills.pct_100_plus = clamp(x01Skills.pct_100_plus, 0, 100);
        x01Skills.pct_140_plus = clamp(x01Skills.pct_140_plus, 0, 100);
        x01Skills.pct_171_plus = clamp(x01Skills.pct_171_plus, 0, 100);
        x01Skills.checkout_pct_low = clamp(x01Skills.checkout_pct_low, 0, 100);
        x01Skills.checkout_pct_81 = clamp(x01Skills.checkout_pct_81, 0, 100);
        x01Skills.checkout_pct_101 = clamp(x01Skills.checkout_pct_101, 0, 100);
        x01Skills.checkout_pct_141 = clamp(x01Skills.checkout_pct_141, 0, 100);
        cricketSkills.miss_pct = clamp(cricketSkills.miss_pct, 0, 100);
        cricketSkills.triple_bull_pct = clamp(cricketSkills.triple_bull_pct, 0, 100);
        cricketSkills.pct_5_mark_plus = clamp(cricketSkills.pct_5_mark_plus, 0, 100);
        cricketSkills.pct_7_mark_plus = clamp(cricketSkills.pct_7_mark_plus, 0, 100);
        cricketSkills.pct_9_mark_plus = clamp(cricketSkills.pct_9_mark_plus, 0, 100);

        // Generate bot PIN (0000 + 4 random digits)
        const randomPart = String(Math.floor(1000 + Math.random() * 9000));
        const botPin = '0000' + randomPart;

        // Check PIN uniqueness
        const existingBot = await db.collection('bots').where('pin', '==', botPin).limit(1).get();
        if (!existingBot.empty) {
            // Try again with different random
            const randomPart2 = String(Math.floor(1000 + Math.random() * 9000));
            const botPin2 = '0000' + randomPart2;
        }

        // Create the bot
        const finalBotName = playerName ? `Bot ${playerName}` : `Bot ${player_id.slice(0, 6)}`;
        const botData = {
            name: bot_name || finalBotName,
            pin: botPin,
            isBot: true,
            cloned_from_player: player_id,
            cloned_from_league: league_id || null,
            x01_skills: x01Skills,
            cricket_skills: cricketSkills,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            game_stats: {
                x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 },
                matches_played: 0,
                matches_won: 0
            }
        };

        const botRef = await db.collection('bots').add(botData);

        res.json({
            success: true,
            message: `Bot "${botData.name}" created from player stats`,
            bot_id: botRef.id,
            bot_pin: botPin,
            x01_skills: x01Skills,
            cricket_skills: cricketSkills,
            source_player: playerName,
            source_stats: {
                x01_legs_played: playerStats.x01_legs_played || 0,
                x01_three_dart_avg: x01Skills.x01_three_dart_avg,
                cricket_legs_played: playerStats.cricket_legs_played || 0
            }
        });

    } catch (error) {
        console.error('Create bot from player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Import league stats from JSON data (admin only)
 * Used to bulk import corrected stats from RTF parsing
 */
exports.adminImportLeagueStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, league_id, stats } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'league_id required' });
        }

        if (!stats || typeof stats !== 'object') {
            return res.status(400).json({ success: false, error: 'stats object required' });
        }

        const db = admin.firestore();
        const batch = db.batch();
        let count = 0;

        for (const [playerId, playerStats] of Object.entries(stats)) {
            // Skip temp IDs
            if (playerId.startsWith('temp_')) continue;

            const statsRef = db.collection('leagues').doc(league_id).collection('stats').doc(playerId);

            const statsWithTimestamp = {
                ...playerStats,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(statsRef, statsWithTimestamp, { merge: true });
            count++;
        }

        await batch.commit();

        res.json({
            success: true,
            message: `Imported stats for ${count} players`,
            league_id,
            players_updated: count
        });

    } catch (error) {
        console.error('Import stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Import match data to Firestore (admin only)
 * Updates an existing match with detailed game/leg/throw data
 */
exports.adminImportMatchData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin, league_id, match_id, match_data } = req.body;

        if (!verifyAdminPin(pin)) {
            return res.status(401).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!league_id || !match_id) {
            return res.status(400).json({ success: false, error: 'league_id and match_id required' });
        }

        if (!match_data) {
            return res.status(400).json({ success: false, error: 'match_data required' });
        }

        const db = admin.firestore();
        const matchRef = db.collection('leagues').doc(league_id).collection('matches').doc(match_id);

        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        // Update match with detailed data
        const updateData = {
            games: match_data.games || [],
            home_score: match_data.final_score?.home,
            away_score: match_data.final_score?.away,
            total_darts: match_data.total_darts,
            total_legs: match_data.total_legs,
            status: 'completed',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            import_source: 'dartconnect_parsed'
        };

        await matchRef.update(updateData);

        res.json({
            success: true,
            message: 'Match data imported',
            match_id,
            games_count: (match_data.games || []).length
        });

    } catch (error) {
        console.error('Import match data error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = exports;
