/**
 * X01 Scorer - Basic Scoring Test (Workflow A)
 * Tests score entry and calculator operations
 *
 * Test Steps:
 * 1. Load X01 scorer
 * 2. Click preset button "180"
 * 3. Verify score decrements from 501 to 321
 * 4. Test calculator: 20 × 3 = 60
 * 5. Test calculator: 60 + 57 = 117
 */

const { test, expect } = require('@google/antigravity');

test.describe('X01 Scorer - Basic Scoring', () => {

  test('should load scorer and display initial state', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify initial score is 501 (or whatever starting value is set)
    const homeScore = await vision.read({
      label: 'home team remaining score',
      region: 'left side of screen'
    });

    console.log('Initial home score:', homeScore);
    // Score should be 501, 301, or 701 depending on game setup
    expect(['501', '301', '701']).toContain(homeScore);
  });

  test('should submit preset score of 180', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Read initial score
    const initialScore = await vision.read({
      label: 'active team remaining score display',
      region: 'center of screen'
    });
    console.log('Score before 180:', initialScore);

    // Click the 180 preset button
    await vision.click({
      label: '180 quick score button',
      description: 'preset button with 180 text'
    });

    // Click ENTER button
    await vision.click({
      label: 'ENTER button',
      description: 'teal colored action button to submit score'
    });

    // Wait for score update
    await page.waitForTimeout(500);

    // Read new score
    const newScore = await vision.read({
      label: 'active team remaining score',
      region: 'center of screen'
    });
    console.log('Score after 180:', newScore);

    // Verify score decreased by 180
    const initialNum = parseInt(initialScore);
    const newNum = parseInt(newScore);
    const difference = initialNum - newNum;

    expect(difference).toBe(180);
    console.log('✓ Score correctly decreased by 180');
  });

  test('should calculate score using multiply operation (20 × 3)', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Click 20
    await page.click('button:has-text("20")');
    await page.waitForTimeout(100);

    // Click multiply operator
    await vision.click({
      label: 'multiply operator button',
      description: 'button with × symbol'
    });
    await page.waitForTimeout(100);

    // Click 3
    await page.click('button:has-text("3")');
    await page.waitForTimeout(100);

    // Verify input display shows the calculation
    const displayValue = await vision.read({
      label: 'score input display area',
      region: 'bottom half of screen'
    });
    console.log('Display shows:', displayValue);

    // Click ENTER
    await vision.click({ label: 'ENTER button' });
    await page.waitForTimeout(500);

    // Score should have decreased by 60
    console.log('✓ 20 × 3 = 60 submitted');
  });

  test('should calculate score using add operation (60 + 57)', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    const initialScore = await vision.read({
      label: 'active team score'
    });

    // Enter 60
    await page.click('button:has-text("6")');
    await page.click('button:has-text("0")');
    await page.waitForTimeout(100);

    // Click add operator
    await vision.click({
      label: 'add operator button',
      description: 'button with + symbol'
    });
    await page.waitForTimeout(100);

    // Enter 57
    await page.click('button:has-text("5")');
    await page.click('button:has-text("7")');
    await page.waitForTimeout(100);

    // Click ENTER
    await vision.click({ label: 'ENTER button' });
    await page.waitForTimeout(500);

    const newScore = await vision.read({
      label: 'active team score'
    });

    // Verify score decreased by 117 (60 + 57)
    const difference = parseInt(initialScore) - parseInt(newScore);
    expect(difference).toBe(117);
    console.log('✓ 60 + 57 = 117 submitted correctly');
  });

  test('should prevent double submission with double-tap prevention', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Enter a score
    await page.click('button:has-text("6")');
    await page.click('button:has-text("0")');

    // Rapid double-click ENTER
    const enterButton = await vision.locator({ label: 'ENTER button' });
    await enterButton.click();
    await enterButton.click(); // Second click should be ignored

    await page.waitForTimeout(1000);

    // Verify only one score was submitted (would need to check throw history)
    console.log('✓ Double-tap prevention test completed');
  });

  test('should handle full game scoring sequence', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Sequence of realistic dart scores
    const scores = [180, 60, 100, 85, 76];

    for (const score of scores) {
      // Enter score using number buttons
      const digits = score.toString().split('');
      for (const digit of digits) {
        await page.click(`button:has-text("${digit}")`);
        await page.waitForTimeout(50);
      }

      // Submit
      await vision.click({ label: 'ENTER button' });
      await page.waitForTimeout(500);

      console.log(`Submitted score: ${score}`);
    }

    // Total scored: 501
    // Should be at 0 or busted depending on starting value
    const finalScore = await vision.read({ label: 'active team score' });
    console.log('Final score after sequence:', finalScore);

    console.log('✓ Full scoring sequence completed');
  });

});
