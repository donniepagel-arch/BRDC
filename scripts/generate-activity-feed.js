/**
 * Generate Activity Feed from Completed Match Data
 *
 * Calls the deployed generateLeagueFeed cloud function via HTTPS
 * The function extracts:
 * - Match results
 * - 180s
 * - High tons (140+)
 * - Big checkouts (100+)
 * - Bull checkouts (161+)
 * - High mark rounds (6M+, 9M)
 * - Weekly leaders (3DA, MPR)
 * - Player milestones
 *
 * Writes to: leagues/{leagueId}/feed
 */

const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';  // Winter Triple Draft

// Call v2 callable function
function callCloudFunction(functionName, data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ data });

        const options = {
            hostname: 'us-central1-brdc-v2.cloudfunctions.net',
            port: 443,
            path: `/${functionName}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    if (response.error) {
                        reject(new Error(response.error.message || 'Function error'));
                    } else if (response.result) {
                        resolve(response.result);
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    console.error('Response body:', body);
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('=== BRDC Activity Feed Generator ===\n');
    console.log(`League: ${LEAGUE_ID} (Winter Triple Draft)\n`);
    console.log('Calling generateLeagueFeed cloud function...\n');

    try {
        const result = await callCloudFunction('generateLeagueFeed', {
            league_id: LEAGUE_ID
        });

        console.log('✓ Success!');
        console.log(`  ${result.message}`);
        console.log(`  Items generated: ${result.items_generated}\n`);

        console.log('Feed items written to: leagues/' + LEAGUE_ID + '/feed');
        console.log('\nThe feed includes:');
        console.log('  • Match results');
        console.log('  • 180s (maximums)');
        console.log('  • High scores (140-179)');
        console.log('  • Big checkouts (100+)');
        console.log('  • Bull checkouts (161+)');
        console.log('  • High marks (6M, 7M, 8M, 9M)');
        console.log('  • Bull runs (3B, 5B)');
        console.log('  • Weekly leaders (3DA, MPR)');
        console.log('  • Player milestones');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
