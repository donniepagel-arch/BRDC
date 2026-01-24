# BRDC VIRTUAL DARTS - MASTER PLAN v2

**Version:** 2.0
**Date:** January 21, 2026
**Project:** Burning River Darts LLC - Virtual Darts Training Game
**Original:** v1.0 - Core game mechanics and 5 development phases
**v2 Additions:** Engagement features for daily retention

---

## WHAT'S NEW IN v2

This document adds **engagement and retention features** to the original plan. The core game (Phases 1-5) remains unchanged. These additions address the key business question:

> "What brings people back regularly when there's no tangible product to offer?"

---

## PHASE 6: DAILY ENGAGEMENT FEATURES

### 6.1 Daily Challenge System

**Concept:** One new challenge every day at midnight. Complete it for rewards/streaks.

**Challenge Types:**
```javascript
const CHALLENGE_TYPES = [
    {
        type: 'checkout',
        examples: [
            'Checkout 121 in under 9 darts',
            'Hit a 100+ checkout',
            'Finish on Double 16 three times'
        ]
    },
    {
        type: 'accuracy',
        examples: [
            'Hit 5 bulls in 10 throws',
            'Land 3 consecutive treble 20s',
            'Hit every double from 20 down to 10'
        ]
    },
    {
        type: 'scoring',
        examples: [
            'Score 100+ on 5 consecutive turns',
            'Throw a 140+ round',
            'Average 60+ over 10 turns'
        ]
    },
    {
        type: 'cricket',
        examples: [
            'Close all numbers in under 15 rounds',
            'Hit a 7+ mark round',
            'Close 20s with your first 3 darts'
        ]
    }
];
```

**Daily Challenge Data Structure:**
```javascript
{
    date: '2026-01-21',
    challenge: {
        type: 'checkout',
        target: 'Checkout 87 in under 6 darts',
        parameters: {
            startingScore: 87,
            maxDarts: 6
        },
        difficulty: 'medium'
    },
    rewards: {
        completion: 10,      // Points for completing
        firstTry: 25,        // Bonus for first attempt success
        perfectScore: 50     // Bonus for exceptional performance
    }
}
```

**UI Location:** Prominent card on main menu, notification badge when incomplete

**Backend:** Cloud Function generates next day's challenge at midnight EST

---

### 6.2 Streak Tracking

**Concept:** Track consecutive days of practice. Visible everywhere. Hard to ignore.

**Streak Data:**
```javascript
{
    currentStreak: 7,
    longestStreak: 23,
    lastActiveDate: '2026-01-21',
    streakHistory: [
        { start: '2026-01-01', end: '2026-01-23', length: 23 },
        { start: '2026-01-25', end: null, length: 7 }  // Current
    ],
    milestones: [
        { days: 7, reached: true, reward: 'Bronze Streak Badge' },
        { days: 30, reached: false, reward: 'Silver Streak Badge' },
        { days: 100, reached: false, reward: 'Gold Streak Badge' }
    ]
}
```

**Streak Rules:**
- Any game/practice session counts as activity
- Streak breaks at midnight if no activity previous day
- "Streak Freeze" item (earned or purchased) can save one missed day

**Display:**
- Fire icon with number on main menu
- Streak count on player profile
- Warning notification if streak about to expire

---

### 6.3 Weekly Virtual Tournament

**Concept:** Same challenge for everyone, one week to post best score. Leaderboard.

**How It Works:**
1. Monday 12:00 AM: New weekly challenge posted
2. Players attempt challenge unlimited times during the week
3. Best score recorded (not most recent)
4. Sunday 11:59 PM: Challenge closes, winners announced
5. Monday: New challenge, cycle repeats

**Weekly Tournament Structure:**
```javascript
{
    weekOf: '2026-01-20',
    challenge: {
        type: '501_speed',
        description: 'Fastest 501 checkout',
        rules: 'Double out required. Fewest darts wins. Tiebreaker: highest 3DA',
        startingScore: 501
    },
    leaderboard: [
        { rank: 1, playerId: 'xxx', name: 'Nick M', darts: 15, avg: 87.2 },
        { rank: 2, playerId: 'yyy', name: 'Matt P', darts: 15, avg: 82.1 },
        // ...
    ],
    prizes: {
        first: 'Weekly Champion Badge + 100 points',
        top10: '50 points',
        participant: '10 points'
    },
    participants: 47
}
```

**Challenge Rotation:**
- Week 1: Fastest 501
- Week 2: Highest 3-turn score (9 darts)
- Week 3: Cricket MPR challenge
- Week 4: Checkout accuracy (random checkouts)
- Repeat with variations

---

## PHASE 7: SOCIAL & COMPETITIVE FEATURES

### 7.1 Challenge a Friend

**Concept:** Async head-to-head. Set a score, send to friend, they try to beat it.

**Flow:**
1. Player completes a game/drill
2. Option appears: "Challenge a Friend?"
3. Select friend from contacts or share link
4. Friend receives notification with the challenge
5. Friend attempts to beat the score
6. Both notified of result

**Challenge Data:**
```javascript
{
    id: 'challenge_abc123',
    type: 'beat_my_score',
    challenger: {
        id: 'player1',
        name: 'Matt Pagel',
        score: {
            game: '501',
            darts: 18,
            checkout: 94,
            threeDartAvg: 72.5
        }
    },
    challenged: {
        id: 'player2',
        name: 'Donnie Pagel',
        attempts: 3,
        bestScore: {
            darts: 21,
            checkout: 40,
            threeDartAvg: 65.2
        }
    },
    status: 'completed',  // pending, active, completed, expired
    winner: 'player1',
    createdAt: timestamp,
    expiresAt: timestamp  // 7 days
}
```

**Notification Examples:**
- "Matt just threw an 18-dart 501 with a 94 checkout. Think you can beat it?"
- "Donnie accepted your challenge!"
- "You won! Donnie couldn't beat your 18-dart game."

---

### 7.2 League Practice Mode

**Concept:** Practice against simulated opponents using real league stats.

**How It Works:**
1. Pull stats from actual BRDC league data
2. Simulate opponent throws based on their real averages
3. Player competes against "ghost" of real player

**Implementation:**
```javascript
function simulateOpponentThrow(playerStats) {
    // Use player's real 3DA to generate realistic scores
    const avg = playerStats.x01_three_dart_avg || 45;
    const variance = 15;  // Natural variation

    // Generate score around their average
    const score = Math.round(avg + (Math.random() - 0.5) * variance * 2);

    return Math.max(0, Math.min(180, score));
}
```

**UI:**
- "Practice vs League" button
- Shows upcoming opponents or select any league player
- Displays opponent's photo/name and key stats
- Real-time "ghost" throws during game

**Value:**
- Prepare for actual league matches
- See how you stack up against real players
- Motivation: "I need to improve to beat Kevin's 52 average"

---

### 7.3 Real-Time Multiplayer (Future)

**Concept:** Live head-to-head matches online.

**Implementation Options:**
1. **Firebase Realtime Database** - For live game state sync
2. **WebSocket server** - For lower latency
3. **Turn-based with timer** - Simpler, each player has 30 seconds

**Match Flow:**
```
1. Player creates match or joins queue
2. Matched with opponent of similar skill
3. Coin flip for who throws first
4. Alternate turns (3 darts each)
5. Real-time score updates
6. Winner determined, stats recorded
```

**Ranked System:**
- ELO-style rating for competitive matches
- Casual mode (no rating impact)
- Seasonal resets with rewards

---

## PHASE 8: PROGRESSION & REWARDS

### 8.1 Skill Badges

**Concept:** Achievements displayed on profile. Goals to work toward.

**Badge Categories:**

**Scoring Badges:**
| Badge | Requirement | Rarity |
|-------|-------------|--------|
| First 180 | Hit your first 180 | Common |
| Ton Machine | Hit 100 tons (100+) | Uncommon |
| Maximum! | Hit 10 lifetime 180s | Rare |
| Century Club | Hit 100 lifetime 180s | Epic |

**Checkout Badges:**
| Badge | Requirement | Rarity |
|-------|-------------|--------|
| Double Trouble | First checkout | Common |
| Ton Out | Checkout 100+ | Uncommon |
| Big Fish | Checkout 170 | Rare |
| Perfect Finish | Checkout on first dart 10 times | Epic |

**Consistency Badges:**
| Badge | Requirement | Rarity |
|-------|-------------|--------|
| Warming Up | Play 10 games | Common |
| Regular | Play 100 games | Uncommon |
| Dedicated | Play 500 games | Rare |
| Obsessed | Play 1000 games | Epic |

**Streak Badges:**
| Badge | Requirement | Rarity |
|-------|-------------|--------|
| Week Warrior | 7-day streak | Common |
| Month Master | 30-day streak | Rare |
| Century Streak | 100-day streak | Legendary |

**Cricket Badges:**
| Badge | Requirement | Rarity |
|-------|-------------|--------|
| Cricket Fan | Win first cricket game | Common |
| Mark Maker | Hit 1000 lifetime marks | Uncommon |
| Nine Darter | Hit a 9-mark round | Rare |
| MPR King | Achieve 4.0+ MPR in a game | Epic |

**Badge Display:**
- Featured badges on profile (player chooses 3)
- Full badge case in settings
- Progress bars for incomplete badges
- Notification when badge earned

---

### 8.2 Practice Drills

**Concept:** Structured exercises for targeted improvement.

**Drill Library:**

**Double Practice:**
```javascript
{
    name: 'Double Round the Clock',
    description: 'Hit every double from D20 down to D1',
    type: 'accuracy',
    target: 'doubles',
    rules: 'Hit each double once. Track attempts.',
    scoring: 'Fewest darts wins',
    leaderboard: true
}
```

**Checkout Trainer:**
```javascript
{
    name: 'Random Checkouts',
    description: 'Random checkouts under 100',
    type: 'checkout',
    parameters: {
        minScore: 40,
        maxScore: 100,
        count: 10
    },
    rules: 'Checkout each score. 9 darts max per checkout.',
    scoring: 'Checkouts completed / Total attempts'
}
```

**Scoring Drill:**
```javascript
{
    name: 'Power Scoring',
    description: '10 turns at T20, maximize score',
    type: 'scoring',
    turns: 10,
    target: { segment: 20, ring: 'treble' },
    rules: 'Aim for T20 every dart. Track total score.',
    benchmarks: {
        bronze: 400,
        silver: 500,
        gold: 600
    }
}
```

**Bull Practice:**
```javascript
{
    name: 'Bulls Eye Drill',
    description: 'Hit 10 bulls as fast as possible',
    type: 'accuracy',
    target: 'bull',
    goal: 10,
    scoring: 'Fewest darts to hit 10 bulls'
}
```

**Cricket Drill:**
```javascript
{
    name: 'Closing Time',
    description: 'Close all numbers solo, track rounds',
    type: 'cricket',
    rules: 'Standard cricket, no opponent. Minimize rounds.',
    benchmarks: {
        bronze: 25,  // rounds
        silver: 20,
        gold: 15
    }
}
```

---

### 8.3 Points & Rewards Economy

**Earning Points:**
| Activity | Points |
|----------|--------|
| Complete daily challenge | 10 |
| Daily challenge first try | +15 bonus |
| Maintain streak (per day) | 5 |
| Win weekly tournament | 100 |
| Top 10 weekly | 50 |
| Participate in weekly | 10 |
| Complete a drill | 5 |
| Earn a badge | 25-100 (by rarity) |
| Win friend challenge | 15 |

**Spending Points:**
| Item | Cost |
|------|------|
| Streak Freeze (save 1 day) | 50 |
| Custom dart skin | 100 |
| Profile frame | 150 |
| Board theme | 200 |
| Enter premium tournament | 100 |

**Note:** This is a soft economy for engagement, not monetization. Points are earned through play, not purchased.

---

## PHASE 9: NOTIFICATIONS & REMINDERS

### 9.1 Push Notification Strategy

**Daily Notifications:**
```javascript
const NOTIFICATION_TEMPLATES = {
    streak_reminder: {
        title: "Don't break your streak!",
        body: "You're on a {streak}-day streak. Throw a few darts to keep it alive!",
        timing: "6 PM if no activity that day"
    },
    daily_challenge: {
        title: "New Daily Challenge!",
        body: "Today's challenge: {challenge_description}",
        timing: "8 AM"
    },
    weekly_tournament: {
        title: "Weekly Tournament Ending Soon",
        body: "24 hours left! Your best: {rank} place. Can you climb higher?",
        timing: "Sunday 8 AM"
    },
    friend_challenge: {
        title: "{friend_name} challenged you!",
        body: "They threw a {score}. Think you can beat it?",
        timing: "Immediate"
    },
    league_reminder: {
        title: "League night tomorrow!",
        body: "Get some practice in before facing {opponent_team}",
        timing: "Day before league match"
    }
};
```

**Notification Settings:**
- User can toggle each notification type
- Quiet hours setting
- Frequency limits (max 2/day)

---

## IMPLEMENTATION PRIORITY

### Immediate Impact (Add to Phase 5):
1. **Daily Challenge** - Highest ROI for engagement
2. **Streak Tracking** - Simple to implement, powerful retention
3. **Skill Badges** - Gives goals, visible progress

### Medium Priority (Phase 6):
4. **Weekly Tournament** - Community building
5. **Challenge a Friend** - Viral/social loop
6. **Practice Drills** - Depth for serious players

### Future (Phase 7+):
7. **League Practice Mode** - Requires stats integration
8. **Points Economy** - After other systems exist
9. **Real-Time Multiplayer** - Complex, save for later

---

## DATABASE ADDITIONS

### New Collections:

```
/dailyChallenges/{date}/
    challenge: { type, description, parameters }
    leaderboard: [ { playerId, score, timestamp } ]

/weeklyTournaments/{weekId}/
    challenge: { }
    startDate, endDate
    entries: [ { playerId, bestScore, attempts } ]

/friendChallenges/{challengeId}/
    challenger, challenged, scores, status

/players/{playerId}/engagement/
    streak: { current, longest, lastActive }
    badges: [ { id, earnedAt } ]
    points: { balance, lifetime }
    dailyChallenges: { completed: [], streak: n }

/drills/{drillId}/
    definition: { }
    leaderboard: [ ]
```

---

## SUCCESS METRICS

### Daily Active Users (DAU)
- Target: 30% of registered users active daily
- Measure: Unique users completing any activity

### Retention
- Day 1: 60% (return day after signup)
- Day 7: 40% (return within first week)
- Day 30: 25% (monthly active)

### Engagement Depth
- Average session length: 8+ minutes
- Sessions per DAU: 1.5+
- Daily challenge completion rate: 50%+

### Social
- Friend challenges sent per week: 2+ per active user
- Weekly tournament participation: 40%+ of active users

---

## SUMMARY: THE ENGAGEMENT LOOP

```
┌─────────────────────────────────────────────────────────────┐
│                    DAILY ENGAGEMENT LOOP                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   MORNING                                                    │
│   └─> "New daily challenge!" notification                    │
│       └─> Open app, see streak counter                       │
│           └─> Complete daily challenge                       │
│               └─> Earn points, maintain streak               │
│                                                              │
│   DURING DAY                                                 │
│   └─> Friend sends challenge                                 │
│       └─> Competitive urge to beat their score               │
│           └─> Multiple attempts = more engagement            │
│                                                              │
│   EVENING                                                    │
│   └─> If no activity: "Don't break your streak!"             │
│       └─> Quick practice session                             │
│           └─> See badge progress                             │
│               └─> "Just 3 more checkouts for the badge..."   │
│                                                              │
│   WEEKLY                                                     │
│   └─> Tournament competition                                 │
│       └─> Check leaderboard standings                        │
│           └─> "I can beat #8 if I try again..."              │
│                                                              │
│   RESULT: Multiple reasons to open app EVERY DAY             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ORIGINAL PLAN REFERENCE

The core game mechanics (Phases 1-5) remain as documented in:
**BRDC_Virtual_Darts_Master_Plan.md (v1.0)**

This v2 document is an addendum focused on engagement and retention features that transform the game from a standalone experience into a daily habit.

---

**END OF v2 ADDITIONS**
