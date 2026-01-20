/**
 * BRDC Presence System - Phase 2
 * Online/offline status tracking, last seen timestamps, enhanced profiles
 */

const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

const db = admin.firestore();

// Helper: Verify player PIN and get player data
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
 * Update player presence (heartbeat)
 * Called by frontend every 60 seconds when user is active
 */
exports.updatePresence = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, status, current_page, device_type } = req.body;

            if (!player_pin) {
                return res.status(400).json({ success: false, error: 'Missing player_pin' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            const presenceStatus = status || 'online';

            // Update heartbeat document
            await db.collection('presence_heartbeats').doc(player.id).set({
                player_id: player.id,
                player_name: player.name || `${player.first_name} ${player.last_name}`,
                status: presenceStatus,
                last_heartbeat: now,
                current_page: current_page || 'unknown',
                device_type: device_type || 'unknown',
                session_started: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Update player document with last_seen_at
            await db.collection('players').doc(player.id).update({
                last_seen_at: now,
                'presence.status': presenceStatus,
                'presence.last_seen_at': now,
                'presence.last_active_context': current_page || 'unknown',
                'presence.device_type': device_type || 'unknown'
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error updating presence:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Set player status manually (online, away, offline)
 */
exports.setPresenceStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, status } = req.body;

            if (!player_pin || !status) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            if (!['online', 'away', 'offline'].includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }

            const player = await verifyPlayer(player_pin);
            if (!player) {
                return res.status(401).json({ success: false, error: 'Invalid PIN' });
            }

            const now = admin.firestore.FieldValue.serverTimestamp();

            await db.collection('presence_heartbeats').doc(player.id).update({
                status: status,
                last_heartbeat: now
            });

            await db.collection('players').doc(player.id).update({
                'presence.status': status,
                'presence.last_seen_at': now
            });

            res.json({ success: true, status });

        } catch (error) {
            console.error('Error setting presence status:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get online players (optionally filtered by context)
 */
exports.getOnlinePlayers = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_pin, context, league_id, team_id } = req.body;

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
                .where('status', '==', 'online')
                .where('last_heartbeat', '>=', fiveMinutesAgo);

            const heartbeatsSnapshot = await query.limit(100).get();

            let onlinePlayers = heartbeatsSnapshot.docs.map(doc => ({
                player_id: doc.id,
                player_name: doc.data().player_name,
                current_page: doc.data().current_page,
                last_heartbeat: doc.data().last_heartbeat?.toDate()
            }));

            // Filter by context if provided
            if (context === 'league' && league_id) {
                // Get league participants
                const leagueDoc = await db.collection('leagues').doc(league_id).get();
                if (leagueDoc.exists) {
                    const leagueData = leagueDoc.data();
                    const leaguePlayerIds = new Set();

                    // Add all team members
                    if (leagueData.teams) {
                        leagueData.teams.forEach(team => {
                            if (team.members) {
                                team.members.forEach(m => leaguePlayerIds.add(m.id));
                            }
                        });
                    }

                    onlinePlayers = onlinePlayers.filter(p => leaguePlayerIds.has(p.player_id));
                }
            } else if (context === 'team' && team_id) {
                // Filter to specific team members
                const teamsSnapshot = await db.collection('leagues')
                    .where('teams', 'array-contains', { id: team_id })
                    .get();

                // Simple team filter would need more complex query
                // For now, return all online
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
                        const lastHeartbeat = data.last_heartbeat?.toDate();
                        const isOnline = lastHeartbeat && lastHeartbeat > fiveMinutesAgo;

                        presenceMap[doc.id] = {
                            status: isOnline ? data.status : 'offline',
                            last_seen_at: lastHeartbeat,
                            current_page: isOnline ? data.current_page : null
                        };
                    } else {
                        presenceMap[doc.id] = {
                            status: 'offline',
                            last_seen_at: null,
                            current_page: null
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

/**
 * Get player profile (public view)
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
            let presence = { status: 'offline', last_seen_at: null };

            if (heartbeatDoc.exists) {
                const hbData = heartbeatDoc.data();
                const fiveMinutesAgo = new Date();
                fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
                const lastHeartbeat = hbData.last_heartbeat?.toDate();

                presence = {
                    status: lastHeartbeat && lastHeartbeat > fiveMinutesAgo ? hbData.status : 'offline',
                    last_seen_at: lastHeartbeat
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
 * Scheduled: Cleanup stale presence (runs every 10 minutes)
 * Marks players as offline if no heartbeat in 5+ minutes
 */
exports.cleanupStalePresence = onSchedule('*/10 * * * *', async (event) => {
        console.log('Running stale presence cleanup...');

        try {
            const fiveMinutesAgo = new Date();
            fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

            // Find stale heartbeats
            const staleSnapshot = await db.collection('presence_heartbeats')
                .where('status', 'in', ['online', 'away'])
                .where('last_heartbeat', '<', fiveMinutesAgo)
                .limit(100)
                .get();

            if (staleSnapshot.empty) {
                console.log('No stale presence to clean up');
                return null;
            }

            const batch = db.batch();

            staleSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'offline' });

                // Also update player document
                const playerRef = db.collection('players').doc(doc.id);
                batch.update(playerRef, { 'presence.status': 'offline' });
            });

            await batch.commit();
            console.log(`Marked ${staleSnapshot.size} players as offline`);

            // Clean up very old heartbeats (24+ hours)
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            const oldSnapshot = await db.collection('presence_heartbeats')
                .where('last_heartbeat', '<', oneDayAgo)
                .limit(100)
                .get();

            if (!oldSnapshot.empty) {
                const deleteBatch = db.batch();
                oldSnapshot.docs.forEach(doc => {
                    deleteBatch.delete(doc.ref);
                });
                await deleteBatch.commit();
                console.log(`Deleted ${oldSnapshot.size} old heartbeat records`);
            }

            return null;

        } catch (error) {
            console.error('Error cleaning up stale presence:', error);
            return null;
        }
    });

/**
 * Set player offline when they explicitly log out
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

            await db.collection('presence_heartbeats').doc(player.id).update({
                status: 'offline',
                last_heartbeat: admin.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('players').doc(player.id).update({
                'presence.status': 'offline',
                'presence.last_seen_at': admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true });

        } catch (error) {
            console.error('Error setting offline:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
