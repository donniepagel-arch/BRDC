const https = require('https');

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCHES = [
    // Week 1
    'sgmoL4GyVUYP67aOS7wm',  // Pagel v Pagel
    'JqiWABEBS7Bqk8n7pKxD',  // N. Kull vs K. Yasenchak
    '0lxEeuAa7fEDSVeY3uCG',  // E.O vs D. Partlo
    'nYv1XeGTWbaxBepI6F5u',  // N. Mezlak vs D. Russano
    'OTYlCe3NNbinKlpZccwS',  // J. Ragnoni vs Neon Nightmares
    // Week 2
    'RfSuCwwQUm2vvpH3e322',  // D. Pagel vs N. Kull
    'mOtQbjkiLzWc6Ea7gnkp',  // D. Russano vs J. Ragnoni
    'DhKUt2hCdSEJaNRDceIz',  // E.O. vs N. Mezlak
    'fqICAD9zFe7cLgNM2m4T',  // D. Partlo vs M. Pagel
    'j99cYF5bV2Se7zoNVpgi',  // Neon Nightmares vs K. Yasenchak
    // Week 3
    'P57BmQcCGdfZLIxaIe5P',  // J. Ragnoni vs E.O
    'xX4UtSU1dms9spECerDd',  // D. Partlo vs D. Pagel
    'nUT8f6Fvdi1y7St9wlGQ',  // K. Yasenchak vs D. Russano
    'bHKrdlJnQWbABkMWkLov',  // N. Kull vs Neon Nightmares
    'pw8L1xdnkTDCiorTwbWO'   // N. Mezlak vs M. Pagel
];

function callFunction(matchId) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ leagueId: LEAGUE_ID, matchId });
        const options = {
            hostname: 'us-central1-brdc-v2.cloudfunctions.net',
            path: '/updateImportedMatchStats',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve(result);
                } catch (e) {
                    reject(new Error(`Parse error: ${body.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log(`Recalculating stats for ${MATCHES.length} matches...\n`);

    for (let i = 0; i < MATCHES.length; i++) {
        const matchId = MATCHES[i];
        try {
            console.log(`[${i+1}/${MATCHES.length}] Processing ${matchId}...`);
            const result = await callFunction(matchId);
            console.log(`  → Players updated: ${result.playersUpdated || 0}`);
            if (result.stats && result.stats.length > 0) {
                result.stats.forEach(s => {
                    const avg = s.x01Avg ? s.x01Avg.toFixed(1) : '-';
                    const mpr = s.cricketMpr ? s.cricketMpr.toFixed(2) : '-';
                    console.log(`    ${s.playerName}: 3DA=${avg}, MPR=${mpr}`);
                });
            }
        } catch (err) {
            console.error(`  ✗ Error on ${matchId}: ${err.message}`);
        }
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✓ Done! All matches processed.');
}

main();
