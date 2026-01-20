/**
 * Notable Performances Cloud Function
 * Returns weekly top performers by level (A/B/C)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Get notable performances - weekly leaders by level
 */
exports.getNotablePerformances = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    try {
        const performances = await getWeeklyLeaders();
        return res.json({ success: true, performances });
    } catch (error) {
        console.error('Error getting notable performances:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get weekly leaders from recent matches
 */
async function getWeeklyLeaders() {
    const performances = [];

    // Track top performers by level and category
    const leaders = {
        A: { x01_avg: null, cricket_mpr: null, wins: null },
        B: { x01_avg: null, cricket_mpr: null, wins: null },
        C: { x01_avg: null, cricket_mpr: null, wins: null }
    };

    // Get matches from the past 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Get all active leagues
    const leaguesSnapshot = await db.collection('leagues')
        .where('status', 'in', ['active', 'playoffs'])
        .get();

    // Track current week number (we'll use the max week found)
    let currentWeek = 0;

    for (const leagueDoc of leaguesSnapshot.docs) {
        const league = leagueDoc.data();
        const leagueId = leagueDoc.id;
        const leagueName = league.league_name || league.name || 'League';

        // Get all players for this league to get their levels
        const playersSnapshot = await db.collection('leagues')
            .doc(leagueId)
            .collection('players')
            .get();

        // Build player level and team maps
        const playerLevels = {};
        const playerTeams = {};
        for (const playerDoc of playersSnapshot.docs) {
            const player = playerDoc.data();
            const playerId = playerDoc.id;

            let level = player.level || player.preferred_level || null;
            if (!level && player.position) {
                const posMap = { 1: 'A', 2: 'B', 3: 'C' };
                level = posMap[player.position] || null;
            }
            if (!level && player.skill_level) {
                if (['A', 'B', 'C'].includes(player.skill_level)) {
                    level = player.skill_level;
                } else if (player.skill_level === 'advanced') {
                    level = 'A';
                } else if (player.skill_level === 'beginner') {
                    level = 'C';
                }
            }
            playerLevels[playerId] = ['A', 'B', 'C'].includes(level) ? level : 'B';
            playerTeams[playerId] = player.team_name || player.team || '';
        }

        // Get recent completed matches
        const matchesSnapshot = await db.collection('leagues')
            .doc(leagueId)
            .collection('matches')
            .where('completed', '==', true)
            .orderBy('played_at', 'desc')
            .limit(50)
            .get();

        // Aggregate stats per player from recent matches
        const playerWeeklyStats = {};

        for (const matchDoc of matchesSnapshot.docs) {
            const match = matchDoc.data();
            const matchDate = match.played_at?.toDate?.() || new Date(match.played_at);

            // Skip if too old
            if (matchDate < cutoffDate) continue;

            // Track week number
            const matchWeek = match.week || 0;
            if (matchWeek > currentWeek) currentWeek = matchWeek;

            // Process leg stats from this match
            const legStats = match.leg_stats || match.legs || [];

            for (const leg of legStats) {
                if (!leg.player_id || !leg.player_name) continue;

                const playerId = leg.player_id;
                const playerName = leg.player_name;

                if (!playerWeeklyStats[playerId]) {
                    playerWeeklyStats[playerId] = {
                        player_name: playerName,
                        level: playerLevels[playerId] || 'B',
                        team_name: playerTeams[playerId] || '',
                        league_name: leagueName,
                        week: matchWeek,
                        x01_darts: 0,
                        x01_points: 0,
                        x01_legs: 0,
                        x01_wins: 0,
                        cricket_marks: 0,
                        cricket_rounds: 0,
                        cricket_legs: 0,
                        cricket_wins: 0
                    };
                }

                const stats = playerWeeklyStats[playerId];
                if (matchWeek > stats.week) stats.week = matchWeek;

                // X01 stats
                if (leg.game_type === '501' || leg.game_type === '301' || leg.game_type === '701') {
                    if (leg.total_darts > 0) {
                        stats.x01_darts += leg.total_darts;
                        stats.x01_points += leg.total_points || (leg.average * leg.total_darts / 3) || 0;
                        stats.x01_legs++;
                        if (leg.won) stats.x01_wins++;
                    }
                }

                // Cricket stats
                if (leg.game_type === 'cricket') {
                    if (leg.rounds > 0 || leg.total_rounds > 0) {
                        stats.cricket_marks += leg.total_marks || 0;
                        stats.cricket_rounds += leg.rounds || leg.total_rounds || 0;
                        stats.cricket_legs++;
                        if (leg.won) stats.cricket_wins++;
                    }
                }
            }
        }

        // Process aggregated stats for this league
        for (const [playerId, stats] of Object.entries(playerWeeklyStats)) {
            const level = stats.level;

            // X01 average (minimum 3 legs)
            if (stats.x01_legs >= 3 && stats.x01_darts > 0) {
                const avg = (stats.x01_points / stats.x01_darts) * 3;
                if (!leaders[level].x01_avg || avg > leaders[level].x01_avg.value) {
                    leaders[level].x01_avg = {
                        type: 'Highest 01 Avg',
                        level: level,
                        value: avg,
                        display_value: avg.toFixed(2),
                        player_id: playerId,
                        player_name: stats.player_name,
                        team_name: stats.team_name,
                        league_name: stats.league_name,
                        week: stats.week,
                        legs_played: stats.x01_legs
                    };
                }
            }

            // Cricket MPR (minimum 3 legs)
            if (stats.cricket_legs >= 3 && stats.cricket_rounds > 0) {
                const mpr = stats.cricket_marks / stats.cricket_rounds;
                if (!leaders[level].cricket_mpr || mpr > leaders[level].cricket_mpr.value) {
                    leaders[level].cricket_mpr = {
                        type: 'Best MPR',
                        level: level,
                        value: mpr,
                        display_value: mpr.toFixed(2),
                        player_id: playerId,
                        player_name: stats.player_name,
                        team_name: stats.team_name,
                        league_name: stats.league_name,
                        week: stats.week,
                        legs_played: stats.cricket_legs
                    };
                }
            }

            // Total wins
            const totalWins = stats.x01_wins + stats.cricket_wins;
            if (totalWins > 0) {
                if (!leaders[level].wins || totalWins > leaders[level].wins.value) {
                    leaders[level].wins = {
                        type: 'Most Wins',
                        level: level,
                        value: totalWins,
                        display_value: totalWins.toString(),
                        player_id: playerId,
                        player_name: stats.player_name,
                        team_name: stats.team_name,
                        league_name: stats.league_name,
                        week: stats.week,
                        x01_wins: stats.x01_wins,
                        cricket_wins: stats.cricket_wins
                    };
                }
            }
        }
    }

    // Build the performances array
    for (const level of ['A', 'B', 'C']) {
        if (leaders[level].x01_avg) {
            performances.push(leaders[level].x01_avg);
        }
        if (leaders[level].cricket_mpr) {
            performances.push(leaders[level].cricket_mpr);
        }
        if (leaders[level].wins) {
            performances.push(leaders[level].wins);
        }
    }

    return performances;
}
