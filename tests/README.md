# BRDC Scorer Automated Tests

Automated browser tests for X01 and Cricket scorers using Google Antigravity.

## Prerequisites

- ✅ Google Antigravity installed (v1.104.0)
- ✅ Firebase CLI installed (v15.2.1)
- ✅ Local Firebase server running on port 5000

## Quick Start

### 1. Start Firebase Server (if not already running)

```bash
cd /c/Users/gcfrp/projects/brdc-firebase
firebase serve --only hosting --port 5000
```

Leave this running in a terminal window.

### 2. Run Tests

In a new terminal:

```bash
cd /c/Users/gcfrp/projects/brdc-firebase

# Run all tests
antigravity test

# Run only X01 tests
antigravity test tests/x01/

# Run only Cricket tests
antigravity test tests/cricket/

# Run a specific test file
antigravity test tests/x01/basic-scoring.test.js

# Run with browser visible (not headless)
antigravity test --headed

# Run with debug mode and slow motion
antigravity test --headed --slowMo=500 --debug
```

## Test Structure

```
tests/
├── antigravity.config.js       # Main configuration
├── package.json                 # Test dependencies
├── x01/                         # X01 Scorer tests
│   ├── basic-scoring.test.js    # ✅ Score entry & calculator
│   └── impossible-scores.test.js # ✅ Impossible score validation
├── cricket/                     # Cricket Scorer tests
│   └── (pending)
└── integration/                 # Integration tests
    └── (pending)
```

## Configuration

Edit `antigravity.config.js` to adjust:

- **Viewport size** - Currently set to iPhone 12/13/14 (390×844)
- **Headless mode** - Set `headless: true` to hide browser
- **Slow motion** - Increase `slowMo` to watch tests more slowly
- **Video recording** - Enabled by default, saved to `./test-videos/`
- **Screenshots** - Captured on failure, saved to `./test-screenshots/`

## Test Workflows

### Implemented ✅

1. **Basic Scoring (Workflow A)**
   - Preset button clicks (180)
   - Calculator operations (× and +)
   - Score decrements
   - Double-tap prevention

2. **Impossible Score Validation (Workflow B)**
   - Rejects: 179, 178, 176, 173, 172, 169, 166, 163
   - Accepts: 180, 177, 174, 171, 170, 167, 164, 161
   - Clear error messages

### Pending 🔨

3. Master Out Checkout (Workflow C)
4. Checkout Dart Count (Workflow D)
5. Bust Detection (Workflow E)
6. Undo Functionality (Workflow F)
7. Cricket Mark Entry (Workflow G)
8. Cricket MPR Calculation (Workflow H)
9. Cricket Winner Detection (Workflow I)
10. Cricket Stats (Workflow J)
11. Cricket Undo (Workflow K)
12. Game Transitions (Workflow L)
13. Bot Validation (Workflow M)

See [ANTIGRAVITY-TEST-PLAN.md](../scratchpad/ANTIGRAVITY-TEST-PLAN.md) for full workflow details.

## Troubleshooting

### "Cannot find module '@google/antigravity'"

Antigravity is installed globally. Tests use the global installation. No npm install needed.

### "Connection refused to localhost:5000"

Firebase server isn't running. Start it with:
```bash
firebase serve --only hosting --port 5000
```

### Tests fail with timeout errors

Increase timeout in `antigravity.config.js`:
```javascript
timeout: 60000, // 60 seconds
```

### Can't see what's happening during tests

Run with headed and slow motion:
```bash
antigravity test --headed --slowMo=1000
```

### Vision-based selectors failing

Antigravity uses Gemini 3 for vision. If selectors fail:
1. Check that elements are visible on screen
2. Try more specific descriptions in `vision.click()` calls
3. Fall back to CSS selectors: `page.click('button.enter-btn')`

## Viewing Results

- **Test Reports**: `./test-reports/` (HTML)
- **Videos**: `./test-videos/` (MP4)
- **Screenshots**: `./test-screenshots/` (PNG, failures only)

## Writing New Tests

Use this template:

```javascript
const { test, expect } = require('@google/antigravity');

test.describe('Feature Name', () => {

  test('should do something', async ({ page, vision }) => {
    // Navigate
    await page.goto('/pages/x01-scorer.html');
    await page.waitForLoadState('networkidle');

    // Use vision for semantic element finding
    await vision.click({
      label: 'ENTER button',
      description: 'teal action button to submit'
    });

    // Or use standard Playwright selectors
    await page.click('button:has-text("ENTER")');

    // Read text with vision
    const score = await vision.read({
      label: 'remaining score display'
    });

    // Assert
    expect(score).toBe('321');
  });

});
```

## Next Steps

1. ✅ Run basic-scoring.test.js to verify setup
2. ✅ Run impossible-scores.test.js to test validation
3. 🔨 Implement remaining workflows C-M
4. 📊 Analyze test results and create bug reports

## Resources

- [Google Antigravity Docs](https://codelabs.developers.google.com/getting-started-google-antigravity)
- [Test Plan](../scratchpad/ANTIGRAVITY-TEST-PLAN.md)
- [X01 Test Documentation](../docs/work-tracking/TEST-X01-SCORER.md)
- [Cricket Test Documentation](../docs/work-tracking/TEST-CRICKET-SCORER.md)
