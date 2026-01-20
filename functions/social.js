/**
 * BRDC Social Features - Phase 3
 * Emotes/reactions, cheers, achievements, hot streaks
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const db = admin.firestore();

// Allowed reaction emojis
const ALLOWED_REACTIONS = ['🎯', '🔥', '👏', '😂', '👍', '💯'];

// Achievement definitions
const ACHIEVEMENTS = [
    // Scoring Achievements
    { id: 'first_180', name: 'Triple Crown', description: 'Hit your first 180', icon: '🎯', category: 'scoring', tier: 'bronze', criteria: { type: 'count', stat: 'ton_eighties', threshold: 1 }, points: 10 },
    { id: 'ton_eighty_5', name: '180 Club', description: 'Hit 5 180s', icon: '🎯', category: 'scoring', tier: 'silver', criteria: { type: 'count', stat: 'ton_eighties', threshold: 5 }, points: 25 },
    { id: 'ton_eighty_25', name: '180 Master', description: 'Hit 25 180s', icon: '🎯', category: 'scoring', tier: 'gold', criteria: { type: 'count', stat: 'ton_eighties', threshold: 25 }, points: 50 },
    { id: 'ton_eighty_100', name: '180 Legend', description: 'Hit 100 180s', icon: '🎯', category: 'scoring', tier: 'platinum', criteria: { type: 'count', stat: 'ton_eighties', threshold: 100 }, points: 100 },

    { id: 'high_checkout_100', name: 'Century Out', description: 'Check out on 100+', icon: '💯', category: 'scoring', tier: 'bronze', criteria: { type: 'single', stat: 'high_checkout', threshold: 100 }, points: 15 },
    { id: 'high_checkout_150', name: 'Big Finish', description: 'Check out on 150+', icon: '💯', category: 'scoring', tier: 'silver', criteria: { type: 'single', stat: 'high_checkout', threshold: 150 }, points: 30 },
    { id: 'high_checkout_170', name: 'The Big One', description: 'Check out on 170', icon: '💯', category: 'scoring', tier: 'gold', criteria: { type: 'single', stat: 'high_checkout', threshold: 170 }, points: 75 },

    // Streak Achievements
    { id: 'hot_streak_3', name: 'On Fire', description: 'Win 3 matches in a row', icon: '🔥', category: 'participation', tier: 'bronze', criteria: { type: 'streak', stat: 'win_streak', threshold: 3 }, points: 15 },
    { id: 'hot_streak_5', name: 'Unstoppable', description: 'Win 5 matches in a row', icon: '🔥', category: 'participation', tier: 'silver', criteria: { type: 'streak', stat: 'win_streak', threshold: 5 }, points: 35 },
    { id: 'hot_streak_10', name: 'Dominant', description: 'Win 10 matches in a row', icon: '🔥', category: 'participation', tier: 'gold', criteria: { type: 'streak', stat: 'win_streak', threshold: 10 }, points: 75 },

    // Social Achievements
    { id: 'first_cheer', name: 'Supportive', description: 'Send your first cheer', icon: '👏', category: 'social', tier: 'bronze', criteria: { type: 'count', stat: 'cheers_given', threshold: 1 }, points: 5 },
    { id: 'cheer_50', name: 'Cheerleader', description: 'Send 50 cheers', icon: '👏', category: 'social', tier: 'silver', criteria: { type: 'count', stat: 'cheers_given', threshold: 50 }, points: 25 },
    { id: 'fan_favorite', name: 'Fan Favorite', description: 'Receive 100 cheers', icon: '⭐', category: 'social', tier: 'gold', criteria: { type: 'count', stat: 'cheers_received', threshold: 100 }, points: 50 },

    // Participation Achievements
    { id: 'matches_10', name: 'Getting Started', description: 'Play 10 matches', icon: '🎮', category: 'participation', tier: 'bronze', criteria: { type: 'count', stat: 'matches_played', threshold: 10 }, points: 10 },
    { id: 'matches_50', name: 'Regular', description: 'Play 50 matches', icon: '🎮', category: 'participation', tier: 'silver', criteria: { type: 'count', stat: 'matches_played', threshold: 50 }, points: 30 },
    { id: 'matches_100', name: 'Veteran', description: 'Play 100 matches', icon: '🎮', category: 'participation', tier: 'gold', criteria: { type: 'count', stat: 'matches_played', threshold: 100 }, points: 60 },

    { id: 'wins_10', name: 'Winner', description: 'Win 10 matches', icon: '🏆', category: 'participation', tier: 'bronze', criteria: { type: 'count', stat: 'matches_won', threshold: 10 }, points: 15 },
    { id: 'wins_50', name: 'Champion', description: 'Win 50 matches', icon: '🏆', category: 'participation', tier: 'silver', criteria: { type: 'count', stat: 'matches_won', threshold: 50 }, points: 40 },
    { id: 'wins_100', name: 'Legend', description: 'Win 100 matches', icon: '🏆', category: 'participation', tier: 'gold', criteria: { type: 'count', stat: 'matches_won', threshold: 100 }, points: 80 },

    // First messages
    { id: 'first_message', name: 'Social Butterfly', description: 'Send your first message', icon: '💬', category: 'social', tier: 'bronze', criteria: { type: 'count', stat: 'messages_sent', threshold: 1 }, points: 5 },
];

// Helper: Verify player PIN
async function verifyPlayer(pin) {
    if (!pin) return null;
    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;
    return { id: playersSnapshot.docs[0].id, ...playersSnapshot.docs[0].data() };
}

// ===========================================
// REACTIONS
// ===========================================

/**
 * Add reaction to a message
 */
exports.addReaction = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, message_type, room_or_conversation_id, message_id, emoji } = req.body;

            if (!player_pin || !message_type || !room_or_conversation_id || !message_id || !emoji) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (!ALLOWED_REACTIONS.includes(emoji)) {
                return res.status(400).json({ success: false, error: 'Invalid reaction emoji' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get message reference based on type
            let messageRef;
            if (message_type === 'dm') {
                messageRef = db.collection('conversations')
                    .doc(room_or_conversation_id)
                    .collection('messages')
                    .doc(message_id);
            } else {
                messageRef = db.collection('chat_rooms')
                    .doc(room_or_conversation_id)
                    .collection('messages')
                    .doc(message_id);
            }

            const messageDoc = await messageRef.get();
            if (!messageDoc.exists) {
                return res.status(404).json({ success: false, error: 'Message not found' });
            }

            // Add reaction
            await messageRef.update({
                [`reactions.${emoji}`]: admin.firestore.FieldValue.arrayUnion(player.id),
                reaction_count: admin.firestore.FieldValue.increment(1)
            });

            res.json({ success: true, emoji, added: true });

        } catch (error) {
            console.error('Error adding reaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Remove reaction from a message
 */
exports.removeReaction = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, message_type, room_or_conversation_id, message_id, emoji } = req.body;

            if (!player_pin || !message_type || !room_or_conversation_id || !message_id || !emoji) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            let messageRef;
            if (message_type === 'dm') {
                messageRef = db.collection('conversations')
                    .doc(room_or_conversation_id)
                    .collection('messages')
                    .doc(message_id);
            } else {
                messageRef = db.collection('chat_rooms')
                    .doc(room_or_conversation_id)
                    .collection('messages')
                    .doc(message_id);
            }

            await messageRef.update({
                [`reactions.${emoji}`]: admin.firestore.FieldValue.arrayRemove(player.id),
                reaction_count: admin.firestore.FieldValue.increment(-1)
            });

            res.json({ success: true, emoji, removed: true });

        } catch (error) {
            console.error('Error removing reaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===========================================
// CHEERS
// ===========================================

/**
 * Send a cheer to another player
 */
exports.sendCheer = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, receiver_id, context, message, match_id, league_id } = req.body;

            if (!player_pin || !receiver_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Can't cheer yourself
            if (player.id === receiver_id) {
                return res.status(400).json({ success: false, error: 'Cannot cheer yourself' });
            }

            // Check receiver exists
            const receiverDoc = await db.collection('players').doc(receiver_id).get();
            if (!receiverDoc.exists) {
                return res.status(404).json({ success: false, error: 'Receiver not found' });
            }
            const receiverData = receiverDoc.data();
            const receiverName = receiverData.name || `${receiverData.first_name} ${receiverData.last_name}`;

            const playerName = player.name || `${player.first_name} ${player.last_name}`;

            // Create cheer document
            await db.collection('cheers').add({
                giver_id: player.id,
                giver_name: playerName,
                receiver_id: receiver_id,
                receiver_name: receiverName,
                match_id: match_id || null,
                league_id: league_id || null,
                context: context || 'general',
                message: (message || '').slice(0, 200),
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update giver's cheers_given count
            await db.collection('players').doc(player.id).update({
                'social.cheers_given': admin.firestore.FieldValue.increment(1)
            });

            // Update receiver's cheers_received and biggest_fans
            const receiverRef = db.collection('players').doc(receiver_id);
            await receiverRef.update({
                'social.cheers_received': admin.firestore.FieldValue.increment(1)
            });

            // Update biggest fans aggregation
            await updateBiggestFans(receiver_id, player.id, playerName);

            // Check for social achievements
            await checkAndAwardAchievementsInternal(player.id, 'cheer_given');
            await checkAndAwardAchievementsInternal(receiver_id, 'cheer_received');

            res.json({ success: true, message: 'Cheer sent!' });

        } catch (error) {
            console.error('Error sending cheer:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Helper: Update biggest fans list for a player
 */
async function updateBiggestFans(playerId, fanId, fanName) {
    try {
        // Count cheers from this fan
        const cheersSnapshot = await db.collection('cheers')
            .where('receiver_id', '==', playerId)
            .where('giver_id', '==', fanId)
            .get();

        const cheerCount = cheersSnapshot.size;

        // Get current biggest fans
        const playerDoc = await db.collection('players').doc(playerId).get();
        const playerData = playerDoc.data();
        let biggestFans = playerData.social?.biggest_fans || [];

        // Update or add this fan
        const existingIndex = biggestFans.findIndex(f => f.player_id === fanId);
        if (existingIndex >= 0) {
            biggestFans[existingIndex].cheer_count = cheerCount;
        } else {
            biggestFans.push({
                player_id: fanId,
                player_name: fanName,
                cheer_count: cheerCount
            });
        }

        // Sort and keep top 3
        biggestFans.sort((a, b) => b.cheer_count - a.cheer_count);
        biggestFans = biggestFans.slice(0, 3);

        await db.collection('players').doc(playerId).update({
            'social.biggest_fans': biggestFans
        });

    } catch (error) {
        console.error('Error updating biggest fans:', error);
    }
}

/**
 * Get player's cheers (given or received)
 */
exports.getPlayerCheers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, player_id, direction, limit: resultLimit } = req.body;

            if (!player_pin || !player_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const queryLimit = Math.min(resultLimit || 20, 50);
            const dir = direction || 'received';

            let query;
            if (dir === 'given') {
                query = db.collection('cheers')
                    .where('giver_id', '==', player_id)
                    .orderBy('created_at', 'desc')
                    .limit(queryLimit);
            } else {
                query = db.collection('cheers')
                    .where('receiver_id', '==', player_id)
                    .orderBy('created_at', 'desc')
                    .limit(queryLimit);
            }

            const cheersSnapshot = await query.get();

            const cheers = cheersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate()
            }));

            res.json({ success: true, cheers, direction: dir });

        } catch (error) {
            console.error('Error getting cheers:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get biggest fans for a player
 */
exports.getBiggestFans = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, player_id } = req.body;

            if (!player_pin || !player_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const targetDoc = await db.collection('players').doc(player_id).get();
            if (!targetDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const targetData = targetDoc.data();
            const biggestFans = targetData.social?.biggest_fans || [];

            res.json({ success: true, biggest_fans: biggestFans });

        } catch (error) {
            console.error('Error getting biggest fans:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===========================================
// ACHIEVEMENTS
// ===========================================

/**
 * Internal: Check and award achievements
 */
async function checkAndAwardAchievementsInternal(playerId, triggerType) {
    try {
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) return [];

        const playerData = playerDoc.data();
        const unlockedIds = new Set((playerData.achievements?.unlocked || []).map(a => a.achievement_id));
        const newlyUnlocked = [];

        // Get player stats
        const stats = {
            ton_eighties: playerData.stats?.ton_eighties || 0,
            high_checkout: playerData.stats?.high_checkout || 0,
            matches_played: playerData.stats?.matches_played || 0,
            matches_won: playerData.stats?.matches_won || 0,
            cheers_given: playerData.social?.cheers_given || 0,
            cheers_received: playerData.social?.cheers_received || 0,
            win_streak: playerData.streaks?.current_win_streak || 0,
            messages_sent: playerData.stats?.messages_sent || 0
        };

        for (const achievement of ACHIEVEMENTS) {
            // Skip if already unlocked
            if (unlockedIds.has(achievement.id)) continue;

            const { type, stat, threshold } = achievement.criteria;
            let earned = false;

            if (type === 'count' && stats[stat] >= threshold) {
                earned = true;
            } else if (type === 'single' && stats[stat] >= threshold) {
                earned = true;
            } else if (type === 'streak' && stats[stat] >= threshold) {
                earned = true;
            }

            if (earned) {
                newlyUnlocked.push({
                    achievement_id: achievement.id,
                    unlocked_at: admin.firestore.FieldValue.serverTimestamp(),
                    context: triggerType
                });
            }
        }

        if (newlyUnlocked.length > 0) {
            const totalNewPoints = newlyUnlocked.reduce((sum, a) => {
                const def = ACHIEVEMENTS.find(d => d.id === a.achievement_id);
                return sum + (def?.points || 0);
            }, 0);

            await db.collection('players').doc(playerId).update({
                'achievements.unlocked': admin.firestore.FieldValue.arrayUnion(...newlyUnlocked),
                'achievements.total_points': admin.firestore.FieldValue.increment(totalNewPoints)
            });
        }

        return newlyUnlocked;

    } catch (error) {
        console.error('Error checking achievements:', error);
        return [];
    }
}

/**
 * Check and award achievements (callable)
 */
exports.checkAndAwardAchievements = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, trigger_type } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const newAchievements = await checkAndAwardAchievementsInternal(player.id, trigger_type || 'manual_check');

            const newWithDetails = newAchievements.map(a => {
                const def = ACHIEVEMENTS.find(d => d.id === a.achievement_id);
                return { ...a, ...def };
            });

            res.json({
                success: true,
                new_achievements: newWithDetails,
                count: newAchievements.length
            });

        } catch (error) {
            console.error('Error checking achievements:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get all achievements for a player
 */
exports.getPlayerAchievements = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, player_id } = req.body;

            if (!player_pin || !player_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const targetDoc = await db.collection('players').doc(player_id).get();
            if (!targetDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const targetData = targetDoc.data();
            const unlocked = targetData.achievements?.unlocked || [];
            const unlockedIds = new Set(unlocked.map(a => a.achievement_id));

            // Build full achievement list with status
            const allAchievements = ACHIEVEMENTS.map(def => {
                const unlockedData = unlocked.find(u => u.achievement_id === def.id);
                return {
                    ...def,
                    unlocked: unlockedIds.has(def.id),
                    unlocked_at: unlockedData?.unlocked_at?.toDate?.() || null
                };
            });

            res.json({
                success: true,
                achievements: allAchievements,
                total_points: targetData.achievements?.total_points || 0,
                showcase: targetData.achievements?.showcase || []
            });

        } catch (error) {
            console.error('Error getting achievements:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Set showcase achievements (3 featured on profile)
 */
exports.setShowcaseAchievements = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, achievement_ids } = req.body;

            if (!player_pin || !achievement_ids || !Array.isArray(achievement_ids)) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (achievement_ids.length > 3) {
                return res.status(400).json({ success: false, error: 'Maximum 3 showcase achievements' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Verify player has these achievements
            const playerData = player;
            const unlocked = playerData.achievements?.unlocked || [];
            const unlockedIds = new Set(unlocked.map(a => a.achievement_id));

            const validIds = achievement_ids.filter(id => unlockedIds.has(id));

            await db.collection('players').doc(player.id).update({
                'achievements.showcase': validIds
            });

            res.json({ success: true, showcase: validIds });

        } catch (error) {
            console.error('Error setting showcase:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get all achievement definitions
 */
exports.getAllAchievements = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.json({ success: true, achievements: ACHIEVEMENTS });
    });
});

// ===========================================
// STREAKS
// ===========================================

/**
 * Update player streak after match completion
 */
exports.updatePlayerStreak = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, player_id, match_result } = req.body;

            // Can be called by system (player_id) or by player (player_pin)
            let targetPlayerId = player_id;

            if (player_pin && !player_id) {
                const player = await verifyPlayer(player_pin);
                if (!player) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
                targetPlayerId = player.id;
            }

            if (!targetPlayerId || !match_result) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (!['win', 'loss'].includes(match_result)) {
                return res.status(400).json({ success: false, error: 'Invalid match_result' });
            }

            const playerDoc = await db.collection('players').doc(targetPlayerId).get();
            if (!playerDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const playerData = playerDoc.data();
            const currentStreak = playerData.streaks?.current_win_streak || 0;
            const bestStreak = playerData.streaks?.best_win_streak || 0;

            let newStreak;
            let isHot;

            if (match_result === 'win') {
                newStreak = currentStreak + 1;
                isHot = newStreak >= 3;
            } else {
                newStreak = 0;
                isHot = false;
            }

            const newBestStreak = Math.max(bestStreak, newStreak);

            await db.collection('players').doc(targetPlayerId).update({
                'streaks.current_win_streak': newStreak,
                'streaks.best_win_streak': newBestStreak,
                'streaks.last_match_result': match_result,
                'streaks.last_match_date': admin.firestore.FieldValue.serverTimestamp(),
                'streaks.is_hot': isHot
            });

            // Check for streak achievements
            if (match_result === 'win') {
                await checkAndAwardAchievementsInternal(targetPlayerId, 'match_win');
            }

            res.json({
                success: true,
                current_streak: newStreak,
                best_streak: newBestStreak,
                is_hot: isHot
            });

        } catch (error) {
            console.error('Error updating streak:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get hot players (players on winning streaks)
 */
exports.getHotPlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, league_id } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get players with is_hot = true
            let query = db.collection('players')
                .where('streaks.is_hot', '==', true)
                .orderBy('streaks.current_win_streak', 'desc')
                .limit(20);

            const hotSnapshot = await query.get();

            let hotPlayers = hotSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    player_id: doc.id,
                    name: data.name || `${data.first_name} ${data.last_name}`,
                    photo_url: data.photo_url,
                    current_streak: data.streaks?.current_win_streak || 0,
                    best_streak: data.streaks?.best_win_streak || 0
                };
            });

            // Filter by league if provided
            if (league_id) {
                const leagueDoc = await db.collection('leagues').doc(league_id).get();
                if (leagueDoc.exists) {
                    const leagueData = leagueDoc.data();
                    const leaguePlayerIds = new Set();

                    if (leagueData.teams) {
                        leagueData.teams.forEach(team => {
                            if (team.members) {
                                team.members.forEach(m => leaguePlayerIds.add(m.id));
                            }
                        });
                    }

                    hotPlayers = hotPlayers.filter(p => leaguePlayerIds.has(p.player_id));
                }
            }

            res.json({ success: true, hot_players: hotPlayers });

        } catch (error) {
            console.error('Error getting hot players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
