const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function findPlayers() {
  console.log('=== FINDING CHRISTIAN KETCHEM/KETCHUM AND JOSH KELLY ===\n');
  console.log('League: ' + LEAGUE_ID + '\n');

  // 1. Get ALL players in the league to search by name
  const playersSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('players').get();
  
  console.log('Total players in league: ' + playersSnap.size + '\n');

  const targets = [];
  const allPlayers = [];

  playersSnap.forEach(doc => {
    const data = doc.data();
    const name = (data.name || '').toLowerCase();
    allPlayers.push({ id: doc.id, name: data.name, ...data });

    if (name.includes('ketch') || name.includes('christian')) {
      targets.push({ id: doc.id, data, match: 'Christian Ketchem/Ketchum' });
    }
    if (name.includes('kelly') || name.includes('josh')) {
      targets.push({ id: doc.id, data, match: 'Josh Kelly' });
    }
  });

  if (targets.length === 0) {
    console.log('No matching players found! Listing all players:\n');
    allPlayers.forEach(p => {
      console.log('  ' + p.id + ' -> ' + p.name + ' (team_id: ' + p.team_id + ')');
    });
    process.exit(0);
  }

  // 2. For each found player, show their player doc and check stats
  for (const target of targets) {
    console.log('--- ' + target.match + ' ---');
    console.log('Player ID: ' + target.id);
    console.log('Player document fields:');
    for (const [key, val] of Object.entries(target.data)) {
      const display = typeof val === 'object' && val !== null 
        ? JSON.stringify(val).substring(0, 200) 
        : val;
      console.log('  ' + key + ': ' + display);
    }

    // 3. Check stats document
    console.log('\nChecking stats/' + target.id + '...');
    const statsDoc = await db.collection('leagues').doc(LEAGUE_ID).collection('stats').doc(target.id).get();
    
    if (statsDoc.exists) {
      const statsData = statsDoc.data();
      console.log('Stats document EXISTS. Fields:');
      for (const [key, val] of Object.entries(statsData)) {
        const display = typeof val === 'object' && val !== null 
          ? JSON.stringify(val).substring(0, 300) 
          : val;
        console.log('  ' + key + ': ' + display);
      }
    } else {
      console.log('Stats document DOES NOT EXIST for this player.');
    }

    console.log('');
  }

  // Also check if there are stats docs that DON'T match any player (orphaned)
  console.log('\n--- BONUS: All stats docs in league ---');
  const statsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('stats').get();
  console.log('Total stats documents: ' + statsSnap.size + '\n');
  
  statsSnap.forEach(doc => {
    const player = allPlayers.find(p => p.id === doc.id);
    const playerName = player ? player.name : '(NO MATCHING PLAYER)';
    const data = doc.data();
    const fields = Object.keys(data).join(', ');
    console.log('  ' + doc.id + ' -> ' + playerName + ' [' + fields + ']');
  });

  process.exit(0);
}

findPlayers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
