const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Generate news feed items from league match data
 * Scans matches for notable events and creates feed items
 */
exports.generateLeagueFeed = onCall(async (request) => {
    const { league_id } = request.data;

    if (!league_id) {
        throw new HttpsError('invalid-argument', 'league_id is required');
    }

    try {
        const feedItems = [];

        // Get all matches
        const matchesSnap = await db.collection('leagues').doc(league_id).collection('matches').get();
        const matches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get teams for context
        const teamsSnap = await db.collection('leagues').doc(league_id).collection('teams').get();
        const teamsById = {};
        teamsSnap.forEach(doc => {
            teamsById[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Get players for name lookup
        const playersSnap = await db.collection('leagues').doc(league_id).collection('players').get();
        const playersById = {};
        playersSnap.forEach(doc => {
            playersById[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Process each match
        for (const match of matches) {
            if (match.status !== 'completed') continue;

            const homeTeam = teamsById[match.home_team_id];
            const awayTeam = teamsById[match.away_team_id];

            if (!homeTeam || !awayTeam) continue;

            const matchDate = match.match_date?.toDate ? match.match_date.toDate() : new Date(match.match_date);

            // 1. MATCH RESULT
            const winner = match.home_score > match.away_score ? homeTeam : awayTeam;
            const loser = match.home_score > match.away_score ? awayTeam : homeTeam;
            const winnerScore = Math.max(match.home_score || 0, match.away_score || 0);
            const loserScore = Math.min(match.home_score || 0, match.away_score || 0);

            feedItems.push({
                type: 'match_result',
                created_at: matchDate,
                match_id: match.id,
                week: match.week || 0,
                data: {
                    winner_team_id: winner?.id || '',
                    winner_team_name: winner?.name || 'Unknown Team',
                    loser_team_id: loser?.id || '',
                    loser_team_name: loser?.name || 'Unknown Team',
                    winner_score: winnerScore,
                    loser_score: loserScore,
                    home_team_name: homeTeam?.name || 'Home Team',
                    away_team_name: awayTeam?.name || 'Away Team',
                    home_score: match.home_score || 0,
                    away_score: match.away_score || 0
                }
            });

            // 2. ANALYZE GAMES FOR NOTABLE EVENTS
            if (match.games && Array.isArray(match.games)) {
                // Track tons per player per set for hat trick detection
                const setTons = {};

                for (const game of match.games) {
                    if (!game.legs || !Array.isArray(game.legs)) continue;

                    const setNum = game.set || 0;

                    for (const leg of game.legs) {
                        if (!leg.throws || !Array.isArray(leg.throws)) continue;

                        // Scan throws for notable events
                        for (const throwRound of leg.throws) {
                            // Check home side
                            if (throwRound.home && throwRound.home.player) {
                                const events = analyzeThrow(throwRound.home, 'home', leg.format);

                                // Track tons for hat trick detection
                                if (throwRound.home.score >= 100 && leg.format !== 'cricket') {
                                    const key = `${throwRound.home.player}_${setNum}`;
                                    if (!setTons[key]) setTons[key] = { player: throwRound.home.player, count: 0, teamId: match.home_team_id, teamName: homeTeam.name };
                                    setTons[key].count++;
                                }

                                for (const event of events) {
                                    feedItems.push({
                                        type: event.type,
                                        created_at: matchDate,
                                        match_id: match.id,
                                        week: match.week || 0,
                                        player_name: throwRound.home.player || 'Unknown Player',
                                        team_id: match.home_team_id || '',
                                        team_name: homeTeam.name || 'Unknown Team',
                                        data: {
                                            ...event.data,
                                            game_format: leg.format || 'unknown',
                                            opponent_team: awayTeam.name || 'Unknown Team'
                                        }
                                    });
                                }
                            }

                            // Check away side
                            if (throwRound.away && throwRound.away.player) {
                                const events = analyzeThrow(throwRound.away, 'away', leg.format);

                                // Track tons for hat trick detection
                                if (throwRound.away.score >= 100 && leg.format !== 'cricket') {
                                    const key = `${throwRound.away.player}_${setNum}`;
                                    if (!setTons[key]) setTons[key] = { player: throwRound.away.player, count: 0, teamId: match.away_team_id, teamName: awayTeam.name };
                                    setTons[key].count++;
                                }

                                for (const event of events) {
                                    feedItems.push({
                                        type: event.type,
                                        created_at: matchDate,
                                        match_id: match.id,
                                        week: match.week || 0,
                                        player_name: throwRound.away.player || 'Unknown Player',
                                        team_id: match.away_team_id || '',
                                        team_name: awayTeam.name || 'Unknown Team',
                                        data: {
                                            ...event.data,
                                            game_format: leg.format || 'unknown',
                                            opponent_team: homeTeam.name || 'Unknown Team'
                                        }
                                    });
                                }
                            }
                        }
                    }
                }

                // Check for hat tricks (3+ tons in a set)
                for (const [key, data] of Object.entries(setTons)) {
                    if (data.count >= 3) {
                        feedItems.push({
                            type: 'hat_trick',
                            created_at: matchDate,
                            match_id: match.id,
                            week: match.week || 0,
                            player_name: data.player || 'Unknown Player',
                            team_id: data.teamId || '',
                            team_name: data.teamName || 'Unknown Team',
                            data: {
                                ton_count: data.count,
                                opponent_team: data.teamId === match.home_team_id ? awayTeam.name : homeTeam.name
                            }
                        });
                    }
                }
            }

            // Check for upsets (lower-ranked team beats higher-ranked)
            // Calculate standings up to this week
            const standingsAtMatch = calculateStandings(matches.filter(m =>
                (m.week || 0) < (match.week || 0) && m.status === 'completed'
            ));

            const winnerRank = standingsAtMatch.findIndex(t => t.id === winner.id) + 1;
            const loserRank = standingsAtMatch.findIndex(t => t.id === loser.id) + 1;

            // Upset if winner was ranked 3+ spots below loser
            if (winnerRank > 0 && loserRank > 0 && winnerRank - loserRank >= 3) {
                feedItems.push({
                    type: 'upset',
                    created_at: matchDate,
                    match_id: match.id,
                    week: match.week || 0,
                    data: {
                        winner_team_id: winner.id || '',
                        winner_team_name: winner.name || 'Unknown Team',
                        winner_rank: winnerRank,
                        loser_team_id: loser.id || '',
                        loser_team_name: loser.name || 'Unknown Team',
                        loser_rank: loserRank,
                        winner_score: winnerScore,
                        loser_score: loserScore
                    }
                });
            }
        }

        // 3. CALCULATE WEEKLY LEADERS
        const weeklyLeaders = calculateWeeklyLeaders(matches, playersById);
        feedItems.push(...weeklyLeaders);

        // 4. DETECT MILESTONES
        const milestones = await detectMilestones(league_id, playersById);
        feedItems.push(...milestones);

        // Sort by date (newest first)
        feedItems.sort((a, b) => b.created_at - a.created_at);

        // Write to feed collection
        const batch = db.batch();
        const feedRef = db.collection('leagues').doc(league_id).collection('feed');

        // Clear existing feed
        const existingFeed = await feedRef.get();
        existingFeed.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Add new feed items
        let count = 0;
        for (const item of feedItems) {
            const docRef = feedRef.doc();
            batch.set(docRef, {
                ...item,
                created_at: admin.firestore.Timestamp.fromDate(item.created_at)
            });
            count++;

            // Firestore batch limit is 500
            if (count >= 500) break;
        }

        await batch.commit();

        return {
            success: true,
            items_generated: count,
            message: `Generated ${count} feed items`
        };

    } catch (error) {
        console.error('Error generating feed:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Analyze a single throw for notable events
 */
function analyzeThrow(throwData, side, format) {
    const events = [];

    if (format === '501' || format === '301' || format === '701') {
        // 180 Maximum
        if (throwData.score === 180) {
            events.push({
                type: 'maximum',
                data: { score: 180 }
            });
        }

        // Ton-80 or higher (but not 180)
        if (throwData.score >= 140 && throwData.score < 180) {
            events.push({
                type: 'high_score',
                data: { score: throwData.score }
            });
        }

        // Big Checkouts (100+)
        if (throwData.checkout && throwData.score >= 100) {
            const checkoutType = throwData.score >= 161 ? 'big_checkout' : 'ton_checkout';
            events.push({
                type: checkoutType,
                data: {
                    checkout: throwData.score,
                    checkout_darts: throwData.checkout_darts || 3
                }
            });
        }

    } else if (format === 'cricket') {
        // 9-Mark (Maximum)
        if (throwData.marks === 9) {
            events.push({
                type: 'nine_mark',
                data: { marks: 9 }
            });
        }

        // 6+ Marks
        if (throwData.marks >= 6 && throwData.marks < 9) {
            events.push({
                type: 'high_marks',
                data: { marks: throwData.marks }
            });
        }

        // Triple Bull or better
        if (throwData.notable && (throwData.notable.includes('3B') || throwData.notable.includes('5B'))) {
            events.push({
                type: 'bull_run',
                data: {
                    notable: throwData.notable,
                    marks: throwData.marks
                }
            });
        }
    }

    return events;
}

/**
 * Calculate weekly leaders for 3DA and MPR
 */
function calculateWeeklyLeaders(matches, playersById) {
    const items = [];
    const weekMap = {};

    // Group matches by week
    for (const match of matches) {
        if (match.status !== 'completed' || !match.week) continue;
        if (!weekMap[match.week]) weekMap[match.week] = [];
        weekMap[match.week].push(match);
    }

    // For each week, find top performers
    for (const [week, weekMatches] of Object.entries(weekMap)) {
        const weekStats = {};

        // Aggregate stats for this week
        for (const match of weekMatches) {
            if (!match.games) continue;

            for (const game of match.games) {
                if (!game.legs) continue;

                for (const leg of game.legs) {
                    if (!leg.player_stats) continue;

                    for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                        if (!weekStats[playerName]) {
                            weekStats[playerName] = {
                                x01_darts: 0,
                                x01_points: 0,
                                cricket_darts: 0,
                                cricket_marks: 0
                            };
                        }

                        if (leg.format === '501' || leg.format === '301' || leg.format === '701') {
                            weekStats[playerName].x01_darts += stats.darts || 0;
                            weekStats[playerName].x01_points += stats.points || 0;
                        } else if (leg.format === 'cricket') {
                            weekStats[playerName].cricket_darts += stats.darts || 0;
                            weekStats[playerName].cricket_marks += stats.marks || 0;
                        }
                    }
                }
            }
        }

        // Calculate averages and find leaders
        const playerAvgs = [];
        for (const [playerName, stats] of Object.entries(weekStats)) {
            const avg3DA = stats.x01_darts > 0 ? (stats.x01_points / stats.x01_darts) * 3 : 0;
            const mpr = stats.cricket_darts > 0 ? stats.cricket_marks / (stats.cricket_darts / 3) : 0;

            if (avg3DA > 0 || mpr > 0) {
                playerAvgs.push({ playerName, avg3DA, mpr });
            }
        }

        // Sort by 3DA
        playerAvgs.sort((a, b) => b.avg3DA - a.avg3DA);
        const top3DA = playerAvgs[0];

        // Sort by MPR
        playerAvgs.sort((a, b) => b.mpr - a.mpr);
        const topMPR = playerAvgs[0];

        // Create leader items
        if (top3DA && top3DA.avg3DA > 0 && weekMatches.length > 0) {
            const matchDate = weekMatches[0].match_date?.toDate ? weekMatches[0].match_date.toDate() : new Date(weekMatches[0].match_date);
            items.push({
                type: 'weekly_leader',
                created_at: matchDate,
                week: parseInt(week) || 0,
                player_name: top3DA.playerName || 'Unknown Player',
                data: {
                    stat_type: '3DA',
                    value: top3DA.avg3DA.toFixed(1)
                }
            });
        }

        if (topMPR && topMPR.mpr > 0 && topMPR.playerName !== top3DA?.playerName && weekMatches.length > 0) {
            const matchDate = weekMatches[0].match_date?.toDate ? weekMatches[0].match_date.toDate() : new Date(weekMatches[0].match_date);
            items.push({
                type: 'weekly_leader',
                created_at: matchDate,
                week: parseInt(week) || 0,
                player_name: topMPR.playerName || 'Unknown Player',
                data: {
                    stat_type: 'MPR',
                    value: topMPR.mpr.toFixed(2)
                }
            });
        }
    }

    return items;
}

/**
 * Detect player milestones
 */
async function detectMilestones(league_id, playersById) {
    const items = [];
    const statsSnap = await db.collection('leagues').doc(league_id).collection('stats').get();

    statsSnap.forEach(doc => {
        const stats = doc.data();
        const player = playersById[doc.id];
        if (!player || !player.name) return;

        const totalLegs = (stats.x01_legs_played || 0) + (stats.cricket_legs_played || 0);

        // Milestone: 50 legs
        if (totalLegs >= 50 && totalLegs < 60) {
            items.push({
                type: 'milestone',
                created_at: new Date(),
                player_name: player.name || 'Unknown Player',
                data: {
                    milestone_type: 'legs_played',
                    value: 50
                }
            });
        }

        // Milestone: 100 legs
        if (totalLegs >= 100 && totalLegs < 110) {
            items.push({
                type: 'milestone',
                created_at: new Date(),
                player_name: player.name || 'Unknown Player',
                data: {
                    milestone_type: 'legs_played',
                    value: 100
                }
            });
        }

        // Milestone: First 180
        if (stats.x01_180s === 1) {
            items.push({
                type: 'milestone',
                created_at: new Date(),
                player_name: player.name || 'Unknown Player',
                data: {
                    milestone_type: 'first_180',
                    value: 180
                }
            });
        }
    });

    return items;
}

/**
 * Calculate team standings from completed matches
 */
function calculateStandings(completedMatches) {
    const teamRecords = {};

    // Count wins/losses for each team
    for (const match of completedMatches) {
        if (!match.home_team_id || !match.away_team_id) continue;

        if (!teamRecords[match.home_team_id]) {
            teamRecords[match.home_team_id] = { id: match.home_team_id, wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
        }
        if (!teamRecords[match.away_team_id]) {
            teamRecords[match.away_team_id] = { id: match.away_team_id, wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
        }

        const homeScore = match.home_score || 0;
        const awayScore = match.away_score || 0;

        teamRecords[match.home_team_id].setsWon += homeScore;
        teamRecords[match.home_team_id].setsLost += awayScore;
        teamRecords[match.away_team_id].setsWon += awayScore;
        teamRecords[match.away_team_id].setsLost += homeScore;

        if (homeScore > awayScore) {
            teamRecords[match.home_team_id].wins++;
            teamRecords[match.away_team_id].losses++;
        } else if (awayScore > homeScore) {
            teamRecords[match.away_team_id].wins++;
            teamRecords[match.home_team_id].losses++;
        }
    }

    // Sort by wins (desc), then sets won (desc)
    const standings = Object.values(teamRecords);
    standings.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.setsWon - a.setsWon;
    });

    return standings;
}
