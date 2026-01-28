/**
 * Check feed items to see what data is stored
 */

const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

function callCloudFunction(functionName, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(functionName);
        const payload = JSON.stringify({ data });

        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.result) {
                        resolve(response.result);
                    } else if (response.error) {
                        reject(new Error(response.error.message || 'Function error'));
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}\nBody: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    try {
        // Get league info
        const leagueResult = await callCloudFunction(
            'https://us-central1-brdc-v2.cloudfunctions.net/getLeagueSchedule',
            { league_id: LEAGUE_ID }
        );

        console.log('League Info:');
        console.log('  Name:', leagueResult.league?.name || 'NOT FOUND');
        console.log('  ID:', LEAGUE_ID);
        console.log();

        // Get feed items
        const feedResult = await callCloudFunction(
            'https://us-central1-brdc-v2.cloudfunctions.net/getSchedule',
            { league_id: LEAGUE_ID }
        );

        console.log('Checking first feed item...');
        // This won't work directly, let me just regenerate and check the output

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
