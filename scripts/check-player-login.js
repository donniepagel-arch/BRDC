/**
 * Diagnostic: Check player data for login issues
 * Usage: node scripts/check-player-login.js "Dom Russano"
 */

const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const searchName = process.argv[2] || 'Dom Russano';

async function main() {
    console.log(`\nSearching for player: "${searchName}"\n`);

    const nameLower = searchName.toLowerCase();

    // ---- 1. Check global /players/ collection ----
    console.log('=== GLOBAL /players/ ===');
    const globalSnap = await db.collection('players').get();
    const globalMatches = globalSnap.docs.filter(d => {
        const name = (d.data().name || '').toLowerCase();
        return name.includes(nameLower) || nameLower.includes(name.split(' ')[0]);
    });

    if (globalMatches.length === 0) {
        console.log('  NOT FOUND in global players');
    } else {
        for (const d of globalMatches) {
            const data = d.data();
            console.log(`  ID: ${d.id}`);
            console.log(`  Name: ${data.name}`);
            console.log(`  PIN: ${data.pin ? '✅ SET (' + data.pin + ')' : '❌ MISSING'}`);
            console.log(`  Email: ${data.email || '(none)'}`);
            console.log(`  Involvements: ${JSON.stringify(data.involvements || {})}`);
            console.log('');
        }
    }

    // ---- 2. Check all league /players/ subcollections ----
    console.log('=== LEAGUE players subcollections ===');
    const leaguesSnap = await db.collection('leagues').get();
    let leagueMatches = [];

    for (const leagueDoc of leaguesSnap.docs) {
        const leagueName = leagueDoc.data().name || leagueDoc.id;
        const playersSnap = await db.collection('leagues').doc(leagueDoc.id).collection('players').get();

        playersSnap.docs.forEach(d => {
            const name = (d.data().name || '').toLowerCase();
            if (name.includes(nameLower) || nameLower.includes(name.split(' ')[0])) {
                leagueMatches.push({
                    leagueId: leagueDoc.id,
                    leagueName,
                    playerId: d.id,
                    data: d.data()
                });
            }
        });
    }

    if (leagueMatches.length === 0) {
        console.log('  NOT FOUND in any league');
    } else {
        for (const m of leagueMatches) {
            console.log(`  League: ${m.leagueName} (${m.leagueId})`);
            console.log(`  Player ID: ${m.playerId}`);
            console.log(`  Name: ${m.data.name}`);
            console.log(`  PIN: ${m.data.pin ? '✅ SET (' + m.data.pin + ')' : '❌ MISSING'}`);
            console.log(`  Team ID: ${m.data.team_id || '(none)'}`);
            console.log(`  Position: ${m.data.position || '(none)'}`);
            console.log('');
        }
    }

    // ---- 3. Check stats collection ----
    if (leagueMatches.length > 0) {
        console.log('=== STATS (league stats collection) ===');
        for (const m of leagueMatches) {
            const statsDoc = await db.collection('leagues').doc(m.leagueId).collection('stats').doc(m.playerId).get();
            if (statsDoc.exists) {
                const s = statsDoc.data();
                console.log(`  ${m.data.name} has stats: x01 legs=${s.x01_legs_played || 0}, cricket legs=${s.cricket_legs_played || 0}`);
            } else {
                console.log(`  ${m.data.name}: NO STATS DOCUMENT`);
            }
        }
    }

    console.log('\nDone.');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
