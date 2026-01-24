/**
 * BRDC Draft System - Cloud Functions
 * Real-time player draft for Draft Leagues
 *
 * Data Structure:
 * - leagues/{leagueId}/draft/current - Current draft state
 * - leagues/{leagueId}/draft/history - Historical draft records
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// Master admin player ID (Donnie Pagel) - can access any league
const MASTER_ADMIN_PLAYER_ID = 'X2DMb9bP4Q8fy9yr5Fam';

// CORS handler
function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// Verify director/admin access to league
async function verifyLeagueAccess(leagueId, pin) {
    const leagueDoc = await db.collection('leagues').doc(leagueId).get();
    if (!leagueDoc.exists) return { valid: false, error: 'League not found' };

    const league = leagueDoc.data();

    // Check if PIN matches league admin or director PIN
    if (league.admin_pin === pin || league.director_pin === pin) {
        return { valid: true, isDirector: true, league };
    }

    // Check if PIN belongs to master admin
    const masterCheck = await db.collection('players').where('pin', '==', pin).limit(1).get();
    if (!masterCheck.empty && masterCheck.docs[0].id === MASTER_ADMIN_PLAYER_ID) {
        return { valid: true, isDirector: true, isMasterAdmin: true, league };
    }

    // Check if PIN belongs to a captain in this league
    const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').where('pin', '==', pin).get();
    if (!playersSnap.empty) {
        const player = playersSnap.docs[0].data();
        if (player.is_captain) {
            return { valid: true, isDirector: false, isCaptain: true, playerId: playersSnap.docs[0].id, teamId: player.team_id, league };
        }
        return { valid: true, isDirector: false, isCaptain: false, playerId: playersSnap.docs[0].id, teamId: player.team_id, league };
    }

    // Check global players collection
    const globalPlayerSnap = await db.collection('players').where('pin', '==', pin).limit(1).get();
    if (!globalPlayerSnap.empty) {
        const globalPlayer = globalPlayerSnap.docs[0];
        // Check if they're in this league's teams
        const teamsSnap = await db.collection('leagues').doc(leagueId).collection('teams').get();
        for (const teamDoc of teamsSnap.docs) {
            const team = teamDoc.data();
            if (team.captain_id === globalPlayer.id) {
                return { valid: true, isDirector: false, isCaptain: true, playerId: globalPlayer.id, teamId: teamDoc.id, league };
            }
        }
    }

    return { valid: false, error: 'Invalid PIN' };
}

// Generate snake draft order
function generateSnakeDraftOrder(teams, rounds) {
    const order = [];
    for (let round = 0; round < rounds; round++) {
        const roundOrder = round % 2 === 0 ? [...teams] : [...teams].reverse();
        order.push(...roundOrder.map(t => t.id));
    }
    return order;
}

// Generate standard draft order (non-snake)
function generateStandardDraftOrder(teams, rounds) {
    const order = [];
    for (let round = 0; round < rounds; round++) {
        order.push(...teams.map(t => t.id));
    }
    return order;
}

/**
 * Initialize Draft
 * Sets up the draft state with team order and configuration
 */
exports.initializeDraft = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin, time_per_pick, snake_draft, auto_pick_enabled, draft_order_method } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid) {
            return res.status(403).json({ success: false, error: access.error });
        }
        if (!access.isDirector) {
            return res.status(403).json({ success: false, error: 'Only directors can start drafts' });
        }

        // Get teams
        const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
        let teams = [];
        teamsSnap.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams to start draft' });
        }

        // Get available players (unassigned)
        const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
        let availablePlayers = [];
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (!data.team_id) {
                availablePlayers.push({ id: doc.id, ...data });
            }
        });

        if (availablePlayers.length === 0) {
            return res.status(400).json({ success: false, error: 'No available players to draft' });
        }

        // Determine draft order based on method
        let draftOrderTeams = [...teams];
        if (draft_order_method === 'random') {
            // Shuffle teams
            draftOrderTeams.sort(() => Math.random() - 0.5);
        } else if (draft_order_method === 'by_record') {
            // Sort by record (worst first)
            draftOrderTeams.sort((a, b) => {
                const aWins = (a.wins || 0) - (a.losses || 0);
                const bWins = (b.wins || 0) - (b.losses || 0);
                return aWins - bWins; // Worst record picks first
            });
        }
        // If 'manual', keep the order as-is (teams order)

        // Calculate rounds needed
        const playersPerTeam = access.league.players_per_team || access.league.min_players || 4;
        const currentRosterSizes = {};
        teams.forEach(t => { currentRosterSizes[t.id] = 0; });

        // Count current roster sizes
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (data.team_id && currentRosterSizes[data.team_id] !== undefined) {
                currentRosterSizes[data.team_id]++;
            }
        });

        const minRosterSize = Math.min(...Object.values(currentRosterSizes));
        const roundsNeeded = Math.min(playersPerTeam - minRosterSize, Math.ceil(availablePlayers.length / teams.length));

        // Generate pick order
        const pickOrder = snake_draft !== false
            ? generateSnakeDraftOrder(draftOrderTeams, roundsNeeded)
            : generateStandardDraftOrder(draftOrderTeams, roundsNeeded);

        // Create draft state document
        const draftState = {
            status: 'in_progress',
            pick_order: pickOrder,
            current_pick_index: 0,
            picks: [],
            time_per_pick_seconds: time_per_pick || 60,
            snake_draft: snake_draft !== false,
            auto_pick_enabled: auto_pick_enabled !== false,
            pick_deadline: admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + (time_per_pick || 60) * 1000)
            ),
            started_at: admin.firestore.FieldValue.serverTimestamp(),
            started_by: pin,
            rounds_total: roundsNeeded,
            players_per_team: playersPerTeam
        };

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').set(draftState);

        // Update league status
        await db.collection('leagues').doc(league_id).update({
            status: 'draft',
            draft_status: 'in_progress'
        });

        res.json({
            success: true,
            message: 'Draft started',
            total_picks: pickOrder.length,
            rounds: roundsNeeded,
            first_team: teams.find(t => t.id === pickOrder[0])?.name || 'Unknown'
        });

    } catch (error) {
        console.error('Error initializing draft:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Make Draft Pick
 * Records a player selection by a team
 */
exports.makeDraftPick = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, player_id, team_id, pin } = req.body;

        if (!league_id || !player_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid) {
            return res.status(403).json({ success: false, error: access.error });
        }

        // Get current draft state
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();
        if (!draftDoc.exists) {
            return res.status(400).json({ success: false, error: 'No active draft' });
        }

        const draftState = draftDoc.data();
        if (draftState.status !== 'in_progress') {
            return res.status(400).json({ success: false, error: `Draft is ${draftState.status}` });
        }

        // Check if it's this team's turn
        const currentTeamId = draftState.pick_order[draftState.current_pick_index];
        const pickingTeamId = team_id || access.teamId;

        if (!access.isDirector && pickingTeamId !== currentTeamId) {
            return res.status(403).json({ success: false, error: 'Not your turn to pick' });
        }

        // Verify player is available
        const playerDoc = await db.collection('leagues').doc(league_id).collection('players').doc(player_id).get();
        if (!playerDoc.exists) {
            return res.status(400).json({ success: false, error: 'Player not found' });
        }

        const playerData = playerDoc.data();
        if (playerData.team_id) {
            return res.status(400).json({ success: false, error: 'Player already on a team' });
        }

        // Check if player was already drafted
        const alreadyDrafted = draftState.picks.some(p => p.player_id === player_id);
        if (alreadyDrafted) {
            return res.status(400).json({ success: false, error: 'Player already drafted' });
        }

        // Get team info
        const teamDoc = await db.collection('leagues').doc(league_id).collection('teams').doc(currentTeamId).get();
        const teamData = teamDoc.exists ? teamDoc.data() : {};

        // Calculate roster position
        const teamPicks = draftState.picks.filter(p => p.team_id === currentTeamId);
        const position = teamPicks.length + 1;

        // Create pick record
        const pick = {
            pick_number: draftState.current_pick_index + 1,
            team_id: currentTeamId,
            team_name: teamData.name || teamData.team_name || 'Unknown',
            player_id: player_id,
            player_name: playerData.name || 'Unknown',
            player_level: playerData.level || playerData.preferred_level || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Update player with team assignment
        await db.collection('leagues').doc(league_id).collection('players').doc(player_id).update({
            team_id: currentTeamId,
            position: position,
            drafted_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Calculate new deadline
        const newDeadline = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + draftState.time_per_pick_seconds * 1000)
        );

        // Update draft state
        const newPickIndex = draftState.current_pick_index + 1;
        const isComplete = newPickIndex >= draftState.pick_order.length;

        const updateData = {
            picks: admin.firestore.FieldValue.arrayUnion(pick),
            current_pick_index: newPickIndex,
            last_pick_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (isComplete) {
            updateData.status = 'completed';
            updateData.completed_at = admin.firestore.FieldValue.serverTimestamp();
        } else {
            updateData.pick_deadline = newDeadline;
        }

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update(updateData);

        // If draft is complete, update league status
        if (isComplete) {
            await db.collection('leagues').doc(league_id).update({
                status: 'active',
                draft_status: 'completed',
                draft_completed_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            pick: pick,
            draft_complete: isComplete,
            next_team_id: isComplete ? null : draftState.pick_order[newPickIndex]
        });

    } catch (error) {
        console.error('Error making pick:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Auto Pick
 * Automatically selects the best available player for the current team
 */
exports.autoPick = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify access (director only for force auto-pick)
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid) {
            return res.status(403).json({ success: false, error: access.error });
        }
        if (!access.isDirector) {
            return res.status(403).json({ success: false, error: 'Only directors can force auto-pick' });
        }

        // Get current draft state
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();
        if (!draftDoc.exists) {
            return res.status(400).json({ success: false, error: 'No active draft' });
        }

        const draftState = draftDoc.data();
        if (draftState.status !== 'in_progress') {
            return res.status(400).json({ success: false, error: `Draft is ${draftState.status}` });
        }

        // Get available players
        const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
        const draftedIds = draftState.picks.map(p => p.player_id);

        let availablePlayers = [];
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (!data.team_id && !draftedIds.includes(doc.id)) {
                availablePlayers.push({ id: doc.id, ...data });
            }
        });

        if (availablePlayers.length === 0) {
            return res.status(400).json({ success: false, error: 'No available players' });
        }

        // Get stats for ranking
        const statsSnap = await db.collection('leagues').doc(league_id).collection('stats').get();
        const statsById = {};
        statsSnap.forEach(doc => {
            statsById[doc.id] = doc.data();
        });

        // Rank players by level then by stats
        availablePlayers.forEach(p => {
            const stats = statsById[p.id] || {};
            p.ranking_score = 0;

            // Level bonus (A=300, B=200, C=100)
            const level = p.level || p.preferred_level;
            if (level === 'A') p.ranking_score += 300;
            else if (level === 'B') p.ranking_score += 200;
            else if (level === 'C') p.ranking_score += 100;

            // Stats bonus
            const avg = stats.x01_three_dart_avg || stats.three_dart_avg || 0;
            const mpr = stats.cricket_mpr || stats.mpr || 0;
            p.ranking_score += avg + (mpr * 20); // Weight 3DA and MPR
        });

        availablePlayers.sort((a, b) => b.ranking_score - a.ranking_score);

        // Pick the best available
        const bestPlayer = availablePlayers[0];
        const currentTeamId = draftState.pick_order[draftState.current_pick_index];

        // Make the pick by calling makeDraftPick logic
        const teamDoc = await db.collection('leagues').doc(league_id).collection('teams').doc(currentTeamId).get();
        const teamData = teamDoc.exists ? teamDoc.data() : {};

        const teamPicks = draftState.picks.filter(p => p.team_id === currentTeamId);
        const position = teamPicks.length + 1;

        const pick = {
            pick_number: draftState.current_pick_index + 1,
            team_id: currentTeamId,
            team_name: teamData.name || teamData.team_name || 'Unknown',
            player_id: bestPlayer.id,
            player_name: bestPlayer.name || 'Unknown',
            player_level: bestPlayer.level || bestPlayer.preferred_level || null,
            auto_pick: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // Update player
        await db.collection('leagues').doc(league_id).collection('players').doc(bestPlayer.id).update({
            team_id: currentTeamId,
            position: position,
            drafted_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update draft state
        const newPickIndex = draftState.current_pick_index + 1;
        const isComplete = newPickIndex >= draftState.pick_order.length;

        const newDeadline = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + draftState.time_per_pick_seconds * 1000)
        );

        const updateData = {
            picks: admin.firestore.FieldValue.arrayUnion(pick),
            current_pick_index: newPickIndex,
            last_pick_at: admin.firestore.FieldValue.serverTimestamp()
        };

        if (isComplete) {
            updateData.status = 'completed';
            updateData.completed_at = admin.firestore.FieldValue.serverTimestamp();
        } else {
            updateData.pick_deadline = newDeadline;
        }

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update(updateData);

        if (isComplete) {
            await db.collection('leagues').doc(league_id).update({
                status: 'active',
                draft_status: 'completed',
                draft_completed_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            pick: pick,
            draft_complete: isComplete
        });

    } catch (error) {
        console.error('Error auto-picking:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get Draft State
 * Returns the current draft state for a league
 */
exports.getDraftState = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        // Get draft state (no auth required for viewing)
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();

        if (!draftDoc.exists) {
            return res.json({
                success: true,
                draft: null,
                message: 'No draft found'
            });
        }

        const draftState = draftDoc.data();

        // Get teams for display
        const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
        const teams = [];
        teamsSnap.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        // Get available players
        const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
        const draftedIds = (draftState.picks || []).map(p => p.player_id);

        const availablePlayers = [];
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (!data.team_id && !draftedIds.includes(doc.id)) {
                availablePlayers.push({ id: doc.id, ...data });
            }
        });

        res.json({
            success: true,
            draft: {
                ...draftState,
                pick_deadline: draftState.pick_deadline?.toDate?.()?.toISOString() || null,
                started_at: draftState.started_at?.toDate?.()?.toISOString() || null,
                completed_at: draftState.completed_at?.toDate?.()?.toISOString() || null
            },
            teams,
            available_players_count: availablePlayers.length
        });

    } catch (error) {
        console.error('Error getting draft state:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Pause Draft
 * Pauses the draft timer
 */
exports.pauseDraft = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify director access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid || !access.isDirector) {
            return res.status(403).json({ success: false, error: 'Director access required' });
        }

        // Get draft state
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();
        if (!draftDoc.exists) {
            return res.status(400).json({ success: false, error: 'No active draft' });
        }

        const draftState = draftDoc.data();
        if (draftState.status !== 'in_progress') {
            return res.status(400).json({ success: false, error: 'Draft is not in progress' });
        }

        // Calculate remaining time
        const deadline = draftState.pick_deadline?.toDate?.() || new Date();
        const remaining = Math.max(0, Math.floor((deadline - new Date()) / 1000));

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update({
            status: 'paused',
            paused_at: admin.firestore.FieldValue.serverTimestamp(),
            time_remaining_seconds: remaining
        });

        res.json({ success: true, message: 'Draft paused', time_remaining: remaining });

    } catch (error) {
        console.error('Error pausing draft:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Resume Draft
 * Resumes a paused draft
 */
exports.resumeDraft = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify director access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid || !access.isDirector) {
            return res.status(403).json({ success: false, error: 'Director access required' });
        }

        // Get draft state
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();
        if (!draftDoc.exists) {
            return res.status(400).json({ success: false, error: 'No draft found' });
        }

        const draftState = draftDoc.data();
        if (draftState.status !== 'paused') {
            return res.status(400).json({ success: false, error: 'Draft is not paused' });
        }

        // Calculate new deadline from remaining time
        const remaining = draftState.time_remaining_seconds || draftState.time_per_pick_seconds || 60;
        const newDeadline = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + remaining * 1000)
        );

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update({
            status: 'in_progress',
            pick_deadline: newDeadline,
            resumed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Draft resumed' });

    } catch (error) {
        console.error('Error resuming draft:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Undo Draft Pick
 * Removes the last pick and resets the draft state
 */
exports.undoDraftPick = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify director access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid || !access.isDirector) {
            return res.status(403).json({ success: false, error: 'Director access required' });
        }

        // Get draft state
        const draftDoc = await db.collection('leagues').doc(league_id).collection('draft').doc('current').get();
        if (!draftDoc.exists) {
            return res.status(400).json({ success: false, error: 'No draft found' });
        }

        const draftState = draftDoc.data();
        const picks = draftState.picks || [];

        if (picks.length === 0) {
            return res.status(400).json({ success: false, error: 'No picks to undo' });
        }

        // Get the last pick
        const lastPick = picks[picks.length - 1];

        // Remove team assignment from player
        await db.collection('leagues').doc(league_id).collection('players').doc(lastPick.player_id).update({
            team_id: admin.firestore.FieldValue.delete(),
            position: admin.firestore.FieldValue.delete(),
            drafted_at: admin.firestore.FieldValue.delete()
        });

        // Update draft state
        const newPicks = picks.slice(0, -1);
        const newPickIndex = Math.max(0, draftState.current_pick_index - 1);
        const newDeadline = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + draftState.time_per_pick_seconds * 1000)
        );

        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update({
            picks: newPicks,
            current_pick_index: newPickIndex,
            pick_deadline: newDeadline,
            status: 'in_progress' // Resume if was completed
        });

        // Update league status if was completed
        if (draftState.status === 'completed') {
            await db.collection('leagues').doc(league_id).update({
                status: 'draft',
                draft_status: 'in_progress'
            });
        }

        res.json({
            success: true,
            message: 'Pick undone',
            removed_pick: lastPick
        });

    } catch (error) {
        console.error('Error undoing pick:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Complete Draft
 * Manually completes the draft (director override)
 */
exports.completeDraft = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, pin } = req.body;

        if (!league_id || !pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Verify director access
        const access = await verifyLeagueAccess(league_id, pin);
        if (!access.valid || !access.isDirector) {
            return res.status(403).json({ success: false, error: 'Director access required' });
        }

        // Update draft state
        await db.collection('leagues').doc(league_id).collection('draft').doc('current').update({
            status: 'completed',
            completed_at: admin.firestore.FieldValue.serverTimestamp(),
            completed_manually: true
        });

        // Update league status
        await db.collection('leagues').doc(league_id).update({
            status: 'active',
            draft_status: 'completed',
            draft_completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Draft completed' });

    } catch (error) {
        console.error('Error completing draft:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = exports;
