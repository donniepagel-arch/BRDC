const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Team name to ID mapping
const TEAM_IDS = {
  'D. Pagel': 'U5ZEAT55xiNM9Otarafx',
  'D. Partlo': 'FDk7AdpAiEoDuwN7wxvQ',
  'D. Russano': 'rAbQ8TsEphy7wXYvLv2H',
  'E. O': 'nxsNIQEEvmbhPei5t6s8',
  'J. Ragnoni': 'qFJie5BPOl4tkPb7ImDm',
  'K. Yasenchak': 'oZSTZMxgFNz9Nz206alJ',
  'M. Pagel': 'mgR4e3zldLsM9tAnXmK8',
  'N. Kull': 's9rgmDoXTckL1KmrkV1f',
  'N. Mezlak': 'XYiJFZwkSPID7K3j21dt',
  'neon nightmares': 'HOE5XY3YzHte4WdMNnpu'
};

// Expected standings (for verification)
const EXPECTED_STANDINGS = {
  'K. Yasenchak': { W: 2, L: 1, T: 0, PTS: 4, GW: 14, GL: 10 },
  'M. Pagel': { W: 2, L: 1, T: 0, PTS: 4, GW: 13, GL: 8 },
  'D. Pagel': { W: 2, L: 1, T: 0, PTS: 4, GW: 16, GL: 10 },
  'D. Russano': { W: 2, L: 1, T: 0, PTS: 4, GW: 12, GL: 9 },
  'E. O': { W: 1, L: 0, T: 2, PTS: 4, GW: 13, GL: 10 },
  'N. Mezlak': { W: 1, L: 1, T: 1, PTS: 3, GW: 12, GL: 13 },
  'neon nightmares': { W: 1, L: 2, T: 0, PTS: 2, GW: 9, GL: 18 },
  'J. Ragnoni': { W: 1, L: 1, T: 1, PTS: 3, GW: 12, GL: 11 },
  'N. Kull': { W: 0, L: 3, T: 0, PTS: 0, GW: 6, GL: 18 },
  'D. Partlo': { W: 0, L: 3, T: 0, PTS: 0, GW: 7, GL: 17 }
};

async function fixStandingsAndWinner() {
  console.log('\n=== FIX TEAM STANDINGS AND WINNER FIELDS ===\n');
  
  // Step 1: Read all completed matches
  console.log('STEP 1: Reading completed matches...\n');
  const matchesSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches')
    .where('status', '==', 'completed')
    .get();
  
  console.log(`Found ${matchesSnap.size} completed matches\n`);
  
  if (matchesSnap.empty) {
    console.log('❌ No completed matches found!');
    return;
  }
  
  const matches = [];
  matchesSnap.forEach(doc => {
    matches.push({ id: doc.id, ...doc.data() });
  });
  
  // Step 2: Set winner field on each match
  console.log('STEP 2: Setting winner field on each match...\n');
  const batch = db.batch();
  const matchResults = [];
  
  for (const match of matches) {
    const homeScore = match.home_score || 0;
    const awayScore = match.away_score || 0;
    
    let winner;
    if (homeScore > awayScore) {
      winner = 'home';
    } else if (awayScore > homeScore) {
      winner = 'away';
    } else {
      winner = 'tie';
    }
    
    // Update match document
    const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(match.id);
    batch.update(matchRef, { winner });
    
    matchResults.push({
      week: match.week,
      homeTeam: match.home_team_name,
      awayTeam: match.away_team_name,
      homeScore,
      awayScore,
      winner,
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id
    });
  }
  
  await batch.commit();
  console.log('✓ Updated winner field on all matches\n');
  
  // Step 3: Calculate team standings
  console.log('STEP 3: Calculating team standings...\n');
  const teamStandings = {};
  
  // Initialize all teams
  Object.entries(TEAM_IDS).forEach(([name, id]) => {
    teamStandings[id] = {
      name,
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      games_won: 0,
      games_lost: 0,
      matches_played: 0
    };
  });
  
  // Accumulate stats from matches
  for (const match of matchResults) {
    const homeTeamId = match.homeTeamId;
    const awayTeamId = match.awayTeamId;
    
    if (!teamStandings[homeTeamId] || !teamStandings[awayTeamId]) {
      console.log(`⚠️  Missing team ID: home=${homeTeamId}, away=${awayTeamId}`);
      continue;
    }
    
    // Home team stats
    teamStandings[homeTeamId].matches_played++;
    teamStandings[homeTeamId].games_won += match.homeScore;
    teamStandings[homeTeamId].games_lost += match.awayScore;
    
    if (match.winner === 'home') {
      teamStandings[homeTeamId].wins++;
      teamStandings[homeTeamId].points += 2;
    } else if (match.winner === 'away') {
      teamStandings[homeTeamId].losses++;
    } else {
      teamStandings[homeTeamId].ties++;
      teamStandings[homeTeamId].points += 1;
    }
    
    // Away team stats
    teamStandings[awayTeamId].matches_played++;
    teamStandings[awayTeamId].games_won += match.awayScore;
    teamStandings[awayTeamId].games_lost += match.homeScore;
    
    if (match.winner === 'away') {
      teamStandings[awayTeamId].wins++;
      teamStandings[awayTeamId].points += 2;
    } else if (match.winner === 'home') {
      teamStandings[awayTeamId].losses++;
    } else {
      teamStandings[awayTeamId].ties++;
      teamStandings[awayTeamId].points += 1;
    }
  }
  
  // Step 4: Update team documents
  console.log('STEP 4: Updating team documents...\n');
  const teamBatch = db.batch();
  
  for (const [teamId, stats] of Object.entries(teamStandings)) {
    const teamRef = db.collection('leagues').doc(LEAGUE_ID).collection('teams').doc(teamId);
    teamBatch.update(teamRef, {
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      points: stats.points,
      games_won: stats.games_won,
      games_lost: stats.games_lost,
      matches_played: stats.matches_played
    });
  }
  
  await teamBatch.commit();
  console.log('✓ Updated all team documents\n');
  
  // Step 5: Print verification tables
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('TEAM STANDINGS AFTER UPDATE:\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Sort by points (desc), then games_won (desc)
  const sortedTeams = Object.entries(teamStandings).sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    return b[1].games_won - a[1].games_won;
  });
  
  console.log('Team              | W  | L  | T  | PTS | GW  | GL  | MP');
  console.log('------------------|----|----|----|-----|-----|-----|----');
  
  sortedTeams.forEach(([teamId, stats]) => {
    const name = stats.name.padEnd(16);
    const w = String(stats.wins).padStart(2);
    const l = String(stats.losses).padStart(2);
    const t = String(stats.ties).padStart(2);
    const pts = String(stats.points).padStart(3);
    const gw = String(stats.games_won).padStart(3);
    const gl = String(stats.games_lost).padStart(3);
    const mp = String(stats.matches_played).padStart(2);
    console.log(`${name} | ${w} | ${l} | ${t} | ${pts} | ${gw} | ${gl} | ${mp}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('MATCH WINNER FIELDS:\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const sortedMatches = matchResults.sort((a, b) => a.week - b.week);
  sortedMatches.forEach(match => {
    const result = `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}`;
    const winnerLabel = match.winner === 'home' ? 'home' : match.winner === 'away' ? 'away' : 'tie';
    console.log(`Week ${match.week}: ${result.padEnd(40)} → winner: ${winnerLabel}`);
  });
  
  // Step 6: Verify against expected values
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  console.log('VERIFICATION AGAINST EXPECTED VALUES:\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let mismatches = 0;
  
  for (const [teamId, stats] of Object.entries(teamStandings)) {
    const teamName = stats.name;
    const expected = EXPECTED_STANDINGS[teamName];
    
    if (!expected) {
      console.log(`⚠️  No expected values for ${teamName}`);
      continue;
    }
    
    const matches = 
      stats.wins === expected.W &&
      stats.losses === expected.L &&
      stats.ties === expected.T &&
      stats.points === expected.PTS &&
      stats.games_won === expected.GW &&
      stats.games_lost === expected.GL;
    
    if (matches) {
      console.log(`✓ ${teamName.padEnd(16)} - All values match!`);
    } else {
      console.log(`❌ ${teamName.padEnd(16)} - MISMATCH:`);
      console.log(`   Expected: W=${expected.W} L=${expected.L} T=${expected.T} PTS=${expected.PTS} GW=${expected.GW} GL=${expected.GL}`);
      console.log(`   Got:      W=${stats.wins} L=${stats.losses} T=${stats.ties} PTS=${stats.points} GW=${stats.games_won} GL=${stats.games_lost}`);
      mismatches++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  if (mismatches === 0) {
    console.log('✅ SUCCESS! All standings match expected values.\n');
  } else {
    console.log(`⚠️  WARNING: ${mismatches} team(s) have mismatched standings.\n`);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run the script
fixStandingsAndWinner()
  .then(() => {
    console.log('✓ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
