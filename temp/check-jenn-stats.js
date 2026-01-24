const admin = require('firebase-admin');

// Initialize Firebase Admin using Application Default Credentials
admin.initializeApp({
    projectId: 'brdc-v2'
});

const db = admin.firestore();
const leagueId = 'monday-hdcp-spring-2026';

async function checkJennStats() {
  console.log('=== Checking Jenn\'s data structure ===\n');

  // 1. Find Jenn in players collection
  console.log('1. Searching players collection for "Jenn"...');
  const playersSnap = await db.collection('leagues').doc(leagueId).collection('players').get();

  let jennPlayer = null;
  let allPlayers = [];
  playersSnap.forEach(doc => {
    const data = doc.data();
    const firstName = data.first_name || '';
    const lastName = data.last_name || '';
    const name = data.name || data.player_name || (firstName + ' ' + lastName).trim();
    allPlayers.push({ id: doc.id, name: name });
    if (name.toLowerCase().includes('jenn')) {
      jennPlayer = { id: doc.id, ...data };
      console.log('   Found: ' + name + ' (ID: ' + doc.id + ')');
      console.log('   Player doc data:', JSON.stringify(data, null, 2));
    }
  });

  if (!jennPlayer) {
    console.log('   Jenn not found in players collection!');
    console.log('   All players:');
    allPlayers.forEach(p => console.log('   - ' + p.id + ': ' + p.name));
    process.exit(1);
  }

  // 2. Check aggregated_stats for Jenn's ID
  console.log('\n2. Checking aggregated_stats collection...');
  const aggStatsDoc = await db.collection('leagues').doc(leagueId).collection('aggregated_stats').doc(jennPlayer.id).get();
  if (aggStatsDoc.exists) {
    console.log('   Found aggregated_stats for ' + jennPlayer.id + ':', JSON.stringify(aggStatsDoc.data(), null, 2));
  } else {
    console.log('   NO aggregated_stats found for ID: ' + jennPlayer.id);

    // List all aggregated_stats docs to see what IDs exist
    console.log('\n   Listing ALL aggregated_stats docs:');
    const allAggStats = await db.collection('leagues').doc(leagueId).collection('aggregated_stats').get();
    allAggStats.forEach(doc => {
      const data = doc.data();
      const playerName = data.player_name || 'no name';
      console.log('   - ' + doc.id + ': ' + playerName + ' (3DA: ' + data.x01_three_dart_avg + ', MPR: ' + data.cricket_mpr + ')');
    });
  }

  // 3. Check stats collection (fallback)
  console.log('\n3. Checking stats collection (fallback)...');
  const statsDoc = await db.collection('leagues').doc(leagueId).collection('stats').doc(jennPlayer.id).get();
  if (statsDoc.exists) {
    console.log('   Found stats for ' + jennPlayer.id + ':', JSON.stringify(statsDoc.data(), null, 2));
  } else {
    console.log('   NO stats found for ID: ' + jennPlayer.id);
  }

  // 4. Check Week 1 match data for Jenn's name
  console.log('\n4. Checking Week 1 match data...');
  const matchesSnap = await db.collection('leagues').doc(leagueId).collection('matches')
    .where('week', '==', 1)
    .get();

  matchesSnap.forEach(doc => {
    const data = doc.data();
    console.log('   Match ' + doc.id + ': ' + data.home_team_id + ' vs ' + data.away_team_id);
    if (data.games && Array.isArray(data.games)) {
      data.games.forEach((game, i) => {
        const homePlayers = game.home_players || [];
        const awayPlayers = game.away_players || [];
        const allPlayers = homePlayers.concat(awayPlayers);
        const hasJenn = allPlayers.some(p => p && p.toLowerCase().includes('jenn'));
        if (hasJenn) {
          console.log('   Game ' + i + ': home_players=' + JSON.stringify(homePlayers) + ', away_players=' + JSON.stringify(awayPlayers));
        }
      });
    }
  });

  // 5. Check if Jenn's team is in Week 1
  console.log('\n5. Checking Jenn\'s team assignment...');
  console.log('   Jenn team_id: ' + jennPlayer.team_id);

  process.exit(0);
}

checkJennStats().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
