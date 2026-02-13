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

        // Get league info
        const leagueDoc = await db.collection('leagues').doc(league_id).get();
        const leagueData = leagueDoc.exists ? leagueDoc.data() : {};
        // Check multiple possible field names (different league types use different fields)
        let leagueName = leagueData.name || leagueData.league_name || leagueData.title || 'League';

        // Ensure "League" is in the name if it's not already
        if (!leagueName.toLowerCase().includes('league') && !leagueName.toLowerCase().includes('tournament')) {
            leagueName = leagueName + ' League';
        }

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

            // Get player stats from this match
            const playerMatchStats = getPlayerMatchStats(match, playersById);

            // Build rosters with fill-ins
            const buildRosterWithFillins = (teamId, lineup) => {
                // Get regular team roster
                let roster = Object.values(playersById)
                    .filter(p => p.team_id === teamId)
                    .map(p => ({
                        id: p.id,
                        name: p.name || 'Unknown',
                        level: p.level || 'C',
                        position: p.position || 99,
                        is_sub: false,
                        replacing_player_id: null
                    }));

                // Check if lineup overrides exist
                if (lineup && Array.isArray(lineup) && lineup.length > 0) {
                    // Rebuild roster based on lineup
                    const newRoster = [];
                    const replacedPlayerIds = [];

                    lineup.forEach(lineupEntry => {
                        const player = playersById[lineupEntry.player_id];
                        if (player) {
                            newRoster.push({
                                id: player.id,
                                name: player.name || 'Unknown',
                                level: player.level || 'C',
                                position: lineupEntry.position || player.position || 99,
                                is_sub: lineupEntry.is_sub || false,
                                replacing_player_id: lineupEntry.replacing_player_id || null
                            });

                            if (lineupEntry.replacing_player_id) {
                                replacedPlayerIds.push(lineupEntry.replacing_player_id);
                            }
                        }
                    });

                    roster = newRoster;
                }

                // Add stats to each player
                return roster
                    .sort((a, b) => a.position - b.position)
                    .map(p => {
                        const stats = playerMatchStats[p.name] || {};
                        return {
                            name: formatPlayerName(p.name),
                            level: p.level,
                            avg_3da: stats.avg_3da || null,
                            mpr: stats.mpr || null,
                            is_sub: p.is_sub,
                            replacing_player_id: p.replacing_player_id
                        };
                    });
            };

            const homeRoster = buildRosterWithFillins(match.home_team_id, match.home_lineup);
            const awayRoster = buildRosterWithFillins(match.away_team_id, match.away_lineup);

            // Calculate team averages for this match
            const calculateTeamAvg = (roster) => {
                const validPlayers = roster.filter(p => p.avg_3da != null || p.mpr != null);
                if (validPlayers.length === 0) return { avg_3da: null, mpr: null };

                const total3DA = validPlayers.reduce((sum, p) => sum + (p.avg_3da || 0), 0);
                const totalMPR = validPlayers.reduce((sum, p) => sum + (p.mpr || 0), 0);
                const count3DA = validPlayers.filter(p => p.avg_3da != null).length;
                const countMPR = validPlayers.filter(p => p.mpr != null).length;

                return {
                    avg_3da: count3DA > 0 ? parseFloat((total3DA / count3DA).toFixed(1)) : null,
                    mpr: countMPR > 0 ? parseFloat((totalMPR / countMPR).toFixed(2)) : null
                };
            };

            const homeTeamAvg = calculateTeamAvg(homeRoster);
            const awayTeamAvg = calculateTeamAvg(awayRoster);

            // Calculate standings up to this match
            const matchesUpToNow = matches.filter(m =>
                m.status === 'completed' &&
                (m.week || 0) <= (match.week || 0) &&
                (m.match_date?.toDate ? m.match_date.toDate() : new Date(m.match_date)) <= matchDate
            );
            const currentStandings = calculateStandings(matchesUpToNow);

            // Get team records and standings
            const homeStanding = currentStandings.find(s => s.id === match.home_team_id);
            const awayStanding = currentStandings.find(s => s.id === match.away_team_id);

            const homeRecord = homeStanding ? `${homeStanding.wins}-${homeStanding.losses}` : '0-0';
            const awayRecord = awayStanding ? `${awayStanding.wins}-${awayStanding.losses}` : '0-0';
            const homeRank = currentStandings.findIndex(s => s.id === match.home_team_id) + 1;
            const awayRank = currentStandings.findIndex(s => s.id === match.away_team_id) + 1;

            // 1. MATCH RESULT with top performers and rosters
            feedItems.push({
                type: 'match_result',
                created_at: matchDate,
                match_id: match.id,
                week: match.week || 0,
                league_id: league_id,
                league_name: leagueName,
                data: {
                    home_team_id: homeTeam.id || '',
                    home_team_name: homeTeam ? (homeTeam.name || homeTeam.team_name || 'Home Team') : 'Home Team',
                    home_score: match.home_score || 0,
                    home_roster: homeRoster,
                    home_team_avg: homeTeamAvg,
                    home_record: homeRecord,
                    home_standing: homeRank,
                    away_team_id: awayTeam.id || '',
                    away_team_name: awayTeam ? (awayTeam.name || awayTeam.team_name || 'Away Team') : 'Away Team',
                    away_score: match.away_score || 0,
                    away_roster: awayRoster,
                    away_team_avg: awayTeamAvg,
                    away_record: awayRecord,
                    away_standing: awayRank,
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
                league_name: leagueName,
                data: {
                    matches_played: weekMatches.length,
                    top_performers: weekTopPerformers,
                    standings_top3: standingsAfterWeek.slice(0, 3).map((t, idx) => {
                        const team = teamsById[t.id];
                        return {
                            rank: idx + 1,
                            team_id: t.id,
                            team_name: team ? (team.name || team.team_name || 'Unknown') : 'Unknown',
                            wins: t.wins,
                            losses: t.losses
                        };
                    })
                }
            });
        }

        // 3. CREATE WEEK HIGHLIGHTS (one per week) + INDIVIDUAL NOTABLE PERFORMANCES
        for (const [week, weekMatches] of Object.entries(weekGroups)) {
            if (weekMatches.length === 0) continue;

            const weekNum = parseInt(week);
            const matchDate = weekMatches[0].match_date?.toDate ? weekMatches[0].match_date.toDate() : new Date(weekMatches[0].match_date);

            // Initialize highlight tracking
            const weekHighlights = {
                best_3da: null,
                best_mpr: null,
                maximums: [],
                tons_140: 0,
                tons_100: 0,
                big_checkouts: [],
                high_marks: [],
                closest_match: null,
                biggest_win: null
            };

            // Track player stats across the week for best performances
            const weekPlayerStats = {};

            // Scan all matches in this week
            for (const match of weekMatches) {
                const homeTeam = teamsById[match.home_team_id];
                const awayTeam = teamsById[match.away_team_id];
                if (!homeTeam || !awayTeam) continue;

                const matchLabel = `${homeTeam.name || homeTeam.team_name} vs ${awayTeam.name || awayTeam.team_name}`;
                const matchTimestamp = match.match_date?.toDate ? match.match_date.toDate() : new Date(match.match_date);

                // Track for closest/biggest match
                const scoreDiff = Math.abs((match.home_score || 0) - (match.away_score || 0));
                if (!weekHighlights.closest_match || scoreDiff < weekHighlights.closest_match.diff) {
                    weekHighlights.closest_match = {
                        home_team: homeTeam.name || homeTeam.team_name,
                        away_team: awayTeam.name || awayTeam.team_name,
                        home_score: match.home_score || 0,
                        away_score: match.away_score || 0,
                        match_id: match.id,
                        diff: scoreDiff
                    };
                }
                if (!weekHighlights.biggest_win || scoreDiff > weekHighlights.biggest_win.diff) {
                    const winner = (match.home_score || 0) > (match.away_score || 0) ? 'home' : 'away';
                    weekHighlights.biggest_win = {
                        winner_team: winner === 'home' ? (homeTeam.name || homeTeam.team_name) : (awayTeam.name || awayTeam.team_name),
                        loser_team: winner === 'home' ? (awayTeam.name || awayTeam.team_name) : (homeTeam.name || homeTeam.team_name),
                        winner_score: winner === 'home' ? (match.home_score || 0) : (match.away_score || 0),
                        loser_score: winner === 'home' ? (match.away_score || 0) : (match.home_score || 0),
                        match_id: match.id,
                        diff: scoreDiff
                    };
                }

                if (!match.games || !Array.isArray(match.games)) continue;

                // Scan each game/leg for stats and throws
                for (const game of match.games) {
                    if (!game.legs) continue;

                    for (const leg of game.legs) {
                        const isX01 = leg.format === '501' || leg.format === '301' || leg.format === '701';
                        const isCricket = leg.format === 'cricket';

                        // Aggregate player stats for best performances
                        if (leg.player_stats) {
                            for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                                if (!weekPlayerStats[playerName]) {
                                    weekPlayerStats[playerName] = {
                                        x01_darts: 0,
                                        x01_points: 0,
                                        cricket_darts: 0,
                                        cricket_marks: 0
                                    };
                                }

                                if (isX01) {
                                    weekPlayerStats[playerName].x01_darts += stats.darts || 0;
                                    weekPlayerStats[playerName].x01_points += stats.points || 0;
                                } else if (isCricket) {
                                    weekPlayerStats[playerName].cricket_darts += stats.darts || 0;
                                    weekPlayerStats[playerName].cricket_marks += stats.marks || 0;
                                }
                            }
                        }

                        // Scan throws for notable events
                        if (leg.throws && Array.isArray(leg.throws)) {
                            for (const throwData of leg.throws) {
                                // Check both home and away sides
                                const sides = ['home', 'away'];
                                for (const side of sides) {
                                    const sideData = throwData[side];
                                    if (!sideData || !sideData.player) continue;

                                    const playerName = formatPlayerName(sideData.player);
                                    const score = sideData.score || 0;

                                    // Find player ID and team
                                    const player = Object.values(playersById).find(p =>
                                        p.name && p.name.toLowerCase() === sideData.player.toLowerCase()
                                    );
                                    const playerId = player?.id || null;
                                    const playerTeamId = player?.team_id || null;
                                    const playerTeam = playerTeamId ? teamsById[playerTeamId] : null;
                                    const playerTeamName = playerTeam ? (playerTeam.name || playerTeam.team_name || 'Unknown') : 'Unknown';
                                    const opponentTeamName = playerTeamId === match.home_team_id ?
                                        (awayTeam.name || awayTeam.team_name) :
                                        (homeTeam.name || homeTeam.team_name);

                                    // Detect notable X01 throws from raw score value
                                    if (isX01 && score > 0) {
                                        if (score === 180) {
                                            weekHighlights.maximums.push({ player_name: playerName, match: matchLabel });

                                            // CREATE INDIVIDUAL FEED ITEM: 180
                                            feedItems.push({
                                                type: 'notable_performance',
                                                created_at: matchTimestamp,
                                                match_id: match.id,
                                                week: weekNum,
                                                league_id: league_id,
                                                league_name: leagueName,
                                                data: {
                                                    event_type: '180',
                                                    player_name: playerName,
                                                    player_id: playerId,
                                                    team_name: playerTeamName,
                                                    score: 180,
                                                    opponent_team: opponentTeamName,
                                                    set_number: game.set || 0,
                                                    leg_number: leg.leg_number || 0,
                                                    format: leg.format
                                                }
                                            });
                                        } else if (score >= 171 && score <= 179) {
                                            // Ton-80 range (171-179)
                                            weekHighlights.tons_140++;

                                            // CREATE INDIVIDUAL FEED ITEM: TON-80
                                            feedItems.push({
                                                type: 'notable_performance',
                                                created_at: matchTimestamp,
                                                match_id: match.id,
                                                week: weekNum,
                                                league_id: league_id,
                                                league_name: leagueName,
                                                data: {
                                                    event_type: 'ton_80',
                                                    player_name: playerName,
                                                    player_id: playerId,
                                                    team_name: playerTeamName,
                                                    score: score,
                                                    opponent_team: opponentTeamName,
                                                    set_number: game.set || 0,
                                                    leg_number: leg.leg_number || 0,
                                                    format: leg.format
                                                }
                                            });
                                        } else if (score >= 140) {
                                            weekHighlights.tons_140++;
                                        } else if (score >= 100) {
                                            weekHighlights.tons_100++;
                                        }
                                    }

                                    // Also check notable field if present (some data has it)
                                    if (sideData.notable) {
                                        const notable = sideData.notable;
                                        if (notable.includes('180') && score !== 180) {
                                            weekHighlights.maximums.push({ player_name: playerName, match: matchLabel });

                                            // CREATE INDIVIDUAL FEED ITEM: 180 (from notable field)
                                            feedItems.push({
                                                type: 'notable_performance',
                                                created_at: matchTimestamp,
                                                match_id: match.id,
                                                week: weekNum,
                                                league_id: league_id,
                                                league_name: leagueName,
                                                data: {
                                                    event_type: '180',
                                                    player_name: playerName,
                                                    player_id: playerId,
                                                    team_name: playerTeamName,
                                                    score: 180,
                                                    opponent_team: opponentTeamName,
                                                    set_number: game.set || 0,
                                                    leg_number: leg.leg_number || 0,
                                                    format: leg.format
                                                }
                                            });
                                        }
                                    }

                                    // Detect checkouts: checkout flag OR remaining === 0 with score > 0
                                    const isCheckout = sideData.checkout || (sideData.remaining === 0 && score > 0);
                                    if (isX01 && isCheckout && score >= 100) {
                                        weekHighlights.big_checkouts.push({
                                            player_name: playerName,
                                            value: score,
                                            match: matchLabel
                                        });

                                        // CREATE INDIVIDUAL FEED ITEM: BIG CHECKOUT (161+ only)
                                        if (score >= 161) {
                                            feedItems.push({
                                                type: 'notable_performance',
                                                created_at: matchTimestamp,
                                                match_id: match.id,
                                                week: weekNum,
                                                league_id: league_id,
                                                league_name: leagueName,
                                                data: {
                                                    event_type: 'big_checkout',
                                                    player_name: playerName,
                                                    player_id: playerId,
                                                    team_name: playerTeamName,
                                                    checkout_value: score,
                                                    checkout_darts: sideData.checkout_darts || null,
                                                    opponent_team: opponentTeamName,
                                                    set_number: game.set || 0,
                                                    leg_number: leg.leg_number || 0,
                                                    format: leg.format
                                                }
                                            });
                                        }
                                    }

                                    // Check for high cricket marks (5+)
                                    if (isCricket && sideData.marks >= 5) {
                                        weekHighlights.high_marks.push({
                                            player_name: playerName,
                                            marks: sideData.marks,
                                            match: matchLabel
                                        });

                                        // CREATE INDIVIDUAL FEED ITEM: 9M CRICKET (9 marks only)
                                        if (sideData.marks === 9) {
                                            feedItems.push({
                                                type: 'notable_performance',
                                                created_at: matchTimestamp,
                                                match_id: match.id,
                                                week: weekNum,
                                                league_id: league_id,
                                                league_name: leagueName,
                                                data: {
                                                    event_type: '9m_cricket',
                                                    player_name: playerName,
                                                    player_id: playerId,
                                                    team_name: playerTeamName,
                                                    marks: 9,
                                                    opponent_team: opponentTeamName,
                                                    set_number: game.set || 0,
                                                    leg_number: leg.leg_number || 0,
                                                    format: leg.format
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Calculate best 3DA and MPR from aggregated stats
            for (const [playerName, stats] of Object.entries(weekPlayerStats)) {
                // Best 3DA (minimum 2 X01 legs worth of data - roughly 18+ darts)
                if (stats.x01_darts >= 18) {
                    const avg3DA = (stats.x01_points / stats.x01_darts) * 3;
                    if (!weekHighlights.best_3da || avg3DA > weekHighlights.best_3da.value) {
                        // Find a match this player played in
                        let matchLabel = '';
                        for (const match of weekMatches) {
                            if (!match.games) continue;
                            let found = false;
                            for (const game of match.games) {
                                if (!game.legs) continue;
                                for (const leg of game.legs) {
                                    if (leg.player_stats && leg.player_stats[playerName]) {
                                        const homeTeam = teamsById[match.home_team_id];
                                        const awayTeam = teamsById[match.away_team_id];
                                        matchLabel = `${homeTeam?.name || homeTeam?.team_name || 'Home'} vs ${awayTeam?.name || awayTeam?.team_name || 'Away'}`;
                                        found = true;
                                        break;
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }

                        weekHighlights.best_3da = {
                            player_name: formatPlayerName(playerName),
                            value: parseFloat(avg3DA.toFixed(1)),
                            match: matchLabel
                        };
                    }
                }

                // Best MPR (minimum 2 cricket legs worth of data - roughly 18+ darts)
                if (stats.cricket_darts >= 18) {
                    const mpr = stats.cricket_marks / (stats.cricket_darts / 3);
                    if (!weekHighlights.best_mpr || mpr > weekHighlights.best_mpr.value) {
                        // Find a match this player played in
                        let matchLabel = '';
                        for (const match of weekMatches) {
                            if (!match.games) continue;
                            let found = false;
                            for (const game of match.games) {
                                if (!game.legs) continue;
                                for (const leg of game.legs) {
                                    if (leg.player_stats && leg.player_stats[playerName]) {
                                        const homeTeam = teamsById[match.home_team_id];
                                        const awayTeam = teamsById[match.away_team_id];
                                        matchLabel = `${homeTeam?.name || homeTeam?.team_name || 'Home'} vs ${awayTeam?.name || awayTeam?.team_name || 'Away'}`;
                                        found = true;
                                        break;
                                    }
                                }
                                if (found) break;
                            }
                            if (found) break;
                        }

                        weekHighlights.best_mpr = {
                            player_name: formatPlayerName(playerName),
                            value: parseFloat(mpr.toFixed(2)),
                            match: matchLabel
                        };
                    }
                }
            }

            // Sort and limit arrays
            weekHighlights.big_checkouts.sort((a, b) => b.value - a.value);
            weekHighlights.big_checkouts = weekHighlights.big_checkouts.slice(0, 5);

            weekHighlights.high_marks.sort((a, b) => b.marks - a.marks);
            weekHighlights.high_marks = weekHighlights.high_marks.slice(0, 3);

            weekHighlights.maximums = weekHighlights.maximums.slice(0, 5);

            // Remove the diff property (internal use only)
            if (weekHighlights.closest_match) delete weekHighlights.closest_match.diff;
            if (weekHighlights.biggest_win) delete weekHighlights.biggest_win.diff;

            // Only add if there's at least some highlight data
            const hasData = weekHighlights.best_3da || weekHighlights.best_mpr ||
                            weekHighlights.maximums.length > 0 || weekHighlights.tons_140 > 0 ||
                            weekHighlights.tons_100 > 0 || weekHighlights.big_checkouts.length > 0 ||
                            weekHighlights.high_marks.length > 0;

            if (hasData) {
                feedItems.push({
                    type: 'week_highlights',
                    created_at: matchDate,
                    week: weekNum,
                    league_id: league_id,
                    league_name: leagueName,
                    data: weekHighlights
                });
            }
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
 * Format player name as "First L."
 */
function formatPlayerName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Unknown';

    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]; // Single name, return as-is

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const lastInitial = lastName.charAt(0).toUpperCase();

    return `${firstName} ${lastInitial}.`;
}

/**
 * Get stats for all players who played in this match
 */
function getPlayerMatchStats(match, playersById) {
    const playerStats = {};

    if (!match.games || !Array.isArray(match.games)) return playerStats;

    // Aggregate stats by player
    for (const game of match.games) {
        if (!game.legs) continue;

        for (const leg of game.legs) {
            if (!leg.player_stats) continue;

            for (const [playerName, stats] of Object.entries(leg.player_stats)) {
                if (!playerStats[playerName]) {
                    playerStats[playerName] = {
                        x01_darts: 0,
                        x01_points: 0,
                        cricket_darts: 0,
                        cricket_marks: 0
                    };
                }

                if (leg.format === '501' || leg.format === '301' || leg.format === '701') {
                    playerStats[playerName].x01_darts += stats.darts || 0;
                    playerStats[playerName].x01_points += stats.points || 0;
                } else if (leg.format === 'cricket') {
                    playerStats[playerName].cricket_darts += stats.darts || 0;
                    playerStats[playerName].cricket_marks += stats.marks || 0;
                }
            }
        }
    }

    // Calculate averages for each player
    const result = {};
    for (const [playerName, stats] of Object.entries(playerStats)) {
        const avg3DA = stats.x01_darts > 0 ? (stats.x01_points / stats.x01_darts) * 3 : null;
        const mpr = stats.cricket_darts > 0 ? stats.cricket_marks / (stats.cricket_darts / 3) : null;

        result[playerName] = {
            avg_3da: avg3DA != null ? parseFloat(avg3DA.toFixed(1)) : null,
            mpr: mpr != null ? parseFloat(mpr.toFixed(2)) : null
        };
    }

    return result;
}

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
                    name: formatPlayerName(playerName),
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
                    name: formatPlayerName(playerName),
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
