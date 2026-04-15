// Google Antigravity Configuration for BRDC Scorer Testing
// Documentation: https://codelabs.developers.google.com/getting-started-google-antigravity

module.exports = {
  // Base URL for testing (local Firebase server)
  baseUrl: 'http://localhost:5000',

  // Browser configuration
  browser: 'chromium',
  headless: false, // Show browser during test development for debugging

  // Viewport settings for mobile testing
  viewport: {
    width: 390,  // iPhone 12/13/14 width
    height: 844, // iPhone 12/13/14 height
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  },

  // Video recording for all test runs
  videoRecording: true,
  videoDir: './test-videos',

  // Screenshot on failure
  screenshotOnFailure: true,
  screenshotDir: './test-screenshots',

  // Gemini AI configuration for vision-based element detection
  gemini: {
    model: 'gemini-3-flash', // Fast model for quick element detection
    vision: true,
    apiKey: process.env.GEMINI_API_KEY || 'auto', // Uses Antigravity built-in key if available
  },

  // Test timeouts
  timeout: 30000, // 30 seconds per test
  navigationTimeout: 10000, // 10 seconds for page loads

  // Retry configuration
  retries: 2, // Retry failed tests twice

  // Test output
  reporter: 'html', // Generate HTML test report
  reportDir: './test-reports',

  // Slow motion (ms delay between actions for visibility during development)
  slowMo: 100, // 100ms delay makes tests easier to watch

  // Projects for different test suites
  projects: [
    {
      name: 'x01-scorer',
      testMatch: 'tests/x01/**/*.test.js',
      baseUrl: 'http://localhost:5000/pages/x01-scorer.html'
    },
    {
      name: 'cricket-scorer',
      testMatch: 'tests/cricket/**/*.test.js',
      baseUrl: 'http://localhost:5000/pages/league-cricket.html'
    },
    {
      name: 'integration',
      testMatch: 'tests/integration/**/*.test.js',
      baseUrl: 'http://localhost:5000'
    }
  ],

  // Environment variables passed to tests
  env: {
    TEST_ENV: 'local',
    FIREBASE_PORT: '5000'
  }
};
