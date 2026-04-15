/**
 * Test script to verify notable flags are being added to throws
 */
const { parseRTFMatch } = require('./temp/parse-rtf.js');
const path = require('path');

const testFile = path.join(__dirname, 'temp/trips league/week 1/pagel v pagel MATCH.rtf');

console.log('Parsing:', testFile);
const { games, metadata } = parseRTFMatch(testFile);

console.log(`\nParsed ${games.length} games\n`);

// Check first game's first leg for notable flags
const firstGame = games[0];
const firstLeg = firstGame.legs[0];

console.log('=== First Game, First Leg ===');
console.log(`Type: ${firstLeg.type}`);
console.log(`Throws count: ${firstLeg.throws.length}\n`);

// Look for throws with notable flags
let notableCount = 0;
let checkoutCount = 0;
let closeoutCount = 0;

firstLeg.throws.forEach(t => {
    if (t.notable) {
        console.log(`Notable throw: Round ${t.round}, ${t.player}, Score: ${t.score}, Notable: ${t.notable}`);
        notableCount++;
    }
    if (t.checkout) {
        console.log(`Checkout: Round ${t.round}, ${t.player}, Score: ${t.score}, Darts: ${t.checkout_darts}`);
        checkoutCount++;
    }
    if (t.closed_out) {
        console.log(`Closeout: Round ${t.round}, ${t.player}, Marks: ${t.marks}, Darts: ${t.closeout_darts}`);
        closeoutCount++;
    }
});

console.log(`\nSummary:`);
console.log(`- Notable throws: ${notableCount}`);
console.log(`- Checkouts: ${checkoutCount}`);
console.log(`- Closeouts: ${closeoutCount}`);

// Check a cricket leg
const cricketGame = games.find(g => g.legs.some(l => l.type?.toLowerCase().includes('cricket')));
if (cricketGame) {
    const cricketLeg = cricketGame.legs.find(l => l.type?.toLowerCase().includes('cricket'));
    console.log('\n=== First Cricket Leg ===');
    console.log(`Type: ${cricketLeg.type}`);

    let cricketNotableCount = 0;
    cricketLeg.throws.forEach(t => {
        if (t.notable) {
            console.log(`Cricket notable: Round ${t.round}, ${t.player}, Marks: ${t.marks}, Notable: ${t.notable}`);
            cricketNotableCount++;
        }
        if (t.closed_out) {
            console.log(`Cricket closeout: Round ${t.round}, ${t.player}, Marks: ${t.marks}, Darts: ${t.closeout_darts}`);
        }
    });
    console.log(`Cricket notable throws: ${cricketNotableCount}`);
}

console.log('\n✓ Test complete');
