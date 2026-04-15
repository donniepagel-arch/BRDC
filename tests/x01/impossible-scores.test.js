/**
 * X01 Scorer - Impossible Score Validation Test (Workflow B)
 * Tests that mathematically impossible 3-dart scores are rejected
 *
 * Impossible scores: 179, 178, 176, 173, 172, 169, 166, 163
 * These cannot be achieved with any combination of 3 darts
 */

const { test, expect } = require('@google/antigravity');

test.describe('X01 Scorer - Impossible Score Validation', () => {

  const IMPOSSIBLE_SCORES = [179, 178, 176, 173, 172, 169, 166, 163];

  test('should reject all impossible scores with alert message', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    for (const impossibleScore of IMPOSSIBLE_SCORES) {
      console.log(`Testing impossible score: ${impossibleScore}`);

      // Set up alert handler BEFORE triggering the action
      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        console.log('Alert message:', alertMessage);
        await dialog.accept();
      });

      // Enter the impossible score
      const digits = impossibleScore.toString().split('');
      for (const digit of digits) {
        await page.click(`button:has-text("${digit}")`);
        await page.waitForTimeout(50);
      }

      // Click ENTER
      await vision.click({ label: 'ENTER button' });

      // Wait for alert to appear and be handled
      await page.waitForTimeout(500);

      // Verify alert message contains the score and "not achievable" or similar
      expect(alertMessage).toContain(impossibleScore.toString());
      expect(alertMessage.toLowerCase()).toMatch(/invalid|not achievable|impossible/);

      console.log(`✓ ${impossibleScore} correctly rejected`);

      // Verify input was cleared
      const inputDisplay = await vision.read({
        label: 'score input display',
        region: 'bottom of screen'
      });

      // Input should be cleared to 0 or empty
      expect(['0', '', '00']).toContain(inputDisplay.trim());

      // Wait before next test
      await page.waitForTimeout(300);
    }

    console.log('✓ All impossible scores rejected successfully');
  });

  test('should accept valid high scores near impossible ones', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

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

      // No alert should appear
      let alertFired = false;
      page.on('dialog', async dialog => {
        alertFired = true;
        await dialog.accept();
      });

      const initialScore = await vision.read({ label: 'active team score' });

      // Enter the valid score
      const digits = validScore.toString().split('');
      for (const digit of digits) {
        await page.click(`button:has-text("${digit}")`);
        await page.waitForTimeout(50);
      }

      // Click ENTER
      await vision.click({ label: 'ENTER button' });
      await page.waitForTimeout(500);

      // Verify no alert appeared
      expect(alertFired).toBe(false);

      // Verify score decreased
      const newScore = await vision.read({ label: 'active team score' });
      const difference = parseInt(initialScore) - parseInt(newScore);
      expect(difference).toBe(validScore);

      console.log(`✓ ${validScore} accepted correctly`);
    }

    console.log('✓ All valid high scores accepted');
  });

  test('should reject impossible scores even when using calculator operations', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Try to create impossible score: 100 + 79 = 179 (impossible)
    let alertMessage = '';
    page.once('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Enter 100 + 79
    await page.click('button:has-text("1")');
    await page.click('button:has-text("0")');
    await page.click('button:has-text("0")');
    await vision.click({ label: 'add operator' });
    await page.click('button:has-text("7")');
    await page.click('button:has-text("9")');

    await vision.click({ label: 'ENTER button' });
    await page.waitForTimeout(500);

    // Should be rejected
    expect(alertMessage).toContain('179');
    console.log('✓ Impossible score via calculator operation also rejected');
  });

  test('should provide clear error message format', async ({ page, vision }) => {
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    let alertMessage = '';
    page.once('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Enter impossible score 179
    await page.click('button:has-text("1")');
    await page.click('button:has-text("7")');
    await page.click('button:has-text("9")');
    await vision.click({ label: 'ENTER button' });
    await page.waitForTimeout(500);

    // Check message format is helpful
    console.log('Error message:', alertMessage);

    // Should contain:
    // - The score number
    // - Indication it's invalid/impossible
    // - Reference to "3 darts" or similar
    expect(alertMessage).toMatch(/179/);
    expect(alertMessage.toLowerCase()).toMatch(/invalid|not achievable|impossible/);
    expect(alertMessage.toLowerCase()).toMatch(/darts?/);

    console.log('✓ Error message is clear and informative');
  });

});
