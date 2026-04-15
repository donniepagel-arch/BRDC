/**
 * Legacy/admin-only import-match handlers.
 *
 * These are intentionally kept out of the canonical root import surface.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

exports.createGlobalPlayersFromRosters = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

        const leaguePlayersSnapshot = await db.collection('leagues').doc(leagueId).collection('players').get();
        for (const playerDoc of leaguePlayersSnapshot.docs) {
            const rosterPlayer = playerDoc.data();
            const rosterPlayerId = playerDoc.id;
            const email = (rosterPlayer.email || '').toLowerCase().trim();
            const name = (rosterPlayer.name || '').toLowerCase().trim();
            const existingPlayer = existingByEmail[email] || existingByName[name];

            if (existingPlayer) {
                results.existingPlayers.push({
                    name: rosterPlayer.name,
                    globalId: existingPlayer.id,
                    leaguePlayerId: rosterPlayerId,
                    needsUpdate: existingPlayer.id !== rosterPlayerId
                });

                if (existingPlayer.id !== rosterPlayerId) {
                    results.leaguePlayersUpdated.push({
                        name: rosterPlayer.name,
                        oldId: rosterPlayerId,
                        newId: existingPlayer.id
                    });
                }
            } else {
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

exports.consolidatePlayerIds = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

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
        'christian ketchem': 'christian ketchum',
        'christian ketchum': 'christian ketchum'
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

        const playersSnapshot = await db.collection('players').get();
        const globalPlayers = {};
        playersSnapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || data.full_name || '').toLowerCase().trim();
            const email = (data.email || '').toLowerCase().trim();
            if (name) globalPlayers[name] = { id: doc.id, name: data.name || data.full_name, email: data.email };
            if (email) globalPlayers[`email:${email}`] = { id: doc.id, name: data.name || data.full_name, email: data.email };
        });

        const findGlobalPlayer = (playerName) => {
            const normalizedName = playerName.toLowerCase().trim();
            if (globalPlayers[normalizedName]) return globalPlayers[normalizedName];
            const aliasedName = NAME_ALIASES[normalizedName];
            if (aliasedName && globalPlayers[aliasedName]) return globalPlayers[aliasedName];
            return null;
        };

        results.playersFound = Object.values(globalPlayers).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        const teamsSnapshot = await db.collection('leagues').doc(leagueId).collection('teams').get();
        for (const teamDoc of teamsSnapshot.docs) {
            const team = teamDoc.data();
            const players = team.players || [];
            const updatedPlayers = [];
            let teamNeedsUpdate = false;

            for (const player of players) {
                const playerEmail = (player.email || '').toLowerCase().trim();
                const globalPlayer = findGlobalPlayer(player.name) || globalPlayers[`email:${playerEmail}`];

                if (globalPlayer && globalPlayer.id !== player.id) {
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

            if (teamNeedsUpdate && !dryRun) {
                await db.collection('leagues').doc(leagueId).collection('teams').doc(teamDoc.id).update({ players: updatedPlayers });
            }
        }

        const statsSnapshot = await db.collection('leagues').doc(leagueId).collection('stats').get();
        for (const statDoc of statsSnapshot.docs) {
            const stats = statDoc.data();
            const statPlayerId = statDoc.id;
            const globalPlayer = findGlobalPlayer(stats.player_name);

            if (globalPlayer && globalPlayer.id !== statPlayerId) {
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
                    const existingStats = await db.collection('leagues').doc(leagueId).collection('stats').doc(globalPlayer.id).get();
                    if (existingStats.exists) {
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

                        if (merged.x01_total_darts > 0) {
                            merged.x01_three_dart_avg = parseFloat(((merged.x01_total_points / merged.x01_total_darts) * 3).toFixed(2));
                        }
                        if (merged.cricket_total_darts > 0) {
                            merged.cricket_mpr = parseFloat(((merged.cricket_total_marks / merged.cricket_total_darts) * 3).toFixed(2));
                        }

                        await db.collection('leagues').doc(leagueId).collection('stats').doc(globalPlayer.id).update(merged);
                    } else {
                        await db.collection('leagues').doc(leagueId).collection('stats').doc(globalPlayer.id).set({
                            ...stats,
                            player_id: globalPlayer.id,
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    await db.collection('leagues').doc(leagueId).collection('stats').doc(statPlayerId).delete();
                }
            } else if (!globalPlayer) {
                results.errors.push({
                    type: 'no_global_player',
                    playerName: stats.player_name,
                    statId: statPlayerId
                });
            }
        }

        res.json({ success: true, dryRun, results });
    } catch (error) {
        console.error('Error consolidating player IDs:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.migrateLeagueToGlobalIds = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

        const leaguePlayersSnapshot = await db.collection('leagues').doc(leagueId).collection('players').get();
        const idMigrationMap = {};

        for (const playerDoc of leaguePlayersSnapshot.docs) {
            const playerData = playerDoc.data();
            const oldId = playerDoc.id;
            const name = (playerData.name || '').toLowerCase().trim();
            const email = (playerData.email || '').toLowerCase().trim();
            const globalPlayer = globalByEmail[email] || globalByName[name];

            if (globalPlayer && globalPlayer.id !== oldId) {
                idMigrationMap[oldId] = globalPlayer.id;
                results.leaguePlayersUpdated.push({
                    name: playerData.name,
                    oldId,
                    newId: globalPlayer.id
                });

                if (!dryRun) {
                    const newPlayerData = {
                        ...playerData,
                        id: globalPlayer.id,
                        _migratedFrom: oldId,
                        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    await db.collection('leagues').doc(leagueId).collection('players').doc(globalPlayer.id).set(newPlayerData);
                    await db.collection('leagues').doc(leagueId).collection('players').doc(oldId).delete();
                    results.leaguePlayersDeleted.push({
                        name: playerData.name,
                        id: oldId
                    });
                }
            } else if (!globalPlayer) {
                results.errors.push({
                    type: 'no_global_player',
                    name: playerData.name,
                    leaguePlayerId: oldId
                });
            }
        }

        const teamsSnapshot = await db.collection('leagues').doc(leagueId).collection('teams').get();
        for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const players = teamData.players || [];
            let needsUpdate = false;
            const updatedPlayers = [];

            for (const player of players) {
                const oldId = player.id;
                const newId = idMigrationMap[oldId];

                if (newId) {
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
                    await db.collection('leagues').doc(leagueId).collection('teams').doc(teamDoc.id).update({ players: updatedPlayers });
                }
            }
        }

        const statsSnapshot = await db.collection('leagues').doc(leagueId).collection('stats').get();
        for (const statDoc of statsSnapshot.docs) {
            const oldId = statDoc.id;
            const newId = idMigrationMap[oldId];

            if (newId) {
                results.statsUpdated = results.statsUpdated || [];
                results.statsUpdated.push({
                    playerName: statDoc.data().player_name,
                    oldId,
                    newId
                });

                if (!dryRun) {
                    const statData = statDoc.data();
                    statData.player_id = newId;
                    statData._migratedFrom = oldId;

                    await db.collection('leagues').doc(leagueId).collection('stats').doc(newId).set(statData);
                    await db.collection('leagues').doc(leagueId).collection('stats').doc(oldId).delete();
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

exports.lookupPlayersByEmail = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
            const playersSnapshot = await db.collection('players').where('email', '==', normalizedEmail).limit(1).get();

            if (!playersSnapshot.empty) {
                const playerDoc = playersSnapshot.docs[0];
                const playerData = playerDoc.data();
                mapping[email] = {
                    id: playerDoc.id,
                    name: playerData.name || playerData.full_name || 'Unknown'
                };
            } else {
                const altSnapshot = await db.collection('players').where('email', '==', email).limit(1).get();
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

exports.fixMatchScores = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
            const fixedGames = games.map(game => {
                const fixedLegs = (game.legs || []).map(leg => {
                    const fixedLeg = {
                        ...leg,
                        winner: leg.winner === 'home' ? 'away' : leg.winner === 'away' ? 'home' : leg.winner
                    };

                    if (leg.home_stats || leg.away_stats) {
                        fixedLeg.home_stats = leg.away_stats || null;
                        fixedLeg.away_stats = leg.home_stats || null;
                    }

                    if (leg.throws && Array.isArray(leg.throws)) {
                        fixedLeg.throws = leg.throws.map(t => ({
                            ...t,
                            home: t.away || null,
                            away: t.home || null
                        }));
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
                winner: homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie',
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

exports.updateToSetScores = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, overrides } = req.body;
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
            let homeScore;
            let awayScore;

            if (overrides && overrides[matchId]) {
                homeScore = overrides[matchId].homeScore;
                awayScore = overrides[matchId].awayScore;
            } else {
                homeScore = 0;
                awayScore = 0;
                (match.games || []).forEach(g => {
                    if (g.winner === 'home') homeScore++;
                    else if (g.winner === 'away') awayScore++;
                });
            }

            await matchesRef.doc(matchId).update({
                home_score: homeScore,
                away_score: awayScore,
                winner: homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'tie',
                score_type: 'sets'
            });

            results.push({
                matchId,
                homeTeam: match.home_team_name,
                awayTeam: match.away_team_name,
                oldScore: `${match.home_score}-${match.away_score}`,
                newScore: `${homeScore}-${awayScore}`
            });

            const homeTeamId = match.home_team_id;
            const awayTeamId = match.away_team_id;

            if (!teamStats[homeTeamId]) teamStats[homeTeamId] = { wins: 0, losses: 0, ties: 0, sets_won: 0, sets_lost: 0 };
            if (!teamStats[awayTeamId]) teamStats[awayTeamId] = { wins: 0, losses: 0, ties: 0, sets_won: 0, sets_lost: 0 };

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

        const teamsRef = db.collection('leagues').doc(leagueId).collection('teams');
        for (const [teamId, stats] of Object.entries(teamStats)) {
            if (!teamId) continue;
            await teamsRef.doc(teamId).update({
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                sets_won: stats.sets_won,
                sets_lost: stats.sets_lost,
                games_won: stats.sets_won,
                games_lost: stats.sets_lost
            });
        }

        res.json({ success: true, results, teamStats });
    } catch (error) {
        console.error('Update to set scores error:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.debugMatchData = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, week, matchId } = req.query;
        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const result = { matches: [] };
        let query = db.collection('leagues').doc(leagueId).collection('matches');
        if (week) query = query.where('week', '==', parseInt(week));

        const matchesSnap = await query.get();
        matchesSnap.forEach(doc => {
            if (matchId && doc.id !== matchId) return;
            const data = doc.data();
            const playerNames = new Set();
            if (data.games && Array.isArray(data.games)) {
                data.games.forEach(game => {
                    (game.home_players || []).forEach(n => playerNames.add(n));
                    (game.away_players || []).forEach(n => playerNames.add(n));
                });
            }
            result.matches.push({
                id: doc.id,
                week: data.week,
                home_team_id: data.home_team_id,
                home_team_name: data.home_team_name,
                away_team_id: data.away_team_id,
                away_team_name: data.away_team_name,
                status: data.status,
                playerNamesFromGames: Array.from(playerNames),
                gamesCount: (data.games || []).length
            });
        });

        res.json(result);
    } catch (error) {
        console.error('Debug match data error:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.debugPlayerStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, playerName } = req.query;
        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const result = { leagueId, searchName: playerName || 'all', players: [], aggregatedStats: [], statsCollection: [] };

        const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').get();
        playersSnap.forEach(doc => {
            const data = doc.data();
            const name = data.name || data.player_name || '';
            if (!playerName || name.toLowerCase().includes(playerName.toLowerCase())) {
                result.players.push({
                    id: doc.id,
                    name,
                    team_id: data.team_id,
                    email: data.email,
                    embeddedStats: {
                        x01_three_dart_avg: data.x01_three_dart_avg,
                        cricket_mpr: data.cricket_mpr,
                        ppd: data.ppd,
                        mpr: data.mpr
                    }
                });
            }
        });

        const aggSnap = await db.collection('leagues').doc(leagueId).collection('aggregated_stats').get();
        aggSnap.forEach(doc => {
            const data = doc.data();
            const name = data.player_name || '';
            if (!playerName || name.toLowerCase().includes(playerName.toLowerCase())) {
                result.aggregatedStats.push({
                    id: doc.id,
                    player_name: name,
                    x01_three_dart_avg: data.x01_three_dart_avg,
                    cricket_mpr: data.cricket_mpr,
                    x01_legs_played: data.x01_legs_played,
                    cricket_legs_played: data.cricket_legs_played
                });
            }
        });

        const statsSnap = await db.collection('leagues').doc(leagueId).collection('stats').get();
        statsSnap.forEach(doc => {
            const data = doc.data();
            const name = data.player_name || '';
            if (!playerName || name.toLowerCase().includes(playerName.toLowerCase())) {
                result.statsCollection.push({
                    id: doc.id,
                    player_name: name,
                    x01_three_dart_avg: data.x01_three_dart_avg,
                    cricket_mpr: data.cricket_mpr
                });
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Debug player stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.syncPlayerNames = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId, dryRun = true } = req.body;
        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const results = { checked: 0, updated: [], skipped: [], noStats: [] };
        const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').get();

        for (const playerDoc of playersSnap.docs) {
            const playerId = playerDoc.id;
            const playerData = playerDoc.data();
            const officialName = playerData.name;
            results.checked++;

            const statsDoc = await db.collection('leagues').doc(leagueId).collection('stats').doc(playerId).get();
            if (!statsDoc.exists) {
                results.noStats.push({ id: playerId, name: officialName });
                continue;
            }

            const statsData = statsDoc.data();
            if (statsData.player_name === officialName) {
                results.skipped.push({ id: playerId, name: officialName });
                continue;
            }

            if (!dryRun) {
                await db.collection('leagues').doc(leagueId).collection('stats').doc(playerId).update({ player_name: officialName });
            }

            results.updated.push({
                id: playerId,
                oldName: statsData.player_name,
                newName: officialName
            });
        }

        res.json({ success: true, dryRun, results });
    } catch (error) {
        console.error('Sync player names error:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.clearLeagueStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }

    try {
        const { leagueId } = req.body;
        if (!leagueId) {
            res.status(400).json({ error: 'Missing leagueId' });
            return;
        }

        const statsRef = db.collection('leagues').doc(leagueId).collection('stats');
        const snap = await statsRef.get();
        const count = snap.size;
        if (count === 0) {
            res.json({ success: true, deleted: 0 });
            return;
        }

        const batches = [];
        let batch = db.batch();
        let batchCount = 0;

        snap.forEach(doc => {
            batch.delete(doc.ref);
            batchCount++;
            if (batchCount === 500) {
                batches.push(batch);
                batch = db.batch();
                batchCount = 0;
            }
        });

        if (batchCount > 0) batches.push(batch);
        for (const b of batches) {
            await b.commit();
        }

        res.json({ success: true, deleted: count });
    } catch (error) {
        console.error('Clear league stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

exports.setPlayerStatsFromPerformance = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

            const x01_three_dart_avg = ps.x01_darts > 0
                ? parseFloat(((ps.x01_points / ps.x01_darts) * 3).toFixed(2))
                : 0;
            const cricket_mpr = ps.cricket_darts > 0
                ? parseFloat(((ps.cricket_marks / ps.cricket_darts) * 3).toFixed(2))
                : 0;
            const checkout_pct = ps.checkout_opportunities > 0
                ? parseFloat(((ps.checkout_darts || 0) / ps.checkout_opportunities * 100).toFixed(1))
                : 0;
            const x01_leg_win_pct = ps.x01_legs_played > 0
                ? parseFloat(((ps.x01_legs_won || 0) / ps.x01_legs_played * 100).toFixed(1))
                : 0;
            const cricket_leg_win_pct = ps.cricket_legs_played > 0
                ? parseFloat(((ps.cricket_legs_won || 0) / ps.cricket_legs_played * 100).toFixed(1))
                : 0;

            const statsData = {
                player_id: ps.playerId,
                player_name: ps.playerName,
                x01_legs_played: ps.x01_legs_played || 0,
                x01_legs_won: ps.x01_legs_won || 0,
                x01_leg_win_pct,
                x01_total_darts: ps.x01_darts || 0,
                x01_total_points: ps.x01_points || 0,
                x01_three_dart_avg,
                x01_first_9_avg: ps.first_9_avg || 0,
                x01_avg_checkout: ps.avg_finish || 0,
                x01_high_turn: ps.high_turn || 0,
                x01_high_checkout: ps.high_checkout || 0,
                x01_low_dart_game: ps.low_dart_game || 0,
                x01_best_match_avg: ps.best_match_avg || 0,
                x01_tons_100: ps.tons_100 || 0,
                x01_tons_140: ps.tons_140 || 0,
                x01_tons_180: ps.tons_180 || 0,
                x01_ton_points: ps.ton_points || 0,
                x01_checkout_darts: ps.checkout_darts || 0,
                x01_checkout_opportunities: ps.checkout_opportunities || 0,
                x01_checkout_pct: checkout_pct,
                x01_legs_with_darts: ps.legs_with_darts || 0,
                x01_legs_with_darts_won: ps.legs_with_darts_won || 0,
                x01_legs_against_darts: ps.legs_against_darts || 0,
                x01_legs_against_darts_won: ps.legs_against_darts_won || 0,
                cricket_legs_played: ps.cricket_legs_played || 0,
                cricket_legs_won: ps.cricket_legs_won || 0,
                cricket_leg_win_pct,
                cricket_total_marks: ps.cricket_marks || 0,
                cricket_total_darts: ps.cricket_darts || 0,
                cricket_mpr,
                cricket_high_turn: ps.cricket_high_turn || 0,
                cricket_5m_plus_turns: ps.cricket_5m_plus || 0,
                cricket_bulls: ps.cricket_bulls || 0,
                cricket_triples: ps.cricket_triples || 0,
                cricket_double_bulls: ps.cricket_double_bulls || 0,
                cricket_hat_tricks: ps.cricket_hat_tricks || 0,
                games_played: ps.games_played || 0,
                games_won: ps.games_won || 0,
                matches_played: ps.matches_played || 1,
                matches_won: ps.matches_won || 0,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            if (resetExisting) {
                statsData.created_at = admin.firestore.FieldValue.serverTimestamp();
                await statsRef.doc(ps.playerId).set(statsData);
            } else {
                const existingDoc = await statsRef.doc(ps.playerId).get();
                if (existingDoc.exists) {
                    const existing = existingDoc.data();
                    const merged = {
                        player_id: ps.playerId,
                        player_name: ps.playerName,
                        x01_legs_played: (existing.x01_legs_played || 0) + statsData.x01_legs_played,
                        x01_legs_won: (existing.x01_legs_won || 0) + statsData.x01_legs_won,
                        x01_total_darts: (existing.x01_total_darts || 0) + statsData.x01_total_darts,
                        x01_total_points: (existing.x01_total_points || 0) + statsData.x01_total_points,
                        x01_high_turn: Math.max(existing.x01_high_turn || 0, statsData.x01_high_turn),
                        x01_high_checkout: Math.max(existing.x01_high_checkout || 0, statsData.x01_high_checkout),
                        x01_best_match_avg: Math.max(existing.x01_best_match_avg || 0, statsData.x01_best_match_avg),
                        x01_low_dart_game: statsData.x01_low_dart_game > 0
                            ? (existing.x01_low_dart_game > 0
                                ? Math.min(existing.x01_low_dart_game, statsData.x01_low_dart_game)
                                : statsData.x01_low_dart_game)
                            : (existing.x01_low_dart_game || 0),
                        x01_tons_100: (existing.x01_tons_100 || 0) + statsData.x01_tons_100,
                        x01_tons_140: (existing.x01_tons_140 || 0) + statsData.x01_tons_140,
                        x01_tons_180: (existing.x01_tons_180 || 0) + statsData.x01_tons_180,
                        x01_ton_points: (existing.x01_ton_points || 0) + statsData.x01_ton_points,
                        x01_checkout_darts: (existing.x01_checkout_darts || 0) + statsData.x01_checkout_darts,
                        x01_checkout_opportunities: (existing.x01_checkout_opportunities || 0) + statsData.x01_checkout_opportunities,
                        x01_legs_with_darts: (existing.x01_legs_with_darts || 0) + statsData.x01_legs_with_darts,
                        x01_legs_with_darts_won: (existing.x01_legs_with_darts_won || 0) + statsData.x01_legs_with_darts_won,
                        x01_legs_against_darts: (existing.x01_legs_against_darts || 0) + statsData.x01_legs_against_darts,
                        x01_legs_against_darts_won: (existing.x01_legs_against_darts_won || 0) + statsData.x01_legs_against_darts_won,
                        cricket_legs_played: (existing.cricket_legs_played || 0) + statsData.cricket_legs_played,
                        cricket_legs_won: (existing.cricket_legs_won || 0) + statsData.cricket_legs_won,
                        cricket_total_marks: (existing.cricket_total_marks || 0) + statsData.cricket_total_marks,
                        cricket_total_darts: (existing.cricket_total_darts || 0) + statsData.cricket_total_darts,
                        cricket_high_turn: Math.max(existing.cricket_high_turn || 0, statsData.cricket_high_turn),
                        cricket_5m_plus_turns: (existing.cricket_5m_plus_turns || 0) + statsData.cricket_5m_plus_turns,
                        cricket_bulls: (existing.cricket_bulls || 0) + statsData.cricket_bulls,
                        cricket_triples: (existing.cricket_triples || 0) + statsData.cricket_triples,
                        cricket_double_bulls: (existing.cricket_double_bulls || 0) + statsData.cricket_double_bulls,
                        cricket_hat_tricks: (existing.cricket_hat_tricks || 0) + statsData.cricket_hat_tricks,
                        games_played: (existing.games_played || 0) + statsData.games_played,
                        games_won: (existing.games_won || 0) + statsData.games_won,
                        matches_played: (existing.matches_played || 0) + 1,
                        matches_won: (existing.matches_won || 0) + (statsData.matches_won || 0),
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    };

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

                    if (statsData.x01_first_9_avg > 0) {
                        merged.x01_first_9_avg = existing.x01_first_9_avg > 0
                            ? parseFloat((((existing.x01_first_9_avg * existing.x01_legs_played) +
                                (statsData.x01_first_9_avg * statsData.x01_legs_played)) /
                                merged.x01_legs_played).toFixed(2))
                            : statsData.x01_first_9_avg;
                    } else {
                        merged.x01_first_9_avg = existing.x01_first_9_avg || 0;
                    }

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
