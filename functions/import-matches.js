/**
 * Import Match Data Functions
 * Temporary functions for importing DartConnect match data with throws
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Create global player documents from league player roster
 * This ensures every player in a league has a global player document
 * Players are stored in leagues/{leagueId}/players collection
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.createGlobalPlayersFromRosters = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, dryRun = true } = req.body;

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const results = {
            existingPlayers: [],
            newPlayersCreated: [],
            leaguePlayersUpdated: [],
            errors: []
        };

        // Get all existing global players (indexed by email and name)
        const globalPlayersSnapshot = await db.collection('players').get();
        const existingByEmail = {};
        const existingByName = {};

        globalPlayersSnapshot.forEach(doc => {
            const data = doc.data();
            const email = (data.email || '').toLowerCase().trim();
            const name = (data.name || data.full_name || '').toLowerCase().trim();

            if (email) existingByEmail[email] = { id: doc.id, ...data };
            if (name) existingByName[name] = { id: doc.id, ...data };
        });

        // Get all players in the league's players subcollection
        const leaguePlayersSnapshot = await db.collection('leagues').doc(leagueId).collection('players').get();

        for (const playerDoc of leaguePlayersSnapshot.docs) {
            const rosterPlayer = playerDoc.data();
            const rosterPlayerId = playerDoc.id;
            const email = (rosterPlayer.email || '').toLowerCase().trim();
            const name = (rosterPlayer.name || '').toLowerCase().trim();

            // Check if player already exists globally
            let existingPlayer = existingByEmail[email] || existingByName[name];

            if (existingPlayer) {
                // Player exists globally - check if league player ID matches
                results.existingPlayers.push({
                    name: rosterPlayer.name,
                    globalId: existingPlayer.id,
                    leaguePlayerId: rosterPlayerId,
                    needsUpdate: existingPlayer.id !== rosterPlayerId
                });

                if (existingPlayer.id !== rosterPlayerId) {
                    // League player has different ID than global - need to update stats later
                    results.leaguePlayersUpdated.push({
                        name: rosterPlayer.name,
                        oldId: rosterPlayerId,
                        newId: existingPlayer.id
                    });
                }
            } else {
                // Player doesn't exist globally - create global document using league player ID
                const newPlayerData = {
                    name: rosterPlayer.name,
                    email: rosterPlayer.email || null,
                    phone: rosterPlayer.phone || null,
                    skill_level: rosterPlayer.skill_level || null,
                    preferred_level: rosterPlayer.preferred_level || null,
                    pin: rosterPlayer.pin || null,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    created_from_league: leagueId,
                    stats: {
                        matches_played: 0,
                        matches_won: 0,
                        x01: { legs_played: 0, legs_won: 0, total_points: 0, total_darts: 0 },
                        cricket: { legs_played: 0, legs_won: 0, total_marks: 0, total_darts: 0 }
                    }
                };

                results.newPlayersCreated.push({
                    id: rosterPlayerId,
                    name: rosterPlayer.name,
                    email: rosterPlayer.email,
                    team_id: rosterPlayer.team_id
                });

                if (!dryRun) {
                    await db.collection('players').doc(rosterPlayerId).set(newPlayerData);
                }

                // Add to existing lookup so we don't create duplicates
                if (email) existingByEmail[email] = { id: rosterPlayerId, ...newPlayerData };
                if (name) existingByName[name] = { id: rosterPlayerId, ...newPlayerData };
            }
        }

        res.json({
            success: true,
            dryRun,
            results,
            summary: {
                existingGlobalPlayers: results.existingPlayers.length,
                newPlayersCreated: results.newPlayersCreated.length,
                leaguePlayersNeedingUpdate: results.leaguePlayersUpdated.length
            }
        });

    } catch (error) {
        console.error('Error creating global players:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Consolidate player IDs across the system
 * This migration ensures every player has ONE consistent ID used everywhere:
 * - Global players collection (source of truth)
 * - League team rosters
 * - League stats
 * - Tournament registrations/stats
 *
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.consolidatePlayerIds = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    // Name alias mappings for common variations/nicknames/typos
    const NAME_ALIASES = {
        'nate kull': 'nathan kull',
        'steph kull': 'stephanie kull',
        'jenn m': 'jennifer malek',
        'dom russano': 'dominick russano',
        'mike gonzales': 'michael gonzalez',
        'mike gonzalez': 'michael gonzalez',
        'eddie olschanskey': 'eddie olschansky',
        'cesar arroyo': 'cesar andino',
        'matt pagel': 'matt pagel',
        'christian ketchem': 'christian ketchem'
    };

    try {
        const { leagueId, dryRun = true } = req.body;

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const results = {
            playersFound: [],
            rosterUpdates: [],
            statsUpdates: [],
            statsMigrations: [],
            errors: []
        };

        // Step 1: Get all players from global players collection
        const playersSnapshot = await db.collection('players').get();
        const globalPlayers = {};
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || data.full_name || '').toLowerCase().trim();
            const email = (data.email || '').toLowerCase().trim();
            if (name) {
                globalPlayers[name] = { id: doc.id, name: data.name || data.full_name, email: data.email };
            }
            if (email) {
                globalPlayers[`email:${email}`] = { id: doc.id, name: data.name || data.full_name, email: data.email };
            }
        });

        // Helper function to find player by name with aliases
        const findGlobalPlayer = (playerName) => {
            const normalizedName = playerName.toLowerCase().trim();
            // Try exact match first
            if (globalPlayers[normalizedName]) {
                return globalPlayers[normalizedName];
            }
            // Try alias mapping
            const aliasedName = NAME_ALIASES[normalizedName];
            if (aliasedName && globalPlayers[aliasedName]) {
                return globalPlayers[aliasedName];
            }
            return null;
        };

        results.playersFound = Object.values(globalPlayers).filter((v, i, a) =>
            a.findIndex(t => t.id === v.id) === i
        );

        // Step 2: Get all teams in the league and check roster player IDs
        const teamsSnapshot = await db.collection('leagues').doc(leagueId).collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
            const team = teamDoc.data();
            const players = team.players || [];
            const updatedPlayers = [];
            let teamNeedsUpdate = false;

            for (const player of players) {
                const playerEmail = (player.email || '').toLowerCase().trim();

                // Try to find matching global player (using helper with alias support)
                let globalPlayer = findGlobalPlayer(player.name) || globalPlayers[`email:${playerEmail}`];

                if (globalPlayer && globalPlayer.id !== player.id) {
                    // Found a match but IDs differ - need to update
                    results.rosterUpdates.push({
                        team: team.team_name,
                        playerName: player.name,
                        oldId: player.id,
                        newId: globalPlayer.id
                    });

                    updatedPlayers.push({
                        ...player,
                        id: globalPlayer.id,
                        _previousId: player.id
                    });
                    teamNeedsUpdate = true;
                } else {
                    updatedPlayers.push(player);
                }
            }

            // Update team roster if needed
            if (teamNeedsUpdate && !dryRun) {
                await db.collection('leagues').doc(leagueId).collection('teams').doc(teamDoc.id).update({
                    players: updatedPlayers
                });
            }
        }

        // Step 3: Get all stats and migrate to correct player IDs
        const statsSnapshot = await db.collection('leagues').doc(leagueId).collection('stats').get();

        for (const statDoc of statsSnapshot.docs) {
            const stats = statDoc.data();
            const statPlayerId = statDoc.id;

            // Try to find matching global player (using helper with alias support)
            let globalPlayer = findGlobalPlayer(stats.player_name);

            if (globalPlayer && globalPlayer.id !== statPlayerId) {
                // Stats are under wrong ID - need to migrate
                results.statsMigrations.push({
                    playerName: stats.player_name,
                    oldId: statPlayerId,
                    newId: globalPlayer.id,
                    stats: {
                        x01_three_dart_avg: stats.x01_three_dart_avg,
                        cricket_mpr: stats.cricket_mpr,
                        matches_played: stats.matches_played
                    }
                });

                if (!dryRun) {
                    // Check if stats already exist under correct ID
                    const existingStats = await db.collection('leagues').doc(leagueId)
                        .collection('stats').doc(globalPlayer.id).get();

                    if (existingStats.exists) {
                        // Merge stats (add values together)
                        const existing = existingStats.data();
                        const merged = {
                            player_id: globalPlayer.id,
                            player_name: stats.player_name,
                            x01_legs_played: (existing.x01_legs_played || 0) + (stats.x01_legs_played || 0),
                            x01_legs_won: (existing.x01_legs_won || 0) + (stats.x01_legs_won || 0),
                            x01_total_darts: (existing.x01_total_darts || 0) + (stats.x01_total_darts || 0),
                            x01_total_points: (existing.x01_total_points || 0) + (stats.x01_total_points || 0),
                            x01_high_checkout: Math.max(existing.x01_high_checkout || 0, stats.x01_high_checkout || 0),
                            cricket_legs_played: (existing.cricket_legs_played || 0) + (stats.cricket_legs_played || 0),
                            cricket_legs_won: (existing.cricket_legs_won || 0) + (stats.cricket_legs_won || 0),
                            cricket_total_marks: (existing.cricket_total_marks || 0) + (stats.cricket_total_marks || 0),
                            cricket_total_darts: (existing.cricket_total_darts || 0) + (stats.cricket_total_darts || 0),
                            matches_played: (existing.matches_played || 0) + (stats.matches_played || 0),
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        };

                        // Recalculate averages
                        if (merged.x01_total_darts > 0) {
                            merged.x01_three_dart_avg = parseFloat(((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2));
                        }
                        if (merged.cricket_total_darts > 0) {
                            merged.cricket_mpr = parseFloat(((merged.cricket_total_marks / merged.cricket_total_darts) * 3).toFixed(2));
                        }

                        await db.collection('leagues').doc(leagueId).collection('stats').doc(globalPlayer.id).update(merged);
                    } else {
                        // Copy stats to correct ID
                        await db.collection('leagues').doc(leagueId).collection('stats').doc(globalPlayer.id).set({
                            ...stats,
                            player_id: globalPlayer.id,
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    // Delete old stats document
                    await db.collection('leagues').doc(leagueId).collection('stats').doc(statPlayerId).delete();
                }
            } else if (!globalPlayer) {
                // No matching global player found
                results.errors.push({
                    type: 'no_global_player',
                    playerName: stats.player_name,
                    statId: statPlayerId
                });
            }
        }

        res.json({
            success: true,
            dryRun,
            results
        });

    } catch (error) {
        console.error('Error consolidating player IDs:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Look up player IDs by email to create proper mapping
 * POST { emails: ["email1@example.com", "email2@example.com"] }
 * Returns { success: true, mapping: { "email1@example.com": { id: "xxx", name: "..." }, ... } }
 */
exports.lookupPlayersByEmail = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const { emails } = req.body;

        if (!emails || !Array.isArray(emails)) {
            res.status(400).json({ error: 'Missing emails array' });
            return;
        }

        const mapping = {};

        for (const email of emails) {
            const normalizedEmail = email.toLowerCase().trim();

            // Query players collection by email
            const playersSnapshot = await db.collection('players')
                .where('email', '==', normalizedEmail)
                .limit(1)
                .get();

            if (!playersSnapshot.empty) {
                const playerDoc = playersSnapshot.docs[0];
                const playerData = playerDoc.data();
                mapping[email] = {
                    id: playerDoc.id,
                    name: playerData.name || playerData.full_name || 'Unknown'
                };
            } else {
                // Try with original case
                const altSnapshot = await db.collection('players')
                    .where('email', '==', email)
                    .limit(1)
                    .get();

                if (!altSnapshot.empty) {
                    const playerDoc = altSnapshot.docs[0];
                    const playerData = playerDoc.data();
                    mapping[email] = {
                        id: playerDoc.id,
                        name: playerData.name || playerData.full_name || 'Unknown'
                    };
                }
            }
        }

        res.json({ success: true, mapping });

    } catch (error) {
        console.error('Error looking up players:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fully migrate league to use global player IDs everywhere
 * This updates:
 * - leagues/{id}/players collection (recreates docs with global IDs)
 * - leagues/{id}/teams (updates players array with global IDs)
 * - leagues/{id}/stats (already done by recalculateLeagueStats)
 *
 * POST { leagueId: "xxx", dryRun: true/false }
 */
exports.migrateLeagueToGlobalIds = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, dryRun = true } = req.body;

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const results = {
            leaguePlayersUpdated: [],
            leaguePlayersCreated: [],
            leaguePlayersDeleted: [],
            teamRostersUpdated: [],
            errors: []
        };

        // Step 1: Build global player lookup by name and email
        const globalPlayersSnapshot = await db.collection('players').get();
        const globalByName = {};
        const globalByEmail = {};

        globalPlayersSnapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || data.full_name || '').toLowerCase().trim();
            const email = (data.email || '').toLowerCase().trim();

            if (name) globalByName[name] = { id: doc.id, ...data };
            if (email) globalByEmail[email] = { id: doc.id, ...data };
        });

        // Step 2: Get all league players
        const leaguePlayersSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('players').get();

        const idMigrationMap = {}; // oldId -> newId

        for (const playerDoc of leaguePlayersSnapshot.docs) {
            const playerData = playerDoc.data();
            const oldId = playerDoc.id;
            const name = (playerData.name || '').toLowerCase().trim();
            const email = (playerData.email || '').toLowerCase().trim();

            // Find matching global player
            const globalPlayer = globalByEmail[email] || globalByName[name];

            if (globalPlayer && globalPlayer.id !== oldId) {
                // Need to migrate this player to global ID
                idMigrationMap[oldId] = globalPlayer.id;

                results.leaguePlayersUpdated.push({
                    name: playerData.name,
                    oldId: oldId,
                    newId: globalPlayer.id
                });

                if (!dryRun) {
                    // Create new document with global ID
                    const newPlayerData = {
                        ...playerData,
                        id: globalPlayer.id,
                        _migratedFrom: oldId,
                        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    await db.collection('leagues').doc(leagueId)
                        .collection('players').doc(globalPlayer.id).set(newPlayerData);

                    results.leaguePlayersCreated.push({
                        name: playerData.name,
                        id: globalPlayer.id
                    });

                    // Delete old document
                    await db.collection('leagues').doc(leagueId)
                        .collection('players').doc(oldId).delete();

                    results.leaguePlayersDeleted.push({
                        name: playerData.name,
                        id: oldId
                    });
                }
            } else if (!globalPlayer) {
                // No global player found - this shouldn't happen if createGlobalPlayersFromRosters was run
                results.errors.push({
                    type: 'no_global_player',
                    name: playerData.name,
                    leaguePlayerId: oldId
                });
            }
            // If IDs already match, nothing to do
        }

        // Step 3: Update team rosters
        const teamsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('teams').get();

        for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const players = teamData.players || [];
            let needsUpdate = false;
            const updatedPlayers = [];

            for (const player of players) {
                const oldId = player.id;
                const newId = idMigrationMap[oldId];

                if (newId) {
                    // Update player ID in roster
                    updatedPlayers.push({
                        ...player,
                        id: newId,
                        _previousId: oldId
                    });
                    needsUpdate = true;
                } else {
                    updatedPlayers.push(player);
                }
            }

            if (needsUpdate) {
                results.teamRostersUpdated.push({
                    teamId: teamDoc.id,
                    teamName: teamData.team_name,
                    playersUpdated: updatedPlayers.filter(p => p._previousId).map(p => ({
                        name: p.name,
                        oldId: p._previousId,
                        newId: p.id
                    }))
                });

                if (!dryRun) {
                    await db.collection('leagues').doc(leagueId)
                        .collection('teams').doc(teamDoc.id).update({
                            players: updatedPlayers
                        });
                }
            }
        }

        // Step 4: Also migrate any stats that might still be under old IDs
        const statsSnapshot = await db.collection('leagues').doc(leagueId)
            .collection('stats').get();

        for (const statDoc of statsSnapshot.docs) {
            const oldId = statDoc.id;
            const newId = idMigrationMap[oldId];

            if (newId) {
                results.statsUpdated = results.statsUpdated || [];
                results.statsUpdated.push({
                    playerName: statDoc.data().player_name,
                    oldId: oldId,
                    newId: newId
                });

                if (!dryRun) {
                    // Copy to new ID
                    const statData = statDoc.data();
                    statData.player_id = newId;
                    statData._migratedFrom = oldId;

                    await db.collection('leagues').doc(leagueId)
                        .collection('stats').doc(newId).set(statData);

                    // Delete old
                    await db.collection('leagues').doc(leagueId)
                        .collection('stats').doc(oldId).delete();
                }
            }
        }

        res.json({
            success: true,
            dryRun,
            results,
            summary: {
                playersToMigrate: results.leaguePlayersUpdated.length,
                teamsToUpdate: results.teamRostersUpdated.length,
                statsToMigrate: (results.statsUpdated || []).length,
                errors: results.errors.length
            }
        });

    } catch (error) {
        console.error('Error migrating league to global IDs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper to normalize team name for comparison
function normalizeTeamName(name) {
    return (name || '').toUpperCase().replace(/[^A-Z]/g, '');
}

// Check if import home team matches Firestore home team
function teamsMatch(importHome, firestoreHome) {
    const importNorm = normalizeTeamName(importHome);
    const fbNorm = normalizeTeamName(firestoreHome);
    // Check if either contains a significant portion of the other
    return fbNorm.includes(importNorm.substring(0, 4)) ||
           importNorm.includes(fbNorm.substring(0, 4));
}

// Swap home/away in leg data
function swapLegData(leg) {
    return {
        ...leg,
        winner: leg.winner === 'home' ? 'away' : leg.winner === 'away' ? 'home' : leg.winner,
        home_stats: leg.away_stats,
        away_stats: leg.home_stats,
        throws: leg.throws ? leg.throws.map(t => ({
            ...t,
            home: t.away,
            away: t.home
        })) : undefined
    };
}

/**
 * Import match data with throws and player_stats
 * Called with match data JSON in request body
 * Automatically detects and handles home/away team swaps
 */
exports.importMatchData = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { matchId, leagueId, matchData } = req.body;

        if (!matchId || !leagueId || !matchData) {
            res.status(400).json({ error: 'Missing required fields: matchId, leagueId, matchData' });
            return;
        }

        // Fetch existing match to check team orientation
        const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found in Firestore' });
            return;
        }

        const existingMatch = matchDoc.data();
        const needsSwap = !teamsMatch(matchData.home_team, existingMatch.home_team_name);

        console.log(`Import: ${matchData.home_team} vs ${matchData.away_team}`);
        console.log(`Firestore: ${existingMatch.home_team_name} vs ${existingMatch.away_team_name}`);
        console.log(`Needs swap: ${needsSwap}`);

        // Convert games to Firestore format, swapping if needed
        const firestoreGames = matchData.games.map((game, idx) => {
            const legs = game.legs.map(leg => {
                const baseLeg = {
                    leg_number: leg.leg_number,
                    format: leg.format,
                    winner: leg.winner,
                    home_stats: leg.home_stats,
                    away_stats: leg.away_stats,
                    player_stats: leg.player_stats,
                    throws: leg.throws
                };
                return needsSwap ? swapLegData(baseLeg) : baseLeg;
            });

            if (needsSwap) {
                return {
                    game: game.game_number,
                    type: game.type,
                    format: game.format,
                    home_players: game.away_players,
                    away_players: game.home_players,
                    home_legs_won: game.result.away_legs,
                    away_legs_won: game.result.home_legs,
                    winner: game.winner === 'home' ? 'away' : game.winner === 'away' ? 'home' : game.winner,
                    status: 'completed',
                    legs
                };
            } else {
                return {
                    game: game.game_number,
                    type: game.type,
                    format: game.format,
                    home_players: game.home_players,
                    away_players: game.away_players,
                    home_legs_won: game.result.home_legs,
                    away_legs_won: game.result.away_legs,
                    winner: game.winner,
                    status: 'completed',
                    legs
                };
            }
        });

        // Swap scores if needed
        const homeScore = needsSwap ? matchData.final_score.away : matchData.final_score.home;
        const awayScore = needsSwap ? matchData.final_score.home : matchData.final_score.away;

        const updateData = {
            games: firestoreGames,
            home_score: homeScore,
            away_score: awayScore,
            total_darts: matchData.total_darts,
            total_legs: matchData.total_legs,
            status: 'completed',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            import_source: 'dartconnect_rtf',
            teams_swapped: needsSwap
        };

        await matchRef.update(updateData);

        res.json({
            success: true,
            matchId,
            games: firestoreGames.length,
            totalLegs: matchData.total_legs,
            teamsSwapped: needsSwap,
            finalScore: { home: homeScore, away: awayScore }
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Find match by team names and week
 */
exports.findMatch = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, homeTeam, awayTeam, week } = req.query;

        if (!leagueId || !homeTeam || !awayTeam) {
            res.status(400).json({ error: 'Missing required params' });
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');
        const snapshot = await matchesRef.where('week', '==', parseInt(week) || 1).get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const homeMatch = data.home_team_name?.toUpperCase().includes(homeTeam.toUpperCase());
            const awayMatch = data.away_team_name?.toUpperCase().includes(awayTeam.toUpperCase());

            if (homeMatch && awayMatch) {
                res.json({
                    matchId: doc.id,
                    homeTeam: data.home_team_name,
                    awayTeam: data.away_team_name,
                    week: data.week,
                    status: data.status
                });
                return;
            }
        }

        res.status(404).json({ error: 'Match not found' });

    } catch (error) {
        console.error('Find match error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * List all matches for a league week
 */
exports.listMatches = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, week } = req.query;

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');
        let query = matchesRef;

        if (week) {
            query = query.where('week', '==', parseInt(week));
        }

        const snapshot = await query.get();

        const matches = snapshot.docs.map(doc => ({
            matchId: doc.id,
            homeTeam: doc.data().home_team_name,
            awayTeam: doc.data().away_team_name,
            week: doc.data().week,
            status: doc.data().status,
            homeScore: doc.data().home_score,
            awayScore: doc.data().away_score
        }));

        res.json({ matches });

    } catch (error) {
        console.error('List matches error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Fix swapped scores in existing matches
 * Pass matchIds and their correct scores
 */
exports.fixMatchScores = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { leagueId, fixes } = req.body;

        if (!leagueId || !fixes || !Array.isArray(fixes)) {
            res.status(400).json({ error: 'Missing leagueId or fixes array' });
            return;
        }

        const results = [];

        for (const fix of fixes) {
            const { matchId, homeScore, awayScore } = fix;

            if (!matchId || homeScore === undefined || awayScore === undefined) {
                results.push({ matchId, success: false, error: 'Missing data' });
                continue;
            }

            const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
            const matchDoc = await matchRef.get();

            if (!matchDoc.exists) {
                results.push({ matchId, success: false, error: 'Not found' });
                continue;
            }

            const match = matchDoc.data();
            const games = match.games || [];

            // Swap all game/leg data
            const fixedGames = games.map(game => {
                const fixedLegs = (game.legs || []).map(leg => {
                    const fixedLeg = {
                        ...leg,
                        winner: leg.winner === 'home' ? 'away' : leg.winner === 'away' ? 'home' : leg.winner
                    };

                    // Swap stats (only if they exist)
                    if (leg.home_stats || leg.away_stats) {
                        fixedLeg.home_stats = leg.away_stats || null;
                        fixedLeg.away_stats = leg.home_stats || null;
                    }

                    // Swap throws (only if they exist)
                    if (leg.throws && Array.isArray(leg.throws)) {
                        fixedLeg.throws = leg.throws.map(t => {
                            const swapped = { ...t };
                            // Only swap if at least one side exists
                            if (t.home !== undefined || t.away !== undefined) {
                                swapped.home = t.away || null;
                                swapped.away = t.home || null;
                            }
                            return swapped;
                        });
                    }

                    return fixedLeg;
                });

                return {
                    ...game,
                    home_players: game.away_players || [],
                    away_players: game.home_players || [],
                    home_legs_won: game.away_legs_won || 0,
                    away_legs_won: game.home_legs_won || 0,
                    winner: game.winner === 'home' ? 'away' : game.winner === 'away' ? 'home' : game.winner,
                    legs: fixedLegs
                };
            });

            await matchRef.update({
                home_score: homeScore,
                away_score: awayScore,
                games: fixedGames,
                score_corrected: true,
                corrected_at: admin.firestore.FieldValue.serverTimestamp()
            });

            results.push({
                matchId,
                success: true,
                homeTeam: match.home_team_name,
                awayTeam: match.away_team_name,
                oldScore: `${match.home_score}-${match.away_score}`,
                newScore: `${homeScore}-${awayScore}`
            });
        }

        res.json({ success: true, results });

    } catch (error) {
        console.error('Fix scores error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update match scores to use sets (games won) instead of legs
 * Also updates team standings
 */
exports.updateToSetScores = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, overrides } = req.body;
        // overrides: { matchId: { homeScore, awayScore } } for manual corrections

        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches');
        const snapshot = await matchesRef.where('status', '==', 'completed').get();

        const results = [];
        const teamStats = {};

        for (const doc of snapshot.docs) {
            const match = doc.data();
            const matchId = doc.id;

            let homeScore, awayScore;

            // Check for manual override
            if (overrides && overrides[matchId]) {
                homeScore = overrides[matchId].homeScore;
                awayScore = overrides[matchId].awayScore;
            } else {
                // Calculate from game winners
                homeScore = 0;
                awayScore = 0;
                (match.games || []).forEach(g => {
                    if (g.winner === 'home') homeScore++;
                    else if (g.winner === 'away') awayScore++;
                });
            }

            // Update match score
            await matchesRef.doc(matchId).update({
                home_score: homeScore,
                away_score: awayScore,
                score_type: 'sets'
            });

            results.push({
                matchId,
                homeTeam: match.home_team_name,
                awayTeam: match.away_team_name,
                oldScore: `${match.home_score}-${match.away_score}`,
                newScore: `${homeScore}-${awayScore}`
            });

            // Accumulate team stats
            const homeTeamId = match.home_team_id;
            const awayTeamId = match.away_team_id;

            if (!teamStats[homeTeamId]) {
                teamStats[homeTeamId] = { wins: 0, losses: 0, ties: 0, sets_won: 0, sets_lost: 0 };
            }
            if (!teamStats[awayTeamId]) {
                teamStats[awayTeamId] = { wins: 0, losses: 0, ties: 0, sets_won: 0, sets_lost: 0 };
            }

            teamStats[homeTeamId].sets_won += homeScore;
            teamStats[homeTeamId].sets_lost += awayScore;
            teamStats[awayTeamId].sets_won += awayScore;
            teamStats[awayTeamId].sets_lost += homeScore;

            if (homeScore > awayScore) {
                teamStats[homeTeamId].wins++;
                teamStats[awayTeamId].losses++;
            } else if (awayScore > homeScore) {
                teamStats[awayTeamId].wins++;
                teamStats[homeTeamId].losses++;
            } else {
                teamStats[homeTeamId].ties++;
                teamStats[awayTeamId].ties++;
            }
        }

        // Update team standings
        const teamsRef = db.collection('leagues').doc(leagueId).collection('teams');
        for (const [teamId, stats] of Object.entries(teamStats)) {
            if (teamId) {
                await teamsRef.doc(teamId).update({
                    wins: stats.wins,
                    losses: stats.losses,
                    ties: stats.ties,
                    sets_won: stats.sets_won,
                    sets_lost: stats.sets_lost,
                    games_won: stats.sets_won,  // Alias for compatibility
                    games_lost: stats.sets_lost
                });
            }
        }

        res.json({ success: true, results, teamStats });

    } catch (error) {
        console.error('Update to set scores error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update player stats from imported match data
 * Processes all games and legs from an imported match
 */
exports.updateImportedMatchStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { leagueId, matchId, playerMapping } = req.body;

        if (!leagueId || !matchId) {
            res.status(400).json({ error: 'Missing leagueId or matchId' });
            return;
        }

        // Fetch the match
        const matchRef = db.collection('leagues').doc(leagueId).collection('matches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const match = matchDoc.data();
        const games = match.games || [];

        // Player mapping from names to IDs
        const PLAYER_IDS = playerMapping || {
            'Matt Pagel': 'G1lL2V3f3aQLQfBTfXkDXqUHZJo1',
            'Joe Peters': 'JqWH5tOwcbS4iIXuwb2lnVpkH7B2',
            'John Linden': 'I3VUoEyqhPhJRSCcowq3CHTJrxI2',
            'Donnie Pagel': 'Tq35P9nPiXgLJgRwfOOqJRJvEqJ3',
            'Christian Ketchem': '89RkfFLOhvUwV83ZS5J4',
            'Jenn M': 'tYMrfHzKRfWgGwujFiQOK3jx0n33',
            'Jennifer Malek': 'tYMrfHzKRfWgGwujFiQOK3jx0n33'
        };

        const statsUpdates = {};
        const results = [];

        for (const game of games) {
            const homePlayerNames = (game.home_players || []).map(p => typeof p === 'string' ? p : p.name);
            const awayPlayerNames = (game.away_players || []).map(p => typeof p === 'string' ? p : p.name);

            for (const leg of (game.legs || [])) {
                const playerStats = leg.player_stats || {};
                const format = leg.format;
                const isX01 = format === '501' || format === '301' || format === '701';

                for (const [playerName, stats] of Object.entries(playerStats)) {
                    const playerId = PLAYER_IDS[playerName];
                    if (!playerId) continue;

                    if (!statsUpdates[playerId]) {
                        statsUpdates[playerId] = {
                            player_id: playerId,
                            player_name: playerName,
                            x01_legs_played: 0,
                            x01_legs_won: 0,
                            x01_total_darts: 0,
                            x01_total_points: 0,
                            x01_high_checkout: 0,
                            cricket_legs_played: 0,
                            cricket_legs_won: 0,
                            cricket_total_marks: 0,
                            cricket_total_darts: 0,
                            games_played: 0,
                            games_won: 0
                        };
                    }

                    const ps = statsUpdates[playerId];
                    const isHome = homePlayerNames.includes(playerName);
                    const isWinner = (leg.winner === 'home' && isHome) || (leg.winner === 'away' && !isHome);

                    if (isX01) {
                        ps.x01_legs_played++;
                        ps.x01_total_darts += stats.darts || 0;
                        ps.x01_total_points += stats.points || 0;

                        if (isWinner) {
                            ps.x01_legs_won++;
                            if (stats.checkout && stats.checkout > ps.x01_high_checkout) {
                                ps.x01_high_checkout = stats.checkout;
                            }
                        }
                    } else {
                        // Cricket
                        ps.cricket_legs_played++;
                        ps.cricket_total_marks += stats.marks || 0;
                        ps.cricket_total_darts += stats.darts || 0;

                        if (isWinner) {
                            ps.cricket_legs_won++;
                        }
                    }
                }
            }

            // Update games played/won
            const gameWinner = game.winner;
            for (const playerName of homePlayerNames) {
                const playerId = PLAYER_IDS[playerName];
                if (playerId && statsUpdates[playerId]) {
                    statsUpdates[playerId].games_played++;
                    if (gameWinner === 'home') {
                        statsUpdates[playerId].games_won++;
                    }
                }
            }
            for (const playerName of awayPlayerNames) {
                const playerId = PLAYER_IDS[playerName];
                if (playerId && statsUpdates[playerId]) {
                    statsUpdates[playerId].games_played++;
                    if (gameWinner === 'away') {
                        statsUpdates[playerId].games_won++;
                    }
                }
            }
        }

        // Write stats to Firestore
        const statsRef = db.collection('leagues').doc(leagueId).collection('stats');

        for (const [playerId, stats] of Object.entries(statsUpdates)) {
            const existingDoc = await statsRef.doc(playerId).get();

            // Calculate averages
            if (stats.x01_total_darts > 0) {
                stats.x01_three_dart_avg = parseFloat(((stats.x01_total_points / stats.x01_total_darts) * 3).toFixed(2));
            }
            if (stats.cricket_total_darts > 0) {
                stats.cricket_mpr = parseFloat(((stats.cricket_total_marks / stats.cricket_total_darts) * 3).toFixed(2));
            }

            if (existingDoc.exists) {
                // Merge with existing
                const existing = existingDoc.data();
                const merged = {
                    x01_legs_played: (existing.x01_legs_played || 0) + stats.x01_legs_played,
                    x01_legs_won: (existing.x01_legs_won || 0) + stats.x01_legs_won,
                    x01_total_darts: (existing.x01_total_darts || 0) + stats.x01_total_darts,
                    x01_total_points: (existing.x01_total_points || 0) + stats.x01_total_points,
                    x01_high_checkout: Math.max(existing.x01_high_checkout || 0, stats.x01_high_checkout),
                    cricket_legs_played: (existing.cricket_legs_played || 0) + stats.cricket_legs_played,
                    cricket_legs_won: (existing.cricket_legs_won || 0) + stats.cricket_legs_won,
                    cricket_total_marks: (existing.cricket_total_marks || 0) + stats.cricket_total_marks,
                    cricket_total_darts: (existing.cricket_total_darts || 0) + stats.cricket_total_darts,
                    games_played: (existing.games_played || 0) + stats.games_played,
                    games_won: (existing.games_won || 0) + stats.games_won,
                    matches_played: (existing.matches_played || 0) + 1,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                };

                // Recalculate averages
                if (merged.x01_total_darts > 0) {
                    merged.x01_three_dart_avg = parseFloat(((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2));
                }
                if (merged.cricket_total_darts > 0) {
                    merged.cricket_mpr = parseFloat(((merged.cricket_total_marks / merged.cricket_total_darts) * 3).toFixed(2));
                }

                await statsRef.doc(playerId).update(merged);
            } else {
                // Create new
                stats.matches_played = 1;
                stats.created_at = admin.firestore.FieldValue.serverTimestamp();
                stats.updated_at = admin.firestore.FieldValue.serverTimestamp();
                await statsRef.doc(playerId).set(stats);
            }

            results.push({
                playerId,
                playerName: stats.player_name,
                x01Avg: stats.x01_three_dart_avg,
                cricketMpr: stats.cricket_mpr
            });
        }

        res.json({
            success: true,
            matchId,
            playersUpdated: results.length,
            stats: results
        });

    } catch (error) {
        console.error('Update imported match stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Set player stats directly from DartConnect performance report totals
 * This bypasses leg-by-leg parsing and uses the exact totals from DC
 *
 * Supports all DartConnect stat fields:
 * - X01: 3DA, first9, avgFinish, highTurn, highCheckout, tons (100+, 140+, 180), checkout stats
 * - Cricket: MPR, marks, 5M+ turns, bulls, triples, hatTricks
 * - Record: legs, matches, wins, with/against darts
 */
exports.setPlayerStatsFromPerformance = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { leagueId, playerStats, resetExisting } = req.body;

        if (!leagueId || !playerStats || !Array.isArray(playerStats)) {
            res.status(400).json({ error: 'Missing leagueId or playerStats array' });
            return;
        }

        const statsRef = db.collection('leagues').doc(leagueId).collection('stats');
        const results = [];

        for (const ps of playerStats) {
            if (!ps.playerId) continue;

            // Calculate averages from raw totals
            const x01_three_dart_avg = ps.x01_darts > 0
                ? parseFloat(((ps.x01_points / ps.x01_darts) * 3).toFixed(2))
                : 0;
            const cricket_mpr = ps.cricket_darts > 0
                ? parseFloat(((ps.cricket_marks / ps.cricket_darts) * 3).toFixed(2))
                : 0;

            // Calculate checkout percentage
            const checkout_pct = ps.checkout_opportunities > 0
                ? parseFloat(((ps.checkout_darts || 0) / ps.checkout_opportunities * 100).toFixed(1))
                : 0;

            // Calculate leg win percentage
            const x01_leg_win_pct = ps.x01_legs_played > 0
                ? parseFloat(((ps.x01_legs_won || 0) / ps.x01_legs_played * 100).toFixed(1))
                : 0;
            const cricket_leg_win_pct = ps.cricket_legs_played > 0
                ? parseFloat(((ps.cricket_legs_won || 0) / ps.cricket_legs_played * 100).toFixed(1))
                : 0;

            const statsData = {
                player_id: ps.playerId,
                player_name: ps.playerName,

                // X01 Core Stats
                x01_legs_played: ps.x01_legs_played || 0,
                x01_legs_won: ps.x01_legs_won || 0,
                x01_leg_win_pct,
                x01_total_darts: ps.x01_darts || 0,
                x01_total_points: ps.x01_points || 0,
                x01_three_dart_avg,

                // X01 Performance Stats
                x01_first_9_avg: ps.first_9_avg || 0,
                x01_avg_checkout: ps.avg_finish || 0,
                x01_high_turn: ps.high_turn || 0,
                x01_high_checkout: ps.high_checkout || 0,
                x01_low_dart_game: ps.low_dart_game || 0,
                x01_best_match_avg: ps.best_match_avg || 0,

                // X01 Ton Counts
                x01_tons_100: ps.tons_100 || 0,
                x01_tons_140: ps.tons_140 || 0,
                x01_tons_180: ps.tons_180 || 0,
                x01_ton_points: ps.ton_points || 0,

                // X01 Checkout Stats
                x01_checkout_darts: ps.checkout_darts || 0,
                x01_checkout_opportunities: ps.checkout_opportunities || 0,
                x01_checkout_pct: checkout_pct,

                // X01 With/Against Darts
                x01_legs_with_darts: ps.legs_with_darts || 0,
                x01_legs_with_darts_won: ps.legs_with_darts_won || 0,
                x01_legs_against_darts: ps.legs_against_darts || 0,
                x01_legs_against_darts_won: ps.legs_against_darts_won || 0,

                // Cricket Core Stats
                cricket_legs_played: ps.cricket_legs_played || 0,
                cricket_legs_won: ps.cricket_legs_won || 0,
                cricket_leg_win_pct,
                cricket_total_marks: ps.cricket_marks || 0,
                cricket_total_darts: ps.cricket_darts || 0,
                cricket_mpr,

                // Cricket Performance Stats
                cricket_high_turn: ps.cricket_high_turn || 0,
                cricket_5m_plus_turns: ps.cricket_5m_plus || 0,
                cricket_bulls: ps.cricket_bulls || 0,
                cricket_triples: ps.cricket_triples || 0,
                cricket_double_bulls: ps.cricket_double_bulls || 0,
                cricket_hat_tricks: ps.cricket_hat_tricks || 0,

                // Overall Record
                games_played: ps.games_played || 0,
                games_won: ps.games_won || 0,
                matches_played: ps.matches_played || 1,
                matches_won: ps.matches_won || 0,

                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            if (resetExisting) {
                // Overwrite existing stats
                statsData.created_at = admin.firestore.FieldValue.serverTimestamp();
                await statsRef.doc(ps.playerId).set(statsData);
            } else {
                // Merge with existing
                const existingDoc = await statsRef.doc(ps.playerId).get();
                if (existingDoc.exists) {
                    const existing = existingDoc.data();
                    const merged = {
                        player_id: ps.playerId,
                        player_name: ps.playerName,

                        // X01 Core - Additive
                        x01_legs_played: (existing.x01_legs_played || 0) + statsData.x01_legs_played,
                        x01_legs_won: (existing.x01_legs_won || 0) + statsData.x01_legs_won,
                        x01_total_darts: (existing.x01_total_darts || 0) + statsData.x01_total_darts,
                        x01_total_points: (existing.x01_total_points || 0) + statsData.x01_total_points,

                        // X01 Performance - Max values
                        x01_high_turn: Math.max(existing.x01_high_turn || 0, statsData.x01_high_turn),
                        x01_high_checkout: Math.max(existing.x01_high_checkout || 0, statsData.x01_high_checkout),
                        x01_best_match_avg: Math.max(existing.x01_best_match_avg || 0, statsData.x01_best_match_avg),

                        // X01 Performance - Min values (only if > 0)
                        x01_low_dart_game: statsData.x01_low_dart_game > 0
                            ? (existing.x01_low_dart_game > 0
                                ? Math.min(existing.x01_low_dart_game, statsData.x01_low_dart_game)
                                : statsData.x01_low_dart_game)
                            : (existing.x01_low_dart_game || 0),

                        // X01 Tons - Additive
                        x01_tons_100: (existing.x01_tons_100 || 0) + statsData.x01_tons_100,
                        x01_tons_140: (existing.x01_tons_140 || 0) + statsData.x01_tons_140,
                        x01_tons_180: (existing.x01_tons_180 || 0) + statsData.x01_tons_180,
                        x01_ton_points: (existing.x01_ton_points || 0) + statsData.x01_ton_points,

                        // X01 Checkout - Additive
                        x01_checkout_darts: (existing.x01_checkout_darts || 0) + statsData.x01_checkout_darts,
                        x01_checkout_opportunities: (existing.x01_checkout_opportunities || 0) + statsData.x01_checkout_opportunities,

                        // X01 With/Against - Additive
                        x01_legs_with_darts: (existing.x01_legs_with_darts || 0) + statsData.x01_legs_with_darts,
                        x01_legs_with_darts_won: (existing.x01_legs_with_darts_won || 0) + statsData.x01_legs_with_darts_won,
                        x01_legs_against_darts: (existing.x01_legs_against_darts || 0) + statsData.x01_legs_against_darts,
                        x01_legs_against_darts_won: (existing.x01_legs_against_darts_won || 0) + statsData.x01_legs_against_darts_won,

                        // Cricket Core - Additive
                        cricket_legs_played: (existing.cricket_legs_played || 0) + statsData.cricket_legs_played,
                        cricket_legs_won: (existing.cricket_legs_won || 0) + statsData.cricket_legs_won,
                        cricket_total_marks: (existing.cricket_total_marks || 0) + statsData.cricket_total_marks,
                        cricket_total_darts: (existing.cricket_total_darts || 0) + statsData.cricket_total_darts,

                        // Cricket Performance - Max/Additive
                        cricket_high_turn: Math.max(existing.cricket_high_turn || 0, statsData.cricket_high_turn),
                        cricket_5m_plus_turns: (existing.cricket_5m_plus_turns || 0) + statsData.cricket_5m_plus_turns,
                        cricket_bulls: (existing.cricket_bulls || 0) + statsData.cricket_bulls,
                        cricket_triples: (existing.cricket_triples || 0) + statsData.cricket_triples,
                        cricket_double_bulls: (existing.cricket_double_bulls || 0) + statsData.cricket_double_bulls,
                        cricket_hat_tricks: (existing.cricket_hat_tricks || 0) + statsData.cricket_hat_tricks,

                        // Overall Record - Additive
                        games_played: (existing.games_played || 0) + statsData.games_played,
                        games_won: (existing.games_won || 0) + statsData.games_won,
                        matches_played: (existing.matches_played || 0) + 1,
                        matches_won: (existing.matches_won || 0) + (statsData.matches_won || 0),

                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    };

                    // Recalculate averages from merged totals
                    merged.x01_three_dart_avg = merged.x01_total_darts > 0
                        ? parseFloat(((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2))
                        : 0;
                    merged.cricket_mpr = merged.cricket_total_darts > 0
                        ? parseFloat(((merged.cricket_total_marks / merged.cricket_total_darts) * 3).toFixed(2))
                        : 0;
                    merged.x01_checkout_pct = merged.x01_checkout_opportunities > 0
                        ? parseFloat((merged.x01_checkout_darts / merged.x01_checkout_opportunities * 100).toFixed(1))
                        : 0;
                    merged.x01_leg_win_pct = merged.x01_legs_played > 0
                        ? parseFloat((merged.x01_legs_won / merged.x01_legs_played * 100).toFixed(1))
                        : 0;
                    merged.cricket_leg_win_pct = merged.cricket_legs_played > 0
                        ? parseFloat((merged.cricket_legs_won / merged.cricket_legs_played * 100).toFixed(1))
                        : 0;

                    // Calculate weighted first 9 average (approximate - use latest if both have values)
                    if (statsData.x01_first_9_avg > 0) {
                        merged.x01_first_9_avg = existing.x01_first_9_avg > 0
                            ? parseFloat((((existing.x01_first_9_avg * existing.x01_legs_played) +
                                (statsData.x01_first_9_avg * statsData.x01_legs_played)) /
                                merged.x01_legs_played).toFixed(2))
                            : statsData.x01_first_9_avg;
                    } else {
                        merged.x01_first_9_avg = existing.x01_first_9_avg || 0;
                    }

                    // Calculate weighted avg checkout
                    if (statsData.x01_avg_checkout > 0) {
                        merged.x01_avg_checkout = existing.x01_avg_checkout > 0
                            ? parseFloat((((existing.x01_avg_checkout * (existing.x01_checkout_darts || 1)) +
                                (statsData.x01_avg_checkout * (statsData.x01_checkout_darts || 1))) /
                                (merged.x01_checkout_darts || 1)).toFixed(2))
                            : statsData.x01_avg_checkout;
                    } else {
                        merged.x01_avg_checkout = existing.x01_avg_checkout || 0;
                    }

                    await statsRef.doc(ps.playerId).update(merged);
                } else {
                    statsData.created_at = admin.firestore.FieldValue.serverTimestamp();
                    await statsRef.doc(ps.playerId).set(statsData);
                }
            }

            results.push({
                playerId: ps.playerId,
                playerName: ps.playerName,
                x01Avg: x01_three_dart_avg,
                cricketMpr: cricket_mpr
            });
        }

        res.json({
            success: true,
            playersUpdated: results.length,
            stats: results
        });

    } catch (error) {
        console.error('Set player stats error:', error);
        res.status(500).json({ error: error.message });
    }
});
