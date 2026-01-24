# BRDC CHAT SYSTEM - COMPLETE SPECIFICATION
# Download this file and share with Claude Code

VERSION: 1.0
DATE: January 2026
PROJECT: Burning River Darts LLC

═══════════════════════════════════════════════════════════════════

TABLE OF CONTENTS
1. Quick Start Guide
2. Phase 1 - MVP (Build First)  
3. Phase 2 - Live Match Features
4. Phase 3 - Challenge System
5. Technical Implementation
6. Firebase Database Structure
7. Security & Permissions
8. Mobile Responsiveness

═══════════════════════════════════════════════════════════════════

## QUICK START GUIDE

**What is this?**
A Discord-style chat system for BRDC with auto-generated rooms per league/tournament, live match tracking, and player challenges.

**Build Order:**
1. Phase 1 (MVP) - Basic chat + auto rooms ← START HERE
2. Phase 2 - Live match ticker + overlays
3. Phase 3 - Challenge system + spectator rooms

**Core Features:**
✓ Auto-generated chat rooms per event (main, team, captain)
✓ Real-time messaging with @mentions, reactions, replies
✓ Live match ticker showing all active matches
✓ Match spectator overlays with real-time scoring
✓ Player-to-player match challenges
✓ Mobile-first with FAB + mode switching

═══════════════════════════════════════════════════════════════════

## PHASE 1: MVP IMPLEMENTATION

**PRIORITY: Build This First**

### 1.1 CHAT PAGE LAYOUT (Desktop)

Three-column Discord-style:

```
┌──────────────┬────────────────────────────────┬──────────────────┐
│  LEFT        │         CENTER                 │      RIGHT       │
│  SIDEBAR     │         CHAT                   │      SIDEBAR     │
│              │                                │                  │
│  Room List   │    Message Stream              │   Online Members │
│              │                                │   Pinned Messages│
└──────────────┴────────────────────────────────┴──────────────────┘
```

**Left Sidebar - Room List:**
- Organized by: Active Leagues → Active Tournaments → General
- Show unread badges (red dot or count)
- Icons indicate room type

Example:
```
ACTIVE LEAGUES
━━━━━━━━━━━━━━━━
🏆 Winter 2026 Triples
   💬 Main Room (3)      ← 3 unread messages
   👥 Your Team Chat
   👑 Captain Chat

GENERAL
━━━━━━━━━━━━━━━━
💬 BRDC Community
```

**Center - Chat Messages:**
- Newest at bottom, auto-scroll
- Pagination: "Load older messages" on scroll up
- Message types: User, System, Match Results
- Input box at bottom

**Right Sidebar:**
- Online member count
- Member list with green dot = online
- Role badges (Captain, Director)
- Pinned messages section

### 1.2 AUTO-GENERATED CHAT ROOMS

**When a league/tournament is created:**

Automatically create:
1. **Main Room** - all participants
2. **Team Chats** - one per team (private)
3. **Captain Chat** - all captains (private)

**Firebase Structure:**
```javascript
/chatRooms/{roomId}
{
  id: "winter2026_triples_main",
  type: "league_main" | "league_team" | "league_captain" | "tournament_main",
  eventId: "winter2026_triples",
  eventName: "Winter 2026 Triples League",
  teamId: "team_123" (if team chat),
  name: "Winter 2026 Triples - Main Room",
  participants: ["userId1", "userId2", ...],
  public: true | false,
  createdAt: timestamp,
  lastActivity: timestamp,
  archived: false
}
```

**Access Control:**
- Main Room: Anyone can read, participants can write
- Team Chat: Only team members
- Captain Chat: Only captains

**Room Lifecycle:**
- Created when event starts (or 1 week before)
- Active during event
- Archived 30 days after completion (read-only, moved to "Archived" section)

### 1.3 REAL-TIME MESSAGING

**Message Structure:**
```javascript
/messages/{roomId}/{messageId}
{
  id: "msg_abc123",
  roomId: "winter2026_triples_main",
  userId: "user_donnie",
  userName: "Donnie",
  text: "Good luck everyone tonight! 🎯",
  type: "user" | "system" | "match_result",
  mentions: ["user_mike", "user_sarah"],
  reactions: {
    "user_mike": "👍",
    "user_sarah": "🔥"
  },
  replyTo: "msg_xyz789" (optional),
  timestamp: firebaseTimestamp,
  edited: false
}
```

**Features:**

1. **Send Message**
   - Character limit: 2000
   - Rate limit: 5 messages per 10 seconds
   - Enter to send, Shift+Enter for new line

2. **@Mentions**
   - Type "@" → autocomplete dropdown
   - Filters by username
   - Sends notification to mentioned user
   - Username highlighted in message

3. **Reactions**
   - Emoji picker: 👍 ❤️ 🔥 🎯 😂 👀
   - Show count below message
   - Click to add/remove your reaction

4. **Reply to Message**
   - Creates threaded connection
   - Shows quoted message above input
   - Display inline (collapsed, expandable)

**Message Display Example:**
```
┌─────────────────────────────────────────────┐
│ Donnie                          2:34 PM     │
│ Good luck everyone tonight! 🎯              │
│ 👍 3  🔥 2                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Mike                            2:35 PM     │
│ ↳ Replying to Donnie                       │
│ Thanks! Let's do this @Sarah                │
│ 👍 1                                        │
└─────────────────────────────────────────────┘
```

### 1.4 USER PRESENCE & TYPING

**Presence:**
```javascript
/userPresence/{userId}
{
  userId: "user_donnie",
  online: true,
  lastSeen: timestamp,
  currentRoom: "winter2026_triples_main"
}
```

- Green dot = online
- Heartbeat every 30 seconds
- "Last seen X minutes ago" for offline

**Typing Indicators:**
- Show after 500ms of typing (debounced)
- "Mike is typing..."
- Max 3 users: "Mike, Sarah, and 2 others..."
- Auto-remove after 3 seconds

### 1.5 MOBILE LAYOUT (Phase 1 - Simple)

**Mobile (< 768px):**
```
┌─────────────────────────┐
│ [☰] Winter 2026    [🔔] │
├─────────────────────────┤
│                         │
│  Message Stream         │
│                         │
│  Donnie: Good luck!     │
│  Mike: Let's go! 🔥     │
│                         │
│ [Type message...]  [📷] │
└─────────────────────────┘
```

**Navigation:**
- Tap [☰] → Room list drawer (slides in from left)
- Tap [🔔] → Notifications dropdown
- Swipe right on message → Quick reply
- Long-press message → Action menu
- "👤 12 Online" button → Members bottom sheet

**Keep it simple for Phase 1 - polish with FAB + Modes in Phase 2**

### 1.6 NOTIFICATIONS (Phase 1)

**Triggers:**
1. @Mention
2. Reply to your message
3. New message in team/captain chat (if not viewing)

**Delivery:**
- In-app badge (red dot on rooms, bell icon)
- Browser push notifications

**User Settings:**
```javascript
/userSettings/{userId}/notifications
{
  mentions: true,
  replies: true,
  teamChat: true,
  captainChat: true,
  allMessages: false,
  browserPush: true,
  sound: true
}
```

**Browser Notification:**
```javascript
new Notification("Donnie mentioned you", {
  body: "Good luck everyone tonight! @Mike",
  icon: "/brdc-logo.png",
  data: { roomId: "...", messageId: "..." }
})
```

### 1.7 MESSAGE ACTIONS

**Desktop Hover:**
[Reply] [React 😊] [•••More]

**Mobile Long-Press:**
```
┌─────────────────────┐
│ Reply               │
│ React 👍❤️🔥🎯     │
│ Copy text           │
│ Delete (if yours)   │
│ Report message      │
└─────────────────────┘
```

**Message Editing:**
- Edit within 5 minutes
- Shows "(edited)" indicator

**Spam Prevention:**
- Rate limit: 5 messages/10 seconds
- No duplicate messages in a row
- Max 2 URLs per message

**Moderator Powers (Directors):**
- Delete any message
- Mute user
- Ban from chat
- Pin/unpin messages

### 1.8 SYSTEM MESSAGES

**Auto-posted to rooms:**

**League Start:**
```
🏆 Winter 2026 Triples League has started!
Good luck to all teams. Check the bracket for matchups.
```

**Round Start:**
```
📢 Round 3 is now underway!
Check your board assignments.
```

### 1.9 PHASE 1 SUCCESS CRITERIA

**Must Work:**
✅ Auto-create main, team, captain rooms when league starts
✅ Send/receive messages in real-time
✅ @Mentions work and send notifications
✅ Reactions display and update live
✅ Typing indicators show who's typing
✅ Online/offline presence accurate
✅ Mobile users can chat
✅ Team chat private to team members
✅ Captain chat private to captains
✅ Basic spam prevention
✅ Messages persist on refresh

**Test During:**
Winter 2026 Triples League night - get real feedback before Phase 2

═══════════════════════════════════════════════════════════════════

## PHASE 2: LIVE MATCH FEATURES

**Build After Phase 1 is Tested**

### 2.1 LIVE MATCH TICKER

**Horizontal ticker at top of page:**
```
┌───────────────────────────────────────────────────────────────────┐
│ [⚙️] 🔴 LIVE | Board 1: Donnie/Mike vs Sarah/Tom (3-2) | Board 3...│
└───────────────────────────────────────────────────────────────────┘
```

**Features:**
- Shows all active matches
- Auto-scrolls or manual with arrows
- Collapsible (minimize to "🔴 5 LIVE")
- Click match → opens overlay

**Ticker Card:**
```
Event Name | Round | Board #
Player1/Player2 vs Player3/Player4
Games: 3-2 | Current: 301→121
```

**Ticker Settings (⚙️):**
- Filter by event
- Filter by round
- Follow specific players
- "X" to dismiss matches
- "Show All" override

**Data Source:**
```javascript
/liveMatches/{matchId}
{
  matchId: "match_abc123",
  eventId: "winter2026_triples",
  eventName: "Winter 2026 Triples",
  round: "Round 3",
  boardNumber: 1,
  players: [...],
  gameType: "501" | "cricket",
  gamesWon: { team1: 3, team2: 2 },
  currentLeg: {
    team1Score: 121,
    team2Score: 187,
    ...
  },
  status: "live",
  spectatorCount: 12,
  lastUpdate: timestamp
}
```

### 2.2 MATCH OVERLAY

**Click ticker card → Dropdown overlay:**

```
┌════════════════════════════════════════════════════════════════┐
│ Winter 2026 Triples | Round 3 | Board 1                   [X] │
│ Donnie/Mike vs Sarah/Tom | Games Won: 3-2                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ CURRENT LEG (Leg 6) - Donnie/Mike Throwing                    │
│ ┌─────────────────┬─────────────────┐                        │
│ │ Donnie/Mike     │ Sarah/Tom       │                        │
│ │ 301 → 121       │ 301 → 187       │                        │
│ │ 6 darts         │ 4 darts         │                        │
│ └─────────────────┴─────────────────┘                        │
│                                                                │
│ SHOT HISTORY (This Leg):                                      │
│ 🎯 Donnie: T20, T20, T20 (180)                                │
│    Mike: 60, 60, 60                                           │
│    Sarah: 57, 57                                              │
│                                                                │
│ MATCH STATS:                                                   │
│                Donnie    Mike    Sarah    Tom                 │
│ This Match:    87.3 PPD  82.1    79.8     76.4                │
│ Season Avg:    84.2 PPD  79.5    77.1     74.8                │
│ Ton+:          4         2       1        3                   │
│                                                                │
│ [View Full Scoresheet] [Jump to Match Chat] [Follow Players]  │
└────────────────────────────────────────────────────────────────┘
```

**Features:**
- Live updates via Firebase listeners
- Works for 501 and Cricket (adaptive display)
- Click outside to close
- Semi-transparent backdrop

**Cricket Differences:**
- Shows mark counts (15-20, Bull)
- MPR instead of PPD
- Closing sequence

### 2.3 AUTO-POSTED MATCH RESULTS

**When scorer submits match:**

Post rich embed to relevant rooms:

**501 Result:**
```
┌────────────────────────────────────────────┐
│ 🎯 MATCH COMPLETE - Board 3                │
│ Winter 2026 Triples | Round 3              │
│ Donnie/Mike defeated Sarah/Tom (5-4)       │
│                                            │
│ 📊 Match Stats:                            │
│ • Top PPD: Donnie (87.3)                   │
│ • Highest Checkout: Mike (121)             │
│ • Most Ton+: Donnie (8)                    │
│ • Best Leg: Mike (15 darts)                │
│                                            │
│ @Donnie @Mike @Sarah @Tom                  │
│ [View Full Scoresheet]                     │
└────────────────────────────────────────────┘
```

**Post To:**
- Event main room
- Both team chats
- @Mentions all players (sends notifications)

**Message Structure:**
```javascript
{
  type: "match_result",
  matchId: "match_abc123",
  gameType: "501",
  winner: { teamId, playerIds, score: 5 },
  loser: { teamId, playerIds, score: 4 },
  stats: {
    topPPD: { player: "Donnie", value: 87.3 },
    highestCheckout: { player: "Mike", value: 121 },
    ...
  },
  scoresheetUrl: "/scoresheet/match_abc123"
}
```

### 2.4 PHASE 2 SUCCESS CRITERIA

**Must Work:**
✅ Ticker shows all live matches
✅ Ticker updates in real-time
✅ Click ticker → overlay opens
✅ Overlay updates live during match
✅ Match results auto-post when complete
✅ Players get notifications
✅ Stats adaptive (501 vs Cricket)
✅ Mobile ticker functional

═══════════════════════════════════════════════════════════════════

## PHASE 3: CHALLENGE SYSTEM & MATCH ROOMS

**Build After Phase 2 Stable**

### 3.1 CHALLENGE SYSTEM

**From Profile:**
```
[Donnie's Profile]
Stats | Match History

[⚔️ Challenge to Match]
```

**From Chat:**
```
@Donnie [⚔️]
```

**Challenge Modal:**
```
┌─────────────────────────────────┐
│ Challenge Donnie to a Match     │
│                                 │
│ Game Type: [501 ▾] [Cricket ▾] │
│ Race to: [3▾] [5▾] [7▾] [9▾]   │
│ Start: [Now] [Schedule Time]    │
│                                 │
│ Message (optional):             │
│ [Let's see what you got! 🎯]   │
│                                 │
│    [Send Challenge] [Cancel]    │
└─────────────────────────────────┘
```

**Challenge Data:**
```javascript
/challenges/{challengeId}
{
  id: "challenge_xyz789",
  challengerId: "user_mike",
  challengedId: "user_donnie",
  gameType: "501",
  raceTo: 3,
  startTime: "now" | timestamp,
  message: "Let's see what you got!",
  status: "pending" | "accepted" | "declined" | "active" | "completed",
  matchId: null  // Set when accepted
}
```

**Challenge Inbox:**
```
PENDING CHALLENGES

Received:
┌──────────────────────────────────┐
│ Mike challenged you              │
│ 501 • Race to 3 • Now            │
│ "Let's see what you got! 🎯"    │
│ [Accept] [Decline] [Counter]     │
└──────────────────────────────────┘

Sent:
┌──────────────────────────────────┐
│ Challenge to Tom - Pending       │
│ 501 • Race to 7                  │
│ [Cancel Challenge]               │
└──────────────────────────────────┘
```

**When Accepted:**
- Creates match entry
- Creates match room (optional)
- Both players get scorer link
- Match appears in ticker
- Notification: "Match is live!"

### 3.2 CASUAL MATCH SCORING

**Match Entry:**
```javascript
/casualMatches/{matchId}
{
  id: "match_casual_123",
  challengeId: "challenge_xyz789",
  player1: { id, name, score: 0 },
  player2: { id, name, score: 0 },
  gameType: "501",
  raceTo: 3,
  status: "live" | "completed",
  hasVideo: false,
  chatRoomId: null,
  winnerId: null
}
```

**Scoring:**
- Same scorer UI as league/tournament
- Honor system (Phase 3)
- Real-time sync via Firebase
- Opponent sees your throws live

**Future (Phase 4):**
- Dual camera (board + thrower)
- Computer vision auto-scoring
- Video verification

### 3.3 MATCH ROOMS (Spectator)

**When challenge accepted:**
Option to create public spectator room

**Match Room (No Video - Phase 3):**
```
┌─────────────────────────────────────────────────┐
│ 🔴 LIVE: Mike vs Donnie                    [X]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Scorer View - Real-time]                     │
│  Mike: 301 → 121 (6 darts)                     │
│  Donnie: 301 → 187 (4)                         │
│  Games: Mike 2 - 1 Donnie                      │
│                                                 │
│  [Shot History]                                 │
│  Mike: T20, T20, T20 (180)                     │
│  Donnie: 60, 60, 60                            │
│                                                 │
├─────────────────────────────────────────────────┤
│ LIVE CHAT - 12 watching                        │
│                                                 │
│ Sarah: LFG Mike! 🔥                            │
│ Tom: That 180 was nasty                        │
│ [Type message...]                    [Send]    │
└─────────────────────────────────────────────────┘
```

**With Video (Phase 3):**
- Board camera feed
- Thrower camera feed  
- Live scorer
- Real-time stats
- Spectator chat
- Recording capability

**Features:**
- Listed in "Live Matches" sidebar
- Shareable link: brdc.com/match/{matchId}
- Viewer count shown
- Players can moderate chat
- Post-match: stays open 30 min, [Rematch] button

### 3.4 LEADERBOARDS & STATS

**Casual Match Stats (Separate from League):**
```javascript
/userStats/{userId}/casualMatches
{
  totalMatches: 47,
  wins: 28,
  losses: 19,
  winRate: 0.596,
  currentStreak: 3,
  longestWinStreak: 7,
  avgPPD: 84.2,
  highCheckout: 170,
  total180s: 23,
  recordVsOpponents: {
    "user_mike": { wins: 7, losses: 2 },
    ...
  }
}
```

**Leaderboards:**
- Most Wins
- Highest Win Rate (min 10 matches)
- Current Win Streak
- Highest PPD (Casual)

**Head-to-Head:**
```
Donnie vs Mike
Overall: 7-2 (Donnie leads)
Last 5: 4-1
Last Match: Donnie won 5-3 (2 days ago)

[Challenge to Rematch]
```

### 3.5 PHASE 3 SUCCESS CRITERIA

**Must Work:**
✅ Challenge system functional
✅ Casual matches create scorer sessions
✅ Match appears in ticker
✅ Match rooms for spectators
✅ Spectator chat works
✅ Stats tracked separately
✅ Head-to-head accurate
✅ Leaderboards update
✅ [Rematch] button works

═══════════════════════════════════════════════════════════════════

## TECHNICAL IMPLEMENTATION

### FIREBASE STRUCTURE

**chatRooms Collection:**
```javascript
/chatRooms/{roomId}
{
  id: string,
  type: "league_main" | "league_team" | "league_captain" | "tournament_main" | "match_spectator",
  eventId: string (nullable),
  eventName: string (nullable),
  teamId: string (nullable),
  name: string,
  participants: [userId array],
  public: boolean,
  createdAt: timestamp,
  archived: boolean
}
```

**messages Collection:**
```javascript
/messages/{roomId}/{messageId}
{
  id: string,
  roomId: string,
  userId: string,
  userName: string,
  text: string,
  type: "user" | "system" | "match_result",
  mentions: [userId array],
  reactions: { userId: emoji },
  replyTo: messageId (nullable),
  timestamp: timestamp,
  edited: boolean,
  matchData: {...} (if match_result)
}
```

**userPresence Collection:**
```javascript
/userPresence/{userId}
{
  userId: string,
  online: boolean,
  lastSeen: timestamp,
  currentRoom: roomId (nullable)
}
```

**challenges Collection:**
```javascript
/challenges/{challengeId}
{
  id: string,
  challengerId: userId,
  challengedId: userId,
  gameType: "501" | "cricket",
  raceTo: number,
  status: "pending" | "accepted" | "declined" | "active" | "completed",
  matchId: string (nullable),
  createdAt: timestamp
}
```

**liveMatches Collection (for ticker):**
```javascript
/liveMatches/{matchId}
{
  matchId: string,
  eventId: string,
  gameType: "501" | "cricket",
  gamesWon: { team1, team2 },
  currentLeg: {...},
  status: "live" | "complete",
  spectatorCount: number,
  lastUpdate: timestamp
}
```

### CLOUD FUNCTIONS

**Auto-Create Rooms:**
```javascript
exports.createEventChatRooms = functions.firestore
  .document('leagues/{leagueId}')
  .onCreate(async (snap, context) => {
    const league = snap.data();
    
    // Create Main Room
    await db.collection('chatRooms').add({
      type: 'league_main',
      eventId: leagueId,
      eventName: league.name,
      participants: league.allPlayerIds,
      public: true,
      ...
    });
    
    // Create Team Chats
    for (const team of league.teams) {
      await db.collection('chatRooms').add({
        type: 'league_team',
        teamId: team.id,
        participants: team.playerIds,
        public: false,
        ...
      });
    }
    
    // Create Captain Chat
    const captainIds = league.teams.map(t => t.captainId);
    await db.collection('chatRooms').add({
      type: 'league_captain',
      participants: captainIds,
      public: false,
      ...
    });
  });
```

**Post Match Results:**
```javascript
exports.postMatchResult = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    
    if (after.status === 'completed') {
      const resultMessage = buildMatchResultMessage(after);
      
      // Post to event main room
      await db.collection('messages')
        .doc(`${after.eventId}_main`)
        .collection('messages')
        .add(resultMessage);
      
      // Send notifications to players
      for (const playerId of after.allPlayerIds) {
        await sendNotification(playerId, {
          title: 'Match Complete',
          body: `${after.winner.name} defeated ${after.loser.name}`
        });
      }
    }
  });
```

**Update Live Ticker:**
```javascript
exports.updateLiveTicker = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const match = change.after.data();
    
    if (match.status === 'live') {
      await db.collection('liveMatches').doc(matchId).set({
        matchId,
        eventId: match.eventId,
        gamesWon: { team1: match.team1Score, team2: match.team2Score },
        currentLeg: match.currentLeg,
        status: 'live',
        lastUpdate: timestamp
      });
    } else if (match.status === 'completed') {
      // Remove from ticker after 10 sec
      setTimeout(() => {
        db.collection('liveMatches').doc(matchId).delete();
      }, 10000);
    }
  });
```

═══════════════════════════════════════════════════════════════════

## SECURITY & PERMISSIONS

### FIRESTORE SECURITY RULES

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function userCanAccessRoom(roomId) {
      let room = get(/databases/$(database)/documents/chatRooms/$(roomId)).data;
      return room.public == true || request.auth.uid in room.participants;
    }
    
    // Chat Rooms
    match /chatRooms/{roomId} {
      allow read: if isAuthenticated() && userCanAccessRoom(roomId);
      allow write: if false; // Only Cloud Functions
    }
    
    // Messages
    match /messages/{roomId}/messages/{messageId} {
      allow read: if isAuthenticated() && userCanAccessRoom(roomId);
      allow create: if isAuthenticated() && 
                       userCanAccessRoom(roomId) &&
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.text.size() <= 2000;
      allow update: if isAuthenticated() && 
                       request.auth.uid == resource.data.userId;
      allow delete: if isAuthenticated() &&
                       (request.auth.uid == resource.data.userId ||
                        userIsDirector());
    }
    
    // Challenges
    match /challenges/{challengeId} {
      allow read: if isAuthenticated() &&
                     (request.auth.uid == resource.data.challengerId ||
                      request.auth.uid == resource.data.challengedId);
      allow create: if isAuthenticated() &&
                       request.resource.data.challengerId == request.auth.uid;
      allow update: if isAuthenticated() &&
                       (request.auth.uid == resource.data.challengerId ||
                        request.auth.uid == resource.data.challengedId);
    }
    
    // Live Matches (Public Read)
    match /liveMatches/{matchId} {
      allow read: if isAuthenticated();
      allow write: if false; // Only Cloud Functions
    }
  }
}
```

### RATE LIMITING

**Client-Side:**
```javascript
class MessageRateLimiter {
  constructor() {
    this.messageTimestamps = [];
    this.maxMessages = 5;
    this.timeWindow = 10000; // 10 seconds
  }
  
  canSendMessage() {
    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter(
      ts => now - ts < this.timeWindow
    );
    return this.messageTimestamps.length < this.maxMessages;
  }
  
  recordMessage() {
    this.messageTimestamps.push(Date.now());
  }
}
```

═══════════════════════════════════════════════════════════════════

## MOBILE RESPONSIVENESS

### PHASE 1: SIMPLE MOBILE

**< 768px:**
- Single column: Chat only
- Hamburger menu → Room list drawer
- Bell icon → Notifications dropdown
- Swipe right on message → Quick reply
- Long-press message → Action menu

**768px - 1024px:**
- Two columns: Rooms + Chat
- Members as collapsible panel

**> 1024px:**
- Full three columns
- Persistent ticker
- All features visible

### PHASE 2+: FAB + MODE SYSTEM

**Mode Toggle (Top Bar):**
```
[💬 Chat] [👁️ Watch] [⚡ Both]
```

**CHAT MODE:**
Full-screen chat, FAB for quick access to Live/Rooms/People

**WATCH MODE:**
Vertical list of live match cards, tap to open overlay

**BOTH MODE:**
Pinned match at top, chat below, drag to resize

**FAB Menu (Bottom-Right):**
```
       [🎯]
         │
   [🏠]─[⊕]─[👤]
         │
       [⚔️]
```

### MOBILE GESTURES

- Swipe right on message → Quick reply
- Long-press message → Action menu
- Pull down in chat → Load older messages
- Pull up from FAB → Open menu

═══════════════════════════════════════════════════════════════════

## REAL-TIME UPDATES

### FIREBASE LISTENERS

**Chat Messages:**
```javascript
function subscribeToRoom(roomId) {
  return db.collection('messages').doc(roomId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') renderMessage(change.doc.data());
        if (change.type === 'modified') updateMessage(change.doc.data());
        if (change.type === 'removed') removeMessage(change.doc.id);
      });
    });
}
```

**Live Ticker:**
```javascript
function subscribeToLiveTicker() {
  return db.collection('liveMatches')
    .where('status', '==', 'live')
    .onSnapshot((snapshot) => {
      const matches = snapshot.docs.map(doc => doc.data());
      renderTicker(matches);
    });
}
```

**Presence:**
```javascript
function subscribeToPresence(roomId) {
  return db.collection('userPresence')
    .where('currentRoom', '==', roomId)
    .where('online', '==', true)
    .onSnapshot((snapshot) => {
      const online = snapshot.docs.map(doc => doc.data());
      renderOnlineMembers(online);
    });
}
```

### PRESENCE HEARTBEAT

```javascript
class PresenceManager {
  async goOnline(roomId) {
    await db.collection('userPresence').doc(userId).set({
      online: true,
      lastSeen: timestamp,
      currentRoom: roomId
    });
    
    // Heartbeat every 30 sec
    this.interval = setInterval(() => this.sendHeartbeat(), 30000);
    
    // On disconnect
    db.collection('userPresence').doc(userId)
      .onDisconnect()
      .update({ online: false });
  }
}
```

═══════════════════════════════════════════════════════════════════

## TESTING & VALIDATION

### PHASE 1 CHECKLIST

- [ ] Create league → Rooms auto-created
- [ ] Send message → All participants see it
- [ ] Team chat → Only team members see it
- [ ] @Mention → Notification sent
- [ ] React to message → Emoji appears
- [ ] Reply to message → Thread visible
- [ ] Typing indicator → Others see it
- [ ] Go offline → Status updates
- [ ] Refresh → Messages load
- [ ] Mobile: Hamburger → Room list
- [ ] Mobile: Long-press → Action menu
- [ ] Rate limit → 6th message blocked
- [ ] Edit message → Shows "(edited)"
- [ ] Delete message → Shows "[deleted]"

### PHASE 2 CHECKLIST

- [ ] Match goes live → Appears in ticker
- [ ] Score updates → Ticker reflects
- [ ] Click ticker → Overlay opens
- [ ] Overlay updates → Real-time
- [ ] Match completes → Result posts
- [ ] Players mentioned → Notifications
- [ ] Filter ticker → Only followed matches
- [ ] Dismiss match → Hidden
- [ ] Mobile ticker → Swipeable

### PHASE 3 CHECKLIST

- [ ] Send challenge → Notification
- [ ] Accept challenge → Match created
- [ ] Both players score → Match progresses
- [ ] Match room → Spectators join
- [ ] Spectator chat → Messages visible
- [ ] Match completes → Stats saved
- [ ] Rematch → New challenge
- [ ] Leaderboards → Stats updated

═══════════════════════════════════════════════════════════════════

## DEPLOYMENT

### PRE-LAUNCH

- [ ] All Phase 1 features tested
- [ ] Security rules deployed
- [ ] Cloud Functions deployed
- [ ] Database indexes created
- [ ] Error logging configured
- [ ] Analytics setup
- [ ] Browser compatibility tested
- [ ] Mobile tested (iOS/Android)
- [ ] Load testing (100+ users)

### LAUNCH

- [ ] Deploy to production
- [ ] Monitor errors closely
- [ ] Watch Firebase costs
- [ ] Gather user feedback
- [ ] Document issues

### POST-LAUNCH

- [ ] Iterate on feedback
- [ ] Optimize performance
- [ ] Plan Phase 2

═══════════════════════════════════════════════════════════════════

## FUTURE ENHANCEMENTS (Phase 4+)

- Voice channels for live commentary
- Image/GIF uploads
- Auto-moderation (profanity filter)
- Multi-language support
- Analytics dashboard
- Gamification (achievements, badges)
- Profile customization

═══════════════════════════════════════════════════════════════════

END OF SPECIFICATION

Save this file and share with Claude Code to begin implementation.

Focus on Phase 1 first - get basic chat working with auto-generated rooms.
Test during Winter 2026 Triples League.
Build Phase 2 after Phase 1 is stable.

Questions? Reference specific sections by number.

Good luck! 🎯🔥
