/**
 * BRDC Friend System - Social Connections
 * Handles friend requests, friend management, blocking, and friend discovery
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

/**
 * Verify player by PIN and return player data
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
 * Generate sorted friendship ID from two user IDs
 * This ensures uniqueness regardless of who initiated
 */
function getFriendshipId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

/**
 * Check if two players are friends
 */
async function areFriends(userId1, userId2) {
    const friendshipId = getFriendshipId(userId1, userId2);
    const doc = await db.collection('friendships').doc(friendshipId).get();
    return doc.exists && doc.data().status === 'accepted';
}

/**
 * Check if player is blocked by another player
 */
async function isBlocked(userId1, userId2) {
    const friendshipId = getFriendshipId(userId1, userId2);
    const doc = await db.collection('friendships').doc(friendshipId).get();
    return doc.exists && doc.data().status === 'blocked';
}

/**
 * Update player's friends array and count
 */
async function updatePlayerFriends(playerId, friendId, action) {
    const playerRef = db.collection('players').doc(playerId);
    if (action === 'add') {
        await playerRef.update({
            friends: admin.firestore.FieldValue.arrayUnion(friendId),
            friend_count: admin.firestore.FieldValue.increment(1)
        });
    } else if (action === 'remove') {
        await playerRef.update({
            friends: admin.firestore.FieldValue.arrayRemove(friendId),
            friend_count: admin.firestore.FieldValue.increment(-1)
        });
    }
}

/**
 * Create notification for friend-related events
 */
async function createFriendNotification(recipientId, type, data) {
    await db.collection('notifications').add({
        recipient_id: recipientId,
        type: type,  // 'friend_request', 'friend_accepted'
        data: data,
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Get player display info (name, avatar, stats, etc.)
 */
async function getPlayerDisplayInfo(playerId) {
    const playerDoc = await db.collection('players').doc(playerId).get();
    if (!playerDoc.exists) return null;

    const data = playerDoc.data();
    const name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';

    return {
        id: playerId,
        name: name,
        avatar: data.photo_url || data.avatar || null,
        is_online: data.presence?.online || false,
        last_seen: data.presence?.last_seen || null,
        stats: {
            three_dart_avg: data.stats?.x01_three_dart_avg || data.unified_stats?.x01_three_dart_avg || null,
            mpr: data.stats?.cricket_mpr || data.unified_stats?.cricket_mpr || null
        },
        team_name: data.team_name || null,
        league_name: data.league_name || null
    };
}

// ===================================================================
// FRIEND REQUEST FUNCTIONS
// ===================================================================

/**
 * Send a friend request to another player
 * POST /sendFriendRequest
 * Body: { player_pin, target_id }
 */
exports.sendFriendRequest = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, target_id } = req.body;

            if (!player_pin || !target_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and target_id'
                });
            }

            // Verify requesting player
            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const requesterId = player.id;

            // Can't friend yourself
            if (requesterId === target_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot send friend request to yourself'
                });
            }

            // Check if target exists
            const targetDoc = await db.collection('players').doc(target_id).get();
            if (!targetDoc.exists) {
                return res.status(404).json({ success: false, error: 'Target player not found' });
            }
            const targetData = targetDoc.data();
            const targetName = targetData.name || `${targetData.first_name || ''} ${targetData.last_name || ''}`.trim();

            // Check for existing friendship/request
            const friendshipId = getFriendshipId(requesterId, target_id);
            const existingDoc = await db.collection('friendships').doc(friendshipId).get();

            if (existingDoc.exists) {
                const existing = existingDoc.data();
                if (existing.status === 'accepted') {
                    return res.status(400).json({
                        success: false,
                        error: 'Already friends with this player'
                    });
                }
                if (existing.status === 'pending') {
                    // If target already sent a request, auto-accept
                    if (existing.requester_id === target_id) {
                        await db.collection('friendships').doc(friendshipId).update({
                            status: 'accepted',
                            accepted_at: admin.firestore.FieldValue.serverTimestamp()
                        });

                        // Update both players' friend lists
                        await updatePlayerFriends(requesterId, target_id, 'add');
                        await updatePlayerFriends(target_id, requesterId, 'add');

                        // Notify the original requester
                        const requesterName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
                        await createFriendNotification(target_id, 'friend_accepted', {
                            friend_id: requesterId,
                            friend_name: requesterName
                        });

                        return res.json({
                            success: true,
                            friendship_id: friendshipId,
                            status: 'accepted',
                            message: 'Friend request auto-accepted (they already sent you a request)'
                        });
                    }
                    return res.status(400).json({
                        success: false,
                        error: 'Friend request already pending'
                    });
                }
                if (existing.status === 'blocked') {
                    // Check who blocked whom
                    if (existing.blocker_id === target_id) {
                        return res.status(403).json({
                            success: false,
                            error: 'Cannot send friend request to this player'
                        });
                    }
                    // If requester blocked target, they need to unblock first
                    return res.status(400).json({
                        success: false,
                        error: 'You have blocked this player. Unblock them first.'
                    });
                }
            }

            // Create new friend request
            const requesterName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim();

            await db.collection('friendships').doc(friendshipId).set({
                id: friendshipId,
                users: [requesterId, target_id],
                status: 'pending',
                requester_id: requesterId,
                requester_name: requesterName,
                target_id: target_id,
                target_name: targetName,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                accepted_at: null
            });

            // Create notification for target player
            await createFriendNotification(target_id, 'friend_request', {
                friendship_id: friendshipId,
                requester_id: requesterId,
                requester_name: requesterName
            });

            res.json({
                success: true,
                friendship_id: friendshipId,
                status: 'pending',
                message: `Friend request sent to ${targetName}`
            });

        } catch (error) {
            console.error('Error sending friend request:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Accept a pending friend request
 * POST /acceptFriendRequest
 * Body: { player_pin, friendship_id }
 */
exports.acceptFriendRequest = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, friendship_id } = req.body;

            if (!player_pin || !friendship_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and friendship_id'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get friendship document
            const friendshipDoc = await db.collection('friendships').doc(friendship_id).get();
            if (!friendshipDoc.exists) {
                return res.status(404).json({ success: false, error: 'Friend request not found' });
            }

            const friendship = friendshipDoc.data();

            // Verify player is the target (recipient) of the request
            if (friendship.target_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only accept friend requests sent to you'
                });
            }

            if (friendship.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot accept request with status: ${friendship.status}`
                });
            }

            // Accept the request
            await db.collection('friendships').doc(friendship_id).update({
                status: 'accepted',
                accepted_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update both players' friend lists
            await updatePlayerFriends(player.id, friendship.requester_id, 'add');
            await updatePlayerFriends(friendship.requester_id, player.id, 'add');

            // Notify the requester
            const accepterName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
            await createFriendNotification(friendship.requester_id, 'friend_accepted', {
                friendship_id: friendship_id,
                friend_id: player.id,
                friend_name: accepterName
            });

            res.json({
                success: true,
                message: `You are now friends with ${friendship.requester_name}`
            });

        } catch (error) {
            console.error('Error accepting friend request:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Decline a pending friend request
 * POST /declineFriendRequest
 * Body: { player_pin, friendship_id }
 */
exports.declineFriendRequest = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, friendship_id } = req.body;

            if (!player_pin || !friendship_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and friendship_id'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const friendshipDoc = await db.collection('friendships').doc(friendship_id).get();
            if (!friendshipDoc.exists) {
                return res.status(404).json({ success: false, error: 'Friend request not found' });
            }

            const friendship = friendshipDoc.data();

            // Verify player is involved in this request
            if (!friendship.users.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not involved in this friend request'
                });
            }

            if (friendship.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot decline request with status: ${friendship.status}`
                });
            }

            // Delete the friendship document
            await db.collection('friendships').doc(friendship_id).delete();

            res.json({
                success: true,
                message: 'Friend request declined'
            });

        } catch (error) {
            console.error('Error declining friend request:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Remove an existing friendship
 * POST /removeFriend
 * Body: { player_pin, friendship_id } OR { player_pin, friend_id }
 */
exports.removeFriend = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, friendship_id, friend_id } = req.body;

            if (!player_pin || (!friendship_id && !friend_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and (friendship_id or friend_id)'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get friendship ID either directly or by computing from friend_id
            let actualFriendshipId = friendship_id;
            if (!actualFriendshipId && friend_id) {
                actualFriendshipId = getFriendshipId(player.id, friend_id);
            }

            const friendshipDoc = await db.collection('friendships').doc(actualFriendshipId).get();
            if (!friendshipDoc.exists) {
                return res.status(404).json({ success: false, error: 'Friendship not found' });
            }

            const friendship = friendshipDoc.data();

            // Verify player is part of this friendship
            if (!friendship.users.includes(player.id)) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not part of this friendship'
                });
            }

            if (friendship.status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: 'This is not an active friendship'
                });
            }

            // Get the other user's ID
            const otherUserId = friendship.users.find(id => id !== player.id);

            // Delete the friendship
            await db.collection('friendships').doc(actualFriendshipId).delete();

            // Update both players' friend lists
            await updatePlayerFriends(player.id, otherUserId, 'remove');
            await updatePlayerFriends(otherUserId, player.id, 'remove');

            res.json({
                success: true,
                message: 'Friend removed successfully'
            });

        } catch (error) {
            console.error('Error removing friend:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===================================================================
// BLOCKING FUNCTIONS
// ===================================================================

/**
 * Block a player
 * POST /blockPlayer
 * Body: { player_pin, blocked_id }
 */
exports.blockPlayer = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, blocked_id } = req.body;

            if (!player_pin || !blocked_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and blocked_id'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            if (player.id === blocked_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot block yourself'
                });
            }

            // Check if blocked player exists
            const blockedDoc = await db.collection('players').doc(blocked_id).get();
            if (!blockedDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const friendshipId = getFriendshipId(player.id, blocked_id);
            const existingDoc = await db.collection('friendships').doc(friendshipId).get();

            if (existingDoc.exists) {
                const existing = existingDoc.data();

                // If they were friends, remove from friend lists first
                if (existing.status === 'accepted') {
                    await updatePlayerFriends(player.id, blocked_id, 'remove');
                    await updatePlayerFriends(blocked_id, player.id, 'remove');
                }

                // Update to blocked status
                await db.collection('friendships').doc(friendshipId).update({
                    status: 'blocked',
                    blocker_id: player.id,
                    blocked_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Create new blocked relationship
                await db.collection('friendships').doc(friendshipId).set({
                    id: friendshipId,
                    users: [player.id, blocked_id],
                    status: 'blocked',
                    blocker_id: player.id,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    blocked_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // Add to blocker's blocked array
            await db.collection('players').doc(player.id).update({
                blocked: admin.firestore.FieldValue.arrayUnion(blocked_id)
            });

            res.json({
                success: true,
                message: 'Player blocked successfully'
            });

        } catch (error) {
            console.error('Error blocking player:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Unblock a previously blocked player
 * POST /unblockPlayer
 * Body: { player_pin, blocked_id }
 */
exports.unblockPlayer = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, blocked_id } = req.body;

            if (!player_pin || !blocked_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and blocked_id'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const friendshipId = getFriendshipId(player.id, blocked_id);
            const friendshipDoc = await db.collection('friendships').doc(friendshipId).get();

            if (!friendshipDoc.exists) {
                return res.status(404).json({ success: false, error: 'Block relationship not found' });
            }

            const friendship = friendshipDoc.data();

            if (friendship.status !== 'blocked') {
                return res.status(400).json({
                    success: false,
                    error: 'This player is not blocked'
                });
            }

            // Verify this player was the blocker
            if (friendship.blocker_id !== player.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You did not block this player'
                });
            }

            // Delete the blocked relationship
            await db.collection('friendships').doc(friendshipId).delete();

            // Remove from blocked array
            await db.collection('players').doc(player.id).update({
                blocked: admin.firestore.FieldValue.arrayRemove(blocked_id)
            });

            res.json({
                success: true,
                message: 'Player unblocked successfully'
            });

        } catch (error) {
            console.error('Error unblocking player:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===================================================================
// FRIEND LIST FUNCTIONS
// ===================================================================

/**
 * Get a player's friend list
 * POST /getFriends
 * Body: { player_pin, filter?, limit? }
 * filter: 'all' | 'online' | 'in_league'
 */
exports.getFriends = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, filter, limit: resultLimit, league_id } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const queryLimit = Math.min(resultLimit || 50, 100);

            // Get all accepted friendships for this player
            const friendshipsSnapshot = await db.collection('friendships')
                .where('users', 'array-contains', player.id)
                .where('status', '==', 'accepted')
                .get();

            // Get friend IDs
            const friendIds = [];
            const friendshipDates = {};

            friendshipsSnapshot.forEach(doc => {
                const data = doc.data();
                const friendId = data.users.find(id => id !== player.id);
                if (friendId) {
                    friendIds.push(friendId);
                    friendshipDates[friendId] = data.accepted_at;
                }
            });

            if (friendIds.length === 0) {
                return res.json({
                    success: true,
                    friends: [],
                    total: 0
                });
            }

            // Get friend details (batch in groups of 10 for Firestore)
            const friends = [];
            const batches = [];
            for (let i = 0; i < friendIds.length; i += 10) {
                batches.push(friendIds.slice(i, i + 10));
            }

            for (const batch of batches) {
                const friendDocs = await db.collection('players')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();

                friendDocs.forEach(doc => {
                    const data = doc.data();
                    const friendInfo = {
                        id: doc.id,
                        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                        avatar: data.photo_url || data.avatar || null,
                        is_online: data.presence?.online || false,
                        last_seen: data.presence?.last_seen || null,
                        stats: {
                            three_dart_avg: data.stats?.x01_three_dart_avg || data.unified_stats?.x01_three_dart_avg || null,
                            mpr: data.stats?.cricket_mpr || data.unified_stats?.cricket_mpr || null
                        },
                        team_name: data.team_name || null,
                        league_name: data.league_name || null,
                        friendship_date: friendshipDates[doc.id]
                    };

                    // Check involvements for league info
                    if (data.involvements?.leagues?.length > 0) {
                        const leagueInfo = data.involvements.leagues[0];
                        friendInfo.league_name = friendInfo.league_name || leagueInfo.name;
                        friendInfo.league_id = leagueInfo.id;
                    }

                    friends.push(friendInfo);
                });
            }

            // Apply filters
            let filteredFriends = friends;

            if (filter === 'online') {
                filteredFriends = friends.filter(f => f.is_online);
            } else if (filter === 'in_league' && league_id) {
                filteredFriends = friends.filter(f => f.league_id === league_id);
            }

            // Sort by online status, then by name
            filteredFriends.sort((a, b) => {
                if (a.is_online && !b.is_online) return -1;
                if (!a.is_online && b.is_online) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });

            // Apply limit
            filteredFriends = filteredFriends.slice(0, queryLimit);

            res.json({
                success: true,
                friends: filteredFriends,
                total: friends.length,
                filtered_count: filteredFriends.length
            });

        } catch (error) {
            console.error('Error getting friends:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get pending friend requests for a player
 * POST /getFriendRequests
 * Body: { player_pin }
 */
exports.getFriendRequests = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            // Get incoming requests (requests TO this player)
            const incomingSnapshot = await db.collection('friendships')
                .where('target_id', '==', player.id)
                .where('status', '==', 'pending')
                .orderBy('created_at', 'desc')
                .get();

            const incoming = [];
            for (const doc of incomingSnapshot.docs) {
                const data = doc.data();
                const requesterInfo = await getPlayerDisplayInfo(data.requester_id);
                incoming.push({
                    friendship_id: doc.id,
                    requester_id: data.requester_id,
                    requester_name: data.requester_name,
                    requester_info: requesterInfo,
                    created_at: data.created_at
                });
            }

            // Get outgoing requests (requests FROM this player)
            const outgoingSnapshot = await db.collection('friendships')
                .where('requester_id', '==', player.id)
                .where('status', '==', 'pending')
                .orderBy('created_at', 'desc')
                .get();

            const outgoing = [];
            for (const doc of outgoingSnapshot.docs) {
                const data = doc.data();
                const targetInfo = await getPlayerDisplayInfo(data.target_id);
                outgoing.push({
                    friendship_id: doc.id,
                    target_id: data.target_id,
                    target_name: data.target_name,
                    target_info: targetInfo,
                    created_at: data.created_at
                });
            }

            res.json({
                success: true,
                incoming: incoming,
                outgoing: outgoing,
                incoming_count: incoming.length,
                outgoing_count: outgoing.length
            });

        } catch (error) {
            console.error('Error getting friend requests:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===================================================================
// PLAYER SEARCH & SUGGESTIONS
// ===================================================================

/**
 * Search for players to add as friends
 * POST /searchPlayers
 * Body: { player_pin, query, filter?, limit? }
 * filter: 'in_leagues' | 'nearby' | null
 */
exports.searchPlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, query, filter, limit: resultLimit } = req.body;

            if (!player_pin || !query) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and query'
                });
            }

            if (query.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Query must be at least 2 characters'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const queryLimit = Math.min(resultLimit || 20, 50);

            // Get player's blocked list and existing friends
            const blockedList = player.blocked || [];
            const friendsList = player.friends || [];

            // Search by name (case-insensitive prefix search)
            // Firestore doesn't support true full-text search, so we use startAt/endAt
            const queryLower = query.toLowerCase();
            const queryUpper = query.toLowerCase() + '\uf8ff';

            // Try searching by name field
            const nameSnapshot = await db.collection('players')
                .where('name_lower', '>=', queryLower)
                .where('name_lower', '<=', queryUpper)
                .limit(queryLimit * 2)  // Get extra to filter
                .get();

            const results = [];
            const seenIds = new Set();

            nameSnapshot.forEach(doc => {
                const id = doc.id;
                // Exclude self, blocked users, and existing friends
                if (id === player.id) return;
                if (blockedList.includes(id)) return;
                if (seenIds.has(id)) return;

                seenIds.add(id);
                const data = doc.data();

                // Check if blocked by this user
                if (data.blocked?.includes(player.id)) return;

                results.push({
                    id: id,
                    name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                    avatar: data.photo_url || data.avatar || null,
                    is_online: data.presence?.online || false,
                    stats: {
                        three_dart_avg: data.stats?.x01_three_dart_avg || null,
                        mpr: data.stats?.cricket_mpr || null
                    },
                    is_friend: friendsList.includes(id),
                    has_pending_request: false  // Will check below
                });
            });

            // Also search by first_name and last_name if needed
            if (results.length < queryLimit) {
                const firstNameSnapshot = await db.collection('players')
                    .where('first_name_lower', '>=', queryLower)
                    .where('first_name_lower', '<=', queryUpper)
                    .limit(queryLimit)
                    .get();

                firstNameSnapshot.forEach(doc => {
                    const id = doc.id;
                    if (id === player.id) return;
                    if (blockedList.includes(id)) return;
                    if (seenIds.has(id)) return;

                    seenIds.add(id);
                    const data = doc.data();

                    if (data.blocked?.includes(player.id)) return;

                    results.push({
                        id: id,
                        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                        avatar: data.photo_url || data.avatar || null,
                        is_online: data.presence?.online || false,
                        stats: {
                            three_dart_avg: data.stats?.x01_three_dart_avg || null,
                            mpr: data.stats?.cricket_mpr || null
                        },
                        is_friend: friendsList.includes(id),
                        has_pending_request: false
                    });
                });
            }

            // Check for pending requests
            for (const result of results) {
                const friendshipId = getFriendshipId(player.id, result.id);
                const friendshipDoc = await db.collection('friendships').doc(friendshipId).get();
                if (friendshipDoc.exists && friendshipDoc.data().status === 'pending') {
                    result.has_pending_request = true;
                }
            }

            // Apply filter if provided
            let filteredResults = results;
            if (filter === 'in_leagues') {
                // Filter to only players in same leagues
                const playerLeagues = new Set(
                    (player.involvements?.leagues || []).map(l => l.id)
                );
                if (playerLeagues.size > 0) {
                    filteredResults = results.filter(r => {
                        // Would need to check each player's leagues - expensive, skip for now
                        return true;
                    });
                }
            }

            // Limit results
            filteredResults = filteredResults.slice(0, queryLimit);

            res.json({
                success: true,
                players: filteredResults,
                total: filteredResults.length
            });

        } catch (error) {
            console.error('Error searching players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get suggested friends based on mutual connections and leagues
 * POST /getSuggestedFriends
 * Body: { player_pin, limit? }
 */
exports.getSuggestedFriends = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, limit: resultLimit } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const queryLimit = Math.min(resultLimit || 10, 30);
            const blockedList = player.blocked || [];
            const friendsList = player.friends || [];
            const suggestions = [];
            const seenIds = new Set([player.id, ...friendsList, ...blockedList]);

            // Strategy 1: Players in the same leagues
            const playerLeagues = player.involvements?.leagues || [];
            for (const league of playerLeagues.slice(0, 3)) {  // Limit to 3 leagues
                const leagueDoc = await db.collection('leagues').doc(league.id).get();
                if (!leagueDoc.exists) continue;

                // Get players from this league
                const playersSnapshot = await db.collection('leagues')
                    .doc(league.id)
                    .collection('players')
                    .limit(20)
                    .get();

                for (const playerDoc of playersSnapshot.docs) {
                    const leaguePlayerId = playerDoc.id;
                    if (seenIds.has(leaguePlayerId)) continue;
                    seenIds.add(leaguePlayerId);

                    // Get global player info
                    const globalDoc = await db.collection('players').doc(leaguePlayerId).get();
                    if (!globalDoc.exists) continue;

                    const data = globalDoc.data();
                    if (data.blocked?.includes(player.id)) continue;

                    suggestions.push({
                        id: leaguePlayerId,
                        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                        avatar: data.photo_url || data.avatar || null,
                        is_online: data.presence?.online || false,
                        stats: {
                            three_dart_avg: data.stats?.x01_three_dart_avg || null,
                            mpr: data.stats?.cricket_mpr || null
                        },
                        reason: `In your league: ${league.name || 'League'}`,
                        mutual_count: 0,
                        score: 10  // Base score for same league
                    });
                }

                if (suggestions.length >= queryLimit * 2) break;
            }

            // Strategy 2: Mutual friends (friends of friends)
            if (friendsList.length > 0 && suggestions.length < queryLimit * 2) {
                for (const friendId of friendsList.slice(0, 5)) {  // Check first 5 friends
                    const friendDoc = await db.collection('players').doc(friendId).get();
                    if (!friendDoc.exists) continue;

                    const friendData = friendDoc.data();
                    const friendsFriends = friendData.friends || [];

                    for (const fofId of friendsFriends.slice(0, 10)) {
                        if (seenIds.has(fofId)) {
                            // If already suggested, increment mutual count
                            const existing = suggestions.find(s => s.id === fofId);
                            if (existing) {
                                existing.mutual_count++;
                                existing.score += 5;
                            }
                            continue;
                        }
                        seenIds.add(fofId);

                        const fofDoc = await db.collection('players').doc(fofId).get();
                        if (!fofDoc.exists) continue;

                        const data = fofDoc.data();
                        if (data.blocked?.includes(player.id)) continue;

                        suggestions.push({
                            id: fofId,
                            name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                            avatar: data.photo_url || data.avatar || null,
                            is_online: data.presence?.online || false,
                            stats: {
                                three_dart_avg: data.stats?.x01_three_dart_avg || null,
                                mpr: data.stats?.cricket_mpr || null
                            },
                            reason: 'Mutual friends',
                            mutual_count: 1,
                            score: 5
                        });
                    }
                }
            }

            // Sort by score (higher is better)
            suggestions.sort((a, b) => b.score - a.score);

            // Remove score field and limit
            const finalSuggestions = suggestions.slice(0, queryLimit).map(s => {
                const { score, ...rest } = s;
                return rest;
            });

            res.json({
                success: true,
                suggestions: finalSuggestions,
                total: finalSuggestions.length
            });

        } catch (error) {
            console.error('Error getting suggested friends:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ===================================================================
// FRIENDSHIP STATUS CHECK
// ===================================================================

/**
 * Check friendship status between two players
 * POST /checkFriendshipStatus
 * Body: { player_pin, target_id }
 */
exports.checkFriendshipStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, target_id } = req.body;

            if (!player_pin || !target_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: player_pin and target_id'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const friendshipId = getFriendshipId(player.id, target_id);
            const friendshipDoc = await db.collection('friendships').doc(friendshipId).get();

            if (!friendshipDoc.exists) {
                return res.json({
                    success: true,
                    status: 'none',
                    friendship_id: null,
                    can_send_request: true
                });
            }

            const friendship = friendshipDoc.data();

            let canSendRequest = false;
            let canAccept = false;
            let isBlockedBy = false;

            if (friendship.status === 'pending') {
                canAccept = friendship.target_id === player.id;
            } else if (friendship.status === 'blocked') {
                if (friendship.blocker_id !== player.id) {
                    isBlockedBy = true;
                }
            }

            res.json({
                success: true,
                status: friendship.status,
                friendship_id: friendshipId,
                requester_id: friendship.requester_id,
                can_send_request: canSendRequest,
                can_accept: canAccept,
                is_blocked_by_target: isBlockedBy,
                is_blocker: friendship.status === 'blocked' && friendship.blocker_id === player.id
            });

        } catch (error) {
            console.error('Error checking friendship status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get blocked players list
 * POST /getBlockedPlayers
 * Body: { player_pin }
 */
exports.getBlockedPlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin } = req.body;

            if (!player_pin) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: player_pin'
                });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const blockedIds = player.blocked || [];

            if (blockedIds.length === 0) {
                return res.json({
                    success: true,
                    blocked: [],
                    total: 0
                });
            }

            // Get blocked player details
            const blocked = [];
            const batches = [];
            for (let i = 0; i < blockedIds.length; i += 10) {
                batches.push(blockedIds.slice(i, i + 10));
            }

            for (const batch of batches) {
                const blockedDocs = await db.collection('players')
                    .where(admin.firestore.FieldPath.documentId(), 'in', batch)
                    .get();

                blockedDocs.forEach(doc => {
                    const data = doc.data();
                    blocked.push({
                        id: doc.id,
                        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                        avatar: data.photo_url || data.avatar || null
                    });
                });
            }

            res.json({
                success: true,
                blocked: blocked,
                total: blocked.length
            });

        } catch (error) {
            console.error('Error getting blocked players:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

module.exports = exports;
