# Activity Feed Generation System

## Overview

The activity feed system generates engaging news feed items from completed match data. It extracts notable achievements, match results, and milestones to populate the dashboard feed.

## Components

### 1. Cloud Function: `generateLeagueFeed`
**Location:** `functions/generateLeagueFeed.js`

This cloud function scans completed matches and generates feed items:

- **Match Results** - Team vs team scores
- **180s** - Maximum scores
- **High Scores** - 140-179 point rounds
- **Big Checkouts** - 100+ checkouts
- **Bull Checkouts** - 161+ (requires hitting bull)
- **High Marks** - 6M, 7M, 8M, 9M cricket rounds
- **Bull Runs** - 3B, 5B achievements
- **Weekly Leaders** - Top 3DA and MPR per week
- **Milestones** - Player achievements (50 legs, 100 legs, first 180)

### 2. Generation Script: `generate-activity-feed.js`
**Location:** `scripts/generate-activity-feed.js`

Command-line script to trigger feed generation:

```bash
cd scripts
node generate-activity-feed.js
```

This calls the cloud function via HTTPS.

### 3. Dashboard Integration
**Location:** `public/pages/dashboard.html`

The dashboard loads and displays feed items with custom rendering for each type:

- Match results with team names and scores
- Notable throws with emojis and descriptions
- Weekly leader cards with crown icon
- Milestone cards with trophy icon

## Data Structure

Feed items are stored in: `leagues/{leagueId}/feed`

Each item has:
```javascript
{
    type: 'match_result' | 'maximum' | 'high_score' | 'ton_checkout' | 'big_checkout' | 'nine_mark' | 'high_marks' | 'bull_run' | 'weekly_leader' | 'milestone',
    created_at: Timestamp,
    match_id: string,
    week: number,
    player_name: string (for achievements),
    team_id: string,
    team_name: string,
    data: {
        // Type-specific data
    }
}
```

## How to Use

### Generate Feed for a League

1. Run the generation script:
   ```bash
   cd C:\Users\gcfrp\projects\brdc-firebase\scripts
   node generate-activity-feed.js
   ```

2. The script will:
   - Call the `generateLeagueFeed` cloud function
   - Process all completed matches
   - Extract notable events
   - Write to `leagues/{leagueId}/feed` collection

3. The dashboard will automatically load and display the feed items

### Add Feed Generation to Other Leagues

To generate feed for a different league, edit `generate-activity-feed.js`:

```javascript
const LEAGUE_ID = 'your-league-id-here';
```

Or create a parameterized version:

```bash
node generate-activity-feed.js {leagueId}
```

### Automatic Feed Updates

Currently feed generation is manual. To automate:

1. **Option A: Scheduled Function**
   - Create a Cloud Scheduler job
   - Trigger `generateLeagueFeed` nightly or weekly

2. **Option B: On Match Complete**
   - Add feed generation to `updateImportedMatchStats`
   - Regenerate feed when match data is imported

## Feed Item Types

### Match Results
```javascript
{
    type: 'match_result',
    data: {
        winner_team_name: 'M. Pagel',
        loser_team_name: 'D. Pagel',
        winner_score: 7,
        loser_score: 2,
        home_team_name: 'M. Pagel',
        away_team_name: 'D. Pagel',
        home_score: 7,
        away_score: 2
    }
}
```

### Notable Throws (180s, High Scores, Checkouts)
```javascript
{
    type: 'maximum' | 'high_score' | 'ton_checkout' | 'big_checkout',
    player_name: 'Christian K',
    data: {
        score: 180,
        checkout: 124,
        checkout_darts: 2,
        game_format: '501',
        opponent_team: 'D. Pagel'
    }
}
```

### Cricket Achievements (High Marks, Bulls)
```javascript
{
    type: 'nine_mark' | 'high_marks' | 'bull_run',
    player_name: 'Nick Mezlak',
    data: {
        marks: 9,
        notable: '3B',
        game_format: 'cricket'
    }
}
```

### Weekly Leaders
```javascript
{
    type: 'weekly_leader',
    week: 1,
    player_name: 'Matt Pagel',
    data: {
        stat_type: '3DA',
        value: '52.4'
    }
}
```

### Milestones
```javascript
{
    type: 'milestone',
    player_name: 'Jenn M',
    data: {
        milestone_type: 'legs_played' | 'first_180',
        value: 50
    }
}
```

## Troubleshooting

### Feed Not Showing in Dashboard
1. Check if feed items exist in Firestore: `leagues/{leagueId}/feed`
2. Verify the dashboard is loading from the correct league
3. Check browser console for errors

### No Feed Items Generated
1. Ensure matches have `status: 'completed'`
2. Verify match data includes `games` array with `legs` and `throws`
3. Check cloud function logs in Firebase Console

### Duplicate Feed Items
The script clears existing feed before generating new items, so duplicates shouldn't occur. If they do:
1. Manually delete items in Firestore
2. Re-run the generation script

## Future Enhancements

- **Real-time Updates**: Generate feed items as matches complete
- **Player-specific Feeds**: Filter by followed players or teams
- **Social Features**: Likes, comments, shares
- **Rich Media**: Photos, highlight videos
- **Notifications**: Push notifications for achievements
- **Achievement Badges**: Unlock badges for milestones

## Reference Data

- **League ID**: aOq4Y0ETxPZ66tM1uUtP (Winter Triple Draft)
- **Feed Collection**: `leagues/{leagueId}/feed`
- **Dashboard URL**: https://brdc-v2.web.app/pages/dashboard.html
