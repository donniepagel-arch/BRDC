# Terminal Prompts - Heartbreaker Completion + BRDC Mobile Audit
**Date:** 2026-01-22
**Terminals:** 8

---

## TERMINAL 1: Deploy Functions & Verify Exports

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Deploy Heartbreaker Backend Functions

Deploy all cloud functions and verify the Heartbreaker exports are working.

## Steps

1. Navigate to functions directory and check for errors:
   ```bash
   cd functions && npm run lint
   ```

2. Deploy all functions:
   ```bash
   firebase deploy --only functions
   ```

3. Verify these functions are exported (check index.js):
   - generateDoubleEliminationBracket
   - submitDoubleElimMatchResult
   - startDoubleElimMatch
   - triggerHeartbreaker
   - submitBreakupDecision
   - getHeartbrokenTeams
   - startMinglePeriod
   - endMinglePeriod
   - runCupidShuffle
   - getMingleStatus
   - sendNudge
   - getNudgeCount
   - getAvailableNudgeTargets
   - createHeartbreakerTournament

4. Test one function with curl to verify deployment:
   ```bash
   curl -X POST https://us-central1-brdc-v2.cloudfunctions.net/createHeartbreakerTournament \
     -H "Content-Type: application/json" \
     -d '{"tournament_name":"Test Heartbreaker","tournament_date":"2026-02-14","director_pin":"12345678"}'
   ```

5. If test succeeds, note the tournament_id returned

## When Done
Report results to: docs/work-tracking/HEARTBREAKER-DEPLOY-RESULTS.md

Include:
- Deploy success/failure
- Any lint errors fixed
- Test tournament ID if created
- List of all exported Heartbreaker functions
```

---

## TERMINAL 2: Create Player Mingle Page

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Create Player Mingle Experience Page

Create a new page for heartbroken players during the mingle period where they can:
- See their savage summary after losing
- Make anonymous breakup decision
- View and send nudges
- See mingle countdown

## File to Create
public/pages/matchmaker-mingle.html

## Design Requirements

### Page Flow
1. Player arrives after losing in Winners Bracket
2. 20-second delay with "Processing heartbreak..." animation
3. Savage summary revealed (stats about why they lost)
4. Breakup decision UI appears (anonymous - opt in or stay)
5. If opted in: Nudge system becomes available
6. Countdown timer shows time remaining in mingle period

### Savage Summary Section
- Show match stats that led to loss
- Playful/humorous tone ("Your partner missed 7 doubles...")
- Stats from triggerHeartbreaker response

### Breakup Decision UI
- Two big buttons: "Find New Partner" (pink) vs "Stay Together" (teal)
- Emphasize ANONYMITY - "Your choice is completely private"
- Can change decision until mingle ends
- Call submitBreakupDecision function

### Nudge System (only visible after opting for breakup)
- "Send a Nudge" section
- Show available targets (opposite gender, also opted in)
- Call getAvailableNudgeTargets for list
- Max 3 nudges indicator
- Call sendNudge when clicking a target
- Show "You've received X nudges" counter (getNudgeCount)

### Mingle Timer
- Big countdown in header
- Call getMingleStatus for time remaining
- Real-time updates via onSnapshot

## Reference Files
- public/pages/matchmaker-view.html (styling reference)
- public/pages/matchmaker-tv.html (countdown timer reference)
- functions/matchmaker.js (API reference for functions)

## API Endpoints to Use
- triggerHeartbreaker (already called, data passed via URL params)
- submitBreakupDecision(tournament_id, player_id, wants_breakup)
- getAvailableNudgeTargets(tournament_id, player_id)
- sendNudge(tournament_id, sender_id, target_id)
- getNudgeCount(tournament_id, player_id)
- getMingleStatus(tournament_id)

## When Done
- Deploy: firebase deploy --only hosting
- Report to: docs/work-tracking/HEARTBREAKER-MINGLE-PAGE.md
```

---

## TERMINAL 3: Update Director Dashboard - Cupid Shuffle

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Add Cupid Shuffle & Heartbroken Stats to Director Dashboard

Update matchmaker-director.html to add the Cupid Shuffle functionality and heartbroken team stats.

## File to Modify
public/pages/matchmaker-director.html

## Changes Required

### 1. Breakups Tab Updates
Add a "Heartbroken Teams" section showing:
- Count of teams that have lost in WC
- Count of players who opted for breakup (anonymous total only)
- Count of players staying with partner (anonymous total only)
- Call getHeartbrokenTeams and getMingleStatus for data

### 2. Add Cupid Shuffle Button
In the Breakups tab or TV Display tab, add:
- Big "Run Cupid Shuffle" button (pink gradient)
- Only enabled when mingle period is active
- Confirmation modal before running
- Call runCupidShuffle(tournament_id, director_pin)
- Show results: X new teams formed, Y players unmatched

### 3. Real-time Stats Updates
- Use onSnapshot to update heartbroken stats in real-time
- Show live count of breakup decisions as they come in

### 4. Mingle Controls Enhancement
Update the existing mingle period controls to:
- Show clearer status (active/inactive with timestamp)
- Show decision counts updating in real-time
- Add "Force End Mingle" button that calls endMinglePeriod

## API Endpoints
- getHeartbrokenTeams(tournament_id)
- getMingleStatus(tournament_id)
- runCupidShuffle(tournament_id, director_pin)
- startMinglePeriod(tournament_id, director_pin)
- endMinglePeriod(tournament_id, director_pin)

## When Done
- Deploy: firebase deploy --only hosting
- Report to: docs/work-tracking/HEARTBREAKER-DIRECTOR-UPDATE.md
```

---

## TERMINAL 4: Connect Bracket to Real Double-Elim Data

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Connect Bracket Page to Real Double-Elimination Data

Update matchmaker-bracket.html to display the actual bracket data from Firestore instead of stubbed/sample data.

## File to Modify
public/pages/matchmaker-bracket.html

## Current Problem
The bracket page currently generates a fake bracket structure. It needs to:
1. Load actual bracket data from tournaments/{id}/bracket/current
2. Show real Winners Bracket matches
3. Show real Losers Bracket matches
4. Show Grand Finals with bracket reset logic
5. Update in real-time as matches complete

## Data Structure Reference
The bracket document at tournaments/{id}/bracket/current contains:
```javascript
{
  winners_bracket: [
    { round: 1, matches: [...] },
    { round: 2, matches: [...] },
    // etc
  ],
  losers_bracket: [
    { round: 1, matches: [...] },
    // etc
  ],
  grand_finals: {
    match: {...},
    bracket_reset: {...} // if needed
  },
  mingle_active: boolean,
  mingle_started_at: timestamp,
  mingle_ended_at: timestamp
}
```

Each match contains:
- team1_id, team2_id
- team1_name, team2_name (denormalized)
- team1_score, team2_score
- status: 'pending', 'ready', 'in_progress', 'completed'
- winner: 'team1' or 'team2'
- bracket: 'winners' or 'losers'
- round, position

## Changes Required

1. Load bracket document on page load
2. Render Winners Bracket rounds (WC R1 -> WC R2 -> WC Finals)
3. Render Losers Bracket rounds (LC R1 -> LC R2 -> ... -> LC Finals)
4. Render Grand Finals section with potential bracket reset
5. Set up onSnapshot listener for real-time updates
6. Show mingle indicator when mingle_active is true
7. Highlight current/in-progress matches

## Visual Requirements
- Keep existing styling (it looks good)
- Add "LIVE" badge to in-progress matches
- Show mingle countdown if active
- Smooth transitions when bracket updates

## When Done
- Deploy: firebase deploy --only hosting
- Report to: docs/work-tracking/HEARTBREAKER-BRACKET-UPDATE.md
```

---

## TERMINAL 5: Add Mingle Status to Public View

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Add Mingle Period Status to Public Tournament View

Update matchmaker-view.html to show mingle period status and link to mingle page for heartbroken players.

## File to Modify
public/pages/matchmaker-view.html

## Changes Required

### 1. Mingle Period Banner
When mingle is active, show a prominent banner:
- Red/pink gradient background
- "MINGLE PERIOD ACTIVE" text
- Countdown timer
- "Heartbroken? Tap here" link to matchmaker-mingle.html

### 2. Tournament Status Updates
Show current tournament phase:
- "Registration Open" (status: registration)
- "Partner Draw Complete" (status: bracket_pending)
- "Tournament In Progress" (status: in_progress)
- "Mingle Period Active" (mingle_active: true)
- "Tournament Complete" (status: completed)

### 3. Heartbroken Teams Section
If mingle is active, show section listing heartbroken teams:
- Team names only (no breakup decisions visible)
- "These teams lost in Winners Bracket"
- Encourages watching to see who gets new partners

### 4. Real-time Updates
- onSnapshot on tournament document
- Update status, mingle countdown in real-time

## API to Use
- getMingleStatus(tournament_id) - or just read from tournament doc directly

## When Done
- Deploy: firebase deploy --only hosting
- Report to: docs/work-tracking/HEARTBREAKER-VIEW-UPDATE.md
```

---

## TERMINAL 6: Heartbreaker Integration Test

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Create Heartbreaker Integration Test Script

Create a test script that exercises the full Heartbreaker flow via API calls.

## File to Create
scripts/test-heartbreaker-flow.js

## Test Flow

1. Create a test Heartbreaker tournament
   - Call createHeartbreakerTournament
   - Save tournament_id and director_pin

2. Register test teams
   - 2 pre-formed couples
   - 4 male singles
   - 4 female singles (balanced)

3. Run partner draw
   - Call matchmakerDrawPartners
   - Verify 4 new teams created (total 6 teams)

4. Generate bracket
   - Call generateDoubleEliminationBracket
   - Verify bracket structure

5. Simulate WC Round 1 results
   - Submit 3 match results (3 winners, 3 losers)
   - Call submitDoubleElimMatchResult for each

6. Trigger heartbreaker for losers
   - Call triggerHeartbreaker for each losing team
   - Verify savage summaries generated

7. Start mingle period
   - Call startMinglePeriod
   - Verify mingle_active is true

8. Submit breakup decisions
   - Some players opt in, some opt out
   - Call submitBreakupDecision

9. Test nudge system
   - Call getAvailableNudgeTargets
   - Call sendNudge
   - Call getNudgeCount

10. Run Cupid Shuffle
    - Call runCupidShuffle
    - Verify new teams created

11. Continue tournament to completion
    - Submit remaining match results
    - Verify champion crowned

## Output
- Console log each step with pass/fail
- Summary at end with any failures
- Save test tournament ID for manual inspection

## When Done
- Run test: node scripts/test-heartbreaker-flow.js
- Report to: docs/work-tracking/HEARTBREAKER-TEST-RESULTS.md
```

---

## TERMINAL 7: BRDC Mobile Audit - Page Responsiveness

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Audit BRDC Site Mobile Responsiveness

Audit all public pages for mobile responsiveness issues.

## Pages to Audit
Check each page at 375px width (iPhone SE) and 414px (iPhone Plus):

1. public/index.html
2. public/pages/dashboard.html
3. public/pages/league-view.html
4. public/pages/match-hub.html
5. public/pages/player-profile.html
6. public/pages/team-profile.html
7. public/pages/browse-events.html
8. public/pages/chat-room.html
9. public/pages/live-match.html
10. public/pages/messages.html
11. public/pages/matchmaker-*.html (all 5)
12. public/scorers/x01.html
13. public/scorers/cricket.html

## Check For

### Layout Issues
- Horizontal scroll (content wider than viewport)
- Text overflow/truncation
- Buttons too small to tap (min 44px)
- Elements overlapping
- Fixed elements covering content

### Usability Issues
- Input fields too small
- Dropdowns hard to use
- Modals not fitting screen
- Navigation menu issues
- Tab bars not accessible

### Specific Problem Patterns
- Tables not responsive
- Grids not collapsing properly
- Font sizes too small (<14px body)
- Images not scaling
- Flexbox/grid gaps too large

## For Each Issue Found
Document:
- Page URL
- Element/selector affected
- Screenshot description or line number
- Suggested fix

## When Done
- Report to: docs/work-tracking/MOBILE-RESPONSIVE-AUDIT.md
- Prioritize issues: Critical / High / Medium / Low
```

---

## TERMINAL 8: BRDC Mobile Audit - Functional Testing

```
Working directory: C:\Users\gcfrp\brdc-firebase

Permissions: Read all, Write all, Bash (npm, node, git, firebase)

Model: Sonnet

---

## Task: Audit BRDC Site Mobile Functionality

Test critical user flows on mobile viewport sizes.

## Test Flows

### 1. Login Flow
- Navigate to dashboard.html
- Enter PIN on mobile keyboard
- Verify login works
- Check session persistence

### 2. League Navigation
- View league schedule
- Tap on a match card
- Navigate to match-hub
- Check all tabs load

### 3. Scorer Flow
- Open x01.html scorer
- Test number pad on mobile
- Test all buttons are tappable
- Verify scores submit correctly

### 4. Chat Flow
- Open chat-room.html
- Send a message
- Check emoji picker
- Test @mentions

### 5. Matchmaker Flow
- Register for tournament
- View bracket
- Check TV display modes

### 6. PWA Installation
- Check manifest.json is valid
- Verify service worker loads
- Test offline behavior
- Check add-to-homescreen prompt

## Check For

### Touch Issues
- Touch targets too small
- Double-tap zoom triggering
- Scroll hijacking
- Swipe gestures not working

### Keyboard Issues
- Virtual keyboard covering inputs
- Form not scrolling to focused input
- Keyboard type wrong (numeric vs text)

### Performance Issues
- Slow initial load
- Janky scrolling
- Large images not optimized
- Too many network requests

### JavaScript Errors
- Console errors on mobile
- Features not working
- Event handlers failing

## For Each Issue
Document:
- Flow/step where issue occurs
- Expected vs actual behavior
- Browser/device context
- Suggested fix

## When Done
- Report to: docs/work-tracking/MOBILE-FUNCTIONAL-AUDIT.md
- Prioritize: Critical (blocking) / High / Medium / Low
```

---

## Quick Reference

| Terminal | Task | Model |
|----------|------|-------|
| 1 | Deploy Functions | Sonnet |
| 2 | Create Mingle Page | Sonnet |
| 3 | Update Director Dashboard | Sonnet |
| 4 | Connect Bracket to Data | Sonnet |
| 5 | Add Mingle to Public View | Sonnet |
| 6 | Integration Test Script | Sonnet |
| 7 | Mobile Responsive Audit | Sonnet |
| 8 | Mobile Functional Audit | Sonnet |

All prompts include full permissions to avoid approval prompts.
