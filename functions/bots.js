/**
 * Bot Player Management Functions
 * Handles registration, listing, and management of bot players with granular skill stats
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

/**
 * Register a new bot player with granular skill stats
 */
exports.registerBot = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { name, x01_stats, cricket_stats } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Name is required'
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

        const pin = generateBotPin();

        // Default X01 stats (league average) with tiered checkouts
        const defaultX01 = {
            x01_three_dart_avg: 55,          // 3-dart average
            pct_100_plus: 25,            // % of turns scoring 100+
            pct_140_plus: 8,             // % of turns scoring 140+
            pct_171_plus: 1,             // % of turns scoring 171+ (max 180)
            checkout_pct_low: 45,        // % success on checkouts 2-80
            checkout_pct_81: 30,         // % success on checkouts 81-100
            checkout_pct_101: 18,        // % success on checkouts 101-140
            checkout_pct_141: 8,         // % success on checkouts 141-170
            double_in_success_pct: 20    // % success hitting double to start
        };

        // Default Cricket stats (league average)
        const defaultCricket = {
            miss_pct: 25,                // % of darts that miss entirely
            triple_bull_pct: 15,         // % of darts hitting triple or bull
            pct_5_mark_plus: 20,         // % of rounds with 5+ marks
            pct_7_mark_plus: 8,          // % of rounds with 7+ marks
            pct_9_mark_plus: 2           // % of rounds with 9 marks (max)
        };

        // Merge with provided stats
        const finalX01Stats = { ...defaultX01, ...(x01_stats || {}) };
        const finalCricketStats = { ...defaultCricket, ...(cricket_stats || {}) };

        // Validate ranges (0-100 for percentages)
        const validatePct = (val) => Math.max(0, Math.min(100, Number(val) || 0));

        finalX01Stats.x01_three_dart_avg = Math.max(20, Math.min(120, Number(finalX01Stats.x01_three_dart_avg) || 55));
        finalX01Stats.pct_100_plus = validatePct(finalX01Stats.pct_100_plus);
        finalX01Stats.pct_140_plus = validatePct(finalX01Stats.pct_140_plus);
        finalX01Stats.pct_171_plus = validatePct(finalX01Stats.pct_171_plus);
        finalX01Stats.checkout_pct_low = validatePct(finalX01Stats.checkout_pct_low);
        finalX01Stats.checkout_pct_81 = validatePct(finalX01Stats.checkout_pct_81);
        finalX01Stats.checkout_pct_101 = validatePct(finalX01Stats.checkout_pct_101);
        finalX01Stats.checkout_pct_141 = validatePct(finalX01Stats.checkout_pct_141);
        finalX01Stats.double_in_success_pct = validatePct(finalX01Stats.double_in_success_pct);

        finalCricketStats.miss_pct = validatePct(finalCricketStats.miss_pct);
        finalCricketStats.triple_bull_pct = validatePct(finalCricketStats.triple_bull_pct);
        finalCricketStats.pct_5_mark_plus = validatePct(finalCricketStats.pct_5_mark_plus);
        finalCricketStats.pct_7_mark_plus = validatePct(finalCricketStats.pct_7_mark_plus);
        finalCricketStats.pct_9_mark_plus = validatePct(finalCricketStats.pct_9_mark_plus);

        const botData = {
            name: name,
            pin: pin,
            isBot: true,
            x01_skills: finalX01Stats,
            cricket_skills: finalCricketStats,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            // Game stats (updated after matches)
            game_stats: {
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
 * Derive difficulty from 3-dart average
 */
function getDifficultyFromAvg(avg) {
    if (avg >= 85) return 'pro';
    if (avg >= 65) return 'hard';
    if (avg >= 50) return 'league';
    if (avg >= 40) return 'medium';
    return 'easy';
}

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
            const data = doc.data();
            // Compute difficulty from x01 average for backwards compatibility
            const avg = data.x01_skills?.x01_three_dart_avg || 55;
            const difficulty = data.difficulty || getDifficultyFromAvg(avg);
            bots.push({
                id: doc.id,
                ...data,
                difficulty: difficulty
            });
        });

        res.json({
            success: true,
            bots: bots,
            count: bots.length
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
        const { bot_id, name, x01_stats, cricket_stats } = req.body;

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

        const validatePct = (val) => Math.max(0, Math.min(100, Number(val) || 0));

        if (x01_stats) {
            if (x01_stats.x01_three_dart_avg !== undefined) {
                updates['x01_skills.x01_three_dart_avg'] = Math.max(20, Math.min(120, Number(x01_stats.x01_three_dart_avg) || 55));
            }
            if (x01_stats.pct_100_plus !== undefined) {
                updates['x01_skills.pct_100_plus'] = validatePct(x01_stats.pct_100_plus);
            }
            if (x01_stats.pct_140_plus !== undefined) {
                updates['x01_skills.pct_140_plus'] = validatePct(x01_stats.pct_140_plus);
            }
            if (x01_stats.pct_171_plus !== undefined) {
                updates['x01_skills.pct_171_plus'] = validatePct(x01_stats.pct_171_plus);
            }
            if (x01_stats.checkout_pct_low !== undefined) {
                updates['x01_skills.checkout_pct_low'] = validatePct(x01_stats.checkout_pct_low);
            }
            if (x01_stats.checkout_pct_81 !== undefined) {
                updates['x01_skills.checkout_pct_81'] = validatePct(x01_stats.checkout_pct_81);
            }
            if (x01_stats.checkout_pct_101 !== undefined) {
                updates['x01_skills.checkout_pct_101'] = validatePct(x01_stats.checkout_pct_101);
            }
            if (x01_stats.checkout_pct_141 !== undefined) {
                updates['x01_skills.checkout_pct_141'] = validatePct(x01_stats.checkout_pct_141);
            }
            if (x01_stats.double_in_success_pct !== undefined) {
                updates['x01_skills.double_in_success_pct'] = validatePct(x01_stats.double_in_success_pct);
            }
        }

        if (cricket_stats) {
            if (cricket_stats.miss_pct !== undefined) {
                updates['cricket_skills.miss_pct'] = validatePct(cricket_stats.miss_pct);
            }
            if (cricket_stats.triple_bull_pct !== undefined) {
                updates['cricket_skills.triple_bull_pct'] = validatePct(cricket_stats.triple_bull_pct);
            }
            if (cricket_stats.pct_5_mark_plus !== undefined) {
                updates['cricket_skills.pct_5_mark_plus'] = validatePct(cricket_stats.pct_5_mark_plus);
            }
            if (cricket_stats.pct_7_mark_plus !== undefined) {
                updates['cricket_skills.pct_7_mark_plus'] = validatePct(cricket_stats.pct_7_mark_plus);
            }
            if (cricket_stats.pct_9_mark_plus !== undefined) {
                updates['cricket_skills.pct_9_mark_plus'] = validatePct(cricket_stats.pct_9_mark_plus);
            }
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
 * Delete ALL bots
 */
exports.deleteAllBots = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const botsSnapshot = await db.collection('bots').get();

        if (botsSnapshot.empty) {
            return res.json({ success: true, deleted: 0, message: 'No bots to delete' });
        }

        const batch = db.batch();
        let count = 0;

        botsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();

        res.json({
            success: true,
            deleted: count,
            message: `Deleted ${count} bots`
        });

    } catch (error) {
        console.error('Delete all bots error:', error);
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

        const currentStats = botDoc.data().game_stats || {};
        const updates = {};

        if (game_type === 'x01' || game_type === '501' || game_type === '301' || game_type === '701') {
            const x01Stats = currentStats.x01 || {};
            updates['game_stats.x01.legs_played'] = (x01Stats.legs_played || 0) + (stats.legs_played || 0);
            updates['game_stats.x01.legs_won'] = (x01Stats.legs_won || 0) + (stats.legs_won || 0);
            updates['game_stats.x01.total_points'] = (x01Stats.total_points || 0) + (stats.total_points || 0);
            updates['game_stats.x01.total_darts'] = (x01Stats.total_darts || 0) + (stats.total_darts || 0);
            updates['game_stats.x01.ton_eighties'] = (x01Stats.ton_eighties || 0) + (stats.ton_eighties || 0);

            if (stats.high_checkout && stats.high_checkout > (x01Stats.high_checkout || 0)) {
                updates['game_stats.x01.high_checkout'] = stats.high_checkout;
            }
        } else if (game_type === 'cricket') {
            const cricketStats = currentStats.cricket || {};
            updates['game_stats.cricket.legs_played'] = (cricketStats.legs_played || 0) + (stats.legs_played || 0);
            updates['game_stats.cricket.legs_won'] = (cricketStats.legs_won || 0) + (stats.legs_won || 0);
            updates['game_stats.cricket.total_marks'] = (cricketStats.total_marks || 0) + (stats.total_marks || 0);
            updates['game_stats.cricket.total_rounds'] = (cricketStats.total_rounds || 0) + (stats.total_rounds || 0);
        }

        if (stats.match_completed) {
            updates['game_stats.matches_played'] = admin.firestore.FieldValue.increment(1);
            if (stats.match_won) {
                updates['game_stats.matches_won'] = admin.firestore.FieldValue.increment(1);
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
 * Get preset bot configurations
 */
exports.getBotPresets = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    const presets = {
        beginner: {
            label: 'Beginner',
            description: 'Just learning the game',
            x01_stats: {
                x01_three_dart_avg: 35,
                pct_100_plus: 5,
                pct_140_plus: 1,
                pct_171_plus: 0,
                checkout_pct_low: 20,
                checkout_pct_81: 8,
                checkout_pct_101: 3,
                checkout_pct_141: 1,
                double_in_success_pct: 10
            },
            cricket_stats: {
                miss_pct: 40,
                triple_bull_pct: 5,
                pct_5_mark_plus: 5,
                pct_7_mark_plus: 1,
                pct_9_mark_plus: 0
            }
        },
        casual: {
            label: 'Casual',
            description: 'Bar league player',
            x01_stats: {
                x01_three_dart_avg: 45,
                pct_100_plus: 15,
                pct_140_plus: 4,
                pct_171_plus: 0.5,
                checkout_pct_low: 35,
                checkout_pct_81: 18,
                checkout_pct_101: 8,
                checkout_pct_141: 3,
                double_in_success_pct: 15
            },
            cricket_stats: {
                miss_pct: 30,
                triple_bull_pct: 10,
                pct_5_mark_plus: 12,
                pct_7_mark_plus: 4,
                pct_9_mark_plus: 1
            }
        },
        league: {
            label: 'League',
            description: 'Competitive league player',
            x01_stats: {
                x01_three_dart_avg: 55,
                pct_100_plus: 25,
                pct_140_plus: 8,
                pct_171_plus: 1,
                checkout_pct_low: 45,
                checkout_pct_81: 30,
                checkout_pct_101: 18,
                checkout_pct_141: 8,
                double_in_success_pct: 20
            },
            cricket_stats: {
                miss_pct: 25,
                triple_bull_pct: 15,
                pct_5_mark_plus: 20,
                pct_7_mark_plus: 8,
                pct_9_mark_plus: 2
            }
        },
        advanced: {
            label: 'Advanced',
            description: 'Tournament-level player',
            x01_stats: {
                x01_three_dart_avg: 70,
                pct_100_plus: 40,
                pct_140_plus: 18,
                pct_171_plus: 3,
                checkout_pct_low: 60,
                checkout_pct_81: 42,
                checkout_pct_101: 28,
                checkout_pct_141: 15,
                double_in_success_pct: 30
            },
            cricket_stats: {
                miss_pct: 15,
                triple_bull_pct: 25,
                pct_5_mark_plus: 35,
                pct_7_mark_plus: 18,
                pct_9_mark_plus: 5
            }
        },
        pro: {
            label: 'Pro',
            description: 'Professional-level player',
            x01_stats: {
                x01_three_dart_avg: 95,
                pct_100_plus: 65,
                pct_140_plus: 35,
                pct_171_plus: 8,
                checkout_pct_low: 80,
                checkout_pct_81: 58,
                checkout_pct_101: 40,
                checkout_pct_141: 25,
                double_in_success_pct: 45
            },
            cricket_stats: {
                miss_pct: 8,
                triple_bull_pct: 40,
                pct_5_mark_plus: 55,
                pct_7_mark_plus: 35,
                pct_9_mark_plus: 12
            }
        }
    };

    res.json({
        success: true,
        presets: presets
    });
});
