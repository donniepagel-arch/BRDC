# Wing It Wednesdays Blind Draw Runbook

First event: `wing-it-wednesdays-2026-05-27`

Public links:

- Tournament: https://brdc-v2.web.app/pages/tournament-view-vnext.html?tournament_id=wing-it-wednesdays-2026-05-27
- Registration: https://brdc-v2.web.app/pages/tournament-register-vnext.html?tournament_id=wing-it-wednesdays-2026-05-27
- Runtime: https://brdc-v2.web.app/pages/tournament-runtime-vnext.html?tournament_id=wing-it-wednesdays-2026-05-27

## Before Draw

Use the registration link for players who are not in playoffs. Public players can also register there.

The event is set as:

- Blind Draw Doubles
- Wednesday, May 27, 2026 at 7:00 PM Eastern
- Cork's Choice, best of 3
- Free in-app registration
- 64-player cap

## Generate Teams

Preview the draw without writing anything:

```powershell
node scripts\wing-it-blind-draw.js --seed "2026-05-27"
```

Save drawn doubles teams:

```powershell
node scripts\wing-it-blind-draw.js --seed "2026-05-27" --commit
```

Save teams and generate a single-elimination bracket:

```powershell
node scripts\wing-it-blind-draw.js --seed "2026-05-27" --commit --generate-bracket
```

If the player count is odd, add a house player:

```powershell
node scripts\wing-it-blind-draw.js --seed "2026-05-27" --house "House Player" --commit --generate-bracket
```

Use `--checked-in-only` if the registrations have been marked checked in before the draw.

Use `--force` only when intentionally overwriting an existing generated draw or bracket for this tournament.
