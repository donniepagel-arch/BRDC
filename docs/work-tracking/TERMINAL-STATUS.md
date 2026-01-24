# Terminal Status Board
**Last Updated:** 2026-01-21

Quick reference for what each terminal is doing. Update this when tasks change.

---

## Active Terminals

| # | Role | Current Task | Status |
|---|------|--------------|--------|
| T1 | Command | Strategy & prompts | ACTIVE |
| T2 | Worker | Chat System Phase 1 | PENDING |
| T3 | Worker | Security Fix (PINs) | PENDING |
| T4 | Worker | Members Page | PENDING |
| T5 | Worker | Match Report Page | PENDING |
| T6 | Worker | Functions Cleanup | COMPLETED |

---

## File Ownership (Avoid Conflicts)

| File | Owner | What They're Doing |
|------|-------|-------------------|
| scorer-hub.html | T2 | Adding Mini Tournament link |
| nav-menu.js | T2 | Adding Matchmaker link |
| dashboard.html (quick links) | T2 | Adding Online Play link |
| dashboard.html (URLs) | T3 | Fixing league_id params |
| dashboard.html (loading) | T4 | Adding skeletons |
| league-view.html (URLs) | T3 | Fixing params |
| league-view.html (loading) | T4 | Adding skeletons |
| match-hub.html | T3+T4 | URLs and skeletons |
| public/pages/*.html (console.log) | T5 | Removing debug logs |
| public/js/*.js (console.log) | T5 | Removing debug logs |

---

## Completed Tasks Queue

When a terminal finishes, move their task here and assign next task.

### Ready for Assignment:
1. Cork's Choice implementation
2. Offline score queue (IndexedDB)
3. Match completion screen
4. Streaming feature decision
5. Members page linking
6. Match report linking

---

## Deploy Commands

```bash
# Frontend only
firebase deploy --only hosting

# Functions only
firebase deploy --only functions

# Everything
firebase deploy
```
