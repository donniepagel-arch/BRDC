/**
 * Global Player Authentication & Registration System
 * Handles PIN-based login with phone verification and rate limiting
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Twilio setup for SMS
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

// SendGrid setup for emails (backup)
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@brdc-darts.com';

let twilioClient = null;
let sgMail = null;

try {
    if (TWILIO_SID && TWILIO_TOKEN) {
        twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
    }
} catch (e) {
    console.log('Twilio not configured in global-auth');
}

try {
    if (SENDGRID_API_KEY) {
        sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_API_KEY);
    }
} catch (e) {
    console.log('SendGrid not configured in global-auth');
}

async function sendWelcomeSMS(phone, name, pin) {
    if (!twilioClient) {
        console.log('Welcome SMS (simulated):', { phone, name, pin });
        return { success: true, simulated: true };
    }

    try {
        const message = `BRDC: Welcome ${name}! Your player PIN is ${pin}. Use this to log in and track your stats. Save this number!`;
        const result = await twilioClient.messages.create({
            body: message,
            to: phone.startsWith('+') ? phone : '+1' + phone.replace(/\D/g, ''),
            from: TWILIO_PHONE
        });
        return { success: true, sid: result.sid };
    } catch (err) {
        console.error('Welcome SMS error:', err);
        return { success: false, error: err.message };
    }
}

async function sendWelcomeEmail(email, name, pin) {
    if (!sgMail) {
        console.log('Welcome email (simulated):', { email, name, pin });
        return { success: true, simulated: true };
    }

    const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#fff;padding:30px;border-radius:12px;">
            <div style="text-align:center;margin-bottom:30px;">
                <h1 style="color:#FF469A;margin:0;">BRDC</h1>
                <p style="color:#91D7EB;margin:5px 0;">Burning River Dart Club</p>
            </div>
            <h2 style="color:#10b981;text-align:center;">Welcome to BRDC!</h2>
            <p>Hi ${name},</p>
            <p>Your player account has been created successfully. You can now play games and track your stats!</p>
            <div style="background:linear-gradient(135deg,#FF469A22,#91D7EB22);padding:20px;border-radius:8px;border-left:4px solid #FF469A;margin:20px 0;">
                <h3 style="color:#FDD835;margin-top:0;">Your Player PIN</h3>
                <p style="font-size:32px;font-weight:bold;text-align:center;color:#91D7EB;letter-spacing:8px;margin:10px 0;">${pin}</p>
                <p style="font-size:12px;text-align:center;color:#a0a0b0;">Use this PIN to log in at the game setup page</p>
            </div>
            <p>Keep this PIN safe - you'll need it to access your player profile and track your stats.</p>
            <hr style="border:1px solid rgba(255,255,255,0.1);margin:30px 0;">
            <p style="color:#a0a0b0;font-size:12px;text-align:center;">Burning River Dart Club | Cleveland, OH</p>
        </div>
    `;

    const textVersion = `Welcome to BRDC!\n\nHi ${name},\n\nYour player account has been created.\n\nYour Player PIN: ${pin}\n\nUse this PIN to log in and track your stats.\n\nBurning River Dart Club`;

    try {
        await sgMail.send({
            to: email,
            from: FROM_EMAIL,
            subject: 'Welcome to BRDC - Your Player PIN',
            html: emailHtml,
            text: textVersion
        });
        return { success: true };
    } catch (err) {
        console.error('Welcome email error:', err);
        return { success: false, error: err.message };
    }
}

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

/**
 * Register a new player with user-chosen PIN
 * Used by register.html for self-service registration
 */
exports.registerPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { first_name, last_name, email, phone, chosen_pin, photo_url } = req.body;

        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({ success: false, error: 'First name and last name are required' });
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        if (!phone || phone.length < 10) {
            return res.status(400).json({ success: false, error: 'Valid phone number is required' });
        }

        if (!chosen_pin || chosen_pin.length !== 4 || !/^\d{4}$/.test(chosen_pin)) {
            return res.status(400).json({ success: false, error: 'Please enter a 4-digit PIN' });
        }

        const emailLower = email.toLowerCase().trim();
        const phoneClean = phone.replace(/\D/g, '');
        const phoneLast4 = phoneClean.slice(-4);
        const fullName = `${first_name.trim()} ${last_name.trim()}`;

        // Check if player already exists (by email)
        const existingPlayer = await db.collection('players')
            .where('email', '==', emailLower)
            .limit(1)
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({
                success: false,
                error: 'An account with this email already exists. Use your PIN to login.'
            });
        }

        // Create full 8-digit PIN (phone_last4 + chosen_pin)
        const fullPin = phoneLast4 + chosen_pin;

        // Check if PIN is already taken
        const existingPin = await db.collection('players')
            .where('pin', '==', fullPin)
            .limit(1)
            .get();

        if (!existingPin.empty) {
            return res.status(400).json({
                success: false,
                error: 'This PIN combination is already taken. Please choose a different 4-digit PIN.'
            });
        }

        // Create player document
        const playerData = {
            name: fullName,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: emailLower,
            phone: phoneClean,
            phone_last4: phoneLast4,
            pin: fullPin,
            chosen_pin: chosen_pin,
            photo_url: photo_url || null,
            isBot: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
            },
            involvements: { leagues: [], tournaments: [], directing: [], captaining: [] }
        };

        const playerRef = await db.collection('players').add(playerData);

        res.json({
            success: true,
            player_id: playerRef.id,
            pin: fullPin,
            message: `Welcome ${fullName}! Your 8-digit PIN is ${fullPin}. Save this - you'll use it to login.`
        });

    } catch (error) {
        console.error('Register player error:', error);
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

        // Find player by full 8-digit PIN - check global first, then league players
        let playerSnapshot = await db.collection('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        let playerDoc = null;
        let player = null;
        let sourceType = 'global'; // Track where we found the player
        let leagueId = null;

        if (!playerSnapshot.empty) {
            playerDoc = playerSnapshot.docs[0];
            player = playerDoc.data();
        } else {
            // Not found globally - search league players
            const leaguesSnapshot = await db.collection('leagues').get();

            for (const leagueDoc of leaguesSnapshot.docs) {
                const leaguePlayerSnapshot = await db.collection('leagues')
                    .doc(leagueDoc.id)
                    .collection('players')
                    .where('pin', '==', pin)
                    .limit(1)
                    .get();

                if (!leaguePlayerSnapshot.empty) {
                    playerDoc = leaguePlayerSnapshot.docs[0];
                    player = playerDoc.data();
                    sourceType = 'league';
                    leagueId = leagueDoc.id;
                    break;
                }
            }
        }

        if (!player) {
            await recordFailedAttempt(rateLimitRef, rateLimitDoc);
            return res.status(401).json({ success: false, error: 'Invalid 8-digit PIN' });
        }

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
            phone_last4: player.phone_last4 || (player.phone ? player.phone.slice(-4) : null),
            zip: player.zip,
            photo_url: player.photo_url || null,
            isBot: player.isBot || false,
            botDifficulty: player.botDifficulty || null,
            stats: player.stats || player.unified_stats || {},
            involvements: player.involvements || {},
            created_at: player.created_at || player.registered_at,
            last_login: new Date(),
            // Track source for dashboard
            source_type: sourceType,
            league_id: leagueId,
            team_id: player.team_id || null,
            position: player.position || null
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
 * Supports both global players and league-only players
 */
exports.getDashboardData = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const playerId = req.query.player_id || req.body.player_id;
        const sourceType = req.query.source_type || req.body.source_type || 'global';
        const leagueId = req.query.league_id || req.body.league_id;

        if (!playerId) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        // Get player based on source type
        let playerDoc;
        let player;
        let playerLeagueId = leagueId;

        if (sourceType === 'league' && leagueId) {
            // Player is in a league's players subcollection
            playerDoc = await db.collection('leagues').doc(leagueId).collection('players').doc(playerId).get();
        } else {
            // Try global first
            playerDoc = await db.collection('players').doc(playerId).get();
        }

        if (!playerDoc.exists) {
            // Fallback: search all leagues for this player
            const leaguesSnapshot = await db.collection('leagues').get();

            for (const leagueDoc of leaguesSnapshot.docs) {
                const leaguePlayerDoc = await db.collection('leagues')
                    .doc(leagueDoc.id)
                    .collection('players')
                    .doc(playerId)
                    .get();

                if (leaguePlayerDoc.exists) {
                    playerDoc = leaguePlayerDoc;
                    playerLeagueId = leagueDoc.id;
                    break;
                }
            }

            if (!playerDoc || !playerDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }
        }

        player = playerDoc.data();
        const involvements = player.involvements || {};

        // Use unified_stats for league players, stats for global players
        let playerStats = player.stats || player.unified_stats || {};

        // If global player has empty stats, try to fetch from their league involvement
        const hasStats = playerStats && (
            (playerStats.totals && playerStats.totals.legs_played > 0) ||
            (playerStats.x01 && playerStats.x01.legs_played > 0) ||
            (playerStats.matches_played > 0)
        );

        // Search by PIN (more reliable than name) or name as fallback
        const searchPin = player.pin;
        const searchName = player.name;

        if (!hasStats && involvements.leagues && involvements.leagues.length > 0) {
            // Try to get stats from league involvements - check STATS collection
            for (const league of involvements.leagues) {
                try {
                    // Try by PIN first to find player ID
                    let leaguePlayerDoc = searchPin ? await db.collection('leagues')
                        .doc(league.id)
                        .collection('players')
                        .where('pin', '==', searchPin)
                        .limit(1)
                        .get() : { empty: true };

                    // Fallback to name
                    if (leaguePlayerDoc.empty) {
                        leaguePlayerDoc = await db.collection('leagues')
                            .doc(league.id)
                            .collection('players')
                            .where('name', '==', searchName)
                            .limit(1)
                            .get();
                    }

                    if (!leaguePlayerDoc.empty) {
                        const leaguePlayerId = leaguePlayerDoc.docs[0].id;

                        // Check the STATS collection for this player
                        const statsDoc = await db.collection('leagues')
                            .doc(league.id)
                            .collection('stats')
                            .doc(leaguePlayerId)
                            .get();

                        if (statsDoc.exists) {
                            const stats = statsDoc.data();
                            if (stats.x01_legs_played > 0 || stats.cricket_legs_played > 0) {
                                playerStats = stats;
                                console.log('Found league stats for', searchName, 'in league', league.id);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log('Could not fetch league stats:', e.message);
                }
            }
        }

        // Also try fetching by director involvement if still no stats
        const stillNoStats = !playerStats || !(
            (playerStats.totals && playerStats.totals.legs_played > 0) ||
            (playerStats.x01 && playerStats.x01.legs_played > 0)
        );

        if (stillNoStats && involvements.directing && involvements.directing.length > 0) {
            for (const dir of involvements.directing) {
                if (dir.type === 'league') {
                    try {
                        // Try by PIN first to find player ID
                        let leaguePlayerDoc = searchPin ? await db.collection('leagues')
                            .doc(dir.id)
                            .collection('players')
                            .where('pin', '==', searchPin)
                            .limit(1)
                            .get() : { empty: true };

                        // Fallback to name
                        if (leaguePlayerDoc.empty) {
                            leaguePlayerDoc = await db.collection('leagues')
                                .doc(dir.id)
                                .collection('players')
                                .where('name', '==', searchName)
                                .limit(1)
                                .get();
                        }

                        if (!leaguePlayerDoc.empty) {
                            const leaguePlayerId = leaguePlayerDoc.docs[0].id;

                            // Check the STATS collection for this player
                            const statsDoc = await db.collection('leagues')
                                .doc(dir.id)
                                .collection('stats')
                                .doc(leaguePlayerId)
                                .get();

                            if (statsDoc.exists) {
                                const stats = statsDoc.data();
                                if (stats.x01_legs_played > 0 || stats.cricket_legs_played > 0) {
                                    playerStats = stats;
                                    console.log('Found director league stats for', searchName, 'in league', dir.id);
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Could not fetch director league stats:', e.message);
                    }
                }
            }
        }

        // Last resort: search ALL leagues for this player's stats in the STATS collection
        const finalNoStats = !playerStats || !(
            (playerStats.totals && playerStats.totals.legs_played > 0) ||
            (playerStats.x01 && playerStats.x01.legs_played > 0) ||
            (playerStats.x01_legs_played > 0)
        );

        if (finalNoStats) {
            console.log('Searching all leagues stats collections for', searchName);
            const allLeagues = await db.collection('leagues').get();
            for (const leagueDoc of allLeagues.docs) {
                try {
                    // First find the player in the league's players collection
                    let leaguePlayerDoc = searchPin ? await db.collection('leagues')
                        .doc(leagueDoc.id)
                        .collection('players')
                        .where('pin', '==', searchPin)
                        .limit(1)
                        .get() : { empty: true };

                    // Fallback to name
                    if (leaguePlayerDoc.empty) {
                        leaguePlayerDoc = await db.collection('leagues')
                            .doc(leagueDoc.id)
                            .collection('players')
                            .where('name', '==', searchName)
                            .limit(1)
                            .get();
                    }

                    if (!leaguePlayerDoc.empty) {
                        const leaguePlayerId = leaguePlayerDoc.docs[0].id;

                        // Now check the STATS collection for this player
                        const statsDoc = await db.collection('leagues')
                            .doc(leagueDoc.id)
                            .collection('stats')
                            .doc(leaguePlayerId)
                            .get();

                        if (statsDoc.exists) {
                            const stats = statsDoc.data();
                            if (stats.x01_legs_played > 0 || stats.cricket_legs_played > 0) {
                                playerStats = stats;
                                console.log('Found stats in league', leagueDoc.id, 'stats collection for', searchName);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log('Error searching league', leagueDoc.id, ':', e.message);
                }
            }
        }

        // Build dashboard data
        const dashboard = {
            player: {
                id: playerDoc.id,
                name: player.name,
                first_name: player.first_name || '',
                last_name: player.last_name || '',
                phone: player.phone || '',
                email: player.email || '',
                photo_url: player.photo_url,
                isBot: player.isBot,
                isAdmin: player.isAdmin || false,
                stats: playerStats,
                privacy: player.privacy || {},
                notifications: player.notifications || {},
                source_type: sourceType,
                league_id: playerLeagueId,
                team_id: player.team_id || null,
                position: player.position || null
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

        // For league-only players, add their league involvement automatically
        if (playerLeagueId && sourceType === 'league') {
            const leagueDoc = await db.collection('leagues').doc(playerLeagueId).get();
            if (leagueDoc.exists) {
                const league = leagueDoc.data();
                // Find their team name if they have a team_id
                let teamName = null;
                let isLevelA = false;

                if (player.team_id) {
                    // Get team from subcollection
                    const teamDoc = await db.collection('leagues').doc(playerLeagueId)
                        .collection('teams').doc(player.team_id).get();
                    if (teamDoc.exists) {
                        const team = teamDoc.data();
                        teamName = team.team_name || team.name;

                        // Check if player is captain or level A using player's own fields
                        // (teams may not have player_ids/captain_id arrays - data is on player doc)
                        const isCaptain = player.is_captain === true;
                        isLevelA = player.preferred_level === 'A' || player.position === 1;

                        // Fallback: check team arrays if they exist
                        if (!isCaptain && !isLevelA) {
                            const playerIds = team.player_ids || [];
                            const playerLevels = team.player_levels || [];
                            const playerIndex = playerIds.indexOf(playerId);
                            if (playerIndex !== -1 && playerLevels[playerIndex] === 'A') {
                                isLevelA = true;
                            }
                            if (team.captain_id === playerId) {
                                // Using isCaptain from player doc above
                            }
                        }

                        if (isCaptain || isLevelA) {
                            dashboard.roles.captaining.push({
                                league_id: playerLeagueId,
                                league_name: league.league_name,
                                team_id: player.team_id,
                                team_name: teamName,
                                status: league.status
                            });
                        }
                    }
                }

                dashboard.roles.playing.push({
                    type: 'league',
                    id: playerLeagueId,
                    name: league.league_name,
                    team_id: player.team_id || null,
                    team_name: teamName,
                    status: league.status,
                    season: league.season,
                    position: player.position
                });
            }
        }

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

                // Check if player is captain or level A on their team - they get captain privileges
                if (lg.team_id) {
                    const teamDoc = await db.collection('leagues').doc(lg.id).collection('teams').doc(lg.team_id).get();
                    if (teamDoc.exists) {
                        const team = teamDoc.data();
                        const playerIds = team.player_ids || [];
                        const playerNames = team.player_names || [];
                        const playerLevels = team.player_levels || [];

                        // Try to find player by ID first
                        let playerIndex = playerIds.indexOf(playerId);

                        // If not found by ID, try matching by name (handles ID mismatch)
                        const playerName = player.name?.toLowerCase().trim();
                        if (playerIndex === -1 && playerName) {
                            playerIndex = playerNames.findIndex(n =>
                                n?.toLowerCase().trim() === playerName
                            );
                        }

                        // Check if captain by captain_id OR by level A
                        const teamPlayerId = playerIndex !== -1 ? playerIds[playerIndex] : null;
                        const isCaptain = team.captain_id === playerId || team.captain_id === teamPlayerId;
                        const isLevelA = playerIndex !== -1 && playerLevels[playerIndex] === 'A';

                        if (isCaptain || isLevelA) {
                            // Captain or A-level player gets captain access - check if not already added
                            const alreadyCaptain = dashboard.roles.captaining.some(
                                c => c.league_id === lg.id && c.team_id === lg.team_id
                            );
                            if (!alreadyCaptain) {
                                dashboard.roles.captaining.push({
                                    league_id: lg.id,
                                    league_name: league.league_name,
                                    team_id: lg.team_id,
                                    team_name: lg.team_name || team.team_name,
                                    status: league.status
                                });
                            }
                        }
                    }
                }
            }
        }

        // FALLBACK: If no captaining roles found, check league players directly
        // This handles the case where teams don't have player_ids/captain_id arrays
        // Instead, players have team_id and is_captain fields on their player doc
        if (dashboard.roles.captaining.length === 0) {
            try {
                const playerName = player.name?.toLowerCase().trim();

                // Search all active leagues for this player
                const allLeagues = await db.collection('leagues')
                    .where('status', 'in', ['active', 'in_progress'])
                    .get();

                for (const leagueDoc of allLeagues.docs) {
                    const league = leagueDoc.data();

                    // Search league players by name
                    const leaguePlayersSnap = await db.collection('leagues')
                        .doc(leagueDoc.id)
                        .collection('players')
                        .where('name', '==', player.name)
                        .get();

                    for (const lpDoc of leaguePlayersSnap.docs) {
                        const leaguePlayer = lpDoc.data();

                        // Check if this player is captain or level A
                        const isCaptain = leaguePlayer.is_captain === true;
                        const isLevelA = leaguePlayer.preferred_level === 'A' || leaguePlayer.position === 1;

                        if ((isCaptain || isLevelA) && leaguePlayer.team_id) {
                            // Get team info
                            const teamDoc = await db.collection('leagues')
                                .doc(leagueDoc.id)
                                .collection('teams')
                                .doc(leaguePlayer.team_id)
                                .get();

                            const teamName = teamDoc.exists ? (teamDoc.data().team_name || teamDoc.data().name) : 'Unknown Team';

                            // Check not already added
                            const alreadyCaptain = dashboard.roles.captaining.some(
                                c => c.league_id === leagueDoc.id && c.team_id === leaguePlayer.team_id
                            );
                            if (!alreadyCaptain) {
                                dashboard.roles.captaining.push({
                                    league_id: leagueDoc.id,
                                    league_name: league.league_name,
                                    team_id: leaguePlayer.team_id,
                                    team_name: teamName,
                                    status: league.status
                                });
                            }

                            // Also add to playing_on if not already there
                            const alreadyPlaying = dashboard.roles.playing_on?.some(
                                p => p.league_id === leagueDoc.id && p.team_id === leaguePlayer.team_id
                            );
                            if (!alreadyPlaying) {
                                if (!dashboard.roles.playing_on) dashboard.roles.playing_on = [];
                                const teamData = teamDoc.exists ? teamDoc.data() : {};
                                dashboard.roles.playing_on.push({
                                    league_id: leagueDoc.id,
                                    league_name: league.league_name,
                                    team_id: leaguePlayer.team_id,
                                    team_name: teamName,
                                    status: league.status,
                                    record: `${teamData.wins || 0}-${teamData.losses || 0}`
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error in fallback captain search:', e.message);
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
 * Update player profile (name, email, phone, zip, photo, privacy, notifications, profile fields)
 * Supports both combined 'name' and separate 'first_name'/'last_name' fields
 */
exports.updateGlobalPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const {
            player_id, name, first_name, last_name, email, phone, zip, photo_url,
            privacy, notifications,
            bio, home_bar, preferred_game, dartconnect_id
        } = req.body;

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

        // Handle name - either combined or separate fields
        if (name) {
            updates.name = name.trim();
        } else if (first_name !== undefined || last_name !== undefined) {
            const currentData = playerDoc.data();
            const newFirst = first_name !== undefined ? first_name.trim() : currentData.first_name;
            const newLast = last_name !== undefined ? last_name.trim() : currentData.last_name;

            if (first_name !== undefined) updates.first_name = newFirst;
            if (last_name !== undefined) updates.last_name = newLast;
            updates.name = `${newFirst} ${newLast}`.trim();
        }

        if (email !== undefined) {
            updates.email = email ? email.toLowerCase().trim() : '';
        }
        if (phone !== undefined) {
            const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
            updates.phone = cleanPhone;
            updates.phone_last4 = cleanPhone ? cleanPhone.slice(-4) : '';
        }
        if (zip) updates.zip = zip;
        if (photo_url) updates.photo_url = photo_url;

        // Profile fields
        if (bio !== undefined) updates.bio = (bio || '').slice(0, 200);
        if (home_bar !== undefined) updates.home_bar = (home_bar || '').slice(0, 100);
        if (preferred_game !== undefined) updates.preferred_game = preferred_game || '';
        if (dartconnect_id !== undefined) updates.dartconnect_id = (dartconnect_id || '').trim();

        // Handle privacy settings
        if (privacy && typeof privacy === 'object') {
            const validSettings = ['show_phone', 'show_email', 'show_stats', 'allow_messages'];
            for (const key of validSettings) {
                if (privacy[key] !== undefined) {
                    updates[`privacy.${key}`] = Boolean(privacy[key]);
                }
            }
        }

        // Handle notification settings
        if (notifications && typeof notifications === 'object') {
            const validNotifications = ['sms', 'email', 'push'];
            for (const key of validNotifications) {
                if (notifications[key] !== undefined) {
                    updates[`notifications.${key}`] = Boolean(notifications[key]);
                }
            }
        }

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

/**
 * Update player privacy settings
 */
exports.updatePlayerPrivacy = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, privacy } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        if (!privacy || typeof privacy !== 'object') {
            return res.status(400).json({ success: false, error: 'privacy settings required' });
        }

        const playerRef = db.collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Validate and sanitize privacy settings
        const validSettings = ['show_phone', 'show_email', 'show_stats', 'allow_messages'];
        const updates = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        for (const key of validSettings) {
            if (privacy[key] !== undefined) {
                updates[`privacy.${key}`] = Boolean(privacy[key]);
            }
        }

        await playerRef.update(updates);

        res.json({
            success: true,
            message: 'Privacy settings updated'
        });

    } catch (error) {
        console.error('Update player privacy error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GENERATE NEW PIN
// ============================================================================

/**
 * Generate a new PIN for a player (old PIN stops working immediately)
 */
exports.generateNewPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        const playerRef = db.collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Generate new 8-digit PIN
        const newPin = String(Math.floor(10000000 + Math.random() * 90000000));

        // Check for uniqueness
        const existingCheck = await db.collection('players').where('pin', '==', newPin).get();
        if (!existingCheck.empty) {
            // Extremely rare collision, try again
            const retryPin = String(Math.floor(10000000 + Math.random() * 90000000));
            await playerRef.update({
                pin: retryPin,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.json({ success: true, new_pin: retryPin });
        }

        await playerRef.update({
            pin: newPin,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            new_pin: newPin
        });

    } catch (error) {
        console.error('Generate new PIN error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// DELETE PLAYER ACCOUNT
// ============================================================================

/**
 * Permanently delete a player's account and all associated data
 */
exports.deletePlayerAccount = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, confirmation } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        if (confirmation !== 'DELETE') {
            return res.status(400).json({ success: false, error: 'Confirmation required' });
        }

        const playerRef = db.collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const playerData = playerDoc.data();

        // Remove player from any league rosters
        if (playerData.involvements && playerData.involvements.leagues) {
            for (const league of playerData.involvements.leagues) {
                try {
                    // Remove from league players collection
                    const leaguePlayersQuery = await db.collection('leagues')
                        .doc(league.id)
                        .collection('players')
                        .where('player_id', '==', player_id)
                        .get();

                    for (const doc of leaguePlayersQuery.docs) {
                        await doc.ref.delete();
                    }
                } catch (e) {
                    console.log('Error removing from league:', league.id, e.message);
                }
            }
        }

        // Delete the player document
        await playerRef.delete();

        console.log(`Deleted player account: ${player_id} (${playerData.name})`);

        res.json({
            success: true,
            message: 'Account deleted'
        });

    } catch (error) {
        console.error('Delete player account error:', error);
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

        // Fetch league name if not provided
        let finalLeagueName = league_name;
        if (!finalLeagueName) {
            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (leagueDoc.exists) {
                finalLeagueName = leagueDoc.data().league_name || 'Unknown League';
            } else {
                finalLeagueName = 'Unknown League';
            }
        }

        const playerRef = db.collection('players').doc(player_id);

        // If role is 'directing', add to involvements.directing instead
        if (role === 'directing') {
            await playerRef.update({
                'involvements.directing': admin.firestore.FieldValue.arrayUnion({
                    id: league_id,
                    name: finalLeagueName,
                    type: 'league',
                    status: 'active',
                    added_at: new Date().toISOString()
                }),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await playerRef.update({
                'involvements.leagues': admin.firestore.FieldValue.arrayUnion({
                    id: league_id,
                    name: finalLeagueName,
                    team_id: team_id || null,
                    team_name: team_name || null,
                    role: role || 'player',
                    added_at: new Date().toISOString()
                }),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({ success: true, message: 'League involvement added', role: role || 'player' });

    } catch (error) {
        console.error('Add league involvement error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update an existing league involvement (e.g., add team info)
 */
exports.updateLeagueInvolvement = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, league_id, team_id, team_name } = req.body;

        if (!player_id || !league_id) {
            return res.status(400).json({ success: false, error: 'player_id and league_id required' });
        }

        const playerRef = db.collection('players').doc(player_id);
        const playerDoc = await playerRef.get();

        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const involvements = playerDoc.data().involvements || {};
        const leagues = involvements.leagues || [];

        // Find and update the league involvement
        const updatedLeagues = leagues.map(league => {
            if (league.id === league_id) {
                return {
                    ...league,
                    team_id: team_id || league.team_id,
                    team_name: team_name || league.team_name
                };
            }
            return league;
        });

        await playerRef.update({
            'involvements.leagues': updatedLeagues,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'League involvement updated' });

    } catch (error) {
        console.error('Update league involvement error:', error);
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
            easy: { x01_three_dart_avg: 40, cricket_mpr: 1.5 },
            medium: { x01_three_dart_avg: 55, cricket_mpr: 2.0 },
            league: { x01_three_dart_avg: 65, cricket_mpr: 2.5 },
            hard: { x01_three_dart_avg: 75, cricket_mpr: 3.0 },
            pro: { x01_three_dart_avg: 90, cricket_mpr: 3.5 }
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

// ============================================================================
// DEBUG CAPTAIN FUNCTION (temporary)
// REMOVED: Debug function - uncomment if needed for troubleshooting
// ============================================================================
// exports.debugCaptain = functions.https.onRequest(async (req, res) => { ... });

// ============================================================================
// UPDATE PLAYER SETTINGS
// ============================================================================

/**
 * Update player settings (notification preference, etc.)
 */
exports.updatePlayerSettings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { player_id, updates } = req.body;

        if (!player_id) {
            return res.status(400).json({ success: false, error: 'player_id required' });
        }

        // Get player doc to verify it exists
        const playerDoc = await db.collection('players').doc(player_id).get();
        if (!playerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        // Allowed updates
        const allowedUpdates = {};

        if (updates.notification_preference !== undefined) {
            if (['sms', 'email', 'both', 'none'].includes(updates.notification_preference)) {
                allowedUpdates.notification_preference = updates.notification_preference;
            }
        }

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid updates provided' });
        }

        allowedUpdates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('players').doc(player_id).update(allowedUpdates);

        res.json({ success: true, message: 'Settings updated' });

    } catch (error) {
        console.error('Update player settings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// SIMPLE PLAYER REGISTRATION (Auto-generate PIN, send via email)
// ============================================================================

/**
 * Generate a unique 8-digit PIN using phone last 4 + 4 random digits
 */
async function generateUniquePinWithPhone(phoneLast4) {
    let attempts = 0;
    while (attempts < 100) {
        // Generate 4 random digits (1000-9999)
        const randomPart = String(Math.floor(1000 + Math.random() * 9000));
        // PIN = phone last 4 + 4 random digits
        const pin = phoneLast4 + randomPart;

        // Check if PIN exists in players collection
        const existingPlayer = await db.collection('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        // Also check bots collection
        const existingBot = await db.collection('bots')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        if (existingPlayer.empty && existingBot.empty) {
            return pin;
        }
        attempts++;
    }
    throw new Error('Could not generate unique PIN');
}

/**
 * Generate a unique 8-digit PIN (fully random, no phone dependency)
 */
async function generateUniqueFullPin() {
    let attempts = 0;
    while (attempts < 100) {
        // Generate full 8-digit random PIN
        const pin = String(Math.floor(10000000 + Math.random() * 90000000));

        // Check if PIN exists
        const existingPlayer = await db.collection('players')
            .where('pin', '==', pin)
            .limit(1)
            .get();

        if (existingPlayer.empty) {
            return pin;
        }
        attempts++;
    }
    throw new Error('Could not generate unique PIN');
}

/**
 * Register new player from signup page
 * Auto-generates 8-digit PIN, phone is optional
 */
exports.registerNewPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { first_name, last_name, email, phone, preferred_level } = req.body;

        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({ success: false, error: 'First name and last name are required' });
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const emailLower = email.toLowerCase().trim();
        const fullName = `${first_name.trim()} ${last_name.trim()}`;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
        }

        // Check if player already exists (by email)
        const existingByEmail = await db.collection('players')
            .where('email', '==', emailLower)
            .limit(1)
            .get();

        if (!existingByEmail.empty) {
            return res.status(400).json({
                success: false,
                error: 'An account with this email already exists. Use your PIN to login.'
            });
        }

        // Clean phone if provided
        let phoneClean = null;
        let phoneLast4 = null;
        if (phone) {
            phoneClean = phone.replace(/\D/g, '');
            if (phoneClean.length >= 4) {
                phoneLast4 = phoneClean.slice(-4);
            }

            // Check if phone already registered
            if (phoneClean.length >= 10) {
                const existingByPhone = await db.collection('players')
                    .where('phone', '==', phoneClean)
                    .limit(1)
                    .get();

                if (!existingByPhone.empty) {
                    return res.status(400).json({
                        success: false,
                        error: 'An account with this phone number already exists. Use your PIN to login.'
                    });
                }
            }
        }

        // Generate unique 8-digit PIN
        let pin;
        if (phoneLast4) {
            // If phone provided, use phone-based PIN generation
            pin = await generateUniquePinWithPhone(phoneLast4);
        } else {
            // Otherwise use fully random PIN
            pin = await generateUniqueFullPin();
        }

        // Create player document
        const playerData = {
            name: fullName,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: emailLower,
            phone: phoneClean,
            phone_last4: phoneLast4,
            pin: pin,
            preferred_level: preferred_level || null,
            photo_url: null,
            isBot: false,
            notification_preference: phoneClean ? 'sms' : 'email',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
            },
            involvements: { leagues: [], tournaments: [], directing: [], captaining: [] }
        };

        const playerRef = await db.collection('players').add(playerData);

        // Send welcome email with PIN
        const emailResult = await sendWelcomeEmail(emailLower, fullName, pin);
        let emailSent = emailResult.success || emailResult.simulated || false;

        // Also send SMS if phone provided
        let smsSent = false;
        if (phoneClean && phoneClean.length >= 10) {
            const smsResult = await sendWelcomeSMS(phoneClean, fullName, pin);
            smsSent = smsResult.success || smsResult.simulated || false;
        }

        // Log the registration
        await db.collection('notifications').add({
            type: 'player_signup',
            to_phone: phoneClean || null,
            to_email: emailLower,
            player_id: playerRef.id,
            player_name: fullName,
            sms_sent: smsSent,
            email_sent: emailSent,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`New player signed up: ${fullName} (${playerRef.id})`);

        res.json({
            success: true,
            player_id: playerRef.id,
            pin: pin,
            message: `Welcome ${fullName}! Your PIN is ${pin}. Save this - you'll use it to login.`
        });

    } catch (error) {
        console.error('Register new player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Simple player registration - for game setup page
 * Auto-generates PIN and sends via SMS
 */
exports.registerPlayerSimple = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { first_name, last_name, phone, email } = req.body;

        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({ success: false, error: 'First name and last name are required' });
        }

        if (!phone) {
            return res.status(400).json({ success: false, error: 'Phone number is required' });
        }

        // Clean and validate phone
        const phoneClean = phone.replace(/\D/g, '');
        if (phoneClean.length < 10) {
            return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit phone number' });
        }

        const fullName = `${first_name.trim()} ${last_name.trim()}`;
        const emailLower = email ? email.toLowerCase().trim() : null;

        // Check if player already exists (by phone)
        const existingPlayer = await db.collection('players')
            .where('phone', '==', phoneClean)
            .limit(1)
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({
                success: false,
                error: 'An account with this phone number already exists. Use your PIN to login.'
            });
        }

        // Generate unique 8-digit PIN (phone last 4 + 4 random)
        const phoneLast4 = phoneClean.slice(-4);
        const pin = await generateUniquePinWithPhone(phoneLast4);

        // Create player document
        const playerData = {
            name: fullName,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: emailLower,
            phone: phoneClean,
            phone_last4: phoneClean.slice(-4),
            pin: pin,
            photo_url: null,
            isBot: false,
            notification_preference: 'sms', // Default to SMS
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0, ton_eighties: 0, high_checkout: 0 },
                cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_rounds: 0 }
            },
            involvements: { leagues: [], tournaments: [], directing: [], captaining: [] }
        };

        const playerRef = await db.collection('players').add(playerData);

        // Send welcome SMS with PIN
        const smsResult = await sendWelcomeSMS(phoneClean, fullName, pin);
        if (!smsResult.success && !smsResult.simulated) {
            console.warn(`Welcome SMS failed for ${phoneClean}:`, smsResult.error);
        }

        // Also send email if provided
        let emailSent = false;
        if (emailLower) {
            const emailResult = await sendWelcomeEmail(emailLower, fullName, pin);
            emailSent = emailResult.success || emailResult.simulated || false;
        }

        // Log the registration
        await db.collection('notifications').add({
            type: 'player_welcome',
            to_phone: phoneClean,
            to_email: emailLower || null,
            player_id: playerRef.id,
            player_name: fullName,
            sms_sent: smsResult.success || smsResult.simulated || false,
            email_sent: emailSent,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`New player registered: ${fullName} (${playerRef.id})`);

        res.json({
            success: true,
            player: {
                id: playerRef.id,
                name: fullName,
                pin: pin
            },
            message: `Welcome ${fullName}! Your PIN has been sent via text.`
        });

    } catch (error) {
        console.error('Simple register player error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
