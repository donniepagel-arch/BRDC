const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';

async function checkAllMatches() {
    console.log('=== Checking all matches for data issues ===\n');

    const matchesSnap = await db.collection('leagues').doc(leagueId)
        .collection('matches')
        .orderBy('week')
        .get();

    console.log(`Total matches: ${matchesSnap.size}\n`);

    const issues = [];

    matchesSnap.forEach(doc => {
        const data = doc.data();
        const matchIssues = [];

        // Check for missing scores on completed matches
        if (data.status === 'completed') {
            if (data.home_score === undefined || data.home_score === null) {
                matchIssues.push('Missing home_score');
            }
            if (data.away_score === undefined || data.away_score === null) {
                matchIssues.push('Missing away_score');
            }
        }

        // Check for missing team IDs
        if (!data.home_team_id) {
            matchIssues.push('Missing home_team_id');
        }
        if (!data.away_team_id) {
            matchIssues.push('Missing away_team_id');
        }

        // Check for missing week
        if (data.week === undefined || data.week === null) {
            matchIssues.push('Missing week');
        }

        // Check for missing status
        if (!data.status) {
            matchIssues.push('Missing status');
        }

        // Check for missing date
        if (!data.date && !data.match_date) {
            matchIssues.push('Missing date');
        }

        // Check games array for completed matches
        if (data.status === 'completed') {
            if (!data.games || data.games.length === 0) {
                matchIssues.push('No games array (completed match)');
            } else {
                // Check each game
                let gamesWithoutWinner = 0;
                let gamesWithoutPlayers = 0;
                data.games.forEach((game, idx) => {
                    if (!game.winner && game.status === 'completed') {
                        gamesWithoutWinner++;
                    }
                    if ((!game.home_players || game.home_players.length === 0) &&
                        (!game.away_players || game.away_players.length === 0)) {
                        gamesWithoutPlayers++;
                    }
                });
                if (gamesWithoutWinner > 0) {
                    matchIssues.push(`${gamesWithoutWinner} games without winner`);
                }
                if (gamesWithoutPlayers > 0) {
                    matchIssues.push(`${gamesWithoutPlayers} games without players`);
                }
            }
        }

        if (matchIssues.length > 0) {
            issues.push({
                id: doc.id,
                week: data.week,
                status: data.status,
                home_team: data.home_team_id,
                away_team: data.away_team_id,
                home_score: data.home_score,
                away_score: data.away_score,
                issues: matchIssues
            });
        }
    });

    console.log('=== Matches with Issues ===\n');

    if (issues.length === 0) {
        console.log('No issues found!');
    } else {
        issues.forEach(match => {
            console.log(`Week ${match.week} - ${match.id}`);
            console.log(`  Status: ${match.status}`);
            console.log(`  Score: ${match.home_score ?? 'null'} - ${match.away_score ?? 'null'}`);
            console.log(`  Issues: ${match.issues.join(', ')}`);
            console.log('');
        });
        console.log(`Total matches with issues: ${issues.length}`);
    }

    // Summary by week
    console.log('\n=== Summary by Week ===\n');
    const weekSummary = {};
    matchesSnap.forEach(doc => {
        const data = doc.data();
        const week = data.week || 'unknown';
        if (!weekSummary[week]) {
            weekSummary[week] = { total: 0, completed: 0, scheduled: 0, hasScores: 0, hasGames: 0 };
        }
        weekSummary[week].total++;
        if (data.status === 'completed') weekSummary[week].completed++;
        if (data.status === 'scheduled') weekSummary[week].scheduled++;
        if (data.home_score !== undefined && data.away_score !== undefined) weekSummary[week].hasScores++;
        if (data.games && data.games.length > 0) weekSummary[week].hasGames++;
    });

    Object.entries(weekSummary).sort((a, b) => a[0] - b[0]).forEach(([week, stats]) => {
        console.log(`Week ${week}: ${stats.total} matches (${stats.completed} completed, ${stats.scheduled} scheduled) - ${stats.hasScores} with scores, ${stats.hasGames} with games`);
    });

    process.exit(0);
}

checkAllMatches().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
