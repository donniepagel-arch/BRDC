/**
 * Add Alternates Script
 *
 * Adds Luke Kollias as a new player and marks all alternates as is_sub: true
 *
 * Usage: node scripts/add-alternates.js <admin_pin>
 */

const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Alternates to mark as subs (already exist in league)
const EXISTING_ALTERNATES = [
    { id: 'vVR4AOITXYzhR2H4GqzI', name: 'Derek Fess' },
    { id: '34GDgRRFk0uFmOvyykHE', name: 'Josh Kelly' },
    { id: '89RkfFLOhvUwV83ZS5J4', name: 'Christian Ketchem' }
];

// New player to add
const NEW_PLAYER = {
    name: 'Luke Kollias',
    email: '',  // Add if known
    phone: '',  // Add if known
    skill_level: 'intermediate',
    preferred_level: 'C'
};

function postToFunction(url, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${responseData.substring(0, 500)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    const adminPin = process.argv[2];

    if (!adminPin) {
        console.error('Usage: node scripts/add-alternates.js <admin_pin>');
        process.exit(1);
    }

    console.log('=== ADDING ALTERNATES ===\n');

    try {
        // 1. Add Luke Kollias as new player
        console.log('1. Adding Luke Kollias as new player...');
        const addPlayerUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/addPlayer';
        const addResult = await postToFunction(addPlayerUrl, {
            league_id: LEAGUE_ID,
            admin_pin: adminPin,
            name: NEW_PLAYER.name,
            email: NEW_PLAYER.email,
            phone: NEW_PLAYER.phone,
            skill_level: NEW_PLAYER.skill_level,
            preferred_level: NEW_PLAYER.preferred_level
        });

        if (addResult.success) {
            console.log(`   Added Luke Kollias with ID: ${addResult.player_id}`);
            console.log(`   Player PIN: ${addResult.player_pin}`);
            console.log('\n   IMPORTANT: Add this to import-matches.js PLAYER_IDS mapping:');
            console.log(`   'Luke Kollias': '${addResult.player_id}',\n`);
        } else {
            console.log(`   Failed to add: ${addResult.error}`);
        }

        // 2. Mark existing alternates as subs
        console.log('2. Marking existing alternates as subs...');
        const updatePlayerUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updatePlayer';

        for (const alt of EXISTING_ALTERNATES) {
            const updateResult = await postToFunction(updatePlayerUrl, {
                league_id: LEAGUE_ID,
                admin_pin: adminPin,
                player_id: alt.id,
                is_sub: true
            });

            if (updateResult.success) {
                console.log(`   Marked ${alt.name} as sub`);
            } else {
                console.log(`   Failed to update ${alt.name}: ${updateResult.error}`);
            }
        }

        // 3. Mark Luke as sub too (if successfully added)
        if (addResult.success) {
            const updateLukeResult = await postToFunction(updatePlayerUrl, {
                league_id: LEAGUE_ID,
                admin_pin: adminPin,
                player_id: addResult.player_id,
                is_sub: true
            });

            if (updateLukeResult.success) {
                console.log(`   Marked Luke Kollias as sub`);
            } else {
                console.log(`   Failed to update Luke Kollias: ${updateLukeResult.error}`);
            }
        }

        console.log('\n=== COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);
