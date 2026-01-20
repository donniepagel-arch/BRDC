# Firestore Data Structure

**Last Updated:** 2026-01-18

---

## Collection Hierarchy

```
firestore/
├── players/{playerId}                    # Global player registry
├── leagues/{leagueId}                    # League management
│   ├── /players/{playerId}               # League participants
│   ├── /teams/{teamId}                   # Team rosters
│   │   └── /roster_changes/{changeId}    # Roster change history
│   ├── /matches/{matchId}                # Weekly matches
│   │   ├── /substitution_log/{logId}     # Sub records
│   │   └── /issues/{issueId}             # Match disputes
│   ├── /stats/{playerId}                 # Player season stats (cached)
│   ├── /registrations/{regId}            # Registration records
│   ├── /fillin_requests/{requestId}      # Fill-in requests
│   └── /fillins/{fillinId}               # Available fill-ins
├── tournaments/{tournamentId}            # Tournament management
│   ├── /events/{eventId}                 # Tournament events
│   └── /stats/{playerId}                 # Tournament stats (cached)
├── knockouts/{knockoutId}                # 8-team knockout tournaments
├── bots/{botId}                          # Bot players
├── chat_rooms/{roomId}                   # Chat channels
│   └── /messages/{messageId}             # Chat messages
├── conversations/{conversationId}        # Direct messages
│   └── /messages/{messageId}             # Conversation messages
├── notifications/{notificationId}        # System notifications
├── notifications_queue/{queueId}         # Queued notifications
├── notification_logs/{logId}             # Notification history
├── message_notifications/{notifId}       # Chat notifications
├── pickup_games/{gameId}                 # Casual games
├── pickup_stats/{playerId}               # Pickup game stats
├── mini_tournaments/{miniTournamentId}   # Quick tournaments
│   └── /matches/{matchId}                # Mini tournament matches
├── challenges/{challengeId}              # Player challenges
├── challenge_board/{challengeId}         # Public challenges
├── bounty_board/{bountyId}               # Bounty challenges
├── online_matches/{matchId}              # Online play
├── match_replays/{replayId}              # Saved replays
├── spectate_logs/{logId}                 # Spectator history
├── practice_sessions/{sessionId}         # Practice mode
├── league_templates/{templateId}         # League templates
├── tournament_templates/{templateId}     # Tournament templates
├── league_drafts/{draftId}               # Draft leagues
├── tournament_drafts/{draftId}           # Draft tournaments
├── feedback/{feedbackId}                 # User feedback
├── presence_heartbeats/{playerId}        # Online status
├── season_rankings/{seasonId}            # Season leaderboards
├── fcm_tokens/{tokenId}                  # Push notification tokens
├── login_attempts/{attemptId}            # Login audit trail
├── admin_sessions/{sessionId}            # Admin activity logs
├── payments/{paymentId}                  # Payment records
├── cheers/{cheerId}                      # Player cheers/reactions
├── posts/{postId}                        # Social posts
├── breakup_pool/{poolId}                 # Matchmaker breakup pool
└── settings/{settingId}                  # System settings
```

---

## Core Collections

### players/{playerId}
Global player registry - ONE record per person across all features.

```javascript
{
  // Identity
  name: "John Doe",
  email: "john@example.com",
  phone: "2165551234",

  // Auth
  pin: "12345678",              // 8-digit: phone_last4 + chosen_pin

  // Profile
  photo_url: "https://...",
  notification_preference: "sms", // sms | email | both

  // Bot fields (if applicable)
  isBot: false,
  botDifficulty: null,

  // Cached stats (populated by recalculate)
  stats: {
    matches_played: 50,
    matches_won: 30,
    x01: { legs_played, legs_won, total_points, total_darts, ... },
    cricket: { legs_played, legs_won, total_marks, total_rounds, ... }
  },

  // Involvements (links to leagues/tournaments)
  involvements: {
    leagues: [{ id, name, team_id, team_name, role }],
    tournaments: [{ id, name, event_id, status }],
    directing: [{ id, name, type, status }],
    captaining: [{ league_id, team_id, team_name }]
  },

  created_at: Timestamp,
  updated_at: Timestamp
}
```

---

### leagues/{leagueId}

```javascript
{
  // Identity
  league_name: "2026 Winter Triples",
  season: "Winter 2026",
  league_type: "triples_draft",

  // Schedule
  start_date: "2026-01-15",
  league_night: "wednesday",
  start_time: "19:00",
  schedule_format: "round_robin",
  current_week: 1,
  total_weeks: 14,

  // Venue
  venue_name: "Local Bar",
  venue_address: "123 Main St",

  // Structure
  num_teams: 10,
  players_per_team: 3,
  games_per_match: 9,
  legs_per_game: 3,
  match_format: [...],          // Custom format array

  // Director
  director_name: "Admin",
  director_player_id: "abc123",
  director_pin: "12345678",
  admin_pin: "12345678",

  // Rules
  point_system: "game_based",
  playoff_format: "top_4_single",

  // Status
  status: "active",             // registration | draft | active | playoffs | completed

  created_at: Timestamp
}
```

---

### leagues/{leagueId}/players/{playerId}

```javascript
{
  name: "John Doe",
  email: "john@example.com",
  phone: "2165551234",

  // League-specific
  team_id: "team123",
  position: 1,                  // 1=Captain, 2=P2, 3=P3
  level: "A",                   // A | B | C
  is_captain: true,
  is_sub: false,

  // Registration
  skill_level: "intermediate",
  reported_average: 45,
  payment_status: "paid",
  pin: "12345678",

  registered_at: Timestamp
}
```

---

### leagues/{leagueId}/teams/{teamId}

```javascript
{
  team_name: "Team Awesome",

  // Roster (embedded array)
  players: [
    { id: "player1", name: "John", position: 1, isBot: false },
    { id: "player2", name: "Jane", position: 2, isBot: false },
    { id: "player3", name: "Bob", position: 3, isBot: false }
  ],

  captain_id: "player1",

  // Standings
  wins: 5,
  losses: 3,
  ties: 0,
  games_won: 42,
  games_lost: 36,
  points: 10,

  created_at: Timestamp
}
```

---

### leagues/{leagueId}/matches/{matchId}

```javascript
{
  // Schedule
  week: 1,
  match_date: "2026-01-22",

  // Teams
  home_team_id: "team1",
  home_team_name: "Team A",
  away_team_id: "team2",
  away_team_name: "Team B",

  // Score
  home_score: 5,
  away_score: 4,

  // Status
  status: "completed",          // scheduled | in_progress | completed
  match_pin: "1234",            // 4-digit access PIN

  // Games (embedded array)
  games: [
    {
      game_number: 1,
      game_type: "doubles",       // singles | doubles | triples
      format: "501",              // 501 | 301 | 701 | cricket
      in_rule: "open",            // open | double | master
      out_rule: "double",         // double | single | master

      home_players: [{ id, name, position }],
      away_players: [{ id, name, position }],

      winner: "home",
      home_legs_won: 2,
      away_legs_won: 1,

      // Legs with FULL throw-by-throw detail
      legs: [
        {
          leg_number: 1,
          winner: "home",
          started_at: Timestamp,
          completed_at: Timestamp,

          // Turn-by-turn throws (SOURCE OF TRUTH)
          throws: [
            {
              turn: 1,
              player_id: "player1",
              player_name: "John Doe",
              side: "home",               // home | away
              darts: [
                { score: 60, multiplier: 1, target: 20 },  // single 20
                { score: 60, multiplier: 3, target: 20 },  // triple 20
                { score: 60, multiplier: 3, target: 20 }   // triple 20
              ],
              turn_total: 180,
              remaining: 321,             // score after this turn
              is_bust: false,
              is_checkout: false
            },
            {
              turn: 2,
              player_id: "player2",
              player_name: "Jane Smith",
              side: "away",
              darts: [
                { score: 57, multiplier: 3, target: 19 },
                { score: 54, multiplier: 3, target: 18 },
                { score: 45, multiplier: 3, target: 15 }
              ],
              turn_total: 156,
              remaining: 345,
              is_bust: false,
              is_checkout: false
            },
            // ... more turns ...
            {
              turn: 15,
              player_id: "player1",
              player_name: "John Doe",
              side: "home",
              darts: [
                { score: 20, multiplier: 1, target: 20 },
                { score: 0, multiplier: 0, target: 20 },   // miss
                { score: 32, multiplier: 2, target: 16 }   // double 16 checkout
              ],
              turn_total: 52,
              remaining: 0,
              is_bust: false,
              is_checkout: true,
              checkout_dart: 3            // which dart was checkout
            }
          ],

          // Aggregated stats (computed from throws)
          home_stats: {
            player_id: "player1",
            player_name: "John Doe",
            darts_thrown: 45,
            points_scored: 501,
            three_dart_avg: 33.4,
            first9_darts: 9,
            first9_points: 180,
            tons: 2,
            ton_00: 1,                    // 100-119
            ton_20: 0,                    // 120-139
            ton_40: 0,                    // 140-159
            ton_60: 0,                    // 160-179
            ton_80: 1,                    // 180
            high_turn: 180,
            checkout: 32,
            checkout_darts: 3,            // darts at double
            checkout_attempts: 5
          },
          away_stats: { /* same structure */ },

          // For Cricket legs
          cricket_stats: {
            home: {
              player_id: "player1",
              marks: { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, bull: 3 },
              total_marks: 52,
              rounds: 12,
              mpr: 4.33,
              points_scored: 125,
              nine_mark_rounds: 2,
              white_horse: 1              // all 3 darts on different open numbers
            },
            away: { /* same structure */ }
          }
        }
      ],

      completed_at: Timestamp
    }
  ],

  created_at: Timestamp,
  started_at: Timestamp,
  completed_at: Timestamp
}
```

**Key Points:**
- `throws[]` array stores every single turn with individual dart scores
- Players can review throw-by-throw history
- `*_stats` objects are computed from throws (can be recalculated)
- Cricket tracks marks per number and special achievements

---

### leagues/{leagueId}/stats/{playerId}

```javascript
{
  player_id: "abc123",
  player_name: "John Doe",

  // Overall
  games_played: 20,
  games_won: 13,

  // X01 Stats
  x01_legs_played: 45,
  x01_legs_won: 28,
  x01_total_darts: 1350,
  x01_total_points: 22545,
  x01_tons: 25,
  x01_ton_40: 5,
  x01_ton_80: 2,
  x01_high_checkout: 120,
  x01_checkouts_hit: 28,

  // Cricket Stats
  cricket_legs_played: 30,
  cricket_legs_won: 18,
  cricket_total_marks: 450,
  cricket_total_darts: 360,
  cricket_nine_mark_rounds: 3,

  updated_at: Timestamp
}
```

---

### tournaments/{tournamentId}

```javascript
{
  tournament_name: "Heartbreaker 2026",
  tournament_date: "2026-02-14",
  tournament_time: "19:00",

  venue_name: "Dart Palace",
  venue_address: "456 Oak St",

  director_name: "Admin",
  director_pin: "12345678",

  format: "single_elimination",
  game_type: "501",
  max_players: 32,
  entry_fee: 20,

  // Bracket
  bracket: {
    matches: [
      { match_number, round, player1, player2, winner, score1, score2 }
    ]
  },

  // Players (map)
  players: {
    "playerId": { id, name, checkedIn: true, timestamp }
  },

  status: "started",
  playerCount: 28,

  created_at: Timestamp
}
```

---

## Key Relationships

| Parent | Child | Link Field |
|--------|-------|------------|
| players | leagues/players | Same document ID |
| players | leagues/stats | Same document ID |
| leagues/players | leagues/teams | team_id field |
| leagues/teams | leagues/matches | home_team_id, away_team_id |
| players | tournaments | players map key |

---

## ID Strategy

**Global Player ID** is used everywhere:
- `players/{globalId}` - Global collection
- `leagues/{id}/players/{globalId}` - League player
- `leagues/{id}/stats/{globalId}` - League stats
- `leagues/{id}/teams/{id}/players[].id` - Team roster
- `leagues/{id}/matches/{id}/games[].home_players[].id` - Match players
- `tournaments/{id}/players.{globalId}` - Tournament players
- `tournaments/{id}/stats/{globalId}` - Tournament stats

This ensures one ID links a player across ALL features.
