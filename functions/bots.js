/**
 * Bot Player Management Functions
 * Handles registration, listing, and management of bot players
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Generate 8-digit PIN for bot players
function generateBotPin() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// Bot configuration with skill levels
const BOT_DIFFICULTY_CONFIG = {
    easy: {
        label: 'Easy',
        x01_avg: 40,
        cricket_mpr: 1.5,
        description: 'Beginner level bot'
    },
    medium: {
        label: 'Medium',
        x01_avg: 55,
        cricket_mpr: 2.0,
        description: 'Intermediate level bot'
    },
    league: {
        label: 'League',
        x01_avg: 65,
        cricket_mpr: 2.5,
        description: 'Average league player level'
    },
    hard: {
        label: 'Hard',
        x01_avg: 75,
        cricket_mpr: 3.0,
        description: 'Skilled player level'
    },
    pro: {
        label: 'Pro',
        x01_avg: 90,
        cricket_mpr: 3.5,
        description: 'Professional level bot'
    }
};

/**
 * Register a new bot player
 */
exports.registerBot = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { name, difficulty, avatar_style } = req.body;

        if (!name || !difficulty) {
            return res.status(400).json({
                success: false,
                error: 'Name and difficulty are required'
            });
        }

        if (!BOT_DIFFICULTY_CONFIG[difficulty]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid difficulty. Must be: easy, medium, league, hard, or pro'
            });
        }

        // Check if bot name already exists
        const existingBot = await db.collection('bots')
            .where('name', '==', name)
            .get();

        if (!existingBot.empty) {
            return res.status(400).json({
                success: false,
                error: 'A bot with this name already exists'
            });
        }

        const config = BOT_DIFFICULTY_CONFIG[difficulty];
        const pin = generateBotPin();

        const botData = {
            name: name,
            pin: pin,
            difficulty: difficulty,
            difficulty_label: config.label,
            x01_avg: config.x01_avg,
            cricket_mpr: config.cricket_mpr,
            avatar_style: avatar_style || 'robot',
            isBot: true,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            // Initialize stats (will be updated after matches)
            stats: {
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
                },
                matches_played: 0,
                matches_won: 0
            }
        };

        const botRef = await db.collection('bots').add(botData);

        res.json({
            success: true,
            bot_id: botRef.id,
            pin: pin,
            bot: { id: botRef.id, ...botData },
            message: `Bot "${name}" registered successfully with PIN: ${pin}`
        });

    } catch (error) {
        console.error('Register bot error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all registered bots
 */
exports.getBots = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const botsSnapshot = await db.collection('bots')
            .orderBy('created_at', 'desc')
            .get();

        const bots = [];
        botsSnapshot.forEach(doc => {
            bots.push({ id: doc.id, ...doc.data() });
        });

        res.json({
            success: true,
            bots: bots,
            count: bots.length,
            difficulty_options: BOT_DIFFICULTY_CONFIG
        });

    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update a bot's settings
 */
exports.updateBot = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { bot_id, name, difficulty, avatar_style } = req.body;

        if (!bot_id) {
            return res.status(400).json({
                success: false,
                error: 'bot_id is required'
            });
        }

        const botRef = db.collection('bots').doc(bot_id);
        const botDoc = await botRef.get();

        if (!botDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Bot not found'
            });
        }

        const updates = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (name) {
            // Check if new name conflicts with another bot
            const existingBot = await db.collection('bots')
                .where('name', '==', name)
                .get();

            const conflicts = existingBot.docs.filter(d => d.id !== bot_id);
            if (conflicts.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'A bot with this name already exists'
                });
            }
            updates.name = name;
        }

        if (difficulty) {
            if (!BOT_DIFFICULTY_CONFIG[difficulty]) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid difficulty'
                });
            }
            const config = BOT_DIFFICULTY_CONFIG[difficulty];
            updates.difficulty = difficulty;
            updates.difficulty_label = config.label;
            updates.x01_avg = config.x01_avg;
            updates.cricket_mpr = config.cricket_mpr;
        }

        if (avatar_style) {
            updates.avatar_style = avatar_style;
        }

        await botRef.update(updates);

        const updatedBot = await botRef.get();

        res.json({
            success: true,
            bot: { id: bot_id, ...updatedBot.data() },
            message: 'Bot updated successfully'
        });

    } catch (error) {
        console.error('Update bot error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a bot
 */
exports.deleteBot = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { bot_id } = req.body;

        if (!bot_id) {
            return res.status(400).json({
                success: false,
                error: 'bot_id is required'
            });
        }

        const botRef = db.collection('bots').doc(bot_id);
        const botDoc = await botRef.get();

        if (!botDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Bot not found'
            });
        }

        const botName = botDoc.data().name;
        await botRef.delete();

        res.json({
            success: true,
            message: `Bot "${botName}" deleted successfully`
        });

    } catch (error) {
        console.error('Delete bot error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update bot stats after a match
 */
exports.updateBotStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { bot_id, game_type, stats } = req.body;

        if (!bot_id || !game_type || !stats) {
            return res.status(400).json({
                success: false,
                error: 'bot_id, game_type, and stats are required'
            });
        }

        const botRef = db.collection('bots').doc(bot_id);
        const botDoc = await botRef.get();

        if (!botDoc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Bot not found'
            });
        }

        const currentStats = botDoc.data().stats || {};
        const updates = {};

        if (game_type === 'x01' || game_type === '501' || game_type === '301' || game_type === '701') {
            const x01Stats = currentStats.x01 || {};
            updates['stats.x01.legs_played'] = (x01Stats.legs_played || 0) + (stats.legs_played || 0);
            updates['stats.x01.legs_won'] = (x01Stats.legs_won || 0) + (stats.legs_won || 0);
            updates['stats.x01.total_points'] = (x01Stats.total_points || 0) + (stats.total_points || 0);
            updates['stats.x01.total_darts'] = (x01Stats.total_darts || 0) + (stats.total_darts || 0);
            updates['stats.x01.ton_eighties'] = (x01Stats.ton_eighties || 0) + (stats.ton_eighties || 0);

            if (stats.high_checkout && stats.high_checkout > (x01Stats.high_checkout || 0)) {
                updates['stats.x01.high_checkout'] = stats.high_checkout;
            }
        } else if (game_type === 'cricket') {
            const cricketStats = currentStats.cricket || {};
            updates['stats.cricket.legs_played'] = (cricketStats.legs_played || 0) + (stats.legs_played || 0);
            updates['stats.cricket.legs_won'] = (cricketStats.legs_won || 0) + (stats.legs_won || 0);
            updates['stats.cricket.total_marks'] = (cricketStats.total_marks || 0) + (stats.total_marks || 0);
            updates['stats.cricket.total_rounds'] = (cricketStats.total_rounds || 0) + (stats.total_rounds || 0);
        }

        if (stats.match_completed) {
            updates['stats.matches_played'] = admin.firestore.FieldValue.increment(1);
            if (stats.match_won) {
                updates['stats.matches_won'] = admin.firestore.FieldValue.increment(1);
            }
        }

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await botRef.update(updates);

        res.json({
            success: true,
            message: 'Bot stats updated'
        });

    } catch (error) {
        console.error('Update bot stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get difficulty options (for UI)
 */
exports.getBotDifficultyOptions = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    res.json({
        success: true,
        options: BOT_DIFFICULTY_CONFIG
    });
});
