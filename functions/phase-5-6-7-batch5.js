// Batch 5: League Management (Refactored)

// Create League
exports.createLeague = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const data = req.body;

        if (!data.league_name || !data.start_date) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Calculate end date
        const startDate = new Date(data.start_date);
        const weeks = data.total_weeks || 12;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (weeks * 7));

        const league = {
            league_name: data.league_name,
            league_type: data.league_type || 'triples_draft',
            season: data.season || 'Spring 2026',
            start_date: data.start_date,
            end_date: endDate.toISOString().split('T')[0],
            venue_name: data.venue_name || 'Rookies',
            
            // Settings
            total_weeks: weeks,
            players_per_team: data.players_per_team || 3,
            max_teams: data.max_teams || 8,
            match_frequency: data.match_frequency || 'weekly',
            rounds: data.rounds || 2,
            
            // State
            status: 'registration',
            draft_completed: false,
            schedule_generated: false,
            
            // Data
            players: {},
            teams: {},
            schedule: [],
            standings: {},
            
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const leagueRef = await admin.firestore().collection('leagues').add(league);

        res.json({
            success: true,
            league_id: leagueRef.id,
            message: 'League created successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Register for League
exports.registerForLeague = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { league_id, player_name, player_email, player_phone } = req.body;

        if (!league_id || !player_name) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const leagueRef = admin.firestore().collection('leagues').doc(league_id);
        const league = await leagueRef.get();

        if (!league.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const leagueData = league.data();

        if (leagueData.status !== 'registration') {
            return res.status(400).json({ success: false, error: 'Registration is closed' });
        }

        const playerId = `player_${Date.now()}`;

        await leagueRef.update({
            [`players.${playerId}`]: {
                name: player_name,
                email: player_email || null,
                phone: player_phone || null,
                registered_at: admin.firestore.FieldValue.serverTimestamp(),
                team_id: null
            }
        });

        res.json({
            success: true,
            player_id: playerId,
            message: 'Registered successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Conduct League Draft
exports.conductLeagueDraft = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { league_id, draft_order } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueRef = admin.firestore().collection('leagues').doc(league_id);
        const league = await leagueRef.get();

        if (!league.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const leagueData = league.data();
        const players = Object.entries(leagueData.players || {})
            .map(([id, data]) => ({ id, ...data }));

        const playersPerTeam = leagueData.players_per_team || 3;
        const numTeams = Math.floor(players.length / playersPerTeam);

        if (players.length < playersPerTeam * 2) {
            return res.status(400).json({ success: false, error: 'Not enough players' });
        }

        // Snake draft
        const teams = {};
        let playerIndex = 0;

        for (let teamNum = 1; teamNum <= numTeams; teamNum++) {
            const teamId = `team_${teamNum}`;
            teams[teamId] = {
                name: `Team ${teamNum}`,
                players: [],
                wins: 0,
                losses: 0,
                points: 0
            };
        }

        // Draft rounds
        for (let round = 0; round < playersPerTeam; round++) {
            const teamKeys = Object.keys(teams);
            
            // Forward or reverse based on round
            if (round % 2 === 0) {
                for (let i = 0; i < teamKeys.length && playerIndex < players.length; i++) {
                    teams[teamKeys[i]].players.push({
                        id: players[playerIndex].id,
                        name: players[playerIndex].name
                    });
                    playerIndex++;
                }
            } else {
                for (let i = teamKeys.length - 1; i >= 0 && playerIndex < players.length; i--) {
                    teams[teamKeys[i]].players.push({
                        id: players[playerIndex].id,
                        name: players[playerIndex].name
                    });
                    playerIndex++;
                }
            }
        }

        await leagueRef.update({
            teams: teams,
            draft_completed: true,
            status: 'active',
            draft_date: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            teams: teams,
            message: 'Draft completed successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Generate League Schedule
exports.generateLeagueSchedule = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { league_id } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueRef = admin.firestore().collection('leagues').doc(league_id);
        const league = await leagueRef.get();

        if (!league.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const leagueData = league.data();
        const teams = Object.keys(leagueData.teams || {});

        if (teams.length < 2) {
            return res.status(400).json({ success: false, error: 'Need at least 2 teams' });
        }

        // Round-robin schedule
        const schedule = [];
        const rounds = leagueData.rounds || 2;
        let matchId = 1;
        let week = 1;

        for (let r = 0; r < rounds; r++) {
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    schedule.push({
                        id: `match_${matchId++}`,
                        week: week++,
                        team1: teams[i],
                        team2: teams[j],
                        team1_score: null,
                        team2_score: null,
                        completed: false,
                        date: null
                    });
                }
            }
        }

        await leagueRef.update({
            schedule: schedule,
            schedule_generated: true
        });

        res.json({
            success: true,
            matches: schedule.length,
            message: 'Schedule generated successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});

// Get League Standings
exports.getLeagueStandings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
    try {
        const { league_id } = req.query;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'Missing league_id' });
        }

        const leagueRef = admin.firestore().collection('leagues').doc(league_id);
        const league = await leagueRef.get();

        if (!league.exists) {
            return res.status(404).json({ success: false, error: 'League not found' });
        }

        const leagueData = league.data();
        const teams = leagueData.teams || {};
        const schedule = leagueData.schedule || [];

        // Calculate standings from completed matches
        const standings = {};

        Object.keys(teams).forEach(teamId => {
            standings[teamId] = {
                name: teams[teamId].name,
                wins: 0,
                losses: 0,
                points: 0,
                matchesPlayed: 0
            };
        });

        schedule.forEach(match => {
            if (match.completed) {
                const t1 = match.team1;
                const t2 = match.team2;

                standings[t1].matchesPlayed++;
                standings[t2].matchesPlayed++;

                if (match.team1_score > match.team2_score) {
                    standings[t1].wins++;
                    standings[t1].points += 2;
                    standings[t2].losses++;
                } else {
                    standings[t2].wins++;
                    standings[t2].points += 2;
                    standings[t1].losses++;
                }
            }
        });

        const sortedStandings = Object.entries(standings)
            .map(([id, stats]) => ({ teamId: id, ...stats }))
            .sort((a, b) => b.points - a.points || b.wins - a.wins);

        res.json({
            success: true,
            standings: sortedStandings
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
    });
});
