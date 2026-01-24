/**
 * Test script to verify double-elimination bracket logic
 * Run with: node test-bracket-logic.js
 */

// Simulate the bracket generation logic
function testBracketGeneration(teamCount) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${teamCount} teams`);
    console.log('='.repeat(60));

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)));
    const byeCount = bracketSize - teamCount;
    const wcRounds = Math.log2(bracketSize);
    const lcRounds = (wcRounds - 1) * 2;

    console.log(`Bracket Size: ${bracketSize}`);
    console.log(`Byes: ${byeCount}`);
    console.log(`WC Rounds: ${wcRounds}`);
    console.log(`LC Rounds: ${lcRounds}`);

    // Winners Bracket R1
    const wcR1Matches = bracketSize / 2;
    console.log(`\nWinners Bracket Round 1: ${wcR1Matches} matches`);
    for (let i = 0; i < wcR1Matches; i++) {
        const lcPos = Math.floor(i / 2);
        console.log(`  WC R1 Match ${i} → Loser goes to LC R1 position ${lcPos}`);
    }

    // Losers Bracket structure
    console.log(`\nLosers Bracket Structure:`);
    let currentMatchCount = bracketSize / 4;
    for (let round = 1; round <= lcRounds; round++) {
        const isDropoutRound = round % 2 === 0 && round > 1;
        let matchesInRound;

        if (round === 1) {
            matchesInRound = bracketSize / 4;
        } else if (isDropoutRound) {
            matchesInRound = currentMatchCount;
        } else {
            currentMatchCount = Math.max(1, currentMatchCount / 2);
            matchesInRound = currentMatchCount;
        }

        const roundType = round === 1 ? 'initial' : (isDropoutRound ? 'dropout' : 'consolidation');
        console.log(`  LC R${round}: ${matchesInRound} matches (${roundType})`);
    }

    // Winners Bracket later rounds and LC mapping
    console.log(`\nWinners Bracket Rounds 2+ and LC mapping:`);
    let prevRoundMatches = wcR1Matches;
    for (let round = 2; round <= wcRounds; round++) {
        const roundMatches = prevRoundMatches / 2;
        const lcRound = (round - 1) * 2;
        console.log(`  WC R${round}: ${roundMatches} matches → Losers go to LC R${lcRound}`);
        prevRoundMatches = roundMatches;
    }

    // Verify LC has correct capacity
    console.log(`\nVerification:`);
    let totalWCLosers = 0;
    let wcMatchCount = wcR1Matches;
    for (let r = 1; r <= wcRounds - 1; r++) {
        totalWCLosers += wcMatchCount;
        wcMatchCount = wcMatchCount / 2;
    }
    console.log(`  Total WC losers (before finals): ${totalWCLosers}`);
    console.log(`  LC R1 capacity: ${bracketSize / 4 * 2} teams (${bracketSize / 4} matches)`);
    console.log(`  Last WC loser goes to Grand Finals`);

    return {
        bracketSize,
        byeCount,
        wcRounds,
        lcRounds,
        wcR1Matches,
        lcR1Matches: bracketSize / 4
    };
}

// Test cases
testBracketGeneration(8);  // Perfect power of 2
testBracketGeneration(6);  // Non-power of 2
testBracketGeneration(16); // Larger bracket
testBracketGeneration(3);  // Small bracket

console.log('\n' + '='.repeat(60));
console.log('All tests complete!');
console.log('='.repeat(60) + '\n');
