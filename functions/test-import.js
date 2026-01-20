/**
 * Test functions to verify imported match data
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get match details including throws
 */
exports.getMatchDetails = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        const { leagueId, matchId } = req.query;

        if (!leagueId || !matchId) {
            res.status(400).json({ error: 'Missing leagueId or matchId' });
            return;
        }

        const matchDoc = await db.collection('leagues')
            .doc(leagueId)
            .collection('matches')
            .doc(matchId)
            .get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const match = matchDoc.data();

        // Summarize structure
        const summary = {
            matchId,
            homeTeam: match.home_team_name,
            awayTeam: match.away_team_name,
            status: match.status,
            homeScore: match.home_score,
            awayScore: match.away_score,
            totalLegs: match.total_legs,
            totalDarts: match.total_darts,
            gamesCount: match.games?.length || 0,
            games: match.games?.map((g, i) => ({
                game: g.game,
                type: g.type,
                format: g.format,
                winner: g.winner,
                legsCount: g.legs?.length || 0,
                hasThrows: g.legs?.some(l => l.throws && l.throws.length > 0) || false,
                hasPlayerStats: g.legs?.some(l => l.player_stats && Object.keys(l.player_stats).length > 0) || false,
                sampleLeg: g.legs?.[0] ? {
                    leg_number: g.legs[0].leg_number,
                    winner: g.legs[0].winner,
                    throwsCount: g.legs[0].throws?.length || 0,
                    playerStatsKeys: Object.keys(g.legs[0].player_stats || {}),
                    homeStats: g.legs[0].home_stats,
                    awayStats: g.legs[0].away_stats
                } : null
            })) || []
        };

        res.json(summary);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Test recalculate stats on a match
 */
exports.testRecalculateStats = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    try {
        const { leagueId, matchId } = req.query;

        if (!leagueId || !matchId) {
            res.status(400).json({ error: 'Missing leagueId or matchId' });
            return;
        }

        const matchDoc = await db.collection('leagues')
            .doc(leagueId)
            .collection('matches')
            .doc(matchId)
            .get();

        if (!matchDoc.exists) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const match = matchDoc.data();
        const playerStats = {};

        // Process each game and leg like recalculateLeagueStats does
        for (const game of match.games || []) {
            for (const leg of game.legs || []) {
                const throws = leg.throws || [];
                const isX01 = ['501', '301', '701'].includes(leg.format) || leg.format === '501';

                throws.forEach((t, roundIdx) => {
                    ['home', 'away'].forEach(side => {
                        const throwData = t[side];
                        if (!throwData || !throwData.player) return;

                        const playerName = throwData.player;
                        if (!playerStats[playerName]) {
                            playerStats[playerName] = {
                                darts: 0,
                                points: 0,
                                legs: 0,
                                tons: 0,
                                tons_180: 0,
                                high_turn: 0
                            };
                        }

                        playerStats[playerName].darts += 3;
                        const score = throwData.score || 0;
                        playerStats[playerName].points += score;

                        if (score >= 100) playerStats[playerName].tons++;
                        if (score === 180) playerStats[playerName].tons_180++;
                        if (score > playerStats[playerName].high_turn) {
                            playerStats[playerName].high_turn = score;
                        }
                    });
                });

                // Count leg wins
                if (leg.winner && leg.player_stats) {
                    for (const [name, stats] of Object.entries(leg.player_stats)) {
                        if (!playerStats[name]) {
                            playerStats[name] = { darts: 0, points: 0, legs: 0, tons: 0, tons_180: 0, high_turn: 0 };
                        }
                        playerStats[name].legs++;
                    }
                }
            }
        }

        // Calculate 3DA for each player
        for (const [name, stats] of Object.entries(playerStats)) {
            stats.x01_three_dart_avg = stats.darts > 0 ?
                parseFloat((stats.points / stats.darts * 3).toFixed(2)) : 0;
        }

        res.json({
            matchId,
            homeTeam: match.home_team_name,
            awayTeam: match.away_team_name,
            calculatedPlayerStats: playerStats
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
