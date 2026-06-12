/**
 * Create Tournament Cloud Function
 * Accepts tournament data with events
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});
const { verifyFirebaseAuth } = require('../src/firebase-auth-helper');
const { requireTournamentAccess } = require('../src/tournament-auth-helper');

exports.createTournament = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        console.log('=== CREATE TOURNAMENT REQUEST ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const data = req.body;
        const authPlayer = await verifyFirebaseAuth(req);

        if (!authPlayer) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        // Validate required fields
        if (!data.tournament_name) {
            return res.status(400).json({
                success: false,
                error: 'Missing tournament_name'
            });
        }

        if (!data.tournament_date) {
            return res.status(400).json({
                success: false,
                error: 'Missing tournament_date'
            });
        }

        if (!data.email) {
            return res.status(400).json({
                success: false,
                error: 'Missing email'
            });
        }

        // Retain incoming director_pin if provided (legacy callers); no longer generated for new tournaments
        const pin = data.director_pin || null;

        // Normalize format (always use underscore internally)
        const normalizeFormat = (format) => {
            if (!format) return 'single_elimination';
            return format.toLowerCase().replace('-', '_');
        };

        const venueName = data.venue_name || data.venue || '';
        const locationMode = String(data.location_mode || '').toLowerCase() || 'specific';
        const isOnlineTournament = data.is_online === true
            || locationMode === 'online'
            || /online|virtual|remote/i.test(String(venueName || ''));
        const allowRemotePlay = data.allow_remote_play === true
            || locationMode === 'online'
            || locationMode === 'flexible';
        const boardCount = parseInt(data.venue_board_count ?? data.boards_available ?? 0, 10) || 0;
        const boardList = (value) => {
            if (Array.isArray(value)) {
                return value.map(item => parseInt(item, 10)).filter(item => Number.isFinite(item) && item > 0);
            }
            return String(value || '')
                .split(',')
                .map(item => parseInt(item.trim(), 10))
                .filter(item => Number.isFinite(item) && item > 0);
        };
        const unavailableBoards = boardList(data.unavailable_boards || data.reserved_boards);
        const runtimeSettings = {
            enable_tournament_chat: data.enable_tournament_chat !== false,
            enable_player_challenges: data.enable_player_challenges === true || allowRemotePlay,
            auto_create_match_rooms: data.auto_create_match_rooms === true || isOnlineTournament,
            require_check_in: data.require_check_in === true || allowRemotePlay,
            allow_player_self_report: data.allow_player_self_report !== false,
            show_tournament_runtime: data.show_tournament_runtime !== false,
            enable_video_streaming: data.enable_video_streaming === true || false,
            enable_score_assist: data.enable_score_assist === true || false,
            enable_runtime_notifications: data.enable_runtime_notifications !== false
        };
        const normalizeVoteOptions = (value) => {
            const seen = new Set();
            return (Array.isArray(value) ? value : [])
                .map((option, index) => {
                    const label = typeof option === 'string'
                        ? option
                        : (option?.label || option?.name || option?.id || '');
                    if (!String(label || '').trim()) return null;
                    const baseId = String(typeof option === 'object' && option?.id ? option.id : label)
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_+|_+$/g, '')
                        .slice(0, 48) || `option_${index + 1}`;
                    let id = baseId;
                    let suffix = 2;
                    while (seen.has(id)) {
                        id = `${baseId}_${suffix}`;
                        suffix += 1;
                    }
                    seen.add(id);
                    return { id, label: String(label).trim() };
                })
                .filter(Boolean);
        };
        const registrationVoteOptions = normalizeVoteOptions(data.registration_vote_options);
        const registrationVotingEnabled = data.registration_voting_enabled === true && registrationVoteOptions.length > 0;

        // Create tournament document with ALL fields
        const tournamentData = {
            tournament_name: data.tournament_name,
            tournament_date: data.tournament_date,
            tournament_time: data.tournament_time || '',
            image_url: data.image_url || '',
            location_mode: locationMode,
            venue_name: venueName,
            venue_address: locationMode === 'specific' ? (data.venue_address || '') : '',
            tournament_details: data.tournament_details || '',
            preset: data.preset || '',
            series_mode: data.series_mode || 'single',
            is_series: data.is_series === true || data.series_mode === 'series',
            registration_close_time: data.registration_close_time || '',
            registration_voting_enabled: registrationVotingEnabled,
            registration_vote_required: registrationVotingEnabled && data.registration_vote_required !== false,
            registration_vote_question: data.registration_vote_question || 'What should we play this week?',
            registration_vote_options: registrationVoteOptions,
            registration_vote_locked: data.registration_vote_locked === true,
            registration_vote_selected_label: data.registration_vote_selected_label || '',
            registration_vote_counts: {},
            draw_type: data.draw_type || '',
            draw_pool: data.draw_pool || '',
            checked_in_draw_default: data.checked_in_draw_default === true,
            allow_house_player: data.allow_house_player === true,
            auto_generate_runtime: data.auto_generate_runtime !== false,
            director_name: data.full_name || 'Unknown',
            director_email: data.email,
            director_phone: data.phone || '',
            director_player_id: data.director_player_id || authPlayer.id,
            director_firebase_uid: authPlayer.firebase_uid || null,
            created_by_player_id: authPlayer.id,
            
            // Tournament settings
            format: normalizeFormat(data.format),
            max_players: data.max_players || 32,
            entry_fee: data.entry_fee || 0,
            game_type: data.game || '501',
            boards_available: boardCount,
            venue_board_count: boardCount,
            unavailable_boards: unavailableBoards,
            reserved_boards: unavailableBoards,
            is_online: isOnlineTournament,
            allow_remote_play: allowRemotePlay,
            enable_tournament_chat: runtimeSettings.enable_tournament_chat,
            enable_player_challenges: runtimeSettings.enable_player_challenges,
            auto_create_match_rooms: runtimeSettings.auto_create_match_rooms,
            require_check_in: runtimeSettings.require_check_in,
            allow_player_self_report: runtimeSettings.allow_player_self_report,
            show_tournament_runtime: runtimeSettings.show_tournament_runtime,
            enable_video_streaming: runtimeSettings.enable_video_streaming,
            enable_score_assist: runtimeSettings.enable_score_assist,
            enable_runtime_notifications: runtimeSettings.enable_runtime_notifications,
            runtime_settings: runtimeSettings,
            
            // Status tracking
            status: 'created',
            started: false,
            completed: false,
            bracketGenerated: false,
            
            // Initialize empty player map
            players: {},
            registered_count: 0,
            
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            event_count: data.events?.length || 0
        };

        console.log('Creating tournament:', tournamentData);

        const tournamentRef = await admin.firestore()
            .collection('tournaments')
            .add(tournamentData);

        const tournamentId = tournamentRef.id;
        console.log('Tournament created with ID:', tournamentId);

        // Create events if provided (old structure support)
        let eventsCreated = 0;
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
            console.log('Creating', data.events.length, 'events');

            const batch = admin.firestore().batch();

            data.events.forEach((event, index) => {
                const eventRef = admin.firestore()
                    .collection('tournaments')
                    .doc(tournamentId)
                    .collection('events')
                    .doc();

                const eventData = {
                    tournament_id: tournamentId,
                    event_number: index + 1,
                    event_name: event.event_name || `Event ${index + 1}`,
                    image_url: event.image_url || '',
                    entry_type: event.entry_type || 'individual',
                    format: normalizeFormat(event.format),
                    game: event.game || '501',
                    draw_type: event.draw_type || data.draw_type || '',
                    draw_pool: event.draw_pool || data.draw_pool || '',
                    checked_in_draw_default: event.checked_in_draw_default === true || data.checked_in_draw_default === true,
                    allow_house_player: event.allow_house_player === true || data.allow_house_player === true,
                    auto_generate_runtime: event.auto_generate_runtime !== false && data.auto_generate_runtime !== false,
                    best_of: parseInt(event.best_of) || 3,
                    cork_rules: event.cork_rules || 'alternate',
                    cork_option: event.cork_option || 'winner_chooses',
                    cork_order: event.cork_order || '',
                    cork_winner_gets: event.cork_winner_gets || '',
                    default_starter: event.default_starter || '',
                    use_cork: event.use_cork !== false,
                    registered_count: 0,
                    in_option: event.in_option || 'free',
                    out_option: event.out_option || 'double',
                    x01_value: event.x01_value ? parseInt(event.x01_value) : null,
                    entry_fee: parseFloat(event.entry_fee) || 0,
                    start_time: event.start_time || '',
                    event_details: event.event_details || '',
                    num_legs: parseInt(event.num_legs) || parseInt(event.best_of) || 3,
                    num_sets: parseInt(event.num_sets) || 1,
                    leg_mode: event.leg_mode || 'best-of',
                    set_mode: event.set_mode || 'best-of',
                    total_legs: event.total_legs ? parseInt(event.total_legs) : null,
                    legs_to_win: event.legs_to_win ? parseInt(event.legs_to_win) : null,
                    sets_to_win: event.sets_to_win ? parseInt(event.sets_to_win) : null,
                    playoff_settings_enabled: event.playoff_settings_enabled === true,
                    playoff_settings: event.playoff_settings || null,
                    legs: Array.isArray(event.legs) ? event.legs : [],
                    status: 'pending',
                    player_count: 0,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                };

                console.log(`Event ${index + 1}:`, eventData.event_name);
                batch.set(eventRef, eventData);
                eventsCreated++;
            });

            await batch.commit();
            console.log('All events created successfully');
        }

        const response = {
            success: true,
            tournament_id: tournamentId,
            director_player_id: tournamentData.director_player_id,
            message: 'Tournament created successfully',
            events_created: eventsCreated
        };

        console.log('Sending success response:', response);
        res.json(response);

    } catch (error) {
        console.error('Error creating tournament:', error);
        console.error('Error stack:', error.stack);
        res.status(error.status || 500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Add a bot to a tournament
 */
exports.addBotToTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, bot_id } = req.body;

        if (!tournament_id || !bot_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, bot_id'
            });
        }

        const { tournamentRef, tournament } = await requireTournamentAccess(req, tournament_id);

        // Get bot from global bots collection
        const botDoc = await admin.firestore().collection('bots').doc(bot_id).get();
        if (!botDoc.exists) {
            return res.status(404).json({ success: false, error: 'Bot not found' });
        }

        const bot = botDoc.data();

        // Check if bot is already registered
        const players = tournament.players || {};
        const existingBot = Object.values(players).find(p => p.source_bot_id === bot_id);
        if (existingBot) {
            return res.status(400).json({ success: false, error: 'Bot already registered for this tournament' });
        }

        // Generate unique ID for this bot player
        const botPlayerId = `bot_${bot_id}_${Date.now()}`;

        // Add bot to tournament players
        const botPlayer = {
            name: bot.name,
            email: '',
            phone: '',
            isBot: true,
            botDifficulty: bot.difficulty,
            source_bot_id: bot_id,
            checkedIn: true, // Auto check-in bots
            registered_at: admin.firestore.Timestamp.now()
        };

        await tournamentRef.update({
            [`players.${botPlayerId}`]: botPlayer
        });

        res.json({
            success: true,
            player_id: botPlayerId,
            bot_name: bot.name,
            message: 'Bot added to tournament successfully'
        });

    } catch (error) {
        console.error('Error adding bot to tournament:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Update tournament settings
 */
exports.updateTournamentSettings = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id, settings } = req.body;

        if (!tournament_id || !settings) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or settings' });
        }

        const { tournamentRef } = await requireTournamentAccess(req, tournament_id);

        // Allowed fields that can be updated
        const allowedFields = [
            // Basic info
            'tournament_name', 'tournament_date', 'tournament_time', 'tournament_details',
            'venue_name', 'venue_address', 'image_url',
            // Format settings
            'format', 'max_players', 'game_type', 'entry_fee', 'status',
            'best_of', 'checkout', 'in_rule', 'out_rule',
            // Venue settings
            'venue_board_count', 'unavailable_boards', 'reserved_boards',
            // Matchmaker specific
            'winners_best_of', 'losers_best_of', 'breakup_cutoff', 'breakup_enabled',
            'partner_matching', 'matchmaker_enabled',
            'winners_game_type', 'losers_game_type', 'grand_finals_best_of',
            'entry_type', 'mingle_cutoff', 'savage_summaries_enabled', 'nudge_limit',
            // Registration voting
            'registration_voting_enabled', 'registration_vote_required',
            'registration_vote_question', 'registration_vote_options',
            'registration_vote_locked', 'registration_vote_selected_label'
        ];

        // Build update object with only allowed fields
        const updates = {};
        for (const field of allowedFields) {
            if (settings[field] !== undefined) {
                updates[field] = settings[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        await tournamentRef.update(updates);

        res.json({
            success: true,
            message: 'Tournament settings updated',
            updated_fields: Object.keys(updates).filter(k => k !== 'updated_at')
        });

    } catch (error) {
        console.error('Error updating tournament settings:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});

/**
 * Delete a tournament
 */
exports.deleteTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const { tournamentRef } = await requireTournamentAccess(req, tournament_id);

        // Delete all events subcollection
        const eventsSnapshot = await tournamentRef.collection('events').get();
        const batch = admin.firestore().batch();

        eventsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete tournament document
        batch.delete(tournamentRef);

        await batch.commit();

        res.json({
            success: true,
            message: 'Tournament deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting tournament:', error);
        res.status(error.status || 500).json({ success: false, error: error.message });
    }
});
