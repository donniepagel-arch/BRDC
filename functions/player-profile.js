/**
 * Player Profile & Captain Management Functions
 * Handles player authentication, profiles, availability, and captain features
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================================
// PLAYER AUTHENTICATION
// ============================================================================

/**
 * Player login with PIN (5-digit legacy or 8-digit global)
 * First checks global players collection, then searches league-specific players
 */
exports.playerLogin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.body;

        if (!pin || (pin.length !== 5 && pin.length !== 8)) {
            return res.status(400).json({ success: false, error: 'PIN required (5 or 8 digits)' });
        }

        let foundPlayer = null;
        let foundLeagueId = null;

        // For 8-digit PINs, check global players collection first
        if (pin.length === 8) {
            const globalPlayerSnapshot = await db.collection('players')
                .where('pin', '==', pin)
                .limit(1)
                .get();

            if (!globalPlayerSnapshot.empty) {
                const playerDoc = globalPlayerSnapshot.docs[0];
                const playerData = playerDoc.data();
                foundPlayer = {
                    id: playerDoc.id,
                    player_id: playerDoc.id,
                    name: playerData.name,
                    first_name: playerData.name ? playerData.name.split(' ')[0] : '',
                    last_name: playerData.name ? playerData.name.split(' ').slice(1).join(' ') : '',
                    email: playerData.email,
                    phone: playerData.phone,
                    phone_last4: playerData.phone_last4,
                    photo_url: playerData.photo_url,
                    isBot: playerData.isBot,
                    isAdmin: playerData.isAdmin,
                    stats: playerData.stats,
                    involvements: playerData.involvements
                };
            }
        }

        // If not found in global, search league-specific players
        if (!foundPlayer) {
            const leaguesSnapshot = await db.collection('leagues').get();

            for (const leagueDoc of leaguesSnapshot.docs) {
                const playersSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                    .collection('players')
                    .where('pin', '==', pin)
                    .get();

                if (!playersSnapshot.empty) {
                    foundPlayer = { id: playersSnapshot.docs[0].id, ...playersSnapshot.docs[0].data() };
                    foundLeagueId = leagueDoc.id;
                    break;
                }
            }
        }

        if (!foundPlayer) {
            return res.status(404).json({ success: false, error: 'Invalid PIN' });
        }

        // Don't send PIN back to client
        delete foundPlayer.pin;

        // Check if player is captain by looking at their team
        if (foundLeagueId && foundPlayer.team_id) {
            try {
                const teamDoc = await db.collection('leagues').doc(foundLeagueId)
                    .collection('teams').doc(foundPlayer.team_id).get();

                if (teamDoc.exists) {
                    const team = teamDoc.data();
                    // Player is captain if they match captain_id OR they are level A (for triples leagues)
                    const isCaptainById = team.captain_id === foundPlayer.id;
                    const isLevelA = (foundPlayer.skill_level === 'A' || foundPlayer.preferred_level === 'A');
                    foundPlayer.is_captain = isCaptainById || isLevelA;
                    foundPlayer.team_name = team.team_name || team.name;
                }
            } catch (teamErr) {
                console.error('Error checking team for captain status:', teamErr);
            }
        }

        res.json({
            success: true,
            player: foundPlayer,
            league_id: foundLeagueId
        });

    } catch (error) {
        console.error('Player login error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reset/recover player PIN by email
 * Looks up player by email and sends their PIN (for recovery)
 */
exports.resetPlayerPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email required' });
        }

        const emailLower = email.toLowerCase().trim();

        // Find player by email across all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const playersSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('players')
                .where('email', '==', emailLower)
                .get();

            if (!playersSnapshot.empty) {
                const player = playersSnapshot.docs[0].data();
                const playerPin = player.pin;

                if (!playerPin) {
                    return res.status(400).json({ success: false, error: 'No PIN set for this player. Contact your league manager.' });
                }

                // Send PIN via email (queue notification)
                // In production, this would use SendGrid
                await db.collection('notifications_queue').add({
                    type: 'pin_recovery',
                    to_email: emailLower,
                    to_name: player.name,
                    pin: playerPin,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // Log for debugging
                console.log(`PIN recovery requested for ${emailLower}: PIN is ${playerPin}`);

                return res.json({
                    success: true,
                    message: 'PIN has been sent to your email',
                    // In production, don't send PIN in response - just for testing
                    debug_pin: process.env.NODE_ENV === 'development' ? playerPin : undefined
                });
            }
        }

        res.status(404).json({ success: false, error: 'No player found with this email' });

    } catch (error) {
        console.error('PIN recovery error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER PROFILE
// ============================================================================

/**
 * Update player photo URL
 */
exports.updatePlayerPhoto = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, player_id, photo_url } = req.body;

        if (!league_id || !player_id || !photo_url) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        await db.collection('leagues').doc(league_id)
            .collection('players').doc(player_id)
            .update({
                photo_url: photo_url,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

        res.json({ success: true, message: 'Photo updated' });

    } catch (error) {
        console.error('Update photo error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get player profile with all stats across leagues
 */
exports.getPlayerProfile = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const playerId = req.query.player_id || req.body.player_id;
        const leagueId = req.query.league_id || req.body.league_id;

        if (!playerId) {
            return res.status(400).json({ success: false, error: 'Missing player_id' });
        }

        let player = null;
        let stats = null;
        let team = null;
        let league = null;

        if (leagueId) {
            // Get from specific league
            const playerDoc = await db.collection('leagues').doc(leagueId)
                .collection('players').doc(playerId).get();

            if (playerDoc.exists) {
                player = { id: playerDoc.id, ...playerDoc.data() };
                delete player.pin; // Don't expose PIN

                // Get stats
                const statsDoc = await db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(playerId).get();
                if (statsDoc.exists) {
                    const rawStats = statsDoc.data();

                    // Use pre-calculated values, or calculate from totals as fallback
                    stats = {
                        ...rawStats,
                        // X01 calculated fields (use stored or calculate)
                        x01_three_dart_avg: rawStats.x01_three_dart_avg ||
                            (rawStats.x01_total_darts > 0
                                ? parseFloat((rawStats.x01_total_points / rawStats.x01_total_darts * 3).toFixed(2))
                                : 0),
                        // Cricket calculated fields (use stored or calculate from darts)
                        cricket_mpr: rawStats.cricket_mpr ||
                            (rawStats.cricket_total_darts > 0
                                ? parseFloat((rawStats.cricket_total_marks / rawStats.cricket_total_darts * 3).toFixed(2))
                                : 0),
                        // Checkout percentage
                        checkout_pct: rawStats.x01_checkout_pct ||
                            (rawStats.x01_checkout_opportunities > 0
                                ? parseFloat((rawStats.x01_checkout_darts / rawStats.x01_checkout_opportunities * 100).toFixed(1))
                                : 0),
                        // Leg win percentages
                        x01_leg_win_pct: rawStats.x01_leg_win_pct ||
                            (rawStats.x01_legs_played > 0
                                ? parseFloat((rawStats.x01_legs_won / rawStats.x01_legs_played * 100).toFixed(1))
                                : 0),
                        cricket_leg_win_pct: rawStats.cricket_leg_win_pct ||
                            (rawStats.cricket_legs_played > 0
                                ? parseFloat((rawStats.cricket_legs_won / rawStats.cricket_legs_played * 100).toFixed(1))
                                : 0)
                    };
                }

                // Get team
                if (player.team_id) {
                    const teamDoc = await db.collection('leagues').doc(leagueId)
                        .collection('teams').doc(player.team_id).get();
                    if (teamDoc.exists) {
                        team = { id: teamDoc.id, ...teamDoc.data() };
                    }
                }

                // Get league info
                const leagueDoc = await db.collection('leagues').doc(leagueId).get();
                if (leagueDoc.exists) {
                    league = { id: leagueDoc.id, ...leagueDoc.data() };
                    delete league.admin_pin;
                }
            }
        }

        res.json({
            success: true,
            player,
            stats,
            team,
            league
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER AVAILABILITY
// ============================================================================

/**
 * Set player availability for a match
 */
exports.setPlayerAvailability = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, player_id, available } = req.body;

        if (!league_id || !match_id || !player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Update availability
        const playerAvailability = match.player_availability || {};
        playerAvailability[player_id] = available ? 'available' : 'unavailable';

        await matchRef.update({
            player_availability: playerAvailability,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // If marking unavailable, notify captain
        if (!available) {
            await notifyCaptainOfUnavailability(league_id, match, player_id);
        }

        res.json({
            success: true,
            message: available ? 'Marked as available' : 'Marked as unavailable'
        });

    } catch (error) {
        console.error('Set availability error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function notifyCaptainOfUnavailability(leagueId, match, playerId) {
    try {
        // Get player info
        const playerDoc = await db.collection('leagues').doc(leagueId)
            .collection('players').doc(playerId).get();

        if (!playerDoc.exists) return;
        const player = playerDoc.data();

        // Determine which team the player is on
        let teamId = player.team_id;
        if (!teamId) return;

        // Get team to find captain
        const teamDoc = await db.collection('leagues').doc(leagueId)
            .collection('teams').doc(teamId).get();

        if (!teamDoc.exists) return;
        const team = teamDoc.data();

        // Find captain
        const captainId = team.captain_id;
        if (!captainId) return;

        const captainDoc = await db.collection('leagues').doc(leagueId)
            .collection('players').doc(captainId).get();

        if (!captainDoc.exists) return;
        const captain = captainDoc.data();

        // Create notification
        await db.collection('leagues').doc(leagueId)
            .collection('notifications').add({
                type: 'player_unavailable',
                recipient_id: captainId,
                recipient_email: captain.email,
                recipient_phone: captain.phone,
                message: `${player.name} marked themselves unavailable for Week ${match.week} match`,
                match_id: match.id,
                player_id: playerId,
                player_name: player.name,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                sent: false
            });

        console.log(`Notification created for captain ${captain.name} about ${player.name}'s unavailability`);

    } catch (error) {
        console.error('Error notifying captain:', error);
    }
}

/**
 * Get team availability for a match (for captains)
 */
exports.getTeamAvailability = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, team_id } = req.query.league_id ? req.query : req.body;

        if (!league_id || !match_id || !team_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const matchDoc = await db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id).get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        const playerAvailability = match.player_availability || {};

        // Get team roster
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();
        const roster = team.players || [];

        // Build availability list
        const availability = roster.map(player => ({
            id: player.id,
            name: player.name,
            position: player.position,
            status: playerAvailability[player.id] || 'unknown'
        }));

        res.json({
            success: true,
            availability,
            match_week: match.week,
            match_date: match.match_date
        });

    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CAPTAIN DASHBOARD
// ============================================================================

/**
 * Get captain dashboard data
 */
exports.getCaptainDashboard = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, captain_email, captain_id } = req.query.league_id ? req.query : req.body;

        if (!league_id || !team_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id or team_id' });
        }

        // Get team
        const teamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id).get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = { id: teamDoc.id, ...teamDoc.data() };

        // Verify captain authorization
        // Captain must be verified by either:
        // 1. captain_id matching team.captain_id
        // 2. captain_email matching a captain player on this team
        let isAuthorized = false;

        if (captain_id && team.captain_id === captain_id) {
            isAuthorized = true;
        }

        if (!isAuthorized && captain_email) {
            // Check if email belongs to a captain on this team
            const captainSnapshot = await db.collection('leagues').doc(league_id)
                .collection('players')
                .where('email', '==', captain_email.toLowerCase())
                .where('team_id', '==', team_id)
                .limit(1)
                .get();

            if (!captainSnapshot.empty) {
                const captainPlayer = captainSnapshot.docs[0].data();
                // Check if this player is the captain or is level A (for triples leagues)
                if (captainSnapshot.docs[0].id === team.captain_id ||
                    captainPlayer.is_captain === true ||
                    captainPlayer.skill_level === 'A' ||
                    captainPlayer.preferred_level === 'A') {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized as captain for this team'
            });
        }

        // Get league info
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();
        delete league.admin_pin;

        // Get all matches for this team
        const matchesSnapshot = await db.collection('leagues').doc(league_id)
            .collection('matches')
            .orderBy('week', 'asc')
            .get();

        const matches = [];
        matchesSnapshot.forEach(doc => {
            const match = doc.data();
            if (match.home_team_id === team_id || match.away_team_id === team_id) {
                matches.push({
                    id: doc.id,
                    ...match,
                    is_home: match.home_team_id === team_id,
                    availability: match.player_availability || {}
                });
            }
        });

        // Get team players by querying players collection with team_id (per RULE 4)
        const teamPlayersSnap = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('team_id', '==', team_id)
            .get();

        const teamPlayers = [];
        teamPlayersSnap.forEach(doc => {
            teamPlayers.push({ id: doc.id, ...doc.data() });
        });

        // Sort by position
        teamPlayers.sort((a, b) => (a.position || 99) - (b.position || 99));

        // Add players to team object for frontend compatibility
        team.players = teamPlayers;

        // Get player stats
        const playerStats = [];
        for (const player of teamPlayers) {
            const statsDoc = await db.collection('leagues').doc(league_id)
                .collection('stats').doc(player.id).get();

            if (statsDoc.exists) {
                const stats = statsDoc.data();
                // Use pre-calculated values or calculate from totals
                stats.x01_three_dart_avg = stats.x01_three_dart_avg ||
                    (stats.x01_total_darts > 0
                        ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                        : 0);
                stats.cricket_mpr = stats.cricket_mpr ||
                    (stats.cricket_total_darts > 0
                        ? parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2))
                        : 0);
                playerStats.push({ player_id: player.id, player_name: player.name, ...stats });
            } else {
                playerStats.push({ player_id: player.id, player_name: player.name, x01_three_dart_avg: 0, cricket_mpr: 0 });
            }
        }

        // Get available subs
        const subsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('is_sub', '==', true)
            .get();

        const subs = [];
        subsSnapshot.forEach(doc => {
            const sub = doc.data();
            delete sub.pin;
            subs.push({ id: doc.id, ...sub });
        });

        // Get notifications for captain
        const notificationsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('notifications')
            .where('recipient_id', '==', team.captain_id)
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();

        const notifications = [];
        notificationsSnapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        // Get free agents (players without team_id who registered for this league)
        const freeAgents = [];
        if (league.allow_free_agents !== false) {
            const freeAgentSnapshot = await db.collection('leagues').doc(league_id)
                .collection('registrations')
                .where('status', '==', 'free_agent')
                .get();

            freeAgentSnapshot.forEach(doc => {
                const fa = doc.data();
                delete fa.pin;
                freeAgents.push({ id: doc.id, ...fa });
            });
        }

        // Get pending fill-in requests for this team
        const fillinRequestsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('fillin_requests')
            .where('team_id', '==', team_id)
            .where('status', '==', 'pending')
            .orderBy('created_at', 'desc')
            .limit(5)
            .get();

        const pendingFillinRequests = [];
        for (const doc of fillinRequestsSnapshot.docs) {
            const request = doc.data();
            // Get responses summary
            const responses = request.responses || {};
            const interested = [];
            const declined = [];
            const pending = [];

            for (const subId of request.sub_ids || []) {
                const response = responses[subId];
                let playerName = 'Unknown';
                const playerDoc = await db.collection('leagues').doc(league_id)
                    .collection('players').doc(subId).get();
                if (playerDoc.exists) {
                    playerName = playerDoc.data().name;
                }

                const entry = { id: subId, name: playerName };

                if (response?.interested === true) {
                    interested.push(entry);
                } else if (response?.interested === false) {
                    declined.push(entry);
                } else {
                    pending.push(entry);
                }
            }

            pendingFillinRequests.push({
                request_id: doc.id,
                match_id: request.match_id,
                match_week: request.match_week,
                status: request.status,
                interested,
                declined,
                pending
            });
        }

        res.json({
            success: true,
            team,
            league: { id: league_id, ...league },
            matches,
            player_stats: playerStats,
            available_subs: subs,
            free_agents: freeAgents,
            notifications,
            pending_fillin_requests: pendingFillinRequests
        });

    } catch (error) {
        console.error('Get captain dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Permanent player replacement (drop player from team)
 */
exports.permanentReplacement = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, team_id, drop_player_id, new_player_id, captain_email, reason } = req.body;

        if (!league_id || !team_id || !drop_player_id || !new_player_id) {
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
                return res.status(403).json({ success: false, error: 'Not authorized as captain' });
            }
        }

        // Get dropped player
        const droppedPlayerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(drop_player_id).get();

        if (!droppedPlayerDoc.exists) {
            return res.status(404).json({ success: false, error: 'Dropped player not found' });
        }

        const droppedPlayer = droppedPlayerDoc.data();
        const position = droppedPlayer.position;

        // Get new player
        const newPlayerDoc = await db.collection('leagues').doc(league_id)
            .collection('players').doc(new_player_id).get();

        if (!newPlayerDoc.exists) {
            return res.status(404).json({ success: false, error: 'New player not found' });
        }

        const newPlayer = newPlayerDoc.data();

        // Update team roster
        const teamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();
        const team = teamDoc.data();

        const newRoster = team.players.map(p => {
            if (p.id === drop_player_id) {
                return {
                    id: new_player_id,
                    name: newPlayer.name,
                    position: position
                };
            }
            return p;
        });

        // Batch update
        const batch = db.batch();

        // Update team
        batch.update(teamRef, {
            players: newRoster,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update dropped player
        batch.update(droppedPlayerDoc.ref, {
            team_id: null,
            position: null,
            is_captain: false,
            dropped: true,
            dropped_reason: reason || 'Replaced',
            dropped_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update new player
        batch.update(newPlayerDoc.ref, {
            team_id: team_id,
            position: position,
            is_sub: false,
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log the replacement
        const logRef = db.collection('leagues').doc(league_id)
            .collection('roster_changes').doc();
        batch.set(logRef, {
            team_id: team_id,
            team_name: team.team_name,
            type: 'permanent_replacement',
            dropped_player: { id: drop_player_id, name: droppedPlayer.name },
            new_player: { id: new_player_id, name: newPlayer.name },
            position: position,
            reason: reason || 'Replaced',
            performed_by: captain_email || 'unknown',
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({
            success: true,
            message: `${droppedPlayer.name} replaced with ${newPlayer.name}`,
            new_roster: newRoster
        });

    } catch (error) {
        console.error('Permanent replacement error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PUBLIC STATS PORTAL
// ============================================================================

/**
 * Search players across all leagues
 */
exports.searchPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const query = (req.query.q || req.body.q || '').toLowerCase().trim();
        const limit = parseInt(req.query.limit || req.body.limit) || 50;

        if (!query || query.length < 2) {
            return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
        }

        const results = [];
        const seenEmails = new Set();

        // Search all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const league = leagueDoc.data();

            const playersSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('players').get();

            for (const playerDoc of playersSnapshot.docs) {
                const player = playerDoc.data();

                // Check if name matches
                if (player.name && player.name.toLowerCase().includes(query)) {
                    // Avoid duplicates by email
                    if (seenEmails.has(player.email)) continue;
                    seenEmails.add(player.email);

                    // Get stats
                    const statsDoc = await db.collection('leagues').doc(leagueDoc.id)
                        .collection('stats').doc(playerDoc.id).get();

                    let stats = null;
                    if (statsDoc.exists) {
                        const rawStats = statsDoc.data();
                        stats = {
                            x01_three_dart_avg: rawStats.x01_three_dart_avg ||
                                (rawStats.x01_total_darts > 0
                                    ? parseFloat((rawStats.x01_total_points / rawStats.x01_total_darts * 3).toFixed(2))
                                    : 0),
                            cricket_mpr: rawStats.cricket_mpr ||
                                (rawStats.cricket_total_darts > 0
                                    ? parseFloat((rawStats.cricket_total_marks / rawStats.cricket_total_darts * 3).toFixed(2))
                                    : 0),
                            x01_180s: rawStats.x01_tons_180 || 0,
                            high_checkout: rawStats.x01_high_checkout || 0,
                            checkout_pct: rawStats.x01_checkout_pct || 0,
                            first_9_avg: rawStats.x01_first_9_avg || 0
                        };
                    }

                    results.push({
                        id: playerDoc.id,
                        name: player.name,
                        photo_url: player.photo_url,
                        league_id: leagueDoc.id,
                        league_name: league.league_name,
                        team_name: player.team_name,
                        stats: stats
                    });

                    if (results.length >= limit) break;
                }
            }

            if (results.length >= limit) break;
        }

        res.json({ success: true, players: results, count: results.length });

    } catch (error) {
        console.error('Search players error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get global leaderboards across all leagues
 */
exports.getGlobalLeaderboards = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const allStats = [];

        // Collect stats from all leagues
        const leaguesSnapshot = await db.collection('leagues').get();

        for (const leagueDoc of leaguesSnapshot.docs) {
            const league = leagueDoc.data();

            const statsSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('stats').get();

            for (const statDoc of statsSnapshot.docs) {
                const stats = statDoc.data();

                // Use pre-calculated averages or calculate from totals
                stats.x01_three_dart_avg = stats.x01_three_dart_avg ||
                    (stats.x01_total_darts > 0
                        ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                        : 0);
                stats.cricket_mpr = stats.cricket_mpr ||
                    (stats.cricket_total_darts > 0
                        ? parseFloat((stats.cricket_total_marks / stats.cricket_total_darts * 3).toFixed(2))
                        : 0);
                stats.checkout_pct = stats.x01_checkout_pct ||
                    (stats.x01_checkout_opportunities > 0
                        ? parseFloat((stats.x01_checkout_darts / stats.x01_checkout_opportunities * 100).toFixed(1))
                        : 0);

                allStats.push({
                    id: statDoc.id,
                    player_name: stats.player_name,
                    league_name: league.league_name,
                    league_id: leagueDoc.id,
                    ...stats
                });
            }
        }

        // Build leaderboards
        const leaderboards = {
            x01_average: [...allStats]
                .filter(s => (s.x01_legs_played || 0) >= 5)
                .sort((a, b) => (b.x01_three_dart_avg || 0) - (a.x01_three_dart_avg || 0))
                .slice(0, 20),

            x01_first_9: [...allStats]
                .filter(s => (s.x01_first_9_avg || 0) > 0)
                .sort((a, b) => (b.x01_first_9_avg || 0) - (a.x01_first_9_avg || 0))
                .slice(0, 20),

            x01_180s: [...allStats]
                .filter(s => (s.x01_tons_180 || 0) > 0)
                .sort((a, b) => (b.x01_tons_180 || 0) - (a.x01_tons_180 || 0))
                .slice(0, 20),

            x01_high_checkout: [...allStats]
                .filter(s => (s.x01_high_checkout || 0) > 0)
                .sort((a, b) => (b.x01_high_checkout || 0) - (a.x01_high_checkout || 0))
                .slice(0, 20),

            x01_checkout_pct: [...allStats]
                .filter(s => (s.x01_checkout_opportunities || 0) >= 10)
                .sort((a, b) => (b.checkout_pct || 0) - (a.checkout_pct || 0))
                .slice(0, 20),

            x01_tons_100: [...allStats]
                .filter(s => (s.x01_tons_100 || 0) > 0)
                .sort((a, b) => (b.x01_tons_100 || 0) - (a.x01_tons_100 || 0))
                .slice(0, 20),

            cricket_mpr: [...allStats]
                .filter(s => (s.cricket_legs_played || 0) >= 5)
                .sort((a, b) => (b.cricket_mpr || 0) - (a.cricket_mpr || 0))
                .slice(0, 20),

            cricket_bulls: [...allStats]
                .filter(s => (s.cricket_bulls || 0) > 0)
                .sort((a, b) => (b.cricket_bulls || 0) - (a.cricket_bulls || 0))
                .slice(0, 20),

            most_legs_won: [...allStats]
                .sort((a, b) => ((b.x01_legs_won || 0) + (b.cricket_legs_won || 0)) -
                    ((a.x01_legs_won || 0) + (a.cricket_legs_won || 0)))
                .slice(0, 20)
        };

        res.json({ success: true, leaderboards });

    } catch (error) {
        console.error('Get global leaderboards error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
