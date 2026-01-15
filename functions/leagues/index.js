/**
 * BRDC League System - Cloud Functions
 * Complete backend for Triples Draft League
 * 
 * Data Structure:
 * - leagues/{leagueId} - League settings and metadata
 * - leagues/{leagueId}/teams/{teamId} - Team roster and standings
 * - leagues/{leagueId}/players/{playerId} - Player registration and stats
 * - leagues/{leagueId}/matches/{matchId} - Weekly match records
 * - leagues/{leagueId}/matches/{matchId}/games/{gameId} - Individual game results
 * - leagues/{leagueId}/stats/{playerId} - Aggregated player statistics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ============================================================================
// MATCH FORMAT DEFINITION
// ============================================================================

const MATCH_FORMAT = [
    { game: 1, homePositions: [1, 2], awayPositions: [1, 2], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 2, homePositions: [3], awayPositions: [3], type: 'singles', format: 'cricket', checkout: null },
    { game: 3, homePositions: [1], awayPositions: [1], type: 'singles', format: 'cricket', checkout: null },
    { game: 4, homePositions: [2, 3], awayPositions: [2, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 5, homePositions: [2], awayPositions: [2], type: 'singles', format: 'cricket', checkout: null },
    { game: 6, homePositions: [1], awayPositions: [1], type: 'singles', format: '501', checkout: 'double' },
    { game: 7, homePositions: [1, 3], awayPositions: [1, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 8, homePositions: [2], awayPositions: [2], type: 'singles', format: '501', checkout: 'double' },
    { game: 9, homePositions: [3], awayPositions: [3], type: 'singles', format: '501', checkout: 'double' }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Master admin player ID (Donnie Pagel) - can access any league
const MASTER_ADMIN_PLAYER_ID = 'X2DMb9bP4Q8fy9yr5Fam';

// Check if a PIN grants access to a league (either league PIN or master admin)
async function checkLeagueAccess(league, pin) {
    // Check if PIN matches league admin or director PIN
    if (league.admin_pin === pin || league.director_pin === pin) {
        return true;
    }

    // Check if PIN belongs to master admin
    const masterCheck = await db.collection('players').where('pin', '==', pin).limit(1).get();
    if (!masterCheck.empty && masterCheck.docs[0].id === MASTER_ADMIN_PLAYER_ID) {
        return true;
    }

    return false;
}

function generatePin() {
    // 8-digit PIN for league admin access
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function generatePlayerPin() {
    // 5-digit PIN for players
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateMatchPin() {
    // 6-character alphanumeric for match access
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify league director PIN and return league data if valid
 */
exports.verifyLeaguePin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!pin || pin.length !== 8) {
            return res.status(400).json({ success: false, error: 'Invalid PIN format' });
        }

        let leagueDoc;
        let leagueId = league_id;

        if (league_id) {
            // Verify PIN for specific league
            leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (!leagueDoc.exists) {
                return res.status(404).json({ success: false, error: 'League not found' });
            }
        } else {
            // Find league by PIN
            let snap = await db.collection('leagues').where('admin_pin', '==', pin).get();
            if (snap.empty) {
                snap = await db.collection('leagues').where('director_pin', '==', pin).get();
            }
            if (snap.empty) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }
            leagueDoc = snap.docs[0];
            leagueId = leagueDoc.id;
        }

        const league = leagueDoc.data();

        // DEBUG logging
        console.log('verifyLeaguePin - league_id:', leagueId);
        console.log('verifyLeaguePin - entered pin:', pin, 'type:', typeof pin);
        console.log('verifyLeaguePin - stored admin_pin:', league.admin_pin, 'type:', typeof league.admin_pin);
        console.log('verifyLeaguePin - stored director_pin:', league.director_pin, 'type:', typeof league.director_pin);

        // Check PIN matches using helper function (includes master admin check)
        const hasAccess = await checkLeagueAccess(league, pin);
        console.log('verifyLeaguePin - access granted:', hasAccess);

        if (!hasAccess) {
            return res.status(401).json({
                success: false,
                error: 'Invalid PIN',
                debug: {
                    league_id_used: leagueId,
                    doc_exists: leagueDoc.exists,
                    all_keys: Object.keys(league),
                    entered: pin,
                    stored_admin: league.admin_pin,
                    stored_director: league.director_pin,
                    has_admin_key: 'admin_pin' in league,
                    has_director_key: 'director_pin' in league
                }
            });
        }

        // Return league data (excluding sensitive fields for safety)
        const safeLeague = { ...league };
        delete safeLeague.admin_pin;
        delete safeLeague.director_pin;

        res.json({
            success: true,
            league_id: leagueId,
            league: safeLeague
        });

    } catch (error) {
        console.error('Error verifying PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// LEAGUE MANAGEMENT
// ============================================================================

/**
 * Create a new league
 */
exports.createLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const data = req.body;

        // Validate required fields
        if (!data.league_name || !data.start_date || !data.venue_name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_name, start_date, venue_name'
            });
        }

        const playersPerTeam = parseInt(data.players_per_team) || 3;
        const gamesPerMatch = parseInt(data.games_per_match) || 9;

        // Determine league type from team size
        let leagueType = 'triples_draft';
        if (playersPerTeam === 2) leagueType = 'doubles';
        else if (playersPerTeam === 4) leagueType = 'quads';
        else if (playersPerTeam === 5) leagueType = 'fives';

        // Director info
        const directorName = data.director_first_name && data.director_last_name
            ? `${data.director_first_name} ${data.director_last_name}`
            : (data.full_name || '');
        const directorPlayerId = data.director_player_id || null;

        // The director's player PIN IS the league admin PIN - no separate PIN generation
        const directorPin = data.director_pin || null;

        if (!directorPin || directorPin.length !== 8) {
            return res.status(400).json({
                success: false,
                error: 'You must be signed in with your player PIN to create a league'
            });
        }

        // Both admin_pin and director_pin are the same - the player's PIN
        const adminPin = directorPin;

        console.log('createLeague - Using player PIN as admin_pin:', adminPin);

        const league = {
            league_name: data.league_name,
            season: data.season || 'Spring 2025',
            league_type: leagueType,

            // Schedule
            start_date: data.start_date,
            league_night: data.league_night || 'wednesday',
            start_time: data.start_time || '19:00',
            schedule_format: data.schedule_format || 'round_robin', // round_robin, double_round_robin

            // Venue
            venue_name: data.venue_name,
            venue_address: data.venue_address || '',

            // Structure
            num_teams: parseInt(data.num_teams) || 8,
            players_per_team: playersPerTeam,
            games_per_match: gamesPerMatch,
            legs_per_game: 3, // Best of 3 (default)

            // Custom match format (round-by-round)
            // Array of: { game_type, num_players, player_level, best_of, in_rule, out_rule, points }
            match_format: data.match_format || null,

            // Fees
            session_fee: parseFloat(data.session_fee) || 0,

            // Manager contact (for PIN recovery and notifications)
            manager_email: data.manager_email || '',
            manager_phone: data.manager_phone || '',

            // Director info
            director_name: directorName,
            director_player_id: directorPlayerId,
            director_pin: directorPin, // 8-digit player PIN for dashboard access

            // Auth
            admin_pin: adminPin,

            // Scoring & Rules
            point_system: data.point_system || 'game_based', // game_based, match_based
            tiebreakers: data.tiebreakers || ['head_to_head', 'point_diff', 'total_points'],
            cork_rule: data.cork_rule || 'cork_first_leg', // cork_first_leg, cork_every_leg, home_first, higher_seed
            level_rules: data.level_rules || 'play_up', // strict, play_up, flexible

            // Playoffs
            playoff_format: data.playoff_format || 'top_4_single', // none, top_4_single, top_4_double, top_6_single, top_8_single
            bye_points: data.bye_points || 'average', // average, fixed, none

            // Status
            status: data.status || 'registration', // registration, draft, active, playoffs, completed
            current_week: 0,
            total_weeks: 0, // Calculated after teams set

            // Metadata
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const leagueRef = await db.collection('leagues').add(league);

        // If director has a player_id, update their involvements
        if (directorPlayerId) {
            try {
                const playerRef = db.collection('players').doc(directorPlayerId);
                await playerRef.update({
                    'involvements.directing': admin.firestore.FieldValue.arrayUnion({
                        id: leagueRef.id,
                        name: data.league_name,
                        type: 'league',
                        status: 'registration',
                        added_at: new Date().toISOString()
                    })
                });
            } catch (involvementError) {
                console.log('Could not update director involvements:', involvementError.message);
                // Non-fatal - continue with success response
            }
        }

        res.json({
            success: true,
            league_id: leagueRef.id,
            admin_pin: adminPin,
            message: 'League created successfully'
        });

    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get league details (public info)
 */
exports.getLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        if (!leagueId) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueDoc = await db.collection('leagues').doc(leagueId).get();

        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Remove sensitive data
        delete league.admin_pin;

        res.json({
            success: true,
            league: { id: leagueId, ...league }
        });

    } catch (error) {
        console.error('Error getting league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a league and all its subcollections
 */
exports.deleteLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        if (!league_id || !admin_pin) {
            return res.status(400).json({ success: false, error: 'Missing league_id or admin_pin' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Accept either admin_pin, director_pin, or master admin
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        // Delete subcollections first
        const subcollections = ['teams', 'players', 'matches', 'stats'];
        for (const subcol of subcollections) {
            const snapshot = await db.collection('leagues').doc(league_id).collection(subcol).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            if (snapshot.docs.length > 0) await batch.commit();
        }

        // Remove from director's involvements if they have a player_id
        if (league.director_player_id) {
            try {
                const playerRef = db.collection('players').doc(league.director_player_id);
                const playerDoc = await playerRef.get();
                if (playerDoc.exists) {
                    const involvements = playerDoc.data().involvements?.directing || [];
                    const updated = involvements.filter(inv => inv.id !== league_id);
                    await playerRef.update({ 'involvements.directing': updated });
                }
            } catch (e) {
                console.log('Could not update director involvements:', e.message);
            }
        }

        // Delete the league document
        await db.collection('leagues').doc(league_id).delete();

        res.json({ success: true, message: 'League deleted successfully' });

    } catch (error) {
        console.error('Error deleting league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league status
 */
exports.updateLeagueStatus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, status } = req.body;

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const validStatuses = ['registration', 'draft', 'active', 'playoffs', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        await db.collection('leagues').doc(league_id).update({
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: `League status updated to ${status}` });

    } catch (error) {
        console.error('Error updating league status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league settings
 */
exports.updateLeagueSettings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, settings } = req.body;

        if (!league_id || !settings) {
            return res.status(400).json({ success: false, error: 'Missing league_id or settings' });
        }

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Allowed fields that can be updated
        const allowedFields = [
            'league_name', 'season', 'start_date', 'league_night', 'start_time',
            'venue_name', 'venue_address', 'point_system', 'cork_rule',
            'level_rules', 'session_fee', 'playoff_format', 'bye_points'
        ];

        // Build update object with only allowed fields
        const updates = {};
        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                updates[field] = settings[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('leagues').doc(league_id).update(updates);

        res.json({
            success: true,
            message: 'League settings updated',
            updated_fields: Object.keys(updates).filter(k => k !== 'updated_at')
        });

    } catch (error) {
        console.error('Error updating league settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER REGISTRATION
// ============================================================================

/**
 * Register a player for the league
 */
exports.registerPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, name, email, phone, skill_level } = req.body;

        if (!league_id || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name, email'
            });
        }

        // Check league exists and is accepting registrations
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.status !== 'registration') {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        // Check for duplicate email
        const existingPlayer = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase())
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Check capacity
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const maxPlayers = league.num_teams * league.players_per_team;

        if (playersSnapshot.size >= maxPlayers) {
            return res.status(400).json({ success: false, error: 'League is full' });
        }

        // Generate unique 5-digit PIN for this player
        const playerPin = generatePlayerPin();

        const player = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || '',
            skill_level: skill_level || 'intermediate', // beginner, intermediate, advanced, or A/B/C
            reported_average: parseFloat(req.body.average) || null, // Self-reported 501 average
            preferred_level: req.body.preferred_level || null, // A, B, or C preference
            team_id: null,
            position: null, // 1, 2, or 3 (P1/A = captain/advanced, P2/B = mid, P3/C = newer)
            level: null, // A, B, or C - assigned after draft
            is_captain: false,
            is_sub: false,
            pin: playerPin, // 5-digit unique PIN for login
            payment_status: 'pending',
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            player_pin: playerPin, // Include PIN for player to use for login
            message: 'Registration successful',
            spots_remaining: maxPlayers - playersSnapshot.size - 1
        });

    } catch (error) {
        console.error('Error registering player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all registered players
 */
exports.getPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const playersSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .orderBy('registered_at', 'asc')
            .get();

        const players = [];
        playersSnapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, players: players });

    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin add a single player (bypasses registration)
 */
exports.addPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, name, email, phone, skill_level, average, preferred_level } = req.body;

        if (!league_id || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check for duplicate email if provided
        if (email) {
            const existingPlayer = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', email.toLowerCase())
                .get();

            if (!existingPlayer.empty) {
                return res.status(400).json({ success: false, error: 'Email already registered' });
            }
        }

        // Generate unique 5-digit PIN for this player
        const playerPin = generatePlayerPin();

        const player = {
            name: name.trim(),
            email: email ? email.toLowerCase().trim() : '',
            phone: phone || '',
            skill_level: skill_level || 'intermediate',
            reported_average: average ? parseFloat(average) : null,
            preferred_level: preferred_level || null,
            team_id: null,
            position: null,
            level: null,
            is_captain: false,
            is_sub: false,
            pin: playerPin,
            payment_status: 'pending',
            added_by_admin: true,
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            player_pin: playerPin,
            message: 'Player added successfully'
        });

    } catch (error) {
        console.error('Error adding player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add a bot to a league's player pool
 */
exports.addBotToLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, bot_id } = req.body;

        if (!league_id || !bot_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, bot_id'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get bot from global bots collection
        const botDoc = await db.collection('bots').doc(bot_id).get();
        if (!botDoc.exists) {
            return res.status(404).json({ success: false, error: 'Bot not found' });
        }

        const bot = botDoc.data();

        // Check if this bot is already in the league
        const existingBot = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('source_bot_id', '==', bot_id)
            .get();

        if (!existingBot.empty) {
            return res.status(400).json({ success: false, error: 'Bot already added to this league' });
        }

        // Add bot as a player in the league
        const player = {
            name: bot.name,
            email: '',
            phone: '',
            skill_level: bot.difficulty,
            reported_average: null,
            preferred_level: bot.difficulty,
            team_id: null,
            position: null,
            level: null,
            is_captain: false,
            is_sub: false,
            isBot: true,
            botDifficulty: bot.difficulty,
            source_bot_id: bot_id,
            pin: null, // Bots don't need PINs
            payment_status: 'paid', // Bots don't pay
            added_by_admin: true,
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            bot_name: bot.name,
            message: 'Bot added to league successfully'
        });

    } catch (error) {
        console.error('Error adding bot to league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin bulk add players
 */
exports.bulkAddPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, players } = req.body;

        if (!league_id || !players || !Array.isArray(players)) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, players (array)'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();

        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get existing emails to check for duplicates
        const existingPlayersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const existingEmails = new Set();
        existingPlayersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.email) existingEmails.add(data.email.toLowerCase());
        });

        const results = {
            added: [],
            skipped: [],
            errors: []
        };

        const batch = db.batch();
        let batchCount = 0;

        for (const playerData of players) {
            if (!playerData.name || !playerData.name.trim()) {
                results.skipped.push({ name: playerData.name || 'unnamed', reason: 'No name provided' });
                continue;
            }

            // Check for duplicate email
            if (playerData.email && existingEmails.has(playerData.email.toLowerCase())) {
                results.skipped.push({ name: playerData.name, reason: 'Email already registered' });
                continue;
            }

            const playerPin = generatePlayerPin();

            const player = {
                name: playerData.name.trim(),
                email: playerData.email ? playerData.email.toLowerCase().trim() : '',
                phone: playerData.phone || '',
                skill_level: playerData.skill_level || 'intermediate',
                reported_average: playerData.average ? parseFloat(playerData.average) : null,
                preferred_level: playerData.preferred_level || null,
                team_id: null,
                position: null,
                level: null,
                is_captain: false,
                is_sub: false,
                pin: playerPin,
                payment_status: 'pending',
                added_by_admin: true,
                registered_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc();
            batch.set(playerRef, player);
            batchCount++;

            if (playerData.email) {
                existingEmails.add(playerData.email.toLowerCase());
            }

            results.added.push({
                id: playerRef.id,
                name: player.name,
                pin: playerPin
            });

            // Firestore batch limit is 500
            if (batchCount >= 450) {
                await batch.commit();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        res.json({
            success: true,
            added_count: results.added.length,
            skipped_count: results.skipped.length,
            results: results,
            message: `Added ${results.added.length} players, skipped ${results.skipped.length}`
        });

    } catch (error) {
        console.error('Error bulk adding players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin update player
 */
exports.updatePlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, player_id, updates } = req.body;

        if (!league_id || !player_id || !updates) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, player_id, updates'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check player exists
        const playerRef = db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Sanitize updates - only allow certain fields
        const allowedFields = ['name', 'email', 'phone', 'skill_level', 'reported_average', 'preferred_level', 'is_sub', 'payment_status'];
        const sanitizedUpdates = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'email' && updates[field]) {
                    sanitizedUpdates[field] = updates[field].toLowerCase().trim();
                } else if (field === 'name' && updates[field]) {
                    sanitizedUpdates[field] = updates[field].trim();
                } else if (field === 'reported_average' && updates[field]) {
                    sanitizedUpdates[field] = parseFloat(updates[field]);
                } else {
                    sanitizedUpdates[field] = updates[field];
                }
            }
        }

        sanitizedUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await playerRef.update(sanitizedUpdates);

        res.json({
            success: true,
            message: 'Player updated successfully'
        });

    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Admin delete player
 */
exports.deletePlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, player_id } = req.body;

        if (!league_id || !player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, player_id'
            });
        }

        // Verify admin PIN
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check player exists
        const playerRef = db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const playerData = playerDoc.data();

        // Check if player is on a team
        if (playerData.team_id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete player who is assigned to a team. Remove from team first.'
            });
        }

        await playerRef.delete();

        res.json({
            success: true,
            message: 'Player deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * Create teams manually (after draft)
 */
exports.createTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, team_name, player_ids } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        if (!player_ids || player_ids.length !== 3) {
            return res.status(400).json({ success: false, error: 'Team must have exactly 3 players' });
        }

        // Get player data
        const playerData = [];
        for (const playerId of player_ids) {
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId).get();
            if (!playerDoc.exists) {
                return res.status(400).json({ success: false, error: `Player ${playerId} not found` });
            }
            playerData.push({ id: playerId, ...playerDoc.data() });
        }

        // Create team
        const team = {
            team_name: team_name,
            players: player_ids.map((id, index) => ({
                id: id,
                name: playerData[index].name,
                position: index + 1, // P1, P2, P3
                isBot: playerData[index].isBot || false,
                botDifficulty: playerData[index].botDifficulty || null
            })),
            captain_id: player_ids[0], // P1 is captain

            // Standings
            wins: 0,
            losses: 0,
            ties: 0,
            games_won: 0,
            games_lost: 0,
            points: 0,

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const teamRef = await db.collection('leagues').doc(league_id)
            .collection('teams').add(team);

        // Update players with team assignment
        const batch = db.batch();
        player_ids.forEach((playerId, index) => {
            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId);
            batch.update(playerRef, {
                team_id: teamRef.id,
                position: index + 1,
                is_captain: index === 0
            });
        });
        await batch.commit();

        res.json({
            success: true,
            team_id: teamRef.id,
            message: 'Team created successfully'
        });

    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all teams with rosters
 */
exports.getTeams = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams')
            .orderBy('team_name', 'asc')
            .get();

        const teams = [];
        teamsSnapshot.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, teams: teams });

    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get standings (sorted teams)
 */
exports.getStandings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams').get();

        const teams = [];
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            const totalMatches = team.wins + team.losses + team.ties;
            const winPct = totalMatches > 0 ? (team.wins / totalMatches * 100).toFixed(1) : '0.0';
            const totalGames = team.games_won + team.games_lost;
            const gamePct = totalGames > 0 ? (team.games_won / totalGames * 100).toFixed(1) : '0.0';

            teams.push({
                id: doc.id,
                ...team,
                total_matches: totalMatches,
                win_pct: parseFloat(winPct),
                total_games: totalGames,
                game_pct: parseFloat(gamePct)
            });
        });

        // Sort by points, then wins, then game percentage
        teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.game_pct - a.game_pct;
        });

        // Add rank
        teams.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.json({ success: true, standings: teams });

    } catch (error) {
        console.error('Error getting standings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// SCHEDULE & MATCH MANAGEMENT
// ============================================================================

/**
 * Generate round-robin schedule
 */
exports.generateSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get teams
        const teamsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('teams').get();

        if (teamsSnapshot.empty) {
            return res.status(400).json({ success: false, error: 'No teams found' });
        }

        const teams = [];
        teamsSnapshot.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams' });
        }

        // Generate round-robin (each team plays each other twice - home and away)
        const matches = [];
        const numTeams = teams.length;
        const teamsCopy = [...teams];

        // Add bye if odd number of teams
        if (numTeams % 2 !== 0) {
            teamsCopy.push({ id: 'BYE', team_name: 'BYE' });
        }

        const n = teamsCopy.length;
        const rounds = (n - 1) * 2; // Double round-robin
        const startDate = new Date(league.start_date);

        let week = 1;

        // First half - each team plays each other once
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[home];
                const awayTeam = teamsCopy[away];

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled', // scheduled, in_progress, completed
                        match_pin: null, // Generated when match starts
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Second half - reverse home/away
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[away]; // Swapped
                const awayTeam = teamsCopy[home]; // Swapped

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled',
                        match_pin: null,
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Save matches
        const batch = db.batch();
        matches.forEach(match => {
            const matchRef = db.collection('leagues').doc(league_id)
                .collection('matches').doc();
            batch.set(matchRef, match);
        });

        // Update league with total weeks
        batch.update(db.collection('leagues').doc(league_id), {
            total_weeks: week - 1,
            status: 'active',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({
            success: true,
            matches_created: matches.length,
            total_weeks: week - 1,
            message: 'Schedule generated successfully'
        });

    } catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get schedule (all matches or by week)
 */
exports.getSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const week = req.query.week || req.body.week;

        let query = db.collection('leagues').doc(leagueId)
            .collection('matches')
            .orderBy('week', 'asc');

        if (week) {
            query = query.where('week', '==', parseInt(week));
        }

        const matchesSnapshot = await query.get();

        const matches = [];
        matchesSnapshot.forEach(doc => {
            matches.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, matches: matches });

    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start a match (generates PIN for tablet access)
 */
exports.startMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        if (!(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Generate match PIN
        const matchPin = generateMatchPin();

        let games;

        // Check if games are already pre-populated (singles leagues, custom formats)
        if (match.games && match.games.length > 0) {
            // Use existing games, just ensure they have required fields
            games = match.games.map((game, index) => ({
                ...game,
                game_number: game.game_number || index + 1,
                status: game.status || 'pending',
                winner: game.winner || null,
                legs: game.legs || [],
                home_legs_won: game.home_legs_won || 0,
                away_legs_won: game.away_legs_won || 0
            }));
        } else {
            // Team-based league: Get team rosters and build games from MATCH_FORMAT
            const homeTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(league_id)
                .collection('teams').doc(match.away_team_id).get();

            if (!homeTeamDoc.exists || !awayTeamDoc.exists) {
                return res.status(404).json({ success: false, error: 'Teams not found for this match' });
            }

            const homeTeam = homeTeamDoc.data();
            const awayTeam = awayTeamDoc.data();

            // Pre-populate the 9 games based on format
            games = MATCH_FORMAT.map(format => {
                const homePlayers = format.homePositions.map(pos =>
                    homeTeam.players.find(p => p.position === pos)
                );
                const awayPlayers = format.awayPositions.map(pos =>
                    awayTeam.players.find(p => p.position === pos)
                );

                return {
                    game_number: format.game,
                    type: format.type,
                    format: format.format,
                    checkout: format.checkout,
                    home_players: homePlayers,
                    away_players: awayPlayers,
                    status: 'pending',
                    winner: null,
                    legs: [],
                    home_legs_won: 0,
                    away_legs_won: 0
                };
            });
        }

        await matchRef.update({
            match_pin: matchPin,
            status: 'in_progress',
            games: games,
            started_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            match_pin: matchPin,
            games: games,
            message: 'Match started. Share the PIN with captains.'
        });

    } catch (error) {
        console.error('Error starting match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get match by PIN (for tablet access)
 */
exports.getMatchByPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.query.pin ? req.query : req.body;

        if (!pin) {
            return res.status(400).json({ success: false, error: 'Missing PIN' });
        }

        // Search all leagues for match with this PIN
        const leaguesSnapshot = await db.collection('leagues')
            .where('status', '==', 'active').get();

        let foundMatch = null;
        let foundLeagueId = null;
        let foundLeague = null;

        for (const leagueDoc of leaguesSnapshot.docs) {
            // Search for matches that are scheduled OR in_progress
            const matchesSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('matches')
                .where('match_pin', '==', pin.toUpperCase())
                .get();

            for (const matchDoc of matchesSnapshot.docs) {
                const matchData = matchDoc.data();
                // Accept scheduled or in_progress matches
                if (matchData.status === 'scheduled' || matchData.status === 'in_progress') {
                    foundMatch = { id: matchDoc.id, ...matchData };
                    foundLeagueId = leagueDoc.id;
                    foundLeague = { id: leagueDoc.id, ...leagueDoc.data() };
                    break;
                }
            }

            if (foundMatch) break;
        }

        if (!foundMatch) {
            return res.status(404).json({ success: false, error: 'Match not found or already completed' });
        }

        let homePlayers = [];
        let awayPlayers = [];
        let homeTeam = null;
        let awayTeam = null;

        // Check if this is a singles league (players embedded in games) or team league
        if (foundMatch.games && foundMatch.games.length > 0 && foundMatch.games[0].home_players) {
            // Singles/custom league - extract players from first game
            const firstGame = foundMatch.games[0];
            homePlayers = firstGame.home_players || [];
            awayPlayers = firstGame.away_players || [];
        } else {
            // Team-based league - get full team data
            const homeTeamDoc = await db.collection('leagues').doc(foundLeagueId)
                .collection('teams').doc(foundMatch.home_team_id).get();
            const awayTeamDoc = await db.collection('leagues').doc(foundLeagueId)
                .collection('teams').doc(foundMatch.away_team_id).get();

            homeTeam = homeTeamDoc.exists ? { id: homeTeamDoc.id, ...homeTeamDoc.data() } : null;
            awayTeam = awayTeamDoc.exists ? { id: awayTeamDoc.id, ...awayTeamDoc.data() } : null;

            // Extract player arrays from teams (position A=1, B=2, C=3)
            homePlayers = (homeTeam?.players || []).map(p => ({
                id: p.player_id || p.id,
                name: p.name || p.player_name,
                position: p.position,
                isBot: p.isBot || false,
                botDifficulty: p.botDifficulty || null
            })).sort((a, b) => a.position - b.position);

            awayPlayers = (awayTeam?.players || []).map(p => ({
                id: p.player_id || p.id,
                name: p.name || p.player_name,
                position: p.position,
                isBot: p.isBot || false,
                botDifficulty: p.botDifficulty || null
            })).sort((a, b) => a.position - b.position);
        }

        // Use games from match if available, otherwise use default MATCH_FORMAT
        const matchFormat = foundMatch.games && foundMatch.games.length > 0
            ? foundMatch.games
            : MATCH_FORMAT;

        // Build comprehensive match response
        res.json({
            success: true,
            match: {
                match_id: foundMatch.id,
                league_id: foundLeagueId,
                league_name: foundLeague?.league_name || 'League Match',
                week: foundMatch.week,
                status: foundMatch.status,
                home_team_id: foundMatch.home_team_id,
                away_team_id: foundMatch.away_team_id,
                home_team_name: foundMatch.home_team_name || homeTeam?.team_name || 'Home Team',
                away_team_name: foundMatch.away_team_name || awayTeam?.team_name || 'Away Team',
                home_players: homePlayers,
                away_players: awayPlayers,
                match_pin: foundMatch.match_pin,
                admin_pin: foundMatch.admin_pin,
                match_date: foundMatch.match_date,
                venue: foundLeague?.venue_name,
                games: foundMatch.games || []
            },
            match_format: matchFormat
        });

    } catch (error) {
        console.error('Error getting match by PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GAME SCORING
// ============================================================================

/**
 * Start a game within a match
 */
exports.startGame = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;

        if (games[gameIndex].status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Game already started or completed' });
        }

        games[gameIndex].status = 'in_progress';
        games[gameIndex].started_at = new Date().toISOString();

        await matchRef.update({ games: games });

        res.json({
            success: true,
            game: games[gameIndex],
            message: `Game ${game_number} started`
        });

    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Record a leg result (called after each leg completes in scorer)
 */
exports.recordLeg = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number, leg_data } = req.body;

        /*
        leg_data structure for 501:
        {
            leg_number: 1,
            winner: 'home', // or 'away'
            home_stats: {
                darts_thrown: 45,
                points_scored: 501,
                three_dart_avg: 33.4,
                highest_score: 140,
                tons: 2,          // 100+
                ton_forties: 1,   // 140+
                ton_eighties: 0,  // 180
                one_seventyone: 0,
                checkout: 36,
                checkout_attempts: 3
            },
            away_stats: { ... same structure ... }
        }

        leg_data structure for Cricket:
        {
            leg_number: 1,
            winner: 'home',
            home_stats: {
                rounds: 12,
                marks: 52,
                mpr: 4.33,
                nine_mark_rounds: 2,
                eight_mark_rounds: 1,
                points_scored: 125
            },
            away_stats: { ... }
        }
        */

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;
        const game = games[gameIndex];

        // Add leg to game
        game.legs.push(leg_data);

        // Update leg counts
        if (leg_data.winner === 'home') {
            game.home_legs_won++;
        } else {
            game.away_legs_won++;
        }

        // Check if game is complete (best of 3 = first to 2)
        if (game.home_legs_won >= 2 || game.away_legs_won >= 2) {
            game.status = 'completed';
            game.winner = game.home_legs_won >= 2 ? 'home' : 'away';
            game.completed_at = new Date().toISOString();

            // Update match score
            if (game.winner === 'home') {
                match.home_score++;
            } else {
                match.away_score++;
            }
        }

        games[gameIndex] = game;

        await matchRef.update({
            games: games,
            home_score: match.home_score,
            away_score: match.away_score
        });

        // Update player stats
        await updatePlayerStats(league_id, game, leg_data);

        res.json({
            success: true,
            game: game,
            match_score: { home: match.home_score, away: match.away_score },
            game_complete: game.status === 'completed'
        });

    } catch (error) {
        console.error('Error recording leg:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Helper to update player statistics
 */
async function updatePlayerStats(leagueId, game, legData) {
    try {
        const updateStats = async (players, stats, isWinner) => {
            for (const player of players) {
                if (!player || !player.id) continue;

                const statsRef = db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(player.id);

                const statsDoc = await statsRef.get();
                let playerStats = statsDoc.exists ? statsDoc.data() : {
                    player_id: player.id,
                    player_name: player.name,
                    // 501 stats - DartConnect compatible
                    x01_legs_played: 0,
                    x01_legs_won: 0,
                    x01_total_darts: 0,
                    x01_total_points: 0,
                    // First 9 darts stats
                    x01_first9_darts: 0,
                    x01_first9_points: 0,
                    // Ton breakdown (DartConnect: T00, T20, T40, T60, T80)
                    x01_tons: 0,           // 100+ total
                    x01_ton_00: 0,         // 100-119
                    x01_ton_20: 0,         // 120-139
                    x01_ton_40: 0,         // 140-159 (ton_forties)
                    x01_ton_60: 0,         // 160-179
                    x01_ton_80: 0,         // 180s
                    x01_ton_forties: 0,    // Legacy: 140+
                    x01_ton_eighties: 0,   // Legacy: 180s
                    x01_one_seventy_ones: 0, // 171s
                    // Checkout stats
                    x01_high_checkout: 0,
                    x01_ton_plus_checkouts: 0,
                    x01_checkout_attempts: 0,    // Checkout turns
                    x01_checkout_darts: 0,       // Total darts at doubles
                    x01_checkouts_hit: 0,
                    x01_total_checkout_points: 0, // Sum of all checkouts for AFin
                    // Best leg
                    x01_best_leg: 999,
                    // High scores
                    x01_high_score: 0,
                    // Cricket stats - DartConnect compatible
                    cricket_legs_played: 0,
                    cricket_legs_won: 0,
                    cricket_total_rounds: 0,
                    cricket_total_marks: 0,
                    cricket_total_darts: 0,
                    cricket_missed_darts: 0,     // For Miss%
                    cricket_triple_bull_darts: 0, // For T&B%
                    // High mark rounds
                    cricket_five_mark_rounds: 0,  // 5M+
                    cricket_seven_mark_rounds: 0, // 7M+
                    cricket_nine_mark_rounds: 0,  // 9M
                    cricket_eight_mark_rounds: 0,
                    // Bull counts
                    cricket_three_bulls: 0,
                    cricket_four_bulls: 0,
                    cricket_five_bulls: 0,
                    cricket_six_bulls: 0,
                    cricket_hat_tricks: 0,
                    // Overall
                    games_played: 0,
                    games_won: 0
                };

                // Check if format is any X01 variant (301, 501, 701, or numeric x01)
                const isX01 = game.format === '501' || game.format === '301' || game.format === '701' ||
                              game.format === 'x01' || /^\d+$/.test(game.format);

                if (isX01) {
                    playerStats.x01_legs_played++;
                    if (isWinner) playerStats.x01_legs_won++;
                    playerStats.x01_total_darts += stats.darts_thrown || 0;
                    playerStats.x01_total_points += stats.points_scored || 0;

                    // First 9 stats
                    playerStats.x01_first9_darts += stats.first9_darts || 0;
                    playerStats.x01_first9_points += stats.first9_points || 0;

                    // Ton breakdown
                    playerStats.x01_tons += stats.tons || 0;
                    playerStats.x01_ton_00 += stats.ton_00 || 0;
                    playerStats.x01_ton_20 += stats.ton_20 || 0;
                    playerStats.x01_ton_40 += stats.ton_40 || 0;
                    playerStats.x01_ton_60 += stats.ton_60 || 0;
                    playerStats.x01_ton_80 += stats.ton_80 || 0;
                    // Legacy fields
                    playerStats.x01_ton_forties += stats.ton_forties || stats.ton_40 || 0;
                    playerStats.x01_ton_eighties += stats.ton_eighties || stats.ton_80 || 0;
                    playerStats.x01_one_seventy_ones += stats.one_seventyone || stats.ton_71 || 0;

                    // Checkout stats
                    playerStats.x01_checkout_attempts += stats.checkout_attempts || 0;
                    playerStats.x01_checkout_darts += stats.checkout_darts || 0;

                    // High score tracking
                    if ((stats.high_score || 0) > playerStats.x01_high_score) {
                        playerStats.x01_high_score = stats.high_score;
                    }

                    if (isWinner && stats.checkout) {
                        playerStats.x01_checkouts_hit++;
                        playerStats.x01_total_checkout_points += stats.checkout;
                        if (stats.checkout >= 100) {
                            playerStats.x01_ton_plus_checkouts++;
                        }
                        if (stats.checkout > playerStats.x01_high_checkout) {
                            playerStats.x01_high_checkout = stats.checkout;
                        }
                        // Best leg tracking
                        const legDarts = stats.darts_thrown || 0;
                        if (legDarts > 0 && legDarts < playerStats.x01_best_leg) {
                            playerStats.x01_best_leg = legDarts;
                        }
                    }
                } else if (game.format === 'cricket') {
                    playerStats.cricket_legs_played++;
                    if (isWinner) playerStats.cricket_legs_won++;
                    playerStats.cricket_total_rounds += stats.rounds || 0;
                    playerStats.cricket_total_marks += stats.marks || 0;
                    playerStats.cricket_total_darts += stats.darts_thrown || 0;
                    playerStats.cricket_missed_darts += stats.missed_darts || 0;
                    playerStats.cricket_triple_bull_darts += stats.triple_bull_darts || 0;
                    // High mark rounds
                    playerStats.cricket_five_mark_rounds += stats.five_mark_rounds || 0;
                    playerStats.cricket_seven_mark_rounds += stats.seven_mark_rounds || 0;
                    playerStats.cricket_nine_mark_rounds += stats.nine_mark_rounds || 0;
                    playerStats.cricket_eight_mark_rounds += stats.eight_mark_rounds || 0;
                    // Bull counts
                    playerStats.cricket_three_bulls += stats.three_bulls || 0;
                    playerStats.cricket_four_bulls += stats.four_bulls || 0;
                    playerStats.cricket_five_bulls += stats.five_bulls || 0;
                    playerStats.cricket_six_bulls += stats.six_bulls || 0;
                    playerStats.cricket_hat_tricks += stats.hat_tricks || 0;
                }

                await statsRef.set(playerStats, { merge: true });
            }
        };

        const homeWon = legData.winner === 'home';
        await updateStats(game.home_players, legData.home_stats, homeWon);
        await updateStats(game.away_players, legData.away_stats, !homeWon);

    } catch (error) {
        console.error('Error updating player stats:', error);
        // Don't throw - stats update failure shouldn't break game recording
    }
}

/**
 * Helper to process all legs from a completed game and update stats
 */
async function processGameStats(leagueId, game, gameStats) {
    try {
        if (!gameStats || !gameStats.legs) return;

        // Process each leg
        for (const leg of gameStats.legs) {
            await updatePlayerStats(leagueId, game, leg);
        }

        // Update games played/won for all players
        const updateGamesCount = async (players, isGameWinner) => {
            for (const player of players) {
                if (!player || !player.id) continue;

                const statsRef = db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(player.id);

                await statsRef.set({
                    games_played: admin.firestore.FieldValue.increment(1),
                    games_won: admin.firestore.FieldValue.increment(isGameWinner ? 1 : 0)
                }, { merge: true });
            }
        };

        const homeWonGame = gameStats.winner === 'home';
        await updateGamesCount(game.home_players, homeWonGame);
        await updateGamesCount(game.away_players, !homeWonGame);

    } catch (error) {
        console.error('Error processing game stats:', error);
    }
}

/**
 * Finalize a match (called when all 9 games complete)
 */
exports.finalizeMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        // Verify all games are complete
        const incompleteGames = match.games.filter(g => g.status !== 'completed');
        if (incompleteGames.length > 0) {
            return res.status(400).json({
                success: false,
                error: `${incompleteGames.length} games not yet completed`
            });
        }

        // Determine match winner
        let matchWinner = null;
        if (match.home_score > match.away_score) {
            matchWinner = 'home';
        } else if (match.away_score > match.home_score) {
            matchWinner = 'away';
        } else {
            matchWinner = 'tie';
        }

        // Update match
        await matchRef.update({
            status: 'completed',
            winner: matchWinner,
            match_pin: null, // Clear PIN
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team standings
        const batch = db.batch();

        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);

        if (matchWinner === 'home') {
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        } else if (matchWinner === 'away') {
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
        } else {
            // Tie
            batch.update(homeTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        }

        await batch.commit();

        res.json({
            success: true,
            winner: matchWinner,
            final_score: { home: match.home_score, away: match.away_score },
            message: 'Match finalized and standings updated'
        });

    } catch (error) {
        console.error('Error finalizing match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER STATS
// ============================================================================

/**
 * Get player stats
 */
exports.getPlayerStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const playerId = req.query.player_id || req.body.player_id;

        if (playerId) {
            // Get single player
            const statsDoc = await db.collection('leagues').doc(leagueId)
                .collection('stats').doc(playerId).get();

            if (!statsDoc.exists) {
                return res.json({ success: true, stats: null });
            }

            const stats = statsDoc.data();

            // Calculate averages
            if (stats.x01_legs_played > 0) {
                stats.x01_three_dart_avg = (stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2);
            }
            if (stats.cricket_legs_played > 0) {
                stats.cricket_mpr = (stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2);
            }

            res.json({ success: true, stats: stats });

        } else {
            // Get all players' stats (leaderboard)
            const statsSnapshot = await db.collection('leagues').doc(leagueId)
                .collection('stats').get();

            const allStats = [];
            statsSnapshot.forEach(doc => {
                const stats = doc.data();

                // Calculate averages
                if (stats.x01_total_darts > 0) {
                    stats.x01_three_dart_avg = parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2));
                } else {
                    stats.x01_three_dart_avg = 0;
                }

                if (stats.cricket_total_rounds > 0) {
                    stats.cricket_mpr = parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2));
                } else {
                    stats.cricket_mpr = 0;
                }

                allStats.push({ id: doc.id, ...stats });
            });

            res.json({ success: true, stats: allStats });
        }

    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get leaderboards
 */
exports.getLeaderboards = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const statsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('stats').get();

        const allStats = [];
        statsSnapshot.forEach(doc => {
            const stats = doc.data();

            // Calculate derived stats
            stats.x01_three_dart_avg = stats.x01_total_darts > 0
                ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                : 0;

            stats.cricket_mpr = stats.cricket_total_rounds > 0
                ? parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2))
                : 0;

            stats.x01_checkout_pct = stats.x01_checkout_attempts > 0
                ? parseFloat((stats.x01_checkouts_hit / stats.x01_checkout_attempts * 100).toFixed(1))
                : 0;

            allStats.push({ id: doc.id, ...stats });
        });

        // Create various leaderboards
        const leaderboards = {
            x01_average: [...allStats]
                .filter(s => s.x01_legs_played >= 3)
                .sort((a, b) => b.x01_three_dart_avg - a.x01_three_dart_avg)
                .slice(0, 10),

            x01_180s: [...allStats]
                .sort((a, b) => b.x01_ton_eighties - a.x01_ton_eighties)
                .slice(0, 10),

            x01_171s: [...allStats]
                .sort((a, b) => b.x01_one_seventy_ones - a.x01_one_seventy_ones)
                .slice(0, 10),

            x01_high_checkout: [...allStats]
                .filter(s => s.x01_high_checkout > 0)
                .sort((a, b) => b.x01_high_checkout - a.x01_high_checkout)
                .slice(0, 10),

            x01_ton_plus_checkouts: [...allStats]
                .sort((a, b) => b.x01_ton_plus_checkouts - a.x01_ton_plus_checkouts)
                .slice(0, 10),

            cricket_mpr: [...allStats]
                .filter(s => s.cricket_legs_played >= 3)
                .sort((a, b) => b.cricket_mpr - a.cricket_mpr)
                .slice(0, 10),

            cricket_9_marks: [...allStats]
                .sort((a, b) => b.cricket_nine_mark_rounds - a.cricket_nine_mark_rounds)
                .slice(0, 10)
        };

        res.json({ success: true, leaderboards: leaderboards });

    } catch (error) {
        console.error('Error getting leaderboards:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Quick submit game result (for testing/manual entry)
 */
exports.submitGameResult = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number, winner, home_legs_won, away_legs_won, admin_pin, game_stats } = req.body;

        // Verify admin (optional - can also use match_pin)
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        if (admin_pin && !(await checkLeagueAccess(league, admin_pin))) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const games = match.games;
        const gameIndex = game_number - 1;

        if (gameIndex < 0 || gameIndex >= games.length) {
            return res.status(400).json({ success: false, error: 'Invalid game number' });
        }

        // Update game
        games[gameIndex].status = 'completed';
        games[gameIndex].winner = winner;
        games[gameIndex].home_legs_won = home_legs_won || (winner === 'home' ? 2 : 1);
        games[gameIndex].away_legs_won = away_legs_won || (winner === 'away' ? 2 : 1);
        games[gameIndex].completed_at = new Date().toISOString();

        // Store comprehensive game stats (DartConnect compatible)
        if (game_stats) {
            games[gameIndex].stats = game_stats;
        }

        // Update match score
        let homeScore = 0;
        let awayScore = 0;
        games.forEach(g => {
            if (g.status === 'completed') {
                if (g.winner === 'home') homeScore++;
                else if (g.winner === 'away') awayScore++;
            }
        });

        await matchRef.update({
            games: games,
            home_score: homeScore,
            away_score: awayScore
        });

        // Process player stats if game_stats includes leg data
        if (game_stats && game_stats.legs && game_stats.legs.length > 0) {
            const game = games[gameIndex];
            await processGameStats(league_id, game, { ...game_stats, winner });
        }

        res.json({
            success: true,
            game_number: game_number,
            winner: winner,
            match_score: { home: homeScore, away: awayScore },
            message: `Game ${game_number} result recorded`
        });

    } catch (error) {
        console.error('Error submitting game result:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CAPTAIN & SUBSTITUTE MANAGEMENT
// ============================================================================

/**
 * Captain login - authenticate with email
 */
exports.captainLogin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, email } = req.body;

        if (!league_id || !email) {
            return res.status(400).json({ success: false, error: 'Missing league_id or email' });
        }

        // Find player by email
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase().trim())
            .get();

        if (playersSnapshot.empty) {
            return res.status(404).json({ success: false, error: 'Player not found with this email' });
        }

        const playerDoc = playersSnapshot.docs[0];
        const player = playerDoc.data();

        if (!player.is_captain) {
            return res.status(403).json({ success: false, error: 'You are not a team captain' });
        }

        // Get team info
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(player.team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Get upcoming matches for this team
        const matchesSnapshot = await db.collection('leagues').doc(league_id)
            .collection('matches')
            .where('status', 'in', ['scheduled', 'in_progress'])
            .get();

        const teamMatches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team.id || match.away_team_id === team.id) {
                teamMatches.push({ id: doc.id, ...match });
            }
        });

        // Sort by week
        teamMatches.sort((a, b) => a.week - b.week);

        // Generate a session token (simple for now - in production use JWT)
        const sessionToken = `CAP_${player.team_id}_${Date.now()}`;

        res.json({
            success: true,
            captain: { id: playerDoc.id, ...player },
            team: team,
            upcoming_matches: teamMatches,
            session_token: sessionToken
        });

    } catch (error) {
        console.error('Error in captain login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get captain's team info (with session token or email)
 */
exports.getCaptainTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const teamId = req.query.team_id || req.body.team_id;

        if (!leagueId || !teamId) {
            return res.status(400).json({ success: false, error: 'Missing league_id or team_id' });
        }

        // Get team
        const teamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(teamId).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Get all matches for this team
        const matchesSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('matches')
            .orderBy('week', 'asc')
            .get();

        const teamMatches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team.id || match.away_team_id === team.id) {
                teamMatches.push({
                    id: doc.id,
                    ...match,
                    is_home: match.home_team_id === team.id
                });
            }
        });

        // Get player stats for team members
        const playerStats = [];
        for (const player of team.players || []) {
            const statsDoc = await db.collection('leagues').doc(leagueId)
                .collection('stats').doc(player.id).get();
            if (statsDoc.exists) {
                const stats = statsDoc.data();
                stats.x01_three_dart_avg = stats.x01_total_darts > 0
                    ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                    : 0;
                stats.cricket_mpr = stats.cricket_total_rounds > 0
                    ? parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2))
                    : 0;
                playerStats.push({ player_id: player.id, ...stats });
            }
        }

        // Get available subs
        const subsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .where('is_sub', '==', true)
            .get();

        const availableSubs = [];
        subsSnapshot.forEach(doc => {
            availableSubs.push({ id: doc.id, ...doc.data() });
        });

        res.json({
            success: true,
            team: team,
            matches: teamMatches,
            player_stats: playerStats,
            available_subs: availableSubs
        });

    } catch (error) {
        console.error('Error getting captain team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register a substitute player
 */
exports.registerSubstitute = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, name, email, phone, skill_level } = req.body;

        if (!league_id || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name, email'
            });
        }

        // Check league exists
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        // Check for duplicate email
        const existingPlayer = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase())
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const sub = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || '',
            skill_level: skill_level || 'intermediate',
            team_id: null,
            position: null,
            is_captain: false,
            is_sub: true, // Mark as substitute
            sub_games_played: 0,
            payment_status: 'pending',
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const subRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(sub);

        res.json({
            success: true,
            player_id: subRef.id,
            message: 'Registered as substitute successfully'
        });

    } catch (error) {
        console.error('Error registering substitute:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get available substitutes for a league
 */
exports.getAvailableSubs = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const subsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .where('is_sub', '==', true)
            .get();

        const subs = [];
        subsSnapshot.forEach(doc => {
            subs.push({ id: doc.id, ...doc.data() });
        });

        // Sort by skill level
        const skillOrder = { advanced: 1, intermediate: 2, beginner: 3 };
        subs.sort((a, b) => (skillOrder[a.skill_level] || 2) - (skillOrder[b.skill_level] || 2));

        res.json({ success: true, substitutes: subs });

    } catch (error) {
        console.error('Error getting available subs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Set match lineup (captain can substitute players for specific match)
 */
exports.setMatchLineup = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, captain_email, lineup } = req.body;

        /*
        lineup format:
        [
            { position: 1, player_id: "abc123", player_name: "John Doe", is_sub: false },
            { position: 2, player_id: "def456", player_name: "Jane Smith", is_sub: true, original_player_id: "xyz789" },
            { position: 3, player_id: "ghi789", player_name: "Bob Wilson", is_sub: false }
        ]
        */

        if (!league_id || !match_id || !team_id || !lineup) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify captain
        if (captain_email) {
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('is_captain', '==', true)
                .where('team_id', '==', team_id)
                .get();

            if (captainSnapshot.empty) {
                return res.status(403).json({ success: false, error: 'Not authorized as captain for this team' });
            }
        }

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Determine if home or away
        const isHome = match.home_team_id === team_id;
        if (!isHome && match.away_team_id !== team_id) {
            return res.status(400).json({ success: false, error: 'Team is not part of this match' });
        }

        // Store lineup in match
        const lineupField = isHome ? 'home_lineup' : 'away_lineup';
        const updateData = {
            [lineupField]: lineup,
            [`${lineupField}_set_at`]: admin.firestore.FieldValue.serverTimestamp()
        };

        // If match has games, update player assignments in games
        if (match.games && match.games.length > 0) {
            const games = match.games;

            // Create player lookup from lineup
            const playerLookup = {};
            lineup.forEach(p => {
                playerLookup[p.position] = { id: p.player_id, name: p.player_name };
            });

            // Update each game's player assignments
            games.forEach(game => {
                if (isHome) {
                    game.home_players = game.home_players?.map((p, idx) => {
                        const pos = MATCH_FORMAT[games.indexOf(game)]?.homePositions?.[idx];
                        return playerLookup[pos] || p;
                    }) || game.home_players;
                } else {
                    game.away_players = game.away_players?.map((p, idx) => {
                        const pos = MATCH_FORMAT[games.indexOf(game)]?.awayPositions?.[idx];
                        return playerLookup[pos] || p;
                    }) || game.away_players;
                }
            });

            updateData.games = games;
        }

        await matchRef.update(updateData);

        // Log the substitution
        const subsUsed = lineup.filter(p => p.is_sub);
        if (subsUsed.length > 0) {
            await db.collection('leagues').doc(league_id)
                .collection('substitution_log').add({
                    match_id: match_id,
                    team_id: team_id,
                    substitutions: subsUsed,
                    set_by: captain_email || 'unknown',
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
        }

        res.json({
            success: true,
            message: 'Lineup set successfully',
            substitutes_used: subsUsed.length
        });

    } catch (error) {
        console.error('Error setting match lineup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Quick substitute - replace a player for a single match
 */
exports.quickSubstitute = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, position, sub_player_id, captain_email } = req.body;

        if (!league_id || !match_id || !team_id || !position || !sub_player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify captain (optional security)
        if (captain_email) {
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('is_captain', '==', true)
                .where('team_id', '==', team_id)
                .get();

            if (captainSnapshot.empty) {
                return res.status(403).json({ success: false, error: 'Not authorized' });
            }
        }

        // Get sub player info
        const subDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(sub_player_id).get();

        if (!subDoc.exists) {
            return res.status(404).json({ success: false, error: 'Substitute player not found' });
        }

        const sub = subDoc.data();

        // Get match
        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        // Get team to find original player
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();
        const team = teamDoc.data();

        const originalPlayer = team.players.find(p => p.position === position);

        // Determine if home or away
        const isHome = match.home_team_id === team_id;
        const lineupField = isHome ? 'home_lineup' : 'away_lineup';

        // Get or create lineup
        let lineup = match[lineupField] || team.players.map(p => ({
            position: p.position,
            player_id: p.id,
            player_name: p.name,
            is_sub: false
        }));

        // Update the specific position
        const lineupIndex = lineup.findIndex(p => p.position === position);
        if (lineupIndex >= 0) {
            lineup[lineupIndex] = {
                position: position,
                player_id: sub_player_id,
                player_name: sub.name,
                is_sub: true,
                original_player_id: originalPlayer?.id,
                original_player_name: originalPlayer?.name
            };
        }

        // Update games if they exist
        const updateData = {
            [lineupField]: lineup,
            [`${lineupField}_set_at`]: admin.firestore.FieldValue.serverTimestamp()
        };

        if (match.games && match.games.length > 0) {
            const games = match.games;

            games.forEach((game, gameIndex) => {
                const format = MATCH_FORMAT[gameIndex];
                const positions = isHome ? format.homePositions : format.awayPositions;
                const playersField = isHome ? 'home_players' : 'away_players';

                if (positions.includes(position)) {
                    const playerIndex = positions.indexOf(position);
                    if (game[playersField] && game[playersField][playerIndex]) {
                        game[playersField][playerIndex] = { id: sub_player_id, name: sub.name };
                    }
                }
            });

            updateData.games = games;
        }

        await matchRef.update(updateData);

        // Log substitution
        await db.collection('leagues').doc(league_id)
            .collection('substitution_log').add({
                match_id: match_id,
                team_id: team_id,
                position: position,
                original_player: originalPlayer,
                substitute: { id: sub_player_id, name: sub.name },
                set_by: captain_email || 'unknown',
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

        res.json({
            success: true,
            message: `Substituted ${sub.name} for position ${position}`,
            lineup: lineup
        });

    } catch (error) {
        console.error('Error in quick substitute:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Report issue (captain can report problems during match)
 */
exports.reportIssue = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id, issue_type, description, captain_email } = req.body;

        if (!league_id || !issue_type || !description) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const issue = {
            league_id: league_id,
            match_id: match_id || null,
            team_id: team_id || null,
            issue_type: issue_type, // 'scoring_dispute', 'player_conduct', 'technical', 'other'
            description: description,
            reported_by: captain_email || 'anonymous',
            status: 'pending', // pending, reviewed, resolved
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const issueRef = await db.collection('leagues').doc(league_id)
            .collection('issues').add(issue);

        res.json({
            success: true,
            issue_id: issueRef.id,
            message: 'Issue reported successfully. League director will review.'
        });

    } catch (error) {
        console.error('Error reporting issue:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// COMPLETE MATCH (from scorer hub flow)
// ============================================================================

/**
 * Complete a match from the scorer hub flow
 * Updates match score and finalizes standings
 */
exports.completeMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, home_score, away_score, games, admin_pin } = req.body;

        if (!league_id || !match_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id or match_id' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Verify PIN - check match admin_pin or league director_pin
        if (admin_pin) {
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            const league = leagueDoc.exists ? leagueDoc.data() : {};
            const validPin = admin_pin === match.admin_pin ||
                            admin_pin === league.admin_pin ||
                            admin_pin === league.director_pin;
            if (!validPin) {
                return res.status(403).json({ success: false, error: 'Invalid PIN' });
            }
        }

        // Determine match winner
        let matchWinner = null;
        if (home_score > away_score) {
            matchWinner = 'home';
        } else if (away_score > home_score) {
            matchWinner = 'away';
        } else {
            matchWinner = 'tie';
        }

        // Update match with final scores
        await matchRef.update({
            status: 'completed',
            home_score: home_score,
            away_score: away_score,
            winner: matchWinner,
            games_data: games || [],
            match_pin: null, // Clear PIN
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team standings
        const batch = db.batch();

        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);

        if (matchWinner === 'home') {
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score)
            });
        } else if (matchWinner === 'away') {
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score)
            });
        } else {
            // Tie - each team gets 1 point
            batch.update(homeTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(home_score),
                games_lost: admin.firestore.FieldValue.increment(away_score)
            });
            batch.update(awayTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(away_score),
                games_lost: admin.firestore.FieldValue.increment(home_score)
            });
        }

        await batch.commit();

        res.json({
            success: true,
            message: 'Match completed successfully',
            winner: matchWinner,
            final_score: {
                home: home_score,
                away: away_score
            }
        });

    } catch (error) {
        console.error('Error completing match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a test singles league (4 players, round robin, 501)
 */
exports.createTestSinglesLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { your_name, your_phone, your_email } = req.body;

        if (!your_name) {
            return res.status(400).json({ success: false, error: 'your_name is required' });
        }

        const adminPin = generatePin();
        const leagueId = 'test-singles-' + Date.now();

        // Bot players with 55-65 average
        const botPlayers = [
            { name: 'Bot Alpha', average: 57.3, pin: generatePlayerPin() },
            { name: 'Bot Bravo', average: 61.8, pin: generatePlayerPin() },
            { name: 'Bot Charlie', average: 59.2, pin: generatePlayerPin() }
        ];

        const yourPin = generatePlayerPin();

        // Create league document
        const leagueData = {
            league_name: 'Test Singles League',
            season: 'Test',
            venue_name: 'Test Venue',
            start_date: new Date().toISOString().split('T')[0],
            league_night: 'Wednesday',
            start_time: '7:00 PM',
            league_type: 'singles', // Singles league
            num_players: 4,
            games_per_match: 1, // Single game of 501
            match_format: [{
                game_type: '501',
                best_of: 3,
                num_players: 1,
                player_level: 'ALL',
                in_rule: 'straight',
                out_rule: 'double',
                points: 1
            }],
            schedule_format: 'round_robin',
            cork_rule: 'cork_every_leg',
            point_system: 'match_based',
            playoff_format: 'top_2_final',
            admin_pin: adminPin,
            manager_email: your_email || '',
            manager_phone: your_phone || '',
            status: 'active',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('leagues').doc(leagueId).set(leagueData);

        // Create players
        const players = [
            { id: 'player-you', name: your_name, phone: your_phone || '', email: your_email || '', average: 50, pin: yourPin, isBot: false },
            { id: 'player-alpha', ...botPlayers[0], isBot: true },
            { id: 'player-bravo', ...botPlayers[1], isBot: true },
            { id: 'player-charlie', ...botPlayers[2], isBot: true }
        ];

        const playerRefs = {};
        for (const p of players) {
            const playerRef = db.collection('leagues').doc(leagueId).collection('players').doc(p.id);
            await playerRef.set({
                name: p.name,
                phone: p.phone || '',
                email: p.email || '',
                reported_average: p.average,
                pin: p.pin,
                isBot: p.isBot || false,
                wins: 0,
                losses: 0,
                legs_won: 0,
                legs_lost: 0,
                registered_at: admin.firestore.FieldValue.serverTimestamp()
            });
            playerRefs[p.id] = { id: p.id, name: p.name };
        }

        // Generate round robin schedule (each player plays every other player once)
        // 4 players = 6 matches
        const schedule = [
            { week: 1, home_player: 'player-you', away_player: 'player-alpha' },
            { week: 1, home_player: 'player-bravo', away_player: 'player-charlie' },
            { week: 2, home_player: 'player-you', away_player: 'player-bravo' },
            { week: 2, home_player: 'player-alpha', away_player: 'player-charlie' },
            { week: 3, home_player: 'player-you', away_player: 'player-charlie' },
            { week: 3, home_player: 'player-alpha', away_player: 'player-bravo' }
        ];

        // Create matches (using team-based fields for dashboard compatibility)
        for (let i = 0; i < schedule.length; i++) {
            const s = schedule[i];

            const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(`match-${i + 1}`);
            await matchRef.set({
                match_number: i + 1,
                week: s.week,
                home_team_id: s.home_player,
                away_team_id: s.away_player,
                home_team_name: playerRefs[s.home_player].name,
                away_team_name: playerRefs[s.away_player].name,
                home_score: 0,
                away_score: 0,
                status: 'scheduled',
                match_date: new Date().toLocaleDateString(),
                games: [{
                    game_number: 1,
                    format: '501',
                    type: 'singles',
                    best_of: 3,
                    checkout: 'double',
                    in_rule: 'straight',
                    status: 'pending',
                    home_players: [{ id: s.home_player, name: playerRefs[s.home_player].name }],
                    away_players: [{ id: s.away_player, name: playerRefs[s.away_player].name }],
                    home_legs_won: 0,
                    away_legs_won: 0
                }],
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            league_id: leagueId,
            admin_pin: adminPin,
            your_player_pin: yourPin,
            your_player_id: 'player-you',
            message: 'Test singles league created!',
            players: players.map(p => ({ name: p.name, pin: p.pin, isBot: p.isBot })),
            matches: schedule.length,
            director_url: `https://brdc-v2.web.app/pages/league-director.html?league_id=${leagueId}`,
            standings_url: `https://brdc-v2.web.app/pages/league-standings.html?league_id=${leagueId}`
        });

    } catch (error) {
        console.error('Error creating test league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export match format for use in other modules
exports.MATCH_FORMAT = MATCH_FORMAT;

/**
 * Update league admin PIN (one-time utility)
 */
exports.updateLeagueAdminPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, new_admin_pin, director_pin } = req.body;

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Allow update if director_pin matches
        if (league.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid director PIN' });
        }

        await db.collection('leagues').doc(league_id).update({
            admin_pin: new_admin_pin
        });

        res.json({ success: true, message: 'Admin PIN updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Setup Bot Battle Test League - One-time setup function
 * Adds 12 bot players and creates 4 teams with Week 1 schedule
 */
exports.setupBotLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const LEAGUE_ID = '9CM4w1LLp5AZvMYSkEif';

        // Bot players (from earlier creation)
        const bots = {
            A: [
                { id: 'bot_bullseye_bob', name: 'Bullseye Bob', pin: '35779300', avg: 90, difficulty: 'pro' },
                { id: 'bot_maximum_mike', name: 'Maximum Mike', pin: '71796272', avg: 90, difficulty: 'pro' },
                { id: 'bot_archer_andy', name: 'Archer Andy', pin: '44870323', avg: 90, difficulty: 'pro' },
                { id: 'bot_finish_frank', name: 'Finish Frank', pin: '66849218', avg: 90, difficulty: 'pro' }
            ],
            B: [
                { id: 'bot_triple_tony', name: 'Triple Tony', pin: '93728096', avg: 65, difficulty: 'league' },
                { id: 'bot_checkout_charlie', name: 'Checkout Charlie', pin: '20174480', avg: 65, difficulty: 'league' },
                { id: 'bot_shanghai_sam', name: 'Shanghai Sam', pin: '61599935', avg: 65, difficulty: 'league' },
                { id: 'bot_cork_carl', name: 'Cork Carl', pin: '22011523', avg: 65, difficulty: 'league' }
            ],
            C: [
                { id: 'bot_double_dave', name: 'Double Dave', pin: '67320011', avg: 55, difficulty: 'medium' },
                { id: 'bot_leg_larry', name: 'Leg Larry', pin: '40001052', avg: 55, difficulty: 'medium' },
                { id: 'bot_ton_tommy', name: 'Ton Tommy', pin: '10916817', avg: 55, difficulty: 'medium' },
                { id: 'bot_marker_marvin', name: 'Marker Marvin', pin: '47068084', avg: 55, difficulty: 'medium' }
            ]
        };

        // Teams composition
        const teams = [
            { name: 'Tungsten Thunder', A: 0, B: 0, C: 0 },
            { name: 'Steel City Shooters', A: 1, B: 1, C: 1 },
            { name: 'Flight Risk', A: 2, B: 2, C: 2 },
            { name: 'The Oche Boys', A: 3, B: 3, C: 3 }
        ];

        // 1. Add all bot players to the league's players subcollection
        const playerRefs = {};
        for (const level of ['A', 'B', 'C']) {
            for (const bot of bots[level]) {
                const playerData = {
                    name: bot.name,
                    isBot: true,
                    skill_level: level,
                    reported_average: bot.avg,
                    difficulty: bot.difficulty,
                    pin: bot.pin,
                    team_id: null,
                    position: null,
                    level: level,
                    payment_status: 'paid',
                    registered_at: admin.firestore.FieldValue.serverTimestamp()
                };

                const ref = await db.collection('leagues').doc(LEAGUE_ID)
                    .collection('players').add(playerData);
                playerRefs[bot.id] = ref.id;
            }
        }

        // 2. Create teams
        const teamRefs = [];
        for (const team of teams) {
            const aPlayer = bots.A[team.A];
            const bPlayer = bots.B[team.B];
            const cPlayer = bots.C[team.C];

            const aPlayerId = playerRefs[aPlayer.id];
            const bPlayerId = playerRefs[bPlayer.id];
            const cPlayerId = playerRefs[cPlayer.id];

            const teamData = {
                team_name: team.name,
                players: [
                    { id: aPlayerId, name: aPlayer.name, position: 1, level: 'A' },
                    { id: bPlayerId, name: bPlayer.name, position: 2, level: 'B' },
                    { id: cPlayerId, name: cPlayer.name, position: 3, level: 'C' }
                ],
                captain_id: aPlayerId,
                wins: 0, losses: 0, ties: 0,
                games_won: 0, games_lost: 0, points: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            const teamRef = await db.collection('leagues').doc(LEAGUE_ID)
                .collection('teams').add(teamData);
            teamRefs.push({ id: teamRef.id, name: team.name });

            // Update players with team assignment
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(aPlayerId).update({ team_id: teamRef.id, position: 1 });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(bPlayerId).update({ team_id: teamRef.id, position: 2 });
            await db.collection('leagues').doc(LEAGUE_ID)
                .collection('players').doc(cPlayerId).update({ team_id: teamRef.id, position: 3 });
        }

        // 3. Create Week 1 schedule (round robin: 0v1, 2v3)
        const match1 = {
            week: 1, match_number: 1,
            home_team_id: teamRefs[0].id, away_team_id: teamRefs[1].id,
            home_team_name: teamRefs[0].name, away_team_name: teamRefs[1].name,
            status: 'scheduled', home_score: 0, away_score: 0, games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        const match1Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match1);

        const match2 = {
            week: 1, match_number: 2,
            home_team_id: teamRefs[2].id, away_team_id: teamRefs[3].id,
            home_team_name: teamRefs[2].name, away_team_name: teamRefs[3].name,
            status: 'scheduled', home_score: 0, away_score: 0, games: [],
            scheduled_date: '2025-01-20',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        const match2Ref = await db.collection('leagues').doc(LEAGUE_ID)
            .collection('matches').add(match2);

        // 4. Update league
        await db.collection('leagues').doc(LEAGUE_ID).update({
            total_weeks: 3,
            current_week: 1,
            status: 'active'
        });

        res.json({
            success: true,
            league_id: LEAGUE_ID,
            teams: teamRefs,
            matches: [
                { id: match1Ref.id, home: teamRefs[0].name, away: teamRefs[1].name },
                { id: match2Ref.id, home: teamRefs[2].name, away: teamRefs[3].name }
            ],
            message: 'Bot Battle Test League setup complete! Access with PIN: 39632911'
        });

    } catch (error) {
        console.error('Error setting up bot league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
