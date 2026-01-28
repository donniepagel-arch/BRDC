# News Feed Generation System

**Date:** 2026-01-27
**Status:** ✅ Implemented and Deployed

## Overview

Created an automated news feed generation system that scans league match data and generates interesting activity feed items for the dashboard.

## Components Created

### 1. Cloud Function: `generateLeagueFeed`
**File:** `functions/generateLeagueFeed.js`
**Purpose:** Analyzes match data and creates feed items in Firestore

**Features:**
- Scans all completed matches in a league
- Detects notable events:
  - Match results
  - 180 maximums
  - High scores (140+)
  - Ton checkouts (100+)
  - Big checkouts (161+)
  - 9-mark maximums
  - High marks (6+)
  - Bull runs
  - Weekly leaders (3DA and MPR)
  - Player milestones (50/100 legs, first 180)

### 2. Script: `generate-feed.js`
**File:** `scripts/generate-feed.js`
**Purpose:** Command-line tool to trigger feed generation

**Usage:**
```bash
cd scripts
node generate-feed.js [league_id]
```

**Default League:** `aOq4Y0ETxPZ66tM1uUtP` (Winter Triple Draft)

### 3. Dashboard Integration
**File:** `public/pages/dashboard.html`
**Updated Functions:**
- `loadFeed()` - Now reads from `leagues/{leagueId}/feed` collection
- `renderFeedCard()` - Routes to type-specific renderers
- `renderMatchResultFeedCard()` - Displays match results
- `renderNotableThrowCard()` - Shows 180s, checkouts, high marks, etc.
- `renderWeeklyLeaderCard()` - Displays weekly leaders
- `renderMilestoneCard()` - Shows player milestones

## Data Structure

Feed items are stored in:
```
leagues/{leagueId}/feed/{feedItemId}
```

**Feed Item Schema:**
```javascript
{
  type: 'match_result' | 'maximum' | 'high_score' | 'ton_checkout' | 'big_checkout' |
        'nine_mark' | 'high_marks' | 'bull_run' | 'weekly_leader' | 'milestone',
  created_at: Timestamp,
  match_id: string,
  week: number,
  player_name: string,  // For player-specific events
  team_id: string,
  team_name: string,
  data: {
    // Type-specific data
  }
}
```

## Event Types

### Match Results
- Winner team, loser team
- Scores (sets won)
- Week number

### Notable Throws
- **Maximum (180):** 💯 180 Maximum!
- **High Score (140-179):** 🔥 [score] Points!
- **Ton Checkout (100-139):** 🎯 [score] Checkout
- **Big Checkout (161+):** ⭐ BIG [score] Checkout!
- **Nine Mark:** 🔥 9-Mark Maximum!
- **High Marks (6-8):** 🎯 [marks] Marks!
- **Bull Run:** 🐂 Bull Run! (3B, 5B)

### Weekly Leaders
- 👑 Top 3DA for the week
- 👑 Top MPR for the week

### Milestones
- 🏆 50 legs played
- 🏆 100 legs played
- 🏆 First 180

## Feed Generation Stats

**Winter Triple Draft League:**
- 106 feed items generated
- Includes all matches through Week 2
- All notable events from imported match data

## Future Enhancements

1. **Real-time updates:** Trigger feed generation automatically when matches complete
2. **Upset detection:** Flag when lower-ranked teams beat higher-ranked teams
3. **Hat tricks:** Track 3+ tons in a single set
4. **Streaks:** Track winning/losing streaks
5. **Personal feed:** Filter feed to show only user's team or friends
6. **Social features:** Allow likes/comments on feed items
7. **Push notifications:** Notify players of notable events

## Deployment

**Cloud Function:**
```bash
firebase deploy --only functions:generateLeagueFeed
```

**Frontend:**
```bash
firebase deploy --only hosting
```

**Generate Feed:**
```bash
cd scripts
node generate-feed.js
```

## Testing

1. Log in to dashboard at https://brdc-v2.web.app
2. View the News Feed tab
3. Feed should show:
   - Match results from recent weeks
   - Notable throws (180s, checkouts, etc.)
   - Weekly leaders
   - Milestones

## Notes

- Feed items are sorted by `created_at` (newest first)
- Limit of 500 items per league (Firestore batch limit)
- Feed is cleared and regenerated each time (not incremental)
- For production, should implement incremental updates
