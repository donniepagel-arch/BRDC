/**
 * Verify Week 1 match results
 */
const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Week 1 match IDs and expected results
const WEEK1_MATCHES = [
    { matchId: 'sgmoL4GyVUYP67aOS7wm', name: 'Pagel v Pagel', expected: { home: 7, away: 2 } },
    { matchId: 'JqiWABEBS7Bqk8n7pKxD', name: 'Kull v Yasenchak', expected: { home: 3, away: 6 } },
    { matchId: '0lxEeuAa7fEDSVeY3uCG', name: 'Olschansky v Partlo', expected: null },
    { matchId: 'OTYlCe3NNbinKlpZccwS', name: 'Massimioni v Ragnoni', expected: { home: 7, away: 2 } },
    { matchId: 'nYv1XeGTWbaxBepI6F5u', name: 'Mezlak v Russano', expected: { home: 4, away: 5 } }
];

function getMatchData(matchId) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            leagueId: LEAGUE_ID,
            matchId: matchId
        });

        const options = {
            hostname: 'us-central1-brdc-v2.cloudfunctions.net',
            port: 443,
            path: '/getMatchDetails',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ error: body });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('=== WEEK 1 MATCH VERIFICATION ===\n');

    let totalHomeWins = {};
    let totalAwayWins = {};
    let setPoints = {};

    for (const match of WEEK1_MATCHES) {
        console.log(`${match.name} (${match.matchId}):`);

        const result = await getMatchData(match.matchId);

        if (result.error) {
            console.log(`  Error: ${result.error}`);
        } else if (result.match) {
            const m = result.match;
            const homeScore = m.home_score || 0;
            const awayScore = m.away_score || 0;
            const homeName = m.home_team_name || 'Home';
            const awayName = m.away_team_name || 'Away';

            console.log(`  ${homeName} ${homeScore} - ${awayScore} ${awayName}`);

            if (match.expected) {
                const matches = homeScore === match.expected.home && awayScore === match.expected.away;
                console.log(`  Expected: ${match.expected.home} - ${match.expected.away} ${matches ? '✓' : '✗ MISMATCH'}`);
            }

            // Track standings
            if (!setPoints[homeName]) setPoints[homeName] = { wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
            if (!setPoints[awayName]) setPoints[awayName] = { wins: 0, losses: 0, setsWon: 0, setsLost: 0 };

            setPoints[homeName].setsWon += homeScore;
            setPoints[homeName].setsLost += awayScore;
            setPoints[awayName].setsWon += awayScore;
            setPoints[awayName].setsLost += homeScore;

            if (homeScore > awayScore) {
                setPoints[homeName].wins++;
                setPoints[awayName].losses++;
            } else if (awayScore > homeScore) {
                setPoints[awayName].wins++;
                setPoints[homeName].losses++;
            }
        } else {
            console.log(`  No match data returned`);
            console.log(`  Response: ${JSON.stringify(result)}`);
        }
        console.log('');
    }

    console.log('=== STANDINGS (Week 1) ===\n');
    const sorted = Object.entries(setPoints).sort((a, b) => {
        if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
        return b[1].setsWon - a[1].setsWon;
    });

    console.log('Team                  | W | L | Sets Won | Sets Lost |');
    console.log('----------------------|---|---|----------|-----------|');
    for (const [team, stats] of sorted) {
        const name = team.padEnd(21);
        console.log(`${name} | ${stats.wins} | ${stats.losses} |    ${String(stats.setsWon).padStart(2)}    |     ${String(stats.setsLost).padStart(2)}    |`);
    }
}

main().catch(console.error);
