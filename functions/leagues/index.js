/**
 * BRDC League System - Cloud Functions
 * Complete backend for Triples Draft League
 * 
 * Data Structure:
 * - leagues/{leagueId} - League settings and metadata
 * - leagues/{leagueId}/teams/{teamId} - Team roster and standings
 * - leagues/{leagueId}/players/{playerId} - Player registration and stats
 * - leagues/{leagueId}/matches/{matchId} - Weekly match records
 * - leagues/{leagueId}/matches/{matchId}/games/{gameId} - Individual game results
 * - leagues/{leagueId}/stats/{playerId} - Aggregated player statistics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ============================================================================
// MATCH FORMAT DEFINITION
// ============================================================================

const MATCH_FORMAT = [
    { game: 1, homePositions: [1, 2], awayPositions: [1, 2], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 2, homePositions: [3], awayPositions: [3], type: 'singles', format: 'cricket', checkout: null },
    { game: 3, homePositions: [1], awayPositions: [1], type: 'singles', format: 'cricket', checkout: null },
    { game: 4, homePositions: [2, 3], awayPositions: [2, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 5, homePositions: [2], awayPositions: [2], type: 'singles', format: 'cricket', checkout: null },
    { game: 6, homePositions: [1], awayPositions: [1], type: 'singles', format: '501', checkout: 'double' },
    { game: 7, homePositions: [1, 3], awayPositions: [1, 3], type: 'doubles', format: '501', checkout: 'choice' },
    { game: 8, homePositions: [2], awayPositions: [2], type: 'singles', format: '501', checkout: 'double' },
    { game: 9, homePositions: [3], awayPositions: [3], type: 'singles', format: '501', checkout: 'double' }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateMatchPin() {
    // 6-character alphanumeric for match access
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
        pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
}

function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================================
// LEAGUE MANAGEMENT
// ============================================================================

/**
 * Create a new league
 */
exports.createLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const data = req.body;

        // Validate required fields
        if (!data.league_name || !data.start_date || !data.venue_name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_name, start_date, venue_name'
            });
        }

        const adminPin = data.admin_pin || generatePin();

        const league = {
            league_name: data.league_name,
            season: data.season || 'Winter 2025',
            league_type: 'triples_draft',

            // Schedule
            start_date: data.start_date,
            league_night: data.league_night || 'wednesday',
            start_time: data.start_time || '19:00',

            // Venue
            venue_name: data.venue_name,
            venue_address: data.venue_address || '',

            // Structure
            num_teams: parseInt(data.num_teams) || 8,
            players_per_team: 3,
            games_per_match: 9,
            legs_per_game: 3, // Best of 3

            // Fees
            session_fee: parseFloat(data.session_fee) || 30,

            // Auth
            admin_pin: adminPin,

            // Status
            status: 'registration', // registration, draft, active, playoffs, completed
            current_week: 0,
            total_weeks: 0, // Calculated after teams set

            // Metadata
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const leagueRef = await db.collection('leagues').add(league);

        res.json({
            success: true,
            league_id: leagueRef.id,
            admin_pin: adminPin,
            message: 'League created successfully'
        });

    } catch (error) {
        console.error('Error creating league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get league details (public info)
 */
exports.getLeague = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        if (!leagueId) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueDoc = await db.collection('leagues').doc(leagueId).get();

        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        // Remove sensitive data
        delete league.admin_pin;

        res.json({
            success: true,
            league: { id: leagueId, ...league }
        });

    } catch (error) {
        console.error('Error getting league:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Update league status
 */
exports.updateLeagueStatus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, status } = req.body;

        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.admin_pin !== admin_pin) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        const validStatuses = ['registration', 'draft', 'active', 'playoffs', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        await db.collection('leagues').doc(league_id).update({
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: `League status updated to ${status}` });

    } catch (error) {
        console.error('Error updating league status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER REGISTRATION
// ============================================================================

/**
 * Register a player for the league
 */
exports.registerPlayer = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, name, email, phone, skill_level } = req.body;

        if (!league_id || !name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: league_id, name, email'
            });
        }

        // Check league exists and is accepting registrations
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.status !== 'registration') {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        // Check for duplicate email
        const existingPlayer = await db.collection('leagues').doc(league_id)
            .collection('players')
            .where('email', '==', email.toLowerCase())
            .get();

        if (!existingPlayer.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Check capacity
        const playersSnapshot = await db.collection('leagues').doc(league_id)
            .collection('players').get();
        const maxPlayers = league.num_teams * league.players_per_team;

        if (playersSnapshot.size >= maxPlayers) {
            return res.status(400).json({ success: false, error: 'League is full' });
        }

        const player = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || '',
            skill_level: skill_level || 'intermediate', // beginner, intermediate, advanced
            team_id: null,
            position: null, // 1, 2, or 3 (P1 = captain/advanced, P2 = mid, P3 = newer)
            is_captain: false,
            is_sub: false,
            payment_status: 'pending',
            registered_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const playerRef = await db.collection('leagues').doc(league_id)
            .collection('players').add(player);

        res.json({
            success: true,
            player_id: playerRef.id,
            message: 'Registration successful',
            spots_remaining: maxPlayers - playersSnapshot.size - 1
        });

    } catch (error) {
        console.error('Error registering player:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all registered players
 */
exports.getPlayers = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const playersSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players')
            .orderBy('registered_at', 'asc')
            .get();

        const players = [];
        playersSnapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, players: players });

    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

/**
 * Create teams manually (after draft)
 */
exports.createTeam = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin, team_name, player_ids } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.admin_pin !== admin_pin) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        if (!player_ids || player_ids.length !== 3) {
            return res.status(400).json({ success: false, error: 'Team must have exactly 3 players' });
        }

        // Get player data
        const playerData = [];
        for (const playerId of player_ids) {
            const playerDoc = await db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId).get();
            if (!playerDoc.exists) {
                return res.status(400).json({ success: false, error: `Player ${playerId} not found` });
            }
            playerData.push({ id: playerId, ...playerDoc.data() });
        }

        // Create team
        const team = {
            team_name: team_name,
            players: player_ids.map((id, index) => ({
                id: id,
                name: playerData[index].name,
                position: index + 1 // P1, P2, P3
            })),
            captain_id: player_ids[0], // P1 is captain

            // Standings
            wins: 0,
            losses: 0,
            ties: 0,
            games_won: 0,
            games_lost: 0,
            points: 0,

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const teamRef = await db.collection('leagues').doc(league_id)
            .collection('teams').add(team);

        // Update players with team assignment
        const batch = db.batch();
        player_ids.forEach((playerId, index) => {
            const playerRef = db.collection('leagues').doc(league_id)
                .collection('players').doc(playerId);
            batch.update(playerRef, {
                team_id: teamRef.id,
                position: index + 1,
                is_captain: index === 0
            });
        });
        await batch.commit();

        res.json({
            success: true,
            team_id: teamRef.id,
            message: 'Team created successfully'
        });

    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all teams with rosters
 */
exports.getTeams = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams')
            .orderBy('team_name', 'asc')
            .get();

        const teams = [];
        teamsSnapshot.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, teams: teams });

    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get standings (sorted teams)
 */
exports.getStandings = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams').get();

        const teams = [];
        teamsSnapshot.forEach(doc => {
            const team = doc.data();
            const totalMatches = team.wins + team.losses + team.ties;
            const winPct = totalMatches > 0 ? (team.wins / totalMatches * 100).toFixed(1) : '0.0';
            const totalGames = team.games_won + team.games_lost;
            const gamePct = totalGames > 0 ? (team.games_won / totalGames * 100).toFixed(1) : '0.0';

            teams.push({
                id: doc.id,
                ...team,
                total_matches: totalMatches,
                win_pct: parseFloat(winPct),
                total_games: totalGames,
                game_pct: parseFloat(gamePct)
            });
        });

        // Sort by points, then wins, then game percentage
        teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.game_pct - a.game_pct;
        });

        // Add rank
        teams.forEach((team, index) => {
            team.rank = index + 1;
        });

        res.json({ success: true, standings: teams });

    } catch (error) {
        console.error('Error getting standings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// SCHEDULE & MATCH MANAGEMENT
// ============================================================================

/**
 * Generate round-robin schedule
 */
exports.generateSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        if (!leagueDoc.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const league = leagueDoc.data();
        if (league.admin_pin !== admin_pin) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        // Get teams
        const teamsSnapshot = await db.collection('leagues').doc(league_id)
            .collection('teams').get();

        if (teamsSnapshot.empty) {
            return res.status(400).json({ success: false, error: 'No teams found' });
        }

        const teams = [];
        teamsSnapshot.forEach(doc => {
            teams.push({ id: doc.id, ...doc.data() });
        });

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams' });
        }

        // Generate round-robin (each team plays each other twice - home and away)
        const matches = [];
        const numTeams = teams.length;
        const teamsCopy = [...teams];

        // Add bye if odd number of teams
        if (numTeams % 2 !== 0) {
            teamsCopy.push({ id: 'BYE', team_name: 'BYE' });
        }

        const n = teamsCopy.length;
        const rounds = (n - 1) * 2; // Double round-robin
        const startDate = new Date(league.start_date);

        let week = 1;

        // First half - each team plays each other once
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[home];
                const awayTeam = teamsCopy[away];

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled', // scheduled, in_progress, completed
                        match_pin: null, // Generated when match starts
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Second half - reverse home/away
        for (let round = 0; round < n - 1; round++) {
            for (let match = 0; match < n / 2; match++) {
                const home = (round + match) % (n - 1);
                let away = (n - 1 - match + round) % (n - 1);

                if (match === 0) {
                    away = n - 1;
                }

                const homeTeam = teamsCopy[away]; // Swapped
                const awayTeam = teamsCopy[home]; // Swapped

                if (homeTeam.id !== 'BYE' && awayTeam.id !== 'BYE') {
                    const matchDate = new Date(startDate);
                    matchDate.setDate(startDate.getDate() + (week - 1) * 7);

                    matches.push({
                        week: week,
                        match_date: matchDate.toISOString().split('T')[0],
                        home_team_id: homeTeam.id,
                        home_team_name: homeTeam.team_name,
                        away_team_id: awayTeam.id,
                        away_team_name: awayTeam.team_name,
                        home_score: 0,
                        away_score: 0,
                        status: 'scheduled',
                        match_pin: null,
                        games: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
            week++;
        }

        // Save matches
        const batch = db.batch();
        matches.forEach(match => {
            const matchRef = db.collection('leagues').doc(league_id)
                .collection('matches').doc();
            batch.set(matchRef, match);
        });

        // Update league with total weeks
        batch.update(db.collection('leagues').doc(league_id), {
            total_weeks: week - 1,
            status: 'active',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        res.json({
            success: true,
            matches_created: matches.length,
            total_weeks: week - 1,
            message: 'Schedule generated successfully'
        });

    } catch (error) {
        console.error('Error generating schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get schedule (all matches or by week)
 */
exports.getSchedule = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const week = req.query.week || req.body.week;

        let query = db.collection('leagues').doc(leagueId)
            .collection('matches')
            .orderBy('week', 'asc');

        if (week) {
            query = query.where('week', '==', parseInt(week));
        }

        const matchesSnapshot = await query.get();

        const matches = [];
        matchesSnapshot.forEach(doc => {
            matches.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, matches: matches });

    } catch (error) {
        console.error('Error getting schedule:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start a match (generates PIN for tablet access)
 */
exports.startMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, admin_pin } = req.body;

        // Verify admin
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const league = leagueDoc.data();

        if (league.admin_pin !== admin_pin) {
            return res.status(403).json({ success: false, error: 'Invalid admin PIN' });
        }

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();

        // Get team rosters
        const homeTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id).get();
        const awayTeamDoc = await db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id).get();

        const homeTeam = homeTeamDoc.data();
        const awayTeam = awayTeamDoc.data();

        // Generate match PIN
        const matchPin = generateMatchPin();

        // Pre-populate the 9 games based on format
        const games = MATCH_FORMAT.map(format => {
            const homePlayers = format.homePositions.map(pos =>
                homeTeam.players.find(p => p.position === pos)
            );
            const awayPlayers = format.awayPositions.map(pos =>
                awayTeam.players.find(p => p.position === pos)
            );

            return {
                game_number: format.game,
                type: format.type,
                format: format.format,
                checkout: format.checkout,
                home_players: homePlayers,
                away_players: awayPlayers,
                status: 'pending', // pending, in_progress, completed
                winner: null, // 'home' or 'away'
                legs: [],
                home_legs_won: 0,
                away_legs_won: 0
            };
        });

        await matchRef.update({
            match_pin: matchPin,
            status: 'in_progress',
            games: games,
            started_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            match_pin: matchPin,
            games: games,
            message: 'Match started. Share the PIN with captains.'
        });

    } catch (error) {
        console.error('Error starting match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get match by PIN (for tablet access)
 */
exports.getMatchByPin = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { pin } = req.query.pin ? req.query : req.body;

        if (!pin) {
            return res.status(400).json({ success: false, error: 'Missing PIN' });
        }

        // Search all leagues for match with this PIN
        const leaguesSnapshot = await db.collection('leagues')
            .where('status', '==', 'active').get();

        let foundMatch = null;
        let foundLeagueId = null;

        for (const leagueDoc of leaguesSnapshot.docs) {
            const matchesSnapshot = await db.collection('leagues').doc(leagueDoc.id)
                .collection('matches')
                .where('match_pin', '==', pin.toUpperCase())
                .where('status', '==', 'in_progress')
                .get();

            if (!matchesSnapshot.empty) {
                foundMatch = { id: matchesSnapshot.docs[0].id, ...matchesSnapshot.docs[0].data() };
                foundLeagueId = leagueDoc.id;
                break;
            }
        }

        if (!foundMatch) {
            return res.status(404).json({ success: false, error: 'Match not found or not active' });
        }

        // Get full team data
        const homeTeamDoc = await db.collection('leagues').doc(foundLeagueId)
            .collection('teams').doc(foundMatch.home_team_id).get();
        const awayTeamDoc = await db.collection('leagues').doc(foundLeagueId)
            .collection('teams').doc(foundMatch.away_team_id).get();

        res.json({
            success: true,
            league_id: foundLeagueId,
            match: foundMatch,
            home_team: { id: homeTeamDoc.id, ...homeTeamDoc.data() },
            away_team: { id: awayTeamDoc.id, ...awayTeamDoc.data() },
            match_format: MATCH_FORMAT
        });

    } catch (error) {
        console.error('Error getting match by PIN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// GAME SCORING
// ============================================================================

/**
 * Start a game within a match
 */
exports.startGame = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;

        if (games[gameIndex].status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Game already started or completed' });
        }

        games[gameIndex].status = 'in_progress';
        games[gameIndex].started_at = new Date().toISOString();

        await matchRef.update({ games: games });

        res.json({
            success: true,
            game: games[gameIndex],
            message: `Game ${game_number} started`
        });

    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Record a leg result (called after each leg completes in scorer)
 */
exports.recordLeg = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, game_number, leg_data } = req.body;

        /*
        leg_data structure for 501:
        {
            leg_number: 1,
            winner: 'home', // or 'away'
            home_stats: {
                darts_thrown: 45,
                points_scored: 501,
                three_dart_avg: 33.4,
                highest_score: 140,
                tons: 2,          // 100+
                ton_forties: 1,   // 140+
                ton_eighties: 0,  // 180
                one_seventyone: 0,
                checkout: 36,
                checkout_attempts: 3
            },
            away_stats: { ... same structure ... }
        }

        leg_data structure for Cricket:
        {
            leg_number: 1,
            winner: 'home',
            home_stats: {
                rounds: 12,
                marks: 52,
                mpr: 4.33,
                nine_mark_rounds: 2,
                eight_mark_rounds: 1,
                points_scored: 125
            },
            away_stats: { ... }
        }
        */

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        const games = match.games;
        const gameIndex = game_number - 1;
        const game = games[gameIndex];

        // Add leg to game
        game.legs.push(leg_data);

        // Update leg counts
        if (leg_data.winner === 'home') {
            game.home_legs_won++;
        } else {
            game.away_legs_won++;
        }

        // Check if game is complete (best of 3 = first to 2)
        if (game.home_legs_won >= 2 || game.away_legs_won >= 2) {
            game.status = 'completed';
            game.winner = game.home_legs_won >= 2 ? 'home' : 'away';
            game.completed_at = new Date().toISOString();

            // Update match score
            if (game.winner === 'home') {
                match.home_score++;
            } else {
                match.away_score++;
            }
        }

        games[gameIndex] = game;

        await matchRef.update({
            games: games,
            home_score: match.home_score,
            away_score: match.away_score
        });

        // Update player stats
        await updatePlayerStats(league_id, game, leg_data);

        res.json({
            success: true,
            game: game,
            match_score: { home: match.home_score, away: match.away_score },
            game_complete: game.status === 'completed'
        });

    } catch (error) {
        console.error('Error recording leg:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Helper to update player statistics
 */
async function updatePlayerStats(leagueId, game, legData) {
    try {
        const updateStats = async (players, stats, isWinner) => {
            for (const player of players) {
                if (!player || !player.id) continue;

                const statsRef = db.collection('leagues').doc(leagueId)
                    .collection('stats').doc(player.id);

                const statsDoc = await statsRef.get();
                let playerStats = statsDoc.exists ? statsDoc.data() : {
                    player_id: player.id,
                    player_name: player.name,
                    // 501 stats
                    x01_legs_played: 0,
                    x01_legs_won: 0,
                    x01_total_darts: 0,
                    x01_total_points: 0,
                    x01_tons: 0,
                    x01_ton_forties: 0,
                    x01_ton_eighties: 0,
                    x01_one_seventy_ones: 0,
                    x01_high_checkout: 0,
                    x01_ton_plus_checkouts: 0,
                    x01_checkout_attempts: 0,
                    x01_checkouts_hit: 0,
                    // Cricket stats
                    cricket_legs_played: 0,
                    cricket_legs_won: 0,
                    cricket_total_rounds: 0,
                    cricket_total_marks: 0,
                    cricket_nine_mark_rounds: 0,
                    cricket_eight_mark_rounds: 0,
                    // Overall
                    games_played: 0,
                    games_won: 0
                };

                if (game.format === '501') {
                    playerStats.x01_legs_played++;
                    if (isWinner) playerStats.x01_legs_won++;
                    playerStats.x01_total_darts += stats.darts_thrown || 0;
                    playerStats.x01_total_points += stats.points_scored || 0;
                    playerStats.x01_tons += stats.tons || 0;
                    playerStats.x01_ton_forties += stats.ton_forties || 0;
                    playerStats.x01_ton_eighties += stats.ton_eighties || 0;
                    playerStats.x01_one_seventy_ones += stats.one_seventyone || 0;
                    playerStats.x01_checkout_attempts += stats.checkout_attempts || 0;

                    if (isWinner && stats.checkout) {
                        playerStats.x01_checkouts_hit++;
                        if (stats.checkout >= 100) {
                            playerStats.x01_ton_plus_checkouts++;
                        }
                        if (stats.checkout > playerStats.x01_high_checkout) {
                            playerStats.x01_high_checkout = stats.checkout;
                        }
                    }
                } else if (game.format === 'cricket') {
                    playerStats.cricket_legs_played++;
                    if (isWinner) playerStats.cricket_legs_won++;
                    playerStats.cricket_total_rounds += stats.rounds || 0;
                    playerStats.cricket_total_marks += stats.marks || 0;
                    playerStats.cricket_nine_mark_rounds += stats.nine_mark_rounds || 0;
                    playerStats.cricket_eight_mark_rounds += stats.eight_mark_rounds || 0;
                }

                await statsRef.set(playerStats, { merge: true });
            }
        };

        const homeWon = legData.winner === 'home';
        await updateStats(game.home_players, legData.home_stats, homeWon);
        await updateStats(game.away_players, legData.away_stats, !homeWon);

    } catch (error) {
        console.error('Error updating player stats:', error);
        // Don't throw - stats update failure shouldn't break game recording
    }
}

/**
 * Finalize a match (called when all 9 games complete)
 */
exports.finalizeMatch = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id } = req.body;

        const matchRef = db.collection('leagues').doc(league_id)
            .collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        const match = matchDoc.data();

        // Verify all games are complete
        const incompleteGames = match.games.filter(g => g.status !== 'completed');
        if (incompleteGames.length > 0) {
            return res.status(400).json({
                success: false,
                error: `${incompleteGames.length} games not yet completed`
            });
        }

        // Determine match winner
        let matchWinner = null;
        if (match.home_score > match.away_score) {
            matchWinner = 'home';
        } else if (match.away_score > match.home_score) {
            matchWinner = 'away';
        } else {
            matchWinner = 'tie';
        }

        // Update match
        await matchRef.update({
            status: 'completed',
            winner: matchWinner,
            match_pin: null, // Clear PIN
            completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update team standings
        const batch = db.batch();

        const homeTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.home_team_id);
        const awayTeamRef = db.collection('leagues').doc(league_id)
            .collection('teams').doc(match.away_team_id);

        if (matchWinner === 'home') {
            batch.update(homeTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        } else if (matchWinner === 'away') {
            batch.update(awayTeamRef, {
                wins: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(2),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
            batch.update(homeTeamRef, {
                losses: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
        } else {
            // Tie
            batch.update(homeTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.home_score),
                games_lost: admin.firestore.FieldValue.increment(match.away_score)
            });
            batch.update(awayTeamRef, {
                ties: admin.firestore.FieldValue.increment(1),
                points: admin.firestore.FieldValue.increment(1),
                games_won: admin.firestore.FieldValue.increment(match.away_score),
                games_lost: admin.firestore.FieldValue.increment(match.home_score)
            });
        }

        await batch.commit();

        res.json({
            success: true,
            winner: matchWinner,
            final_score: { home: match.home_score, away: match.away_score },
            message: 'Match finalized and standings updated'
        });

    } catch (error) {
        console.error('Error finalizing match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PLAYER STATS
// ============================================================================

/**
 * Get player stats
 */
exports.getPlayerStats = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;
        const playerId = req.query.player_id || req.body.player_id;

        if (playerId) {
            // Get single player
            const statsDoc = await db.collection('leagues').doc(leagueId)
                .collection('stats').doc(playerId).get();

            if (!statsDoc.exists) {
                return res.json({ success: true, stats: null });
            }

            const stats = statsDoc.data();

            // Calculate averages
            if (stats.x01_legs_played > 0) {
                stats.x01_three_dart_avg = (stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2);
            }
            if (stats.cricket_legs_played > 0) {
                stats.cricket_mpr = (stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2);
            }

            res.json({ success: true, stats: stats });

        } else {
            // Get all players' stats (leaderboard)
            const statsSnapshot = await db.collection('leagues').doc(leagueId)
                .collection('stats').get();

            const allStats = [];
            statsSnapshot.forEach(doc => {
                const stats = doc.data();

                // Calculate averages
                if (stats.x01_total_darts > 0) {
                    stats.x01_three_dart_avg = parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2));
                } else {
                    stats.x01_three_dart_avg = 0;
                }

                if (stats.cricket_total_rounds > 0) {
                    stats.cricket_mpr = parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2));
                } else {
                    stats.cricket_mpr = 0;
                }

                allStats.push({ id: doc.id, ...stats });
            });

            res.json({ success: true, stats: allStats });
        }

    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get leaderboards
 */
exports.getLeaderboards = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const leagueId = req.query.league_id || req.body.league_id;

        const statsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('stats').get();

        const allStats = [];
        statsSnapshot.forEach(doc => {
            const stats = doc.data();

            // Calculate derived stats
            stats.x01_three_dart_avg = stats.x01_total_darts > 0
                ? parseFloat((stats.x01_total_points / stats.x01_total_darts * 3).toFixed(2))
                : 0;

            stats.cricket_mpr = stats.cricket_total_rounds > 0
                ? parseFloat((stats.cricket_total_marks / stats.cricket_total_rounds).toFixed(2))
                : 0;

            stats.x01_checkout_pct = stats.x01_checkout_attempts > 0
                ? parseFloat((stats.x01_checkouts_hit / stats.x01_checkout_attempts * 100).toFixed(1))
                : 0;

            allStats.push({ id: doc.id, ...stats });
        });

        // Create various leaderboards
        const leaderboards = {
            x01_average: [...allStats]
                .filter(s => s.x01_legs_played >= 3)
                .sort((a, b) => b.x01_three_dart_avg - a.x01_three_dart_avg)
                .slice(0, 10),

            x01_180s: [...allStats]
                .sort((a, b) => b.x01_ton_eighties - a.x01_ton_eighties)
                .slice(0, 10),

            x01_171s: [...allStats]
                .sort((a, b) => b.x01_one_seventy_ones - a.x01_one_seventy_ones)
                .slice(0, 10),

            x01_high_checkout: [...allStats]
                .filter(s => s.x01_high_checkout > 0)
                .sort((a, b) => b.x01_high_checkout - a.x01_high_checkout)
                .slice(0, 10),

            x01_ton_plus_checkouts: [...allStats]
                .sort((a, b) => b.x01_ton_plus_checkouts - a.x01_ton_plus_checkouts)
                .slice(0, 10),

            cricket_mpr: [...allStats]
                .filter(s => s.cricket_legs_played >= 3)
                .sort((a, b) => b.cricket_mpr - a.cricket_mpr)
                .slice(0, 10),

            cricket_9_marks: [...allStats]
                .sort((a, b) => b.cricket_nine_mark_rounds - a.cricket_nine_mark_rounds)
                .slice(0, 10)
        };

        res.json({ success: true, leaderboards: leaderboards });

    } catch (error) {
        console.error('Error getting leaderboards:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export match format for use in other modules
exports.MATCH_FORMAT = MATCH_FORMAT;
