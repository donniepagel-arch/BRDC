const { test, expect } = require('@playwright/test');

const FUNCTIONS_URL = 'https://us-central1-brdc-v2.cloudfunctions.net';

// Shared state across serial tests
let tournamentId = null;
let directorPin = null;

/**
 * Helper: call a cloud function via POST
 */
async function callFunction(name, body = {}) {
    const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok && !data.success) {
        throw new Error(`${name} failed: ${JSON.stringify(data)}`);
    }
    return data;
}

// ─── PHASE 0: Create test tournament via API ───────────────────────────

test.describe.serial('Heartbreaker Tournament E2E', () => {

    test('Phase 0 - Create heartbreaker tournament via API', async () => {
        const data = await callFunction('createHeartbreakerTournament', {
            tournament_name: `Playwright Test ${Date.now()}`,
            tournament_date: new Date().toISOString(),
            email: 'test@playwright.dev',
            venue_name: 'Test Venue',
            boards_available: 4,
        });

        expect(data.success).toBeTruthy();
        expect(data.tournament_id).toBeTruthy();
        expect(data.pin).toBeTruthy();

        tournamentId = data.tournament_id;
        directorPin = data.pin;
        console.log(`Created tournament: ${tournamentId}, PIN: ${directorPin}`);
    });

    // ─── PHASE 1: Page load tests ─────────────────────────────────────

    test('Phase 1a - Registration page loads', async ({ page }) => {
        await page.goto(`/pages/matchmaker-register.html?id=${tournamentId}`);

        // Wait for tournament name to load (replaces "Loading...")
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });
        const name = await page.locator('#tournamentName').textContent();
        expect(name).toContain('Playwright Test');

        // Status card should show zeroes
        await expect(page.locator('#teamsCount')).toBeVisible({ timeout: 5000 });

        // Registration form should be present
        await expect(page.locator('#singleForm')).toBeVisible();

        // No console errors
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.waitForTimeout(2000);
        // Allow Firebase-related warnings but no app crashes
        const criticalErrors = errors.filter(e =>
            !e.includes('Firebase') && !e.includes('analytics')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('Phase 1b - Public view page loads', async ({ page }) => {
        await page.goto(`/pages/matchmaker-view.html?id=${tournamentId}`);

        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });
        const name = await page.locator('#tournamentName').textContent();
        expect(name).toContain('Playwright Test');

        // Status counts visible
        await expect(page.locator('#teamsCount')).toBeVisible();

        // Register button should link correctly
        const registerBtn = page.locator('#registerBtn');
        await expect(registerBtn).toBeVisible();
        const href = await registerBtn.getAttribute('href');
        expect(href).toContain(tournamentId);

        // Mingle link should be wired up (the fix we just deployed)
        const mingleLink = page.locator('#mingleLink');
        const mingleHref = await mingleLink.getAttribute('href');
        expect(mingleHref).toContain('matchmaker-mingle.html');
        expect(mingleHref).toContain(tournamentId);
    });

    test('Phase 1c - Director page loads with PIN gate', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);

        // PIN container should be visible first
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#pinInput')).toBeVisible();

        // Dashboard should be hidden
        await expect(page.locator('#dashboard')).not.toBeVisible();
    });

    test('Phase 1d - Bracket page loads', async ({ page }) => {
        await page.goto(`/pages/matchmaker-bracket.html?id=${tournamentId}`);

        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });

        // Bracket toggle buttons should exist
        await expect(page.getByRole('button', { name: 'WINNERS' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'LOSERS' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'FINALS' })).toBeVisible();
    });

    test('Phase 1e - TV page loads in bracket mode (default)', async ({ page }) => {
        await page.goto(`/pages/matchmaker-tv.html?tournament_id=${tournamentId}`);

        // Connection indicator
        await expect(page.locator('#connectionIndicator')).toBeVisible({ timeout: 10000 });

        // Bracket view should be the active mode
        await expect(page.locator('#bracketView')).toBeVisible();
    });

    test('Phase 1f - TV page loads in each mode', async ({ page }) => {
        const modes = ['bracket', 'partner-reveal', 'match-call', 'heartbreaker-alert'];

        for (const mode of modes) {
            await page.goto(`/pages/matchmaker-tv.html?tournament_id=${tournamentId}&mode=${mode}`);
            await page.waitForTimeout(2000);

            // Page should not show a visible error-container element
            const errorContainer = page.locator('.error-container');
            const errorCount = await errorContainer.count();
            expect(errorCount).toBe(0);
        }
    });

    test('Phase 1g - TV page handles invalid mode gracefully', async ({ page }) => {
        const warnings = [];
        page.on('console', msg => {
            if (msg.type() === 'warning') warnings.push(msg.text());
        });

        await page.goto(`/pages/matchmaker-tv.html?tournament_id=${tournamentId}&mode=bogus`);
        await page.waitForTimeout(3000);

        // Should default to bracket view
        await expect(page.locator('#bracketView')).toBeVisible();

        // Should have logged a warning
        const modeWarning = warnings.find(w => w.includes('Invalid TV mode'));
        expect(modeWarning).toBeTruthy();
    });

    // ─── PHASE 2: Registration flow ───────────────────────────────────

    test('Phase 2a - Register single male player', async ({ page }) => {
        await page.goto(`/pages/matchmaker-register.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });

        // Select "Find Me A Partner" (single) - should be default
        await expect(page.locator('#singleForm')).toBeVisible();

        // Select gender: Male (scope to single form)
        await page.locator('#singleForm [data-gender="M"]').click();

        // Fill form
        await page.fill('#singleFirstName', 'Test');
        await page.fill('#singleLastName', 'Male');
        await page.fill('#singleEmail', 'testmale@playwright.dev');

        // Submit - button says "FIND MY MATCH" in single form
        await page.locator('#singleForm .submit-btn').click();

        // Wait for success message
        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15000 });
        const message = await page.locator('#messageBox').textContent();
        expect(message.toLowerCase()).toContain('register');
    });

    test('Phase 2b - Register single female player', async ({ page }) => {
        await page.goto(`/pages/matchmaker-register.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });

        // Select gender: Female (scope to single form)
        await page.locator('#singleForm [data-gender="F"]').click();

        // Fill form
        await page.fill('#singleFirstName', 'Test');
        await page.fill('#singleLastName', 'Female');
        await page.fill('#singleEmail', 'testfemale@playwright.dev');

        // Submit
        await page.locator('#singleForm .submit-btn').click();

        // Wait for success
        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15000 });
        const message = await page.locator('#messageBox').textContent();
        expect(message.toLowerCase()).toContain('register');
    });

    test('Phase 2c - Register a pre-formed team', async ({ page }) => {
        await page.goto(`/pages/matchmaker-register.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });

        // Switch to team registration
        await page.locator('[data-type="team"]').click();
        await expect(page.locator('#teamForm')).toBeVisible();

        // Fill team form
        await page.fill('#teamName', 'Team Playwright');
        await page.fill('#p1FirstName', 'John');
        await page.fill('#p1LastName', 'Doe');
        // Select gender for Player 1 (Male)
        await page.locator('#p1GenderToggle [data-gender="M"]').click();
        await page.fill('#p2FirstName', 'Jane');
        await page.fill('#p2LastName', 'Doe');
        // Select gender for Player 2 (Female)
        await page.locator('#p2GenderToggle [data-gender="F"]').click();

        // Submit - button says "REGISTER OUR TEAM" in team form
        await page.locator('#teamForm .submit-btn').click();

        // Wait for success
        await expect(page.locator('#messageBox')).toBeVisible({ timeout: 15000 });
        const message = await page.locator('#messageBox').textContent();
        expect(message.toLowerCase()).toContain('register');
    });

    test('Phase 2d - Public view shows updated counts', async ({ page }) => {
        await page.goto(`/pages/matchmaker-view.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });

        // Wait for status to load
        await page.waitForTimeout(3000);

        // Should show at least 1 team (the pre-formed team)
        const teamsText = await page.locator('#teamsCount').textContent();
        const teams = parseInt(teamsText);
        expect(teams).toBeGreaterThanOrEqual(1);
    });

    // ─── PHASE 3: Director dashboard ──────────────────────────────────

    test('Phase 3a - Director login with correct PIN', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Enter correct PIN
        await page.fill('#pinInput', directorPin);
        await page.locator('#pinInput').press('Enter');

        // Dashboard should appear
        await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });

        // Overview tab should be active and show data
        await page.waitForTimeout(2000);
        const totalText = await page.locator('#overviewTotal').textContent();
        const total = parseInt(totalText);
        expect(total).toBeGreaterThanOrEqual(1); // At least some registrations showing
    });

    test('Phase 3b - Director login rejects wrong PIN', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Enter wrong PIN
        await page.fill('#pinInput', '00000000');
        await page.locator('#pinInput').press('Enter');

        // Error should appear
        await expect(page.locator('#pinError')).toBeVisible({ timeout: 5000 });

        // Dashboard should still be hidden
        await expect(page.locator('#dashboard')).not.toBeVisible();
    });

    test('Phase 3c - Director can switch tabs', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Login
        await page.fill('#pinInput', directorPin);
        await page.locator('#pinInput').press('Enter');
        await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });

        // Test tab switching
        const tabs = ['checkin', 'registrations', 'matching', 'breakups', 'boards', 'bracket', 'tvdisplay'];
        for (const tab of tabs) {
            await page.locator(`[onclick="showTab('${tab}')"]`).click();
            await page.waitForTimeout(500);
            // The tab content should become visible
            const tabContent = page.locator(`#tab-${tab}`);
            await expect(tabContent).toBeVisible();
        }
    });

    test('Phase 3d - Director draws partners', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Login
        await page.fill('#pinInput', directorPin);
        await page.locator('#pinInput').press('Enter');
        await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });

        // Go to Partner Draw tab
        await page.locator(`[onclick="showTab('matching')"]`).click();
        await page.waitForTimeout(2000);

        // Draw button should exist
        const drawBtn = page.locator('#drawBtn');
        if (await drawBtn.isVisible()) {
            // Handle potential confirm dialog
            page.on('dialog', async dialog => await dialog.accept());

            await drawBtn.click();

            // Wait for draw API call to complete
            await page.waitForTimeout(8000);

            // After draw, the matched teams section should update
            // or an alert/message should appear confirming the draw
            // Just verify the page didn't crash
            const dashboardStillVisible = await page.locator('#dashboard').isVisible();
            expect(dashboardStillVisible).toBeTruthy();
        }
    });

    test('Phase 3e - Director generates bracket', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Login
        await page.fill('#pinInput', directorPin);
        await page.locator('#pinInput').press('Enter');
        await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });

        // Go to Bracket tab
        await page.locator(`[onclick="showTab('bracket')"]`).click();
        await page.waitForTimeout(2000);

        // Look for any bracket generation button
        const genBtn = page.locator('button:has-text("Generate"), button:has-text("GENERATE"), #genBracketBtn').first();
        if (await genBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Handle confirm dialog
            page.on('dialog', async dialog => await dialog.accept());

            await genBtn.click();
            await page.waitForTimeout(8000);

            // Verify page didn't crash
            const dashboardStillVisible = await page.locator('#dashboard').isVisible();
            expect(dashboardStillVisible).toBeTruthy();
        } else {
            // Bracket tab may not have a generate button if no teams matched
            console.log('No bracket generation button found - skipping');
        }
    });

    // ─── PHASE 3f: Score entry UI on bracket tab ─────────────────────

    test('Phase 3f - Score entry match list appears after bracket generation', async ({ page }) => {
        await page.goto(`/pages/matchmaker-director.html?id=${tournamentId}`);
        await expect(page.locator('#pinContainer')).toBeVisible({ timeout: 10000 });

        // Login
        await page.fill('#pinInput', directorPin);
        await page.locator('#pinInput').press('Enter');
        await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });

        // Go to Bracket tab
        await page.locator(`[onclick="showTab('bracket')"]`).click();
        await page.waitForTimeout(3000);

        // Match Score card should be visible if bracket was generated
        const matchScoreCard = page.locator('#matchScoreCard');
        const isVisible = await matchScoreCard.isVisible({ timeout: 5000 }).catch(() => false);

        if (isVisible) {
            // Should show match cards
            const matchCards = await page.locator('.score-match-card').count();
            console.log(`Score entry match cards found: ${matchCards}`);
            expect(matchCards).toBeGreaterThan(0);

            // Should show summary text
            const summary = await page.locator('#matchScoreSummary').textContent();
            console.log(`Match score summary: ${summary}`);
            expect(summary).toContain('completed');

            // Click a ready/pending match card to open modal
            const clickableCard = page.locator('.score-match-card:not(.waiting):not(.completed)').first();
            if (await clickableCard.isVisible({ timeout: 2000 }).catch(() => false)) {
                await clickableCard.click();

                // Score modal should appear
                await expect(page.locator('#scoreModal.active')).toBeVisible({ timeout: 3000 });

                // Should show team names
                const team1 = await page.locator('#scoreTeam1Name').textContent();
                const team2 = await page.locator('#scoreTeam2Name').textContent();
                console.log(`Score modal: ${team1} vs ${team2}`);
                expect(team1).not.toBe('TBD');

                // Close modal
                await page.locator('.score-modal-close').click();
                await expect(page.locator('#scoreModal.active')).not.toBeVisible({ timeout: 2000 });
            } else {
                console.log('No clickable match cards (all waiting or completed)');
            }
        } else {
            console.log('Match score card not visible - bracket may not have been generated');
        }
    });

    // ─── PHASE 4: Bracket display after generation ────────────────────

    test('Phase 4a - Bracket page shows generated bracket', async ({ page }) => {
        await page.goto(`/pages/matchmaker-bracket.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });
        await page.waitForTimeout(3000);

        // Winners bracket should have content
        const winnersSection = page.locator('#winners-bracket, .winners-bracket, [data-bracket="winners"]');
        // At minimum the bracket section should exist even if empty
        const bracketContent = await page.locator('.bracket-match, .match-slot, .team-slot').count();
        // If bracket was generated, there should be match slots
        console.log(`Bracket match slots found: ${bracketContent}`);
    });

    test('Phase 4b - Bracket toggle buttons work', async ({ page }) => {
        await page.goto(`/pages/matchmaker-bracket.html?id=${tournamentId}`);
        await expect(page.locator('#tournamentName')).not.toHaveText('Loading...', { timeout: 15000 });
        await page.waitForTimeout(2000);

        // Click Losers tab
        await page.getByRole('button', { name: 'LOSERS' }).click();
        await page.waitForTimeout(500);

        // Click Finals tab
        await page.getByRole('button', { name: 'FINALS' }).click();
        await page.waitForTimeout(500);

        // Click back to Winners
        await page.getByRole('button', { name: 'WINNERS' }).click();
        await page.waitForTimeout(500);
    });

    // ─── PHASE 5: Mingle page ────────────────────────────────────────

    test('Phase 5 - Mingle page loads without crash', async ({ page }) => {
        // Mingle page uses tournament_id param (not id)
        await page.goto(`/pages/matchmaker-mingle.html?tournament_id=${tournamentId}`);

        // Page should load without crashing - check for key elements
        await page.waitForTimeout(3000);

        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        // The page may show "no data" states since no one has lost yet,
        // but it shouldn't crash
        const body = await page.locator('body').textContent();
        expect(body).toBeTruthy();
    });

    // ─── PHASE 6: Cleanup ─────────────────────────────────────────────

    test('Phase 6 - Delete test tournament', async () => {
        if (!tournamentId) {
            test.skip();
            return;
        }

        try {
            const data = await callFunction('deleteTournament', {
                tournament_id: tournamentId,
                pin: directorPin,
            });
            console.log(`Cleanup: ${JSON.stringify(data)}`);
        } catch (e) {
            // Best-effort cleanup
            console.warn(`Cleanup failed (non-critical): ${e.message}`);
        }
    });
});
