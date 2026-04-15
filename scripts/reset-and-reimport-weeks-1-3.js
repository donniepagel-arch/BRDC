const admin = require('firebase-admin');
const path = require('path');
const https = require('https');
const { parseRTFMatch } = require('../temp/parse-rtf');

// Review-only warning:
// This script deletes league stats documents and resets team standings before reimporting.
// It must not be used as part of the normal import workflow.

// Use Firebase CLI saved credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(
  process.env.APPDATA || '', 'firebase', 'donniepagel_gmail_com_application_default_credentials.json'
);

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// All 15 matches to re-import
const MATCHES = [
  { name: 'Pagel v Pagel (Week 1)', matchId: 'sgmoL4GyVUYP67aOS7wm', rtfFile: 'temp/trips league/week 1/pagel v pagel MATCH.rtf', homeTeam: 'M. Pagel', awayTeam: 'D. Pagel', reorder: true },
  { name: 'N. Kull vs K. Yasenchak (Week 1)', matchId: 'JqiWABEBS7Bqk8n7pKxD', rtfFile: 'temp/trips league/week 1/yasenchak v kull.rtf', homeTeam: 'N. Kull', awayTeam: 'K. Yasenchak', reorder: true },
  { name: 'E.O vs D. Partlo (Week 1)', matchId: '0lxEeuAa7fEDSVeY3uCG', rtfFile: 'temp/trips league/week 1/partlo v olschansky.rtf', homeTeam: 'E. O', awayTeam: 'D. Partlo', reorder: true },
  { name: 'N. Mezlak vs D. Russano (Week 1)', matchId: 'nYv1XeGTWbaxBepI6F5u', rtfFile: 'temp/trips league/week 1/mezlak v russano.rtf', homeTeam: 'N. Mezlak', awayTeam: 'D. Russano', reorder: true },
  { name: 'J. Ragnoni vs Neon Nightmares (Week 1)', matchId: 'OTYlCe3NNbinKlpZccwS', rtfFile: 'temp/trips league/week 1/massimiani v ragnoni.rtf', homeTeam: 'J. Ragnoni', awayTeam: 'neon nightmares', reorder: true },
  { name: 'D. Pagel vs N. Kull (Week 2)', matchId: 'RfSuCwwQUm2vvpH3e322', rtfFile: 'temp/trips league/week 2/pagel v kull.rtf', homeTeam: 'D. Pagel', awayTeam: 'N. Kull', reorder: true },
  { name: 'D. Russano vs J. Ragnoni (Week 2)', matchId: 'mOtQbjkiLzWc6Ea7gnkp', rtfFile: 'temp/trips league/week 2/russano v ragnoni.rtf', homeTeam: 'D. Russano', awayTeam: 'J. Ragnoni', reorder: true },
  { name: 'N. Mezlak vs E.O (Week 2)', matchId: 'DhKUt2hCdSEJaNRDceIz', rtfFile: 'temp/trips league/week 2/mezlak V e.o.rtf', homeTeam: 'N. Mezlak', awayTeam: 'E. O', reorder: true },
  { name: 'D. Partlo vs M. Pagel (Week 2)', matchId: 'fqICAD9zFe7cLgNM2m4T', rtfFile: 'temp/trips league/week 2/dpartlo v mpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'M. Pagel', reorder: true },
  { name: 'Neon Nightmares vs K. Yasenchak (Week 2)', matchId: 'j99cYF5bV2Se7zoNVpgi', rtfFile: 'temp/trips league/week 2/massimiani v yasenchak.rtf', homeTeam: 'neon nightmares', awayTeam: 'K. Yasenchak', reorder: true },
  { name: 'E.O vs J. Ragnoni (Week 3)', matchId: 'P57BmQcCGdfZLIxaIe5P', rtfFile: 'temp/trips league/week 3/e.o v jragnonio.rtf', homeTeam: 'E. O', awayTeam: 'J. Ragnoni', reorder: true },
  { name: 'D. Partlo vs D. Pagel (Week 3)', matchId: 'xX4UtSU1dms9spECerDd', rtfFile: 'temp/trips league/week 3/dpartlo v dpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'D. Pagel', reorder: true },
  { name: 'D. Russano vs K. Yasenchak (Week 3)', matchId: 'nUT8f6Fvdi1y7St9wlGQ', rtfFile: 'temp/trips league/week 3/russano v yasenchak.rtf', homeTeam: 'D. Russano', awayTeam: 'K. Yasenchak', reorder: true },
  { name: 'N. Kull vs Neon Nightmares (Week 3)', matchId: 'bHKrdlJnQWbABkMWkLov', rtfFile: 'temp/trips league/week 3/nkull v neon nightmares.rtf', homeTeam: 'N. Kull', awayTeam: 'neon nightmares', reorder: true },
  { name: 'M. Pagel vs N. Mezlak (Week 3)', matchId: 'pw8L1xdnkTDCiorTwbWO', rtfFile: 'temp/trips league/week 3/mpagel v nmezlak.rtf', homeTeam: 'M. Pagel', awayTeam: 'N. Mezlak', reorder: true }
];

async function resetStats() {
  console.log('\n=== STEP 1: Reset Player Stats ===\n');
  
  const statsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('stats').get();
  console.log(`Found ${statsSnap.size} player stat documents`);
  
  const batch = db.batch();
  let count = 0;
  
  statsSnap.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });
  
  await batch.commit();
  console.log(`✓ Deleted ${count} player stat documents`);
}

async function resetTeamStandings() {
  console.log('\n=== STEP 2: Reset Team Standings ===\n');
  
  const teamsSnap = await db.collection('leagues').doc(LEAGUE_ID).collection('teams').get();
  console.log(`Found ${teamsSnap.size} teams`);
  
  const batch = db.batch();
  
  teamsSnap.forEach(doc => {
    batch.update(doc.ref, {
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      games_won: 0,
      games_lost: 0,
      legs_won: 0,
      legs_lost: 0
    });
  });
  
  await batch.commit();
  console.log(`✓ Reset standings for ${teamsSnap.size} teams`);
}

async function reimportMatches() {
  console.log('\n=== STEP 3: Re-import All 15 Matches ===\n');
  
  // Import the reorder and convert functions from import script
  const importScript = require('./import-match-from-rtf');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const match of MATCHES) {
    console.log(`\n--- ${match.name} ---`);
    
    try {
      const rtfPath = path.join(__dirname, '..', match.rtfFile);
      console.log(`  Parsing: ${match.rtfFile}`);
      
      const { games: parsedGames, metadata } = parseRTFMatch(rtfPath);
      console.log(`  Parsed ${parsedGames.length} games`);
      
      let gamesToConvert = parsedGames;
      if (match.reorder) {
        const { reorderGames } = require('./import-match-from-rtf');
        gamesToConvert = reorderGames(parsedGames, match.homeTeam, match.awayTeam);
        console.log(`  Reordered to ${gamesToConvert.length} games`);
      }
      
      const { convertToFirestoreFormat } = require('./import-match-from-rtf');
      const matchData = convertToFirestoreFormat(gamesToConvert, match.homeTeam, match.awayTeam, metadata, match);
      console.log(`  Calculated Score: ${match.homeTeam} ${matchData.final_score.home} - ${matchData.final_score.away} ${match.awayTeam}`);
      
      // Post to importMatchData cloud function
      const importUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/importMatchData';
      const importResult = await postToCloudFunction(importUrl, {
        leagueId: LEAGUE_ID,
        matchId: match.matchId,
        matchData: matchData
      });
      
      if (importResult.success) {
        console.log(`  ✓ Imported successfully`);
        successCount++;
      } else {
        console.log(`  ✗ Import failed: ${importResult.error}`);
        failCount++;
      }
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Import Complete: ${successCount} success, ${failCount} failed ===`);
  return { successCount, failCount };
}

async function recalculateStats() {
  console.log('\n=== STEP 4: Recalculate Player Stats ===\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const match of MATCHES) {
    console.log(`  Recalculating stats for ${match.name}...`);
    
    try {
      const statsUrl = 'https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats';
      const result = await postToCloudFunction(statsUrl, {
        leagueId: LEAGUE_ID,
        matchId: match.matchId
      });
      
      if (result.success || result.playersUpdated >= 0) {
        console.log(`    ✓ Updated ${result.playersUpdated || 0} players`);
        successCount++;
      } else {
        console.log(`    ✗ Failed: ${result.error}`);
        failCount++;
      }
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n=== Stats Recalculation Complete: ${successCount} success, ${failCount} failed ===`);
}

function postToCloudFunction(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { 
          resolve(JSON.parse(body)); 
        } catch (e) { 
          resolve({ raw: body, success: false, error: 'Invalid JSON response' }); 
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=============================================================');
  console.log('  BRDC: Reset and Re-import Weeks 1-3');
  console.log('=============================================================');
  
  try {
    await resetStats();
    await resetTeamStandings();
    const importResults = await reimportMatches();
    await recalculateStats();
    
    console.log('\n=============================================================');
    console.log('  ALL STEPS COMPLETE');
    console.log('=============================================================\n');
    
    process.exit(importResults.failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n=== FATAL ERROR ===');
    console.error(error);
    process.exit(1);
  }
}

main();
