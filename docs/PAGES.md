# Frontend Pages Inventory

**Last Updated:** 2026-01-18

## Summary

- **Total Pages:** 48 HTML files
- **Location:** `/public/pages/`

---

## Pages by Category

### Admin & Management
| File | Purpose | Status |
|------|---------|--------|
| admin.html | Admin dashboard with PIN auth | Working |
| bot-management.html | Bot player CRUD | Working |
| league-director.html | League director dashboard | Working |
| director-dashboard.html | Tournament director dashboard | Working |
| league-management.html | League settings/config | Working |

### League Pages
| File | Purpose | Status |
|------|---------|--------|
| leagues.html | Browse all leagues | Working |
| league-view.html | Single league details | Working |
| league-standings.html | League standings table | Working |
| league-registration.html | Player registration form | Working |
| league-scoreboard.html | Live match scoreboard | Working |
| create-league.html | League creation form | Working |

### Tournament Pages
| File | Purpose | Status |
|------|---------|--------|
| tournaments.html | Browse all tournaments | Working |
| tournament-view.html | Tournament details | Working |
| tournament-bracket.html | Bracket display | Working |
| bracket.html | General bracket viewer | Working |
| knockout.html | 8-team knockout | Working |
| create-tournament.html | Tournament creation | Working |

### Matchmaker Tournament
| File | Purpose | Status |
|------|---------|--------|
| matchmaker-view.html | Matchmaker overview | Working |
| matchmaker-bracket.html | Matchmaker bracket | Working |
| matchmaker-director.html | Director controls | Working |
| matchmaker-register.html | Player registration | Working |

### Player Pages
| File | Purpose | Status |
|------|---------|--------|
| player-profile.html | Full player profile | Working |
| player-public.html | Public profile view | Working |
| player-lookup.html | Search players | Working |
| player-registration.html | New player registration (PayPal) | Working |
| register.html | Simple registration | Working |
| my-stats.html | Personal stats view | Working |
| members.html | Members directory | Working |

### Team Pages
| File | Purpose | Status |
|------|---------|--------|
| team-profile.html | Team info & roster | Working |
| captain-dashboard.html | Captain management | Working |

### Match & Scoring Pages
| File | Purpose | Status |
|------|---------|--------|
| x01.html | 501 scorer (standalone) | Working |
| cricket.html | Cricket scorer (standalone) | Working |
| league-501.html | League 501 scorer | Working |
| league-cricket.html | League cricket scorer | Working |
| match-hub.html | Match central hub | Working |
| match-night.html | Match night view | Working |
| match-report.html | Post-match report | Working |
| match-confirm.html | Pre-match confirmation | Working |
| match-transition.html | Between-game transition | Working |
| game-setup.html | Game configuration | Working |
| scorer-hub.html | Scorer navigation | Working |
| live-scoreboard.html | Animated live display | Working |

### Messaging & Social
| File | Purpose | Status |
|------|---------|--------|
| messages.html | Messages hub | Working |
| chat-room.html | Group chat interface | Working |
| conversation.html | Direct messages | Working |

### General
| File | Purpose | Status |
|------|---------|--------|
| dashboard.html | Main user dashboard | Working |
| browse-events.html | Browse leagues/tournaments | Working |
| event-view.html | Generic event details | Working |

---

## Key Patterns

### Authentication
- Most pages use PIN-based auth via `playerLogin` or `verifyLeaguePin`
- Admin pages require admin PIN
- Director pages require director PIN

### Data Fetching
- All pages use `callFunction()` helper from firebase-config.js
- Real-time updates via Firestore `onSnapshot()`

### Styling
- Consistent BRDC color scheme:
  - Pink: #FF469A
  - Teal: #91D7EB
  - Yellow: #FDD835
- Shared CSS via `/css/brdc-styles.css`

### PWA Support
- Service worker registered
- manifest.json for installability
- Offline-capable scoring pages
