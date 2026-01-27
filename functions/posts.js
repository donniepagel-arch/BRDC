/**
 * BRDC Social Feed - Posts System
 * Handles social posts, reactions, comments, and feed aggregation
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

// Initialize if needed
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Valid reaction types
const VALID_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

// Valid post types
const VALID_POST_TYPES = ['general', 'looking_for_partner', 'anyone_going', 'announcement'];

// Valid visibility options
const VALID_VISIBILITY = ['public', 'friends', 'league'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify player PIN and return player data
 */
async function verifyPlayerPin(pin) {
    if (!pin) return null;

    const playersSnapshot = await db.collection('players')
        .where('pin', '==', pin)
        .limit(1)
        .get();

    if (playersSnapshot.empty) return null;

    const doc = playersSnapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
}

/**
 * Get player info for embedding in posts/comments
 */
async function getPlayerInfo(playerId) {
    const doc = await db.collection('players').doc(playerId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    const name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown Player';

    return {
        id: playerId,
        name: name,
        avatar: data.photo_url || null
    };
}

/**
 * Create empty reactions object
 */
function createEmptyReactions() {
    return {
        like: [],
        love: [],
        haha: [],
        wow: [],
        sad: [],
        angry: [],
        total: 0
    };
}

/**
 * Get recent match results for a player's leagues
 */
async function getMatchResults(playerId, limit = 10) {
    const results = [];

    try {
        // Get player's league involvements
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) return results;

        const playerData = playerDoc.data();
        const involvements = playerData.involvements || {};
        const leagueIds = new Set();

        // Gather league IDs
        (involvements.leagues || []).forEach(l => leagueIds.add(l.id));
        (involvements.captaining || []).forEach(c => leagueIds.add(c.league_id));

        if (leagueIds.size === 0) return results;

        // Query completed matches from each league
        for (const leagueId of leagueIds) {
            const matchesSnap = await db.collection('leagues')
                .doc(leagueId)
                .collection('matches')
                .where('status', '==', 'completed')
                .orderBy('match_date', 'desc')
                .limit(5)
                .get();

            // Get league name for context
            const leagueDoc = await db.collection('leagues').doc(leagueId).get();
            const leagueName = leagueDoc.exists ? leagueDoc.data().name : 'Unknown League';

            for (const matchDoc of matchesSnap.docs) {
                const match = matchDoc.data();

                // Get team names
                const homeTeamDoc = await db.collection('leagues')
                    .doc(leagueId)
                    .collection('teams')
                    .doc(match.home_team_id)
                    .get();
                const awayTeamDoc = await db.collection('leagues')
                    .doc(leagueId)
                    .collection('teams')
                    .doc(match.away_team_id)
                    .get();

                results.push({
                    id: `match_${leagueId}_${matchDoc.id}`,
                    type: 'match_result',
                    author_id: 'system',
                    author_name: 'Match Result',
                    author_avatar: null,
                    content: {
                        league_id: leagueId,
                        league_name: leagueName,
                        match_id: matchDoc.id,
                        home_team: homeTeamDoc.exists ? homeTeamDoc.data().name : 'Unknown',
                        away_team: awayTeamDoc.exists ? awayTeamDoc.data().name : 'Unknown',
                        home_score: match.home_score || 0,
                        away_score: match.away_score || 0,
                        week: match.week
                    },
                    event_info: {
                        type: 'league',
                        id: leagueId,
                        name: leagueName
                    },
                    reactions: createEmptyReactions(),
                    comment_count: 0,
                    created_at: match.completed_at || match.match_date,
                    source_collection: `leagues/${leagueId}/matches`
                });
            }
        }

        // Sort by date and limit
        results.sort((a, b) => {
            const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
            const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
            return dateB - dateA;
        });

        return results.slice(0, limit);

    } catch (error) {
        console.error('Error getting match results:', error);
        return results;
    }
}

/**
 * Get new events (tournaments/leagues)
 */
async function getNewEvents(limit = 10) {
    const events = [];

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Get recent tournaments
        const tournamentsSnap = await db.collection('tournaments')
            .where('created_at', '>=', thirtyDaysAgo)
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();

        for (const doc of tournamentsSnap.docs) {
            const tournament = doc.data();
            events.push({
                id: `event_tournament_${doc.id}`,
                type: 'new_event',
                author_id: 'system',
                author_name: 'New Tournament',
                author_avatar: null,
                content: {
                    event_type: 'tournament',
                    event_id: doc.id,
                    event_name: tournament.tournament_name || tournament.name || 'Tournament',
                    venue: tournament.venue || null,
                    date: tournament.tournament_date || tournament.date,
                    format: tournament.format
                },
                event_info: {
                    type: 'tournament',
                    id: doc.id,
                    name: tournament.tournament_name || tournament.name
                },
                reactions: createEmptyReactions(),
                comment_count: 0,
                created_at: tournament.created_at,
                source_collection: 'tournaments'
            });
        }

        // Get recent leagues
        const leaguesSnap = await db.collection('leagues')
            .where('created_at', '>=', thirtyDaysAgo)
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();

        for (const doc of leaguesSnap.docs) {
            const league = doc.data();
            events.push({
                id: `event_league_${doc.id}`,
                type: 'new_event',
                author_id: 'system',
                author_name: 'New League',
                author_avatar: null,
                content: {
                    event_type: 'league',
                    event_id: doc.id,
                    event_name: league.name || 'League',
                    venue: league.venue || null,
                    start_date: league.start_date,
                    format: league.format
                },
                event_info: {
                    type: 'league',
                    id: doc.id,
                    name: league.name
                },
                reactions: createEmptyReactions(),
                comment_count: 0,
                created_at: league.created_at,
                source_collection: 'leagues'
            });
        }

        // Sort by date and limit
        events.sort((a, b) => {
            const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
            const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
            return dateB - dateA;
        });

        return events.slice(0, limit);

    } catch (error) {
        console.error('Error getting new events:', error);
        return events;
    }
}

/**
 * Get player's friends list
 */
async function getPlayerFriends(playerId) {
    try {
        const playerDoc = await db.collection('players').doc(playerId).get();
        if (!playerDoc.exists) return [];

        const playerData = playerDoc.data();
        return playerData.friends || [];
    } catch (error) {
        console.error('Error getting friends:', error);
        return [];
    }
}

// ============================================================================
// CREATE POST
// ============================================================================

/**
 * Create a new post in the feed
 */
exports.createPost = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                author_id,
                content,
                post_type,
                tagged_event,
                visibility
            } = req.body;

            // Validate required fields
            if (!content || (!player_pin && !author_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: author_id/player_pin and content are required'
                });
            }

            // Verify player
            let player;
            if (player_pin) {
                player = await verifyPlayerPin(player_pin);
                if (!player) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
            } else {
                player = await getPlayerInfo(author_id);
                if (!player) {
                    return res.status(404).json({ success: false, error: 'Author not found' });
                }
            }

            // Validate post_type if provided
            const finalPostType = post_type || 'general';
            if (!VALID_POST_TYPES.includes(finalPostType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid post_type. Must be one of: ${VALID_POST_TYPES.join(', ')}`
                });
            }

            // Validate visibility if provided
            const finalVisibility = visibility || 'public';
            if (!VALID_VISIBILITY.includes(finalVisibility)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}`
                });
            }

            // Validate tagged_event if provided
            let validatedTaggedEvent = null;
            if (tagged_event) {
                if (!tagged_event.type || !tagged_event.id) {
                    return res.status(400).json({
                        success: false,
                        error: 'tagged_event must have type and id'
                    });
                }
                if (!['league', 'tournament', 'match'].includes(tagged_event.type)) {
                    return res.status(400).json({
                        success: false,
                        error: 'tagged_event.type must be league, tournament, or match'
                    });
                }
                validatedTaggedEvent = {
                    type: tagged_event.type,
                    id: tagged_event.id,
                    name: tagged_event.name || ''
                };
            }

            // Create the post document
            const postData = {
                author_id: player.id,
                author_name: player.name,
                author_avatar: player.avatar || player.photo_url || null,
                content: content.trim(),
                post_type: finalPostType,
                tagged_event: validatedTaggedEvent,
                reactions: createEmptyReactions(),
                comment_count: 0,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                visibility: finalVisibility
            };

            const postRef = await db.collection('posts').add(postData);

            console.log(`Post created: ${postRef.id} by ${player.name}`);

            res.json({
                success: true,
                post_id: postRef.id
            });

        } catch (error) {
            console.error('Error creating post:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// GET FEED
// ============================================================================

/**
 * Get the aggregated news feed for a player
 */
exports.getFeed = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                player_id,
                filter,
                limit: queryLimit,
                cursor
            } = req.method === 'POST' ? req.body : req.query;

            // Validate required fields
            if (!player_pin && !player_id) {
                return res.status(400).json({
                    success: false,
                    error: 'player_id or player_pin is required'
                });
            }

            // Verify player
            let playerId;
            if (player_pin) {
                const player = await verifyPlayerPin(player_pin);
                if (!player) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
                playerId = player.id;
            } else {
                playerId = player_id;
            }

            const feedLimit = Math.min(parseInt(queryLimit) || 20, 50);
            const feedFilter = filter || 'all';

            let feedItems = [];

            // Get posts based on filter
            if (feedFilter === 'all' || feedFilter === 'friends') {
                // Get friends list
                const friends = await getPlayerFriends(playerId);
                friends.push(playerId); // Include own posts

                // Query posts from friends
                let postsQuery = db.collection('posts')
                    .where('visibility', '==', 'public')
                    .orderBy('created_at', 'desc')
                    .limit(feedLimit * 2); // Get extra to filter

                if (cursor) {
                    const cursorDoc = await db.collection('posts').doc(cursor).get();
                    if (cursorDoc.exists) {
                        postsQuery = postsQuery.startAfter(cursorDoc);
                    }
                }

                const postsSnap = await postsQuery.get();

                for (const doc of postsSnap.docs) {
                    const post = doc.data();

                    // For friends filter, only include posts from friends
                    if (feedFilter === 'friends' && !friends.includes(post.author_id)) {
                        continue;
                    }

                    feedItems.push({
                        id: doc.id,
                        type: 'post',
                        author_id: post.author_id,
                        author_name: post.author_name,
                        author_avatar: post.author_avatar,
                        content: post.content,
                        post_type: post.post_type,
                        event_info: post.tagged_event,
                        reactions: post.reactions || createEmptyReactions(),
                        comment_count: post.comment_count || 0,
                        created_at: post.created_at,
                        source_collection: 'posts'
                    });
                }
            }

            // Get match results (unless filtering for events only)
            if (feedFilter === 'all' || feedFilter === 'results') {
                const matchResults = await getMatchResults(playerId, Math.floor(feedLimit / 2));
                feedItems = feedItems.concat(matchResults);
            }

            // Get new events (unless filtering for results only)
            if (feedFilter === 'all' || feedFilter === 'events') {
                const newEvents = await getNewEvents(Math.floor(feedLimit / 2));
                feedItems = feedItems.concat(newEvents);
            }

            // Sort all items by created_at descending
            feedItems.sort((a, b) => {
                const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
                const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
                return dateB - dateA;
            });

            // Apply limit
            const limitedItems = feedItems.slice(0, feedLimit);

            // Determine next cursor
            const lastItem = limitedItems[limitedItems.length - 1];
            const nextCursor = lastItem && lastItem.type === 'post' ? lastItem.id : null;

            // Convert timestamps to ISO strings for response
            const formattedItems = limitedItems.map(item => ({
                ...item,
                created_at: item.created_at?.toDate ?
                    item.created_at.toDate().toISOString() :
                    (item.created_at ? new Date(item.created_at).toISOString() : null)
            }));

            res.json({
                success: true,
                feed: formattedItems,
                cursor: nextCursor,
                has_more: feedItems.length > feedLimit
            });

        } catch (error) {
            console.error('Error getting feed:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// ADD REACTION
// ============================================================================

/**
 * Add or change a reaction on a post
 */
exports.addPostReaction = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, post_id, player_id, reaction_type } = req.body;

            // Validate required fields
            if (!post_id || !reaction_type || (!player_pin && !player_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: post_id, player_id/player_pin, and reaction_type are required'
                });
            }

            // Verify player
            let reactorId;
            if (player_pin) {
                const player = await verifyPlayerPin(player_pin);
                if (!player) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
                reactorId = player.id;
            } else {
                reactorId = player_id;
            }

            // Validate reaction type
            if (reaction_type !== 'none' && !VALID_REACTIONS.includes(reaction_type)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid reaction_type. Must be one of: ${VALID_REACTIONS.join(', ')}, or 'none'`
                });
            }

            // Get the post
            const postRef = db.collection('posts').doc(post_id);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found' });
            }

            const post = postDoc.data();
            const reactions = post.reactions || createEmptyReactions();

            // Remove player from all reaction arrays first
            let removedCount = 0;
            for (const type of VALID_REACTIONS) {
                const index = reactions[type].indexOf(reactorId);
                if (index !== -1) {
                    reactions[type].splice(index, 1);
                    removedCount++;
                }
            }

            // Add to the new reaction type (unless 'none')
            if (reaction_type !== 'none') {
                reactions[reaction_type].push(reactorId);
            }

            // Recalculate total
            reactions.total = VALID_REACTIONS.reduce((sum, type) => sum + reactions[type].length, 0);

            // Update the post
            await postRef.update({ reactions });

            console.log(`Reaction ${reaction_type} added to post ${post_id} by ${reactorId}`);

            res.json({
                success: true,
                reactions: reactions
            });

        } catch (error) {
            console.error('Error adding reaction:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// ADD COMMENT
// ============================================================================

/**
 * Add a comment to a post
 */
exports.addComment = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, post_id, author_id, content } = req.body;

            // Validate required fields
            if (!post_id || !content || (!player_pin && !author_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: post_id, author_id/player_pin, and content are required'
                });
            }

            // Verify player
            let author;
            if (player_pin) {
                author = await verifyPlayerPin(player_pin);
                if (!author) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
            } else {
                author = await getPlayerInfo(author_id);
                if (!author) {
                    return res.status(404).json({ success: false, error: 'Author not found' });
                }
            }

            // Verify post exists
            const postRef = db.collection('posts').doc(post_id);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found' });
            }

            // Create comment document
            const commentData = {
                author_id: author.id,
                author_name: author.name,
                author_avatar: author.avatar || author.photo_url || null,
                content: content.trim(),
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            // Add comment to subcollection
            const commentRef = await postRef.collection('comments').add(commentData);

            // Increment comment count on post
            await postRef.update({
                comment_count: admin.firestore.FieldValue.increment(1)
            });

            console.log(`Comment ${commentRef.id} added to post ${post_id} by ${author.name}`);

            res.json({
                success: true,
                comment_id: commentRef.id
            });

        } catch (error) {
            console.error('Error adding comment:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// GET COMMENTS
// ============================================================================

/**
 * Get comments for a post
 */
exports.getComments = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { post_id, limit: queryLimit, cursor } = req.method === 'POST' ? req.body : req.query;

            // Validate required fields
            if (!post_id) {
                return res.status(400).json({
                    success: false,
                    error: 'post_id is required'
                });
            }

            // Verify post exists
            const postDoc = await db.collection('posts').doc(post_id).get();
            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found' });
            }

            const commentLimit = Math.min(parseInt(queryLimit) || 20, 50);

            // Build query
            let commentsQuery = db.collection('posts')
                .doc(post_id)
                .collection('comments')
                .orderBy('created_at', 'asc')
                .limit(commentLimit + 1); // Get one extra to check has_more

            if (cursor) {
                const cursorDoc = await db.collection('posts')
                    .doc(post_id)
                    .collection('comments')
                    .doc(cursor)
                    .get();
                if (cursorDoc.exists) {
                    commentsQuery = commentsQuery.startAfter(cursorDoc);
                }
            }

            const commentsSnap = await commentsQuery.get();

            const comments = [];
            commentsSnap.docs.slice(0, commentLimit).forEach(doc => {
                const data = doc.data();
                comments.push({
                    id: doc.id,
                    author_id: data.author_id,
                    author_name: data.author_name,
                    author_avatar: data.author_avatar,
                    content: data.content,
                    created_at: data.created_at?.toDate?.()?.toISOString() || null
                });
            });

            const hasMore = commentsSnap.docs.length > commentLimit;
            const nextCursor = hasMore ? comments[comments.length - 1]?.id : null;

            res.json({
                success: true,
                comments: comments,
                cursor: nextCursor,
                has_more: hasMore
            });

        } catch (error) {
            console.error('Error getting comments:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// DELETE POST
// ============================================================================

/**
 * Delete a post (author only)
 */
exports.deletePost = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, post_id, author_id } = req.body;

            // Validate required fields
            if (!post_id || (!player_pin && !author_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: post_id and author_id/player_pin are required'
                });
            }

            // Verify player
            let deleterId;
            if (player_pin) {
                const player = await verifyPlayerPin(player_pin);
                if (!player) {
                    return res.status(401).json({ success: false, error: 'Invalid PIN' });
                }
                deleterId = player.id;
            } else {
                deleterId = author_id;
            }

            // Get the post
            const postRef = db.collection('posts').doc(post_id);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found' });
            }

            const post = postDoc.data();

            // Verify ownership
            if (post.author_id !== deleterId) {
                return res.status(403).json({
                    success: false,
                    error: 'Only the post author can delete this post'
                });
            }

            // Delete all comments first
            const commentsSnap = await postRef.collection('comments').get();
            const batch = db.batch();

            commentsSnap.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete the post
            batch.delete(postRef);

            await batch.commit();

            console.log(`Post ${post_id} deleted by ${deleterId}`);

            res.json({ success: true });

        } catch (error) {
            console.error('Error deleting post:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// GET SINGLE POST
// ============================================================================

/**
 * Get a single post by ID
 */
exports.getPost = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { post_id } = req.method === 'POST' ? req.body : req.query;

            if (!post_id) {
                return res.status(400).json({
                    success: false,
                    error: 'post_id is required'
                });
            }

            const postDoc = await db.collection('posts').doc(post_id).get();

            if (!postDoc.exists) {
                return res.status(404).json({ success: false, error: 'Post not found' });
            }

            const post = postDoc.data();

            res.json({
                success: true,
                post: {
                    id: postDoc.id,
                    author_id: post.author_id,
                    author_name: post.author_name,
                    author_avatar: post.author_avatar,
                    content: post.content,
                    post_type: post.post_type,
                    tagged_event: post.tagged_event,
                    reactions: post.reactions || createEmptyReactions(),
                    comment_count: post.comment_count || 0,
                    visibility: post.visibility,
                    created_at: post.created_at?.toDate?.()?.toISOString() || null
                }
            });

        } catch (error) {
            console.error('Error getting post:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// GET POSTS BY USER
// ============================================================================

/**
 * Get posts by a specific user
 */
exports.getUserPosts = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const {
                player_pin,
                user_id,
                limit: queryLimit,
                cursor
            } = req.method === 'POST' ? req.body : req.query;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id is required'
                });
            }

            // Optional: verify requesting player
            let requesterId = null;
            if (player_pin) {
                const player = await verifyPlayerPin(player_pin);
                if (player) {
                    requesterId = player.id;
                }
            }

            const postLimit = Math.min(parseInt(queryLimit) || 20, 50);

            // Build query
            let postsQuery = db.collection('posts')
                .where('author_id', '==', user_id)
                .orderBy('created_at', 'desc')
                .limit(postLimit + 1);

            if (cursor) {
                const cursorDoc = await db.collection('posts').doc(cursor).get();
                if (cursorDoc.exists) {
                    postsQuery = postsQuery.startAfter(cursorDoc);
                }
            }

            const postsSnap = await postsQuery.get();

            const posts = [];
            postsSnap.docs.slice(0, postLimit).forEach(doc => {
                const post = doc.data();

                // Filter by visibility if not the post author
                if (post.visibility === 'friends' && requesterId !== user_id) {
                    // TODO: Check if requester is a friend
                    return;
                }

                posts.push({
                    id: doc.id,
                    author_id: post.author_id,
                    author_name: post.author_name,
                    author_avatar: post.author_avatar,
                    content: post.content,
                    post_type: post.post_type,
                    tagged_event: post.tagged_event,
                    reactions: post.reactions || createEmptyReactions(),
                    comment_count: post.comment_count || 0,
                    created_at: post.created_at?.toDate?.()?.toISOString() || null
                });
            });

            const hasMore = postsSnap.docs.length > postLimit;
            const nextCursor = hasMore ? posts[posts.length - 1]?.id : null;

            res.json({
                success: true,
                posts: posts,
                cursor: nextCursor,
                has_more: hasMore
            });

        } catch (error) {
            console.error('Error getting user posts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = exports;
