# Tournament Runtime Ops Runbook

## Host flow

1. Open `/pages/tournament-runtime.html?tournament_id=<id>`.
2. Confirm role is `host`, `staff`, or `admin`.
3. Verify hero counts:
   - registered
   - rooms
   - audit
4. Check `Operations Queue`:
   - pending check-ins
   - stale matches
   - disputes
5. Check `Room Directory`:
   - room label
   - room status
   - stream URL
   - archive URL / notes
6. Check `Runtime Audit` for recent actions.

## Match room flow

1. Use `Set Room`.
2. Confirm room label and room URL save.
3. If video is used, confirm stream URL opens.
4. After match completion, add:
   - archive / recording URL
   - archive notes
5. Mark room `archived`.
6. Confirm room directory shows archived metadata.

## Live player flow

1. Register both players.
2. Check both in.
3. Generate bracket.
4. Ready both sides.
5. Start match.
6. Open scorer from tournament runtime.
7. Save progress once mid-match.
8. Submit result.
9. Confirm or dispute from opponent side.
10. Resolve dispute from host side if needed.

## Score assist flow

### X01

1. Open board phone from tournament runtime video panel.
2. Send score candidate.
3. Confirm scorer shows:
   - candidate score
   - source/confidence
   - apply/fill/dismiss
   - scorer-side assist history

### Cricket

1. Open board phone with `game=cricket`.
2. Send a structured 3-dart turn.
3. Confirm cricket scorer shows:
   - dart string
   - source/confidence
   - apply turn / fill only / dismiss
   - scorer-side assist history

## Failure checks

- No unauthorized console errors on:
  - tournament view
  - tournament bracket
  - tournament runtime
- No room status mismatch between match and runtime room doc
- No missing archive metadata after archive update
- No stale match reminder action failing silently
