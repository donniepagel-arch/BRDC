/**
 * Find orphaned global player records (no league involvements)
 * These are duplicate registrations that cause empty dashboards
 *
 * Usage: node scripts/find-orphaned-players.js
 */

const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

async function main() {
    console.log('\nScanning global /players/ for orphaned records...\n');

    const globalSnap = await db.collection('players').get();
    const allPlayers = globalSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Group by name (case-insensitive)
    const byName = {};
    for (const p of allPlayers) {
        const key = (p.name || '').toLowerCase().trim();
        if (!byName[key]) byName[key] = [];
        byName[key].push(p);
    }

    // Find duplicates
    const duplicates = Object.entries(byName).filter(([, players]) => players.length > 1);

    console.log(`Total global players: ${allPlayers.length}`);
    console.log(`Players with duplicates: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
        console.log('=== DUPLICATE RECORDS ===\n');
        for (const [name, players] of duplicates) {
            console.log(`Name: "${players[0].name}"`);
            for (const p of players) {
                const hasInvolvements = p.involvements &&
                    ((p.involvements.leagues && p.involvements.leagues.length > 0) ||
                     (p.involvements.tournaments && p.involvements.tournaments.length > 0));
                console.log(`  ID: ${p.id} | PIN: ${p.pin || 'NONE'} | Email: ${p.email || 'NONE'} | Involvements: ${hasInvolvements ? 'YES' : '❌ NONE'}`);
            }
            console.log('');
        }
    }

    // Find all players with no involvements (potential orphans)
    const noInvolvements = allPlayers.filter(p => {
        if (!p.involvements) return true;
        const hasLeague = p.involvements.leagues && p.involvements.leagues.length > 0;
        const hasTournament = p.involvements.tournaments && p.involvements.tournaments.length > 0;
        const hasDirecting = p.involvements.directing && p.involvements.directing.length > 0;
        return !hasLeague && !hasTournament && !hasDirecting;
    });

    console.log(`\n=== ALL PLAYERS WITH NO INVOLVEMENTS (${noInvolvements.length}) ===\n`);
    for (const p of noInvolvements) {
        const isDuplicate = byName[(p.name || '').toLowerCase().trim()]?.length > 1;
        console.log(`${isDuplicate ? '⚠️  DUPLICATE' : '   NEW'} | ${p.id} | ${p.name} | PIN: ${p.pin || 'NONE'} | Email: ${p.email || '(none)'}`);
    }

    // Print specific orphaned IDs to delete
    const orphanedDuplicates = allPlayers.filter(p => {
        const isDuplicate = byName[(p.name || '').toLowerCase().trim()]?.length > 1;
        const hasInvolvements = p.involvements &&
            ((p.involvements.leagues && p.involvements.leagues.length > 0) ||
             (p.involvements.tournaments && p.involvements.tournaments.length > 0));
        return isDuplicate && !hasInvolvements;
    });

    if (orphanedDuplicates.length > 0) {
        console.log(`\n=== SAFE TO DELETE (orphaned duplicates) ===`);
        console.log('These are duplicate records with no involvements. Deleting them will fix empty dashboards.\n');
        for (const p of orphanedDuplicates) {
            console.log(`  DELETE: ${p.id} | ${p.name} | PIN: ${p.pin} | Email: ${p.email || '(none)'}`);
        }
        console.log(`\nTo delete these, run: node scripts/delete-orphaned-players.js`);
    }

    console.log('\nDone.');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
