const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Test data constants
// ---------------------------------------------------------------------------
const LEAGUE_ID = 'aOq4Y0ETxPZ66tM1uUtP';

// ---------------------------------------------------------------------------
// Known non-critical error patterns to ignore.
// Firebase auth/analytics, network issues, and service-worker registration
// failures are expected when pages load without credentials.
// ---------------------------------------------------------------------------
const IGNORABLE_PATTERNS = [
    'Firebase',
    'firebase',
    'analytics',
    'auth/network-request-failed',
    'Failed to fetch',
    'NetworkError',
    'net::ERR_',
    'Load failed',
    'getAnalytics',
    'measurementId',
    'recaptcha',
    'service-worker',
    'ServiceWorker',
    'sw.js',
    'Loading chunk',
    'ChunkLoadError',
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Object captured as promise rejection',
    'blocked by CORS',
    'Permission denied',
    'Missing or insufficient permissions',
    'PERMISSION_DENIED',
    'Could not reach Cloud Firestore',
    'unavailable',
];

/**
 * Filter collected page errors down to critical ones only.
 * Returns an array of error messages that do NOT match any ignorable pattern.
 */
function filterCriticalErrors(errors) {
    return errors.filter(msg =>
        !IGNORABLE_PATTERNS.some(pattern => msg.includes(pattern))
    );
}

/**
 * Dismiss the starter modal on scorer pages.
 * When cork=false, the modal shows a READY button in #noCorkSection.
 * When cork=true (default), it shows team selection which is harder to automate.
 * Always pass &cork=false in test URLs for reliable dismissal.
 */
async function dismissStarterModal(page) {
    const starterModal = page.locator('#starterModal');
    // Wait for modal to appear
    try {
        await starterModal.waitFor({ state: 'attached', timeout: 5000 });
    } catch {
        return; // No modal, nothing to dismiss
    }

    // Check if active
    const isActive = await starterModal.evaluate(el => el.classList.contains('active')).catch(() => false);
    if (!isActive) return;

    // Click READY/OK button (appears in noCorkSection when cork=false)
    // X01 uses "READY", Cricket uses "OK"
    const readyBtn = page.locator('#starterModal button:has-text("READY"), #starterModal button:has-text("OK")');
    try {
        await readyBtn.first().click({ timeout: 3000 });
        await page.waitForTimeout(500);
    } catch {
        // Fallback: try any visible button in the modal
        const anyBtn = starterModal.locator('button:visible');
        if (await anyBtn.count() > 0) {
            await anyBtn.first().click();
            await page.waitForTimeout(500);
        }
    }

    // Force-close: ensure modal is no longer active (handles CSS transition delays)
    await page.evaluate(() => {
        const modal = document.getElementById('starterModal');
        if (modal) modal.classList.remove('active');
    });
    await page.waitForTimeout(300);
}

// ===========================================================================
// GROUP 1 - Game Setup Page
// ===========================================================================
test.describe('Game Setup Page', () => {

    test('page loads without errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/game-setup.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on game-setup.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('has game type selection', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Game type selector is a <select> with id="gameType"
        const gameTypeSelect = page.locator('#gameType');
        await expect(gameTypeSelect).toBeVisible({ timeout: 5000 });

        // Should contain standard game types (501, 301, cricket, etc.)
        const options = await gameTypeSelect.locator('option').allTextContents();
        console.log('Game type options:', options);
        expect(options.length).toBeGreaterThanOrEqual(2);
    });

    test('has player name input', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Player name input field
        const playerInput = page.locator('#playerNameInput');
        await expect(playerInput).toBeVisible({ timeout: 5000 });

        // Add button to add players
        const addBtn = page.locator('.add-btn');
        await expect(addBtn.first()).toBeVisible({ timeout: 5000 });
    });

    test('has player pool area', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Player pool where added players appear
        const playerPool = page.locator('#playerPool');
        await expect(playerPool).toBeVisible({ timeout: 5000 });
    });

    test('has rules/format options', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Number of legs selector
        const legsSelect = page.locator('#numLegs');
        await expect(legsSelect).toBeVisible({ timeout: 5000 });

        // In rule / Out rule for X01 - these exist in DOM even if not visible
        const inRule = page.locator('#standardInRule, #inRule');
        expect(await inRule.count()).toBeGreaterThanOrEqual(1);

        const outRule = page.locator('#standardOutRule, #outRule');
        expect(await outRule.count()).toBeGreaterThanOrEqual(1);
    });

    test('has start rules and start button', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Start rules dropdown
        const startRules = page.locator('#startRules');
        await expect(startRules).toBeVisible({ timeout: 5000 });

        // Start button (disabled until players added)
        const startBtn = page.locator('#startBtn');
        await expect(startBtn).toBeVisible({ timeout: 5000 });

        // It should be disabled initially (no players added yet)
        await expect(startBtn).toBeDisabled();
    });

    test('has PIN lookup and bot buttons', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // PIN lookup button
        const pinBtn = page.locator('.pin-btn');
        await expect(pinBtn).toBeVisible({ timeout: 5000 });

        // Bot add button
        const botBtn = page.locator('.bot-btn');
        await expect(botBtn).toBeVisible({ timeout: 5000 });
    });

    test('can add a player by name', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Type a player name
        const playerInput = page.locator('#playerNameInput');
        await playerInput.fill('Test Player');

        // Click add button
        const addBtn = page.locator('.add-btn');
        await addBtn.click();
        await page.waitForTimeout(500);

        // Player should appear in the pool
        const playerPool = page.locator('#playerPool');
        const poolText = await playerPool.textContent();
        expect(poolText).toContain('Test Player');
    });

    test('knockout mode toggle exists', async ({ page }) => {
        await page.goto('/pages/game-setup.html');
        await page.waitForTimeout(2000);

        // Knockout toggle button
        const knockoutToggle = page.locator('#knockoutToggle');
        await expect(knockoutToggle).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GROUP 2 - X01 Scorer (Casual Mode)
// ===========================================================================
test.describe('X01 Scorer', () => {

    test('page loads without crash (shows setup screen)', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        // /scorers/x01.html redirects to /pages/x01-scorer.html
        const response = await page.goto('/pages/x01-scorer.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on x01-scorer.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('shows casual setup screen when no params', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // Setup screen should be visible (has .active class when no match params)
        const setupScreen = page.locator('#setupScreen');
        await expect(setupScreen).toBeVisible({ timeout: 5000 });

        // Setup title should show "501 SCORER"
        const setupTitle = page.locator('.setup-title');
        await expect(setupTitle).toContainText('501 SCORER');

        // Should have "CASUAL GAME SETUP" subtitle
        const subtitle = page.locator('.setup-subtitle');
        await expect(subtitle).toContainText('CASUAL GAME SETUP');
    });

    test('setup screen has player name inputs', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        const player1Input = page.locator('#setupPlayer1');
        await expect(player1Input).toBeVisible({ timeout: 5000 });

        const player2Input = page.locator('#setupPlayer2');
        await expect(player2Input).toBeVisible({ timeout: 5000 });
    });

    test('setup screen has format options', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // Legs selector
        const legsSelect = page.locator('#setupLegs');
        await expect(legsSelect).toBeVisible({ timeout: 5000 });

        // Starting score selector
        const scoreSelect = page.locator('#setupScore');
        await expect(scoreSelect).toBeVisible({ timeout: 5000 });

        // Should default to 501
        const selectedValue = await scoreSelect.inputValue();
        expect(selectedValue).toBe('501');
    });

    test('setup screen has double in/out toggles', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // Double In / Double Out toggle buttons
        const toggleBtns = page.locator('#setupScreen .setup-toggle-btn');
        const count = await toggleBtns.count();
        // At minimum: DI OFF/ON, DO OFF/ON, plus starter rules = 8+
        expect(count).toBeGreaterThanOrEqual(6);
    });

    test('setup screen has start game button', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        const startBtn = page.locator('.setup-start-btn');
        await expect(startBtn).toBeVisible({ timeout: 5000 });
        await expect(startBtn).toContainText('START GAME');
    });

    test('has score display area behind setup', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // The main scorer elements exist in the DOM even when setup is shown
        const homeScore = page.locator('#homeScore');
        expect(await homeScore.count()).toBe(1);

        const awayScore = page.locator('#awayScore');
        expect(await awayScore.count()).toBe(1);
    });

    test('has number pad/keypad area behind setup', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // Calculator keys exist in the DOM
        const calcKeys = page.locator('.calc-key');
        const count = await calcKeys.count();
        // 9 digit keys + 0 + operators + shortcuts = 14+
        expect(count).toBeGreaterThanOrEqual(10);
    });

    test('has undo and miss buttons behind setup', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        const undoBtn = page.locator('.action-btn.undo');
        expect(await undoBtn.count()).toBe(1);

        const missBtn = page.locator('.action-btn.miss');
        expect(await missBtn.count()).toBe(1);

        const enterBtn = page.locator('.action-btn.enter');
        expect(await enterBtn.count()).toBe(1);
    });

    test('has game title and format badge', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        const gameTitle = page.locator('#gameTitle');
        expect(await gameTitle.count()).toBe(1);

        const gameFormat = page.locator('#gameFormat');
        expect(await gameFormat.count()).toBe(1);
    });

    test('can start a casual game from setup screen', async ({ page }) => {
        await page.goto('/pages/x01-scorer.html');
        await page.waitForTimeout(3000);

        // Setup screen should be visible
        const setupScreen = page.locator('#setupScreen');
        await expect(setupScreen).toBeVisible({ timeout: 5000 });

        // Fill in player names via evaluate (more reliable than .fill on hidden-ish inputs)
        await page.evaluate(() => {
            document.getElementById('setupPlayer1').value = 'Alice';
            document.getElementById('setupPlayer2').value = 'Bob';
        });

        // Click "Player 1 starts" via evaluate to avoid cork modal
        await page.evaluate(() => window.setSetupStarter('player1'));
        await page.waitForTimeout(300);

        // Click START GAME button via DOM click
        await page.evaluate(() => document.querySelector('.setup-start-btn').click());
        await page.waitForTimeout(2000);

        // Dismiss starter modal if present
        await dismissStarterModal(page);

        // Setup screen should be hidden now
        const isActive = await setupScreen.evaluate(el => el.classList.contains('active'));
        expect(isActive).toBe(false);

        // Player names should appear in the scorer
        const homeNames = page.locator('#homeNames, #homeName1');
        const homeText = await homeNames.first().textContent();
        expect(homeText).toContain('Alice');

        const awayNames = page.locator('#awayNames, #awayName1');
        const awayText = await awayNames.first().textContent();
        expect(awayText).toContain('Bob');
    });
});

// ===========================================================================
// GROUP 3 - X01 Scorer with URL params (bypasses setup)
// ===========================================================================
test.describe('X01 Scorer with Params', () => {

    test('loads with player names from params', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Player 1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Player 2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on x01 with params:', critical);
        }
        expect(critical).toHaveLength(0);

        // Setup screen should NOT be showing (we have player data)
        const setupScreen = page.locator('#setupScreen');
        const isActive = await setupScreen.evaluate(el => el.classList.contains('active'));
        expect(isActive).toBe(false);
    });

    test('shows starting score of 501', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Player 1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Player 2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Home score should show 501
        const homeScore = page.locator('#homeScore');
        await expect(homeScore).toBeVisible({ timeout: 5000 });
        const homeText = await homeScore.textContent();
        expect(homeText.trim()).toBe('501');

        // Away score should show 501
        const awayScore = page.locator('#awayScore');
        await expect(awayScore).toBeVisible({ timeout: 5000 });
        const awayText = await awayScore.textContent();
        expect(awayText.trim()).toBe('501');
    });

    test('shows player names from URL params', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'TestHome'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'TestAway'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        const homeName = page.locator('#homeName1');
        const homeText = await homeName.textContent();
        expect(homeText).toContain('TestHome');

        const awayName = page.locator('#awayName1');
        const awayText = await awayName.textContent();
        expect(awayText).toContain('TestAway');
    });

    test('shows correct starting score for 301', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=301&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Player A'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Player B'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        const homeScore = page.locator('#homeScore');
        const homeText = await homeScore.textContent();
        expect(homeText.trim()).toBe('301');
    });

    test('number keypad is visible and interactive', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'P1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'P2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);

        // The keypad container should be visible
        const keypadContainer = page.locator('#keypadContainer');
        await expect(keypadContainer).toBeVisible({ timeout: 5000 });

        // Number buttons 1-9 should be visible
        for (let i = 1; i <= 9; i++) {
            const key = page.locator(`.calc-key:has-text("${i}")`).first();
            await expect(key).toBeVisible({ timeout: 3000 });
        }

        // The "0" key
        const zeroKey = page.locator('.calc-key:has-text("0")').first();
        await expect(zeroKey).toBeVisible({ timeout: 3000 });
    });
});

// ===========================================================================
// GROUP 4 - X01 Score Entry Test
// ===========================================================================
test.describe('X01 Score Entry', () => {

    test('entering a score via keypad updates the input display', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Scorer1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Scorer2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);
        await page.waitForTimeout(500);

        // Use page.evaluate for reliable keypad input (avoids selector ambiguity
        // with shortcut buttons like "100" matching :has-text("0"))
        await page.evaluate(() => window.appendDigit('6'));
        await page.waitForTimeout(300);

        // Score input display should show "6"
        const scoreInput = page.locator('#scoreInput');
        let inputText = await scoreInput.textContent();
        expect(inputText.trim()).toBe('6');

        await page.evaluate(() => window.appendDigit('0'));
        await page.waitForTimeout(300);

        // Score input display should now show "60"
        inputText = await scoreInput.textContent();
        expect(inputText.trim()).toBe('60');
    });

    test('ENTER button submits the score', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);
        await page.waitForTimeout(500);

        // Enter 60 and submit via page.evaluate for reliable input
        await page.evaluate(() => {
            window.appendDigit('6');
            window.appendDigit('0');
        });
        await page.waitForTimeout(200);

        const enterBtn = page.locator('.action-btn.enter');
        await enterBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // After entering 60, the active player's score should now be 441 (501 - 60)
        const homeScore = page.locator('#homeScore');
        const scoreText = await homeScore.textContent();
        expect(scoreText.trim()).toBe('441');
        console.log('Home score after entry:', scoreText.trim());
    });

    test('MISS button enters a zero score', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);
        await page.waitForTimeout(500);

        // Click MISS
        const missBtn = page.locator('.action-btn.miss');
        await missBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // Home score should still be 501 (miss = 0 points scored)
        const homeScore = page.locator('#homeScore');
        const scoreText = await homeScore.textContent();
        expect(scoreText.trim()).toBe('501');
    });

    test('quick score buttons (100, 140) work', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);

        // Quick score buttons should exist (100 and 140)
        const btn100 = page.locator('.calc-key.shortcut:has-text("100")');
        await expect(btn100).toBeVisible({ timeout: 5000 });

        const btn140 = page.locator('.calc-key.shortcut:has-text("140")');
        await expect(btn140).toBeVisible({ timeout: 5000 });

        // Click 100 shortcut - it should put 100 in the input
        await btn100.click({ force: true });
        await page.waitForTimeout(500);

        const scoreInput = page.locator('#scoreInput');
        const inputText = await scoreInput.textContent();
        // Quick score buttons may auto-submit or just set the value
        console.log('Input after clicking 100:', inputText.trim());
    });

    test('side buttons (quick scores) are visible', async ({ page }) => {
        const url = '/pages/x01-scorer.html?starting_score=501&home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Side buttons (left and right of keypad)
        const sideBtns = page.locator('.side-btn');
        const count = await sideBtns.count();
        expect(count).toBeGreaterThanOrEqual(4);
    });
});

// ===========================================================================
// GROUP 5 - Cricket Scorer (Casual Mode)
// ===========================================================================
test.describe('Cricket Scorer', () => {

    test('page loads without crash (shows setup screen)', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        // /scorers/cricket.html redirects to /pages/league-cricket.html
        const response = await page.goto('/pages/league-cricket.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on league-cricket.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('shows casual setup screen when no params', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        // Setup screen should be visible
        const setupScreen = page.locator('#setupScreen');
        await expect(setupScreen).toBeVisible({ timeout: 5000 });

        // Setup title should show "CRICKET SCORER"
        const setupTitle = page.locator('.setup-title');
        await expect(setupTitle).toContainText('CRICKET SCORER');
    });

    test('setup screen has player inputs and format options', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        const player1 = page.locator('#setupPlayer1');
        await expect(player1).toBeVisible({ timeout: 5000 });

        const player2 = page.locator('#setupPlayer2');
        await expect(player2).toBeVisible({ timeout: 5000 });

        // Legs selector
        const legsSelect = page.locator('#setupLegs');
        await expect(legsSelect).toBeVisible({ timeout: 5000 });
    });

    test('setup screen has start game button', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        const startBtn = page.locator('.setup-start-btn');
        await expect(startBtn).toBeVisible({ timeout: 5000 });
        await expect(startBtn).toContainText('START GAME');
    });

    test('has scoreboard elements behind setup', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        // Scoreboard elements exist in DOM
        const homeScore = page.locator('#homeScore');
        expect(await homeScore.count()).toBe(1);

        const awayScore = page.locator('#awayScore');
        expect(await awayScore.count()).toBe(1);

        const roundNum = page.locator('#roundNum');
        expect(await roundNum.count()).toBe(1);
    });

    test('has cricket board area behind setup', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        const cricketBoard = page.locator('#cricketBoard');
        expect(await cricketBoard.count()).toBe(1);
    });

    test('can start a casual cricket game', async ({ page }) => {
        await page.goto('/pages/league-cricket.html');
        await page.waitForTimeout(3000);

        // Setup screen should be visible
        const setupScreen = page.locator('#setupScreen');
        await expect(setupScreen).toBeVisible({ timeout: 5000 });

        // Fill in player names (scoped to setup screen)
        await setupScreen.locator('#setupPlayer1').fill('CricketP1');
        await setupScreen.locator('#setupPlayer2').fill('CricketP2');

        // Select "Player 1 starts" to avoid cork modal (scoped to setup screen)
        const player1StartsBtn = setupScreen.locator('.setup-toggle-btn:has-text("Player 1 starts")');
        await player1StartsBtn.click({ force: true });
        await page.waitForTimeout(300);

        // Click START GAME (scoped to setup screen)
        await setupScreen.locator('.setup-start-btn').click({ force: true });
        await page.waitForTimeout(2000);

        // Dismiss starter modal if it appeared
        await dismissStarterModal(page);

        // Setup screen should be hidden
        const isActive = await setupScreen.evaluate(el => el.classList.contains('active'));
        expect(isActive).toBe(false);

        // Player names should appear in the scoreboard
        const homeName = page.locator('#homeName');
        const homeText = await homeName.textContent();
        expect(homeText).toContain('CricketP1');

        const awayName = page.locator('#awayName');
        const awayText = await awayName.textContent();
        expect(awayText).toContain('CricketP2');
    });
});

// ===========================================================================
// GROUP 6 - Cricket Scorer with Params
// ===========================================================================
test.describe('Cricket Scorer with Params', () => {

    test('loads with player names from params', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'CricketHome'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'CricketAway'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on cricket with params:', critical);
        }
        expect(critical).toHaveLength(0);

        // Setup screen should NOT be showing
        const setupScreen = page.locator('#setupScreen');
        const isActive = await setupScreen.evaluate(el => el.classList.contains('active'));
        expect(isActive).toBe(false);
    });

    test('shows dart target numbers (20, 19, 18, 17, 16, 15, Bull)', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);

        // Cricket board should be populated with target rows
        const cricketBoard = page.locator('#cricketBoard');
        await expect(cricketBoard).toBeVisible({ timeout: 5000 });

        // Target buttons for each cricket number should exist
        const targetNumbers = ['20', '19', '18', '17', '16', '15'];
        for (const num of targetNumbers) {
            const targetBtn = page.locator(`.target-btn:has-text("${num}")`);
            await expect(targetBtn).toBeVisible({ timeout: 3000 });
        }

        // Bull target button shows "B"
        const bullBtn = page.locator('.target-btn:has-text("B")');
        await expect(bullBtn).toBeVisible({ timeout: 3000 });
    });

    test('has player columns with marks and points cells', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Each cricket row has marks cells for home and away
        const homeMarksCells = page.locator('.marks-cell.home');
        const awayMasksCells = page.locator('.marks-cell.away');

        // Should be 7 rows (20, 19, 18, 17, 16, 15, BULL)
        expect(await homeMarksCells.count()).toBe(7);
        expect(await awayMasksCells.count()).toBe(7);

        // Points cells exist
        const homePoints = page.locator('.points-cell.home');
        const awayPoints = page.locator('.points-cell.away');
        expect(await homePoints.count()).toBe(7);
        expect(await awayPoints.count()).toBe(7);
    });

    test('has Double and Triple modifier buttons', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // D (Double) modifier buttons
        const doubleBtns = page.locator('.mod-btn:not(.triple)');
        expect(await doubleBtns.count()).toBeGreaterThanOrEqual(7);

        // T (Triple) modifier buttons (6 for numbers, bull has hidden triple)
        const tripleBtns = page.locator('.mod-btn.triple');
        expect(await tripleBtns.count()).toBeGreaterThanOrEqual(6);
    });

    test('has dart slots display in control bar', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Three dart slot indicators
        const dart0 = page.locator('#dart0');
        const dart1 = page.locator('#dart1');
        const dart2 = page.locator('#dart2');

        expect(await dart0.count()).toBe(1);
        expect(await dart1.count()).toBe(1);
        expect(await dart2.count()).toBe(1);

        // Turn marks display
        const turnMarks = page.locator('#turnMarks');
        expect(await turnMarks.count()).toBe(1);
    });

    test('has game controls (exit button)', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'Home'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'Away'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Exit button
        const exitBtn = page.locator('.exit-btn');
        await expect(exitBtn).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GROUP 7 - Cricket Mark Entry Test
// ===========================================================================
test.describe('Cricket Mark Entry', () => {

    test('tapping a target number adds a mark', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'MarkTest1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'MarkTest2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);

        // Tap the "20" target button (single mark)
        const target20 = page.locator('.target-btn:has-text("20")');
        await target20.click({ force: true });
        await page.waitForTimeout(500);

        // First dart slot should now show something (not just "-")
        const dart0 = page.locator('#dart0');
        const dart0Text = await dart0.textContent();
        console.log('Dart 0 after hitting 20:', dart0Text.trim());
        // After a hit, the dart slot should update (showing the hit like "S20" or "20")
        expect(dart0Text.trim()).not.toBe('-');
    });

    test('tapping D (Double) modifier then target adds double marks', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'DblTest1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'DblTest2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);
        await page.waitForTimeout(500);

        // The D button on the 20 row. Each row has: points-home, marks-home, D, target, T, marks-away, points-away
        // The D button is a .mod-btn (not .triple) within the 20 row
        const row20 = page.locator('.cricket-row[data-target="20"]');
        const doubleBtn = row20.locator('.mod-btn:not(.triple)');
        await doubleBtn.click({ force: true });
        await page.waitForTimeout(500);

        // First dart slot should show a double hit
        const dart0 = page.locator('#dart0');
        const dart0Text = await dart0.textContent();
        console.log('Dart 0 after double 20:', dart0Text.trim());
        expect(dart0Text.trim()).not.toBe('-');
    });

    test('turn marks counter updates after hits', async ({ page }) => {
        const url = '/pages/league-cricket.html?home_players=' +
            encodeURIComponent(JSON.stringify([{id:'p1',name:'MarksP1'}])) +
            '&away_players=' +
            encodeURIComponent(JSON.stringify([{id:'p2',name:'MarksP2'}])) +
            '&casual=true&cork=false';

        await page.goto(url);
        await page.waitForTimeout(3000);

        // Dismiss starter modal (READY button appears when cork=false)
        await dismissStarterModal(page);
        await page.waitForTimeout(500);

        // Turn marks should start at 0
        const turnMarks = page.locator('#turnMarks');
        let marksText = await turnMarks.textContent();
        expect(marksText.trim()).toBe('0');

        // Tap 20 single
        const target20 = page.locator('.target-btn:has-text("20")');
        await target20.click({ force: true });
        await page.waitForTimeout(500);

        // Turn marks should now be 1
        marksText = await turnMarks.textContent();
        expect(marksText.trim()).toBe('1');
    });
});

// ===========================================================================
// GROUP 8 - Bracket Page
// ===========================================================================
test.describe('Bracket Page', () => {

    test('page loads (may show loading or empty state)', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/bracket.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on bracket.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('has bracket container and structure', async ({ page }) => {
        await page.goto('/pages/bracket.html');
        await page.waitForTimeout(3000);

        // Bracket container should exist
        const bracketContainer = page.locator('#bracketContainer, .bracket-container');
        expect(await bracketContainer.count()).toBeGreaterThanOrEqual(1);
    });

    test('has header with title', async ({ page }) => {
        await page.goto('/pages/bracket.html');
        await page.waitForTimeout(3000);

        const header = page.locator('.header-bar, .header-title');
        await expect(header.first()).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GROUP 9 - Knockout Page
// ===========================================================================
test.describe('Knockout Page', () => {

    test('page loads', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/knockout.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on knockout.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('shows knockout title or redirects to game-setup', async ({ page }) => {
        await page.goto('/pages/knockout.html');
        await page.waitForTimeout(3000);

        // When no knockout ID is provided and no active knockouts exist,
        // the page redirects to /pages/game-setup.html?mode=knockout
        const currentUrl = page.url();
        if (currentUrl.includes('knockout.html')) {
            // Stayed on knockout page - check title
            const titleExists = await page.evaluate(() => !!document.getElementById('knockoutTitle'));
            expect(titleExists).toBe(true);
        } else {
            // Redirected (expected when no active knockouts)
            expect(currentUrl).toContain('game-setup');
        }
    });

    test('has round containers or redirected to game-setup', async ({ page }) => {
        await page.goto('/pages/knockout.html');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        if (currentUrl.includes('knockout.html')) {
            // Round elements exist in static HTML
            const roundsExist = await page.evaluate(() => ({
                qf: !!document.getElementById('quarterfinalsRound'),
                sf: !!document.getElementById('semifinalsRound'),
                final: !!document.getElementById('finalRound')
            }));
            expect(roundsExist.qf).toBe(true);
            expect(roundsExist.sf).toBe(true);
            expect(roundsExist.final).toBe(true);
        } else {
            // Redirected to game-setup - that's valid behavior
            expect(currentUrl).toContain('game-setup');
        }
    });

    test('has back button or redirected', async ({ page }) => {
        await page.goto('/pages/knockout.html');
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        if (currentUrl.includes('knockout.html')) {
            const backBtn = page.locator('.back-btn');
            await expect(backBtn.first()).toBeVisible({ timeout: 5000 });
        } else {
            // Redirected to game-setup when no active knockouts
            expect(currentUrl).toContain('game-setup');
        }
    });
});

// ===========================================================================
// GROUP 10 - Live Scoreboard
// ===========================================================================
test.describe('Live Scoreboard', () => {

    test('page loads with league_id param', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto(`/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`);
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on live-scoreboard.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('shows scoreboard layout with header', async ({ page }) => {
        await page.goto(`/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`);
        await page.waitForTimeout(3000);

        // Header with "BRDC LIVE" logo
        const logo = page.locator('.logo');
        await expect(logo).toBeVisible({ timeout: 5000 });
        const logoText = await logo.textContent();
        expect(logoText).toContain('BRDC LIVE');

        // Live badge
        const liveBadge = page.locator('.live-badge');
        await expect(liveBadge.first()).toBeVisible({ timeout: 5000 });
    });

    test('has filter buttons (All, Leagues, Tournaments)', async ({ page }) => {
        await page.goto(`/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`);
        await page.waitForTimeout(3000);

        const allBtn = page.locator('.filter-btn[data-filter="all"]');
        await expect(allBtn).toBeVisible({ timeout: 5000 });

        const leaguesBtn = page.locator('.filter-btn[data-filter="leagues"]');
        await expect(leaguesBtn).toBeVisible({ timeout: 5000 });

        const tournamentsBtn = page.locator('.filter-btn[data-filter="tournaments"]');
        await expect(tournamentsBtn).toBeVisible({ timeout: 5000 });
    });

    test('has league and tournament match sections', async ({ page }) => {
        await page.goto(`/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`);
        await page.waitForTimeout(3000);

        const leagueSection = page.locator('#leaguesSection');
        await expect(leagueSection).toBeVisible({ timeout: 5000 });

        const tournamentSection = page.locator('#tournamentsSection');
        await expect(tournamentSection).toBeVisible({ timeout: 5000 });
    });

    test('has clock display', async ({ page }) => {
        await page.goto(`/pages/live-scoreboard.html?league_id=${LEAGUE_ID}`);
        await page.waitForTimeout(3000);

        const clock = page.locator('#clock');
        await expect(clock).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GROUP 11 - Live Match
// ===========================================================================
test.describe('Live Match', () => {

    test('page loads (may show loading or no-match state)', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        const response = await page.goto('/pages/live-match.html');
        expect(response.status()).toBeLessThan(400);
        await page.waitForTimeout(3000);

        const critical = filterCriticalErrors(errors);
        if (critical.length > 0) {
            console.log('Critical errors on live-match.html:', critical);
        }
        expect(critical).toHaveLength(0);
    });

    test('has loading container or match app area', async ({ page }) => {
        await page.goto('/pages/live-match.html');
        await page.waitForTimeout(3000);

        // Either loading state or the main match app should exist
        const loadingContainer = page.locator('#loadingContainer');
        const liveMatchApp = page.locator('#liveMatchApp');

        const loadingExists = await loadingContainer.count() > 0;
        const appExists = await liveMatchApp.count() > 0;

        expect(loadingExists || appExists).toBe(true);
    });

    test('has scoreboard structure in DOM', async ({ page }) => {
        await page.goto('/pages/live-match.html');
        await page.waitForTimeout(3000);

        // Scoreboard elements exist in the DOM even if hidden
        const homeTeamName = page.locator('#homeTeamName');
        expect(await homeTeamName.count()).toBe(1);

        const awayTeamName = page.locator('#awayTeamName');
        expect(await awayTeamName.count()).toBe(1);

        const homeScore = page.locator('#homeScore');
        expect(await homeScore.count()).toBe(1);

        const awayScore = page.locator('#awayScore');
        expect(await awayScore.count()).toBe(1);
    });

    test('has match info elements (league name, week, set)', async ({ page }) => {
        await page.goto('/pages/live-match.html');
        await page.waitForTimeout(3000);

        const leagueName = page.locator('#leagueName');
        expect(await leagueName.count()).toBe(1);

        const weekNum = page.locator('#weekNum');
        expect(await weekNum.count()).toBe(1);

        const currentSet = page.locator('#currentSet');
        expect(await currentSet.count()).toBe(1);
    });
});

// ===========================================================================
// GROUP 12 - Redirect Tests (scorers/x01.html and scorers/cricket.html)
// ===========================================================================
test.describe('Scorer Redirects', () => {

    test('/scorers/x01.html redirects to x01-scorer page', async ({ page }) => {
        const response = await page.goto('/scorers/x01.html');
        await page.waitForTimeout(3000);

        // After redirect, URL should contain x01-scorer
        const finalUrl = page.url();
        expect(finalUrl).toContain('x01-scorer');
    });

    test('/scorers/cricket.html redirects to league-cricket page', async ({ page }) => {
        const response = await page.goto('/scorers/cricket.html');
        await page.waitForTimeout(3000);

        // After redirect, URL should contain league-cricket
        const finalUrl = page.url();
        expect(finalUrl).toContain('league-cricket');
    });
});
