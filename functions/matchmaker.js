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
