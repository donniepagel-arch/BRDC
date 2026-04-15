/**
 * Delete orphaned duplicate global player records
 * These have no league involvements and are causing empty dashboards
 *
 * Safe to delete: verified these are duplicates where the sibling record
 * has proper involvements and the correct email.
 */

const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
    process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

// These orphaned records have no involvements and are duplicates.
// The sibling record (with involvements) has been verified as the active one.
const ORPHANED_IDS = [
    { id: 'GgsAvh9rVEbB0sEsaXRV', name: 'Dominick Russano', pin: '26594366', note: 'typo email .con, no involvements' },
    { id: 'XcD6cNbbM5wDMfWoCiuS', name: 'Danny Russano', pin: '77609203', note: 'no involvements, duplicate PIN' }
];

async function main() {
    console.log('Deleting orphaned duplicate player records...\n');

    for (const record of ORPHANED_IDS) {
        // Double-check: confirm the record still has no involvements before deleting
        const doc = await db.collection('players').doc(record.id).get();
        if (!doc.exists) {
            console.log(`  SKIP: ${record.name} (${record.id}) - already deleted`);
            continue;
        }

        const data = doc.data();
        const hasInvolvements = data.involvements &&
            ((data.involvements.leagues && data.involvements.leagues.length > 0) ||
             (data.involvements.tournaments && data.involvements.tournaments.length > 0));

        if (hasInvolvements) {
            console.log(`  SKIP: ${record.name} (${record.id}) - NOW HAS INVOLVEMENTS, skipping to be safe`);
            continue;
        }

        await db.collection('players').doc(record.id).delete();
        console.log(`  DELETED: ${record.name} | ID: ${record.id} | PIN: ${record.pin} | (${record.note})`);
    }

    // Also clear any login_attempts for the deleted PINs (so they don't linger)
    for (const record of ORPHANED_IDS) {
        await db.collection('login_attempts').doc(record.pin).delete().catch(() => {});
    }

    console.log('\nDone. Orphaned records deleted.');
    console.log('\nNOTE: Players who were using the old PINs will need their correct PIN:');
    console.log('  Dominick Russano: correct PIN is 26597190');
    console.log('  Danny Russano:    correct PIN is 77601105');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
