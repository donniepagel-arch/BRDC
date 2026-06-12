# Live Tournament Runbook

## Current Safe Path

Use this flow for a live test event right now:

1. Create the tournament from `/pages/create-tournament.html`.
2. Use the generic creator for normal singles, doubles, or multi-event tournaments.
3. Only use the mixed-doubles preset when the event actually needs partner draw / breakup behavior.
4. Open the director view from the success screen.
5. Register players from the public tournament page.
6. Confirm the tournament chat room exists in `/pages/messages.html`.
7. Generate the bracket.
8. Assign room links / board calls from the director dashboard.
9. Have players open the tournament page or bracket page and use the runtime panel to enter chat or launch their match.

## End-to-End QA Pass

Run this before using a live online tournament:

1. Create a fresh tournament with:
   - one singles event
   - location mode set correctly
   - runtime enabled
   - tournament chat enabled
   - player challenges enabled only if you intend to use them
   - room support enabled
   - player result reporting enabled
2. Register two real test players.
3. Confirm the tournament card count, tournament view count, and tournament bracket count all agree.
4. Open:
   - tournament view as guest
   - tournament view signed in as player 1
   - tournament view signed in as player 2
   - tournament bracket signed in as host
5. Check in both players.
6. Generate the bracket.
7. Ready up both sides from their own accounts.
8. Set a room from runtime.
9. Start the match from a player account.
10. Verify scorer opens with the correct players and return path.
11. If video/score assist is enabled:
   - open board phone
   - open thrower cam
   - confirm the runtime page mounts both feeds
   - confirm a score-assist candidate appears on the x01 scorer
12. Save at least one in-progress leg.
13. Submit a result from player 1.
14. Confirm the result from player 2.
15. Confirm bracket advancement and audit trail entries.

## Runtime Acceptance Criteria

- Tournament view is public-first and does not confuse guest users with host controls.
- Tournament bracket is bracket-first and keeps runtime separate from standings/players.
- Host runtime controls are collapsible, not mixed into the main player view.
- Player runtime always answers:
  - am I registered?
  - am I checked in?
  - who am I playing?
  - where is the room?
  - what is my next action?
- Completed tournaments default to results language, not registration language.
- Score assist on scorer is x01-only for now and must never auto-apply without user action.

## What Is Live Now

- Tournament creation
- Public registration
- Director bracket generation
- Tournament chat room creation
- Tournament runtime endpoint: `getTournamentPlayerRuntime`
- Runtime panels on:
  - `/pages/tournament-view.html`
  - `/pages/tournament-bracket.html`
- Player-facing actions from runtime:
  - current match status
  - room link
  - tournament chat link
  - scorer launch link
  - challenge panel access
  - x01 score-assist apply/fill controls inside the scorer

## Recommended Pilot

### Normal Singles Pilot

1. Create one singles event with 501 / cricket / choice settings.
2. Register 4 to 8 real players.
3. Confirm the tournament chat appears in messages.
4. Send one director announcement in the room.
5. Generate the bracket.
6. Assign one room link or board call.
7. Have two players open the bracket page and verify the runtime panel shows:
   - current match
   - room / board
   - chat link
   - scorer button
8. Run one real match end to end.

### Mixed Doubles Pilot

1. Create one mixed doubles event only if you actually need partner draw.
2. Use the mixed-doubles preset.
3. Confirm team draw, chat room visibility, and round calls before live use.

## What To Avoid

- Do not treat the mixed-doubles preset as the default tournament identity.
- Do not assume every older matchmaker page is the long-term generic UI.
- Do not launch a live bracket without first verifying the tournament chat room and one scorer launch.
- Do not rely on score assist for cricket yet. Current scorer-side apply flow is x01 only.

## Operator Checklist

- Confirm director account is authenticated before opening the director page.
- Confirm tournament chat is visible under tournament channels in `/pages/messages.html`.
- Confirm players can see the runtime panel on tournament view or bracket.
- Confirm bracket count matches registrations before calling matches.
- Confirm one test room link and one scorer launch before the first live round.

## Cleanup After Test

- Delete smoke tournaments if they were only system tests.
- Keep the tournament if it becomes the real event bracket.
