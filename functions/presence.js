/**
 * BRDC Enhanced Presence System
 * Discord-like presence with:
 * - Online/offline/away/in-game status
 * - Current activity tracking (watching match, in channel, playing game)
 * - Typing indicators for chat
 * - "Last seen" timestamps
 * - Viewer lists per match/channel
 */

const functions = require('firebase-functions');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const db = admin.firestore();

// ============================================================================
// CONSTANTS
// ============================================================================

const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes for online status
const TYPING_TIMEOUT_MS = 5 * 1000;          // 5 seconds for typing indicator
const HEARTBEAT_INTERVAL_MS = 60 * 1000;     // Expected heartbeat interval

// Valid status values
const VALID_STATUSES = ['online', 'away', 'in_game', 'dnd', 'offline'];

// Activity types
const ACTIVITY_TYPES = {
    IDLE: 'idle',
    WATCHING_MATCH: 'watching_match',
    PLAYING_GAME: 'playing_game',
    SCORING: 'scoring',
    IN_CHAT: 'in_chat',
    BROWSING: 'browsing'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify player PIN and get player data
 */
async function verifyPlayer(pin) {
    if (!pin) return null;
    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;
    return { id: playersSnapshot.docs[0].id, ...playersSnapshot.docs[0].data() };
}

/**
 * Get player display name
 */
function getPlayerName(player) {
    return player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown';
}

/**
 * Check if a timestamp is within the online threshold
 */
function isWithinOnlineThreshold(timestamp) {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return (Date.now() - date.getTime()) < PRESENCE_TIMEOUT_MS;
}

/**
 * Build activity description string
 */
function buildActivityDescription(activity) {
    if (!activity) return null;

    switch (activity.type) {
        case ACTIVITY_TYPES.WATCHING_MATCH:
            return `Watching ${activity.match_name || 'a match'}`;
        case ACTIVITY_TYPES.PLAYING_GAME:
            return `Playing ${activity.game_type || 'darts'}`;
        case ACTIVITY_TYPES.SCORING:
            return `Scoring ${activity.match_name || 'a match'}`;
        case ACTIVITY_TYPES.IN_CHAT:
            return `In ${activity.room_name || 'chat'}`;
        case ACTIVITY_TYPES.BROWSING:
            return `Browsing ${activity.page_name || 'BRDC'}`;
        default:
            return null;
    }
}

// ============================================================================
// PRESENCE FUNCTIONS
// ============================================================================

/**
 * Update player presence (heartbeat)
 * Called by frontend every 60 seconds when user is active
 */
exports.updatePresence = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                status,
                current_page,
                device_type,
                activity,
                context
            } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const presenceStatus = VALID_STATUSES.includes(status) ? status : 'online';
            const playerName = getPlayerName(player);

            // Build presence data
            const presenceData = {
                player_id: player.id,
                player_name: playerName,
                status: presenceStatus,
                last_heartbeat: now,
                current_page: current_page || 'unknown',
                device_type: device_type || 'unknown',
                updated_at: now
            };

            // Add activity if provided
            if (activity && typeof activity === 'object') {
                presenceData.activity = {
                    type: activity.type || ACTIVITY_TYPES.IDLE,
                    description: buildActivityDescription(activity) || activity.description,
                    started_at: activity.started_at || now,
                    ...activity
                };
            }

            // Add context (league_id, match_id, room_id) for filtering
            if (context && typeof context === 'object') {
                presenceData.context = {
                    league_id: context.league_id || null,
                    match_id: context.match_id || null,
                    room_id: context.room_id || null,
                    tournament_id: context.tournament_id || null
                };
            }

            // Update heartbeat document
            await db.collection('presence_heartbeats').doc(player.id).set(presenceData, { merge: true });

            // Update player document with last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: now,
                'presence.status': presenceStatus,
                'presence.last_seen_at': now,
                'presence.last_active_context': current_page || 'unknown',
                'presence.device_type': device_type || 'unknown',
                'presence.activity': presenceData.activity || null
            });

            // If watching a match, update viewers list
            if (context?.match_id && activity?.type === ACTIVITY_TYPES.WATCHING_MATCH) {
                await updateMatchViewers(context.match_id, player.id, playerName, true);
            }

            // If in a chat room, update room presence
            if (context?.room_id && activity?.type === ACTIVITY_TYPES.IN_CHAT) {
                await updateRoomPresence(context.room_id, player.id, playerName, true);
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Error updating presence:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Set player status manually (online, away, dnd, offline, in_game)
 */
exports.setPresenceStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, status, custom_status } = req.body;

            if (!player_pin || !status) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();

            const updateData = {
                status: status,
                last_heartbeat: now,
                updated_at: now
            };

            // Allow custom status message
            if (custom_status && typeof custom_status === 'string') {
                updateData.custom_status = custom_status.slice(0, 100);
            }

            await db.collection('presence_heartbeats').doc(player.id).update(updateData);

            await db.collection('players').doc(player.id).update({
                'presence.status': status,
                'presence.last_seen_at': now,
                'presence.custom_status': custom_status ? custom_status.slice(0, 100) : null
            });

            res.json({ success: true, status });

        } catch (error) {
            console.error('Error setting presence status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player activity (what they're currently doing)
 */
exports.updateActivity = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, activity, context } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const playerName = getPlayerName(player);

            // Build activity object
            const activityData = activity ? {
                type: activity.type || ACTIVITY_TYPES.IDLE,
                description: buildActivityDescription(activity) || activity.description,
                started_at: now,
                match_id: activity.match_id || null,
                match_name: activity.match_name || null,
                room_id: activity.room_id || null,
                room_name: activity.room_name || null,
                game_type: activity.game_type || null,
                page_name: activity.page_name || null
            } : null;

            // Update presence with new activity
            await db.collection('presence_heartbeats').doc(player.id).update({
                activity: activityData,
                context: context || null,
                last_heartbeat: now,
                updated_at: now
            });

            await db.collection('players').doc(player.id).update({
                'presence.activity': activityData,
                'presence.last_seen_at': now
            });

            // Handle viewer lists based on activity
            if (activity?.type === ACTIVITY_TYPES.WATCHING_MATCH && activity?.match_id) {
                await updateMatchViewers(activity.match_id, player.id, playerName, true);
            }

            if (activity?.type === ACTIVITY_TYPES.IN_CHAT && activity?.room_id) {
                await updateRoomPresence(activity.room_id, player.id, playerName, true);
            }

            res.json({ success: true, activity: activityData });

        } catch (error) {
            console.error('Error updating activity:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Set player offline when they explicitly log out or close the page
 */
exports.setOffline = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();

            // Get current presence to clean up viewer lists
            const presenceDoc = await db.collection('presence_heartbeats').doc(player.id).get();
            if (presenceDoc.exists) {
                const presenceData = presenceDoc.data();

                // Remove from match viewers if applicable
                if (presenceData.context?.match_id) {
                    await updateMatchViewers(presenceData.context.match_id, player.id, null, false);
                }

                // Remove from room presence if applicable
                if (presenceData.context?.room_id) {
                    await updateRoomPresence(presenceData.context.room_id, player.id, null, false);
                }
            }

            await db.collection('presence_heartbeats').doc(player.id).update({
                status: 'offline',
                activity: null,
                context: null,
                last_heartbeat: now,
                updated_at: now
            });

            await db.collection('players').doc(player.id).update({
                'presence.status': 'offline',
                'presence.last_seen_at': now,
                'presence.activity': null
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error setting offline:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// VIEWER/CHANNEL PRESENCE FUNCTIONS
// ============================================================================

/**
 * Update match viewers list
 */
async function updateMatchViewers(matchId, playerId, playerName, isJoining) {
    const viewersRef = db.collection('match_viewers').doc(matchId);

    try {
        await db.runTransaction(async (transaction) => {
            const viewersDoc = await transaction.get(viewersRef);

            let viewers = {};
            if (viewersDoc.exists) {
                viewers = viewersDoc.data().viewers || {};
            }

            if (isJoining) {
                viewers[playerId] = {
                    player_name: playerName,
                    joined_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_seen: admin.firestore.FieldValue.serverTimestamp()
                };
            } else {
                delete viewers[playerId];
            }

            transaction.set(viewersRef, {
                match_id: matchId,
                viewers: viewers,
                viewer_count: Object.keys(viewers).length,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });
    } catch (error) {
        console.error('Error updating match viewers:', error);
    }
}

/**
 * Update room presence (who's in a chat room)
 */
async function updateRoomPresence(roomId, playerId, playerName, isJoining) {
    const roomRef = db.collection('chat_rooms').doc(roomId);

    try {
        await db.runTransaction(async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) return;

            let activeMembers = roomDoc.data().active_members || {};

            if (isJoining) {
                activeMembers[playerId] = {
                    player_name: playerName,
                    joined_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_seen: admin.firestore.FieldValue.serverTimestamp()
                };
            } else {
                delete activeMembers[playerId];
            }

            transaction.update(roomRef, {
                active_members: activeMembers,
                active_member_count: Object.keys(activeMembers).length,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });
    } catch (error) {
        console.error('Error updating room presence:', error);
    }
}

/**
 * Join match as viewer - explicit call when starting to watch
 */
exports.joinMatchAsViewer = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id, league_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const playerName = getPlayerName(player);
            const now = admin.firestore.FieldValue.serverTimestamp();

            // Update match viewers
            await updateMatchViewers(match_id, player.id, playerName, true);

            // Update player's activity
            await db.collection('presence_heartbeats').doc(player.id).update({
                activity: {
                    type: ACTIVITY_TYPES.WATCHING_MATCH,
                    match_id: match_id,
                    started_at: now
                },
                context: {
                    match_id: match_id,
                    league_id: league_id || null
                },
                last_heartbeat: now
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error joining match as viewer:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Leave match as viewer - explicit call when stopping to watch
 */
exports.leaveMatchAsViewer = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();

            // Remove from match viewers
            await updateMatchViewers(match_id, player.id, null, false);

            // Clear player's match viewing activity
            await db.collection('presence_heartbeats').doc(player.id).update({
                activity: null,
                'context.match_id': null,
                last_heartbeat: now
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error leaving match as viewer:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get match viewers
 */
exports.getMatchViewers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, match_id } = req.body;

            if (!player_pin || !match_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const viewersDoc = await db.collection('match_viewers').doc(match_id).get();

            let viewers = [];
            let viewerCount = 0;

            if (viewersDoc.exists) {
                const data = viewersDoc.data();
                viewerCount = data.viewer_count || 0;

                // Convert viewers map to array
                if (data.viewers) {
                    viewers = Object.entries(data.viewers).map(([id, info]) => ({
                        player_id: id,
                        player_name: info.player_name,
                        joined_at: info.joined_at?.toDate?.()?.toISOString() || null
                    }));
                }
            }

            res.json({
                success: true,
                viewers: viewers,
                viewer_count: viewerCount
            });

        } catch (error) {
            console.error('Error getting match viewers:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// TYPING INDICATORS
// ============================================================================

/**
 * Set typing status in a chat room
 */
exports.setTypingStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, room_id, is_typing } = req.body;

            if (!player_pin || !room_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const playerName = getPlayerName(player);
            const typingRef = db.collection('chat_rooms').doc(room_id).collection('typing').doc(player.id);

            if (is_typing) {
                await typingRef.set({
                    player_id: player.id,
                    player_name: playerName,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await typingRef.delete().catch(() => {
                    // Ignore if doesn't exist
                });
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Error setting typing status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get typing users in a room
 */
exports.getTypingUsers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, room_id } = req.body;

            if (!player_pin || !room_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const typingSnapshot = await db.collection('chat_rooms').doc(room_id).collection('typing').get();

            const fiveSecondsAgo = new Date(Date.now() - TYPING_TIMEOUT_MS);
            const typingUsers = [];

            typingSnapshot.forEach(doc => {
                if (doc.id === player.id) return; // Exclude self

                const data = doc.data();
                const timestamp = data.timestamp?.toDate?.() || new Date(0);

                if (timestamp > fiveSecondsAgo) {
                    typingUsers.push({
                        player_id: doc.id,
                        player_name: data.player_name
                    });
                }
            });

            res.json({ success: true, typing_users: typingUsers });

        } catch (error) {
            console.error('Error getting typing users:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// PRESENCE QUERIES
// ============================================================================

/**
 * Get online players (optionally filtered by context)
 */
exports.getOnlinePlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, context, league_id, team_id, match_id } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get heartbeats from last 5 minutes
            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

            let query = db.collection('presence_heartbeats')
                .where('last_heartbeat', '>=', fiveMinutesAgo);

            const heartbeatsSnapshot = await query.limit(200).get();

            let onlinePlayers = [];

            heartbeatsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'offline') return;

                onlinePlayers.push({
                    player_id: doc.id,
                    player_name: data.player_name,
                    status: data.status,
                    activity: data.activity,
                    current_page: data.current_page,
                    context: data.context,
                    last_heartbeat: data.last_heartbeat?.toDate?.()?.toISOString() || null
                });
            });

            // Filter by context if provided
            if (context === 'league' && league_id) {
                // Get league participants
                const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
                const leaguePlayerIds = new Set(playersSnap.docs.map(d => d.id));
                onlinePlayers = onlinePlayers.filter(p => leaguePlayerIds.has(p.player_id));
            } else if (context === 'match' && match_id) {
                // Filter to players watching this match
                onlinePlayers = onlinePlayers.filter(p =>
                    p.context?.match_id === match_id ||
                    p.activity?.match_id === match_id
                );
            } else if (context === 'team' && team_id && league_id) {
                // Get team members
                const playersSnap = await db.collection('leagues').doc(league_id).collection('players')
                    .where('team_id', '==', team_id)
                    .get();
                const teamPlayerIds = new Set(playersSnap.docs.map(d => d.id));
                onlinePlayers = onlinePlayers.filter(p => teamPlayerIds.has(p.player_id));
            }

            res.json({
                success: true,
                online_players: onlinePlayers,
                count: onlinePlayers.length
            });

        } catch (error) {
            console.error('Error getting online players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get presence for specific players (batch lookup)
 */
exports.getPlayerPresence = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, player_ids } = req.body;

            if (!player_pin || !player_ids || !Array.isArray(player_ids)) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

            const presenceMap = {};

            // Batch fetch heartbeats (max 10 at a time for Firestore)
            const batches = [];
            for (let i = 0; i < player_ids.length; i += 10) {
                batches.push(player_ids.slice(i, i + 10));
            }

            for (const batch of batches) {
                const promises = batch.map(id =>
                    db.collection('presence_heartbeats').doc(id).get()
                );
                const docs = await Promise.all(promises);

                docs.forEach(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        const lastHeartbeat = data.last_heartbeat?.toDate?.();
                        const isOnline = lastHeartbeat && lastHeartbeat > fiveMinutesAgo;

                        presenceMap[doc.id] = {
                            status: isOnline ? data.status : 'offline',
                            last_seen_at: lastHeartbeat?.toISOString() || null,
                            current_page: isOnline ? data.current_page : null,
                            activity: isOnline ? data.activity : null,
                            custom_status: data.custom_status || null
                        };
                    } else {
                        presenceMap[doc.id] = {
                            status: 'offline',
                            last_seen_at: null,
                            current_page: null,
                            activity: null,
                            custom_status: null
                        };
                    }
                });
            }

            res.json({ success: true, presence: presenceMap });

        } catch (error) {
            console.error('Error getting player presence:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get player profile (public view with presence)
 */
exports.getPlayerPublicProfile = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, target_player_id } = req.body;

            if (!player_pin || !target_player_id) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const targetDoc = await db.collection('players').doc(target_player_id).get();
            if (!targetDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const targetData = targetDoc.data();

            // Get presence
            const heartbeatDoc = await db.collection('presence_heartbeats').doc(target_player_id).get();
            let presence = { status: 'offline', last_seen_at: null, activity: null };

            if (heartbeatDoc.exists) {
                const hbData = heartbeatDoc.data();
                const fiveMinutesAgo = new Date();
                fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
                const lastHeartbeat = hbData.last_heartbeat?.toDate?.();
                const isOnline = lastHeartbeat && lastHeartbeat > fiveMinutesAgo;

                presence = {
                    status: isOnline ? hbData.status : 'offline',
                    last_seen_at: lastHeartbeat?.toISOString() || null,
                    activity: isOnline ? hbData.activity : null,
                    custom_status: hbData.custom_status || null
                };
            }

            // Build public profile
            const publicProfile = {
                id: target_player_id,
                name: targetData.name || `${targetData.first_name} ${targetData.last_name}`,
                photo_url: targetData.photo_url || null,
                presence: presence,
                profile: targetData.profile || {},
                social: targetData.social || {},
                achievements: targetData.achievements || { unlocked: [], total_points: 0, showcase: [] },
                streaks: targetData.streaks || { current_win_streak: 0, is_hot: false },
                stats: {
                    matches_played: targetData.stats?.matches_played || 0,
                    matches_won: targetData.stats?.matches_won || 0,
                    average: targetData.stats?.average || 0,
                    high_checkout: targetData.stats?.high_checkout || 0,
                    ton_eighties: targetData.stats?.ton_eighties || 0
                }
            };

            res.json({ success: true, player: publicProfile });

        } catch (error) {
            console.error('Error getting player profile:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Update player profile (enhanced fields)
 */
exports.updatePlayerProfile = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, profile_data } = req.body;

            if (!player_pin || !profile_data) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Validate and sanitize profile fields
            const updates = {};

            if (profile_data.status_message !== undefined) {
                updates['profile.status_message'] = (profile_data.status_message || '').slice(0, 100);
            }

            if (profile_data.bio !== undefined) {
                updates['profile.bio'] = (profile_data.bio || '').slice(0, 250);
            }

            if (profile_data.favorite_game !== undefined) {
                if (['x01', 'cricket', 'both'].includes(profile_data.favorite_game)) {
                    updates['profile.favorite_game'] = profile_data.favorite_game;
                }
            }

            if (profile_data.home_bar !== undefined) {
                updates['profile.home_bar'] = (profile_data.home_bar || '').slice(0, 100);
            }

            if (profile_data.playing_since !== undefined) {
                updates['profile.playing_since'] = profile_data.playing_since;
            }

            if (profile_data.social_links !== undefined) {
                updates['profile.social_links'] = {
                    facebook: (profile_data.social_links.facebook || '').slice(0, 200),
                    instagram: (profile_data.social_links.instagram || '').slice(0, 200)
                };
            }

            updates['profile.updated_at'] = admin.firestore.FieldValue.serverTimestamp();

            await db.collection('players').doc(player.id).update(updates);

            res.json({ success: true, message: 'Profile updated' });

        } catch (error) {
            console.error('Error updating player profile:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

/**
 * Clean up stale presence data and typing indicators
 * Call this periodically (e.g., via scheduled function or manual trigger)
 */
exports.cleanupStalePresence = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);

            // Clean up stale heartbeats (mark as offline)
            const staleHeartbeats = await db.collection('presence_heartbeats')
                .where('last_heartbeat', '<', tenMinutesAgo)
                .where('status', '!=', 'offline')
                .limit(100)
                .get();

            const batch = db.batch();
            let cleanedCount = 0;

            staleHeartbeats.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'offline',
                    activity: null,
                    context: null
                });
                cleanedCount++;
            });

            if (cleanedCount > 0) {
                await batch.commit();
            }

            // Clean up old typing indicators from all chat rooms
            const chatRoomsSnap = await db.collection('chat_rooms').limit(50).get();
            let typingCleanedCount = 0;

            for (const roomDoc of chatRoomsSnap.docs) {
                const typingSnap = await roomDoc.ref.collection('typing')
                    .where('timestamp', '<', fiveSecondsAgo)
                    .get();

                const typingBatch = db.batch();
                typingSnap.forEach(doc => {
                    typingBatch.delete(doc.ref);
                    typingCleanedCount++;
                });

                if (!typingSnap.empty) {
                    await typingBatch.commit();
                }
            }

            // Clean up stale match viewers
            const matchViewersSnap = await db.collection('match_viewers').get();
            let viewersCleanedCount = 0;

            for (const viewerDoc of matchViewersSnap.docs) {
                const data = viewerDoc.data();
                const viewers = data.viewers || {};
                let modified = false;

                for (const [playerId, info] of Object.entries(viewers)) {
                    const lastSeen = info.last_seen?.toDate?.() || new Date(0);
                    if (lastSeen < tenMinutesAgo) {
                        delete viewers[playerId];
                        modified = true;
                        viewersCleanedCount++;
                    }
                }

                if (modified) {
                    await viewerDoc.ref.update({
                        viewers: viewers,
                        viewer_count: Object.keys(viewers).length
                    });
                }
            }

            logger.info(`Presence cleanup: ${cleanedCount} heartbeats, ${typingCleanedCount} typing, ${viewersCleanedCount} viewers`);

            res.json({
                success: true,
                cleaned: {
                    heartbeats: cleanedCount,
                    typing_indicators: typingCleanedCount,
                    stale_viewers: viewersCleanedCount
                }
            });

        } catch (error) {
            console.error('Error cleaning up presence:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
