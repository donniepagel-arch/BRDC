# Triples Draft Data Integrity Audit

Date: 2026-04-09
League: `aOq4Y0ETxPZ66tM1uUtP`

## Scope

Audit the live Triples Draft league for:

- raw match data presence
- stored team standings integrity
- cached player stats integrity
- recent scorer test contamination

## Result

The league still has recoverable raw match history.

The drift is in the derived layers:

- team standings on team docs are stale
- player stats are inconsistent with completed-match history
- imported match participant names still create reconciliation problems against player IDs

## What Was Verified

### 1. Raw match structure exists

Sample completed match:

- match id: `sgmoL4GyVUYP67aOS7wm`
- `M. Pagel` vs `D. Pagel`
- status: `completed`
- score: `7-2`
- games array length: `9`
- all 9 games had valid leg counts

This is the most important safety signal: completed matches still contain structured game/leg history.

### 2. Recent scorer test data was isolated and removed

Week 12 test record:

- match id: `Df4yDGlbbLJh6lkPi8BV`
- `D. Partlo` vs `D. Pagel`

It had partial in-progress scorer state with no leg or throw detail.

It was reset back to:

- status: `scheduled`
- score: `0-0`
- games: `0`

So the recent test contamination is no longer present in the live league record.

## Team Standings Finding

Stored team records do not match the completed match history.

Examples:

- `D. Russano`
  - stored: `5-1`
  - calculated from completed matches: `9-1`

- `K. Yasenchak`
  - stored: `5-1`
  - calculated: `8-2`

- `E. O`
  - stored: `5-1`
  - calculated: `7-2`

- `D. Pagel`
  - stored: `2-4`
  - calculated: `4-5`

- `N. Kull`
  - stored: `0-6`
  - calculated: `2-8`

Interpretation:

- standings stored on team docs are behind the actual completed match set
- the stored `points_for` / `points_against` fields are also effectively empty while match history contains real scores

This strongly suggests standings are the first repair target.

## Player Stats Finding

Cached player stats are not cleanly aligned with completed match history.

Signals:

- all 47 stats docs showed mismatches against counts derived from completed matches
- game counts and wins often matched or were close
- leg counts were frequently far off
- several player names in completed matches did not cleanly map to the current roster naming

Unmatched imported participant names found in completed matches:

- `Nicholas Mezlak`
- `Matthew Pagel`
- `Eddie O`
- `Mike Jarvis`
- `Matty Wentz`
- `Eric D`
- `Jenn Malek`
- `Kevin Y`
- `Brian S`
- `Cesar A`
- `Steph Kull`

Interpretation:

- the stats cache is still suffering from the legacy name-vs-ID problem
- some stats documents may also reflect earlier recalculation quirks or merged totals
- stats are fixable, but not trustworthy as the current source of truth

## Safety Conclusion

For this league:

- raw completed match history is present
- the recent scorer test data is removed
- team standings are stale
- player stats are not cleanly reliable

That means the repair order should be:

1. rebuild or repair standings from completed matches
2. then fix player stats using a controlled ID-based rebuild path
3. only after that consider broader runtime/config cleanup

## Recommended Next Task

Standings repair plan for Triples Draft.

That plan should:

1. define the canonical standing fields
2. recompute them from completed matches only
3. update team docs in one controlled pass
4. verify the live league page after the rebuild
