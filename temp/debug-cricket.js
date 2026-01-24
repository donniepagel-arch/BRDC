/**
 * Debug cricket parsing specifically for game 3.1
 */

const fs = require('fs');
const path = require('path');

// Copy the RTF parsing functions
function rtfToText(rtfContent) {
    let text = rtfContent
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
    return text;
}

const rtfPath = path.join(__dirname, 'trips league', 'pagel v pagel MATCH.rtf');
const content = fs.readFileSync(rtfPath, 'utf8');
const text = rtfToText(content);
const allLines = text.split('\n');

// Find game 3.1 section
let inGame31 = false;
let game31Lines = [];

for (const line of allLines) {
    if (line.includes('Game 3.1')) {
        inGame31 = true;
        console.log('=== Found Game 3.1 ===\n');
    }

    if (inGame31) {
        game31Lines.push(line);
        console.log(`LINE: "${line}"`);

        if (line.includes('3 Dart Avg')) {
            console.log('\n=== End of Game 3.1 ===');
            break;
        }
    }
}

console.log(`\nTotal lines in game 3.1: ${game31Lines.length}`);

// Now parse manually
console.log('\n=== PARSING ANALYSIS ===\n');

let lastRound = 0;
let donnieDarts = 0;
let donnieMarks = 0;

for (const line of game31Lines) {
    const normalizedLine = line.replace(/\s*\t\s*/g, '\t').trim();
    const parts = normalizedLine.split('\t').filter(p => p.trim() !== '');

    if (parts.length < 4) continue;

    // Look for round number
    for (let i = 1; i < parts.length - 1; i++) {
        const val = parseInt(parts[i]);
        if (!isNaN(val) && val > lastRound && val <= 50) {
            const before = parts[i - 1];
            const after = parts[i + 1];
            if ((/^\d+$/.test(before) || before === 'Start') && /^\d+$/.test(after)) {
                console.log(`Round ${val}: parts = [${parts.join(' | ')}]`);

                // Check for Donnie
                if (normalizedLine.includes('Donnie')) {
                    // Find Donnie's hit
                    const donnieIdx = parts.findIndex(p => p.includes('Donnie'));
                    if (donnieIdx > 0) {
                        const hit = parts[donnieIdx - 1];
                        console.log(`  -> Donnie found, hit: "${hit}"`);
                        donnieDarts += 3;

                        // Count marks from hit
                        if (hit && hit !== '∅') {
                            const marks = hit.split(/[,\s]+/).reduce((sum, h) => {
                                if (h.startsWith('T')) return sum + 3;
                                if (h.startsWith('D') || h === 'DB') return sum + 2;
                                if (h.startsWith('S') || h === 'SB') return sum + 1;
                                return sum;
                            }, 0);
                            donnieMarks += marks;
                            console.log(`  -> Marks: ${marks}, Total darts: ${donnieDarts}, Total marks: ${donnieMarks}`);
                        }
                    }
                } else {
                    console.log(`  -> Donnie NOT in this round`);
                }

                lastRound = val;
                break;
            }
        }
    }
}

console.log(`\n=== FINAL: Donnie had ${donnieMarks} marks in ${donnieDarts} darts ===`);
console.log(`DC says: 9 marks in 24 darts`);
