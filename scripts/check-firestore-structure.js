const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = 'sgmoL4GyVUYP67aOS7wm'; // Pagel v Pagel

async function checkStructure() {
  console.log('=== CHECKING FIRESTORE DATA STRUCTURE ===\n');
  console.log(`Match: ${MATCH_ID}\n`);
  
  const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(MATCH_ID);
  const matchDoc = await matchRef.get();
  
  if (!matchDoc.exists) {
    console.log('❌ Match not found!');
    process.exit(1);
  }
  
  const matchData = matchDoc.data();
  
  console.log('Match-level fields:');
  console.log(`  home_team_name: ${matchData.home_team_name}`);
  console.log(`  away_team_name: ${matchData.away_team_name}`);
  console.log(`  home_score: ${matchData.home_score}`);
  console.log(`  away_score: ${matchData.away_score}`);
  console.log(`  winner: ${matchData.winner}`);
  console.log(`  status: ${matchData.status}`);
  console.log(`  games array length: ${(matchData.games || []).length}\n`);
  
  if (!matchData.games || matchData.games.length === 0) {
    console.log('❌ No games array!');
    process.exit(1);
  }
  
  console.log('First 3 games structure:\n');
  
  matchData.games.slice(0, 3).forEach((game, idx) => {
    console.log(`Game ${idx + 1}:`);
    console.log(`  set: ${game.set}`);
    console.log(`  game_number: ${game.game || game.game_number}`);
    console.log(`  format: ${game.format}`);
    console.log(`  type: ${game.type}`);
    console.log(`  winner: ${game.winner}`);
    console.log(`  home_legs_won: ${game.home_legs_won}`);
    console.log(`  away_legs_won: ${game.away_legs_won}`);
    console.log(`  home_players: ${JSON.stringify(game.home_players)}`);
    console.log(`  away_players: ${JSON.stringify(game.away_players)}`);
    console.log(`  legs: ${(game.legs || []).length} legs`);
    if (game.legs && game.legs.length > 0) {
      console.log(`    Leg 1: format=${game.legs[0].format}, winner=${game.legs[0].winner}`);
    }
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════════════');
  console.log('SUMMARY:\n');
  
  // Check if all games have valid leg counts
  let validCount = 0;
  let invalidCount = 0;
  
  matchData.games.forEach((game, idx) => {
    const homeLegs = game.home_legs_won || 0;
    const awayLegs = game.away_legs_won || 0;
    const isValid = (homeLegs === 2 && (awayLegs === 0 || awayLegs === 1)) ||
                   (awayLegs === 2 && (homeLegs === 0 || homeLegs === 1));
    
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
      console.log(`❌ Game ${idx + 1}: ${homeLegs}-${awayLegs} (INVALID)`);
    }
  });
  
  if (invalidCount === 0) {
    console.log(`✅ All ${validCount} games have valid leg counts`);
  } else {
    console.log(`⚠️  ${invalidCount} games have invalid leg counts`);
  }
}

checkStructure()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
