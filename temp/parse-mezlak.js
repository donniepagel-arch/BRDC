/**
 * Parse Mezlak v Russano RTF to figure out correct match score
 * Each set is best of 3 legs
 */

const fs = require('fs');
const path = require('path');

// Team rosters
const MEZLAK_TEAM = ['Nick Mezlak', 'Cory Jacobs', 'Dillon Ulisses', 'Dillon U'];
const RUSSANO_TEAM = ['Danny Russano', 'Chris Russano', 'Eric Duale', 'Eric'];

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

function getTeam(playerName) {
    const name = playerName.trim();
    for (const p of MEZLAK_TEAM) {
        if (name.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(name.toLowerCase())) return 'mezlak';
    }
    for (const p of RUSSANO_TEAM) {
        if (name.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(name.toLowerCase())) return 'russano';
    }
    return null;
}

const rtfPath = path.join(__dirname, 'trips league', 'mezlak v russano.rtf');
const content = fs.readFileSync(rtfPath, 'utf8');
const text = rtfToText(content);
const lines = text.split('\n');

// Find all sets by splitting on "WIN" markers
// Each WIN section is a set result
const winSections = text.split(/\nWIN\n/);

console.log(`Found ${winSections.length - 1} WIN sections (sets)\n`);

// Track all sets
let sets = [];
let currentSet = null;
let setNum = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for opponent summary line at start of each match section
    // Format: "CR & DR\t\t2\t1\t2" (initials, sets won, legs score, total legs)
    // Or: "Nick Mezlak\t\t2\t2\t100%" (from player section)

    // Start of new set section - look for "Game X.1"
    if (/Game\s+1\.1/i.test(line)) {
        if (currentSet) {
            sets.push(currentSet);
        }
        setNum++;
        currentSet = {
            setNum: setNum,
            legs: [],
            mezlakLegs: 0,
            russanoLegs: 0,
            winner: null
        };
    }

    // Leg results from "Game X.Y" lines
    const gameMatch = line.match(/Game\s+(\d+)\.(\d+)\s*-?\s*(501|Cricket|SIDO)?/i);
    if (gameMatch && currentSet) {
        const legNum = parseInt(gameMatch[2]);
        const format = gameMatch[3] || '';
        currentSet.legs.push({
            legNum: legNum,
            format: format.toLowerCase().includes('cricket') ? 'cricket' : '501',
            winner: null,
            winnerTeam: null
        });
    }

    // Find 501 winners by "DO (X)" checkout
    if (line.includes('DO (') && currentSet && currentSet.legs.length > 0) {
        const parts = line.split('\t').filter(p => p.trim());
        for (const part of parts) {
            const team = getTeam(part);
            if (team) {
                const lastLeg = currentSet.legs[currentSet.legs.length - 1];
                if (lastLeg && !lastLeg.winnerTeam && lastLeg.format === '501') {
                    lastLeg.winner = part.trim();
                    lastLeg.winnerTeam = team;
                    if (team === 'mezlak') currentSet.mezlakLegs++;
                    else currentSet.russanoLegs++;
                }
                break;
            }
        }
    }

    // Find cricket winners - they appear on the last throw line before "3 Dart Avg"
    // Cricket winner is the one who closed out (last non-empty throw)
    if (line.includes('3 Dart Avg') && currentSet && currentSet.legs.length > 0) {
        const lastLeg = currentSet.legs[currentSet.legs.length - 1];
        if (lastLeg && !lastLeg.winnerTeam && lastLeg.format === 'cricket') {
            // Look back for the last player who threw (won cricket)
            for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
                const prevLine = lines[j].trim();
                // Cricket closing line usually has the player name at the start
                const parts = prevLine.split('\t').filter(p => p.trim());
                if (parts.length >= 2) {
                    for (const part of parts) {
                        const team = getTeam(part);
                        if (team) {
                            lastLeg.winner = part.trim();
                            lastLeg.winnerTeam = team;
                            if (team === 'mezlak') currentSet.mezlakLegs++;
                            else currentSet.russanoLegs++;
                            break;
                        }
                    }
                    if (lastLeg.winnerTeam) break;
                }
            }
        }
    }
}

// Don't forget last set
if (currentSet) {
    sets.push(currentSet);
}

// Determine set winners (best of 3)
for (const set of sets) {
    if (set.mezlakLegs >= 2) set.winner = 'mezlak';
    else if (set.russanoLegs >= 2) set.winner = 'russano';
}

// Count total sets
let mezlakSetsWon = 0;
let russanoSetsWon = 0;

console.log('=== SET BY SET RESULTS ===\n');
for (const set of sets) {
    console.log(`Set ${set.setNum}: Mezlak ${set.mezlakLegs} - ${set.russanoLegs} Russano`);
    for (const leg of set.legs) {
        console.log(`  Leg ${leg.legNum} (${leg.format}): ${leg.winner || '?'} (${leg.winnerTeam || '?'})`);
    }
    console.log(`  SET WINNER: ${set.winner || 'UNKNOWN'}\n`);

    if (set.winner === 'mezlak') mezlakSetsWon++;
    else if (set.winner === 'russano') russanoSetsWon++;
}

console.log('=== FINAL MATCH SCORE ===');
console.log(`N. Mezlak ${mezlakSetsWon} - ${russanoSetsWon} D. Russano`);

// Figure out home/away
// Based on match ID context, Mezlak is home team
console.log(`\nFor Firestore: home_score = ${mezlakSetsWon}, away_score = ${russanoSetsWon}`);
