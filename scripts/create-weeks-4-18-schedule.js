const admin = require('firebase-admin');
const path = require('path');

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Team name to Firestore ID mapping
const TEAMS = {
  'E. O': 'nxsNIQEEvmbhPei5t6s8',
  'D. Partlo': 'FDk7AdpAiEoDuwN7wxvQ',
  'N. Mezlak': 'XYiJFZwkSPID7K3j21dt',
  'D. Russano': 'rAbQ8TsEphy7wXYvLv2H',
  'J. Ragnoni': 'qFJie5BPOl4tkPb7ImDm',
  'neon nightmares': 'HOE5XY3YzHte4WdMNnpu',
  'M. Pagel': 'mgR4e3zldLsM9tAnXmK8',
  'D. Pagel': 'U5ZEAT55xiNM9Otarafx',
  'N. Kull': 's9rgmDoXTckL1KmrkV1f',
  'K. Yasenchak': 'oZSTZMxgFNz9Nz206alJ'
};

// Full 18-week schedule (rounds 1-18, 5 matches each)
const SCHEDULE = [
  // Round 1 - already imported
  { round: 1, matches: [
    ['E. O', 'D. Partlo'], ['N. Mezlak', 'D. Russano'], ['J. Ragnoni', 'neon nightmares'], 
    ['M. Pagel', 'D. Pagel'], ['N. Kull', 'K. Yasenchak']
  ]},
  // Round 2 - already imported
  { round: 2, matches: [
    ['neon nightmares', 'K. Yasenchak'], ['D. Russano', 'J. Ragnoni'], ['D. Pagel', 'N. Kull'],
    ['E. O', 'N. Mezlak'], ['D. Partlo', 'M. Pagel']
  ]},
  // Round 3 - already imported
  { round: 3, matches: [
    ['N. Kull', 'neon nightmares'], ['N. Mezlak', 'M. Pagel'], ['K. Yasenchak', 'D. Russano'],
    ['J. Ragnoni', 'E. O'], ['D. Pagel', 'D. Partlo']
  ]},
  // Round 4 - NEED TO CREATE
  { round: 4, matches: [
    ['D. Pagel', 'N. Mezlak'], ['D. Partlo', 'N. Kull'], ['E. O', 'K. Yasenchak'],
    ['D. Russano', 'neon nightmares'], ['M. Pagel', 'J. Ragnoni']
  ]},
  // Round 5
  { round: 5, matches: [
    ['J. Ragnoni', 'D. Pagel'], ['N. Mezlak', 'D. Partlo'], ['N. Kull', 'D. Russano'],
    ['K. Yasenchak', 'M. Pagel'], ['neon nightmares', 'E. O']
  ]},
  // Round 6
  { round: 6, matches: [
    ['D. Partlo', 'J. Ragnoni'], ['D. Pagel', 'K. Yasenchak'], ['M. Pagel', 'neon nightmares'],
    ['E. O', 'D. Russano'], ['N. Mezlak', 'N. Kull']
  ]},
  // Round 7
  { round: 7, matches: [
    ['N. Kull', 'E. O'], ['D. Russano', 'M. Pagel'], ['K. Yasenchak', 'D. Partlo'],
    ['J. Ragnoni', 'N. Mezlak'], ['neon nightmares', 'D. Pagel']
  ]},
  // Round 8
  { round: 8, matches: [
    ['D. Partlo', 'neon nightmares'], ['N. Mezlak', 'K. Yasenchak'], ['J. Ragnoni', 'N. Kull'],
    ['D. Pagel', 'D. Russano'], ['M. Pagel', 'E. O']
  ]},
  // Round 9
  { round: 9, matches: [
    ['K. Yasenchak', 'J. Ragnoni'], ['neon nightmares', 'N. Mezlak'], ['E. O', 'D. Pagel'],
    ['N. Kull', 'M. Pagel'], ['D. Russano', 'D. Partlo']
  ]},
  // Round 10
  { round: 10, matches: [
    ['neon nightmares', 'J. Ragnoni'], ['D. Pagel', 'M. Pagel'], ['D. Partlo', 'E. O'],
    ['K. Yasenchak', 'N. Kull'], ['D. Russano', 'N. Mezlak']
  ]},
  // Round 11
  { round: 11, matches: [
    ['N. Kull', 'D. Pagel'], ['N. Mezlak', 'E. O'], ['K. Yasenchak', 'neon nightmares'],
    ['M. Pagel', 'D. Partlo'], ['J. Ragnoni', 'D. Russano']
  ]},
  // Round 12
  { round: 12, matches: [
    ['E. O', 'J. Ragnoni'], ['D. Russano', 'K. Yasenchak'], ['neon nightmares', 'N. Kull'],
    ['M. Pagel', 'N. Mezlak'], ['D. Partlo', 'D. Pagel']
  ]},
  // Round 13
  { round: 13, matches: [
    ['N. Kull', 'D. Partlo'], ['N. Mezlak', 'D. Pagel'], ['K. Yasenchak', 'E. O'],
    ['neon nightmares', 'D. Russano'], ['J. Ragnoni', 'M. Pagel']
  ]},
  // Round 14
  { round: 14, matches: [
    ['D. Partlo', 'N. Mezlak'], ['M. Pagel', 'K. Yasenchak'], ['D. Russano', 'N. Kull'],
    ['D. Pagel', 'J. Ragnoni'], ['E. O', 'neon nightmares']
  ]},
  // Round 15
  { round: 15, matches: [
    ['J. Ragnoni', 'D. Partlo'], ['neon nightmares', 'M. Pagel'], ['D. Russano', 'E. O'],
    ['K. Yasenchak', 'D. Pagel'], ['N. Kull', 'N. Mezlak']
  ]},
  // Round 16
  { round: 16, matches: [
    ['E. O', 'N. Kull'], ['D. Partlo', 'K. Yasenchak'], ['N. Mezlak', 'J. Ragnoni'],
    ['M. Pagel', 'D. Russano'], ['D. Pagel', 'neon nightmares']
  ]},
  // Round 17
  { round: 17, matches: [
    ['N. Kull', 'J. Ragnoni'], ['neon nightmares', 'D. Partlo'], ['D. Russano', 'D. Pagel'],
    ['E. O', 'M. Pagel'], ['K. Yasenchak', 'N. Mezlak']
  ]},
  // Round 18
  { round: 18, matches: [
    ['M. Pagel', 'N. Kull'], ['J. Ragnoni', 'K. Yasenchak'], ['N. Mezlak', 'neon nightmares'],
    ['D. Pagel', 'E. O'], ['D. Partlo', 'D. Russano']
  ]}
];

function calculateMatchDate(week) {
  const startDate = new Date('2026-01-14'); // Week 1 = Jan 14, 2026 (Wednesday)
  const matchDate = new Date(startDate);
  matchDate.setDate(startDate.getDate() + (week - 1) * 7);
  return matchDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}

async function createSchedule() {
  console.log('=== Creating Weeks 4-18 Schedule ===\n');

  // Check existing matches
  const existingSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches').get();
  console.log(`Found ${existingSnap.size} existing matches`);

  const batch = db.batch();
  let created = 0;
  let skipped = 0;

  // Process rounds 4-18 only
  for (let roundIdx = 3; roundIdx < SCHEDULE.length; roundIdx++) { // Start at index 3 = round 4
    const round = SCHEDULE[roundIdx];
    console.log(`\nProcessing Round ${round.round}:`);

    for (const [homeTeamName, awayTeamName] of round.matches) {
      const homeTeamId = TEAMS[homeTeamName];
      const awayTeamId = TEAMS[awayTeamName];
      const matchDate = calculateMatchDate(round.round);

      if (!homeTeamId || !awayTeamId) {
        console.error(`  ERROR: Team not found - ${homeTeamName} or ${awayTeamName}`);
        continue;
      }

      // Create match document
      const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc();
      
      batch.set(matchRef, {
        week: round.round,
        match_date: matchDate,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_name: homeTeamName,
        away_team_name: awayTeamName,
        home_score: 0,
        away_score: 0,
        status: 'scheduled',
        match_pin: null,
        games: [],
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      created++;
      console.log(`  ✓ ${homeTeamName} vs ${awayTeamName} (${matchDate}) [${matchRef.id}]`);
    }
  }

  // Update league document with total weeks
  const leagueRef = db.collection('leagues').doc(LEAGUE_ID);
  batch.update(leagueRef, {
    total_weeks: 18,
    status: 'active',
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  // Commit batch
  console.log(`\n=== Committing ${created} new matches ===`);
  await batch.commit();

  // Verify final count
  const finalSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches').get();
  console.log(`\n=== COMPLETE ===`);
  console.log(`Total matches in collection: ${finalSnap.size}`);
  console.log(`Expected: 90 (15 existing + 75 new)`);
  console.log(`Created: ${created}`);
  
  if (finalSnap.size === 90) {
    console.log(`✅ SUCCESS - All 90 matches created`);
  } else {
    console.log(`⚠️  WARNING - Expected 90 matches, found ${finalSnap.size}`);
  }

  process.exit(0);
}

createSchedule().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
