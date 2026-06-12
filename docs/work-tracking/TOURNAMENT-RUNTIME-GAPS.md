# Tournament Runtime Gaps

**Date:** 2026-04-25  
**Status:** Active

## What is production-ready now

- Auth-based tournament creation
- Online / flexible / specific location modes
- Event configuration for tournament legs and cork rules
- Tournament runtime card on view + bracket pages
- Tournament-wide chat links
- Direct player challenge inbox links
- Player registration tied to signed-in accounts
- Bracket generation from registrations
- Player-launched scorer flow for assigned tournament matches
- In-progress save and final result submission by assigned players

## What is now live

### 1. Tournament-native ready-up flow

Live now:
- Ready / not ready state per assigned match
- Runtime action buttons on tournament view + bracket pages
- Match start is blocked until both sides ready up
- Ready state is stored on the match and shown back to players
- Host queue now surfaces stale ready-up / start delays
- Scheduled reminders now run for stale ready/in-progress matches

Still missing:
- Countdown timer on the player-facing runtime card

### 2. Tournament match room lifecycle

Live now:
- Runtime can surface room links
- Runtime now has a player/staff `Set Room` action
- Room label / URL changes persist to the match and subcollection mirror
- Match start auto-populates a default room label when online room support is enabled and no room label was set
- Runtime room entity docs are now created/updated per match
- Host runtime can close/archive rooms from tournament view + bracket pages
- Room state is shown back on runtime cards

Still missing:
- Dedicated director room assignment page beyond the runtime panel

### 3. Result confirmation / dispute workflow

Live now:
- Result submission writes review state onto the completed match
- Opponent can confirm the recorded result
- Opponent can dispute the recorded result
- Host/staff can resolve a disputed result
- Result review status is visible on runtime cards
- Host/staff runtime queue now lists disputed matches with a resolve action
- Runtime audit trail now logs result submission/review/dispute actions

Still missing:
- Dedicated dispute page beyond the runtime panel

### 4. Check-in operations UI

Live now:
- Player-facing check-in action on runtime cards
- Check-in state persists across registrations, tournament players, and tournament player map
- Runtime respects `require_check_in` and makes check-in the next action when needed
- Host/staff runtime queue now lists unchecked players and lets staff check them in directly
- Host/staff can now mark participants `hold` or `dropped` from the runtime panel

Still missing:
- Auto-drop policy configuration / unchecked countdown automation

### 5. Streaming / video / board camera

Live now:
- Tournament runtime can mount the board/thrower camera session for the active match
- Runtime exposes board-phone and thrower-camera links through the embedded video panel
- Match room updates can also carry a stream URL
- Host room operations can manage room lifecycle for video-enabled matches

Still missing:
- Dedicated director broadcast control page for tournament operators
- Actual recording/archive pipeline

### 6. Autoscoring integration

Live now:
- Tournament runtime can mount score-assist for the active match
- Board phone can send score candidates into the runtime session
- Score assist can be enabled or disabled per tournament
- Runtime now shows confidence/quality metadata when provided
- Runtime now supports approve/reject review of score-assist candidates
- Rejected/approved candidate reviews are logged in the streaming session
- X01 scorer now has in-context score-assist apply/fill controls for tournament matches
- Cricket scorer now accepts structured board-phone dart suggestions and can apply or fill those turns inline

Still missing:
- Scorer-native audit/apply history UI

### 7. Notifications

Live now:
- Ready-state updates notify match participants
- Room updates notify match participants
- Result submission notifies match participants
- Disputes / result-review updates notify match participants
- Host/staff can manually send runtime reminders for stale matches
- Scheduled stale-match reminders now run automatically

Still missing:
- Per-notification preference controls
- Dedicated notification console page beyond the runtime panel

## What is still missing

- Countdown timer on the player-facing runtime card
- Dedicated director room assignment page
- Dedicated dispute page
- Auto-drop policy configuration / unchecked countdown automation
- Dedicated director broadcast control page for tournament operators
- Actual recording/archive pipeline
- Scorer-side one-click apply flow for score assist
- Scorer-native audit/apply history UI for score assist
- Per-notification preference controls
- Dedicated notification console page

## UI rule going forward

Do not label generic BRDC challenge UI as if it were a tournament-native workflow.

Use:
- `Direct Challenges` for the generic inbox

Reserve:
- `Ready Up`
- `Match Invite`
- `Confirm Result`

for true tournament-specific flows once implemented.
