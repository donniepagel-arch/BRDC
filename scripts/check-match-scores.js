const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function checkMatchScores() {
  console.log('\n=== CHECKING ACTUAL MATCH SCORES IN FIRESTORE ===\n');
  
  const matchesSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches')
    .where('status', '==', 'completed')
    .get();
  
  const matches = [];
  matchesSnap.forEach(doc => {
    const data = doc.data();
    matches.push({
      id: doc.id,
      week: data.week,
      homeTeam: data.home_team_name,
      awayTeam: data.away_team_name,
      homeScore: data.home_score,
      awayScore: data.away_score,
      gameCount: (data.games || []).length,
      games: data.games || []
    });
  });
  
  // Sort by week
  matches.sort((a, b) => a.week - b.week);
  
  console.log('Week | Match                              | Score | Games Array | Calculated Score');
  console.log('-----|------------------------------------| ------|-------------|------------------');
  
  for (const match of matches) {
    const matchStr = `${match.homeTeam} vs ${match.awayTeam}`.padEnd(34);
    const scoreStr = `${match.homeScore}-${match.awayScore}`.padEnd(5);
    
    // Calculate score from games array
    let homeWins = 0;
    let awayWins = 0;
    
    match.games.forEach(game => {
      if (game.home_legs_won > game.away_legs_won) homeWins++;
      else if (game.away_legs_won > game.home_legs_won) awayWins++;
    });
    
    const calculatedStr = `${homeWins}-${awayWins}`;
    const mismatch = (homeWins !== match.homeScore || awayWins !== match.awayScore) ? ' ❌ MISMATCH' : '';
    
    console.log(`  ${match.week}  | ${matchStr} | ${scoreStr} | ${match.gameCount} games   | ${calculatedStr}${mismatch}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('Checking individual game set winners...\n');
  
  for (const match of matches) {
    console.log(`\nWeek ${match.week}: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`);
    console.log('─────────────────────────────────────────────────────────────');
    
    match.games.forEach((game, idx) => {
      const setNum = game.set || (idx + 1);
      const homeLegs = game.home_legs_won || 0;
      const awayLegs = game.away_legs_won || 0;
      const setWinner = homeLegs > awayLegs ? 'HOME' : awayLegs > homeLegs ? 'AWAY' : 'TIE';
      
      console.log(`  Set ${setNum}: ${homeLegs}-${awayLegs} (${setWinner})`);
    });
  }
  
  console.log('\n');
}

checkMatchScores()
  .then(() => {
    console.log('✓ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
