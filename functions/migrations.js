/**
 * BRDC Data Migration Functions
 * One-time scripts to normalize data structures
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

/**
 * Migrate team player arrays to player documents
 *
 * Finds teams with old player_ids/player_names arrays and creates
 * proper player documents in the players subcollection.
 *
 * POST: { admin_pin, league_id (optional), dry_run (optional) }
 * - admin_pin: Required for authorization
 * - league_id: If provided, only migrate that league. Otherwise migrate all.
 * - dry_run: If true, report what would be done without making changes
 */
exports.migrateTeamPlayersToDocuments = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { admin_pin, league_id, dry_run = false } = req.body;

            // Simple admin check - require a known admin PIN
            if (!admin_pin) {
                return res.status(401).json({ error: 'Admin PIN required' });
            }

            // Verify player exists with this PIN (site admins have known PINs)
            // Check both as string and number since PIN storage may vary
            let adminSnap = await db.collection('players')
                .where('pin', '==', admin_pin)
                .limit(1)
                .get();

            if (adminSnap.empty) {
                // Try as number
                adminSnap = await db.collection('players')
                    .where('pin', '==', parseInt(admin_pin))
                    .limit(1)
                    .get();
            }

            if (adminSnap.empty) {
                return res.status(403).json({ error: 'Not authorized - invalid PIN' });
            }

            const adminPlayer = adminSnap.docs[0].data();
            console.log('Migration requested by:', adminPlayer.name || adminPlayer.email || admin_pin);

            const results = {
                leagues_processed: 0,
                teams_migrated: 0,
                players_created: 0,
                teams_already_migrated: 0,
                errors: [],
                details: []
            };

            // Get leagues to process
            let leaguesQuery;
            if (league_id) {
                leaguesQuery = await db.collection('leagues').doc(league_id).get();
                if (!leaguesQuery.exists) {
                    return res.status(404).json({ error: 'League not found' });
                }
            }

            const leagueDocs = league_id
                ? [{ id: league_id, ...await db.collection('leagues').doc(league_id).get().then(d => d.data()) }]
                : await db.collection('leagues').get().then(snap => {
                    const docs = [];
                    snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
                    return docs;
                });

            for (const league of leagueDocs) {
                results.leagues_processed++;

                // Get all teams in this league
                const teamsSnap = await db.collection('leagues').doc(league.id)
                    .collection('teams').get();

                // Get existing players in this league (to avoid duplicates)
                const existingPlayersSnap = await db.collection('leagues').doc(league.id)
                    .collection('players').get();
                const existingPlayerIds = new Set();
                existingPlayersSnap.forEach(doc => existingPlayerIds.add(doc.id));

                for (const teamDoc of teamsSnap.docs) {
                    const team = teamDoc.data();
                    const teamId = teamDoc.id;

                    // Check if team has old-style arrays
                    if (!team.player_ids || !Array.isArray(team.player_ids) || team.player_ids.length === 0) {
                        results.teams_already_migrated++;
                        continue;
                    }

                    const playerIds = team.player_ids || [];
                    const playerNames = team.player_names || [];
                    const playerLevels = team.player_levels || [];

                    const teamDetail = {
                        league_id: league.id,
                        league_name: league.league_name || league.name,
                        team_id: teamId,
                        team_name: team.team_name || team.name,
                        players_to_create: []
                    };

                    const batch = db.batch();
                    let playersCreatedForTeam = 0;

                    for (let i = 0; i < playerIds.length; i++) {
                        const playerId = playerIds[i];
                        const playerName = playerNames[i] || 'Unknown';
                        const playerLevel = playerLevels[i] || '';

                        // Skip if player document already exists
                        if (existingPlayerIds.has(playerId)) {
                            teamDetail.players_to_create.push({
                                id: playerId,
                                name: playerName,
                                status: 'already_exists'
                            });
                            continue;
                        }

                        const playerData = {
                            name: playerName,
                            full_name: playerName,
                            team_id: teamId,
                            position: i + 1,
                            level: playerLevel,
                            is_captain: i === 0, // First player is typically captain
                            created_at: admin.firestore.FieldValue.serverTimestamp(),
                            migrated_from_array: true
                        };

                        teamDetail.players_to_create.push({
                            id: playerId,
                            name: playerName,
                            level: playerLevel,
                            position: i + 1,
                            status: 'will_create'
                        });

                        if (!dry_run) {
                            const playerRef = db.collection('leagues').doc(league.id)
                                .collection('players').doc(playerId);
                            batch.set(playerRef, playerData, { merge: true });
                        }

                        playersCreatedForTeam++;
                        existingPlayerIds.add(playerId); // Track to avoid duplicates
                    }

                    // Remove the arrays from team document
                    if (!dry_run && playersCreatedForTeam > 0) {
                        const teamRef = db.collection('leagues').doc(league.id)
                            .collection('teams').doc(teamId);
                        batch.update(teamRef, {
                            player_ids: admin.firestore.FieldValue.delete(),
                            player_names: admin.firestore.FieldValue.delete(),
                            player_levels: admin.firestore.FieldValue.delete(),
                            migrated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    if (!dry_run && playersCreatedForTeam > 0) {
                        await batch.commit();
                    }

                    if (playersCreatedForTeam > 0) {
                        results.teams_migrated++;
                        results.players_created += playersCreatedForTeam;
                        results.details.push(teamDetail);
                    }
                }
            }

            res.json({
                success: true,
                dry_run,
                message: dry_run
                    ? 'Dry run complete - no changes made'
                    : 'Migration complete',
                results
            });

        } catch (error) {
            console.error('Migration error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                stack: error.stack
            });
        }
    });
});

/**
 * Check migration status - see which leagues/teams still have old arrays
 *
 * POST: { admin_pin }
 */
exports.checkMigrationStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { admin_pin } = req.body;

            if (!admin_pin) {
                return res.status(401).json({ error: 'Admin PIN required' });
            }

            // Verify player exists with this PIN
            let adminSnap = await db.collection('players')
                .where('pin', '==', admin_pin)
                .limit(1)
                .get();

            if (adminSnap.empty) {
                adminSnap = await db.collection('players')
                    .where('pin', '==', parseInt(admin_pin))
                    .limit(1)
                    .get();
            }

            if (adminSnap.empty) {
                return res.status(403).json({ error: 'Not authorized - invalid PIN' });
            }

            const status = {
                leagues: [],
                total_teams_with_arrays: 0,
                total_teams_without_arrays: 0
            };

            const leaguesSnap = await db.collection('leagues').get();

            for (const leagueDoc of leaguesSnap.docs) {
                const league = leagueDoc.data();
                const leagueStatus = {
                    id: leagueDoc.id,
                    name: league.league_name || league.name,
                    teams_with_arrays: 0,
                    teams_without_arrays: 0,
                    players_in_collection: 0
                };

                // Count teams
                const teamsSnap = await db.collection('leagues').doc(leagueDoc.id)
                    .collection('teams').get();

                teamsSnap.forEach(teamDoc => {
                    const team = teamDoc.data();
                    if (team.player_ids && Array.isArray(team.player_ids) && team.player_ids.length > 0) {
                        leagueStatus.teams_with_arrays++;
                    } else {
                        leagueStatus.teams_without_arrays++;
                    }
                });

                // Count players in collection
                const playersSnap = await db.collection('leagues').doc(leagueDoc.id)
                    .collection('players').get();
                leagueStatus.players_in_collection = playersSnap.size;

                status.total_teams_with_arrays += leagueStatus.teams_with_arrays;
                status.total_teams_without_arrays += leagueStatus.teams_without_arrays;
                status.leagues.push(leagueStatus);
            }

            res.json({
                success: true,
                status,
                recommendation: status.total_teams_with_arrays > 0
                    ? `Run migration to convert ${status.total_teams_with_arrays} teams to new structure`
                    : 'All teams are using the new structure'
            });

        } catch (error) {
            console.error('Check status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Recalculate team standings from completed matches
 *
 * This fixes team wins/losses/ties by looking at all completed matches
 * and recalculating the standings.
 *
 * POST: { admin_pin, league_id (optional), dry_run (optional) }
 */
exports.recalculateTeamStandings = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { admin_pin, league_id, dry_run = false } = req.body;

            if (!admin_pin) {
                return res.status(401).json({ error: 'Admin PIN required' });
            }

            // Verify player exists with this PIN
            let adminSnap = await db.collection('players')
                .where('pin', '==', admin_pin)
                .limit(1)
                .get();

            if (adminSnap.empty) {
                adminSnap = await db.collection('players')
                    .where('pin', '==', parseInt(admin_pin))
                    .limit(1)
                    .get();
            }

            if (adminSnap.empty) {
                return res.status(403).json({ error: 'Not authorized - invalid PIN' });
            }

            const results = {
                leagues_processed: 0,
                teams_updated: 0,
                details: []
            };

            // Get leagues to process
            const leagueDocs = league_id
                ? [{ id: league_id }]
                : await db.collection('leagues').get().then(snap => {
                    const docs = [];
                    snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
                    return docs;
                });

            for (const league of leagueDocs) {
                results.leagues_processed++;

                // Get all teams in this league
                const teamsSnap = await db.collection('leagues').doc(league.id)
                    .collection('teams').get();

                // Initialize standings for all teams
                const standings = {};
                teamsSnap.forEach(teamDoc => {
                    standings[teamDoc.id] = {
                        team_name: teamDoc.data().team_name || teamDoc.data().name || 'Unknown',
                        wins: 0,
                        losses: 0,
                        ties: 0,
                        games_won: 0,
                        games_lost: 0,
                        points: 0
                    };
                });

                // Get all completed matches (check both status='completed' and completed=true)
                const matchesSnap = await db.collection('leagues').doc(league.id)
                    .collection('matches')
                    .where('status', '==', 'completed')
                    .get();

                // Also get matches with completed=true (legacy)
                const legacyMatchesSnap = await db.collection('leagues').doc(league.id)
                    .collection('matches')
                    .where('completed', '==', true)
                    .get();

                // Combine and dedupe
                const allMatches = new Map();
                matchesSnap.forEach(doc => allMatches.set(doc.id, doc));
                legacyMatchesSnap.forEach(doc => allMatches.set(doc.id, doc));

                // Calculate standings from matches
                allMatches.forEach(matchDoc => {
                    const match = matchDoc.data();
                    const homeId = match.home_team_id;
                    const awayId = match.away_team_id;
                    const homeScore = match.home_score || 0;
                    const awayScore = match.away_score || 0;

                    if (!standings[homeId] || !standings[awayId]) return;

                    // Update games won/lost
                    standings[homeId].games_won += homeScore;
                    standings[homeId].games_lost += awayScore;
                    standings[awayId].games_won += awayScore;
                    standings[awayId].games_lost += homeScore;

                    // Determine winner
                    if (homeScore > awayScore) {
                        standings[homeId].wins++;
                        standings[homeId].points += 2;
                        standings[awayId].losses++;
                    } else if (awayScore > homeScore) {
                        standings[awayId].wins++;
                        standings[awayId].points += 2;
                        standings[homeId].losses++;
                    } else {
                        // Tie
                        standings[homeId].ties++;
                        standings[homeId].points++;
                        standings[awayId].ties++;
                        standings[awayId].points++;
                    }
                });

                // Update team documents
                const batch = db.batch();
                let teamsInBatch = 0;

                for (const [teamId, stats] of Object.entries(standings)) {
                    const teamRef = db.collection('leagues').doc(league.id)
                        .collection('teams').doc(teamId);

                    results.details.push({
                        league_id: league.id,
                        team_id: teamId,
                        team_name: stats.team_name,
                        record: `${stats.wins}-${stats.losses}${stats.ties > 0 ? `-${stats.ties}` : ''}`,
                        games: `${stats.games_won}-${stats.games_lost}`,
                        points: stats.points
                    });

                    if (!dry_run) {
                        batch.update(teamRef, {
                            wins: stats.wins,
                            losses: stats.losses,
                            ties: stats.ties,
                            games_won: stats.games_won,
                            games_lost: stats.games_lost,
                            points: stats.points,
                            standings_updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                        teamsInBatch++;
                    }

                    results.teams_updated++;
                }

                if (!dry_run && teamsInBatch > 0) {
                    await batch.commit();
                }
            }

            res.json({
                success: true,
                dry_run,
                message: dry_run
                    ? 'Dry run complete - no changes made'
                    : 'Standings recalculated successfully',
                results
            });

        } catch (error) {
            console.error('Recalculate standings error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
