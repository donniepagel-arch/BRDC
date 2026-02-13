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

### [2026-02-11] - Match-Hub Remaining Tabs (Performance, Award Counts, Leaderboard)
Game Details tab is complete with: box score header, baseball line score (legs per set), set cards with combined averages, expandable throw detail with darts-used badges, green/red stat comparisons, winner/loser dimming throughout. Next: build out the Performance, Award Counts, and Leaderboard tabs using the DartConnect reference data in `temp/dc/`.
Context: Match-hub page redesign — Game Details tab finished this session
Priority: High

### [2026-02-08] - D. Partlo vs N. Kull Week 4 Missing Set 9
Match `pNJ5wKPIrHPQqXQv5Nhl` only has 8/9 sets. The RTF file (`temp/trips league/week 4/partlo v kull.rtf`) doesn't contain Set 9 (P3 Singles 501). Need to check with league director if the set was played but not recorded, or if the match ended early.
Context: Discovered during Week 4 import
Priority: Low (match score is correct at 5-3, just missing the data for 1 set)

### [2026-01-22] - Virtual Darts Multiplayer/Online Play
Add ability to play against remote opponents
Context: Progression system now tracks single-player progress; multiplayer would be next step
Priority: Medium

---

## Completed

### [2026-02-10] - SendGrid Email Integration
Installed `@sendgrid/mail`, configured API key and `FROM_EMAIL=noreply@burningriverdarts.com` in functions/.env. Domain authenticated via Cloudflare DNS (DKIM + return path). Fixed TODO in phase-5-6-7.js `sendEmail` function. Updated fallback FROM_EMAIL in all 4 notification files from `brdc-darts.com` to `burningriverdarts.com`. All email functions now send real emails (were previously simulated).
Context: SendGrid was deferred earlier due to no account; user set up account and DNS
Completed: 2026-02-10

### [2026-02-10] - Fix All Code TODOs + Wire SMS + Friends Integration
12 fixes across 9 files: VAPID key cleanup, scorer stat calculations (topPPD/topMPR), registration count query, bracket cutoff enforcement, 5 SMS notifications wired (team registration, free agent, team invite, board assignment, match reschedule), friends feed filter, posts friends-only visibility check.
Context: Codebase audit found 18 TODO comments, 12 were actionable
Completed: 2026-02-10

### [2026-02-10] - Dashboard Modularization
Extracted 3,681-line dashboard.html into 5 JS modules + 3 CSS modules. File reduced to 211 lines (94% reduction). Modules: dashboard-state.js, dashboard-utils.js, dashboard-auth.js, dashboard-feed.js, dashboard-schedule.js, dashboard-base.css, dashboard-feed.css, dashboard-schedule.css. Native ES6 imports, no build system needed.
Context: Original plan was 16 JS + 15 CSS modules (~96 hours). Actual: 5 JS + 3 CSS modules, completed in one session.
Completed: 2026-02-10

### [2026-02-10] - Upgrade Firebase Functions SDK to 5.1.1
Upgraded from firebase-functions 4.9.0 to 5.1.1. Attempted v7.0.5 first but it broke pubsub.schedule (tried to force 2nd-gen upgrade). v5.1.1 maintains v1 API compatibility.
Context: Deployment warnings about deprecated SDK version
Completed: 2026-02-10

### [2026-02-10] - Upgrade Node.js Runtime to 22
Upgraded Cloud Functions runtime from Node.js 20 to Node.js 22 in functions/package.json.
Context: Node.js 20 deprecated 2026-04-30
Completed: 2026-02-10

### [2026-02-10] - Virtual Darts Haptic Settings Toggle
Added UI toggle in virtual darts settings to enable/disable haptic vibration feedback.
Context: HapticManager had enable/disable capability but no UI control
Completed: 2026-02-10

### [2026-02-10] - Notable/Checkout Flags Import Pipeline
Added notable event detection (180s, tons, checkouts) and checkout flags to the import pipeline for throw-level data.
Context: Feed cloud function was detecting from raw values; match-hub needed flags on throws directly
Completed: 2026-02-10

### [2026-02-10] - Individual Notable Event Feed Items
Added individual feed items for standout moments: 180s, big checkouts (161+), 9M cricket rounds. Separate from weekly highlight compilations.
Context: Makes feed more dynamic and social with real-time notable events
Completed: 2026-02-10

### [2026-02-09] - Migrate from functions.config() to process.env
All 3 remaining `functions.config()` calls in `phase-5-6-7.js` (Twilio SMS in `registerFillin`) migrated to `process.env.TWILIO_*`. The `.env` file already had all credentials. 7 of 8 files were already using `process.env`.
Context: functions.config() and Cloud Runtime Config deprecated, shuts down March 2026
Completed: 2026-02-09

### [2026-02-08] - Dashboard Weekly Highlights Feed
New `week_highlights` feed item type showing best 3DA, best MPR, 180s, 140+ tons, big checkouts, high cricket marks, closest/biggest match per week. Cloud function detects from raw throw scores. Dashboard renderer with styled card.
Context: User wanted newsfeed updated with highlights from imported weeks
Completed: 2026-02-08

### [2026-02-08] - Week 4 Match Imports
Imported Neon Nightmares vs D. Russano (9-0 sweep, full 9 sets). Reimported D. Partlo vs N. Kull (8/9 sets from RTF). Stats recalculated for all 36 players.
Context: User provided Week 4 RTF files
Completed: 2026-02-08

### [2026-02-08] - Fill-In Player Auto-Detection
league-view.html and match-hub.html now auto-detect fill-in players by comparing who played (from games array) vs team roster, when explicit lineup arrays don't exist. Shows SUB/OUT badges.
Context: Fill-in players weren't showing in match reports despite being in game data
Completed: 2026-02-08

### [2026-02-08] - Christian Ketchum Name Canonicalization
Added CANONICAL_NAMES map to import script to normalize all name variants (Ketchem→Ketchum, etc.). Applied at 3 points in import pipeline. Fixed team_id. Re-imported affected matches.
Context: RTF had "Christian Ketchem" typo, player was invisible in match data
Completed: 2026-02-08

### [2026-02-08] - Cricket Stats Leg-Level Format Fix
Changed `recalculateAllLeagueStats` to detect format at leg level (`leg.format || game.format`) instead of game level. Fixes cricket legs in mixed-format/Corks Choice sets being counted as X01.
Context: All 36 players had cricket stat mismatches due to misclassification
Completed: 2026-02-08

### [2026-02-08] - Bracket Seeding Control
Director can now set custom seed order for tournament brackets. Seeding list with up/down arrows below Round 1 preview. Backend `regenerateBracket` accepts optional `seed_order` array. Two buttons: APPLY SEED ORDER and SHUFFLE RANDOM.
Context: Director needed control over bracket matchups, not just random shuffle
Completed: 2026-02-08

### [2026-02-08] - Bulk Remove Registrations (Director)
Added REMOVE SELECTED button to matchmaker director check-in page. Modified `deleteMatchmakerRegistration` to accept `director_pin` for auth (was player_id only). Confirmation dialog + progress tracking.
Context: Director needed to bulk-delete registrations, not just check them in
Completed: 2026-02-08

### [2026-02-08] - 8-Digit PIN Validation Fix
Fixed PIN validation on tournament-view.html (was 5), stat-verification.html (was 5), matchmaker-register.html (was 4). All now enforce 8-digit PINs consistently.
Context: Multiple pages had leftover validation from older PIN lengths
Completed: 2026-02-08

### [2026-02-08] - Matchmaker Tournament Registration Redirect
tournament-view.html REGISTER NOW button now redirects to matchmaker-register.html when `matchmaker_enabled: true`. Previously opened a generic modal requiring event selection that silently failed for matchmaker tournaments.
Context: Registration appeared to work (PIN lookup succeeded) but never actually registered
Completed: 2026-02-08

### [2026-02-08] - Bye Week Cards in League Schedule
Teams with no match in a week now show a bye card with roster and stats in league-view.html schedule tab.
Context: User wanted visibility into which teams have bye weeks
Completed: 2026-02-08

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
