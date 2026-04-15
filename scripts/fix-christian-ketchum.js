/**
 * Fix Christian Ketchum player records:
 * 1. Rename "Christian Ketchem" -> "Christian Ketchum" on league player 89RkfFLOhvUwV83ZS5J4
 * 2. Delete duplicate league player 0Puu4ha5L5GjrCcQqhKa
 * 3. Fix global player docs if they exist
 */
const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const KEEP_PLAYER_ID = '89RkfFLOhvUwV83ZS5J4';
const DELETE_PLAYER_ID = '0Puu4ha5L5GjrCcQqhKa';
const CORRECT_NAME = 'Christian Ketchum';

async function run() {
  console.log('=== Fix Christian Ketchum Player Records ===\n');

  // --- Step 1: Read current state of both league player docs ---
  console.log('--- Step 1: Reading current league player docs ---');

  const keepRef = db.doc(`leagues/${LEAGUE_ID}/players/${KEEP_PLAYER_ID}`);
  const deleteRef = db.doc(`leagues/${LEAGUE_ID}/players/${DELETE_PLAYER_ID}`);

  const [keepDoc, deleteDoc] = await Promise.all([keepRef.get(), deleteRef.get()]);

  if (keepDoc.exists) {
    console.log(`  KEEP doc (${KEEP_PLAYER_ID}):`, JSON.stringify(keepDoc.data(), null, 2));
  } else {
    console.log(`  KEEP doc (${KEEP_PLAYER_ID}): DOES NOT EXIST`);
  }

  if (deleteDoc.exists) {
    console.log(`  DELETE doc (${DELETE_PLAYER_ID}):`, JSON.stringify(deleteDoc.data(), null, 2));
  } else {
    console.log(`  DELETE doc (${DELETE_PLAYER_ID}): DOES NOT EXIST (already gone)`);
  }

  // --- Step 2: Check stats docs for both ---
  console.log('\n--- Step 2: Checking stats docs ---');

  const keepStatsRef = db.doc(`leagues/${LEAGUE_ID}/stats/${KEEP_PLAYER_ID}`);
  const deleteStatsRef = db.doc(`leagues/${LEAGUE_ID}/stats/${DELETE_PLAYER_ID}`);

  const [keepStats, deleteStats] = await Promise.all([keepStatsRef.get(), deleteStatsRef.get()]);

  if (keepStats.exists) {
    console.log(`  Stats for KEEP (${KEEP_PLAYER_ID}):`, JSON.stringify(keepStats.data(), null, 2));
  } else {
    console.log(`  Stats for KEEP (${KEEP_PLAYER_ID}): NONE`);
  }

  if (deleteStats.exists) {
    console.log(`  Stats for DELETE (${DELETE_PLAYER_ID}):`, JSON.stringify(deleteStats.data(), null, 2));
  } else {
    console.log(`  Stats for DELETE (${DELETE_PLAYER_ID}): NONE`);
  }

  // --- Step 3: Update the name on the KEEP doc ---
  console.log('\n--- Step 3: Updating name on KEEP league player doc ---');

  if (keepDoc.exists) {
    const oldName = keepDoc.data().name;
    await keepRef.update({ name: CORRECT_NAME });
    console.log(`  Updated name: "${oldName}" -> "${CORRECT_NAME}"`);
  } else {
    console.log('  ERROR: KEEP doc does not exist, cannot update!');
  }

  // --- Step 4: Delete the duplicate league player doc ---
  console.log('\n--- Step 4: Deleting duplicate league player doc ---');

  if (deleteDoc.exists) {
    await deleteRef.delete();
    console.log(`  DELETED league player ${DELETE_PLAYER_ID}`);
  } else {
    console.log(`  Already gone, nothing to delete.`);
  }

  // --- Step 5: Delete duplicate stats doc if it exists ---
  console.log('\n--- Step 5: Cleaning up duplicate stats doc ---');

  if (deleteStats.exists) {
    await deleteStatsRef.delete();
    console.log(`  DELETED stats for ${DELETE_PLAYER_ID}`);
  } else {
    console.log(`  No stats doc for duplicate, nothing to delete.`);
  }

  // --- Step 6: Check and fix global player docs ---
  console.log('\n--- Step 6: Checking global player docs ---');

  const globalKeepRef = db.doc(`players/${KEEP_PLAYER_ID}`);
  const globalDeleteRef = db.doc(`players/${DELETE_PLAYER_ID}`);

  const [globalKeep, globalDelete] = await Promise.all([globalKeepRef.get(), globalDeleteRef.get()]);

  if (globalKeep.exists) {
    const globalData = globalKeep.data();
    console.log(`  Global KEEP doc (${KEEP_PLAYER_ID}):`, JSON.stringify(globalData, null, 2));

    // Fix name fields
    const updates = {};
    if (globalData.name && globalData.name !== CORRECT_NAME) {
      updates.name = CORRECT_NAME;
    }
    if (globalData.last_name && globalData.last_name.toLowerCase() === 'ketchem') {
      updates.last_name = 'Ketchum';
    }

    if (Object.keys(updates).length > 0) {
      await globalKeepRef.update(updates);
      console.log(`  Updated global KEEP doc:`, JSON.stringify(updates));
    } else {
      console.log(`  Global KEEP doc name already correct or no name fields to fix.`);
    }
  } else {
    console.log(`  Global KEEP doc (${KEEP_PLAYER_ID}): DOES NOT EXIST`);
  }

  if (globalDelete.exists) {
    const globalDeleteData = globalDelete.data();
    console.log(`  Global DELETE doc (${DELETE_PLAYER_ID}):`, JSON.stringify(globalDeleteData, null, 2));
    await globalDeleteRef.delete();
    console.log(`  DELETED global player ${DELETE_PLAYER_ID}`);
  } else {
    console.log(`  Global DELETE doc (${DELETE_PLAYER_ID}): DOES NOT EXIST (good, nothing to delete)`);
  }

  // --- Step 7: Verify final state ---
  console.log('\n--- Step 7: Verifying final state ---');

  const verifyKeep = await keepRef.get();
  const verifyDelete = await deleteRef.get();
  const verifyGlobalKeep = await globalKeepRef.get();
  const verifyGlobalDelete = await globalDeleteRef.get();

  console.log(`  League player ${KEEP_PLAYER_ID}: ${verifyKeep.exists ? 'EXISTS - name: "' + verifyKeep.data().name + '"' : 'MISSING!'}`);
  console.log(`  League player ${DELETE_PLAYER_ID}: ${verifyDelete.exists ? 'STILL EXISTS (ERROR!)' : 'DELETED (good)'}`);
  console.log(`  Global player ${KEEP_PLAYER_ID}: ${verifyGlobalKeep.exists ? 'EXISTS - name: "' + verifyGlobalKeep.data().name + '"' : 'DOES NOT EXIST'}`);
  console.log(`  Global player ${DELETE_PLAYER_ID}: ${verifyGlobalDelete.exists ? 'STILL EXISTS (ERROR!)' : 'DELETED (good)'}`);

  console.log('\n=== Done ===');
  process.exit(0);
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
