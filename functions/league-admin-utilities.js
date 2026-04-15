const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const cors = require('cors')({
    origin: [
        'https://brdc-v2.web.app',
        'https://brdc-v2.firebaseapp.com',
        'https://burningriverdarts.com',
        'https://www.burningriverdarts.com'
    ]
});

const db = admin.firestore();

exports.submitLeagueMatchScore = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { leagueId, matchId, team1Score, team2Score } = req.body;

            const leagueRef = db.collection('leagues').doc(leagueId);
            const leagueDoc = await leagueRef.get();

            if (!leagueDoc.exists) {
                return res.status(404).json({ error: 'League not found' });
            }

            const league = leagueDoc.data();
            const match = league.schedule.find(m => m.id === matchId);

            if (!match) {
                return res.status(404).json({ error: 'Match not found' });
            }

            match.team1Score = team1Score;
            match.team2Score = team2Score;
            match.completed = true;
            match.completedAt = admin.firestore.Timestamp.now();

            const standings = league.standings || {};
            const team1 = match.team1;
            const team2 = match.team2;

            if (!standings[team1]) standings[team1] = { wins: 0, losses: 0, points: 0 };
            if (!standings[team2]) standings[team2] = { wins: 0, losses: 0, points: 0 };

            if (team1Score > team2Score) {
                standings[team1].wins++;
                standings[team1].points += 2;
                standings[team2].losses++;
            } else {
                standings[team2].wins++;
                standings[team2].points += 2;
                standings[team1].losses++;
            }

            await leagueRef.update({
                schedule: league.schedule,
                standings
            });

            res.json({
                success: true,
                message: 'Match score submitted and standings updated',
                standings
            });
        } catch (error) {
            console.error('Error submitting league match score:', error);
            res.status(500).json({ error: error.message });
        }
    });
});

exports.updateMatchDates = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, start_date } = req.body;

            if (!league_id) {
                return res.status(400).json({ success: false, error: 'Missing league_id' });
            }

            const leagueDoc = await db.collection('leagues').doc(league_id).get();
            if (!leagueDoc.exists) {
                return res.status(404).json({ success: false, error: 'League not found' });
            }

            const league = leagueDoc.data();
            const useStartDate = start_date || league.start_date;

            if (!useStartDate) {
                return res.status(400).json({ success: false, error: 'No start_date provided and league has no start_date set' });
            }

            const dateParts = useStartDate.split('-').map(Number);
            const newStartDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            if (isNaN(newStartDate.getTime())) {
                return res.status(400).json({ success: false, error: 'Invalid start_date format' });
            }

            const blackoutDates = new Set(league.blackout_dates || []);
            const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();

            if (matchesSnap.empty) {
                return res.json({ success: true, matches_updated: 0, message: 'No matches found' });
            }

            const matchesByWeek = new Map();
            matchesSnap.forEach(doc => {
                const match = doc.data();
                const week = match.week || 1;
                if (!matchesByWeek.has(week)) matchesByWeek.set(week, []);
                matchesByWeek.get(week).push({ ref: doc.ref, data: match });
            });

            const weeks = Array.from(matchesByWeek.keys()).sort((a, b) => a - b);
            const matchBatch = db.batch();
            let matchesUpdated = 0;
            const sampleDates = [];
            let skippedWeeks = 0;
            let currentDate = new Date(newStartDate);

            const formatLocalDate = d => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            for (const week of weeks) {
                let dateStr = formatLocalDate(currentDate);
                while (blackoutDates.has(dateStr)) {
                    skippedWeeks++;
                    currentDate.setDate(currentDate.getDate() + 7);
                    dateStr = formatLocalDate(currentDate);
                }

                const weekMatches = matchesByWeek.get(week);
                for (const { ref, data } of weekMatches) {
                    matchBatch.update(ref, { match_date: dateStr });
                    matchesUpdated++;
                    if (sampleDates.length < 10) {
                        sampleDates.push({ week, old_date: data.match_date, new_date: dateStr });
                    }
                }

                currentDate.setDate(currentDate.getDate() + 7);
            }

            await matchBatch.commit();

            res.json({
                success: true,
                matches_updated: matchesUpdated,
                start_date: useStartDate,
                blackout_dates: Array.from(blackoutDates),
                skipped_weeks: skippedWeeks,
                sample_dates: sampleDates
            });
        } catch (error) {
            console.error('Error updating match dates:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.updatePlayerTeam = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { league_id, player_id, team_id } = req.body;

            if (!league_id || !player_id || !team_id) {
                return res.status(400).json({ success: false, error: 'Missing league_id, player_id, or team_id' });
            }

            const leaguePlayerRef = db.collection('leagues').doc(league_id).collection('players').doc(player_id);
            const leaguePlayerDoc = await leaguePlayerRef.get();

            if (leaguePlayerDoc.exists) {
                await leaguePlayerRef.update({ team_id });
            }

            const globalPlayerRef = db.collection('players').doc(player_id);
            const globalPlayerDoc = await globalPlayerRef.get();

            if (globalPlayerDoc.exists) {
                const playerData = globalPlayerDoc.data();
                const updatePayload = {};

                if (playerData.league_id === league_id || !playerData.league_id) {
                    updatePayload.team_id = team_id;
                    updatePayload.league_id = league_id;
                }

                if (playerData.leagues) {
                    updatePayload.leagues = playerData.leagues.map(l =>
                        (l.league_id === league_id || l.id === league_id) ? { ...l, team_id } : l
                    );
                }

                if (playerData.involvements && playerData.involvements.leagues) {
                    updatePayload['involvements.leagues'] = playerData.involvements.leagues.map(l =>
                        (l.id === league_id || l.league_id === league_id) ? { ...l, team_id } : l
                    );
                }

                if (Object.keys(updatePayload).length > 0) {
                    await globalPlayerRef.update(updatePayload);
                }
            }

            res.json({ success: true, player_id, team_id });
        } catch (error) {
            console.error('Error updating player team:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

exports.markPlayersAsFillins = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, player_ids } = req.body;

        if (!league_id || !player_ids || !Array.isArray(player_ids)) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id and player_ids (array)'
            });
        }

        const updates = [];
        const batch = admin.firestore().batch();

        for (const playerId of player_ids) {
            const playerRef = admin.firestore().collection('leagues').doc(league_id).collection('players').doc(playerId);
            const playerDoc = await playerRef.get();
            if (playerDoc.exists) {
                batch.update(playerRef, {
                    is_sub: true,
                    team_id: null
                });
                updates.push({ id: playerId, name: playerDoc.data().name });
            }
        }

        await batch.commit();

        res.json({
            success: true,
            message: `Marked ${updates.length} players as fill-ins`,
            updated: updates
        });
    } catch (error) {
        console.error('Error marking players as fill-ins:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.addFillinsToMatchLineup = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, match_id, fillins } = req.body;

        if (!league_id || !match_id || !fillins || !Array.isArray(fillins)) {
            return res.status(400).json({
                success: false,
                error: 'Required: league_id, match_id, fillins (array with player_id, team, replacing_player_id, position)'
            });
        }

        const matchRef = admin.firestore().collection('leagues').doc(league_id).collection('matches').doc(match_id);
        const matchDoc = await matchRef.get();
        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, error: 'Match not found' });
        }

        const match = matchDoc.data();
        let homeLineup = match.home_lineup || [];
        let awayLineup = match.away_lineup || [];
        const addedToHome = [];
        const addedToAway = [];

        for (const fillin of fillins) {
            const playerRef = admin.firestore().collection('leagues').doc(league_id).collection('players').doc(fillin.player_id);
            const playerDoc = await playerRef.get();
            if (!playerDoc.exists) continue;

            const player = playerDoc.data();
            const lineupEntry = {
                player_id: fillin.player_id,
                player_name: player.name,
                is_sub: true,
                replacing_player_id: fillin.replacing_player_id || null,
                position: fillin.position || 'S'
            };

            if (fillin.team === 'home') {
                if (!homeLineup.some(p => p.player_id === fillin.player_id)) {
                    homeLineup.push(lineupEntry);
                    addedToHome.push({ name: player.name, replacing: fillin.replacing_player_id });
                }
            } else if (fillin.team === 'away') {
                if (!awayLineup.some(p => p.player_id === fillin.player_id)) {
                    awayLineup.push(lineupEntry);
                    addedToAway.push({ name: player.name, replacing: fillin.replacing_player_id });
                }
            }
        }

        await matchRef.update({
            home_lineup: homeLineup,
            away_lineup: awayLineup
        });

        res.json({
            success: true,
            message: `Added fill-ins to match ${match_id}`,
            homeLineup: addedToHome,
            awayLineup: addedToAway
        });
    } catch (error) {
        console.error('Error adding fill-ins to lineup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.listLeagueMatches = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
        const { league_id, week } = req.body;

        if (!league_id) {
            return res.status(400).json({ success: false, error: 'Required: league_id' });
        }

        let query = admin.firestore().collection('leagues').doc(league_id).collection('matches');
        if (week) {
            query = query.where('week', '==', week);
        }

        const matchesSnap = await query.get();
        const matches = [];

        matchesSnap.forEach(doc => {
            const data = doc.data();
            matches.push({
                id: doc.id,
                week: data.week,
                home_team_id: data.home_team_id,
                away_team_id: data.away_team_id,
                status: data.status,
                home_score: data.home_score,
                away_score: data.away_score,
                has_home_lineup: !!(data.home_lineup && data.home_lineup.length > 0),
                has_away_lineup: !!(data.away_lineup && data.away_lineup.length > 0)
            });
        });

        res.json({ success: true, matches });
    } catch (error) {
        console.error('Error listing matches:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

exports.getPlayerStatsFiltered = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        try {
            const { player_id, source } = req.method === 'POST' ? req.body : req.query;

            if (!player_id) {
                return res.status(400).json({ success: false, error: 'player_id required' });
            }

            const playerDoc = await db.collection('players').doc(player_id).get();
            if (!playerDoc.exists) {
                return res.status(404).json({ success: false, error: 'Player not found' });
            }

            const player = playerDoc.data();
            const involvements = player.involvements || {};
            const searchPin = player.pin;
            const searchName = player.name;

            const createEmptyStats = () => ({
                x01_total_points: 0,
                x01_total_darts: 0,
                x01_legs_played: 0,
                x01_legs_won: 0,
                x01_first9_points: 0,
                x01_first9_darts: 0,
                x01_best_leg: null,
                x01_high_score: null,
                x01_high_checkout: null,
                x01_checkout_opps: 0,
                x01_checkouts: 0,
                x01_checkout_totals: 0,
                x01_tons_100: 0,
                x01_tons_120: 0,
                x01_tons_140: 0,
                x01_tons_160: 0,
                x01_tons_180: 0,
                x01_one_seventy_ones: 0,
                x01_ton_plus_checkouts: 0,
                cricket_total_marks: 0,
                cricket_total_darts: 0,
                cricket_legs_played: 0,
                cricket_legs_won: 0,
                cricket_missed_darts: 0,
                cricket_triple_bull_darts: 0,
                cricket_five_mark_rounds: 0,
                cricket_seven_mark_rounds: 0,
                cricket_eight_mark_rounds: 0,
                cricket_nine_mark_rounds: 0,
                cricket_three_bulls: 0,
                cricket_hat_tricks: 0
            });

            const aggregateStats = (target, sourceStats) => {
                if (!sourceStats) return;
                target.x01_total_points += sourceStats.x01_total_points || 0;
                target.x01_total_darts += sourceStats.x01_total_darts || 0;
                target.x01_legs_played += sourceStats.x01_legs_played || 0;
                target.x01_legs_won += sourceStats.x01_legs_won || 0;
                target.x01_first9_points += sourceStats.x01_first9_points || 0;
                target.x01_first9_darts += sourceStats.x01_first9_darts || 0;
                target.x01_checkout_opps += sourceStats.x01_checkout_opps || sourceStats.x01_checkout_attempts || 0;
                target.x01_checkouts += sourceStats.x01_checkouts || sourceStats.x01_checkouts_hit || 0;
                target.x01_checkout_totals += sourceStats.x01_checkout_totals || 0;
                target.x01_tons_100 += sourceStats.x01_tons_100 || 0;
                target.x01_tons_120 += sourceStats.x01_tons_120 || 0;
                target.x01_tons_140 += sourceStats.x01_tons_140 || 0;
                target.x01_tons_160 += sourceStats.x01_tons_160 || 0;
                target.x01_tons_180 += sourceStats.x01_tons_180 || 0;
                target.x01_one_seventy_ones += sourceStats.x01_one_seventy_ones || 0;
                target.x01_ton_plus_checkouts += sourceStats.x01_ton_plus_checkouts || 0;

                const sourceBestLeg = sourceStats.x01_best_leg;
                if (sourceBestLeg && sourceBestLeg < 999) {
                    if (!target.x01_best_leg || sourceBestLeg < target.x01_best_leg) {
                        target.x01_best_leg = sourceBestLeg;
                    }
                }

                if (sourceStats.x01_high_score && (!target.x01_high_score || sourceStats.x01_high_score > target.x01_high_score)) {
                    target.x01_high_score = sourceStats.x01_high_score;
                }
                if (sourceStats.x01_high_checkout && (!target.x01_high_checkout || sourceStats.x01_high_checkout > target.x01_high_checkout)) {
                    target.x01_high_checkout = sourceStats.x01_high_checkout;
                }

                target.cricket_total_marks += sourceStats.cricket_total_marks || 0;
                target.cricket_total_darts += sourceStats.cricket_total_darts || 0;
                target.cricket_legs_played += sourceStats.cricket_legs_played || 0;
                target.cricket_legs_won += sourceStats.cricket_legs_won || 0;
                target.cricket_missed_darts += sourceStats.cricket_missed_darts || 0;
                target.cricket_triple_bull_darts += sourceStats.cricket_triple_bull_darts || 0;
                target.cricket_five_mark_rounds += sourceStats.cricket_five_mark_rounds || 0;
                target.cricket_seven_mark_rounds += sourceStats.cricket_seven_mark_rounds || 0;
                target.cricket_eight_mark_rounds += sourceStats.cricket_eight_mark_rounds || 0;
                target.cricket_nine_mark_rounds += sourceStats.cricket_nine_mark_rounds || 0;
                target.cricket_three_bulls += sourceStats.cricket_three_bulls || 0;
                target.cricket_hat_tricks += sourceStats.cricket_hat_tricks || 0;
            };

            const getLeagueStats = async leagueId => {
                try {
                    let leaguePlayerDoc;

                    if (searchPin) {
                        const byPin = await db.collection('leagues').doc(leagueId).collection('players').where('pin', '==', searchPin).limit(1).get();
                        if (!byPin.empty) leaguePlayerDoc = byPin.docs[0];
                    }

                    if (!leaguePlayerDoc) {
                        const byName = await db.collection('leagues').doc(leagueId).collection('players').where('name', '==', searchName).limit(1).get();
                        if (!byName.empty) leaguePlayerDoc = byName.docs[0];
                    }

                    if (!leaguePlayerDoc) return null;

                    const statsDoc = await db.collection('leagues').doc(leagueId).collection('stats').doc(leaguePlayerDoc.id).get();
                    return statsDoc.exists ? statsDoc.data() : null;
                } catch (e) {
                    console.error(`Error fetching league ${leagueId} stats:`, e.message);
                    return null;
                }
            };

            let stats = createEmptyStats();
            const leagueIds = new Set();
            (involvements.leagues || []).forEach(l => leagueIds.add(l.id));
            (involvements.captaining || []).forEach(c => leagueIds.add(c.league_id));
            (involvements.directing || []).filter(d => d.type === 'league').forEach(d => leagueIds.add(d.id));

            switch (source) {
                case 'league':
                    for (const leagueId of leagueIds) {
                        const leagueStats = await getLeagueStats(leagueId);
                        if (leagueStats) aggregateStats(stats, leagueStats);
                    }
                    stats.source = 'league';
                    break;

                case 'tournament':
                    stats.source = 'tournament';
                    break;

                case 'social':
                    try {
                        const pickupStatsDoc = await db.collection('players').doc(player_id).collection('pickup_stats').doc('aggregate').get();
                        if (pickupStatsDoc.exists) {
                            const ps = pickupStatsDoc.data();
                            stats.x01_games_played = ps.x01_legs_played || 0;
                            stats.x01_games_won = ps.x01_legs_won || 0;
                            stats.x01_darts = ps.x01_total_darts || 0;
                            stats.x01_points = ps.x01_total_points || 0;
                            stats.x01_three_dart_avg = ps.x01_total_darts > 0 ? parseFloat(((ps.x01_total_points || 0) / ps.x01_total_darts * 3).toFixed(2)) : 0;
                            stats.x01_first_nine_avg = ps.x01_first9_darts > 0 ? parseFloat(((ps.x01_first9_points || 0) / ps.x01_first9_darts * 3).toFixed(2)) : 0;
                            stats.x01_tons_100 = ps.x01_ton_00 || 0;
                            stats.x01_tons_120 = ps.x01_ton_20 || 0;
                            stats.x01_tons_140 = ps.x01_ton_40 || 0;
                            stats.x01_tons_160 = ps.x01_ton_60 || 0;
                            stats.x01_tons_180 = ps.x01_ton_80 || 0;
                            stats.x01_checkouts = ps.x01_checkouts_hit || 0;
                            stats.x01_checkout_opps = ps.x01_checkout_attempts || 0;
                            stats.x01_checkout_pct = ps.x01_checkout_attempts > 0 ? parseFloat(((ps.x01_checkouts_hit || 0) / ps.x01_checkout_attempts * 100).toFixed(1)) : 0;
                            stats.x01_high_checkout = ps.x01_highest_checkout || 0;
                            stats.cricket_games_played = ps.cricket_legs_played || 0;
                            stats.cricket_games_won = ps.cricket_legs_won || 0;
                            stats.cricket_mpr = ps.cricket_total_darts > 0 ? parseFloat(((ps.cricket_total_marks || 0) / (ps.cricket_total_darts / 3)).toFixed(2)) : 0;
                            stats.cricket_total_marks = ps.cricket_total_marks || 0;
                            stats.cricket_total_darts = ps.cricket_total_darts || 0;
                            stats.games_played = (ps.x01_legs_played || 0) + (ps.cricket_legs_played || 0);
                            stats.games_won = (ps.x01_legs_won || 0) + (ps.cricket_legs_won || 0);
                        }
                        stats.source = 'social';
                    } catch (error) {
                        console.error('Error loading social stats:', error);
                        stats.source = 'social';
                    }
                    break;

                case 'combined':
                default: {
                    const playerDocStats = player.stats || player.unified_stats;
                    if (playerDocStats && (playerDocStats.x01_total_darts > 0 || playerDocStats.cricket_total_darts > 0 || playerDocStats.x01_legs_played > 0)) {
                        aggregateStats(stats, playerDocStats);
                    }

                    for (const leagueId of leagueIds) {
                        const leagueStats = await getLeagueStats(leagueId);
                        if (leagueStats) aggregateStats(stats, leagueStats);
                    }

                    if (stats.x01_legs_played === 0 && stats.cricket_legs_played === 0) {
                        const allLeagues = await db.collection('leagues').get();
                        for (const leagueDoc of allLeagues.docs) {
                            try {
                                let leaguePlayerDoc = searchPin
                                    ? await db.collection('leagues').doc(leagueDoc.id).collection('players').where('pin', '==', searchPin).limit(1).get()
                                    : { empty: true };

                                if (leaguePlayerDoc.empty) {
                                    leaguePlayerDoc = await db.collection('leagues').doc(leagueDoc.id).collection('players').where('name', '==', searchName).limit(1).get();
                                }

                                if (!leaguePlayerDoc.empty) {
                                    const leaguePlayerId = leaguePlayerDoc.docs[0].id;
                                    const statsDoc = await db.collection('leagues').doc(leagueDoc.id).collection('stats').doc(leaguePlayerId).get();

                                    if (statsDoc.exists) {
                                        const foundStats = statsDoc.data();
                                        if (foundStats.x01_legs_played > 0 || foundStats.cricket_legs_played > 0) {
                                            aggregateStats(stats, foundStats);
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                            }
                        }
                    }

                    try {
                        const pickupDoc = await db.collection('players').doc(player_id).collection('pickup_stats').doc('aggregate').get();
                        if (pickupDoc.exists) {
                            const ps = pickupDoc.data();
                            stats.x01_darts = (stats.x01_darts || 0) + (ps.x01_total_darts || 0);
                            stats.x01_points = (stats.x01_points || 0) + (ps.x01_total_points || 0);
                            stats.x01_games_played = (stats.x01_games_played || 0) + (ps.x01_legs_played || 0);
                            stats.x01_games_won = (stats.x01_games_won || 0) + (ps.x01_legs_won || 0);
                            stats.x01_tons_100 = (stats.x01_tons_100 || 0) + (ps.x01_ton_00 || 0);
                            stats.x01_tons_120 = (stats.x01_tons_120 || 0) + (ps.x01_ton_20 || 0);
                            stats.x01_tons_140 = (stats.x01_tons_140 || 0) + (ps.x01_ton_40 || 0);
                            stats.x01_tons_160 = (stats.x01_tons_160 || 0) + (ps.x01_ton_60 || 0);
                            stats.x01_tons_180 = (stats.x01_tons_180 || 0) + (ps.x01_ton_80 || 0);
                            stats.x01_checkouts = (stats.x01_checkouts || 0) + (ps.x01_checkouts_hit || 0);
                            stats.x01_checkout_opps = (stats.x01_checkout_opps || 0) + (ps.x01_checkout_attempts || 0);
                            stats.cricket_games_played = (stats.cricket_games_played || 0) + (ps.cricket_legs_played || 0);
                            stats.cricket_games_won = (stats.cricket_games_won || 0) + (ps.cricket_legs_won || 0);
                            stats.cricket_total_marks = (stats.cricket_total_marks || 0) + (ps.cricket_total_marks || 0);
                            stats.cricket_total_darts = (stats.cricket_total_darts || 0) + (ps.cricket_total_darts || 0);
                            if (stats.x01_darts > 0) stats.x01_three_dart_avg = parseFloat((stats.x01_points / stats.x01_darts * 3).toFixed(2));
                            if (stats.cricket_total_darts > 0) stats.cricket_mpr = parseFloat((stats.cricket_total_marks / (stats.cricket_total_darts / 3)).toFixed(2));
                            if ((stats.x01_checkout_opps || 0) > 0) stats.x01_checkout_pct = parseFloat((stats.x01_checkouts / stats.x01_checkout_opps * 100).toFixed(1));
                        }
                    } catch (error) {
                        console.error('Error adding pickup stats to combined:', error);
                    }

                    stats.source = 'combined';
                    break;
                }
            }

            res.json({
                success: true,
                player_id,
                player_name: player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
                stats
            });
        } catch (error) {
            console.error('Error getting filtered stats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
