const { test, expect } = require('@playwright/test');

// =============================================================================
// Week 4: D. Pagel vs N. Mezlak - Full Triples League Match
// =============================================================================
//
// Match format: 9 sets, each best of 3 legs
// Home: D. Pagel (Donnie Pagel A, Matthew Wentz B, Jennifer Malek C)
// Away: N. Mezlak (Nick Mezlak A, Cory Jacobs B, Dillon Ulisses C)
//
// Strategy:
//   Sets 1-5, 7 (cricket & mixed): submitted via cloud function
//   Sets 6, 8, 9 (501 double out): played visually through the x01 scorer
//
// Expected results:
//   Set 1 (AB Mixed): Home 2-1    | running: 1-0
//   Set 2 (C Cricket): Away 2-0   | running: 1-1
//   Set 3 (A Cricket): Home 2-1   | running: 2-1
//   Set 4 (BC Mixed): Away 2-1    | running: 2-2
//   Set 5 (B Cricket): Away 2-0   | running: 2-3
//   Set 6 (A 501 DO): Home 2-1    | running: 3-3
//   Set 7 (AC Mixed): Home 2-1    | running: 4-3
//   Set 8 (B 501 DO): Away 2-1    | running: 4-4
//   Set 9 (C 501 DO): Home 2-0    | running: 5-4  => D. Pagel wins!
// =============================================================================

const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';
const MATCH_ID = 'zRWjWDe2qw7R8MC7K81i';
const ADMIN_PIN = '39632911';
const CF_BASE = 'https://us-central1-brdc-v2.cloudfunctions.net';

// Home roster
const HOME_TEAM_NAME = 'D. Pagel';
const HOME_P1 = { id: 'X2DMb9bP4Q8fy9yr5Fam', name: 'Donnie Pagel', level: 'A' };
const HOME_P2 = { id: 'TJ3uwMdslbtpjtq17xW4', name: 'Matthew Wentz', level: 'B' };
const HOME_P3 = { id: '7Hj4KWNpm0GviTYbwfbM', name: 'Jennifer Malek', level: 'C' };

// Away roster
const AWAY_TEAM_NAME = 'N. Mezlak';
const AWAY_P1 = { id: 'yGcBLDcTwgHtWmZEg3TG', name: 'Nick Mezlak', level: 'A' };
const AWAY_P2 = { id: '8f52A1dwRB4eIU5UyQZo', name: 'Cory Jacobs', level: 'B' };
const AWAY_P3 = { id: 'dFmalrT5BMdaTOUUVTOZ', name: 'Dillon Ulisses', level: 'C' };

// ---------------------------------------------------------------------------
// Helper: populate games array in the match document via admin SDK script
// ---------------------------------------------------------------------------
async function startMatch() {
    const { execSync } = require('child_process');
    const result = execSync(
        `node helpers/start-match.js ${LEAGUE_ID} ${MATCH_ID}`,
        { cwd: 'C:\\Users\\gcfrp\\projects\\brdc-firebase\\tests', encoding: 'utf8', timeout: 15000 }
    );
    console.log(result.trim());
}

// ---------------------------------------------------------------------------
// Helper: submit a game result via the cloud function (for cricket / mixed sets)
// ---------------------------------------------------------------------------
async function submitViaCloudFunction(gameNumber, winner, homeLegsWon, awayLegsWon, gameStats) {
    const payload = {
        league_id: LEAGUE_ID,
        match_id: MATCH_ID,
        game_number: gameNumber,
        winner,
        home_legs_won: homeLegsWon,
        away_legs_won: awayLegsWon,
        admin_pin: ADMIN_PIN,
        game_stats: gameStats
    };

    const resp = await fetch(`${CF_BASE}/submitGameResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`submitGameResult failed for game ${gameNumber}: ${resp.status} ${text}`);
    }

    const result = await resp.json();
    if (!result.success) {
        throw new Error(`submitGameResult returned error for game ${gameNumber}: ${result.error}`);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Helper: enter a score in the x01 scorer
// ---------------------------------------------------------------------------
async function enterScore(page, score) {
    await page.evaluate((s) => window.submitScore(s), score);
    await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Helper: build x01 scorer URL
// ---------------------------------------------------------------------------
function buildScorerUrl(gameNumber, homePlayers, awayPlayers) {
    const params = new URLSearchParams({
        league_id: LEAGUE_ID,
        match_id: MATCH_ID,
        game_number: String(gameNumber),
        from_match: 'true',
        total_games: '9',
        starting_score: '501',
        format: '501',
        checkout: 'double',
        in_rule: 'straight',
        legs_to_win: '2',
        cork: 'false',
        home_team_name: HOME_TEAM_NAME,
        away_team_name: AWAY_TEAM_NAME,
        admin_pin: ADMIN_PIN,
        home_players: JSON.stringify(homePlayers),
        away_players: JSON.stringify(awayPlayers)
    });
    return `/pages/x01-scorer.html?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Helper: play a single 501 set (best of 3 legs) through the visual scorer
//
// legDefs is an array of objects, one per leg:
//   { winner: 'home'|'away', rounds: [[homeScore, awayScore], ...] }
//
// In the final round the winner's score is a checkout that brings them to 0.
// The loser may or may not throw in that final round.
// ---------------------------------------------------------------------------
async function play501Set(page, gameNumber, homePlayers, awayPlayers, legDefs) {
    const url = buildScorerUrl(gameNumber, homePlayers, awayPlayers);
    await page.goto(url);
    await page.waitForSelector('#scoreInput', { timeout: 15000 });

    // Dismiss the starter/ready modal
    const readyBtn = page.locator(
        '#noCorkSection button:has-text("READY"), #starterReadyPhase button:has-text("READY")'
    );
    await readyBtn.first().waitFor({ state: 'visible', timeout: 8000 });
    await readyBtn.first().click();
    await page.waitForTimeout(800);

    let homeLegsWon = 0;
    let awayLegsWon = 0;

    for (let legIdx = 0; legIdx < legDefs.length; legIdx++) {
        const leg = legDefs[legIdx];
        const isLastLeg = (legIdx === legDefs.length - 1);

        console.log(`  Set ${gameNumber}, Leg ${legIdx + 1}: expecting ${leg.winner} to win`);

        // Enter scores round by round
        for (let rIdx = 0; rIdx < leg.rounds.length; rIdx++) {
            const [homeScore, awayScore] = leg.rounds[rIdx];

            // Home throws
            if (homeScore !== null) {
                await enterScore(page, homeScore);
            }

            // Check if that was a checkout (dartsModal appears)
            const dartsModalAfterHome = page.locator('#dartsModal.active');
            if (await dartsModalAfterHome.isVisible({ timeout: 400 }).catch(() => false)) {
                await page.locator('#dartBtn3').click();
                await page.waitForTimeout(400);

                // Confirm game modal
                const confirmModal = page.locator('#confirmGameModal.active');
                if (await confirmModal.isVisible({ timeout: 400 }).catch(() => false)) {
                    await page.locator('#confirmGameModal button:has-text("CONFIRM")').click();
                    await page.waitForTimeout(600);
                }

                // If set is won: gameModal with SAVE RESULT
                if (leg.winner === 'home') {
                    homeLegsWon++;
                    if (homeLegsWon >= 2) {
                        // This was the set-winning leg
                        const gameModal = page.locator('#gameModal');
                        await gameModal.waitFor({ state: 'visible', timeout: 5000 });
                        await page.locator('#gameModal button:has-text("SAVE RESULT")').click();
                        await page.waitForTimeout(3000);
                        return; // done with this set
                    }
                    // Leg won but set not over - legModal shows then next leg starts
                    const legModal = page.locator('#legModal');
                    if (await legModal.isVisible({ timeout: 1500 }).catch(() => false)) {
                        await page.locator('#legModal button:has-text("NEXT LEG")').click();
                        await page.waitForTimeout(800);
                    }
                }
                break; // remaining rounds in this leg are done
            }

            // Away throws (if present)
            if (awayScore !== null) {
                await enterScore(page, awayScore);
            }

            // Check if away checkout
            const dartsModalAfterAway = page.locator('#dartsModal.active');
            if (await dartsModalAfterAway.isVisible({ timeout: 400 }).catch(() => false)) {
                await page.locator('#dartBtn3').click();
                await page.waitForTimeout(400);

                const confirmModal = page.locator('#confirmGameModal.active');
                if (await confirmModal.isVisible({ timeout: 400 }).catch(() => false)) {
                    await page.locator('#confirmGameModal button:has-text("CONFIRM")').click();
                    await page.waitForTimeout(600);
                }

                if (leg.winner === 'away') {
                    awayLegsWon++;
                    if (awayLegsWon >= 2) {
                        const gameModal = page.locator('#gameModal');
                        await gameModal.waitFor({ state: 'visible', timeout: 5000 });
                        await page.locator('#gameModal button:has-text("SAVE RESULT")').click();
                        await page.waitForTimeout(3000);
                        return;
                    }
                    const legModal = page.locator('#legModal');
                    if (await legModal.isVisible({ timeout: 1500 }).catch(() => false)) {
                        await page.locator('#legModal button:has-text("NEXT LEG")').click();
                        await page.waitForTimeout(800);
                    }
                }
                break;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Pre-built leg data for the three 501 sets
// ---------------------------------------------------------------------------
// Each leg: { winner, rounds: [[homeScore, awayScore], ...] }
// The winning player's scores sum to exactly 501.
// The checkout score must be even and <= 170 for valid double-out.
// If the winner checks out before the loser throws in the final round,
// use null for the loser's score in that round.

// SET 6: Donnie (A, ~50 avg) vs Nick (A, ~50 avg) -- Home wins 2-1
const SET6_LEGS = [
    // Leg 1: Home wins. Home total = 85+60+100+60+80+60+56 = 501 (checkout 56 = D28)
    {
        winner: 'home',
        rounds: [
            [85, 60],
            [60, 100],
            [100, 45],
            [60, 81],
            [80, 60],
            [60, 85],
            [56, null]  // checkout D28, away doesn't throw
        ]
    },
    // Leg 2: Away wins. Away total = 100+85+60+60+100+56+40 = 501 (checkout 40 = D20)
    {
        winner: 'away',
        rounds: [
            [60, 100],
            [100, 85],
            [45, 60],
            [81, 60],
            [60, 100],
            [45, 56],
            [60, 40]  // away checkout D20
        ]
    },
    // Leg 3: Home wins. Home total = 100+60+85+60+100+60+36 = 501 (checkout 36 = D18)
    {
        winner: 'home',
        rounds: [
            [100, 60],
            [60, 85],
            [85, 45],
            [60, 100],
            [100, 60],
            [60, 45],
            [36, null]  // checkout D18
        ]
    }
];

// SET 8: Matthew (B, ~40 avg) vs Cory (B, ~40 avg) -- Away wins 2-1
const SET8_LEGS = [
    // Leg 1: Home wins. Home total = 45+60+41+85+26+60+45+41+60+38 = 501 (checkout 38 = D19)
    {
        winner: 'home',
        rounds: [
            [45, 60],
            [60, 41],
            [41, 45],
            [85, 60],
            [26, 26],
            [60, 45],
            [45, 55],
            [41, 60],
            [60, 41],
            [38, null]  // checkout D19
        ]
    },
    // Leg 2: Away wins. Away total = 60+45+85+41+60+26+45+41+60+38 = 501 (checkout 38 = D19)
    {
        winner: 'away',
        rounds: [
            [41, 60],
            [60, 45],
            [45, 85],
            [60, 41],
            [26, 60],
            [55, 26],
            [45, 45],
            [41, 41],
            [60, 60],
            [26, 38]  // away checkout D19
        ]
    },
    // Leg 3: Away wins. Away total = 45+60+85+60+41+55+45+60+26+24 = 501 (checkout 24 = D12)
    {
        winner: 'away',
        rounds: [
            [60, 45],
            [41, 60],
            [60, 85],
            [26, 60],
            [45, 41],
            [41, 55],
            [55, 45],
            [60, 60],
            [45, 26],
            [26, 24]  // away checkout D12
        ]
    }
];

// SET 9: Jennifer (C, ~30 avg) vs Dillon (C, ~30 avg) -- Home wins 2-0
const SET9_LEGS = [
    // Leg 1: Home wins. Home total = 26+45+20+41+36+21+26+60+30+26+26+41+45+26+12+20 = 501
    // Let me recalculate: 26+45+20+41+36+21+26+60+30+26+26+41+45+26+12+20 = 501
    // Checkout 20 = D10
    {
        winner: 'home',
        rounds: [
            [26, 20],
            [45, 26],
            [20, 41],
            [41, 15],
            [36, 30],
            [21, 26],
            [26, 45],
            [60, 20],
            [30, 36],
            [26, 21],
            [26, 26],
            [41, 15],
            [45, 41],
            [26, 20],
            [12, 26],
            [20, null]  // checkout D10
        ]
    },
    // Leg 2: Home wins. Home total = 41+26+30+45+20+36+26+41+21+45+26+60+26+26+12+20 = 501
    // Checkout 20 = D10
    {
        winner: 'home',
        rounds: [
            [41, 26],
            [26, 30],
            [30, 20],
            [45, 41],
            [20, 26],
            [36, 45],
            [26, 15],
            [41, 36],
            [21, 20],
            [45, 41],
            [26, 26],
            [60, 30],
            [26, 26],
            [26, 20],
            [12, 15],
            [20, null]  // checkout D10
        ]
    }
];

// Verify score totals (sanity check at test definition time)
function verifyLeg(legDef, label) {
    let homeTotal = 0;
    let awayTotal = 0;
    for (const [h, a] of legDef.rounds) {
        if (h !== null) homeTotal += h;
        if (a !== null) awayTotal += a;
    }
    const winnerTotal = legDef.winner === 'home' ? homeTotal : awayTotal;
    if (winnerTotal !== 501) {
        throw new Error(`${label}: ${legDef.winner} total is ${winnerTotal}, expected 501`);
    }
}

// Run verification
SET6_LEGS.forEach((l, i) => verifyLeg(l, `Set6 Leg${i + 1}`));
SET8_LEGS.forEach((l, i) => verifyLeg(l, `Set8 Leg${i + 1}`));
SET9_LEGS.forEach((l, i) => verifyLeg(l, `Set9 Leg${i + 1}`));

// ---------------------------------------------------------------------------
// Cloud function game stats builders
// ---------------------------------------------------------------------------
function buildMixedGameStats(durationSec, homeAvg, awayAvg) {
    return {
        game_type: 'mixed',
        duration_seconds: durationSec,
        home: { average: homeAvg },
        away: { average: awayAvg },
        legs: []
    };
}

function buildCricketGameStats(durationSec, homeMpr, awayMpr) {
    return {
        game_type: 'cricket',
        duration_seconds: durationSec,
        home: { mpr: homeMpr },
        away: { mpr: awayMpr },
        legs: []
    };
}

// =============================================================================
// THE TEST
// =============================================================================

test.describe('Week 4: D. Pagel vs N. Mezlak - Full Match', () => {
    test.setTimeout(300000); // 5 minutes for the full match

    test('score all 9 sets of the match', async ({ page }) => {

        // =====================================================================
        // PHASE 1: Submit sets 1-5 via cloud function
        // =====================================================================

        // Start the match first (populates the games array)
        console.log('=== Starting match (populating games array) ===');
        await startMatch();

        console.log('=== PHASE 1: Cloud Function submissions (Sets 1-5) ===');

        // Set 1: AB Doubles Mixed - Donnie+Matthew vs Nick+Cory - Home wins 2-1
        console.log('Set 1 (AB Mixed): Home wins 2-1');
        await submitViaCloudFunction(1, 'home', 2, 1,
            buildMixedGameStats(720, 46.8, 43.5)
        );

        // Set 2: C Singles Cricket - Jennifer vs Dillon - Away wins 2-0
        console.log('Set 2 (C Cricket): Away wins 2-0');
        await submitViaCloudFunction(2, 'away', 0, 2,
            buildCricketGameStats(540, 1.62, 1.89)
        );

        // Set 3: A Singles Cricket - Donnie vs Nick - Home wins 2-1
        console.log('Set 3 (A Cricket): Home wins 2-1');
        await submitViaCloudFunction(3, 'home', 2, 1,
            buildCricketGameStats(660, 2.45, 2.31)
        );

        // Set 4: BC Doubles Mixed - Matthew+Jennifer vs Cory+Dillon - Away wins 2-1
        console.log('Set 4 (BC Mixed): Away wins 2-1');
        await submitViaCloudFunction(4, 'away', 1, 2,
            buildMixedGameStats(780, 38.2, 40.7)
        );

        // Set 5: B Singles Cricket - Matthew vs Cory - Away wins 2-0
        console.log('Set 5 (B Cricket): Away wins 2-0');
        await submitViaCloudFunction(5, 'away', 0, 2,
            buildCricketGameStats(480, 1.85, 2.12)
        );

        console.log('Phase 1 complete. Score: Home 2 - Away 3');

        // =====================================================================
        // PHASE 2: Play set 6 visually (A Singles 501 DO)
        // =====================================================================

        console.log('\n=== PHASE 2: Visual scorer - Set 6 (A 501 DO) ===');
        console.log('Donnie Pagel vs Nick Mezlak - Home wins 2-1');

        await play501Set(
            page,
            6, // game_number
            [{ name: HOME_P1.name }],
            [{ name: AWAY_P1.name }],
            SET6_LEGS
        );

        console.log('Set 6 saved. Score: Home 3 - Away 3');

        // =====================================================================
        // PHASE 3: Submit set 7 via cloud function
        // =====================================================================

        console.log('\n=== PHASE 3: Cloud Function submission (Set 7) ===');

        // Set 7: AC Doubles Mixed - Donnie+Jennifer vs Nick+Dillon - Home wins 2-1
        console.log('Set 7 (AC Mixed): Home wins 2-1');
        await submitViaCloudFunction(7, 'home', 2, 1,
            buildMixedGameStats(690, 44.1, 41.8)
        );

        console.log('Phase 3 complete. Score: Home 4 - Away 3');

        // =====================================================================
        // PHASE 4: Play set 8 visually (B Singles 501 DO)
        // =====================================================================

        console.log('\n=== PHASE 4: Visual scorer - Set 8 (B 501 DO) ===');
        console.log('Matthew Wentz vs Cory Jacobs - Away wins 2-1');

        await play501Set(
            page,
            8,
            [{ name: HOME_P2.name }],
            [{ name: AWAY_P2.name }],
            SET8_LEGS
        );

        console.log('Set 8 saved. Score: Home 4 - Away 4');

        // =====================================================================
        // PHASE 5: Play set 9 visually (C Singles 501 DO) - THE DECIDER
        // =====================================================================

        console.log('\n=== PHASE 5: Visual scorer - Set 9 (C 501 DO) - MATCH DECIDER ===');
        console.log('Jennifer Malek vs Dillon Ulisses - Home wins 2-0');

        await play501Set(
            page,
            9,
            [{ name: HOME_P3.name }],
            [{ name: AWAY_P3.name }],
            SET9_LEGS
        );

        console.log('Set 9 saved. FINAL SCORE: Home 5 - Away 4');
        console.log('\n=== MATCH COMPLETE: D. Pagel wins 5-4! ===');

        // =====================================================================
        // VERIFICATION: Navigate to match hub and check the result
        // =====================================================================

        console.log('\nNavigating to match hub for verification...');
        await page.goto(
            `/pages/match-hub.html?league_id=${LEAGUE_ID}&match_id=${MATCH_ID}`,
            { waitUntil: 'domcontentloaded', timeout: 30000 }
        );

        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/week4-match-complete.png' });

        console.log('Match scoring complete. Screenshot saved.');
    });
});
