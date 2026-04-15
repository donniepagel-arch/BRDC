# Terminal Prompt: Fix All 10 User-Reported Bugs

**Working directory:** C:\Users\gcfrp\projects\brdc-firebase

**Permissions:** Read all, Write all, Bash (npm, node, git, firebase)

---

## Task: Fix all 10 user-reported bugs across 6 files

You will fix each bug sequentially, one at a time. Read each file before editing. Test your understanding of the code before making changes. Deploy at the end when ALL fixes are complete.

IMPORTANT: All "league-501" bugs are actually in x01-scorer.html (there is no league-501.html file — it was deleted). The single X01 scorer is used for all 501/301/701 games including league matches.

---

## BUG 1: x01-scorer — Enter button pushed off screen by checkout suggestions
**File:** `public/pages/x01-scorer.html`
**Report:** On Safari 768x634, when Quick Outs appear, the ENTER button gets clipped below the viewport.

**Root Cause:** The `.input-section` has `overflow: hidden`. At 634px viewport height, header + score display + keypad + action row barely fits. The quick-out-container (absolute positioned, z-index 10) renders at top:60px inside `.keypad-area`. The `@media (max-height: 600px)` hides quick outs, but 634px is above that threshold so they still show and the action row overflows past the hidden boundary.

**Fixes (CSS only — do NOT touch JS for this bug):**

1. Find `.keypad-area` CSS (around line 272-279). Ensure it has `display: flex;` and `flex-direction: column;`. If these already exist, leave them. If not, add them.

2. Find `.action-row` CSS (around line 417-422). ADD these properties (keep all existing ones):
   ```css
   margin-top: auto;
   flex-shrink: 0;
   z-index: 20;
   background: var(--bg-panel, #1a1a2e);
   ```

3. Find the `@media (max-height: 600px)` block that hides `.quick-out-container` (around line 1094-1100). Change `600px` to `680px`:
   ```css
   @media (max-height: 680px) {
       .quick-out-container {
           display: none !important;
       }
   }
   ```

4. Find the `@media (max-height: 700px)` block (around line 1050-1072). Add inside it:
   ```css
   .quick-out-container {
       max-height: 100px;
       padding: 8px;
       top: 50px;
   }
   .quick-out-btn {
       padding: 6px 10px;
       font-size: 14px;
   }
   ```

---

## BUG 2: x01-scorer — Score pad missing in doubles vs bots
**File:** `public/pages/x01-scorer.html`
**Report:** Playing doubles against bots, the score pad didn't show up after starting the game.

**Root Cause:** `isAwayBot()` and `isHomeBot()` only check `players[0]` — the first player. In doubles (2 per side), the bot could be the second player. Also `isCurrentTeamBot()` checks if ANY player is a bot but doesn't check which player is currently active in the rotation.

**Fixes:**

1. Find `isAwayBot()` (around line 1786-1789). Change from:
   ```javascript
   function isAwayBot() {
       return (practiceMode && awayPlayers[0]?.is_bot) || awayPlayers[0]?.isBot;
   }
   ```
   To:
   ```javascript
   function isAwayBot() {
       return awayPlayers.some(p => p?.isBot || p?.is_bot) ||
              (practiceMode && awayPlayers.some(p => p?.is_bot));
   }
   ```

2. Find `isHomeBot()` (around line 1792). Change from:
   ```javascript
   function isHomeBot() {
       return homePlayers[0]?.isBot;
   }
   ```
   To:
   ```javascript
   function isHomeBot() {
       return homePlayers.some(p => p?.isBot || p?.is_bot);
   }
   ```

3. Find `isCurrentTeamBot()` (around line 1797). Change to check the CURRENT active player:
   ```javascript
   function isCurrentTeamBot() {
       const players = activeTeam === 0 ? homePlayers : awayPlayers;
       const idx = activePlayerIndex ? activePlayerIndex[activeTeam] : 0;
       const player = players[idx];
       return player?.isBot || player?.is_bot || false;
   }
   ```

4. Find `botPlay()` (around line 1941-1965). Wrap the function body in try/finally to prevent the `botPlaying` flag from getting stuck:
   ```javascript
   function botPlay() {
       if (botPlaying) return;
       botPlaying = true;
       try {
           // ... keep ALL existing botPlay logic exactly as-is ...
       } catch (error) {
           console.error('Bot play error:', error);
       } finally {
           botPlaying = false;
       }
   }
   ```
   Keep all existing internal logic. Just wrap it.

---

## BUG 3: x01-scorer — Single odd number out allowed on double out
**File:** `public/pages/x01-scorer.html`
**Report:** The scorer allowed finishing on an odd number when double-out was the rule.

**Root Cause:** The bust check (around line 3124) only checks `newScore < 0 || newScore === 1`. It doesn't catch odd remaining scores > 1, which are impossible to finish with a double.

**Fix:** Find the bust check in `submitScore()` (around line 3124):
```javascript
if (newScore < 0 || newScore === 1) {
```
Change to:
```javascript
if (newScore < 0 || newScore === 1 || (checkout === 'double' && newScore > 1 && newScore % 2 !== 0 && newScore !== 50)) {
```
Explanation: With double-out, any odd remaining > 1 is a bust (no double equals an odd number). Exception: 50 is valid (D-Bull = 50). Do NOT apply this for `checkout === 'master'` (master out allows triples which can be odd).

---

## BUG 4: x01-scorer — "can't find variable: outRule" error + undefined vars
**File:** `public/pages/x01-scorer.html`
**Report:** Error when saving casual game. `outRule` doesn't exist — the correct variable is `checkout` (declared around line 1726).

**Fixes:**

1. Find `saveCasualGame()` (around line 4666+). Look for `outRule` in the `match_config` object (around line 4794):
   ```javascript
   doubleOut: outRule === 'double',
   ```
   Change to:
   ```javascript
   doubleOut: checkout === 'double',
   ```

2. Find `exitGame()` (around line 5170+). Look for `outRule` in `resumeState` (around line 5184):
   ```javascript
   outRule: outRule,
   ```
   Change to:
   ```javascript
   outRule: checkout,
   ```

3. In the same `exitGame()`, fix other undefined variables (around lines 5201-5203):
   - `currentLeg: currentLeg,` → `currentLeg: leg,`
   - `legsToWin: legsToWin,` → `legsToWin: LEGS_TO_WIN,`
   - `setsToWin: setsToWin,` → `setsToWin: 1,`

4. Wire up the dead `completeCheckoutQuick` and `cancelGameShot` functions. Find the area near `confirmCheckout` definition (around line 3291). Add after it:
   ```javascript
   window.completeCheckoutQuick = function(darts) {
       const gameShotEl = document.getElementById('gameShotSelect');
       if (gameShotEl) gameShotEl.classList.remove('active');
       if (pendingCheckout) {
           completeCheckout(pendingCheckout.score, darts);
           pendingCheckout = null;
       }
   };

   window.cancelGameShot = function() {
       const gameShotEl = document.getElementById('gameShotSelect');
       if (gameShotEl) gameShotEl.classList.remove('active');
       pendingCheckout = null;
   };
   ```

---

## BUG 5: x01-scorer — Match average calculation double-counting
**File:** `public/pages/x01-scorer.html`
**Report:** Calculations not working properly.

**Root Cause:** In `updateUI()` (around line 3659-3680), the match average sums `teams[].darts` + `currentLegStats[].darts`. But `teams[].darts` is ALREADY incremented during each throw in the current leg (line ~3167: `team.darts += 3`). So current-leg darts/points are counted twice.

**Fix:** First VERIFY by reading line ~3167 that `team.darts += 3` happens per-throw during the current leg. If confirmed, find the match average calculation (around line 3669-3675):
```javascript
const homeMatchDarts = teams[0].darts + homeLegDarts;
const awayMatchDarts = teams[1].darts + awayLegDarts;
const homeMatchPoints = teams[0].points + homeLegPoints;
const awayMatchPoints = teams[1].points + awayLegPoints;
```
Change to:
```javascript
const homeMatchDarts = teams[0].darts;
const awayMatchDarts = teams[1].darts;
const homeMatchPoints = teams[0].points;
const awayMatchPoints = teams[1].points;
```

If `teams[].darts` is NOT incremented per-throw (only on leg completion), then the existing code is correct — leave it and add a comment explaining you investigated.

---

## BUG 6: messages — Trapped on login screen when already logged in
**Files:** `public/pages/messages.html`, `public/pages/chat-room.html`, `public/pages/conversation.html`

**Root Cause:** These pages only check `brdc_player_pin` in localStorage. Dashboard stores session in `brdc_session` (JSON with `pin` field). If `brdc_player_pin` was never set or was cleared, the user sees a login screen despite being logged in via dashboard.

**Fix for messages.html:**
Find the DOMContentLoaded handler (around line 1291-1326). Find where it reads `brdc_player_pin`:
```javascript
const storedPin = safeStorage.getItem('brdc_player_pin');
```
Change `const` to `let` and add a fallback block AFTER it:
```javascript
let storedPin = safeStorage.getItem('brdc_player_pin');

// Fallback: check brdc_session (set by dashboard login)
if (!storedPin) {
    try {
        const savedSession = safeStorage.getItem('brdc_session') || localStorage.getItem('brdc_session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session && session.pin) {
                storedPin = session.pin.toUpperCase();
                safeStorage.setItem('brdc_player_pin', storedPin);
            }
        }
    } catch (e) {
        console.warn('Session fallback failed:', e);
    }
}
```

Also find the catch block (around line 1319) that removes `brdc_player_pin` on error. Change to only remove on definitive auth failures:
```javascript
if (error?.code === 'not-found' || error?.message?.includes('Invalid') || error?.message?.includes('not found')) {
    safeStorage.removeItem('brdc_player_pin');
}
```

**Fix for chat-room.html:**
Find where it reads `brdc_player_pin` (around line 1539-1543):
```javascript
playerPin = localStorage.getItem('brdc_player_pin');
if (!playerPin) {
    window.location.href = '/pages/messages.html';
    return;
}
```
Change to:
```javascript
playerPin = localStorage.getItem('brdc_player_pin');

if (!playerPin) {
    try {
        const savedSession = localStorage.getItem('brdc_session');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            if (session && session.pin) {
                playerPin = session.pin.toUpperCase();
                localStorage.setItem('brdc_player_pin', playerPin);
            }
        }
    } catch (e) {
        console.warn('Session fallback failed:', e);
    }
}

if (!playerPin) {
    window.location.href = '/pages/messages.html';
    return;
}
```

**Fix for conversation.html:**
Apply the exact same fallback pattern — find the `brdc_player_pin` read (around line 232) and add the `brdc_session` fallback before the redirect check. Same code as chat-room.html fix.

---

## BUG 7: admin — Player list needs sort, filters, bot cleanup
**Files:** `public/pages/admin.html`, `functions/admin-functions.js`

### Backend fix (functions/admin-functions.js):
Find `adminGetPlayers` (around line 272-315).

1. REMOVE the bot skip line (around line 297):
   ```javascript
   if (data.isBot === true) return;  // DELETE THIS LINE
   ```

2. ADD `is_bot` and `has_contact` to the returned player object:
   ```javascript
   players.push({
       id: doc.id,
       name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
       email: data.email,
       phone: data.phone,
       pin: data.pin,
       games_played: data.games_played || 0,
       created_at: data.created_at,
       is_bot: data.isBot === true,
       has_contact: !!(data.email || data.phone)
   });
   ```

### Frontend fix (public/pages/admin.html):

1. **Add Sort dropdown** — Find the Players tab filter bar (around line 894-917). After the existing filter `<select>` closing tag and before the Clear button, add:
   ```html
   <div class="filter-group">
       <span class="filter-label">Sort:</span>
       <select class="filter-select" id="playerSortBy" onchange="filterPlayers()">
           <option value="name-asc">Name A-Z</option>
           <option value="name-desc">Name Z-A</option>
           <option value="games-desc">Most Games</option>
           <option value="games-asc">Least Games</option>
           <option value="date-desc">Newest</option>
           <option value="date-asc">Oldest</option>
       </select>
   </div>
   ```

2. **Add filter options** — In the existing filter dropdown (id="playerFilter", around line 903-908), add after the existing options:
   ```html
   <option value="is-bot">Bots Only</option>
   <option value="no-bot">Real Players Only</option>
   <option value="has-contact">Has Contact Info</option>
   <option value="no-contact">No Contact Info</option>
   ```

3. **Update `filterPlayers()` function** (around line 2022-2055). After the existing `recent` filter case, add:
   ```javascript
   } else if (filter === 'is-bot') {
       filtered = filtered.filter(p => p.is_bot === true);
   } else if (filter === 'no-bot') {
       filtered = filtered.filter(p => p.is_bot !== true);
   } else if (filter === 'has-contact') {
       filtered = filtered.filter(p => p.email || p.phone);
   } else if (filter === 'no-contact') {
       filtered = filtered.filter(p => !p.email && !p.phone);
   }
   ```

   Then add sorting AFTER all filtering, BEFORE `renderPlayersList(filtered)`:
   ```javascript
   const sortBy = document.getElementById('playerSortBy')?.value || 'name-asc';
   if (sortBy === 'name-asc') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
   else if (sortBy === 'name-desc') filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
   else if (sortBy === 'games-desc') filtered.sort((a, b) => (b.games_played || 0) - (a.games_played || 0));
   else if (sortBy === 'games-asc') filtered.sort((a, b) => (a.games_played || 0) - (b.games_played || 0));
   else if (sortBy === 'date-desc') filtered.sort((a, b) => (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0));
   else if (sortBy === 'date-asc') filtered.sort((a, b) => (a.created_at?._seconds || 0) - (b.created_at?._seconds || 0));
   ```

4. **Add BOT badge** — In `renderPlayersList()` (around line 2065-2105), find where the player name `<h3>` is rendered. Immediately after the name text, add:
   ```javascript
   ${p.is_bot ? '<span style="display:inline-block;background:#fdd835;color:#000;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;">BOT</span>' : ''}
   ```

5. **Update `clearPlayerFilters()`** — Add:
   ```javascript
   if (document.getElementById('playerSortBy')) document.getElementById('playerSortBy').value = 'name-asc';
   ```

---

## BUG 8: player-profile — Social/casual stats not showing
**File:** `functions/index.js`

**Root Cause:** `getPlayerStatsFiltered` has stubs for `social` and `tournament` cases. Casual game stats ARE saved to `/players/{playerId}/pickup_stats/aggregate` by `savePickupGame` in `functions/pickup-games.js`, but the cloud function never reads them.

### Fix:
Find `getPlayerStatsFiltered` in `functions/index.js` (around line 1479+). Find the switch/case block (around line 1639).

**FIRST: Read `functions/pickup-games.js`** to verify the exact field names used in `pickup_stats/aggregate`. Look at `updatePickupPlayerStats()`. Adapt the field name mapping below if needed.

**Replace the `case 'social'` stub** (around line 1657-1661) with:
```javascript
case 'social':
    try {
        const pickupStatsDoc = await db.collection('players').doc(playerId)
            .collection('pickup_stats').doc('aggregate').get();
        if (pickupStatsDoc.exists) {
            const ps = pickupStatsDoc.data();
            stats.x01_games_played = ps.x01_legs_played || 0;
            stats.x01_games_won = ps.x01_legs_won || 0;
            stats.x01_darts = ps.x01_total_darts || 0;
            stats.x01_points = ps.x01_total_points || 0;
            stats.x01_three_dart_avg = ps.x01_total_darts > 0
                ? parseFloat(((ps.x01_total_points || 0) / ps.x01_total_darts * 3).toFixed(2)) : 0;
            stats.x01_first_nine_avg = ps.x01_first_nine_darts > 0
                ? parseFloat(((ps.x01_first_nine_points || 0) / ps.x01_first_nine_darts * 3).toFixed(2)) : 0;
            stats.x01_tons_100 = ps.x01_ton_00 || 0;
            stats.x01_tons_120 = ps.x01_ton_20 || 0;
            stats.x01_tons_140 = ps.x01_ton_40 || 0;
            stats.x01_tons_160 = ps.x01_ton_60 || 0;
            stats.x01_tons_180 = ps.x01_ton_80 || 0;
            stats.x01_checkouts = ps.x01_checkouts_hit || 0;
            stats.x01_checkout_opps = ps.x01_checkout_attempts || 0;
            stats.x01_checkout_pct = ps.x01_checkout_attempts > 0
                ? parseFloat(((ps.x01_checkouts_hit || 0) / ps.x01_checkout_attempts * 100).toFixed(1)) : 0;
            stats.x01_high_checkout = ps.x01_highest_checkout || 0;
            stats.cricket_games_played = ps.cricket_legs_played || 0;
            stats.cricket_games_won = ps.cricket_legs_won || 0;
            stats.cricket_mpr = ps.cricket_total_darts > 0
                ? parseFloat(((ps.cricket_total_marks || 0) / (ps.cricket_total_darts / 3)).toFixed(2)) : 0;
            stats.cricket_total_marks = ps.cricket_total_marks || 0;
            stats.cricket_total_darts = ps.cricket_total_darts || 0;
            stats.games_played = (ps.x01_legs_played || 0) + (ps.cricket_legs_played || 0);
            stats.games_won = (ps.x01_legs_won || 0) + (ps.cricket_legs_won || 0);
        }
        stats.source = 'social';
    } catch (error) {
        console.error('Error loading social stats:', error);
        stats.source = 'social';
    }
    break;
```

**Update the `case 'combined'` block** (around line 1663-1726). After the league stats aggregation loop ends, add this block to include pickup stats in combined totals:
```javascript
// Include social/pickup stats in combined
try {
    const pickupDoc = await db.collection('players').doc(playerId)
        .collection('pickup_stats').doc('aggregate').get();
    if (pickupDoc.exists) {
        const ps = pickupDoc.data();
        stats.x01_darts = (stats.x01_darts || 0) + (ps.x01_total_darts || 0);
        stats.x01_points = (stats.x01_points || 0) + (ps.x01_total_points || 0);
        stats.x01_games_played = (stats.x01_games_played || 0) + (ps.x01_legs_played || 0);
        stats.x01_games_won = (stats.x01_games_won || 0) + (ps.x01_legs_won || 0);
        stats.x01_tons_100 = (stats.x01_tons_100 || 0) + (ps.x01_ton_00 || 0);
        stats.x01_tons_120 = (stats.x01_tons_120 || 0) + (ps.x01_ton_20 || 0);
        stats.x01_tons_140 = (stats.x01_tons_140 || 0) + (ps.x01_ton_40 || 0);
        stats.x01_tons_160 = (stats.x01_tons_160 || 0) + (ps.x01_ton_60 || 0);
        stats.x01_tons_180 = (stats.x01_tons_180 || 0) + (ps.x01_ton_80 || 0);
        stats.x01_checkouts = (stats.x01_checkouts || 0) + (ps.x01_checkouts_hit || 0);
        stats.x01_checkout_opps = (stats.x01_checkout_opps || 0) + (ps.x01_checkout_attempts || 0);
        stats.cricket_games_played = (stats.cricket_games_played || 0) + (ps.cricket_legs_played || 0);
        stats.cricket_games_won = (stats.cricket_games_won || 0) + (ps.cricket_legs_won || 0);
        stats.cricket_total_marks = (stats.cricket_total_marks || 0) + (ps.cricket_total_marks || 0);
        stats.cricket_total_darts = (stats.cricket_total_darts || 0) + (ps.cricket_total_darts || 0);
        // Recalculate combined averages
        if (stats.x01_darts > 0) stats.x01_three_dart_avg = parseFloat((stats.x01_points / stats.x01_darts * 3).toFixed(2));
        if (stats.cricket_total_darts > 0) stats.cricket_mpr = parseFloat((stats.cricket_total_marks / (stats.cricket_total_darts / 3)).toFixed(2));
        if ((stats.x01_checkout_opps || 0) > 0) stats.x01_checkout_pct = parseFloat((stats.x01_checkouts / stats.x01_checkout_opps * 100).toFixed(1));
    }
} catch (error) {
    console.error('Error adding pickup stats to combined:', error);
}
```

---

## BUG 9: game-setup — Cork choice per-leg options in mixed format builder
**File:** `public/pages/game-setup.html`
**Report:** When a leg in mixed format is set to "Corks Choice", no per-leg cork-winner dropdown appears.

**Root Cause:** `renderMixedConfig()` (around line 2163-2211) generates per-leg rows but doesn't handle corks_choice with an inline dropdown. The global `corkWinnerRow` is hidden in mixed mode.

**Fixes:**

1. Find `renderMixedConfig()` (around line 2163-2211). Inside the HTML template for each leg row, after the game type `<select>` closing tag, add a conditional cork-winner dropdown:
   ```javascript
   ${leg.type === 'corks_choice' ? `
       <select class="config-select" style="width:auto;min-width:140px;margin-left:8px;font-size:11px;"
               onchange="updateMixedLegCorkWinner(${idx}, this.value)">
           <option value="choose-and-start" ${(leg.cork_winner || 'choose-and-start') === 'choose-and-start' ? 'selected' : ''}>Choose & Start</option>
           <option value="choose-only" ${leg.cork_winner === 'choose-only' ? 'selected' : ''}>Choose Only</option>
           <option value="choose-or-start" ${leg.cork_winner === 'choose-or-start' ? 'selected' : ''}>Choose OR Start</option>
       </select>
   ` : ''}
   ```

2. Add the handler near `updateMixedLeg()` (around line 2215):
   ```javascript
   function updateMixedLegCorkWinner(legIndex, value) {
       if (mixedLegs && mixedLegs[legIndex]) {
           mixedLegs[legIndex].cork_winner = value;
       }
   }
   ```

3. In `updateMixedLeg()`, when type changes to `corks_choice`, set a default and re-render. Add at the top of the function body:
   ```javascript
   if (type === 'corks_choice') {
       mixedLegs[legIndex].cork_winner = mixedLegs[legIndex].cork_winner || 'choose-and-start';
   }
   ```
   Then ensure `renderMixedConfig()` is called after the update to refresh the display.

---

## BUG 10: game-setup — Play Knockout button needs pulse animation
**File:** `public/pages/game-setup.html`
**Report:** The Play Knockout toggle could be overlooked. Needs a pulse to stand out.

**Root Cause:** `.knockout-toggle-section` (around line 1101-1107) has static styling. The `pulse-glow` keyframe already exists in this file (around line 867-870).

**Fix:** Find `.knockout-toggle-section` CSS:
```css
.knockout-toggle-section {
    background: linear-gradient(135deg, rgba(255,70,154,0.15) 0%, rgba(145,215,235,0.15) 100%);
    border: 3px solid var(--pink);
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 15px;
    box-shadow: 0 0 20px rgba(255,70,154,0.2);
}
```
Add one line:
```css
    animation: pulse-glow 2s ease-in-out infinite;
```

---

## DEPLOYMENT

After ALL 10 bugs are fixed:

1. Deploy functions first (Bugs 7 and 8 changed backend):
   ```bash
   firebase deploy --only functions
   ```
   Wait for this to complete successfully.

2. Then deploy hosting (all frontend changes):
   ```bash
   firebase deploy --only hosting
   ```

3. After both deployments succeed, list what was changed in each file and any issues encountered.

## Files Modified Summary
- `public/pages/x01-scorer.html` — Bugs 1-5 (CSS + JS)
- `public/pages/messages.html` — Bug 6 (session fallback)
- `public/pages/chat-room.html` — Bug 6 (session fallback)
- `public/pages/conversation.html` — Bug 6 (session fallback)
- `public/pages/admin.html` — Bug 7 (sort, filters, bot badge)
- `functions/admin-functions.js` — Bug 7 (include bots + new fields)
- `functions/index.js` — Bug 8 (social + combined stats)
- `public/pages/game-setup.html` — Bugs 9-10 (cork choice + pulse)

## Test Data
- League ID: aOq4Y0ETxPZ66tM1uUtP
- Match ID: sgmoL4GyVUYP67aOS7wm
