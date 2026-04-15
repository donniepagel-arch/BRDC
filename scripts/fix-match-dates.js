const admin = require('firebase-admin');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// Timezone-safe date formatting (no UTC conversion)
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fixDates() {
  // Read league config
  const leagueDoc = await db.collection('leagues').doc(LEAGUE_ID).get();
  const league = leagueDoc.data();
  const blackouts = new Set(league.blackout_dates || []);

  console.log('Blackout dates:', Array.from(blackouts));
  console.log();

  // Calculate correct dates for all 18 weeks
  // Start: Jan 14, 2026 (Wednesday), every Wednesday, skip blackouts
  const correctDates = {};
  const current = new Date(2026, 0, 14); // Local time: Jan 14, 2026

  for (let week = 1; week <= 18; week++) {
    let dateStr = formatDate(current);

    // Skip blackout dates
    while (blackouts.has(dateStr)) {
      console.log(`Week ${week}: Skipping blackout ${dateStr}`);
      current.setDate(current.getDate() + 7);
      dateStr = formatDate(current);
    }

    correctDates[week] = dateStr;
    const dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`Week ${String(week).padStart(2)}: ${dateStr} (${dayOfWeek})`);

    // Advance to next Wednesday
    current.setDate(current.getDate() + 7);
  }

  // Read all matches and update
  const matchesSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('matches').get();
  const batch = db.batch();
  let updated = 0;
  let unchanged = 0;

  matchesSnap.forEach(doc => {
    const match = doc.data();
    const week = match.week;
    const correctDate = correctDates[week];

    if (!correctDate) {
      console.warn(`No correct date for week ${week} (match ${doc.id})`);
      return;
    }

    if (match.match_date !== correctDate) {
      batch.update(doc.ref, { match_date: correctDate });
      updated++;
      console.log(`  Fixing week ${week}: ${match.match_date} → ${correctDate} (${match.home_team_name} vs ${match.away_team_name})`);
    } else {
      unchanged++;
    }
  });

  console.log(`\n${updated} matches to update, ${unchanged} already correct`);

  if (updated > 0) {
    await batch.commit();
    console.log('✅ All match dates updated successfully!');
  } else {
    console.log('No changes needed.');
  }

  process.exit(0);
}

fixDates().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
