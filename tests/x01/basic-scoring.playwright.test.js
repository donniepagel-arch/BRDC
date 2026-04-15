/**
 * X01 Scorer - Basic Scoring Test (Workflow A)
 * Tests score entry and calculator operations
 * Converted from Antigravity to Playwright
 *
 * Test Steps:
 * 1. Load X01 scorer
 * 2. Click preset button "180"
 * 3. Verify score decrements from 501 to 321
 * 4. Test calculator: 20 × 3 = 60
 * 5. Test calculator: 60 + 57 = 117
 */

const { test, expect } = require('@playwright/test');

test.describe('X01 Scorer - Basic Scoring', () => {

  test('should load scorer and display initial state', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Verify the scorer loaded
    await expect(page.locator('.game-title')).toContainText('X01');

    // Verify calculator is visible
    await expect(page.locator('.calc-key').first()).toBeVisible();

    console.log('✓ Scorer loaded successfully');
  });

  test('should submit preset score of 180', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Wait for page to fully initialize
    await page.waitForTimeout(1000);

    // Get initial score - find the active team's score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));
    console.log('Score before 180:', initialScore);

    // Click the 180 preset button
    await page.locator('button.side-btn').filter({ hasText: '180' }).click();

    // Wait for input to register
    await page.waitForTimeout(300);

    // Click ENTER button
    await page.locator('button.action-btn.enter').click();

    // Wait for score update
    await page.waitForTimeout(1000);

    // Get new score
    const newScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const newScore = parseInt(newScoreText.replace(/[^0-9]/g, ''));
    console.log('Score after 180:', newScore);

    // Verify score decreased by 180
    const difference = initialScore - newScore;
    expect(difference).toBe(180);
    console.log('✓ Score correctly decreased by 180');
  });

  test('should calculate score using multiply operation (20 × 3)', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get initial score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));
    console.log('Initial score:', initialScore);

    // Click 2
    await page.locator('button.calc-key').filter({ hasText: /^2$/ }).click();
    await page.waitForTimeout(100);

    // Click 0
    await page.locator('button.calc-key').filter({ hasText: /^0$/ }).click();
    await page.waitForTimeout(100);

    // Click multiply operator (×)
    await page.locator('button.calc-key.operator').filter({ hasText: 'x' }).click();
    await page.waitForTimeout(100);

    // Click 3
    await page.locator('button.calc-key').filter({ hasText: /^3$/ }).click();
    await page.waitForTimeout(100);

    // Click ENTER
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // Get new score
    const newScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const newScore = parseInt(newScoreText.replace(/[^0-9]/g, ''));
    console.log('Score after 20 × 3:', newScore);

    // Score should have decreased by 60
    const difference = initialScore - newScore;
    expect(difference).toBe(60);
    console.log('✓ 20 × 3 = 60 submitted correctly');
  });

  test('should calculate score using add operation (60 + 57)', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get initial score
    const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));
    console.log('Initial score:', initialScore);

    // Enter 60
    await page.locator('button.calc-key').filter({ hasText: /^6$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^0$/ }).click();
    await page.waitForTimeout(100);

    // Click add operator (+)
    await page.locator('button.calc-key.operator').filter({ hasText: '+' }).click();
    await page.waitForTimeout(100);

    // Enter 57
    await page.locator('button.calc-key').filter({ hasText: /^5$/ }).click();
    await page.waitForTimeout(50);
    await page.locator('button.calc-key').filter({ hasText: /^7$/ }).click();
    await page.waitForTimeout(100);

    // Click ENTER
    await page.locator('button.action-btn.enter').click();
    await page.waitForTimeout(1000);

    // Get new score
    const newScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
    const newScore = parseInt(newScoreText.replace(/[^0-9]/g, ''));
    console.log('Score after 60 + 57:', newScore);

    // Verify score decreased by 117 (60 + 57)
    const difference = initialScore - newScore;
    expect(difference).toBe(117);
    console.log('✓ 60 + 57 = 117 submitted correctly');
  });

  test('should handle full game scoring sequence', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Sequence of realistic dart scores
    const scores = [180, 60, 100, 85, 76];

    for (const score of scores) {
      // Enter score using number buttons
      const digits = score.toString().split('');
      for (const digit of digits) {
        const regex = new RegExp(`^${digit}$`);
        await page.locator('button.calc-key').filter({ hasText: regex }).click();
        await page.waitForTimeout(50);
      }

      // Submit
      await page.locator('button.action-btn.enter').click();
      await page.waitForTimeout(800);

      console.log(`Submitted score: ${score}`);
    }

    // Get final score
    const finalScoreText = await page.locator('.team-panel .score-value').first().textContent();
    console.log('Final score after sequence:', finalScoreText);

    console.log('✓ Full scoring sequence completed');
  });

  test('should use preset quick score buttons', async ({ page }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const presetScores = ['60', '81', '85', '100', '140'];

    for (const score of presetScores) {
      // Get initial score
      const initialScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
      const initialScore = parseInt(initialScoreText.replace(/[^0-9]/g, ''));

      // Click preset button (side-btn or calc-key with shortcut class)
      const button = page.locator('button.side-btn, button.calc-key.shortcut').filter({ hasText: score });
      if (await button.count() > 0) {
        await button.first().click();
        await page.waitForTimeout(200);

        // Click ENTER
        await page.locator('button.action-btn.enter').click();
        await page.waitForTimeout(800);

        // Verify score changed
        const newScoreText = await page.locator('.team-panel.active .score-value').first().textContent();
        const newScore = parseInt(newScoreText.replace(/[^0-9]/g, ''));
        const difference = initialScore - newScore;

        expect(difference).toBe(parseInt(score));
        console.log(`✓ Preset button ${score} worked correctly`);
      }
    }
  });

});
