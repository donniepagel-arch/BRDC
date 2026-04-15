/**
 * X01 Scorer - Impossible Score Validation Test (Workflow B)
 * Tests that mathematically impossible 3-dart scores are rejected
 * Converted from Antigravity to Playwright
 *
 * Impossible scores: 179, 178, 176, 173, 172, 169, 166, 163
 * These cannot be achieved with any combination of 3 darts
 */

const { test, expect } = require('@playwright/test');

test.describe('X01 Scorer - Impossible Score Validation', () => {

  const IMPOSSIBLE_SCORES = [179, 178, 176, 173, 172, 169, 166, 163];

  test('should reject all impossible scores with alert message', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    for (const impossibleScore of IMPOSSIBLE_SCORES) {
      console.log(`Testing impossible score: ${impossibleScore}`);

      // Set up dialog handler BEFORE triggering the action
      let alertMessage = '';
      const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });

      // Enter the impossible score
      const digits = impossibleScore.toString().split('');
      for (const digit of digits) {
        const regex = new RegExp(`^${digit}$`);
        await page.locator('button.calc-key').filter({ hasText: regex }).click();
        await page.waitForTimeout(50);
      }

      // Click ENTER
      await page.locator('button.action-btn.enter').click();

      // Wait for and handle the alert
      try {
        const dialog = await dialogPromise;
        alertMessage = dialog.message();
        console.log('Alert message:', alertMessage);
        await dialog.accept();

        // Verify alert message contains the score and "not achievable" or similar
        expect(alertMessage).toContain(impossibleScore.toString());
        expect(alertMessage.toLowerCase()).toMatch(/invalid|not achievable|impossible/);

        console.log(`✓ ${impossibleScore} correctly rejected`);
      } catch (error) {
        console.error(`✗ No alert appeared for ${impossibleScore}`);
        throw new Error(`Expected alert for impossible score ${impossibleScore} but none appeared`);
      }

      // Wait before next test
      await page.waitForTimeout(500);
    }

    console.log('✓ All impossible scores rejected successfully');
  });

  test('should accept valid high scores near impossible ones', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Valid scores near impossible ones
    const validScores = [
      180, // T20 T20 T20
      177, // T20 T20 T19
      174, // T20 T20 T18
      171, // T20 T19 T18
      170, // T20 T18 Bull
      167, // T20 T19 Bull
      164, // T20 T18 Bull
      161  // T20 T17 Bull
    ];

    for (const validScore of validScores) {
      console.log(`Testing valid score: ${validScore}`);

      // Get initial score
      const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
      const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));

      // Set up dialog handler - should NOT fire
      let alertFired = false;
      page.once('dialog', async dialog => {
        alertFired = true;
        console.error(`Unexpected alert for valid score ${validScore}: ${dialog.message()}`);
        await dialog.accept();
      });

      // Enter the valid score
      const digits = validScore.toString().split('');
      for (const digit of digits) {
        const regex = new RegExp(`^${digit}$`);
        await page.locator('button.calc-key').filter({ hasText: regex }).click();
        await page.waitForTimeout(50);
      }

      // Click ENTER
      await page.locator('button.action-btn.enter').click();
      await page.waitForTimeout(1000);

      // Verify no alert appeared
      expect(alertFired).toBe(false);

      // Verify score decreased
      const newScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
      const newScore = parseInt(newScoreText.replace(/[^0-9]/g, ''));
      const difference = initialScore - newScore;
      expect(difference).toBe(validScore);

      console.log(`✓ ${validScore} accepted correctly`);

      // Wait before next test
      await page.waitForTimeout(300);
    }

    console.log('✓ All valid high scores accepted');
  });

  test('should reject impossible scores even when using calculator operations', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to create impossible score: 100 + 79 = 179 (impossible)
    console.log('Testing calculator operation: 100 + 79 = 179 (impossible)');

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });

    // Enter 100 + 79
    await page.locator('button.calc-key').filter({ hasText: /^1$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^0$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^0$/ }).click();
    await page.waitForTimeout(100);

    await page.locator('button.calc-key.operator').filter({ hasText: '+' }).click();
    await page.waitForTimeout(100);

    await page.locator('button.calc-key').filter({ hasText: /^7$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^9$/ }).click();
    await page.waitForTimeout(100);

    await page.locator('button.action-btn.enter').click();

    // Should be rejected
    try {
      const dialog = await dialogPromise;
      const alertMessage = dialog.message();
      await dialog.accept();

      expect(alertMessage).toContain('179');
      console.log('✓ Impossible score via calculator operation also rejected');
    } catch (error) {
      throw new Error('Expected alert for calculator-generated impossible score 179 but none appeared');
    }
  });

  test('should provide clear error message format', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });

    // Enter impossible score 179
    await page.locator('button.calc-key').filter({ hasText: /^1$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^7$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^9$/ }).click();
    await page.waitForTimeout(100);

    await page.locator('button.action-btn.enter').click();

    // Check message format is helpful
    const dialog = await dialogPromise;
    const alertMessage = dialog.message();
    console.log('Error message:', alertMessage);
    await dialog.accept();

    // Should contain:
    // - The score number
    // - Indication it's invalid/impossible
    // - Reference to "3 darts" or similar
    expect(alertMessage).toMatch(/179/);
    expect(alertMessage.toLowerCase()).toMatch(/invalid|not achievable|impossible/);
    expect(alertMessage.toLowerCase()).toMatch(/darts?/);

    console.log('✓ Error message is clear and informative');
  });

  test('should handle edge case impossible score 163', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing edge case: 163 (lowest impossible 3-dart score)');

    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 });

    // Enter 163
    await page.locator('button.calc-key').filter({ hasText: /^1$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^6$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^3$/ }).click();
    await page.waitForTimeout(100);

    await page.locator('button.action-btn.enter').click();

    try {
      const dialog = await dialogPromise;
      const alertMessage = dialog.message();
      console.log('Alert for 163:', alertMessage);
      await dialog.accept();

      expect(alertMessage).toContain('163');
      console.log('✓ Edge case 163 correctly rejected');
    } catch (error) {
      throw new Error('Expected alert for impossible score 163 but none appeared');
    }
  });

});
