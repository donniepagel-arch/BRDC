# Match Hub Write Audit

This audit classifies the live [match-hub.html](E:\projects\brdc-firebase\public\pages\match-hub.html) path relative to the canonical BRDC match write model.

## Conclusion

`match-hub` is not an independent score/stat write surface.

It is:

- a read/report surface for scheduled and completed matches
- an attendance write surface
- a scorer launcher

It is not:

- a separate stat calculation pipeline
- a separate import pipeline
- a direct match-score editing surface

## Direct Writes In Match Hub

The only direct Firestore write in the page is attendance:

- [match-hub.html](E:\projects\brdc-firebase\public\pages\match-hub.html) updates:
  - `leagues/{leagueId}/matches/{matchId}.attendance.{playerId}`

That write does not mutate:

- throws
- legs
- games
- standings
- player stats

So attendance is a separate match metadata write, not a scoring write.

## How Match Hub Launches Scoring

For actual gameplay, `match-hub` builds scorer URLs and sends users into:

- [x01-scorer.html](E:\projects\brdc-firebase\public\pages\x01-scorer.html)
- [league-cricket.html](E:\projects\brdc-firebase\public\pages\league-cricket.html)

Those scorer pages then write through:

- `submitGameResult`

The scorer pages carry:

- `league_id`
- `match_id`
- `game_index`
- `game_number`
- `from_match=true`

So the live score/stat writes still pass through the canonical backend function path.

## The Architectural Shortcut

The shortcut is this:

- `match-hub` launches scorers without first calling `startMatch`
- `submitGameResult` compensates by auto-expanding `match.games` when needed

That behavior is explicitly acknowledged in:

- [functions\leagues\index.js](E:\projects\brdc-firebase\functions\leagues\index.js)

This means `match-hub` is a launcher exception, not a bypass of canonical stat storage.

## Risk Assessment

### Safe Enough Today

- scorer writes still go through the normalized backend path
- throw ownership normalization still happens
- stat writes still come from canonical scorer submission

### Remaining Risk

- match initialization is less explicit than the canonical `startMatch` / `startGame` path
- that makes the system harder to reason about and leaves one implicit setup behavior in production

## Classification

Treat `match-hub` as:

- authoritative for attendance metadata
- non-authoritative for scoring itself
- a launcher into the canonical scorer flow

Do not treat it as a separate write architecture.

## Recommended Next Step

Do not rush a rewrite of `match-hub`.

Instead:

1. keep scorer writes on the canonical backend path
2. document `match-hub` as a launcher exception
3. later, if desired, add a cleaner explicit match-initialization handshake before scorer launch

That is a cleanup improvement, not an urgent data-integrity fix.
