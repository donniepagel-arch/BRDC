# Quick Start: Running BRDC Playwright Tests

## Step 1: Install Browsers (One-Time Setup)

```bash
cd /c/Users/gcfrp/projects/brdc-firebase
npx playwright install
```

This downloads Chromium (~100MB). Takes 1-2 minutes.

---

## Step 2: Verify Firebase Server Running

The server should already be running on localhost:5000.

Test it:
```bash
curl http://localhost:5000
```

If not running, start it:
```bash
firebase serve --only hosting
```

---

## Step 3: Run Tests

### Run All X01 Tests (Recommended First Run)
```bash
npm run test:x01
```

This runs all 22 tests:
- 6 basic scoring tests
- 5 impossible score tests
- 5 UNDO tests
- 6 bust detection tests

**Time:** ~3-5 minutes

---

### Run Individual Test Suites

**Basic Scoring (6 tests):**
```bash
npm run test:basic
```
Tests: 180 button, calculator (20×3, 60+57), preset buttons

**Impossible Scores (5 tests):**
```bash
npm run test:impossible
```
Tests: 179, 178, 176, 173, 172, 169, 166, 163 rejection

**UNDO Functionality (5 tests):**
```bash
npm run test:undo
```
Tests: Clear input, remove throws, stat recalculation

**Bust Detection (6 tests):**
```bash
npm run test:bust
```
Tests: Exceeding score, landing on 1, checkout attempts

---

## Step 4: View Results

### Watch Live
Tests run in **headed mode** (browser visible). You'll see:
- Browser window opens
- Buttons being clicked
- Scores changing
- Console logs in terminal

### After Tests Complete

**HTML Report (Best for Reviewing):**
```bash
npm run test:report
```

Opens interactive report in browser showing:
- Pass/fail status
- Execution time
- Screenshots of failures
- Test details

**Video Recordings:**
Located in: `test-results/<test-name>/video.webm`

Every test records video automatically.

**Screenshots (Failures Only):**
Located in: `test-results/<test-name>/test-failed-1.png`

---

## Expected Output

### Console (Live During Tests)

```
Running 6 tests using 1 worker

✓ X01 Scorer - Basic Scoring › should load scorer (2.3s)
✓ X01 Scorer - Basic Scoring › should submit preset score of 180 (3.1s)
Score before 180: 501
Score after 180: 321
✓ Score correctly decreased by 180
...
```

### Summary at End

```
6 passed (18.5s)

To open the last HTML report run:
  npx playwright show-report
```

---

## Troubleshooting

### Issue: "Executable doesn't exist"
**Solution:** Run `npx playwright install`

### Issue: "net::ERR_CONNECTION_REFUSED"
**Solution:** Start Firebase server: `firebase serve --only hosting`

### Issue: Tests timing out
**Solution:** Increase timeout in `playwright.config.js`:
```javascript
timeout: 120 * 1000, // 2 minutes
```

### Issue: All tests failing
**Solution:**
1. Check Firebase server is running
2. Navigate to http://localhost:5000/pages/x01-scorer.html manually
3. Verify buttons are clickable

---

## Test Details

### What Gets Tested

✓ **Button Clicking:**
- Quick score buttons (180, 60, 81, 85, 100, 140)
- Number pad (0-9)
- Calculator operators (× and +)
- Action buttons (ENTER, UNDO, MISS)

✓ **Score Logic:**
- Score decrements correctly
- Calculator operations (20×3=60, 60+57=117)
- Impossible scores rejected (alert appears)
- Valid scores accepted

✓ **UNDO Behavior:**
- First UNDO clears input
- Second UNDO removes last throw
- Score reverts correctly
- Stats recalculate

✓ **Bust Detection:**
- Bust when exceeding remaining
- Bust when landing on 1
- Turn switches after bust
- Score remains unchanged

### Test Configuration

- **Device:** iPad Pro 11" Landscape (1194x834)
- **Browser:** Chromium
- **Mode:** Headed (visible)
- **Video:** Always recorded
- **Screenshots:** On failure
- **Timeout:** 60 seconds per test

---

## Quick Commands Reference

```bash
# Install (one-time)
npx playwright install

# Run all X01 tests
npm run test:x01

# Run specific suite
npm run test:basic
npm run test:impossible
npm run test:undo
npm run test:bust

# View report
npm run test:report

# Run in headless mode (no browser window)
npx playwright test --headed=false

# Run specific test file
npx playwright test tests/x01/basic-scoring.playwright.test.js

# Debug mode (pauses on failures)
npx playwright test --debug

# Update snapshots (if using visual regression)
npx playwright test --update-snapshots
```

---

## File Locations

```
brdc-firebase/
├── playwright.config.js          # Configuration
├── package.json                   # NPM scripts
├── tests/
│   └── x01/
│       ├── basic-scoring.playwright.test.js
│       ├── impossible-scores.playwright.test.js
│       ├── undo.playwright.test.js
│       └── bust-detection.playwright.test.js
├── test-results/                  # Output (auto-generated)
│   ├── <test-name>/
│   │   ├── video.webm            # Recording
│   │   └── screenshots/          # Failure screenshots
│   └── results.json              # JSON results
└── playwright-report/             # HTML report (auto-generated)
    └── index.html
```

---

## Success Indicators

✅ **All Tests Pass:**
```
22 passed (45.2s)
```

✅ **Video Shows:**
- Buttons clicking smoothly
- Scores updating correctly
- Alerts appearing for impossible scores
- UNDO reverting throws

✅ **Console Shows:**
```
✓ Score correctly decreased by 180
✓ 20 × 3 = 60 submitted correctly
✓ 179 correctly rejected
✓ UNDO removed last throw, score reverted
```

---

## Need Help?

1. **Check Video:** Review `test-results/<test-name>/video.webm`
2. **Check Screenshots:** Look for red highlights in failure screenshots
3. **Check Console:** Terminal shows which test failed and why
4. **Check HTML Report:** `npm run test:report` for detailed breakdown

---

**Ready to test? Run:**

```bash
npx playwright install
npm run test:x01
```

Good luck! 🎯
