# BRDC VIRTUAL DARTS - COMPLETE MASTER PLAN

**Version:** 1.0  
**Date:** January 20, 2026  
**Project:** Burning River Darts LLC - Virtual Darts Training Game  
**Developer:** Hand this document to Claude Code

---

## QUICK START FOR CLAUDE CODE

**Your mission:** Build a browser-based virtual darts game that teaches real dart strategy through physics-based swipe mechanics.

**Start here:** Phase 1 MVP - Create dartboard, implement swipe detection, build practice mode  
**Tech stack:** HTML5 Canvas, Vanilla JavaScript, Firebase (later phases)  
**Key principle:** This is a TEACHING TOOL first, game second

---

## EXECUTIVE SUMMARY

### What We're Building
A virtual darts game using touch/swipe controls that mirror real dart throwing physics. Players learn proper strategy, board geography, and tactical decision-making while having fun.

### Core Innovation
Three-variable swipe system:
1. **Speed** = power/velocity of throw
2. **Length** = release timing (short=early=high, long=late=low)  
3. **Straightness** = left/right accuracy

### Key Features
- Practice mode establishes personal "throw signature"
- Auto-suggest system teaches 501 outs and Cricket strategy
- Adjustable tip levels (beginner to pro)
- Deflection physics for realistic board management
- Positional throwing (off-center oche)
- Full stats tracking (MPR, PPD, etc.)
- Integration with existing BRDC tournament/league platform

---

## GAME MECHANICS DEEP DIVE

### 1. THE SWIPE SYSTEM

**Three independent variables control every throw:**

#### Speed (Power)
- **Measurement:** Pixels per second
- **Range:** 500-3000 px/s  
- **Effect:** Dart velocity (5-20 m/s)
- **Physics analog:** How hard you throw

```javascript
const speed = swipeLength / swipeDuration;
const normalized = (speed - 500) / 2500;
const velocity = 5 + (normalized * 15); // 5-20 m/s
```

#### Length (Release Point)  
- **Measurement:** Total swipe distance in pixels
- **Range:** 100-400px
- **Effect:** When dart releases in arc
- **Critical relationship:**
  - Short (100-200px) = EARLY release = dart flies HIGH
  - Medium (200-300px) = OPTIMAL release = accurate
  - Long (300-400px) = LATE release = dart flies LOW

```javascript
const releasePoint = (swipeLength - 100) / 300; // 0-1
const verticalError = (releasePoint - 0.5) * 120; // pixels
finalY = targetY + verticalError;
```

#### Straightness (Accuracy)
- **Measurement:** Horizontal deviation from vertical
- **Range:** 0-50px  
- **Effect:** Left/right drift
- **Physics analog:** Throwing straight vs hooking

```javascript
const straightness = Math.abs(endX - startX);
const direction = endX > startX ? 'right' : 'left';
const lateralShift = straightness * 0.5;
finalX = targetX + (direction === 'right' ? lateralShift : -lateralShift);
```

### Difficulty = Forgiveness

Different difficulty levels apply varying tolerance:

```javascript
EASY:   { speedTolerance: 0.4, releaseTolerance: 0.5, straightnessTolerance: 20 }
MEDIUM: { speedTolerance: 0.25, releaseTolerance: 0.3, straightnessTolerance: 10 }
HARD:   { speedTolerance: 0.15, releaseTolerance: 0.15, straightnessTolerance: 5 }
PRO:    { speedTolerance: 0.05, releaseTolerance: 0.05, straightnessTolerance: 2 }
```

---

### 2. AIM SYSTEM (Two-Step Targeting)

**Step 1:** Tap general area (e.g., "triple 20 region")  
**Step 2:** Zoom in 3-5x, see precise wires  
**Step 3:** Tap exact spot you want to hit  
**Step 4:** Zoom out centered

**Key requirement:** Target centers HORIZONTALLY but stays vertically accurate (T20 always higher than T3, Bull at vertical center)

**Crosshair interaction:**
- Swipe = accept auto-suggested target
- Touch crosshair = manual aim override

---

### 3. PRACTICE MODE (Calibration)

**Purpose:** Discover player's natural throw signature

**How it works:**
1. Display large target area
2. Player throws 15-20 darts naturally (no aiming)
3. System tracks all landing points, swipe patterns
4. Analyzes grouping, drift, consistency
5. Creates baseline profile

**What gets saved:**
```javascript
playerBaseline = {
  avgSpeed: 1885,        // Their comfortable speed
  avgLength: 241,        // Their comfortable swipe length
  naturalDrift: +15,     // Drifts 15px right consistently
  groupingRadius: 23,    // Standard deviation
  consistency: 77,       // Score 0-100
  verticalBias: -8,      // Tends to throw slightly high
  centroid: {x: 415, y: 390}
}
```

**Why this matters:**
Game knows what a "good throw" looks like FOR THIS PLAYER. Can adjust for natural drift, detect when they're "off" their baseline.

---

### 4. AUTO-SUGGEST SYSTEM

Calculates optimal shot and explains WHY.

#### 501 Logic

**On checkouts (170 down):**
```javascript
121: ['T20', 'S20', 'D20']  // or ['T17', 'D20', 'D20']
```

Shows: "Start on 60 (T20 or S20+D20)"  
Explains:
- T20 = 60 → leaves 61
- S20 = 20 → leaves 101 (still two darts)
- If S19 = 19 → leaves 102 (difficult)

**On setup shots:**
Find treble that leaves preferred finish (40, 32, 36, 48, 60, 50)

#### Cricket Logic

Core principles:
1. Down in points → HIT numbers (score)
2. Up in points → CLOSE numbers (defense)
3. Assume 1 mark per dart (conservative)

**Example scenario:**
You: 2 marks on 20s, 150 points  
Opponent: 3 marks on 19s, 145 points  
You're UP 5 points → Mode: CLOSE

Suggest: Close their 19s  
Reasoning: "They have 3 marks on 19s, cut off their scoring"

**Adaptive logic:**
If first dart gets 1 mark on their 19s (need 2 more), but you won't close in time with remaining darts, switch to scoring on your 20s.

#### Wedge Shots (Advanced)

**Example: On 46**
Suggest: "6/10 wedge"  
Aim: Between S6 and S10  
Outcomes:
- S6 (6) → 40 left (D20) ✓
- S10 (10) → 36 left (D18) ✓  
- T6 (18) → 28 left (D14) ✓
- T10 (30) → 16 left (D8) ✓

All outcomes leave makeable doubles - strategic miss planning!

---

### 5. TIP LEVELS (Adjustable Presets)

**Level 1 - Basic:**
- Show target: "T20"
- Show points: "(60)"
- Basic reasoning: "High scoring area"

**Level 2 - Intermediate:**
- Level 1 +
- Full out path: "T20 → leaves 110"
- Intermediate logic: "Still two-dart out"

**Level 3 - Advanced:**
- Level 2 +
- Wedge strategies: "6/10 wedge - all outcomes leave good doubles"
- Board geography: "Miss left → S5, miss right → S1"

**Level 4 - Pro:**
- Level 3 +
- Personal stats: "Your D20 accuracy: 68%"
- Opponent analysis: "They average 42% on D18"
- Success rates: "You hit 6/10 wedge 73% of time"

**Settings page:**
Presets at top → Click = all toggles adjust  
Modify any toggle → switches to "Custom"  
Can save multiple custom presets

---

### 6. POSITIONAL THROWING

Player can move left/right along oche (throwing line)

**Why:** Avoid deflections by throwing at angle

**Physics tradeoff:**
Moving off-center increases distance (Pythagorean theorem):
- 12" offset = ~0.8" further from board
- Requires more power (faster swipe)
- Requires earlier release (shorter swipe)
- Angle magnifies straightness errors

```javascript
const actualDistance = sqrt(baseDistance² + lateralOffset²);
const distanceFactor = actualDistance / baseDistance; // >1.0
requiredVelocity *= distanceFactor;
```

**UI:** Slider showing position, distance indicator, angle display

---

### 7. DEFLECTION SYSTEM

Darts on board = collision objects

**Types:**
1. **Robin Hood** (shaft hit) = unpredictable bounce, ~2% probability
2. **Wire deflection** = bounce to adjacent segment, ~8% probability  
3. **Barrel contact** = glancing blow, ~15-25% if grouped
4. **Flight clip** = minor deflection, ~10% probability

**Each dart has collision zones:**
```javascript
{
  tip: { radius: 1px },
  barrel: { length: 15px, radius: 3px },
  shaft: { length: 20px, radius: 1.5px },
  flight: { radius: 8px }
}
```

**Strategic impact:**
- Board management matters
- First 2 darts grouped = good
- Third dart at same spot = deflection risk
- Solution: Move oche position or switch target

---

## TECHNICAL ARCHITECTURE

### Tech Stack
- **Frontend:** HTML5 Canvas, Vanilla JavaScript (ES6+)
- **Physics:** Custom implementation (Matter.js optional for Phase 3)
- **Data:** Firebase Firestore, Firebase Cloud Functions
- **Hosting:** Cloudflare Pages (existing BRDC setup)

### File Structure
```
/virtual-darts/
├── index.html
├── /css/
│   ├── styles.css
│   └── settings.css
├── /js/
│   ├── config.js              # Constants
│   ├── main.js                # Game loop
│   ├── /rendering/
│   │   ├── dartboard.js       # Board drawing
│   │   ├── dart.js            # Dart rendering
│   │   └── ui.js              # HUD components
│   ├── /input/
│   │   └── swipeDetector.js   # Touch handling
│   ├── /physics/
│   │   ├── physics.js         # Trajectories
│   │   ├── collision.js       # Deflections
│   │   └── scoring.js         # Hit calculation
│   ├── /game/
│   │   ├── gameState.js       # State management
│   │   ├── practiceMode.js    # Calibration
│   │   ├── aimSystem.js       # Zoom/aim
│   │   └── player.js          # Profile
│   ├── /strategy/
│   │   ├── autoSuggest.js     # Shot calculator
│   │   ├── tipEngine.js       # Tip levels
│   │   ├── cricketLogic.js    # Cricket rules
│   │   └── outshotTables.js   # 501 checkouts
│   ├── /stats/
│   │   ├── tracker.js         # Recording
│   │   └── calculator.js      # MPR, PPD
│   └── /firebase/
│       ├── profileManager.js  # Save/load
│       └── gameLogger.js      # Match recording
├── /assets/
│   ├── /images/
│   └── /sounds/
└── /data/
    ├── outshots.json          # Checkout table
    ├── wedgeShots.json        # Wedge data
    └── cricketRules.json      # Strategy rules
```

---

## DEVELOPMENT PHASES

### PHASE 1: MVP (2-3 weeks)
**Goal:** Playable practice mode

**Deliverables:**
1. Dartboard rendering (proper segments, colors, wires)
2. Swipe detection (speed, length, straightness)
3. Basic physics (trajectory calculation)
4. Practice mode (20 throws → baseline creation)
5. Results screen (grouping analysis, recommendations)

**Files to create:**
- config.js (constants)
- dartboard.js (rendering)
- swipeDetector.js (input)
- physics.js (trajectories)
- practiceMode.js (calibration)
- main.js (game loop)
- index.html + styles.css

**Success criteria:**
Can swipe, see dart land, complete practice, get baseline

---

### PHASE 2: Aim & Strategy (3-4 weeks)
**Goal:** Add targeting and teaching systems

**Deliverables:**
1. Zoom/aim system (two-step targeting)
2. Auto-suggest calculator (501 outs, Cricket logic)
3. Tip engine (Level 1-4 presets)
4. Settings page (toggle customization)
5. Outshot tables (complete 170-2)
6. Cricket decision tree
7. Wedge shot strategies

**Files to create:**
- aimSystem.js
- autoSuggest.js
- tipEngine.js
- cricketLogic.js
- outshotTables.js
- settings.css
- outshots.json
- cricketRules.json
- wedgeShots.json

**Success criteria:**
Can aim at specific targets, get strategic suggestions, customize tip levels

---

### PHASE 3: Advanced Features (2-3 weeks)
**Goal:** Add realism and depth

**Deliverables:**
1. Deflection system (dart-to-dart collisions)
2. Positional throwing (oche slider)
3. Difficulty tuning (forgiveness calibration)
4. Sound effects
5. Animations (dart flight, deflections)
6. Tutorial mode

**Files to create:**
- collision.js
- animations.css
- tutorial.js
- Sound files (throw, hit, deflection)

**Success criteria:**
Darts can deflect off each other, can throw from off-center, difficulty feels balanced

---

### PHASE 4: Integration (2-3 weeks)
**Goal:** Connect to BRDC platform

**Deliverables:**
1. Firebase authentication (use existing)
2. Profile management (save baselines, settings)
3. Stats tracking (MPR, PPD, etc.)
4. Dashboard integration (virtual darts tab)
5. Tournament/league toggle (add "Virtual" option to creator)
6. Match logging
7. Leaderboards

**Files to create:**
- auth.js
- profileManager.js
- gameLogger.js
- tracker.js
- calculator.js

**Success criteria:**
Players can log in, stats save, can create virtual tournaments

---

### PHASE 5: Polish (2-3 weeks)
**Goal:** Production-ready

**Deliverables:**
1. Tutorial system (interactive walkthrough)
2. Strategy lessons (guided practice)
3. Visual polish (smooth animations, effects)
4. Performance optimization
5. Mobile responsiveness
6. Bug fixes
7. Playtesting & balancing

**Success criteria:**
Game feels polished, runs smoothly, new players can learn easily

---

## INTEGRATION WITH BRDC PLATFORM

### Existing Systems to Leverage

**Player Profiles (already exist):**
- Authentication
- Player IDs
- Dashboard structure

**Tournament/League System (already built):**
- Bracket generation
- Scheduling
- Match tracking
- PayPal integration
- SMS notifications
- Director dashboard

**What needs to be added:**

**To Player Profiles:**
```javascript
{
  virtualDarts: {
    baseline: { /* throw signature */ },
    settings: { /* custom presets */ },
    stats: { /* virtual MPR, PPD, etc */ },
    history: [ /* match IDs */ ]
  }
}
```

**To Tournament Creator:**
```html
<select name="dartType">
  <option value="steel">Steel Tip</option>
  <option value="virtual">Virtual</option>
</select>
```

That's it! Everything else reuses existing infrastructure.

### Virtual Tournament Capabilities

**Async play:**
- 24-hour match windows
- Players throw whenever convenient
- Auto-advance if no-show

**Live tournaments:**
- Scheduled start time
- Real-time bracket progression
- Spectator mode in chatroom

**Hybrid:**
- Qualify virtually (top 8 advance)
- Finals in-person at bar

**Massive scale:**
- No board constraints
- Can handle 500+ player brackets
- Run multiple tournaments simultaneously

---

## STATS TRACKING

### Mirror Real Dart Stats

**501:**
- PPD (Points Per Dart)
- First 9 average
- Checkout %
- High ton
- Ton 80+ count
- 100+, 140+, 180 counts

**Cricket:**
- MPR (Marks Per Round)
- 3-mark, 6-mark, 9-mark rounds
- Bulls hit
- Close rate

**Both:**
- Doubles accuracy
- Trebles accuracy
- Match wins/losses

### Virtual-Specific Stats

- Deflection rate
- Grouping tightness
- Off-center accuracy
- Swipe consistency
- Clutch factor (pressure performance)
- Strategy adherence (% following suggestions)

### Separate Tracking

```
Profile displays:
Real Darts:     2.4 PPD | 2.8 MPR | 42% doubles
Virtual Darts:  3.1 PPD | 3.2 MPR | 68% doubles
```

Allows players to see improvement, compare skills

---

## PHYSICS CONSTANTS (Tunable)

These will need adjustment based on feel:

```javascript
// In config.js
const PHYSICS = {
  // Velocity
  MIN_VELOCITY: 5,      // Adjust if darts too slow
  MAX_VELOCITY: 20,     // Adjust if darts too fast
  
  // Swipe interpretation
  SPEED_MULTIPLIER: 0.5,     // How much speed affects velocity
  STRAIGHTNESS_PENALTY: 0.5,  // How much deviation matters
  
  // Vertical error scaling
  RELEASE_ERROR_SCALE: 120,   // Pixels of vertical error per release deviation
  
  // Launch angles
  MIN_ANGLE: 35,  // Late release angle
  MAX_ANGLE: 55,  // Early release angle
  
  // Difficulty forgiveness (tune after playtesting)
  EASY: { speedTolerance: 0.4, releaseTolerance: 0.5, straightnessTolerance: 20 },
  MEDIUM: { speedTolerance: 0.25, releaseTolerance: 0.3, straightnessTolerance: 10 },
  HARD: { speedTolerance: 0.15, releaseTolerance: 0.15, straightnessTolerance: 5 },
  PRO: { speedTolerance: 0.05, releaseTolerance: 0.05, straightnessTolerance: 2 }
};
```

**Tuning process:**
1. Build MVP
2. Have multiple people test
3. Collect feedback on "feel"
4. Adjust constants
5. Repeat

---

## COMPLETE CODE STARTER (Phase 1)

See companion file: `BRDC_Virtual_Darts_Code.md`

Contains:
- Full config.js
- Complete dartboard.js with rendering and scoring
- Full swipeDetector.js
- Complete physics.js with all calculations
- Full practiceMode.js
- Complete main.js game loop
- HTML structure
- CSS styling

---

## TESTING CHECKLIST

### Phase 1 Tests
- [ ] Dartboard renders correctly (segments, colors, wires, numbers)
- [ ] Swipe detection works on touch and mouse
- [ ] Speed calculation feels responsive
- [ ] Length affects vertical position (short=high, long=low)
- [ ] Straightness affects horizontal position
- [ ] Practice mode tracks 20 throws
- [ ] Grouping analysis calculates correctly
- [ ] Baseline profile saves properly
- [ ] Results screen displays stats
- [ ] Can start game mode after practice

### Phase 2 Tests
- [ ] Zoom in/out transitions smoothly
- [ ] Target selection is precise
- [ ] Auto-suggest calculates correct 501 outs
- [ ] Cricket logic follows proper strategy
- [ ] Tip levels show appropriate detail
- [ ] Settings page toggles work
- [ ] Custom presets save
- [ ] Wedge shots highlight correctly

### Phase 3 Tests
- [ ] Deflections occur when darts close together
- [ ] Robin Hood bounces feel realistic
- [ ] Oche position slider works
- [ ] Off-center throws require more power
- [ ] Angle affects landing point
- [ ] Difficulty levels feel different
- [ ] Sounds play at right times
- [ ] Animations are smooth

### Phase 4 Tests
- [ ] Login works with existing accounts
- [ ] Baseline saves to Firebase
- [ ] Settings sync across devices
- [ ] Stats calculate correctly
- [ ] Dashboard shows virtual tab
- [ ] Virtual tournaments create properly
- [ ] Matches log to database
- [ ] Leaderboards update

### Phase 5 Tests
- [ ] Tutorial guides new players
- [ ] No lag or stuttering
- [ ] Works on various screen sizes
- [ ] Battery usage acceptable
- [ ] No crashes or errors
- [ ] Playtester feedback positive

---

## DEPLOYMENT

### Hosting
Use existing Cloudflare Pages setup for BRDC

### File locations
```
/brdc-site/
  /virtual-darts/
    (all game files)
```

### URL structure
```
brdc.com/virtual-darts/          (game)
brdc.com/virtual-darts/settings  (settings page)
brdc.com/dashboard/virtual       (player stats)
```

### Firebase collections
```
/players/{playerId}/virtualDarts/
  baseline: { }
  settings: { }
  stats: { }
  
/virtualMatches/{matchId}/
  players: [ ]
  scores: [ ]
  winner: ""
  
/virtualTournaments/{tournamentId}/
  (reuse existing tournament structure)
```

---

## PROMPTS FOR CLAUDE CODE

### Initial Prompt (Phase 1)
```
Build Phase 1 of BRDC Virtual Darts game following the master plan.

Create:
1. Dartboard renderer with proper segments, scoring rings, wires
2. Swipe detector tracking speed, length, straightness
3. Physics engine converting swipe to dart trajectory
4. Practice mode for 20-throw calibration
5. Analysis system creating player baseline

Tech: HTML5 Canvas, vanilla JavaScript, no frameworks
Output: Working practice mode where swipes → darts land → baseline created

Start with file structure in /virtual-darts/, then build each component.
Tune physics constants so swipes feel natural.
```

### Phase 2 Prompt
```
Add aim and strategy systems to existing game.

Implement:
1. Two-step aim (tap area → zoom → select exact spot → zoom out centered)
2. Auto-suggest for 501 (checkout table + setup shots)
3. Auto-suggest for Cricket (score vs close logic)
4. Tip engine with 4 adjustable levels
5. Settings page with preset toggles

Use outshot tables from 170-2, implement wedge shot strategies.
Ensure suggestions explain WHY, not just WHAT.
```

### Phase 3 Prompt
```
Add advanced features.

Implement:
1. Deflection physics (detect dart-to-dart collisions)
2. Oche position slider (off-center throwing)
3. Difficulty calibration (tune forgiveness values)
4. Sound effects and animations

Deflections should feel realistic, off-center should require adjusted power.
Add tutorial mode explaining mechanics.
```

### Phase 4 Prompt
```
Integrate with Firebase and BRDC platform.

Connect to existing:
- Authentication system
- Player profiles
- Tournament creator

Add:
- Save/load baselines and settings
- Stats tracking (MPR, PPD, etc.)
- Virtual tournament mode
- Match logging
- Leaderboards

Ensure virtual and real dart stats stay separate but visible together.
```

### Phase 5 Prompt
```
Polish for production.

Add:
- Interactive tutorial system
- Strategy lessons
- Visual refinements
- Performance optimization
- Mobile responsiveness
- Bug fixes

Test on multiple devices, ensure smooth 60fps, no crashes.
Balance difficulty levels based on playtesting.
```

---

## SUCCESS METRICS

### Technical
- 60fps on mobile devices
- <3 second load time
- <5% crash rate
- Works on iOS and Android

### User Engagement
- 70%+ complete practice mode
- 3+ sessions per week average
- 20+ minutes average session
- 50%+ try virtual tournaments

### Educational
- 80%+ say they learned strategy
- 60%+ feel it helps real game
- 90%+ understand outs better after 5 sessions

### Business
- 30%+ of real players try virtual
- 20%+ virtual-only players join platform
- $5/player virtual tournaments profitable
- 10+ virtual tournaments per month

---

## SUPPORT & MAINTENANCE

### Common Issues

**"Darts don't land where I aim"**
→ Check if baseline calibrated
→ Verify difficulty level
→ Test straightness calculation

**"Physics feel wrong"**
→ Adjust PHYSICS constants in config.js
→ Test on different devices
→ Collect multiple user feedback

**"Auto-suggest gives bad advice"**
→ Check outshot tables
→ Verify Cricket logic
→ Review strategy rules

### Tuning Guide

**If darts consistently high:**
- Reduce RELEASE_ERROR_SCALE
- Adjust MAX_ANGLE downward

**If darts consistently low:**
- Increase RELEASE_ERROR_SCALE
- Adjust MIN_ANGLE upward

**If swipes don't register:**
- Lower minimum swipe length
- Increase touch area
- Check event listeners

**If difficulty too hard:**
- Increase tolerance values
- Add more forgiveness
- Smooth error curves

---

## FUTURE ENHANCEMENTS (Post-Launch)

### Advanced Features
- AI opponent (learns from player patterns)
- Multiplayer live matches
- Spectator mode with chat
- Replay system
- Custom game modes (Around the Clock, Shanghai, etc.)
- Team tournaments
- Leagues with seasons

### Analytics
- Heat maps of accuracy
- Performance trends over time
- Comparison to other players
- Strategy adherence tracking
- Improvement suggestions

### Social
- Friend challenges
- Global leaderboards
- Achievement badges
- Share replays
- Teaching mode (coach others)

### Monetization
- Premium features (advanced analytics)
- Custom themes/skins
- Private leagues
- Coaching tools for tournament organizers

---

## FINAL NOTES FOR CLAUDE CODE

**This is a TEACHING TOOL, not just a game.**

Every feature should have educational value. When in doubt, prioritize:
1. Accuracy to real dart physics
2. Clear explanations of strategy
3. Helping players improve

**Don't sacrifice realism for arcade fun.**

The whole point is training real dart skills. If something feels "too easy" or "too game-ified," it's probably wrong.

**Test with actual dart players.**

Get feedback from people who play steel tip. They'll tell you if the physics feel right.

**Iterate on the physics.**

The constants in config.js are starting points. You'll need to tune them based on how it feels. This is 50% of making it work well.

**Read the outshots.json and cricketRules.json carefully.**

These contain real strategic knowledge from experienced players. Don't invent new strategies - use the proven ones.

**When stuck, refer back to the core principles:**
- 3 variables: speed, length, straightness
- Length = release timing = vertical error
- Practice mode creates baseline
- Auto-suggest teaches strategy
- Stats track improvement

Good luck! Build something that makes dart players better. 🎯

---

**END OF MASTER PLAN**

Hand this document to Claude Code and let it build!