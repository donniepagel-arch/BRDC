/**
 * 8-Team Knockout Module
 * Simple bracket system for casual bar nights
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Create a new 8-team knockout bracket
 */
exports.createKnockout = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            name,           // Knockout name (optional)
            teams,          // Array of 8 teams: [{ name, players: [{ id?, name }] }]
            format,         // '501' or 'cricket'
            best_of,        // Best of X legs (usually 3)
            created_by      // Optional: player ID who created it
        } = req.body;

        if (!teams || teams.length < 2 || teams.length > 8) {
            return res.status(400).json({ error: '2-8 teams required' });
        }

        // Validate teams have names
        for (let i = 0; i < teams.length; i++) {
            if (!teams[i].name) {
                return res.status(400).json({ error: `Team ${i + 1} needs a name` });
            }
        }

        const teamCount = teams.length;

        // Generate bracket structure based on team count
        // For flexibility, support 2, 4, or 8 teams (single elim brackets)
        // For odd numbers (3, 5, 6, 7), we'll use byes
        let bracket;

        if (teamCount === 2) {
            // Direct final
            bracket = {
                round1: [],
                semis: [],
                final: { match: 1, team1: 0, team2: 1, winner: null, score: [0, 0], status: 'pending' }
            };
        } else if (teamCount <= 4) {
            // Semis + Final (4 teams or 3 with a bye)
            bracket = {
                round1: [],
                semis: [
                    { match: 1, team1: 0, team2: 1, winner: null, score: [0, 0], status: 'pending' },
                    { match: 2, team1: teamCount > 2 ? 2 : null, team2: teamCount > 3 ? 3 : null, winner: null, score: [0, 0], status: teamCount > 3 ? 'pending' : (teamCount === 3 ? 'bye' : 'waiting') }
                ],
                final: { match: 3, team1: null, team2: null, winner: null, score: [0, 0], status: 'waiting' }
            };
            // Handle 3-team bye: team 3 advances automatically
            if (teamCount === 3) {
                bracket.semis[1].winner = 0; // team2 index 2 wins by bye
                bracket.semis[1].status = 'completed';
                bracket.final.team2 = 2; // team index 2 goes to final
            }
        } else {
            // Full 8-team bracket (or 5-7 with byes)
            bracket = {
                round1: [
                    { match: 1, team1: 0, team2: 1, winner: null, score: [0, 0], status: 'pending' },
                    { match: 2, team1: teamCount > 2 ? 2 : null, team2: teamCount > 3 ? 3 : null, winner: null, score: [0, 0], status: teamCount > 3 ? 'pending' : 'bye' },
                    { match: 3, team1: teamCount > 4 ? 4 : null, team2: teamCount > 5 ? 5 : null, winner: null, score: [0, 0], status: teamCount > 5 ? 'pending' : 'bye' },
                    { match: 4, team1: teamCount > 6 ? 6 : null, team2: teamCount > 7 ? 7 : null, winner: null, score: [0, 0], status: teamCount > 7 ? 'pending' : 'bye' }
                ],
                semis: [
                    { match: 5, team1: null, team2: null, winner: null, score: [0, 0], status: 'waiting' },
                    { match: 6, team1: null, team2: null, winner: null, score: [0, 0], status: 'waiting' }
                ],
                final: { match: 7, team1: null, team2: null, winner: null, score: [0, 0], status: 'waiting' }
            };

            // Handle byes for 5-7 teams
            if (teamCount === 5) {
                // Match 2 bye: team 2 advances, match 3 bye: team 4 advances, match 4: no teams
                bracket.round1[1].status = 'completed'; bracket.round1[1].winner = 0;
                bracket.round1[2].status = 'completed'; bracket.round1[2].winner = 0;
                bracket.round1[3].status = 'completed';
                bracket.semis[0].team2 = 2; // Winner of match 2 bye
                bracket.semis[1].team1 = 4; // Winner of match 3 bye
            } else if (teamCount === 6) {
                // Match 3 bye: team 4 advances, match 4 bye: team 5 advances
                bracket.round1[2].status = 'completed'; bracket.round1[2].winner = 0;
                bracket.round1[3].status = 'completed'; bracket.round1[3].winner = 0;
                bracket.semis[1].team1 = 4;
                bracket.semis[1].team2 = 5;
                bracket.semis[1].status = 'pending';
            } else if (teamCount === 7) {
                // Match 4 bye: team 6 advances
                bracket.round1[3].status = 'completed'; bracket.round1[3].winner = 0;
                bracket.semis[1].team2 = 6;
            }
        }

        const knockoutRef = await db.collection('knockouts').add({
            name: name || `Knockout - ${new Date().toLocaleDateString()}`,
            teams,
            format: format || '501',
            best_of: best_of || 3,
            status: 'active',
            bracket,
            champion: null,
            created_by: created_by || null,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            knockout_id: knockoutRef.id,
            message: 'Knockout bracket created'
        });

    } catch (error) {
        console.error('Error creating knockout:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get knockout details
 */
exports.getKnockout = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        // Support both query params (GET) and body (POST)
        const knockoutId = req.query.id || req.query.knockout_id || req.body?.id || req.body?.knockout_id;

        if (!knockoutId) {
            return res.status(400).json({ error: 'Missing knockout ID' });
        }

        const knockoutDoc = await db.collection('knockouts').doc(knockoutId).get();

        if (!knockoutDoc.exists) {
            return res.status(404).json({ error: 'Knockout not found' });
        }

        const data = knockoutDoc.data();

        res.json({
            success: true,
            knockout: {
                id: knockoutId,
                ...data,
                created_at: data.created_at?.toDate?.() || null
            }
        });

    } catch (error) {
        console.error('Error getting knockout:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Submit a knockout match result
 */
exports.submitKnockoutMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const {
            knockout_id,
            match_number,   // 1-7
            winner_index,   // 0 (team1) or 1 (team2)
            score,          // [team1_legs, team2_legs]
            game_stats      // Optional detailed stats
        } = req.body;

        if (!knockout_id || !match_number) {
            return res.status(400).json({ error: 'Missing knockout_id or match_number' });
        }

        const knockoutRef = db.collection('knockouts').doc(knockout_id);
        const knockoutDoc = await knockoutRef.get();

        if (!knockoutDoc.exists) {
            return res.status(404).json({ error: 'Knockout not found' });
        }

        const knockout = knockoutDoc.data();
        const bracket = knockout.bracket;

        // Find the match
        let match = null;
        let matchLocation = null;

        if (match_number <= 4) {
            match = bracket.round1.find(m => m.match === match_number);
            matchLocation = 'round1';
        } else if (match_number <= 6) {
            match = bracket.semis.find(m => m.match === match_number);
            matchLocation = 'semis';
        } else if (match_number === 7) {
            match = bracket.final;
            matchLocation = 'final';
        }

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // Update match result
        match.winner = winner_index;
        match.score = score || [0, 0];
        match.status = 'completed';
        match.completed_at = admin.firestore.Timestamp.now();
        if (game_stats) match.stats = game_stats;

        // Get winning team index
        const winningTeamIndex = winner_index === 0 ? match.team1 : match.team2;

        // Advance winner to next round
        if (match_number <= 4) {
            // Quarterfinal winner goes to semis
            const semiMatch = match_number <= 2 ? 0 : 1;
            const slot = (match_number - 1) % 2 === 0 ? 'team1' : 'team2';
            bracket.semis[semiMatch][slot] = winningTeamIndex;

            // Check if both slots filled
            if (bracket.semis[semiMatch].team1 !== null && bracket.semis[semiMatch].team2 !== null) {
                bracket.semis[semiMatch].status = 'pending';
            }
        } else if (match_number <= 6) {
            // Semifinal winner goes to final
            const slot = match_number === 5 ? 'team1' : 'team2';
            bracket.final[slot] = winningTeamIndex;

            // Check if both slots filled
            if (bracket.final.team1 !== null && bracket.final.team2 !== null) {
                bracket.final.status = 'pending';
            }
        }

        // Check if knockout is complete
        const isComplete = match_number === 7;
        const champion = isComplete ? knockout.teams[winningTeamIndex] : null;

        // Save updates
        await knockoutRef.update({
            bracket,
            status: isComplete ? 'completed' : 'active',
            ...(isComplete && {
                champion,
                completed_at: admin.firestore.FieldValue.serverTimestamp()
            })
        });

        res.json({
            success: true,
            match: match,
            knockout_complete: isComplete,
            ...(isComplete && { champion })
        });

    } catch (error) {
        console.error('Error submitting knockout match:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start a knockout bracket (lock in team order after shuffle)
 */
exports.startKnockout = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { knockout_id, teams } = req.body;

        if (!knockout_id) {
            return res.status(400).json({ error: 'Missing knockout_id' });
        }

        const knockoutRef = db.collection('knockouts').doc(knockout_id);
        const knockoutDoc = await knockoutRef.get();

        if (!knockoutDoc.exists) {
            return res.status(404).json({ error: 'Knockout not found' });
        }

        const knockout = knockoutDoc.data();

        // Don't allow starting if already started
        if (knockout.started) {
            return res.status(400).json({ error: 'Bracket already started' });
        }

        // Update teams order and mark as started
        await knockoutRef.update({
            teams: teams || knockout.teams,
            started: true,
            started_at: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: 'Bracket started'
        });

    } catch (error) {
        console.error('Error starting knockout:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update a team name in a knockout
 */
exports.updateKnockoutTeam = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const { knockout_id, team_index, team_name } = req.body;

        if (!knockout_id || team_index === undefined || !team_name) {
            return res.status(400).json({ error: 'Missing knockout_id, team_index, or team_name' });
        }

        const knockoutRef = db.collection('knockouts').doc(knockout_id);
        const knockoutDoc = await knockoutRef.get();

        if (!knockoutDoc.exists) {
            return res.status(404).json({ error: 'Knockout not found' });
        }

        const knockout = knockoutDoc.data();
        const teams = knockout.teams;

        if (team_index < 0 || team_index >= teams.length) {
            return res.status(400).json({ error: 'Invalid team index' });
        }

        // Update team name
        teams[team_index].name = team_name;

        await knockoutRef.update({ teams });

        res.json({
            success: true,
            message: 'Team name updated'
        });

    } catch (error) {
        console.error('Error updating knockout team:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get active knockouts
 */
exports.getActiveKnockouts = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const knockoutsSnap = await db.collection('knockouts')
            .where('status', '==', 'active')
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();

        const knockouts = [];
        knockoutsSnap.forEach(doc => {
            const data = doc.data();
            knockouts.push({
                id: doc.id,
                name: data.name,
                format: data.format,
                teams: data.teams.map(t => t.name),
                created_at: data.created_at?.toDate?.() || null
            });
        });

        res.json({
            success: true,
            knockouts
        });

    } catch (error) {
        console.error('Error getting knockouts:', error);
        res.status(500).json({ error: error.message });
    }
});
