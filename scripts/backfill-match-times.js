/**
 * Backfill match documents with timing data from RTF files.
 * Re-parses RTF metadata and updates Firestore directly.
 */
const admin = require('firebase-admin');
const { parseRTFMatch } = require('../temp/parse-rtf.js');
const path = require('path');
const fs = require('fs');

admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

const MATCHES = [
    { name: 'Pagel v Pagel (Week 1)', matchId: 'sgmoL4GyVUYP67aOS7wm', rtfFile: 'temp/trips league/week 1/pagel v pagel MATCH.rtf' },
    { name: 'N. Kull vs K. Yasenchak (Week 1)', matchId: 'JqiWABEBS7Bqk8n7pKxD', rtfFile: 'temp/trips league/week 1/yasenchak v kull.rtf' },
    { name: 'E.O vs D. Partlo (Week 1)', matchId: '0lxEeuAa7fEDSVeY3uCG', rtfFile: 'temp/trips league/week 1/partlo v olschansky.rtf' },
    { name: 'N. Mezlak vs D. Russano (Week 1)', matchId: 'nYv1XeGTWbaxBepI6F5u', rtfFile: 'temp/trips league/week 1/mezlak v russano.rtf' },
    { name: 'J. Ragnoni vs Neon Nightmares (Week 1)', matchId: 'OTYlCe3NNbinKlpZccwS', rtfFile: 'temp/trips league/week 1/massimiani v ragnoni.rtf' },
    { name: 'D. Pagel vs N. Kull (Week 2)', matchId: 'RfSuCwwQUm2vvpH3e322', rtfFile: 'temp/trips league/week 2/pagel v kull.rtf' },
    { name: 'D. Russano vs J. Ragnoni (Week 2)', matchId: 'mOtQbjkiLzWc6Ea7gnkp', rtfFile: 'temp/trips league/week 2/russano v ragnoni.rtf' },
    { name: 'E.O. vs N. Mezlak (Week 2)', matchId: 'DhKUt2hCdSEJaNRDceIz', rtfFile: 'temp/trips league/week 2/mezlak V e.o.rtf' },
    { name: 'D. Partlo vs M. Pagel (Week 2)', matchId: 'fqICAD9zFe7cLgNM2m4T', rtfFile: 'temp/trips league/week 2/dpartlo v mpagel.rtf' },
    { name: 'Neon Nightmares vs K. Yasenchak (Week 2)', matchId: 'j99cYF5bV2Se7zoNVpgi', rtfFile: 'temp/trips league/week 2/massimiani v yasenchak.rtf' },
    { name: 'J. Ragnoni vs E. O (Week 3)', matchId: 'P57BmQcCGdfZLIxaIe5P', rtfFile: 'temp/trips league/week 3/e.o v jragnonio.rtf' },
    { name: 'D. Partlo vs D. Pagel (Week 3)', matchId: 'xX4UtSU1dms9spECerDd', rtfFile: 'temp/trips league/week 3/dpartlo v dpagel.rtf' },
    { name: 'K. Yasenchak vs D. Russano (Week 3)', matchId: 'nUT8f6Fvdi1y7St9wlGQ', rtfFile: 'temp/trips league/week 3/russano v yasenchak.rtf' },
    { name: 'N. Kull vs Neon Nightmares (Week 3)', matchId: 'bHKrdlJnQWbABkMWkLov', rtfFile: 'temp/trips league/week 3/nkull v neon nightmares.rtf' },
    { name: 'N. Mezlak vs M. Pagel (Week 3)', matchId: 'pw8L1xdnkTDCiorTwbWO', rtfFile: 'temp/trips league/week 3/mpagel v nmezlak.rtf' }
];

async function backfill() {
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const match of MATCHES) {
        const rtfPath = path.join(__dirname, '..', match.rtfFile);

        if (!fs.existsSync(rtfPath)) {
            console.log(`SKIP: ${match.name} — RTF file not found: ${match.rtfFile}`);
            skipped++;
            continue;
        }

        try {
            const { metadata } = parseRTFMatch(rtfPath);

            const updateData = {};
            if (metadata.start_time) {
                updateData.start_time = admin.firestore.Timestamp.fromDate(metadata.start_time);
            }
            if (metadata.end_time) {
                updateData.end_time = admin.firestore.Timestamp.fromDate(metadata.end_time);
            }
            if (metadata.game_time_minutes != null) {
                updateData.game_time_minutes = metadata.game_time_minutes;
            }
            if (metadata.match_length_minutes != null) {
                updateData.match_length_minutes = metadata.match_length_minutes;
            }

            if (Object.keys(updateData).length === 0) {
                console.log(`SKIP: ${match.name} — No time data in RTF`);
                skipped++;
                continue;
            }

            const matchRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches').doc(match.matchId);
            await matchRef.update(updateData);

            const startStr = metadata.start_time ? metadata.start_time.toLocaleTimeString() : '?';
            const endStr = metadata.end_time ? metadata.end_time.toLocaleTimeString() : '?';
            const dur = metadata.game_time_minutes || '?';
            console.log(`OK: ${match.name} — ${startStr} to ${endStr} (${dur} min)`);
            updated++;
        } catch (e) {
            console.log(`ERROR: ${match.name} — ${e.message}`);
            errors++;
        }
    }

    console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
