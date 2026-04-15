/**
 * Create a test user for Fiverr/Upwork testing
 * This user has NO league involvements, so no dashboard access
 * Can only access the scorer functionality
 *
 * SETUP: Download service account key from Firebase Console first:
 *   1. Go to: https://console.firebase.google.com/project/brdc-v2/settings/serviceaccounts/adminsdk
 *   2. Click "Generate new private key"
 *   3. Save as: C:\Users\gcfrp\projects\brdc-firebase\service-account.json
 *   4. Add to .gitignore (should already be there)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Check for service account key
const serviceAccountPath = path.join(__dirname, '../service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found!');
    console.error('\n📥 Download it from Firebase Console:');
    console.error('   1. Go to: https://console.firebase.google.com/project/brdc-v2/settings/serviceaccounts/adminsdk');
    console.error('   2. Click "Generate new private key"');
    console.error('   3. Save as: C:\\Users\\gcfrp\\projects\\brdc-firebase\\service-account.json');
    console.error('   4. Run this script again');
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestUser() {
    try {
        // Test user details
        const testUserData = {
            name: 'Test User',
            first_name: 'Test',
            last_name: 'User',
            email: 'testuser@example.com',
            phone: '5555555555',  // Fake phone number
            phone_last4: '5555',
            pin: '12345678',  // Simple PIN for testing
            photo_url: null,
            isBot: false,
            notification_preference: 'none',  // No notifications
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            stats: {
                matches_played: 0,
                matches_won: 0,
                x01: {
                    legs_played: 0,
                    legs_won: 0,
                    total_points: 0,
                    total_darts: 0,
                    ton_eighties: 0,
                    high_checkout: 0
                },
                cricket: {
                    legs_played: 0,
                    legs_won: 0,
                    total_marks: 0,
                    total_rounds: 0
                }
            },
            // IMPORTANT: Empty involvements = NO dashboard access
            involvements: {
                leagues: [],      // Not in any leagues
                tournaments: [],  // Not in any tournaments
                directing: [],    // Not directing anything
                captaining: []    // Not captain of anything
            }
        };

        // Check if test user already exists
        const existingUser = await db.collection('players')
            .where('pin', '==', '12345678')
            .limit(1)
            .get();

        if (!existingUser.empty) {
            const existingId = existingUser.docs[0].id;
            console.log('❌ Test user already exists!');
            console.log(`   User ID: ${existingId}`);
            console.log('   PIN: 12345678');
            console.log('\nTo use this user, share:');
            console.log('   - URL: https://brdc-v2.web.app/scorer');
            console.log('   - PIN: 12345678');
            console.log('\nTo delete and recreate, run:');
            console.log(`   firebase firestore:delete players/${existingId}`);
            process.exit(0);
        }

        // Create the test user
        const playerRef = await db.collection('players').add(testUserData);

        console.log('✅ Test user created successfully!');
        console.log('\n📋 Test User Details:');
        console.log('   User ID:', playerRef.id);
        console.log('   Name: Test User');
        console.log('   Email: testuser@example.com');
        console.log('   Phone: 555-555-5555');
        console.log('   PIN: 12345678');
        console.log('\n🔒 Access Restrictions:');
        console.log('   ✓ Can access scorer: /scorer');
        console.log('   ✗ NO dashboard access (not in any leagues)');
        console.log('   ✗ NO admin access');
        console.log('   ✗ NO league data access');
        console.log('\n🔗 Share with tester:');
        console.log('   URL: https://brdc-v2.web.app/scorer');
        console.log('   PIN: 12345678');
        console.log('\n⚠️  To remove this user later, run:');
        console.log(`   firebase firestore:delete players/${playerRef.id}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating test user:', error);
        process.exit(1);
    }
}

createTestUser();
