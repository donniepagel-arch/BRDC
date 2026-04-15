const fs = require('fs');
const path = require('path');
const { parseRTFMatch } = require('../temp/parse-rtf');

// We need to replicate the reordering/conversion logic briefly or just use the parser's raw game count vs expected?
// Actually, `import-match-from-rtf.js` has the specific logic for 9-set reordering which is crucial.
// Let's just import the main script functions if possible, or copy the minimal logic.
// For now, let's just use parseRTFMatch to get the raw breakdown, it usually returns `games` array.

// Better yet, let's modify `import-match-from-rtf.js` to have a `--check` flag?
// Or just require it and assume we can use internal functions? No, it's not exported.

// I will create a script that mimics `import-match-from-rtf.js` but just prints scores.
// I'll copy the MATCHES array and the core logic.

const MATCHES = [
    { name: 'Pagel v Pagel (Week 1)', rtfFile: 'temp/trips league/week 1/pagel v pagel MATCH.rtf', homeTeam: 'M. Pagel', awayTeam: 'D. Pagel' },
    { name: 'N. Kull vs K. Yasenchak (Week 1)', rtfFile: 'temp/trips league/week 1/yasenchak v kull.rtf', homeTeam: 'N. Kull', awayTeam: 'K. Yasenchak' },
    { name: 'E.O vs D. Partlo (Week 1)', rtfFile: 'temp/trips league/week 1/partlo v olschansky.rtf', homeTeam: 'E. O', awayTeam: 'D. Partlo' },
    { name: 'N. Mezlak vs D. Russano (Week 1)', rtfFile: 'temp/trips league/week 1/mezlak v russano.rtf', homeTeam: 'N. Mezlak', awayTeam: 'D. Russano' },
    { name: 'J. Ragnoni vs Neon Nightmares (Week 1)', rtfFile: 'temp/trips league/week 1/massimiani v ragnoni.rtf', homeTeam: 'J. Ragnoni', awayTeam: 'neon nightmares' },

    { name: 'D. Pagel vs N. Kull (Week 2)', rtfFile: 'temp/trips league/week 2/pagel v kull.rtf', homeTeam: 'D. Pagel', awayTeam: 'N. Kull' },
    { name: 'D. Russano vs J. Ragnoni (Week 2)', rtfFile: 'temp/trips league/week 2/russano v ragnoni.rtf', homeTeam: 'D. Russano', awayTeam: 'J. Ragnoni' },
    { name: 'E.O. vs N. Mezlak (Week 2)', rtfFile: 'temp/trips league/week 2/mezlak V e.o.rtf', homeTeam: 'E. O', awayTeam: 'N. Mezlak' },
    { name: 'D. Partlo vs M. Pagel (Week 2)', rtfFile: 'temp/trips league/week 2/dpartlo v mpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'M. Pagel' },
    { name: 'Neon Nightmares vs K. Yasenchak (Week 2)', rtfFile: 'temp/trips league/week 2/massimiani v yasenchak.rtf', homeTeam: 'neon nightmares', awayTeam: 'K. Yasenchak' },

    { name: 'J. Ragnoni vs E. O (Week 3)', rtfFile: 'temp/trips league/week 3/e.o v jragnonio.rtf', homeTeam: 'J. Ragnoni', awayTeam: 'E. O' },
    { name: 'D. Partlo vs D. Pagel (Week 3)', rtfFile: 'temp/trips league/week 3/dpartlo v dpagel.rtf', homeTeam: 'D. Partlo', awayTeam: 'D. Pagel' }, // Note: Fixed alignment in main script
    { name: 'K. Yasenchak vs D. Russano (Week 3)', rtfFile: 'temp/trips league/week 3/russano v yasenchak.rtf', homeTeam: 'K. Yasenchak', awayTeam: 'D. Russano' },
    { name: 'N. Kull vs Neon Nightmares (Week 3)', rtfFile: 'temp/trips league/week 3/nkull v neon nightmares.rtf', homeTeam: 'N. Kull', awayTeam: 'neon nightmares' },
    { name: 'N. Mezlak vs M. Pagel (Week 3)', rtfFile: 'temp/trips league/week 3/mpagel v nmezlak.rtf', homeTeam: 'N. Mezlak', awayTeam: 'M. Pagel' }
];

async function check() {
    console.log('Checking match scores...');
    for (const match of MATCHES) {
        const filePath = path.join(__dirname, '..', match.rtfFile);
        if (!fs.existsSync(filePath)) {
            console.log(`[MISSING] ${match.name}`);
            continue;
        }

        try {
            const data = await parseRTFMatch(filePath);
            // Count "wins" simply by counting games where winner is declared?
            // The main script does complex reordering. 
            // Let's just count raw game winners for a quick check.
            let home = 0;
            let away = 0;
            let unknown = 0;

            (data.games || []).forEach(g => {
                // If it has legs, check legs? Or just game winner?
                // parseRTFMatch returns 'games' which have 'winner'
                // But parseRTFMatch logic doesn't do the "Set winner" logic, that's in import-match-from-rtf.js
                // So we rely on legs.
                let homeLegs = 0;
                let awayLegs = 0;
                (g.legs || []).forEach(l => {
                    if (l.winner === 'home') homeLegs++;
                    else if (l.winner === 'away') awayLegs++;
                });

                if (homeLegs > awayLegs) home++;
                else if (awayLegs > homeLegs) away++;
                else unknown++;
            });

            // Note: This naive count might differ from the complex 9-set logic, 
            // but if the total (home+away) < 9, it's a strong indicator of issues.
            const total = home + away;
            const status = total === 9 ? '[OK]' : '[ISSUE]';
            console.log(`${status} ${match.name}: ${home}-${away} (Total: ${total}, Unknown/Tie: ${unknown})`);
        } catch (e) {
            console.log(`[ERROR] ${match.name}: ${e.message}`);
        }
    }
}

check();
