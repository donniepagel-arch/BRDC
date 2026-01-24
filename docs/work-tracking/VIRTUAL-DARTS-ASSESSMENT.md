# Virtual Darts Assessment

**Date:** 2026-01-21
**Location:** `/public/virtual-darts/`

## Purpose/Description

Virtual Darts is a **mobile-first dart practice and game simulation** built with HTML5 Canvas. It allows users to:

1. **Practice Mode** - Calibrate throw style by swiping to throw darts at the bullseye
2. **501 Game** - Classic X01 game with double-out rules
3. **Cricket** - Strategic dart game closing numbers 15-20 + bull

The feature uses swipe gestures to simulate throwing darts, with physics-based trajectory and accuracy based on swipe quality.

## Architecture

The feature uses a **phased loading system** with 5 phases:

| Phase | Name | Files | Purpose |
|-------|------|-------|---------|
| **1** | Core MVP | dartboard.js, swipeDetector.js, physics.js, practiceMode.js, main.js | Basic gameplay |
| **2** | Aim & Strategy | aimSystem.js, outshotTables.js, autoSuggest.js, tipEngine.js, cricketLogic.js | Targeting, checkout suggestions |
| **3** | Advanced | collision.js, ochePosition.js, animations.js | Dart collisions, oche slider |
| **4** | Integration | profileManager.js, gameLogger.js, statsTracker.js | Firebase integration, stats |
| **5** | Polish | tutorial.js | Onboarding tutorial |

**Current Phase Level:** `PHASE_LEVEL: 1` (only Phase 1 is enabled)

## File Structure

```
virtual-darts/
├── index.html           # Main HTML with screens
├── styles.css           # Complete styling
├── config.js            # Configuration and difficulty presets
├── data/
│   ├── outshots.json    # Checkout combinations
│   ├── wedgeShots.json  # Wedge targeting data
│   └── cricketRules.json
└── js/
    ├── phase1/          # Core (IMPLEMENTED)
    ├── phase2/          # Aim system (IMPLEMENTED but not enabled)
    ├── phase3/          # Advanced (IMPLEMENTED but not enabled)
    ├── phase4/          # Firebase integration (IMPLEMENTED but not enabled)
    └── phase5/          # Tutorial (IMPLEMENTED but not enabled)
```

## Current State

### What Works (Phase 1)
- Canvas-based dartboard rendering (accurate proportions)
- Swipe gesture detection
- Physics-based throw calculation
- Practice mode with baseline calibration
- 501 game with scoring, bust detection, double-out
- Cricket game with mark tracking
- Difficulty presets (Easy/Medium/Hard/Pro)
- Results screens with stats
- Local storage for throw profile

### What's Complete but Not Enabled
- **Phase 2:** Outshot tables, aim system, auto-suggest, tips
- **Phase 3:** Dart collision detection, oche position slider, animations
- **Phase 4:** Profile manager, game logger, stats tracker (Firebase integration)
- **Phase 5:** Tutorial system with lessons

### What's Missing
1. **Not linked from app** - No entry point from dashboard/menu
2. **No Firebase auth** - Uses localStorage only
3. **CSS needs work** - Styles exist but may need mobile testing
4. **Phase 4 integration incomplete** - Firebase code exists but untested

## Integration Status

| Aspect | Status |
|--------|--------|
| Linked from dashboard | **No** |
| Linked from any page | **No** |
| Uses Firebase auth | **No** (localStorage only) |
| Uses Firebase data | **No** (Phase 4 disabled) |
| Shares styling with app | Partial (uses same fonts) |
| Has back button | Yes (links to `/pages/dashboard.html`) |

## Effort to Complete

| Task | Effort | Priority |
|------|--------|----------|
| Add link from dashboard | 10 min | High |
| Test Phase 1 on mobile | 30 min | High |
| Enable Phase 2 (tips/suggestions) | 15 min | Medium |
| Enable Phase 3 (animations) | 15 min | Low |
| Enable Phase 4 (Firebase) | 2-4 hrs | Medium |
| Enable Phase 5 (tutorial) | 15 min | Low |
| Full mobile CSS polish | 1-2 hrs | Medium |

**Total to make usable:** ~1 hour (link + test + enable Phase 2)
**Total to fully integrate:** 4-6 hours

## Quick Wins Available

1. **Add link to dashboard** - Simple menu item addition
2. **Enable Phase 2** - Just change `PHASE_LEVEL: 1` to `PHASE_LEVEL: 2`
3. **Test existing functionality** - Phase 1 appears complete

## Recommendation

**DEFER** - Keep but don't prioritize

### Reasoning
1. **Well-architected** - Code is clean, modular, and follows good patterns
2. **Mostly complete** - Core functionality works, just needs linking
3. **Not core to league management** - Nice-to-have feature, not essential
4. **Low risk to keep** - Doesn't interfere with other features

### Suggested Timeline
1. **Now:** Add simple link from dashboard (quick win)
2. **Later:** Enable Phase 2-3 for better experience
3. **Future:** Full Firebase integration when time permits

## Test URL

Direct access: https://brdc-v2.web.app/virtual-darts/index.html

## Action Items

- [ ] Add "Virtual Darts" link to dashboard menu
- [ ] Test Phase 1 on mobile devices
- [ ] Enable Phase 2 after testing
- [ ] Consider Firebase integration for logged-in users
