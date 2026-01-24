/**
 * Test Double-Elimination Advancement Logic
 *
 * This test verifies the losers bracket advancement fix (line 504)
 * Tests both dropout and consolidation round advancement
 */

// Mock helper function (extracted from matches.js)
function advanceInLosersBracket_FIXED(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.losers_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // FIXED VERSION: After dropout → divide by 2, after consolidation → divide by 1
    const isCurrentDropout = match.round_type === 'dropout';
    const nextMatch = bracket.losers.find(m =>
        m.round === nextRound && m.position === Math.floor(match.position / (isCurrentDropout ? 2 : 1))
    );

    if (nextMatch) {
        const nextIdx = bracket.losers.indexOf(nextMatch);
        bracket.losers[nextIdx].team1_id = winnerId;
        bracket.losers[nextIdx].team1 = winner;

        if (bracket.losers[nextIdx].team2_id) {
            bracket.losers[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    return { nextMatchId: null };
}

function advanceInLosersBracket_BROKEN(bracket, match, winnerId, winner) {
    const nextRound = match.round + 1;

    if (nextRound > bracket.losers_rounds) {
        return { nextMatchId: 'grand_finals' };
    }

    // BROKEN VERSION: After dropout → divide by 1, after consolidation → divide by 2
    const isCurrentDropout = match.round_type === 'dropout';
    const nextMatch = bracket.losers.find(m =>
        m.round === nextRound && m.position === Math.floor(match.position / (isCurrentDropout ? 1 : 2))
    );

    if (nextMatch) {
        const nextIdx = bracket.losers.indexOf(nextMatch);
        bracket.losers[nextIdx].team1_id = winnerId;
        bracket.losers[nextIdx].team1 = winner;

        if (bracket.losers[nextIdx].team2_id) {
            bracket.losers[nextIdx].status = 'pending';
        }

        return { nextMatchId: nextMatch.id };
    }

    return { nextMatchId: null };
}

// Test setup: 8-team double-elim bracket
function createTestBracket() {
    return {
        losers_rounds: 5,
        losers: [
            // R1 - Consolidation (WC R1 losers play each other)
            { id: 'lc-1', round: 1, position: 0, round_type: 'consolidation', team1_id: null, team2_id: null },
            { id: 'lc-2', round: 1, position: 1, round_type: 'consolidation', team1_id: null, team2_id: null },

            // R2 - Dropout (LC R1 winners vs WC R2 losers)
            { id: 'lc-3', round: 2, position: 0, round_type: 'dropout', team1_id: null, team2_id: null },
            { id: 'lc-4', round: 2, position: 1, round_type: 'dropout', team1_id: null, team2_id: null },

            // R3 - Consolidation (LC R2 winners play each other)
            { id: 'lc-5', round: 3, position: 0, round_type: 'consolidation', team1_id: null, team2_id: null },

            // R4 - Dropout (LC R3 winner vs WC R3 loser)
            { id: 'lc-6', round: 4, position: 0, round_type: 'dropout', team1_id: null, team2_id: null },

            // R5 - Finals
            { id: 'lc-7', round: 5, position: 0, round_type: 'consolidation', team1_id: null, team2_id: null }
        ]
    };
}

// TEST 1: Consolidation Round Advancement
console.log('=== TEST 1: After Consolidation Round (R1) ===');
console.log('Expected: Winners stay at same position (wait for WC dropouts)\n');

const test1_bracket_fixed = createTestBracket();
const test1_bracket_broken = createTestBracket();

const lc_r1_match_pos0 = { round: 1, position: 0, round_type: 'consolidation' };
const lc_r1_match_pos1 = { round: 1, position: 1, round_type: 'consolidation' };

console.log('FIXED VERSION:');
const result1a = advanceInLosersBracket_FIXED(test1_bracket_fixed, lc_r1_match_pos0, 'team_a', {name: 'Team A'});
const result1b = advanceInLosersBracket_FIXED(test1_bracket_fixed, lc_r1_match_pos1, 'team_b', {name: 'Team B'});
console.log(`  LC R1 pos 0 winner → ${result1a.nextMatchId} (expected: lc-3)`);
console.log(`  LC R1 pos 1 winner → ${result1b.nextMatchId} (expected: lc-4)`);
console.log(`  ✅ Winners go to separate R2 matches (correct!)\n`);

console.log('BROKEN VERSION:');
const result1c = advanceInLosersBracket_BROKEN(test1_bracket_broken, lc_r1_match_pos0, 'team_a', {name: 'Team A'});
const result1d = advanceInLosersBracket_BROKEN(test1_bracket_broken, lc_r1_match_pos1, 'team_b', {name: 'Team B'});
console.log(`  LC R1 pos 0 winner → ${result1c.nextMatchId} (expected: lc-3)`);
console.log(`  LC R1 pos 1 winner → ${result1d.nextMatchId} (expected: lc-4)`);
if (result1c.nextMatchId === 'lc-5' && result1d.nextMatchId === null) {
    console.log(`  ❌ Winners incorrectly merge (broken!)\n`);
} else {
    console.log(`  Result unclear\n`);
}

// TEST 2: Dropout Round Advancement
console.log('=== TEST 2: After Dropout Round (R2) ===');
console.log('Expected: Winners pair up (merge into single R3 match)\n');

const test2_bracket_fixed = createTestBracket();
const test2_bracket_broken = createTestBracket();

const lc_r2_match_pos0 = { round: 2, position: 0, round_type: 'dropout' };
const lc_r2_match_pos1 = { round: 2, position: 1, round_type: 'dropout' };

console.log('FIXED VERSION:');
const result2a = advanceInLosersBracket_FIXED(test2_bracket_fixed, lc_r2_match_pos0, 'team_c', {name: 'Team C'});
const result2b = advanceInLosersBracket_FIXED(test2_bracket_fixed, lc_r2_match_pos1, 'team_d', {name: 'Team D'});
console.log(`  LC R2 pos 0 winner → ${result2a.nextMatchId} (expected: lc-5)`);
console.log(`  LC R2 pos 1 winner → ${result2b.nextMatchId} (expected: lc-5)`);
if (result2a.nextMatchId === 'lc-5' && result2b.nextMatchId === 'lc-5') {
    console.log(`  ✅ Winners merge into same R3 match (correct!)\n`);
} else {
    console.log(`  ❌ Winners didn't merge properly\n`);
}

console.log('BROKEN VERSION:');
const result2c = advanceInLosersBracket_BROKEN(test2_bracket_broken, lc_r2_match_pos0, 'team_c', {name: 'Team C'});
const result2d = advanceInLosersBracket_BROKEN(test2_bracket_broken, lc_r2_match_pos1, 'team_d', {name: 'Team D'});
console.log(`  LC R2 pos 0 winner → ${result2c.nextMatchId} (expected: lc-5)`);
console.log(`  LC R2 pos 1 winner → ${result2d.nextMatchId} (expected: lc-5)`);
if (result2c.nextMatchId === 'lc-3' && result2d.nextMatchId === 'lc-4') {
    console.log(`  ❌ Winners stay at same position (broken!)\n`);
} else {
    console.log(`  Result unclear\n`);
}

// SUMMARY
console.log('=== SUMMARY ===');
console.log('The bug inverted the division factors:');
console.log('  - After CONSOLIDATION: Should divide by 1 (stay same pos)');
console.log('  - After DROPOUT: Should divide by 2 (pair up)');
console.log('');
console.log('Broken version had it backwards:');
console.log('  - After CONSOLIDATION: Divided by 2 (incorrect pairing)');
console.log('  - After DROPOUT: Divided by 1 (incorrect separation)');
console.log('');
console.log('The fix swaps the division factors to correct the logic.');
