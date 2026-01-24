/**
 * Matchmaker Tournament Functions
 * Handles mixed doubles tournaments with partner matching and breakup mechanics
 *
 * Features:
 * - Register as team (pre-formed couple) or single (get matched)
 * - Gender tracking for mixed doubles
 * - Random partner matching for singles
 * - "Breakup" mechanic when dropping to losers bracket
 * - Re-matching with other breakup players
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Create a matchmaker tournament with partner matching enabled
 */
exports.createMatchmakerTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const data = req.body;

        // Validate required fields
        if (!data.tournament_name || !data.tournament_date || !data.email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_name, tournament_date, email'
            });
        }

        // Use provided PIN or generate one
        const pin = data.director_pin || Math.floor(10000000 + Math.random() * 90000000).toString();

        const tournamentData = {
            // Basic info
            tournament_name: data.tournament_name,
            tournament_date: data.tournament_date,
            tournament_time: data.tournament_time || '',
            venue_name: data.venue_name || '',
            venue_address: data.venue_address || '',
            tournament_details: data.tournament_details || '',
            image_url: data.image_url || '',

            // Director info
            director_name: data.director_name || 'Unknown',
            director_email: data.email,
            director_phone: data.director_phone || '',
            director_pin: pin,
            director_player_id: data.director_player_id || null,

            // Matchmaker-specific settings
            matchmaker_enabled: true,
            entry_type: 'mixed_doubles',
            format: 'double_elimination',
            partner_matching: true,
            breakup_enabled: true,
            breakup_cutoff: data.breakup_cutoff || 'quarterfinals',

            // Match format
            game_type: data.game_type || '501',
            winners_best_of: data.winners_best_of || 5,
            losers_best_of: data.losers_best_of || 1,

            // Standard tournament fields
            max_players: data.max_players || 32,
            entry_fee: data.entry_fee || 0,
            status: 'registration',
            started: false,
            completed: false,
            bracketGenerated: false,

            // Registration tracking
            registration_counts: {
                teams: 0,
                singles_male: 0,
                singles_female: 0
            },

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const tournamentRef = await db.collection('tournaments').add(tournamentData);

        res.json({
            success: true,
            tournament_id: tournamentRef.id,
            pin: pin,
            message: 'Matchmaker tournament created successfully',
            settings: {
                format: 'double_elimination',
                entry_type: 'mixed_doubles',
                winners_best_of: tournamentData.winners_best_of,
                losers_best_of: tournamentData.losers_best_of,
                breakup_cutoff: tournamentData.breakup_cutoff
            }
        });

    } catch (error) {
        console.error('Create matchmaker tournament error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Register for a matchmaker tournament
 * Supports both team and single registration with gender tracking
 */
exports.matchmakerRegister = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, registration_type, team_name, player1, player2, player } = req.body;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Validate it's a matchmaker tournament
        if (!tournament.matchmaker_enabled) {
            return res.status(400).json({ success: false, error: 'This is not a matchmaker tournament' });
        }

        const registrationsRef = tournamentRef.collection('registrations');
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        if (registration_type === 'team') {
            // Team registration - pre-formed couple
            if (!player1 || !player2 || !player1.gender || !player2.gender) {
                return res.status(400).json({ success: false, error: 'Team registration requires both players with gender' });
            }

            // Validate mixed doubles (M/F pair)
            const genders = [player1.gender, player2.gender].sort();
            if (genders[0] !== 'F' || genders[1] !== 'M') {
                return res.status(400).json({ success: false, error: 'Mixed doubles requires one male and one female player' });
            }

            const regDoc = await registrationsRef.add({
                type: 'team',
                team_name: team_name || `${player1.name} & ${player2.name}`,
                player1: {
                    name: player1.name,
                    player_id: player1.player_id || null,
                    gender: player1.gender
                },
                player2: {
                    name: player2.name,
                    player_id: player2.player_id || null,
                    gender: player2.gender
                },
                matched: true,  // Pre-formed teams are already matched
                registered_at: timestamp
            });

            // Update tournament counts
            await tournamentRef.update({
                'registration_counts.teams': admin.firestore.FieldValue.increment(1)
            });

            return res.json({
                success: true,
                registration_id: regDoc.id,
                message: 'Team registered successfully'
            });

        } else if (registration_type === 'single') {
            // Single registration - needs to be matched
            if (!player || !player.gender) {
                return res.status(400).json({ success: false, error: 'Single registration requires player info with gender' });
            }

            const regDoc = await registrationsRef.add({
                type: 'single',
                player: {
                    name: player.name,
                    player_id: player.player_id || null,
                    gender: player.gender
                },
                matched: false,
                matched_with: null,
                team_id: null,
                registered_at: timestamp
            });

            // Update tournament counts
            const countField = player.gender === 'M' ? 'registration_counts.singles_male' : 'registration_counts.singles_female';
            await tournamentRef.update({
                [countField]: admin.firestore.FieldValue.increment(1)
            });

            return res.json({
                success: true,
                registration_id: regDoc.id,
                message: 'Registered as single - you will be matched with a partner',
                gender: player.gender
            });

        } else {
            return res.status(400).json({ success: false, error: 'Invalid registration_type. Use "team" or "single"' });
        }

    } catch (error) {
        console.error('Matchmaker registration error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get registration status for a matchmaker tournament
 * Shows teams, singles waiting, and balance status
 */
exports.getMatchmakerStatus = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        const registrationsSnap = await tournamentRef.collection('registrations').get();

        let teams = 0;
        let singlesMale = 0;
        let singlesFemale = 0;
        let matchedSingles = 0;

        registrationsSnap.docs.forEach(doc => {
            const reg = doc.data();
            if (reg.type === 'team') {
                teams++;
            } else if (reg.type === 'single') {
                if (reg.player.gender === 'M') singlesMale++;
                else singlesFemale++;
                if (reg.matched) matchedSingles++;
            }
        });

        const unmatchedMale = singlesMale - (matchedSingles / 2);
        const unmatchedFemale = singlesFemale - (matchedSingles / 2);
        const canMatch = Math.min(singlesMale, singlesFemale);
        const needMore = singlesMale > singlesFemale ?
            { gender: 'female', count: singlesMale - singlesFemale } :
            singlesFemale > singlesMale ?
            { gender: 'male', count: singlesFemale - singlesMale } :
            null;

        res.json({
            success: true,
            tournament_name: tournament.tournament_name,
            counts: {
                teams,
                singles_male: singlesMale,
                singles_female: singlesFemale,
                matched_singles: matchedSingles,
                total_teams_possible: teams + canMatch
            },
            balance: {
                balanced: singlesMale === singlesFemale,
                need_more: needMore
            }
        });

    } catch (error) {
        console.error('Get matchmaker status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Match all singles into teams (director action before tournament starts)
 * Randomly pairs males with females
 */
exports.matchmakerDrawPartners = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id || !director_pin) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id or director_pin' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        if (tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all unmatched singles
        const registrationsRef = tournamentRef.collection('registrations');
        const singlesSnap = await registrationsRef
            .where('type', '==', 'single')
            .where('matched', '==', false)
            .get();

        const males = [];
        const females = [];

        singlesSnap.docs.forEach(doc => {
            const reg = { id: doc.id, ...doc.data() };
            if (reg.player.gender === 'M') males.push(reg);
            else females.push(reg);
        });

        // Shuffle both arrays
        const shuffle = arr => arr.sort(() => Math.random() - 0.5);
        shuffle(males);
        shuffle(females);

        // Match pairs
        const matchCount = Math.min(males.length, females.length);
        const batch = db.batch();
        const newTeams = [];

        for (let i = 0; i < matchCount; i++) {
            const male = males[i];
            const female = females[i];

            // Create team document
            const teamRef = registrationsRef.doc();
            const teamData = {
                type: 'matched_team',
                team_name: `${male.player.name} & ${female.player.name}`,
                player1: male.player,
                player2: female.player,
                original_registrations: [male.id, female.id],
                matched: true,
                matched_at: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(teamRef, teamData);
            newTeams.push(teamData);

            // Update original registrations
            batch.update(registrationsRef.doc(male.id), {
                matched: true,
                matched_with: female.id,
                team_id: teamRef.id
            });
            batch.update(registrationsRef.doc(female.id), {
                matched: true,
                matched_with: male.id,
                team_id: teamRef.id
            });
        }

        await batch.commit();

        const unmatched = {
            males: males.length - matchCount,
            females: females.length - matchCount
        };

        res.json({
            success: true,
            teams_created: matchCount,
            new_teams: newTeams.map(t => t.team_name),
            unmatched: unmatched,
            message: matchCount > 0 ?
                `Created ${matchCount} new teams` :
                'No singles to match'
        });

    } catch (error) {
        console.error('Partner draw error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Trigger a breakup when dropping to losers bracket
 * Player requests to be re-matched with another breakup player
 */
exports.matchmakerBreakup = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, team_id, player_id, director_pin } = req.body;

        if (!tournament_id || !team_id || !player_id) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN
        if (tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Check if breakups are still allowed (not past cutoff round)
        const breakupCutoff = tournament.breakup_cutoff || 'quarterfinals';
        // TODO: Check current bracket round against cutoff

        // Get the team
        const teamRef = tournamentRef.collection('teams').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();

        // Find which player is initiating and which is being left
        const initiator = team.player1.player_id === player_id ? team.player1 : team.player2;
        const exPartner = team.player1.player_id === player_id ? team.player2 : team.player1;

        // Add both to breakup pool
        const breakupPoolRef = tournamentRef.collection('breakup_pool');

        const initiatorDoc = await breakupPoolRef.add({
            player: initiator,
            original_team_id: team_id,
            original_partner: exPartner,
            initiated_breakup: true,
            waiting_since: admin.firestore.FieldValue.serverTimestamp(),
            matched: false
        });

        const exPartnerDoc = await breakupPoolRef.add({
            player: exPartner,
            original_team_id: team_id,
            original_partner: initiator,
            initiated_breakup: false,
            waiting_since: admin.firestore.FieldValue.serverTimestamp(),
            matched: false
        });

        // Mark original team as broken up
        await teamRef.update({
            broken_up: true,
            broken_up_at: admin.firestore.FieldValue.serverTimestamp(),
            breakup_initiated_by: player_id
        });

        res.json({
            success: true,
            message: 'Breakup registered - both players added to re-matching pool',
            initiator_pool_id: initiatorDoc.id,
            ex_partner_pool_id: exPartnerDoc.id
        });

    } catch (error) {
        console.error('Breakup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Re-match players in the breakup pool
 * Called by director to pair up broken-up players for next losers bracket round
 */
exports.matchmakerRematch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id || !director_pin) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        if (tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get unmatched players from breakup pool
        const breakupPoolRef = tournamentRef.collection('breakup_pool');
        const unmatchedSnap = await breakupPoolRef
            .where('matched', '==', false)
            .get();

        const males = [];
        const females = [];

        unmatchedSnap.docs.forEach(doc => {
            const entry = { id: doc.id, ...doc.data() };
            if (entry.player.gender === 'M') males.push(entry);
            else females.push(entry);
        });

        // Shuffle and match
        const shuffle = arr => arr.sort(() => Math.random() - 0.5);
        shuffle(males);
        shuffle(females);

        const matchCount = Math.min(males.length, females.length);
        const batch = db.batch();
        const newTeams = [];

        for (let i = 0; i < matchCount; i++) {
            const male = males[i];
            const female = females[i];

            // Create new team
            const teamRef = tournamentRef.collection('teams').doc();
            const teamData = {
                team_name: `${male.player.name} & ${female.player.name}`,
                player1: male.player,
                player2: female.player,
                formed_from_breakup: true,
                original_teams: [male.original_team_id, female.original_team_id],
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(teamRef, teamData);
            newTeams.push({ id: teamRef.id, ...teamData });

            // Update breakup pool entries
            batch.update(breakupPoolRef.doc(male.id), {
                matched: true,
                new_team_id: teamRef.id,
                new_partner: female.player
            });
            batch.update(breakupPoolRef.doc(female.id), {
                matched: true,
                new_team_id: teamRef.id,
                new_partner: male.player
            });
        }

        await batch.commit();

        // Anyone left unmatched stays with original partner
        const unmatchedRemaining = {
            males: males.slice(matchCount),
            females: females.slice(matchCount)
        };

        res.json({
            success: true,
            teams_created: matchCount,
            new_teams: newTeams.map(t => ({ id: t.id, name: t.team_name })),
            unmatched_count: unmatchedRemaining.males.length + unmatchedRemaining.females.length,
            message: unmatchedRemaining.males.length + unmatchedRemaining.females.length > 0 ?
                'Some players could not be re-matched - they stay with original partners' :
                'All breakup players re-matched successfully'
        });

    } catch (error) {
        console.error('Rematch error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get all teams for bracket generation
 * Returns pre-formed teams + matched singles as unified team list
 */
exports.getMatchmakerTeams = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const registrationsSnap = await tournamentRef.collection('registrations').get();

        const teams = [];

        registrationsSnap.docs.forEach(doc => {
            const reg = doc.data();

            // Include pre-formed teams and matched teams
            if (reg.type === 'team' || reg.type === 'matched_team') {
                teams.push({
                    id: doc.id,
                    team_name: reg.team_name,
                    player1: reg.player1,
                    player2: reg.player2,
                    type: reg.type,
                    matched: reg.matched
                });
            }
        });

        res.json({
            success: true,
            team_count: teams.length,
            teams: teams
        });

    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Generate savage loss summary for a player
 * Analyzes match stats to find partner failures and creates personalized summary
 */
function generateSavageSummary(match_stats, player_id) {
    if (!match_stats || !player_id) {
        return {
            headline: 'Sorry, you lost.',
            savage_text: 'Better luck next time.',
            your_stats: {},
            partner_stats: {},
            missed_doubles: []
        };
    }

    const player_stats = match_stats.players?.[player_id] || {};
    const partner_id = match_stats.partner_id;
    const partner_stats = match_stats.players?.[partner_id] || {};
    const partner_name = match_stats.partner_name || 'your partner';

    const your_avg = player_stats.avg || 0;
    const partner_avg = partner_stats.avg || 0;
    const your_tons = player_stats.tons || 0;
    const partner_tons = partner_stats.tons || 0;
    const missed_doubles = match_stats.missed_doubles || [];

    let savage_text = '';

    // Find the most egregious failure
    const match_point_misses = missed_doubles.filter(d => d.context === 'match_point');

    if (match_point_misses.length > 0 && match_point_misses[0].player === partner_name) {
        const miss = match_point_misses[0];
        savage_text = `${partner_name} missed ${miss.attempts} dart${miss.attempts > 1 ? 's' : ''} at ${miss.target} to win after you hit ${miss.setup_score || 'big'} to set them up.`;
    } else if (your_avg > partner_avg + 10) {
        const diff = (your_avg - partner_avg).toFixed(1);
        savage_text = `You averaged ${your_avg.toFixed(1)} while ${partner_name} managed ${partner_avg.toFixed(1)}. That's a ${diff} point difference.`;
    } else if (your_tons > 0 && partner_tons === 0) {
        savage_text = `You hit ${your_tons} ton${your_tons > 1 ? 's' : ''} and ${partner_name} hit... well, they tried.`;
    } else {
        savage_text = `${partner_name}'s ${partner_avg.toFixed(1)} average wasn't quite enough tonight.`;
    }

    return {
        headline: 'Sorry, you lost.',
        savage_text: savage_text,
        your_stats: {
            avg: your_avg,
            tons: your_tons
        },
        partner_stats: {
            avg: partner_avg,
            tons: partner_tons
        },
        missed_doubles: missed_doubles
    };
}

/**
 * Trigger Heartbreaker when team loses in Winners Bracket
 * Generates savage summaries and adds team to heartbroken list
 * Returns immediately - client handles 20-second delay before showing UI
 */
exports.triggerHeartbreaker = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, team_id, match_stats } = req.body;

        if (!tournament_id || !team_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, team_id'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Only trigger in Winners Bracket
        if (!tournament.format || tournament.format !== 'double_elimination') {
            return res.status(400).json({
                success: false,
                error: 'Heartbreaker only available in double elimination format'
            });
        }

        // Get team data
        const teamRef = tournamentRef.collection('registrations').doc(team_id);
        const teamDoc = await teamRef.get();

        if (!teamDoc.exists) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }

        const team = teamDoc.data();
        const player1_id = team.player1?.player_id;
        const player2_id = team.player2?.player_id;

        // Generate savage summaries for both players
        const summary_player1 = generateSavageSummary(
            { ...match_stats, partner_id: player2_id, partner_name: team.player2?.name },
            player1_id
        );

        const summary_player2 = generateSavageSummary(
            { ...match_stats, partner_id: player1_id, partner_name: team.player1?.name },
            player2_id
        );

        // Add to heartbroken collection
        const heartbrokenRef = tournamentRef.collection('heartbroken').doc(team_id);
        await heartbrokenRef.set({
            team_name: team.team_name,
            player1: team.player1,
            player2: team.player2,
            lost_to_team_name: match_stats.opponent_team_name || 'Unknown',
            match_stats: match_stats,
            savage_summary_player1: summary_player1,
            savage_summary_player2: summary_player2,
            heartbroken_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Heartbreaker triggered - team added to heartbroken list',
            team_id: team_id,
            summaries_generated: true,
            note: 'Client should wait 20 seconds before showing mingle UI'
        });

    } catch (error) {
        console.error('Trigger heartbreaker error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Submit anonymous breakup decision during mingle period
 * NEVER exposes who opted in - absolute anonymity
 */
exports.submitBreakupDecision = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, player_id, wants_breakup } = req.body;

        if (!tournament_id || !player_id || wants_breakup === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, player_id, wants_breakup'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Verify player is in heartbroken list
        const heartbrokenSnap = await tournamentRef.collection('heartbroken')
            .where('player1.player_id', '==', player_id)
            .get();

        const heartbrokenSnap2 = await tournamentRef.collection('heartbroken')
            .where('player2.player_id', '==', player_id)
            .get();

        if (heartbrokenSnap.empty && heartbrokenSnap2.empty) {
            return res.status(403).json({
                success: false,
                error: 'Player not eligible for breakup - not in heartbroken list'
            });
        }

        // Check if player already submitted decision
        const existingDecisions = await tournamentRef.collection('breakup_decisions')
            .where('player_id', '==', player_id)
            .get();

        if (!existingDecisions.empty) {
            // Update existing decision
            await tournamentRef.collection('breakup_decisions')
                .doc(existingDecisions.docs[0].id)
                .update({
                    wants_breakup: wants_breakup,
                    decided_at: admin.firestore.FieldValue.serverTimestamp()
                });
        } else {
            // Create new decision
            await tournamentRef.collection('breakup_decisions').add({
                player_id: player_id,
                wants_breakup: wants_breakup,
                decided_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            message: 'Decision recorded anonymously',
            note: 'Partner will NOT be notified of your decision'
        });

    } catch (error) {
        console.error('Submit breakup decision error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get heartbroken teams for mingle UI
 * Returns list of other losing teams - NEVER reveals breakup decisions
 */
exports.getHeartbrokenTeams = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;
        const player_id = req.query.player_id || req.body.player_id;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const heartbrokenSnap = await tournamentRef.collection('heartbroken').get();

        const teams = [];
        let your_team_id = null;

        heartbrokenSnap.docs.forEach(doc => {
            const team = { id: doc.id, ...doc.data() };

            // Check if this is the requesting player's team
            if (player_id &&
                (team.player1?.player_id === player_id || team.player2?.player_id === player_id)) {
                your_team_id = doc.id;
            }

            // Include team info but NEVER breakup decisions
            teams.push({
                team_id: doc.id,
                team_name: team.team_name,
                player1_name: team.player1?.name,
                player2_name: team.player2?.name,
                lost_to: team.lost_to_team_name,
                heartbroken_at: team.heartbroken_at
                // NEVER include breakup_decisions or any decision data
            });
        });

        res.json({
            success: true,
            your_team_id: your_team_id,
            teams: teams,
            team_count: teams.length,
            note: 'Breakup decisions are never exposed to maintain absolute anonymity'
        });

    } catch (error) {
        console.error('Get heartbroken teams error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Start mingle period after WC R1 completes
 * Sets mingle_active: true, records start time, increments round
 */
exports.startMinglePeriod = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id || !director_pin) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, director_pin'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN
        if (tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get or create bracket document
        const bracketRef = tournamentRef.collection('bracket').doc('current');
        const bracketDoc = await bracketRef.get();

        const currentRound = bracketDoc.exists ? (bracketDoc.data().mingle_round || 0) : 0;

        // Update bracket state
        await bracketRef.set({
            mingle_active: true,
            mingle_started_at: admin.firestore.FieldValue.serverTimestamp(),
            mingle_round: currentRound + 1,
            mingle_ended_at: null
        }, { merge: true });

        res.json({
            success: true,
            message: 'Mingle period started',
            mingle_round: currentRound + 1,
            note: 'Players can now submit breakup decisions'
        });

    } catch (error) {
        console.error('Start mingle period error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * End mingle period when LAST WC R2 match STARTS
 * Sets mingle_active: false, records end time, locks decisions
 */
exports.endMinglePeriod = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id } = req.body;

        if (!tournament_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing tournament_id'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Update bracket state
        const bracketRef = tournamentRef.collection('bracket').doc('current');
        await bracketRef.set({
            mingle_active: false,
            mingle_ended_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Lock all breakup decisions
        const decisionsSnap = await tournamentRef.collection('breakup_decisions').get();
        const batch = db.batch();

        decisionsSnap.docs.forEach(doc => {
            batch.update(doc.ref, {
                locked: true,
                locked_at: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        res.json({
            success: true,
            message: 'Mingle period ended - all decisions locked',
            decisions_locked: decisionsSnap.size
        });

    } catch (error) {
        console.error('End mingle period error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Run Cupid Shuffle - re-match all breakup opt-ins
 * Gets all opt-ins, separates by gender, random re-matching (opposite gender only)
 * Creates new team documents and updates registrations
 */
exports.runCupidShuffle = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, director_pin } = req.body;

        if (!tournament_id || !director_pin) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, director_pin'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();

        // Verify director PIN
        if (tournament.director_pin !== director_pin) {
            return res.status(403).json({ success: false, error: 'Invalid PIN' });
        }

        // Get all breakup decisions where wants_breakup = true
        const decisionsSnap = await tournamentRef.collection('breakup_decisions')
            .where('wants_breakup', '==', true)
            .get();

        if (decisionsSnap.empty) {
            return res.json({
                success: true,
                message: 'No players opted for breakup',
                new_pairings: []
            });
        }

        // Get player details from heartbroken collection
        const heartbrokenSnap = await tournamentRef.collection('heartbroken').get();
        const heartbrokenMap = {};
        heartbrokenSnap.docs.forEach(doc => {
            const team = doc.data();
            if (team.player1?.player_id) {
                heartbrokenMap[team.player1.player_id] = team.player1;
            }
            if (team.player2?.player_id) {
                heartbrokenMap[team.player2.player_id] = team.player2;
            }
        });

        // Separate opt-ins by gender
        const males = [];
        const females = [];

        decisionsSnap.docs.forEach(doc => {
            const decision = doc.data();
            const player = heartbrokenMap[decision.player_id];

            if (!player) {
                console.warn(`Player ${decision.player_id} not found in heartbroken list`);
                return;
            }

            if (player.gender === 'M') {
                males.push(player);
            } else if (player.gender === 'F') {
                females.push(player);
            }
        });

        // Shuffle both arrays for random matching
        const shuffle = arr => arr.sort(() => Math.random() - 0.5);
        shuffle(males);
        shuffle(females);

        // Match pairs (must be opposite gender)
        const matchCount = Math.min(males.length, females.length);
        const batch = db.batch();
        const newPairings = [];
        const registrationsRef = tournamentRef.collection('registrations');

        for (let i = 0; i < matchCount; i++) {
            const male = males[i];
            const female = females[i];

            // Create new team document
            const teamRef = registrationsRef.doc();
            const teamData = {
                type: 'cupid_matched_team',
                team_name: `${male.name} & ${female.name}`,
                player1: male,
                player2: female,
                formed_from_cupid: true,
                cupid_round: tournament.mingle_round || 1,
                matched: true,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(teamRef, teamData);

            newPairings.push({
                team_id: teamRef.id,
                team_name: teamData.team_name,
                player1: male.name,
                player2: female.name
            });

            // Update original registrations (find by player_id)
            const player1RegSnap = await registrationsRef
                .where('player1.player_id', '==', male.player_id)
                .get();
            const player2RegSnap = await registrationsRef
                .where('player2.player_id', '==', female.player_id)
                .get();

            if (!player1RegSnap.empty) {
                batch.update(player1RegSnap.docs[0].ref, {
                    cupid_shuffled: true,
                    new_team_id: teamRef.id,
                    new_partner: female
                });
            }

            if (!player2RegSnap.empty) {
                batch.update(player2RegSnap.docs[0].ref, {
                    cupid_shuffled: true,
                    new_team_id: teamRef.id,
                    new_partner: male
                });
            }
        }

        await batch.commit();

        const unmatched = {
            males: males.slice(matchCount).map(m => m.name),
            females: females.slice(matchCount).map(f => f.name)
        };

        res.json({
            success: true,
            message: 'Cupid Shuffle complete - new pairings created',
            new_pairings: newPairings,
            pairings_count: matchCount,
            unmatched: unmatched,
            note: 'Unmatched players stay with original partners'
        });

    } catch (error) {
        console.error('Cupid Shuffle error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Create a Heartbreaker tournament with all preset values
 * Heartbreaker is a mixed doubles matchmaker tournament with specific game rules
 */
exports.createHeartbreakerTournament = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const data = req.body;

        // Validate required fields
        if (!data.tournament_name || !data.tournament_date || !data.email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_name, tournament_date, email'
            });
        }

        // Use provided PIN or generate one
        const pin = data.director_pin || Math.floor(10000000 + Math.random() * 90000000).toString();

        const tournamentData = {
            // Basic info
            tournament_name: data.tournament_name,
            tournament_date: data.tournament_date,
            tournament_time: data.tournament_time || '',
            venue_name: data.venue_name || 'Rookies',
            venue_address: data.venue_address || '',
            tournament_details: data.tournament_details || '',
            image_url: data.image_url || '',

            // Director info
            director_name: data.director_name || 'Unknown',
            director_email: data.email,
            director_phone: data.director_phone || '',
            director_pin: pin,
            director_player_id: data.director_player_id || null,

            // Heartbreaker-specific settings (PRESET VALUES)
            format: 'double_elimination',
            entry_type: 'mixed_doubles',
            matchmaker_enabled: true,
            partner_matching: true,
            breakup_enabled: true,

            // Winners bracket game settings
            winners_game_type: 'cricket',
            winners_best_of: 3,

            // Losers bracket game settings
            losers_game_type: '501',
            losers_best_of: 1,

            // Mingle/breakup settings
            mingle_cutoff: 'wc_r2_last_start',
            savage_summaries_enabled: true,
            nudge_limit: 3,

            // Venue settings
            boards_available: data.boards_available || 12,

            // Standard tournament fields
            max_players: data.max_players || 32,
            entry_fee: data.entry_fee || 0,
            status: 'registration',
            started: false,
            completed: false,
            bracketGenerated: false,

            // Registration tracking
            registration_counts: {
                teams: 0,
                singles_male: 0,
                singles_female: 0
            },

            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const tournamentRef = await db.collection('tournaments').add(tournamentData);

        res.json({
            success: true,
            tournament_id: tournamentRef.id,
            pin: pin,
            message: 'Heartbreaker tournament created successfully',
            settings: {
                format: 'double_elimination',
                entry_type: 'mixed_doubles',
                winners_game: 'cricket (best of 3)',
                losers_game: '501 (best of 1)',
                mingle_cutoff: 'wc_r2_last_start',
                savage_summaries: true,
                boards_available: tournamentData.boards_available
            }
        });

    } catch (error) {
        console.error('Create Heartbreaker tournament error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get mingle status
 * Returns mingle period active state and time remaining
 */
exports.getMingleStatus = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;

        if (!tournament_id) {
            return res.status(400).json({ success: false, error: 'Missing tournament_id' });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Get bracket state
        const bracketRef = tournamentRef.collection('bracket').doc('current');
        const bracketDoc = await bracketRef.get();

        if (!bracketDoc.exists) {
            return res.json({
                success: true,
                mingle_active: false,
                mingle_started: false,
                message: 'Mingle period has not started yet'
            });
        }

        const bracket = bracketDoc.data();
        const mingle_active = bracket.mingle_active || false;
        const mingle_started_at = bracket.mingle_started_at;
        const mingle_ended_at = bracket.mingle_ended_at;
        const mingle_round = bracket.mingle_round || 0;

        // Calculate time remaining (estimated based on typical WC R2 start time)
        // Assume 20 minutes from mingle start to when last WC R2 match starts
        let time_remaining_seconds = null;
        let estimated_end_time = null;

        if (mingle_active && mingle_started_at) {
            const startTime = mingle_started_at.toDate();
            const estimatedDuration = 20 * 60 * 1000; // 20 minutes in ms
            estimated_end_time = new Date(startTime.getTime() + estimatedDuration);
            const now = new Date();
            time_remaining_seconds = Math.max(0, Math.floor((estimated_end_time - now) / 1000));
        }

        // Count breakup decisions submitted
        const decisionsSnap = await tournamentRef.collection('breakup_decisions').get();
        const opt_in_count = decisionsSnap.docs.filter(d => d.data().wants_breakup === true).length;
        const opt_out_count = decisionsSnap.docs.filter(d => d.data().wants_breakup === false).length;
        const total_decisions = decisionsSnap.size;

        res.json({
            success: true,
            mingle_active: mingle_active,
            mingle_started: !!mingle_started_at,
            mingle_round: mingle_round,
            mingle_started_at: mingle_started_at,
            mingle_ended_at: mingle_ended_at,
            time_remaining_seconds: time_remaining_seconds,
            estimated_end_time: estimated_end_time,
            decisions: {
                total: total_decisions,
                opt_in: opt_in_count,
                opt_out: opt_out_count
            }
        });

    } catch (error) {
        console.error('Get mingle status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Send a nudge to another player during mingle period
 * Nudges are anonymous - target can see count but not who sent them
 */
exports.sendNudge = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { tournament_id, sender_player_id, target_player_id } = req.body;

        if (!tournament_id || !sender_player_id || !target_player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tournament_id, sender_player_id, target_player_id'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        const tournament = tournamentDoc.data();
        const nudge_limit = tournament.nudge_limit || 3;

        // Check if mingle period is active
        const bracketRef = tournamentRef.collection('bracket').doc('current');
        const bracketDoc = await bracketRef.get();

        if (!bracketDoc.exists || !bracketDoc.data().mingle_active) {
            return res.status(400).json({
                success: false,
                error: 'Mingle period is not active'
            });
        }

        // Verify sender is in mingle (opted for breakup)
        const senderDecisionSnap = await tournamentRef.collection('breakup_decisions')
            .where('player_id', '==', sender_player_id)
            .where('wants_breakup', '==', true)
            .get();

        if (senderDecisionSnap.empty) {
            return res.status(403).json({
                success: false,
                error: 'You must opt for breakup to send nudges'
            });
        }

        // Verify target is in mingle (opted for breakup)
        const targetDecisionSnap = await tournamentRef.collection('breakup_decisions')
            .where('player_id', '==', target_player_id)
            .where('wants_breakup', '==', true)
            .get();

        if (targetDecisionSnap.empty) {
            return res.status(400).json({
                success: false,
                error: 'Target player is not in mingle'
            });
        }

        // Get sender and target from heartbroken list to check gender
        const heartbrokenSnap = await tournamentRef.collection('heartbroken').get();
        let senderPlayer = null;
        let targetPlayer = null;

        heartbrokenSnap.docs.forEach(doc => {
            const team = doc.data();
            if (team.player1?.player_id === sender_player_id) senderPlayer = team.player1;
            if (team.player2?.player_id === sender_player_id) senderPlayer = team.player2;
            if (team.player1?.player_id === target_player_id) targetPlayer = team.player1;
            if (team.player2?.player_id === target_player_id) targetPlayer = team.player2;
        });

        if (!senderPlayer || !targetPlayer) {
            return res.status(404).json({
                success: false,
                error: 'Player not found in heartbroken list'
            });
        }

        // Validate opposite gender (mixed doubles rule)
        if (senderPlayer.gender === targetPlayer.gender) {
            return res.status(400).json({
                success: false,
                error: 'Can only nudge players of opposite gender'
            });
        }

        // Check sender hasn't exceeded nudge limit
        const senderNudgesSnap = await tournamentRef.collection('nudges')
            .where('sender_id', '==', sender_player_id)
            .get();

        if (senderNudgesSnap.size >= nudge_limit) {
            return res.status(400).json({
                success: false,
                error: `You have reached the nudge limit (${nudge_limit})`
            });
        }

        // Store nudge anonymously
        await tournamentRef.collection('nudges').add({
            sender_id: sender_player_id,
            target_id: target_player_id,
            sent_at: admin.firestore.FieldValue.serverTimestamp(),
            mingle_round: bracketDoc.data().mingle_round || 1
        });

        res.json({
            success: true,
            message: 'Nudge sent anonymously',
            nudges_remaining: nudge_limit - senderNudgesSnap.size - 1
        });

    } catch (error) {
        console.error('Send nudge error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get nudge count for a player
 * Returns how many nudges this player has received (but NOT who sent them)
 */
exports.getNudgeCount = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;
        const player_id = req.query.player_id || req.body.player_id;

        if (!tournament_id || !player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing tournament_id or player_id'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const nudgesSnap = await tournamentRef.collection('nudges')
            .where('target_id', '==', player_id)
            .get();

        res.json({
            success: true,
            nudge_count: nudgesSnap.size,
            note: 'Nudges are anonymous - senders are not revealed'
        });

    } catch (error) {
        console.error('Get nudge count error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get available nudge targets for a player
 * Returns list of opposite-gender players in mingle
 */
exports.getAvailableNudgeTargets = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const tournament_id = req.query.tournament_id || req.body.tournament_id;
        const player_id = req.query.player_id || req.body.player_id;

        if (!tournament_id || !player_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing tournament_id or player_id'
            });
        }

        const tournamentRef = db.collection('tournaments').doc(tournament_id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }

        // Check if mingle period is active
        const bracketRef = tournamentRef.collection('bracket').doc('current');
        const bracketDoc = await bracketRef.get();

        if (!bracketDoc.exists || !bracketDoc.data().mingle_active) {
            return res.status(400).json({
                success: false,
                error: 'Mingle period is not active'
            });
        }

        // Get all opt-ins
        const decisionsSnap = await tournamentRef.collection('breakup_decisions')
            .where('wants_breakup', '==', true)
            .get();

        const optInPlayerIds = decisionsSnap.docs.map(d => d.data().player_id);

        // Get player details from heartbroken list
        const heartbrokenSnap = await tournamentRef.collection('heartbroken').get();
        const heartbrokenMap = {};
        heartbrokenSnap.docs.forEach(doc => {
            const team = doc.data();
            if (team.player1?.player_id) {
                heartbrokenMap[team.player1.player_id] = team.player1;
            }
            if (team.player2?.player_id) {
                heartbrokenMap[team.player2.player_id] = team.player2;
            }
        });

        // Find requesting player's gender
        const playerData = heartbrokenMap[player_id];
        if (!playerData) {
            return res.status(404).json({
                success: false,
                error: 'Player not found in heartbroken list'
            });
        }

        const playerGender = playerData.gender;
        const oppositeGender = playerGender === 'M' ? 'F' : 'M';

        // Get count of nudges already sent by this player
        const senderNudgesSnap = await tournamentRef.collection('nudges')
            .where('sender_id', '==', player_id)
            .get();

        const alreadyNudged = new Set(senderNudgesSnap.docs.map(d => d.data().target_id));

        // Filter to opposite gender opt-ins, exclude self and already nudged
        const targets = optInPlayerIds
            .filter(id => id !== player_id)
            .filter(id => heartbrokenMap[id]?.gender === oppositeGender)
            .filter(id => !alreadyNudged.has(id))
            .map(id => ({
                player_id: id,
                name: heartbrokenMap[id].name,
                gender: heartbrokenMap[id].gender
            }));

        res.json({
            success: true,
            targets: targets,
            target_count: targets.length
        });

    } catch (error) {
        console.error('Get available nudge targets error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
