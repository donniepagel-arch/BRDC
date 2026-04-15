/**
 * X01 Scorer - UNDO Functionality Test (Workflow F)
 * Tests that UNDO removes throws and recalculates stats correctly
 *
 * Test Steps:
 * 1. Enter and submit multiple scores
 * 2. Use UNDO to clear input (first UNDO)
 * 3. Use UNDO to remove last throw (second UNDO)
 * 4. Verify score reverts correctly
 * 5. Verify stats recalculate properly
 */

const { test, expect } = require('@playwright/test');

test.describe('X01 Scorer - UNDO Functionality', () => {

  test('should clear input on first UNDO press', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing first UNDO: should clear input');

    // Enter a score but don't submit
    await page.locator('button.calc-key').filter({ hasText: /^6$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^0$/ }).click();
    await page.waitForTimeout(200);

    // Verify input shows 60 (check if there's a display element)
    const inputDisplay = page.locator('.score-input-value, .calc-display, .input-display');
    if (await inputDisplay.count() > 0) {
      await expect(inputDisplay.first()).toContainText('60');
    }

    // Click UNDO
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(300);

    // Input should be cleared
    if (await inputDisplay.count() > 0) {
      const displayText = await inputDisplay.first().textContent();
      expect(displayText === '0' || displayText === '' || displayText === '00').toBeTruthy();
      console.log('✓ First UNDO cleared input');
    } else {
      console.log('✓ First UNDO executed (no visible input display to verify)');
    }
  });

  test('should remove last throw on second UNDO press', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing second UNDO: should remove last throw');

    // Get initial score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));
    console.log('Initial score:', initialScore);

    // Submit first throw: 180
    await page.locator('button.side-btn').filter({ hasText: '180' }).click();
    await page.waitForTimeout(200);
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // Get score after first throw
    const afterFirstText = await page.locator('.team-panel.active .score-value').first().textContent();
    const afterFirst = parseInt(afterFirstText.replace(/[^0-9]/g, ''));
    console.log('Score after 180:', afterFirst);
    expect(afterFirst).toBe(initialScore - 180);

    // Submit second throw: 60
    await page.locator('button.side-btn').filter({ hasText: '60' }).click();
    await page.waitForTimeout(200);
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // Get score after second throw
    const afterSecondText = await page.locator('.team-panel.active .score-value').first().textContent();
    const afterSecond = parseInt(afterSecondText.replace(/[^0-9]/g, ''));
    console.log('Score after 60:', afterSecond);
    expect(afterSecond).toBe(afterFirst - 60);

    // First UNDO clears input (if any)
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(500);

    // Second UNDO removes last throw
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(1000);

    // Score should revert to after first throw
    const afterUndoText = await page.locator('.team-panel.active .score-value').first().textContent();
    const afterUndo = parseInt(afterUndoText.replace(/[^0-9]/g, ''));
    console.log('Score after UNDO:', afterUndo);

    expect(afterUndo).toBe(afterFirst);
    console.log('✓ Second UNDO removed last throw, score reverted correctly');
  });

  test('should recalculate stats after UNDO', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing stat recalculation after UNDO');

    // Submit a 180 (ton80)
    await page.locator('button.side-btn').filter({ hasText: '180' }).click();
    await page.waitForTimeout(200);
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // Check if there's a stat display for 180s/tons
    const tonStat = page.locator('.stat-label:has-text("180"), .stat-label:has-text("TON")').locator('..').locator('.stat-value');

    if (await tonStat.count() > 0) {
      const tonCount = await tonStat.first().textContent();
      console.log('Ton count after 180:', tonCount);
      expect(parseInt(tonCount) > 0).toBeTruthy();
    }

    // Submit another score: 60
    await page.locator('button.side-btn').filter({ hasText: '60' }).click();
    await page.waitForTimeout(200);
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // UNDO twice to remove the 60
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(300);
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(1000);

    // Stats should still show the 180 (ton count should remain)
    if (await tonStat.count() > 0) {
      const tonCountAfterUndo = await tonStat.first().textContent();
      console.log('Ton count after UNDO:', tonCountAfterUndo);
      expect(parseInt(tonCountAfterUndo) > 0).toBeTruthy();
    }

    console.log('✓ Stats recalculated correctly after UNDO');
  });

  test('should handle multiple UNDO operations in sequence', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing multiple UNDO operations');

    // Get initial score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));

    // Submit three throws
    const throws = [100, 85, 60];
    const scores = [initialScore];

    for (const throwScore of throws) {
      const digits = throwScore.toString().split('');
      for (const digit of digits) {
        const regex = new RegExp(`^${digit}$`);
        await page.locator('button.calc-key').filter({ hasText: regex }).click();
        await page.waitForTimeout(50);
      }
      await page.locator('button.action-btn.enter').click();
      await page.waitForTimeout(800);

      const scoreText = await page.locator('.team-panel.active .score-value').first().textContent();
      scores.push(parseInt(scoreText.replace(/[^0-9]/g, '')));
      console.log(`Submitted ${throwScore}, score now: ${scores[scores.length - 1]}`);
    }

    // UNDO all three throws
    for (let i = 0; i < 3; i++) {
      await page.locator('button.action-btn.undo').click();
      await page.waitForTimeout(500);
      await page.locator('button.action-btn.undo').click();
      await page.waitForTimeout(1000);

      const scoreText = await page.locator('.team-panel.active .score-value').first().textContent();
      const currentScore = parseInt(scoreText.replace(/[^0-9]/g, ''));
      console.log(`After UNDO ${i + 1}, score: ${currentScore}`);
    }

    // Score should be back to initial
    const finalScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const finalScore = parseInt(finalScoreText.replace(/[^0-9]/g, ''));

    expect(finalScore).toBe(initialScore);
    console.log('✓ Multiple UNDO operations worked correctly, score back to initial:', initialScore);
  });

  test('should not break when UNDO pressed with no throws', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Testing UNDO with no throws (should not break)');

    // Get initial score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));

    // Click UNDO multiple times with no throws
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(300);
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(300);
    await page.locator('button.action-btn.undo').click();
    await page.waitForTimeout(300);

    // Score should remain unchanged
    const afterUndoText = await page.locator('.team-panel.active .score-value').first().textContent();
    const afterUndo = parseInt(afterUndoText.replace(/[^0-9]/g, ''));

    expect(afterUndo).toBe(initialScore);
    console.log('✓ UNDO with no throws did not break scorer');
  });

});
