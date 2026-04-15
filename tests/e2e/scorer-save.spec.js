const { test, expect } = require('@playwright/test');

// Enter a score by calling the scorer's JS functions directly
async function enterScore(page, score) {
    await page.evaluate((s) => window.submitScore(s), score);
    await page.waitForTimeout(600);
}

test.describe('X01 Scorer - Save Flow', () => {

    test('casual 501 game saves without beforeunload warning', async ({ page }) => {
        // Track ALL dialogs in order
        const dialogs = [];
        page.on('dialog', async dialog => {
            const info = { type: dialog.type(), message: dialog.message().substring(0, 80) };
            dialogs.push(info);
            console.log(`Dialog ${dialogs.length} [${info.type}]: "${info.message}"`);
            // Accept all dialogs (confirm -> OK, prompt -> empty string / dismiss)
            if (dialog.type() === 'prompt') {
                await dialog.dismiss(); // Skip PIN entry (guest mode)
            } else {
                await dialog.accept();
            }
        });

        // Go to x01 scorer: casual, no cork, straight out, 1 leg to win
        await page.goto('/pages/x01-scorer.html?' + new URLSearchParams({
            casual: 'true',
            cork: 'false',
            starting_score: '501',
            checkout: 'straight',
            in_rule: 'straight',
            legs_to_win: '1',
            home_team_name: 'Test Home',
            away_team_name: 'Test Away',
            home_players: JSON.stringify([{ name: 'Player A' }]),
            away_players: JSON.stringify([{ name: 'Player B' }]),
        }).toString());

        await page.waitForSelector('#scoreInput', { timeout: 10000 });

        // Dismiss starter modal
        const readyBtn = page.locator('#noCorkSection button:has-text("READY"), #starterReadyPhase button:has-text("READY")');
        await readyBtn.first().waitFor({ state: 'visible', timeout: 5000 });
        await readyBtn.first().click();
        await page.waitForTimeout(800);

        // Play quick game: Home 180, Away 100, Home 180, Away 100, Home 141 (checkout)
        console.log('--- Playing game ---');
        await enterScore(page, 180); console.log('Home: 180');
        await enterScore(page, 100); console.log('Away: 100');
        await enterScore(page, 180); console.log('Home: 180');
        await enterScore(page, 100); console.log('Away: 100');
        await enterScore(page, 141); console.log('Home: 141 (checkout!)');

        // Handle checkout darts modal if visible
        const dartsModal = page.locator('#dartsModal');
        if (await dartsModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Darts modal -> clicking 3rd dart');
            await page.locator('#dartBtn3').click();
            await page.waitForTimeout(800);
        }

        // Handle confirm game modal
        const confirmModal = page.locator('#confirmGameModal');
        if (await confirmModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Confirm modal -> clicking CONFIRM');
            await page.locator('#confirmGameModal button:has-text("CONFIRM")').click();
            await page.waitForTimeout(800);
        }

        // Wait for Game Over modal
        await expect(page.locator('#gameModal')).toBeVisible({ timeout: 5000 });
        console.log('GAME OVER modal visible!');
        await page.screenshot({ path: 'test-results/before-save.png' });

        // Record dialog count before clicking save
        const dialogsBeforeSave = dialogs.length;
        console.log(`Dialogs before save: ${dialogsBeforeSave}`);

        // Click SAVE RESULT
        console.log('--- Clicking SAVE RESULT ---');
        await page.locator('#gameModal button:has-text("SAVE RESULT")').click();

        // Wait for all the save dialogs to resolve
        await page.waitForTimeout(4000);

        await page.screenshot({ path: 'test-results/after-save.png' });

        // Check: did any beforeunload dialog appear?
        // beforeunload dialogs have type 'beforeunload' in Playwright
        const beforeunloadDialogs = dialogs.filter(d => d.type === 'beforeunload');
        const allDialogsAfterSave = dialogs.slice(dialogsBeforeSave);

        console.log('--- Results ---');
        console.log(`Total dialogs after save: ${allDialogsAfterSave.length}`);
        allDialogsAfterSave.forEach((d, i) => console.log(`  ${i + 1}. [${d.type}] ${d.message}`));
        console.log(`Beforeunload dialogs: ${beforeunloadDialogs.length}`);

        if (beforeunloadDialogs.length === 0) {
            console.log('PASS: No beforeunload dialog!');
        } else {
            console.log('FAIL: beforeunload dialog detected!');
        }

        expect(beforeunloadDialogs.length).toBe(0);
    });

    test('EXIT mid-game does not trigger double dialog', async ({ page }) => {
        const dialogs = [];
        page.on('dialog', async dialog => {
            const info = { type: dialog.type(), message: dialog.message().substring(0, 80) };
            dialogs.push(info);
            console.log(`Dialog ${dialogs.length} [${info.type}]: "${info.message}"`);
            await dialog.accept();
        });

        await page.goto('/pages/x01-scorer.html?' + new URLSearchParams({
            casual: 'true',
            cork: 'false',
            starting_score: '501',
            checkout: 'straight',
            in_rule: 'straight',
            legs_to_win: '1',
            home_team_name: 'Test Home',
            away_team_name: 'Test Away',
            home_players: JSON.stringify([{ name: 'Player A' }]),
            away_players: JSON.stringify([{ name: 'Player B' }]),
        }).toString());

        await page.waitForSelector('#scoreInput', { timeout: 10000 });

        // Dismiss starter modal
        const readyBtn = page.locator('#noCorkSection button:has-text("READY"), #starterReadyPhase button:has-text("READY")');
        await readyBtn.first().waitFor({ state: 'visible', timeout: 5000 });
        await readyBtn.first().click();
        await page.waitForTimeout(800);

        // Enter a score so game is in progress
        console.log('Entering score...');
        await enterScore(page, 100);

        // Click EXIT
        console.log('--- Clicking EXIT ---');
        await page.locator('button.back-btn:has-text("EXIT")').click();
        await page.waitForTimeout(3000);

        const beforeunloadDialogs = dialogs.filter(d => d.type === 'beforeunload');
        console.log('--- Results ---');
        console.log(`Total dialogs: ${dialogs.length}`);
        dialogs.forEach((d, i) => console.log(`  ${i + 1}. [${d.type}] ${d.message}`));
        console.log(`Beforeunload dialogs: ${beforeunloadDialogs.length}`);

        expect(beforeunloadDialogs.length).toBe(0);
    });
});
