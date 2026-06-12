# BRDC vNext — Navigation & Information Architecture Spec

Date: 2026-06-04
Status: AGREED (design conversation with owner). Build against this; don't re-decide.

## Governing principle
One **player-first** app with a **Manage layer** that only appears for operators. The app is mobile-first and ships as a native shell (Capacitor iOS/Android), so it should feel like a native app — a bottom tab bar on mobile, a top bar on desktop — NOT a desktop dashboard with a left drawer. Kill the three overlapping legacy nav systems (fb-sidebar left drawer, vNext top/bottom nav, right chat drawer) and replace with ONE responsive nav.

## The 5 primary destinations (identical for everyone)
Mobile = bottom tab bar; desktop = top bar. Center slot is a raised action.

| Tab | Metaphor | Lands on | Contains / drills into |
|---|---|---|---|
| **Home** | your locker (it's "you") | personal dashboard | your next match (front & center), your recent results, your stats snapshot, recognition/shoutouts, your registrations |
| **League** | the season | **"My Leagues" landing** (see below) | drill into a league hub: standings (reg/playoff), schedule, teams, stats/leaderboards, fill-ins |
| **▶ Play** | step to the oche | **Arena** (see below) | your league match (if any), score a local game, then the online play lobby |
| **Events** | tournament board | events index | tournaments + Wing It Wednesdays, register, view bracket, watch |
| **Clubhouse** | the club floor ("us" — talk/trade) | **Lobby** (see below) | chat rooms, trade board, members directory |

**Utility (top-right, persistent, not destinations):** Search · Notifications/alerts · avatar.
**Avatar menu:** profile + full stats, settings, logout, and **Manage** (operators only).

## League tab → "My Leagues" landing (handles no-current-league)
Do NOT assume the user is in a league. League opens to an index:
- **Current** — league(s) the user is in now → tap → league hub.
- **Past** — their league history → tap → archived league view.
- **Open to join** — upcoming leagues accepting registration → tap → info + register.
- **Empty state** (no leagues at all): "You're not in a league yet" + what's open to join.
Symmetrical with Events (index → drill into one). Reference: OG `leagues.html` lists leagues; make the vNext version player-centric (mine + open).

## ▶ Play → Arena (the competitive floor)
Center button opens the Arena — "play & compete". In-person play pinned at TOP (BRDC is an
in-person league first), online lobby below:
- 🎯 **Your league match** (if any) → one tap to its scorer.
- **Score a game here** → casual setup (`scorer-setup-vnext`) for an in-person board.
- ── lobby (Granboard-style) ──
- **Online now** — presence; quick-match / host / join a board (`online_matches`).
- **Challenges** — issue/accept 1v1. **Async: challenge a player who is NOT online** — they get a
  message/notification, accept later, then arrange the match. A challenge IS a message (same chat
  engine — deconfliction rule 1).
- **Mini-tournaments** — quick pickup brackets (`mini_tournaments`).
- **Watch live** — spectate in-progress online games.

## Clubhouse = evolved `messages-vnext` (NOT a from-scratch page) — talk & trade
messages-vnext is the Clubhouse in disguise. Challenges + Online play move OUT to the Arena;
Clubhouse keeps the social/talk/trade half:
- **Lobby** (default landing) — social activity floor: who's here, banter, fresh trade listings, highlights. NOT a DM list — chat one tap in.
- **Chat** — existing rooms (DM / League / Team / Event), same engine.
- **Trade** — dart-trader folded in as the club trade board.
- **Members** — people directory + presence (tap a person → profile / message / challenge / trade).

## Manage layer (operators only — behind the avatar, never in the 5)
- Director: Director home · Create league · Create event · Run event (runtime) · League management · Contact center · Import.
- Captain: team tools (fill-in requests, roster) live ON the team page (per owner) — not a separate console.
- Owner: + Site admin, template library / redistribution.

## Contextual surfaces (no nav slot — reached from within a flow)
match-hub, league-team, tournament-register, the scorers (x01/cricket — **full-screen, nav hidden while scoring**), matchmaker mingle/TV, dart-trader-create, player-profile (opens from Home/avatar/tapping a person).

## Deconfliction rules (so we don't build things twice)
1. **One chat engine.** The "League room" surfaces inside League but is the same messaging system as Clubhouse, filtered to that room. Never two inboxes.
2. **"Members" has two senses, kept separate:** Clubhouse → Members = the *people* directory (social: profile/message/challenge/trade). League → Teams = the *competitive roster* (this season's lineups). Same humans, different lens.
3. **Home vs Clubhouse must not feel like two feeds:** Home = things involving *you* (your match, your team's result, your fill-in). Clubhouse = things involving *the club* (general chat, a new trade listing, someone's 180, who checked in). "Mine vs everyone's."

## Full surface → home mapping
| Surface (today) | New home |
|---|---|
| home-vnext | Home |
| player-profile-vnext | contextual (from Home / avatar / tapping a person) |
| triples-vnext (league hub) | League → (a league) |
| leagues index / "My Leagues" | **League (landing)** — NEW player-centric page |
| league-team-vnext | contextual (from League → Teams) |
| match-hub-vnext | contextual (from League schedule / Home next-match) |
| members-vnext | split: people → Clubhouse · roster → League |
| x01 / cricket scorers, scorer-setup | ▶ Play (full-screen while scoring) |
| events-vnext, tournament-view, wing-it | Events |
| tournament-register | contextual (from an event) |
| tournament-runtime, matchmaker mingle/TV | Events (watch) / Manage (run) |
| messages-vnext | **Clubhouse** (evolve + rename) |
| dart-trader (+create/listing) | Clubhouse → Trade |
| captain-dashboard | tools on the team page |
| create-league, create-tournament | Manage |
| director-home, league-director, contact-center, league-import | Manage |
| admin | Manage (owner) |

## Responsive behavior
- **Mobile:** bottom tab bar (5, thumb-reachable), raised center Play. Top: compact header with title + utility (search/notify/avatar).
- **Desktop:** top bar with the 5 + utility right. No chunky left rail (a left rail may appear ONLY inside Manage/director mode if dense tooling warrants).
- **Scorers:** nav hidden, full-screen, minimal exit affordance.

## Phased build plan
1. **One responsive nav component** + retire fb-sidebar / dedupe the legacy systems. Wire the 5 tabs + utility. (Touches all vNext pages — do carefully.)
2. **Role-gated Manage** behind the avatar + the avatar/account menu.
3. **Scorers full-screen** (suppress nav during active scoring).
4. **League "My Leagues" landing** page (new) + drill-in.
5. **Clubhouse** (talk/trade): rename/evolve messages-vnext → Lobby + Chat + Trade + Members. (Challenges/Online move to Arena, Phase 6.)
6. **Play → Arena** (page, not just a sheet): in-person pin (your league match / score-a-game) on top, then the Granboard-style online lobby — presence, quick-match/host/join, **async challenges** (offline players get a message), mini-tournaments, watch live.
