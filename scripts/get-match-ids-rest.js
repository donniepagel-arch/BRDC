// get-match-ids-rest.js
// Uses Firebase REST API to fetch match IDs (no credentials needed for public data)
const https = require('https');

const PROJECT_ID = 'brdc-v2';
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function getMatchIds() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/leagues/${LEAGUE_ID}/matches`;

    try {
        const response = await httpsGet(url);

        if (!response.documents || response.documents.length === 0) {
            console.log('No matches found');
            return;
        }

        console.log('\n=== ALL MATCHES ===\n');

        response.documents.forEach(doc => {
            const matchId = doc.name.split('/').pop();
            const fields = doc.fields || {};

            const week = fields.week?.integerValue || fields.week?.stringValue || '?';
            const home = fields.home_team_name?.stringValue || '?';
            const away = fields.away_team_name?.stringValue || '?';

            console.log(`Week ${week}: ${home} vs ${away}`);
            console.log(`  Match ID: ${matchId}\n`);
        });

    } catch (error) {
        console.error('Error fetching matches:', error.message);
        console.log('\nTrying alternative approach - checking existing match files...\n');

        // Fallback: List matches we know exist from the import script
        console.log('=== KNOWN MATCHES FROM IMPORT SCRIPT ===\n');
        console.log('Week 1: Pagel v Pagel');
        console.log('  Match ID: sgmoL4GyVUYP67aOS7wm\n');
        console.log('Week 1: N. Kull vs K. Yasenchak');
        console.log('  Match ID: JqiWABEBS7Bqk8n7pKxD\n');
        console.log('Week 1: E.O vs D. Partlo');
        console.log('  Match ID: 0lxEeuAa7fEDSVeY3uCG\n');
        console.log('Week 1: T. Massimiani vs J. Ragnoni');
        console.log('  Match ID: NEED_MATCH_ID_1\n');
        console.log('Week 1: N. Mezlak vs D. Russano');
        console.log('  Match ID: NEED_MATCH_ID_2\n');

        console.log('\nWeek 2 matches need to be manually added to Firestore first.');
        console.log('Check the league schedule in the web app for these match IDs.');
    }
}

getMatchIds().then(() => process.exit(0));
