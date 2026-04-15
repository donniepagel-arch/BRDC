// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for BRDC Dart Scorer Testing
 *
 * Tests the X01 and Cricket scorers on localhost:5000
 * Configured for TABLET viewport (iPad Pro 11" Portrait) - 99% of users are on tablets
 */
module.exports = defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/x01/basic-scoring.test.js',
    '**/x01/impossible-scores.test.js',
  ],

  // Maximum time one test can run for
  timeout: 60 * 1000,

  // Test execution settings
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests sequentially for debugging

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  // Global test settings
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:5000',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Take screenshots on failure
    screenshot: 'only-on-failure',

    // Record video for all tests
    video: 'on',

    // Browser context settings - TABLET VIEWPORT (99% of users)
    viewport: { width: 834, height: 1194 }, // iPad Pro 11" Portrait

    // iPad user agent
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',

    // Enable touch events for tablet simulation
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2, // Retina display

    // Slow down operations for visibility when running headed
    // slowMo: 50,
  },

  // Configure projects for different browsers/devices
  projects: [
    {
      name: 'iPad-Pro-Portrait',
      use: {
        ...devices['iPad Pro 11'],
        browserName: 'chromium', // Use Chromium instead of WebKit
        headless: false, // Show browser so we can watch tests
        viewport: { width: 834, height: 1194 }, // Portrait orientation
      },
    },
    {
      name: 'Generic-Tablet-Portrait',
      use: {
        viewport: { width: 800, height: 1280 }, // Generic Android tablet portrait
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        headless: false,
      },
    },
    {
      name: 'iPad-Pro-Landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
        headless: false,
        viewport: { width: 1194, height: 834 }, // Landscape for testing
      },
    },
  ],

  // Web server configuration - assumes Firebase already running
  webServer: {
    command: 'echo "Assuming Firebase server already running on localhost:5000"',
    port: 5000,
    reuseExistingServer: true,
    timeout: 5 * 1000,
  },
});
