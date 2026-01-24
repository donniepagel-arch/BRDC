# Ideas Backlog

**Purpose:** Capture ideas, features, and tasks discussed but not yet implemented. Prevents ideas from being lost during conversation compaction.

---

## How to Use

When something is discussed but not acted on immediately, add it here with:
- Date discussed
- Brief description
- Context (why it came up)
- Priority (High/Medium/Low)

When an item is completed, move it to the "Completed" section at the bottom with the completion date.

---

## Pending Ideas

### [2026-01-22] - Dashboard Modularization (Refactoring)
Dashboard.html is 14K+ lines - assessment complete, refactoring pending
Context: Plan documented in `docs/work-tracking/DASHBOARD-REFACTOR-PLAN.md` - 16 JS modules, 15 CSS modules, ~96 hours estimated
Priority: Low

### [2026-01-22] - Virtual Darts Haptic Settings Toggle
Add UI toggle in settings to enable/disable haptic vibration feedback
Context: HapticManager has enable/disable capability but no UI to control it
Priority: Low

### [2026-01-22] - Virtual Darts Multiplayer/Online Play
Add ability to play against remote opponents
Context: Progression system now tracks single-player progress; multiplayer would be next step
Priority: Medium

---

## Completed

### [2026-01-22] - Virtual Darts Achievements System
Created achievements.js module with 10 starter achievements, localStorage persistence, animated unlock popups
Context: Key engagement mechanic missing from current implementation
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Brand Color Fix
Updated styles.css to match BRDC brand colors (--pink: #FF469A, --teal: #91D7EB, --yellow: #FDD835), added background gradient with glow effects
Context: Virtual Darts colors didn't match main site branding
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Swipe Quality Display
Added visual popup showing throw quality (EXCELLENT/GOOD/OK/POOR) after each throw with auto-fade
Context: physics.js calculated swipeQuality but never displayed it to users
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Cricket Scoreboard Fix
Fixed startCricket() to unhide scoreboard, fixed bull hit detection (segment 50 = 2 marks, segment 25 = 1 mark)
Context: Cricket scoreboard never shown, bulls not registering correctly
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Stats Persistence
Implemented localStorage persistence for game stats (games played, wins, best scores, 3-dart averages), display on results screen
Context: Phase 4 integration - no stat persistence between sessions
Completed: 2026-01-22

### [2026-01-22] - Chat Message Edit Server Validation
Added server-side 5-minute edit window validation in editChatMessage() function
Context: Edit window only enforced client-side, could be bypassed
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts AimSystem Completion
Fixed incomplete selectTarget() and zoomToArea() methods in aimSystem.js
Context: Methods were called but never defined, breaking tap-to-zoom targeting
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Haptic Feedback
Added navigator.vibrate() API for throw, hit, 180, checkout, bust patterns
Context: Competitor analysis showed haptic feedback improves mobile UX
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Mobile Swipe Tuning
Reduced MIN_SWIPE_LENGTH to 30, MIN_SWIPE_SPEED to 200, added jitter filtering
Context: Swipe thresholds were too strict for mobile devices
Completed: 2026-01-22

### [2026-01-22] - Dashboard Modularization Assessment
Created DASHBOARD-REFACTOR-PLAN.md with 16 proposed JS modules and refactoring order
Context: Dashboard.html is 14K+ lines, needed analysis before refactoring
Completed: 2026-01-22

### [2026-01-22] - Orphan Pages Linking
Added STREAM to nav-menu.js, linked stream-camera.html from stream-director.html
Context: stream-camera.html and stream-director.html had no navigation links
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Difficulty Unlock System
Progressive unlocking: Easy→Medium→Hard→Pro with 3 wins each, localStorage persistence
Context: Needed progression system to increase engagement
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Critical Bug Fixes
AutoSuggest has 5 undefined functions that need to be implemented: `isCheckout()`, `isBogeyNumber()`, `getCheckout()`, `parseTarget()`, `SETUP_TARGETS`
Context: Found during 6-agent virtual darts assessment
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Sound Effects
Add audio feedback for dart throws, hits, 180s, checkouts, busts
Context: Competitor analysis showed all successful dart games have sound
Completed: 2026-01-22

### [2026-01-22] - Virtual Darts Bob's 27 Practice Mode
Classic doubles training game - start at 27, hit doubles 1-20 + bull
Context: Most requested practice mode in competitor apps
Completed: 2026-01-22

### [2026-01-22] - Chat Typing Indicator Security
Fix Firestore rules to validate that player can only update their own typing status
Context: Found during QA testing - current rules allow spoofing
Completed: 2026-01-22

### [2026-01-22] - Presence TTL Cleanup
Implement scheduled function to clean up stale presence_heartbeats documents
Context: Currently no cleanup, documents accumulate forever
Completed: 2026-01-22

### [2026-01-22] - Chat Push Notifications
Deploy `onChatMessageCreated` Firestore trigger for FCM push notifications
Context: Trigger failed to deploy due to Eventarc permissions, needs retry
Completed: 2026-01-22
