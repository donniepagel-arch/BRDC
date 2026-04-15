/**
 * Backfill missing throw flags for match documents
 *
 * Adds missing `notable`, `checkout_darts`, `closed_out`, and `closeout_darts`
 * flags to existing throw data in imported matches.
 *
 * Usage: node scripts/backfill-throw-flags.js
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'brdc-v2' });
const db = admin.firestore();

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const BATCH_LIMIT = 500;

// Notable detection functions (from parse-rtf.js)
function getX01Notable(score) {
    if (score === 180) return '180';
    if (score >= 171) return 'T80';  // Ton-80 (171-179)
    if (score >= 140) return 'TON+'; // Ton-40+ (140-169)
    if (score >= 100) return 'TON';  // Ton (100-139)
    if (score >= 95) return '95+';   // Near-ton (95-99)
    return null;
}

function getCricketNotable(marks) {
    if (marks >= 9) return '9M';
    if (marks === 8) return '8M';
    if (marks === 7) return '7M';
    if (marks === 6) return '6M';
    if (marks === 5) return '5M';
    return null;
}

// Determine if a game format is X01 (501, 301, 701, etc.)
function isX01Format(format) {
    if (!format) return false;
    const normalized = format.toLowerCase().trim();
    return normalized.includes('501') ||
           normalized.includes('301') ||
           normalized.includes('701') ||
           /^\d{3}$/.test(normalized);
}

// Determine if a game format is Cricket
function isCricketFormat(format) {
    if (!format) return false;
    return format.toLowerCase().includes('cricket');
}

// Estimate checkout darts from score data (fallback when not in data)
function estimateCheckoutDarts(throwData) {
    // If we have explicit checkout_darts, use it
    if (throwData.checkout_darts) return throwData.checkout_darts;

    // Fallback: assume 3 darts (conservative estimate)
    // In reality, this should come from the parser
    return 3;
}

// Process a single throw side (home or away)
function processThrowSide(throwData, isX01, isCricket, isLastThrow, isWinningSide) {
    let flagsAdded = 0;

    if (!throwData) return flagsAdded;

    // X01 processing
    if (isX01 && throwData.score != null) {
        // Add notable flag if score >= 95 and not already set
        if (!throwData.notable && throwData.score >= 95) {
            const notable = getX01Notable(throwData.score);
            if (notable) {
                throwData.notable = notable;
                flagsAdded++;
            }
        }

        // Add checkout flag if remaining === 0
        if (throwData.remaining === 0) {
            if (!throwData.checkout) {
                throwData.checkout = true;
                flagsAdded++;
            }

            // On last throw, set checkout_darts for winning side
            if (isLastThrow && isWinningSide && !throwData.checkout_darts) {
                throwData.checkout_darts = estimateCheckoutDarts(throwData);
                flagsAdded++;
            }
        }
    }

    // Cricket processing
    if (isCricket && throwData.marks != null) {
        // Add notable flag if marks >= 5 and not already set
        if (!throwData.notable && throwData.marks >= 5) {
            const notable = getCricketNotable(throwData.marks);
            if (notable) {
                throwData.notable = notable;
                flagsAdded++;
            }
        }

        // On last throw, set closeout flags for winning side
        if (isLastThrow && isWinningSide) {
            if (!throwData.closed_out) {
                throwData.closed_out = true;
                flagsAdded++;
            }

            if (!throwData.closeout_darts && throwData.marks) {
                // Estimate closeout darts based on marks
                // Full closeout with 9 marks = 3 darts, 6 marks = 2 darts, etc.
                // This is approximate - ideally comes from parser
                throwData.closeout_darts = throwData.marks >= 7 ? 3 : (throwData.marks >= 4 ? 2 : 1);
                flagsAdded++;
            }
        }
    }

    return flagsAdded;
}

// Process a single leg's throws
function processLegThrows(leg, format) {
    let flagsAdded = 0;

    if (!leg.throws || !Array.isArray(leg.throws) || leg.throws.length === 0) {
        return flagsAdded;
    }

    const isX01 = isX01Format(format);
    const isCricket = isCricketFormat(format);
    const winner = leg.winner; // "home" or "away"
    const lastThrowIndex = leg.throws.length - 1;

    leg.throws.forEach((throwObj, throwIndex) => {
        const isLastThrow = throwIndex === lastThrowIndex;

        // Process home side
        if (throwObj.home) {
            const isWinningSide = isLastThrow && winner === 'home';
            flagsAdded += processThrowSide(
                throwObj.home,
                isX01,
                isCricket,
                isLastThrow,
                isWinningSide
            );
        }

        // Process away side
        if (throwObj.away) {
            const isWinningSide = isLastThrow && winner === 'away';
            flagsAdded += processThrowSide(
                throwObj.away,
                isX01,
                isCricket,
                isLastThrow,
                isWinningSide
            );
        }
    });

    return flagsAdded;
}

// Process a single match document
function processMatchDocument(matchData) {
    let flagsAdded = 0;
    let gamesProcessed = 0;
    let legsProcessed = 0;

    if (!matchData.games || !Array.isArray(matchData.games)) {
        return { flagsAdded, gamesProcessed, legsProcessed };
    }

    matchData.games.forEach(game => {
        if (!game.legs || !Array.isArray(game.legs)) {
            return;
        }

        gamesProcessed++;
        const format = game.format || 'unknown';

        game.legs.forEach(leg => {
            legsProcessed++;
            flagsAdded += processLegThrows(leg, format);
        });
    });

    return { flagsAdded, gamesProcessed, legsProcessed };
}

// Main backfill function
async function backfillThrowFlags() {
    console.log('=== Backfill Throw Flags ===\n');
    console.log(`League ID: ${LEAGUE_ID}\n`);

    // Get all matches
    const matchesRef = db.collection('leagues').doc(LEAGUE_ID).collection('matches');
    const matchesSnap = await matchesRef.get();

    console.log(`Found ${matchesSnap.size} matches\n`);

    let totalMatches = 0;
    let totalGames = 0;
    let totalLegs = 0;
    let totalFlags = 0;
    let updatedMatches = 0;

    let batch = db.batch();
    let batchCount = 0;

    for (const matchDoc of matchesSnap.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();

        totalMatches++;

        // Process the match data in memory
        const result = processMatchDocument(matchData);

        totalGames += result.gamesProcessed;
        totalLegs += result.legsProcessed;
        totalFlags += result.flagsAdded;

        // Only write back if we added flags
        if (result.flagsAdded > 0) {
            updatedMatches++;
            batch.update(matchDoc.ref, { games: matchData.games });
            batchCount++;

            console.log(`✓ Match ${matchId}: ${result.gamesProcessed} games, ${result.legsProcessed} legs, ${result.flagsAdded} flags added`);

            // Commit batch if we hit the limit
            if (batchCount >= BATCH_LIMIT) {
                await batch.commit();
                console.log(`\n--- Committed batch of ${batchCount} updates ---\n`);
                batch = db.batch();
                batchCount = 0;
            }
        } else {
            console.log(`- Match ${matchId}: No flags needed (${result.gamesProcessed} games, ${result.legsProcessed} legs)`);
        }
    }

    // Commit remaining batch
    if (batchCount > 0) {
        await batch.commit();
        console.log(`\n--- Committed final batch of ${batchCount} updates ---\n`);
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total matches processed: ${totalMatches}`);
    console.log(`Total matches updated: ${updatedMatches}`);
    console.log(`Total games processed: ${totalGames}`);
    console.log(`Total legs processed: ${totalLegs}`);
    console.log(`Total flags added: ${totalFlags}`);
    console.log('\n✓ Backfill complete!');
}

// Run the backfill
backfillThrowFlags()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error during backfill:', error);
        process.exit(1);
    });
