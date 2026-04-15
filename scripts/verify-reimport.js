// verify-reimport.js
// Uses Firebase REST API to verify match data
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

function extractValue(field) {
    if (!field) return null;
    if (field.integerValue !== undefined) return parseInt(field.integerValue);
    if (field.stringValue !== undefined) return field.stringValue;
    if (field.booleanValue !== undefined) return field.booleanValue;
    if (field.timestampValue !== undefined) return field.timestampValue;
    if (field.arrayValue && field.arrayValue.values) return field.arrayValue.values;
    return null;
}

async function verify() {
    const testMatches = [
        { id: 'sgmoL4GyVUYP67aOS7wm', name: 'Pagel v Pagel (Week 1)' },
        { id: 'JqiWABEBS7Bqk8n7pKxD', name: 'N. Kull vs K. Yasenchak (Week 1)' },
        { id: '0lxEeuAa7fEDSVeY3uCG', name: 'E.O vs D. Partlo (Week 1)' },
        { id: 'nYv1XeGTWbaxBepI6F5u', name: 'N. Mezlak vs D. Russano (Week 1)' },
        { id: 'OTYlCe3NNbinKlpZccwS', name: 'J. Ragnoni vs Neon Nightmares (Week 1)' },
        { id: 'Iychqt7Wto8S9m7proeH', name: 'D. Pagel vs N. Kull (Week 2)' },
        { id: '9unWmN7TmQgNEhFlhpuB', name: 'D. Russano vs J. Ragnoni (Week 2)' },
        { id: 'tcI1eFfOlHaTyhjaCGOj', name: 'E.O. vs N. Mezlak (Week 2)' },
        { id: 'ixNMXr2jT5f7hDD6qFDj', name: 'D. Partlo vs M. Pagel (Week 2)' },
        { id: 'YFpeyQPYEQQjMLEu1eVp', name: 'Neon Nightmares vs K. Yasenchak (Week 2)' }
    ];

    console.log('\n=== VERIFICATION RESULTS ===\n');

    let totalMatches = 0;
    let totalFixed = 0;
    let totalIssues = 0;

    for (const match of testMatches) {
        totalMatches++;
        const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/leagues/${LEAGUE_ID}/matches/${match.id}`;

        try {
            const response = await httpsGet(url);
            const fields = response.fields || {};

            const games = extractValue(fields.games) || [];
            const sets = new Set();

            games.forEach(gameField => {
                const gameMap = gameField.mapValue?.fields || {};
                const setNum = extractValue(gameMap.set);
                if (setNum) sets.add(setNum);
            });

            const hasTiming = !!(fields.start_time && fields.end_time);
            const gameTime = extractValue(fields.game_time_minutes);
            const hasGameTime = !!gameTime;

            const isFixed = sets.size === 9 && hasTiming && hasGameTime;
            if (isFixed) totalFixed++;
            else totalIssues++;

            console.log(`${match.name}`);
            console.log(`  Total games: ${games.length}`);
            console.log(`  Unique sets: ${sets.size} (${Array.from(sets).sort((a, b) => a - b).join(', ')})`);
            console.log(`  Has timing: ${hasTiming ? '✓' : '✗'}`);
            console.log(`  Game time: ${gameTime || '?'} mins`);
            console.log(`  Status: ${isFixed ? '✓ FIXED' : '✗ ISSUE (expected 9 sets)'}\n`);

        } catch (error) {
            console.log(`${match.name}`);
            console.log(`  Error: ${error.message}\n`);
            totalIssues++;
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total matches checked: ${totalMatches}`);
    console.log(`Fixed (9 sets + timing): ${totalFixed}`);
    console.log(`Issues remaining: ${totalIssues}`);
}

verify().then(() => process.exit(0)).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
