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

        // Group matches by week for league night summaries
        const weekGroups = {};
        for (const match of matches) {
            if (match.status !== 'completed') continue;
            const week = match.week || 0;
            if (!weekGroups[week]) weekGroups[week] = [];
            weekGroups[week].push(match);
        }

        // Process each match
        for (const match of matches) {
            if (match.status !== 'completed') continue;

            const homeTeam = teamsById[match.home_team_id];
            const awayTeam = teamsById[match.away_team_id];

            if (!homeTeam || !awayTeam) continue;

            const matchDate = match.match_date?.toDate ? match.match_date.toDate() : new Date(match.match_date);

            // Get top performers by level from this match
            const topPerformers = getTopPerformersByLevel(match, playersById);

            // Get rosters for this match
            const homeRoster = Object.values(playersById).filter(p => p.team_id === match.home_team_id);
            const awayRoster = Object.values(playersById).filter(p => p.team_id === match.away_team_id);

            // 1. MATCH RESULT with top performers and rosters
            feedItems.push({
                type: 'match_result',
                created_at: matchDate,
                match_id: match.id,
                week: match.week || 0,
                league_id: league_id,
                data: {
                    home_team_id: homeTeam.id || '',
                    home_team_name: homeTeam?.name || 'Home Team',
                    home_score: match.home_score || 0,
                    home_roster: homeRoster.map(p => ({ name: p.name, level: p.level })),
                    away_team_id: awayTeam.id || '',
                    away_team_name: awayTeam?.name || 'Away Team',
                    away_score: match.away_score || 0,
                    away_roster: awayRoster.map(p => ({ name: p.name, level: p.level })),
                    top_performers: topPerformers
                }
            });

        }

        // 2. CREATE LEAGUE NIGHT SUMMARIES (one per week)
        for (const [week, weekMatches] of Object.entries(weekGroups)) {
            if (weekMatches.length === 0) continue;

            const weekNum = parseInt(week);
            const matchDate = weekMatches[0].match_date?.toDate ? weekMatches[0].match_date.toDate() : new Date(weekMatches[0].match_date);

            // Get top performers across all matches this week by level
            const weekTopPerformers = getWeekTopPerformersByLevel(weekMatches, playersById);

            // Calculate standings after this week
            const standingsAfterWeek = calculateStandings(matches.filter(m =>
                m.status === 'completed' && (m.week || 0) <= weekNum
            ));

            feedItems.push({
                type: 'league_night',
                created_at: matchDate,
                week: weekNum,
                league_id: league_id,
                data: {
                    matches_played: weekMatches.length,
                    top_performers: weekTopPerformers,
                    standings_top3: standingsAfterWeek.slice(0, 3).map((t, idx) => ({
                        rank: idx + 1,
                        team_id: t.id,
                        team_name: teamsById[t.id]?.name || 'Unknown',
                        wins: t.wins,
                        losses: t.losses
                    }))
                }
            });
        }

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
 * Get top performer from each ABC level in a match
 */
function getTopPerformersByLevel(match, playersById) {
    const levelStats = { A: {}, B: {}, C: {} };

    if (!match.games || !Array.isArray(match.games)) return {};

    // Aggregate stats by player
    for (const game of match.games) {
        if (!game.legs) continue;

        for (const leg of game.legs) {
            if (!leg.player_stats) continue;

            for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                // Find player to get their level
                const player = Object.values(playersById).find(p =>
                    p.name && p.name.toLowerCase() === playerName.toLowerCase()
                );

                if (!player || !player.level) continue;

                const level = player.level; // A, B, or C

                if (!levelStats[level][playerName]) {
                    levelStats[level][playerName] = {
                        player_id: player.id,
                        x01_darts: 0,
                        x01_points: 0,
                        cricket_darts: 0,
                        cricket_marks: 0
                    };
                }

                if (leg.format === '501' || leg.format === '301' || leg.format === '701') {
                    levelStats[level][playerName].x01_darts += stats.darts || 0;
                    levelStats[level][playerName].x01_points += stats.points || 0;
                } else if (leg.format === 'cricket') {
                    levelStats[level][playerName].cricket_darts += stats.darts || 0;
                    levelStats[level][playerName].cricket_marks += stats.marks || 0;
                }
            }
        }
    }

    // Find top performer in each level
    const topPerformers = {};
    for (const [level, players] of Object.entries(levelStats)) {
        let topPlayer = null;
        let topScore = 0;

        for (const [playerName, stats] of Object.entries(players)) {
            const avg3DA = stats.x01_darts > 0 ? (stats.x01_points / stats.x01_darts) * 3 : 0;
            const mpr = stats.cricket_darts > 0 ? stats.cricket_marks / (stats.cricket_darts / 3) : 0;

            // Combined score (weighted average)
            const score = avg3DA + (mpr * 10); // MPR roughly matches 3DA when multiplied by ~10

            if (score > topScore) {
                topScore = score;
                topPlayer = {
                    name: playerName,
                    player_id: stats.player_id,
                    avg_3da: avg3DA > 0 ? avg3DA.toFixed(1) : null,
                    mpr: mpr > 0 ? mpr.toFixed(2) : null
                };
            }
        }

        if (topPlayer) {
            topPerformers[level] = topPlayer;
        }
    }

    return topPerformers;
}

/**
 * Get top performers by level across all matches in a week
 */
function getWeekTopPerformersByLevel(weekMatches, playersById) {
    const levelStats = { A: {}, B: {}, C: {} };

    for (const match of weekMatches) {
        if (!match.games || !Array.isArray(match.games)) continue;

        for (const game of match.games) {
            if (!game.legs) continue;

            for (const leg of game.legs) {
                if (!leg.player_stats) continue;

                for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                    const player = Object.values(playersById).find(p =>
                        p.name && p.name.toLowerCase() === playerName.toLowerCase()
                    );

                    if (!player || !player.level) continue;

                    const level = player.level;

                    if (!levelStats[level][playerName]) {
                        levelStats[level][playerName] = {
                            player_id: player.id,
                            x01_darts: 0,
                            x01_points: 0,
                            cricket_darts: 0,
                            cricket_marks: 0
                        };
                    }

                    if (leg.format === '501' || leg.format === '301' || leg.format === '701') {
                        levelStats[level][playerName].x01_darts += stats.darts || 0;
                        levelStats[level][playerName].x01_points += stats.points || 0;
                    } else if (leg.format === 'cricket') {
                        levelStats[level][playerName].cricket_darts += stats.darts || 0;
                        levelStats[level][playerName].cricket_marks += stats.marks || 0;
                    }
                }
            }
        }
    }

    // Find top performer in each level
    const topPerformers = {};
    for (const [level, players] of Object.entries(levelStats)) {
        let topPlayer = null;
        let topScore = 0;

        for (const [playerName, stats] of Object.entries(players)) {
            const avg3DA = stats.x01_darts > 0 ? (stats.x01_points / stats.x01_darts) * 3 : 0;
            const mpr = stats.cricket_darts > 0 ? stats.cricket_marks / (stats.cricket_darts / 3) : 0;

            const score = avg3DA + (mpr * 10);

            if (score > topScore) {
                topScore = score;
                topPlayer = {
                    name: playerName,
                    player_id: stats.player_id,
                    avg_3da: avg3DA > 0 ? avg3DA.toFixed(1) : null,
                    mpr: mpr > 0 ? mpr.toFixed(2) : null
                };
            }
        }

        if (topPlayer) {
            topPerformers[level] = topPlayer;
        }
    }

    return topPerformers;
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
