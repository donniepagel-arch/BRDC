const https = require('https');

// Direct Firestore REST API call
const projectId = 'brdc-v2';
const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';

// Get matches via REST API
const url = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/leagues/' + leagueId + '/matches';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const result = JSON.parse(data);
        const matches = result.documents || [];

        console.log('Found ' + matches.length + ' matches\n');

        // Calculate standings
        const standings = {};

        for (const doc of matches) {
            const fields = doc.fields || {};
            const status = fields.status?.stringValue;

            if (status !== 'completed') continue;

            const homeTeamId = fields.home_team_id?.stringValue;
            const awayTeamId = fields.away_team_id?.stringValue;
            const homeScore = parseInt(fields.home_score?.integerValue || '0');
            const awayScore = parseInt(fields.away_score?.integerValue || '0');
            const week = fields.week?.integerValue || '?';

            // Get match ID from doc path
            const pathParts = doc.name.split('/');
            const matchId = pathParts[pathParts.length - 1];

            console.log('Week ' + week + ': home=' + homeScore + ' away=' + awayScore + ' (' + matchId.substring(0,8) + ')');

            // Track wins
            if (!standings[homeTeamId]) standings[homeTeamId] = { wins: 0, losses: 0, sets_won: 0, sets_lost: 0 };
            if (!standings[awayTeamId]) standings[awayTeamId] = { wins: 0, losses: 0, sets_won: 0, sets_lost: 0 };

            standings[homeTeamId].sets_won += homeScore;
            standings[homeTeamId].sets_lost += awayScore;
            standings[awayTeamId].sets_won += awayScore;
            standings[awayTeamId].sets_lost += homeScore;

            if (homeScore > awayScore) {
                standings[homeTeamId].wins++;
                standings[awayTeamId].losses++;
            } else if (awayScore > homeScore) {
                standings[awayTeamId].wins++;
                standings[homeTeamId].losses++;
            }
        }

        console.log('\n=== STANDINGS ===');
        const sorted = Object.entries(standings).sort((a, b) => {
            if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
            return (b[1].sets_won - b[1].sets_lost) - (a[1].sets_won - a[1].sets_lost);
        });

        for (const [teamId, record] of sorted) {
            console.log(teamId.substring(0,8) + ': ' + record.wins + '-' + record.losses + ' (' + record.sets_won + '-' + record.sets_lost + ' sets)');
        }
    });
}).on('error', console.error);
