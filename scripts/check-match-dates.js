const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

async function checkDates() {
  // 1. Read league doc
  const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();
  const league = leagueDoc.data();

  console.log('=== LEAGUE CONFIG ===');
  console.log('League name:', league.league_name || league.name);
  console.log('Start date:', league.start_date);
  console.log('Blackout dates:', league.blackout_dates || 'NONE SET');
  console.log('Play day:', league.play_day);
  console.log('Total weeks:', league.total_weeks);
  console.log();

  // 2. Read all matches, group by week
  const matchesSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches').get();
  const matchesByWeek = {};
  matchesSnap.forEach(doc => {
    const m = doc.data();
    const week = m.week || 0;
    if (!matchesByWeek[week]) matchesByWeek[week] = [];
    matchesByWeek[week].push({ id: doc.id, match_date: m.match_date, status: m.status, home: m.home_team_name, away: m.away_team_name });
  });

  console.log('=== CURRENT MATCH DATES BY WEEK ===');
  const weeks = Object.keys(matchesByWeek).map(Number).sort((a, b) => a - b);

  for (const week of weeks) {
    const matches = matchesByWeek[week];
    const date = matches[0]?.match_date || 'NO DATE';
    // Parse date safely to show day of week
    let dayOfWeek = '';
    if (date && date !== 'NO DATE') {
      const [y, m, d] = date.split('-').map(Number);
      const dt = new Date(y, m - 1, d); // local time construction
      dayOfWeek = dt.toLocaleDateString('en-US', { weekday: 'long' });
    }
    console.log(`  Week ${String(week).padStart(2)}: ${date} (${dayOfWeek}) - ${matches.length} matches [${matches[0]?.status}]`);
  }

  // 3. Calculate what dates SHOULD be
  console.log('\n=== EXPECTED DATES (Every Wed from Jan 14, skip blackouts) ===');
  const blackouts = new Set(league.blackout_dates || []);
  const startDate = new Date(2026, 0, 14); // Jan 14, 2026 local time
  let current = new Date(startDate);

  for (const week of weeks) {
    // Skip blackout dates
    let dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    while (blackouts.has(dateStr)) {
      console.log(`  Week ${String(week).padStart(2)}: SKIPPING blackout ${dateStr}`);
      current.setDate(current.getDate() + 7);
      dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    }

    const actual = matchesByWeek[week]?.[0]?.match_date || 'MISSING';
    const match = actual === dateStr ? '✓' : `✗ (have ${actual})`;
    const dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`  Week ${String(week).padStart(2)}: ${dateStr} (${dayOfWeek}) ${match}`);

    current.setDate(current.getDate() + 7);
  }

  process.exit(0);
}

checkDates().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
