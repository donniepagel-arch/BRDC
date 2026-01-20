const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkPlayer() {
  // Find player by PIN
  const playerSnap = await db.collection('players')
    .where('pin', '==', '39632911')
    .limit(1)
    .get();

  if (playerSnap.empty) {
    console.log('Player not found in global players collection');
    return;
  }

  const playerDoc = playerSnap.docs[0];
  const player = playerDoc.data();

  console.log('=== GLOBAL PLAYER RECORD ===');
  console.log('ID:', playerDoc.id);
  console.log('Name:', player.name);
  console.log('isAdmin:', player.isAdmin);
  console.log('PIN:', player.pin);
  console.log('');
  console.log('=== INVOLVEMENTS ===');
  console.log(JSON.stringify(player.involvements, null, 2));
  console.log('');
  console.log('=== STATS ===');
  console.log(JSON.stringify(player.stats, null, 2));
  console.log('');

  // Check league players
  console.log('=== SEARCHING LEAGUES ===');
  const leaguesSnap = await db.collection('leagues').get();

  for (const leagueDoc of leaguesSnap.docs) {
    const leaguePlayersSnap = await db.collection('leagues')
      .doc(leagueDoc.id)
      .collection('players')
      .where('name', '==', player.name)
      .limit(1)
      .get();

    if (!leaguePlayersSnap.empty) {
      const lp = leaguePlayersSnap.docs[0].data();
      console.log('Found in league:', leagueDoc.id);
      console.log('League player name:', lp.name);
      console.log('League player unified_stats:', JSON.stringify(lp.unified_stats, null, 2));
      console.log('League player stats:', JSON.stringify(lp.stats, null, 2));
    }
  }

  process.exit(0);
}

checkPlayer().catch(e => { console.error(e); process.exit(1); });
