/**
 * Script to generate news feed for a league
 * Usage: node scripts/generate-feed.js [league_id]
 */

const https = require('https');

const FUNCTION_URL = 'https://us-central1-brdc-v2.cloudfunctions.net/generateLeagueFeed';

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
    const leagueId = process.argv[2] || 'aOq4Y0ETxPZ66tM1uUtP'; // Winter Triple Draft

    console.log(`Generating feed for league: ${leagueId}`);

    try {
        const result = await callCloudFunction(FUNCTION_URL, { league_id: leagueId });

        console.log('✓ Feed generation complete:');
        console.log(`  Items generated: ${result.items_generated}`);
        console.log(`  Message: ${result.message}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
