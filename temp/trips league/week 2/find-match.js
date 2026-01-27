const admin = require('firebase-admin');
const serviceAccount = require('../../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findMatch() {
  try {
    const leagueId = 'aOq4Y0ETxPZ66tM1uUtP';
    
    // Query matches for week 2
    const matchesSnapshot = await db
      .collection('leagues')
      .doc(leagueId)
      .collection('matches')
      .where('week', '==', 2)
      .get();
    
    console.log('Week 2 Matches Found:');
    console.log('====================\n');
    
    matchesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log('Match ID:', doc.id);
      console.log('Home Team:', data.home_team_name || 'N/A');
      console.log('Away Team:', data.away_team_name || 'N/A');
      console.log('Date:', data.match_date || 'N/A');
      console.log('Week:', data.week);
      console.log('---\n');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findMatch();
