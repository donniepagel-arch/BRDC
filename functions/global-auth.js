/**
 * Global Player Authentication & Registration System
 * Handles PIN-based login with phone verification and rate limiting
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// Generate a unique 4-digit chosen PIN (the portion the player selects/is assigned)
// This will be combined with phone_last4 to create the full 8-digit PIN
async function generateUniqueChosenPin(phoneLast4) {
    let attempts = 0;
    while (attempts < 100) {
        // Generate random 4-digit chosen PIN (1000-9999)
        const chosenPin = String(Math.floor(1000 + Math.random() * 9000));

        // Combine with phone_last4 to create full 8-digit PIN
        const fullPin = phoneLast4 + chosenPin;

        // Check if full PIN exists
        const existing = await db.collection('players')
            .where('pin', '==', fullPin)
            .limit(1)
            .get();

        if (existing.empty) {
            return { chosenPin, fullPin };
        }
        attempts++;
    }
    throw new Error('Could not generate unique PIN');
}

// ============================================================================
// PLAYER REGISTRATION (First time = get PIN)
// ============================================================================

/**
 * Register a new player in the global system
 * Returns a PIN for future login
 */
exports.registerGlobalPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { name, email, phone, zip, isBot, botDifficulty } = req.body;

        // Validate required fields (bots don't need email)
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        if (!isBot && !email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        if (!isBot && (!phone || phone.length < 10)) {
            return res.status(400).json({ success: false, error: 'Valid phone number is required' });
        }

        const emailLower = email ? email.toLowerCase().trim() : null;
        const phoneClean = phone ? phone.replace(/\D/g, '') : null;
        const phoneLast4 = phoneClean ? phoneClean.slice(-4) : (isBot ? '0000' : null);

        // Check if player already exists (by email for humans)
        if (emailLower) {
            const existingPlayer = await db.collection('players')
                .where('email', '==', emailLower)
                .limit(1)
                .get();

            if (!existingPlayer.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'An account with this email already exists. Use your PIN to login.',
                    hint: 'Use "Forgot PIN" to recover your PIN via email'
                });
            }
        }

        // Generate unique 4-digit chosen PIN and combine with phone_last4 for full 8-digit PIN
        const { chosenPin, fullPin } = await generateUniqueChosenPin(phoneLast4);

        // Create player document
        const playerData = {
            name: name.trim(),
            email: emailLower,
            phone: phoneClean,
            phone_last4: phoneLast4,
            zip: zip || null,
            pin: fullPin,           // Full 8-digit PIN (phone_last4 + chosen_pin)
            chosen_pin: chosenPin,  // 4-digit chosen portion (for display/recovery)
            isBot: isBot || false,
            botDifficulty: botDifficulty || null,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            // Aggregated stats (updated after matches)
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: {
                    legs_played: 0,
                    legs_won: 0,
                    total_points: 0,
                    total_darts: 0,
                    ton_eighties: 0,
                    high_checkout: 0
                },
                cricket: {
                    legs_played: 0,
                    legs_won: 0,
                    total_marks: 0,
                    total_rounds: 0
                }
            },
            // Track involvements (updated when added to leagues/tournaments)
            involvements: {
                leagues: [],      // [{id, name, team_id, team_name, role}]
                tournaments: [],  // [{id, name, event_id, event_name, status}]
                directing: [],    // [{id, name, type}] - tournaments/leagues they direct
                captaining: []    // [{league_id, team_id, team_name}]
            }
        };

        const playerRef = await db.collection('players').add(playerData);

        // Return PIN to user (they need to save it!)
        res.json({
            success: true,
            player_id: playerRef.id,
            pin: fullPin,
            chosen_pin: chosenPin,
            phone_last4: phoneLast4,
            message: `Welcome ${name}! Your 8-digit PIN is ${fullPin}. Save this - you'll use it to login. (Format: ${phoneLast4} + ${chosenPin})`
        });

    } catch (error) {
        console.error('Register global player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// LOGIN WITH 8-DIGIT PIN
// ============================================================================

/**
 * Login with 8-digit PIN (phone_last4 + chosen_pin combined)
 * Includes rate limiting to prevent brute force
 */
exports.globalLogin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.body;

        if (!pin || pin.length !== 8) {
            return res.status(400).json({ success: false, error: '8-digit PIN required' });
        }

        // Check rate limiting for this PIN
        const rateLimitRef = db.collection('login_attempts').doc(pin);
        const rateLimitDoc = await rateLimitRef.get();

        if (rateLimitDoc.exists) {
            const attempts = rateLimitDoc.data();
            const lockoutUntil = attempts.lockout_until?.toDate();

            if (lockoutUntil && lockoutUntil > new Date()) {
                const minutesLeft = Math.ceil((lockoutUntil - new Date()) / 60000);
                return res.status(429).json({
                    success: false,
                    error: `Too many failed attempts. Try again in ${minutesLeft} minutes.`,
                    lockout_minutes: minutesLeft
                });
            }
        }

        // Find player by full 8-digit PIN
        const playerSnapshot = await db.collection('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        if (playerSnapshot.empty) {
            await recordFailedAttempt(rateLimitRef, rateLimitDoc);
            return res.status(401).json({ success: false, error: 'Invalid 8-digit PIN' });
        }

        const playerDoc = playerSnapshot.docs[0];
        const player = playerDoc.data();

        // Success! Clear any rate limiting
        await rateLimitRef.delete();

        // Update last login
        await playerDoc.ref.update({
            last_login: admin.firestore.FieldValue.serverTimestamp()
        });

        // Build response (don't send PIN back)
        const responsePlayer = {
            id: playerDoc.id,
            name: player.name,
            email: player.email,
            phone_last4: player.phone_last4,
            zip: player.zip,
            photo_url: player.photo_url || null,
            isBot: player.isBot || false,
            botDifficulty: player.botDifficulty || null,
            stats: player.stats || {},
            involvements: player.involvements || {},
            created_at: player.created_at,
            last_login: new Date()
        };

        res.json({
            success: true,
            player: responsePlayer,
            message: `Welcome back, ${player.name}!`
        });

    } catch (error) {
        console.error('Global login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Record a failed login attempt for rate limiting
 */
async function recordFailedAttempt(rateLimitRef, rateLimitDoc) {
    const now = admin.firestore.Timestamp.now();
    let failedCount = 1;

    if (rateLimitDoc.exists) {
        const data = rateLimitDoc.data();
        // Reset count if last attempt was over 15 minutes ago
        const lastAttempt = data.last_attempt?.toDate();
        if (lastAttempt && (new Date() - lastAttempt) > 15 * 60 * 1000) {
            failedCount = 1;
        } else {
            failedCount = (data.failed_count || 0) + 1;
        }
    }

    const updateData = {
        failed_count: failedCount,
        last_attempt: now
    };

    // Lock out after 5 failed attempts
    if (failedCount >= 5) {
        updateData.lockout_until = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        );
    }

    await rateLimitRef.set(updateData);
}

// ============================================================================
// PIN RECOVERY
// ============================================================================

/**
 * Recover PIN by email - sends PIN to email address
 */
exports.recoverPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const emailLower = email.toLowerCase().trim();

        // Find player by email
        const playerSnapshot = await db.collection('players')
            .where('email', '==', emailLower)
            .limit(1)
            .get();

        if (playerSnapshot.empty) {
            // Don't reveal if email exists or not (security)
            return res.json({
                success: true,
                message: 'If an account exists with this email, your PIN has been sent.'
            });
        }

        const player = playerSnapshot.docs[0].data();

        // Queue email notification with full 8-digit PIN
        await db.collection('notifications_queue').add({
            type: 'pin_recovery',
            to_email: emailLower,
            to_name: player.name,
            pin: player.pin,                    // Full 8-digit PIN
            chosen_pin: player.chosen_pin,      // 4-digit chosen portion
            phone_last4: player.phone_last4,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`PIN recovery requested for ${emailLower}`);

        res.json({
            success: true,
            message: 'If an account exists with this email, your 8-digit PIN has been sent.',
            // For testing only - remove in production
            debug: process.env.FUNCTIONS_EMULATOR ? { pin: player.pin, chosen_pin: player.chosen_pin, phone_last4: player.phone_last4 } : undefined
        });

    } catch (error) {
        console.error('PIN recovery error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GET PLAYER DASHBOARD DATA
// ============================================================================

/**
 * Get all dashboard data for a logged-in player
 * Includes their involvements, upcoming matches, stats, etc.
 */
exports.getDashboardData = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const playerId = req.query.player_id || req.body.player_id;

        if (!playerId) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        // Get player
        const playerDoc = await db.collection('players').doc(playerId).get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const player = playerDoc.data();
        const involvements = player.involvements || {};

        // Build dashboard data
        const dashboard = {
            player: {
                id: playerDoc.id,
                name: player.name,
                photo_url: player.photo_url,
                isBot: player.isBot,
                isAdmin: player.isAdmin || false,
                stats: player.stats
            },
            roles: {
                directing: [],
                captaining: [],
                playing: [],
                registered: []
            },
            upcoming: [],
            alerts: [],
            recent_matches: []
        };

        // Get directing involvements
        for (const dir of involvements.directing || []) {
            if (dir.type === 'tournament') {
                const tournDoc = await db.collection('tournaments').doc(dir.id).get();
                if (tournDoc.exists) {
                    const tourn = tournDoc.data();
                    dashboard.roles.directing.push({
                        id: dir.id,
                        type: 'tournament',
                        name: tourn.tournament_name,
                        status: tourn.status,
                        date: tourn.tournament_date,
                        player_count: Object.keys(tourn.players || {}).length
                    });
                }
            } else if (dir.type === 'league') {
                const leagueDoc = await db.collection('leagues').doc(dir.id).get();
                if (leagueDoc.exists) {
                    const league = leagueDoc.data();
                    dashboard.roles.directing.push({
                        id: dir.id,
                        type: 'league',
                        name: league.league_name,
                        status: league.status,
                        season: league.season
                    });
                }
            }
        }

        // Get captaining involvements
        for (const cap of involvements.captaining || []) {
            const leagueDoc = await db.collection('leagues').doc(cap.league_id).get();
            if (leagueDoc.exists) {
                const league = leagueDoc.data();
                dashboard.roles.captaining.push({
                    league_id: cap.league_id,
                    league_name: league.league_name,
                    team_id: cap.team_id,
                    team_name: cap.team_name,
                    status: league.status
                });
            }
        }

        // Get playing involvements (leagues)
        for (const lg of involvements.leagues || []) {
            const leagueDoc = await db.collection('leagues').doc(lg.id).get();
            if (leagueDoc.exists) {
                const league = leagueDoc.data();
                dashboard.roles.playing.push({
                    type: 'league',
                    id: lg.id,
                    name: league.league_name,
                    team_id: lg.team_id,
                    team_name: lg.team_name,
                    status: league.status,
                    season: league.season
                });
            }
        }

        // Get tournament registrations
        for (const tourn of involvements.tournaments || []) {
            const tournDoc = await db.collection('tournaments').doc(tourn.id).get();
            if (tournDoc.exists) {
                const tournament = tournDoc.data();
                dashboard.roles.registered.push({
                    type: 'tournament',
                    id: tourn.id,
                    name: tournament.tournament_name,
                    event_id: tourn.event_id,
                    event_name: tourn.event_name,
                    date: tournament.tournament_date,
                    status: tournament.status
                });
            }
        }

        res.json({
            success: true,
            dashboard
        });

    } catch (error) {
        console.error('Get dashboard data error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// UPDATE PLAYER PROFILE
// ============================================================================

/**
 * Update player profile (name, email, phone, zip, photo)
 */
exports.updateGlobalPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, name, email, phone, zip, photo_url } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        const playerRef = db.collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const updates = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (name) updates.name = name.trim();
        if (email) updates.email = email.toLowerCase().trim();
        if (phone) {
            updates.phone = phone.replace(/\D/g, '');
            updates.phone_last4 = phone.slice(-4);
        }
        if (zip) updates.zip = zip;
        if (photo_url) updates.photo_url = photo_url;

        await playerRef.update(updates);

        res.json({
            success: true,
            message: 'Profile updated'
        });

    } catch (error) {
        console.error('Update global player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// ADD PLAYER INVOLVEMENT (called when added to league/tournament)
// ============================================================================

/**
 * Add a league involvement to a player's profile
 */
exports.addLeagueInvolvement = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, league_id, league_name, team_id, team_name, role } = req.body;

        if (!player_id || !league_id) {
            return res.status(400).json({ success: false, error: 'player_id and league_id required' });
        }

        const playerRef = db.collection('players').doc(player_id);

        await playerRef.update({
            'involvements.leagues': admin.firestore.FieldValue.arrayUnion({
                id: league_id,
                name: league_name,
                team_id: team_id || null,
                team_name: team_name || null,
                role: role || 'player',
                added_at: new Date().toISOString()
            }),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'League involvement added' });

    } catch (error) {
        console.error('Add league involvement error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Add a tournament involvement to a player's profile
 */
exports.addTournamentInvolvement = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, tournament_id, tournament_name, event_id, event_name } = req.body;

        if (!player_id || !tournament_id) {
            return res.status(400).json({ success: false, error: 'player_id and tournament_id required' });
        }

        const playerRef = db.collection('players').doc(player_id);

        await playerRef.update({
            'involvements.tournaments': admin.firestore.FieldValue.arrayUnion({
                id: tournament_id,
                name: tournament_name,
                event_id: event_id || null,
                event_name: event_name || null,
                status: 'registered',
                registered_at: new Date().toISOString()
            }),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Tournament involvement added' });

    } catch (error) {
        console.error('Add tournament involvement error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CREATE BOT WITH SPECIFIC PIN (admin function)
// ============================================================================

/**
 * Create a bot player with a specific PIN
 * Used for setting up test bots with memorable PINs
 * Bots use "0000" as phone_last4 + 4-digit chosen PIN = 8 digits total
 */
exports.createBotPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { name, pin, botDifficulty } = req.body;

        if (!name || !pin || !botDifficulty) {
            return res.status(400).json({ success: false, error: 'name, pin, and botDifficulty required' });
        }

        if (pin.length !== 8) {
            return res.status(400).json({ success: false, error: 'PIN must be 8 digits (0000 + 4-digit chosen PIN)' });
        }

        // Validate that bot PINs start with 0000
        if (!pin.startsWith('0000')) {
            return res.status(400).json({ success: false, error: 'Bot PIN must start with 0000' });
        }

        // Extract the chosen PIN portion (last 4 digits)
        const chosenPin = pin.slice(-4);

        // Check if PIN already exists
        const existingPin = await db.collection('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        if (!existingPin.empty) {
            return res.status(400).json({ success: false, error: 'PIN already in use' });
        }

        // Check if bot name already exists
        const existingName = await db.collection('players')
            .where('name', '==', name)
            .where('isBot', '==', true)
            .limit(1)
            .get();

        if (!existingName.empty) {
            return res.status(400).json({ success: false, error: 'Bot with this name already exists' });
        }

        // Bot difficulty config
        const difficultyConfig = {
            easy: { x01_avg: 40, cricket_mpr: 1.5 },
            medium: { x01_avg: 55, cricket_mpr: 2.0 },
            league: { x01_avg: 65, cricket_mpr: 2.5 },
            hard: { x01_avg: 75, cricket_mpr: 3.0 },
            pro: { x01_avg: 90, cricket_mpr: 3.5 }
        };

        const config = difficultyConfig[botDifficulty] || difficultyConfig.medium;

        const botData = {
            name: name,
            email: null,
            phone: null,
            phone_last4: '0000',
            zip: null,
            pin: pin,               // Full 8-digit PIN
            chosen_pin: chosenPin,  // 4-digit chosen portion
            isBot: true,
            botDifficulty: botDifficulty,
            botConfig: config,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: {
                    legs_played: 0,
                    legs_won: 0,
                    total_points: 0,
                    total_darts: 0,
                    ton_eighties: 0,
                    high_checkout: 0
                },
                cricket: {
                    legs_played: 0,
                    legs_won: 0,
                    total_marks: 0,
                    total_rounds: 0
                }
            },
            involvements: {
                leagues: [],
                tournaments: [],
                directing: [],
                captaining: []
            }
        };

        const botRef = await db.collection('players').add(botData);

        res.json({
            success: true,
            player_id: botRef.id,
            name: name,
            pin: pin,
            chosen_pin: chosenPin,
            phone_last4: '0000',
            difficulty: botDifficulty,
            message: `Bot "${name}" created with 8-digit PIN ${pin} (0000 + ${chosenPin})`
        });

    } catch (error) {
        console.error('Create bot player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GET ALL PLAYERS (for selection lists)
// ============================================================================

/**
 * Get all players (for adding to tournaments/leagues)
 * Supports filtering by name search
 */
exports.getAllPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const search = (req.query.search || req.body.search || '').toLowerCase().trim();
        const includeBots = req.query.include_bots !== 'false';
        const limitNum = parseInt(req.query.limit || '100');

        let query = db.collection('players').orderBy('name').limit(limitNum);

        const snapshot = await query.get();
        let players = [];

        snapshot.forEach(doc => {
            const player = doc.data();

            // Filter by search if provided
            if (search && !player.name.toLowerCase().includes(search)) {
                return;
            }

            // Filter bots if requested
            if (!includeBots && player.isBot) {
                return;
            }

            players.push({
                id: doc.id,
                name: player.name,
                email: player.email,
                phone_last4: player.phone_last4,
                zip: player.zip,
                photo_url: player.photo_url,
                isBot: player.isBot || false,
                botDifficulty: player.botDifficulty,
                stats: player.stats
            });
        });

        res.json({
            success: true,
            players: players,
            count: players.length
        });

    } catch (error) {
        console.error('Get all players error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
