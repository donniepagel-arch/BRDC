/**
 * migrate-to-firebase-auth.js
 *
 * One-time migration script: creates Firebase Auth accounts for all existing
 * players and links them to their Firestore player documents via firebase_uid.
 *
 * Prerequisites:
 * 1. Firebase Console → Authentication → Sign-in methods → Email/Password → ENABLED
 * 2. Service account key at: functions/service-account-key.json
 *    (Download from Firebase Console → Project Settings → Service Accounts)
 * 3. Fix Dom Russano's email typo in Firestore BEFORE running this script
 *
 * Usage:
 *   node scripts/migrate-to-firebase-auth.js
 *
 * Options:
 *   --dry-run    Preview what would happen without making changes
 *   --send-emails  Send password reset emails to all migrated players
 *   --player-id=X  Process only one specific player (for testing/retry)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../functions/service-account-key.json');
const DRY_RUN = process.argv.includes('--dry-run');
const SEND_EMAILS = process.argv.includes('--send-emails');
const SINGLE_PLAYER = process.argv.find(a => a.startsWith('--player-id='))?.split('=')[1];

// Known email issues to warn about (fix these in Firestore first)
const KNOWN_BAD_EMAILS = {
    'dom.russano': 'Check Dom Russano\'s email - may have .com typo in domain'
};

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`\n❌ Service account key not found at: ${SERVICE_ACCOUNT_PATH}`);
    console.error('Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key');
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    // Basic email regex - catches obvious issues like missing TLD
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function sanitizeEmail(email) {
    return email?.trim().toLowerCase() || '';
}

async function sendPasswordResetEmail(email) {
    // Use Firebase Auth REST API to send password reset
    // The admin SDK doesn't have sendPasswordResetEmail, but we can generate the link
    try {
        const link = await auth.generatePasswordResetLink(email, {
            url: 'https://brdc-v2.web.app/pages/dashboard.html'
        });
        console.log(`  📧 Reset link for ${email}: ${link}`);
        // TODO: If you have an email sending function, call it here
        // For now, links are logged so you can send them manually or via SendGrid/etc.
        return true;
    } catch (err) {
        console.error(`  ❌ Failed to generate reset link for ${email}: ${err.message}`);
        return false;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    console.log('\n' + '═'.repeat(60));
    console.log('  Firebase Auth Migration Script');
    console.log('  BRDC League Platform');
    console.log('═'.repeat(60));

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN MODE — No changes will be made\n');
    }

    // Fetch all players
    let playersQuery = db.collection('players');
    if (SINGLE_PLAYER) {
        console.log(`\n🔍 Processing single player: ${SINGLE_PLAYER}`);
        playersQuery = playersQuery.where(admin.firestore.FieldPath.documentId(), '==', SINGLE_PLAYER);
    }

    const playersSnap = await playersQuery.get();
    console.log(`\n📋 Found ${playersSnap.size} player(s) to process\n`);

    const results = {
        created: [],
        already_linked: [],
        skipped_no_email: [],
        skipped_bad_email: [],
        errors: [],
        duplicate_emails: []
    };

    // Process each player
    for (const playerDoc of playersSnap.docs) {
        const player = { id: playerDoc.id, ...playerDoc.data() };
        const name = player.name || player.first_name + ' ' + player.last_name || 'Unknown';
        const rawEmail = player.email;

        process.stdout.write(`Processing: ${name} (${player.id})... `);

        // Skip if already has firebase_uid
        if (player.firebase_uid) {
            console.log(`✅ Already linked (uid: ${player.firebase_uid})`);
            results.already_linked.push({ id: player.id, name, uid: player.firebase_uid });
            continue;
        }

        // Skip bots
        if (player.is_bot) {
            console.log(`⏭️  Skipped (bot)`);
            continue;
        }

        // Check email
        if (!rawEmail) {
            console.log(`⚠️  No email`);
            results.skipped_no_email.push({ id: player.id, name });
            continue;
        }

        const email = sanitizeEmail(rawEmail);

        if (!isValidEmail(email)) {
            console.log(`❌ Invalid email: "${rawEmail}"`);
            results.skipped_bad_email.push({ id: player.id, name, email: rawEmail });
            continue;
        }

        // Check for known bad emails
        const emailLocal = email.split('@')[0];
        for (const [pattern, warning] of Object.entries(KNOWN_BAD_EMAILS)) {
            if (emailLocal.includes(pattern)) {
                console.log(`⚠️  Warning: ${warning}`);
            }
        }

        if (DRY_RUN) {
            console.log(`[DRY RUN] Would create Firebase Auth for: ${email}`);
            results.created.push({ id: player.id, name, email });
            continue;
        }

        // Create Firebase Auth user
        try {
            let userRecord;

            // Check if user already exists in Firebase Auth (by email)
            try {
                userRecord = await auth.getUserByEmail(email);
                console.log(`\n  ℹ️  Firebase Auth user already exists for ${email}, linking...`);
            } catch (notFoundErr) {
                if (notFoundErr.code === 'auth/user-not-found') {
                    // Create new user - no password set, they'll use password reset to set one
                    userRecord = await auth.createUser({
                        email: email,
                        displayName: name,
                        emailVerified: false
                        // No password - user must use "Forgot Password" to set one
                    });
                    console.log(`✅ Created (uid: ${userRecord.uid})`);
                } else {
                    throw notFoundErr;
                }
            }

            // Update player doc with firebase_uid
            await playerDoc.ref.update({
                firebase_uid: userRecord.uid,
                email: email  // Normalize email in Firestore too
            });

            results.created.push({ id: player.id, name, email, uid: userRecord.uid });

            // Send password reset email if requested
            if (SEND_EMAILS) {
                await sendPasswordResetEmail(email);
            }

        } catch (err) {
            if (err.code === 'auth/email-already-exists') {
                // Multiple players with same email? Log as duplicate
                console.log(`⚠️  Duplicate email in Firebase Auth: ${email}`);
                results.duplicate_emails.push({ id: player.id, name, email });

                // Try to link anyway by looking up the existing uid
                try {
                    const existing = await auth.getUserByEmail(email);
                    await playerDoc.ref.update({ firebase_uid: existing.uid });
                    console.log(`  ↩️  Linked to existing uid: ${existing.uid}`);
                } catch (linkErr) {
                    console.error(`  ❌ Failed to link to existing: ${linkErr.message}`);
                }
            } else {
                console.log(`❌ Error: ${err.message}`);
                results.errors.push({ id: player.id, name, email, error: err.message });
            }
        }
    }

    // ─── Summary ──────────────────────────────────────────────────────────────

    console.log('\n' + '═'.repeat(60));
    console.log('  MIGRATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n✅ Created/linked: ${results.created.length}`);
    console.log(`✅ Already linked: ${results.already_linked.length}`);
    console.log(`⚠️  No email:       ${results.skipped_no_email.length}`);
    console.log(`❌ Bad email:       ${results.skipped_bad_email.length}`);
    console.log(`⚠️  Duplicate email:${results.duplicate_emails.length}`);
    console.log(`❌ Errors:          ${results.errors.length}`);

    if (results.skipped_no_email.length > 0) {
        console.log('\n📋 Players with no email (need manual attention):');
        results.skipped_no_email.forEach(p => console.log(`   - ${p.name} (${p.id})`));
    }

    if (results.skipped_bad_email.length > 0) {
        console.log('\n📋 Players with invalid email (fix in Firestore and re-run):');
        results.skipped_bad_email.forEach(p => console.log(`   - ${p.name} (${p.id}): "${p.email}"`));
    }

    if (results.duplicate_emails.length > 0) {
        console.log('\n📋 Duplicate emails (multiple players sharing same email):');
        results.duplicate_emails.forEach(p => console.log(`   - ${p.name} (${p.id}): ${p.email}`));
    }

    if (results.errors.length > 0) {
        console.log('\n📋 Errors (need investigation):');
        results.errors.forEach(p => console.log(`   - ${p.name} (${p.id}): ${p.error}`));
    }

    if (!SEND_EMAILS && !DRY_RUN && results.created.length > 0) {
        console.log('\n' + '─'.repeat(60));
        console.log('💡 Next step: Send password reset emails to all migrated players');
        console.log('   Run: node scripts/migrate-to-firebase-auth.js --send-emails');
        console.log('   Or manually notify players to use "Forgot Password" on the login page');
    }

    if (DRY_RUN) {
        console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.');
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    process.exit(results.errors.length > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
});
