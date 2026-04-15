# Session 2026-02-04: Bug Fix Deployment

## Summary

Deployed all 10 user-reported bug fixes to production. These fixes were already completed in previous sessions but had not been deployed.

---

## Deployments Completed

### 1. Functions Deployment
**Time:** 2026-02-04 (timestamp from firebase deploy)
**Command:** `firebase deploy --only functions`
**Status:** ✅ Success
**Functions Updated:** All 140+ cloud functions

**Key Functions for Bug Fixes:**
- `getPlayerStatsFiltered` (Bug 8 - Social stats on player-profile)
- `adminGetPlayers` (Bug 7 - Admin player filters)

### 2. Hosting Deployment
**Time:** 2026-02-04
**Command:** `firebase deploy --only hosting`
**Status:** ✅ Success
**Files:** 122 files uploaded
**URL:** https://brdc-v2.web.app

---

## Bugs Fixed and Deployed

| # | Bug | File(s) | Impact |
|---|-----|---------|--------|
| 1 | Enter button pushed off screen | x01-scorer.html | Safari 768x634 viewport |
| 2 | Score pad missing in doubles vs bots | x01-scorer.html | Bot doubles games |
| 3 | Single odd number allowed on double out | x01-scorer.html | 501 double-out validation |
| 4 | "can't find variable: outRule" error | x01-scorer.html | Casual game completion |
| 5 | Calculations not working properly | x01-scorer.html | Match avg double-counting |
| 6 | Trapped on login screen | messages.html, chat-room.html, conversation.html | Already logged in users |
| 7 | Admin needs tabs, player filters, bot visibility | admin.html, admin-functions.js | Admin player management |
| 8 | Social stats not showing | functions/index.js (getPlayerStatsFiltered) | Player profile social tab |
| 9 | Cork choice per-leg options missing | game-setup.html | Mixed format game setup |
| 10 | Play Knockout button needs pulse animation | game-setup.html | Knockout toggle visibility |

---

## Testing Checklist

### 🔲 Bug 1: Enter Button Visibility
- [ ] Open https://brdc-v2.web.app/pages/x01-scorer.html
- [ ] Set viewport to 768x634 (Safari or responsive mode)
- [ ] Play game to checkout range (e.g., 40 remaining)
- [ ] Verify ENTER button visible below suggestions
- [ ] Verify button not pushed off screen

**Expected:** ENTER button visible with suggestions in scrollable container

---

### 🔲 Bug 2: Score Pad in Doubles vs Bots
- [ ] Go to game-setup.html
- [ ] Set Singles/Doubles: Doubles
- [ ] Add real player to Team 1
- [ ] Add BOT to Team 2 Position 2
- [ ] Start game
- [ ] Verify score pad appears for both players

**Expected:** Score pad displays for all players including bot teammate

---

### 🔲 Bug 3: Odd Number Bust on Double Out
- [ ] Start 501 game with DOUBLE OUT enabled
- [ ] Play down to 3 remaining (odd number)
- [ ] Enter any score (e.g., T20)
- [ ] Verify BUST displayed (can't check out odd number)

**Expected:** Odd remaining scores should bust on double-out

---

### 🔲 Bug 4: No "outRule" Error
- [ ] Start casual 501 game
- [ ] Complete the game (checkout)
- [ ] Verify no JavaScript errors in console
- [ ] Verify game saves successfully
- [ ] Go to dashboard → RESUME button
- [ ] Verify resume works without errors

**Expected:** No "can't find variable: outRule" error

---

### 🔲 Bug 5: Match Average Calculation
- [ ] Start multi-leg match
- [ ] Complete leg 1
- [ ] Start leg 2
- [ ] During leg 2, check "Match Avg" display
- [ ] Verify average is correct (not double-counted)

**Expected:** Match average = (leg1_points + leg2_points) / (leg1_darts + leg2_darts)

---

### 🔲 Bug 6: Messages Auto-Login
- [ ] Login to dashboard.html with PIN
- [ ] Open browser DevTools → Console
- [ ] Run: `localStorage.getItem('brdc_player_pin')`
- [ ] Verify PIN is stored
- [ ] Navigate to messages.html
- [ ] Verify page loads directly (no login screen)

**Alternative test:**
- [ ] Clear `brdc_player_pin` from localStorage
- [ ] Go to messages.html
- [ ] Verify login prompt appears
- [ ] Enter PIN
- [ ] Verify messages load

**Expected:** No stuck login loop when already authenticated

---

### 🔲 Bug 7: Admin Player Management
- [ ] Login to admin.html
- [ ] Go to Players tab
- [ ] Verify tabs appear (Players, Leagues, Tournaments, etc.)
- [ ] Verify "Sort by" dropdown works
- [ ] Look for bot players (should have "BOT" badge)
- [ ] Verify bot players visible in list

**Expected:** Tabbed interface, sortable, bots visible with badges

---

### 🔲 Bug 8: Player Profile Social Stats
**Setup:** Need a player with casual games played

- [ ] Login as player who has played casual games
- [ ] Go to player profile page
- [ ] Click SOCIAL button/tab
- [ ] Verify stats appear (not dashes)
- [ ] Check: 3DA, MPR, Win %, Games Played

**Alternative:** Use test player ID if available

**Expected:** Social stats show actual values (e.g., "48.2" not "-")

---

### 🔲 Bug 9: Cork Choice Per-Leg Options
- [ ] Go to game-setup.html
- [ ] Set Format: Mixed
- [ ] Click "Edit Legs" or view leg builder
- [ ] Set a leg to format: "Corks Choice"
- [ ] Verify dropdown appears: "Cork Winner Gets"
- [ ] Options: "Pick Game Only" | "Pick Game & Start"

**Expected:** Cork winner dropdown appears inline when leg set to Corks Choice

---

### 🔲 Bug 10: Knockout Pulse Animation
- [ ] Go to game-setup.html
- [ ] Scroll to "Play Knockout?" toggle section
- [ ] Verify section has subtle pulsing pink glow animation

**Expected:** Knockout section has attention-grabbing animation

---

## Verification Method

**Primary testing:** Manual testing on live site https://brdc-v2.web.app

**Test accounts:**
- Use existing test PINs from previous sessions
- Test league: `aOq4Y0ETxPZ66tM1uUtP`
- Test match: `sgmoL4GyVUYP67aOS7wm`

**Browsers:**
- Chrome (primary)
- Safari (for Bug 1 viewport test)
- Firefox (optional)

**Devices:**
- Desktop (primary)
- Mobile (768x634 viewport for Bug 1)

---

## Post-Testing Actions

### If All Tests Pass:
1. Update `docs/work-tracking/FEEDBACK-REPORT.md`
   - Mark all 10 bugs as "Fixed" status
2. Update Firestore `/feedback` collection
   - Set status: "resolved" for these entries
   - Add resolution_date
3. Consider notifying users who reported the bugs (if contact info available)

### If Any Tests Fail:
1. Document which test failed
2. Check browser console for errors
3. Compare with local version (should match since code is deployed)
4. Investigate discrepancies
5. Create new bug ticket if needed

---

## Notes

### Warnings During Deployment
- Node.js 20 will be deprecated on 2026-04-30 → Need to upgrade before then
- firebase-functions SDK 4.9.0 → Should upgrade to latest (5.1.0+)
- functions.config() deprecated → Migrate to params package before March 2026
- `:functionName` endpoint warning → Non-critical, doesn't affect deployed fixes

### Cache Invalidation
Users may need to hard refresh (Ctrl+Shift+R) to see changes due to browser caching.

---

## Success Criteria

✅ All 10 bugs verified as fixed on production
✅ No new bugs introduced
✅ All pages load without errors
✅ User experience improved

---

## Related Documents

- `BUGFIX-VERIFICATION-COMPLETE.md` - Line-by-line code verification
- `TERMINAL-PROMPT-BUGFIXES.md` - Original fix instructions
- `FEEDBACK-REPORT.md` - User bug reports (source)
- `SESSION-2026-01-22.md` - Session when most fixes were implemented

---

## Deployment Commands Reference

```bash
# Functions only
firebase deploy --only functions

# Hosting only
firebase deploy --only hosting

# Everything
firebase deploy

# Specific function
firebase deploy --only functions:functionName
```
