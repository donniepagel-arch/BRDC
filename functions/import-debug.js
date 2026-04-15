/**
 * Import/debug endpoints that are still intentionally exposed for admin scripts.
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get match details including throws.
 *
 * Kept live because admin audit/reimport scripts still call the deployed
 * `getMatchDetails` endpoint.
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
            games: match.games?.map((g) => ({
                game: g.game,
                type: g.type,
                format: g.format,
                winner: g.winner,
                legsCount: g.legs?.length || 0,
                hasThrows: g.legs?.some((l) => l.throws && l.throws.length > 0) || false,
                hasPlayerStats: g.legs?.some((l) => l.player_stats && Object.keys(l.player_stats).length > 0) || false,
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
