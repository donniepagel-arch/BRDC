/**
 * Find which sets are missing from Mezlak v Russano
 * Analyze player matchups to identify gaps
 */

const fs = require('fs');
const path = require('path');

// Team rosters
const MEZLAK_PLAYERS = ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses'];
const RUSSANO_PLAYERS = ['Danny Russano', 'Chris Russano', 'Eric Duale'];

function rtfToText(rtfContent) {
    return rtfContent
        .replace(/\{\\rtf1[^}]*\}/g, '')
        .replace(/\{\\fonttbl[^}]*\}/g, '')
        .replace(/\{\\colortbl[^}]*\}/g, '')
        .replace(/\{\\generator[^}]*\}/g, '')
        .replace(/\{\\mmathPr[^}]*\}/g, '')
        .replace(/\\viewkind\d+/g, '')
        .replace(/\\uc\d+/g, '')
        .replace(/\\pard[^\\]*/g, '')
        .replace(/\\sa\d+/g, '')
        .replace(/\\sl\d+/g, '')
        .replace(/\\slmult\d+/g, '')
        .replace(/\\f\d+/g, '')
        .replace(/\\fs\d+/g, '')
        .replace(/\\lang\d+/g, '')
        .replace(/\\par\s*/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\u8709\?/g, '∅')
        .replace(/\\\*/g, '')
        .replace(/\{/g, '')
        .replace(/\}/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
        .trim();
}

const rtfPath = path.join(__dirname, 'trips league', 'mezlak v russano.rtf');
const content = fs.readFileSync(rtfPath, 'utf8');
const text = rtfToText(content);
const lines = text.split('\n');

// Find player matchups by looking at game sections
// Each game section has players listed in the throws

let sets = [];
let currentSet = null;
let setNum = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // New set starts at "Game 1.1"
    if (/Game\s+1\.1/i.test(line)) {
        if (currentSet) {
            sets.push(currentSet);
        }
        setNum++;
        currentSet = {
            setNum: setNum,
            mezlakPlayers: new Set(),
            russanoPlayers: new Set(),
            format: line.includes('Cricket') ? 'cricket' : '501'
        };
    }

    // Track game format for current set
    if (/Game\s+1\.2/i.test(line) && currentSet) {
        currentSet.format2 = line.includes('Cricket') ? 'cricket' : '501';
    }

    // Look for player names in the lines
    if (currentSet) {
        for (const mp of MEZLAK_PLAYERS) {
            if (line.includes(mp) ||
                (mp === 'Dillon Ulisses' && line.includes('Dillon U'))) {
                currentSet.mezlakPlayers.add(mp);
            }
        }
        for (const rp of RUSSANO_PLAYERS) {
            if (line.includes(rp) ||
                (rp === 'Eric Duale' && line.match(/\bEric\b/) && !line.includes('America'))) {
                currentSet.russanoPlayers.add(rp);
            }
        }
    }
}

// Don't forget last set
if (currentSet) {
    sets.push(currentSet);
}

console.log('=== SETS FOUND IN FILE ===\n');

// Expected triples matchups:
// Doubles (2v2): Each pair plays once
// Singles (1v1): Each player plays each opponent

const matchups = [];

for (const set of sets) {
    const mPlayers = Array.from(set.mezlakPlayers);
    const rPlayers = Array.from(set.russanoPlayers);

    const isDoubles = mPlayers.length === 2 && rPlayers.length === 2;
    const isSingles = mPlayers.length === 1 && rPlayers.length === 1;

    const type = isDoubles ? 'DOUBLES' : (isSingles ? 'SINGLES' : `${mPlayers.length}v${rPlayers.length}`);

    console.log(`Set ${set.setNum}: ${type}`);
    console.log(`  Mezlak: ${mPlayers.join(', ') || 'none found'}`);
    console.log(`  Russano: ${rPlayers.join(', ') || 'none found'}`);
    console.log(`  Format: ${set.format}/${set.format2 || '?'}`);
    console.log('');

    matchups.push({
        mezlak: mPlayers.sort(),
        russano: rPlayers.sort(),
        type: type
    });
}

// Now figure out what's missing
console.log('\n=== EXPECTED MATCHUPS FOR TRIPLES ===\n');

// Singles: each of 3 vs each of 3 = 9 possible, but usually each plays 2 = 6 singles
// Doubles: 3 possible pairings on each side

// Let's list what we have
console.log('Singles matchups found:');
const singlesFound = [];
for (const m of matchups) {
    if (m.mezlak.length === 1 && m.russano.length === 1) {
        const key = `${m.mezlak[0]} vs ${m.russano[0]}`;
        singlesFound.push(key);
        console.log(`  ${key}`);
    }
}

console.log('\nDoubles matchups found:');
const doublesFound = [];
for (const m of matchups) {
    if (m.mezlak.length === 2 && m.russano.length === 2) {
        const key = `${m.mezlak.join('+')} vs ${m.russano.join('+')}`;
        doublesFound.push(key);
        console.log(`  ${key}`);
    }
}

// Generate all possible singles matchups
console.log('\n=== ALL POSSIBLE SINGLES MATCHUPS ===');
const allSingles = [];
for (const mp of MEZLAK_PLAYERS) {
    for (const rp of RUSSANO_PLAYERS) {
        const key = `${mp} vs ${rp}`;
        allSingles.push(key);
        const found = singlesFound.some(s => s.includes(mp) && s.includes(rp));
        console.log(`  ${key} - ${found ? 'FOUND' : 'MISSING'}`);
    }
}

// Count missing
const missingSingles = allSingles.filter(s => {
    const [mp, , rp] = s.split(' ');
    return !singlesFound.some(f => f.includes(mp) && f.includes(rp));
});

console.log(`\n=== MISSING SINGLES: ${missingSingles.length} ===`);
for (const m of missingSingles) {
    console.log(`  ${m}`);
}
