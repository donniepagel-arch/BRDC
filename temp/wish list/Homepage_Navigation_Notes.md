# Homepage & Navigation Strategy Notes

**Date:** January 21, 2026
**Status:** In Progress - Paused for other priorities

---

## What Was Built

### Dual-Purpose Home Page (`/public/index.html`)
Completed mobile-first home page that changes based on auth state:

**Logged Out View (Public Landing)**
- Hero section with "Burning River Darts" branding and CTAs
- Upcoming events carousel (from `community_events`)
- "Find a Venue" map preview card
- Marketplace carousel (from `dart_trader_listings`)
- League standings preview
- Weekly stats highlights
- "Ready to Play?" CTA section

**Logged In View (Personalized Feed)**
- Welcome banner with user's name
- "Your Next Match" featured card
- Messages preview section
- "Happening This Week" events carousel
- Quick Play buttons (501, Cricket, Virtual, Shop)
- New in Marketplace carousel
- League standings with user's team highlighted
- Bottom navigation (Home, Schedule, Play, Community, More)

---

## Desktop Layout Discussion

### Current State
- Mobile-first only
- One small breakpoint for very narrow phones (380px)
- On desktop: looks like narrow mobile app with wasted space

### Decision: NO Side Navigation
Side nav feels corporate/dashboard-y. Not right for a community app.

### Preferred Desktop Approach: Expanded Top Header
```
┌────────────────────────────────────────────────────┐
│ [logo] BRDC     Home  Events  Play  Shop  [avatar]│
├────────────────────────────────────────────────────┤
│                                                    │
│              Content fills full width              │
│              (grids instead of carousels)          │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Expand current header - logo left, nav items center/right
- Content uses grids on desktop (3-4 cards per row) vs carousels on mobile
- Clean, modern, doesn't waste horizontal space
- Similar to consumer apps (Spotify, Discord)

---

## Navigation Consolidation Strategy

### All Features to Organize
- Home (new dual-purpose page)
- Dashboard (my stuff, settings, stats, trader management)
- Leagues (browse, standings, schedule)
- Tournaments (browse, brackets)
- Community Events (map)
- Dart Trader (shop/marketplace)
- Scorer (501, cricket games)
- Virtual Darts (browser game)
- Messages

### Recommended Approach: Let Home Do the Heavy Lifting

Keep nav minimal because Home surfaces everything contextually:

```
Home    Play    Events    Shop    [Avatar]
```

- **Home** = The hub. Carousels, quick actions, your matches - everything's there
- **Play** = Scorer + Virtual Darts (the "do stuff" button)
- **Events** = Community map + Leagues + Tournaments (all "things happening")
- **Shop** = Dart Trader
- **Avatar** = Messages, My Dashboard, Settings

### Dashboard Relationship
Dashboard is NOT removed - it's repositioned:

**Before:** Dashboard is primary destination, Home was placeholder
**After:** Home is "at a glance" hub, Dashboard is "manage/details" layer

Access Dashboard via:
- Avatar dropdown → "My Dashboard"
- Tapping "See All" on matches
- Tapping stats to see full stats
- "More" in bottom nav on mobile

**Analogy:**
- Home = Instagram's home feed (what's happening, quick actions)
- Dashboard = Instagram's profile page (your stuff, settings, management)

---

## TODO When Resuming

1. Add desktop responsive styles (768px+ breakpoint)
2. Implement expanded top header nav for desktop
3. Convert carousels to grids on desktop
4. Test navigation flow between Home and Dashboard
5. Consider context-aware nav (changes when inside a league vs browsing)

---

## Design Principles Discussed

- "What you want is right there" - surface relevant content immediately
- Mobile-first, but desktop should feel native too
- Avoid corporate/enterprise feel (no side nav)
- Keep nav simple - Home does the heavy lifting
- Carousels on mobile, grids on desktop

---

*Last updated: January 21, 2026*
