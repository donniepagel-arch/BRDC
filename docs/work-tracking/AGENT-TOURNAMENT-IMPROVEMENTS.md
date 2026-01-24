# Tournament Improvements - Bracket Editing and Real-time Updates

**Date:** 2026-01-24
**Status:** COMPLETED

## Summary

Implemented bracket editing functionality and real-time listeners across all tournament pages.

---

## 1. Bracket Editing Before Round 1

### Backend Functions Added (`functions/tournaments/brackets.js`)

**swapBracketPositions**
- HTTP endpoint: `POST /swapBracketPositions`
- Swaps two positions in the round 1 bracket
- Validates that bracket is not locked (no matches started)
- Handles BYE updates when swapping teams
- Returns swapped team names for UI feedback

**regenerateBracket**
- HTTP endpoint: `POST /regenerateBracket`
- Reshuffles all teams into random positions
- Clears all rounds except round 1 teams
- Resets winners/losers bracket progress
- Returns new team order for confirmation

**lockBracket**
- HTTP endpoint: `POST /lockBracket`
- Manually locks bracket (called when first match completes)
- Sets `bracket_locked: true` timestamp

### Frontend UI (`public/pages/matchmaker-director.html`)

**Bracket Tab Enhancements:**
- Added connection status indicator (Live/Offline)
- Shows bracket lock status (EDITABLE / LOCKED)
- "EDIT BRACKET" button (visible only when unlocked)
- "REGENERATE" button for complete reshuffle
- Round 1 matchups preview with selectable slots

**Edit Mode:**
- Click two positions to swap them
- Visual feedback with yellow highlight for selected slot
- Confirmation message showing swapped teams
- Cancel button to exit edit mode

**CSS Additions:**
- `.connection-status` - Live/Offline indicator styling
- `.bracket-slot` - Selectable team position styling
- `.bracket-slot.selected` - Yellow highlight for selected position
- `.bracket-match-card` - Preview card styling

---

## 2. Real-time Listeners

### Pages Updated

| Page | Previous | Now | Connection Indicator |
|------|----------|-----|---------------------|
| matchmaker-director.html | Mixed | onSnapshot | Yes (header) |
| matchmaker-bracket.html | getDoc | onSnapshot | Yes (header) |
| matchmaker-view.html | onSnapshot (partial) | onSnapshot (full) | Yes (header) |
| matchmaker-tv.html | onSnapshot | onSnapshot (with error handling) | Yes (floating) |
| tournament-bracket.html | getDoc/getDocs | onSnapshot | Yes (header) |
| tournament-view.html | getDoc/getDocs | onSnapshot | Yes (header) |

### Implementation Pattern

```javascript
// Real-time listener with connection status
unsubscribeListener = onSnapshot(
    docRef,
    (snapshot) => {
        updateConnectionStatus(true);
        // Handle data...
    },
    (error) => {
        console.error('Listener error:', error);
        updateConnectionStatus(false);
    }
);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeListener) unsubscribeListener();
});
```

### Connection Status Indicator Styling

```css
.connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 6px 12px;
    background: rgba(0,0,0,0.3);
    border-radius: 20px;
}
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}
.status-dot.connected { background: #4CAF50; }
.status-dot.disconnected { background: #f44336; animation: statusPulse 1s infinite; }
```

---

## 3. Files Modified

### Backend
- `functions/tournaments/brackets.js` - Added swapBracketPositions, regenerateBracket, lockBracket functions

### Frontend
- `public/pages/matchmaker-director.html` - Bracket editing UI, real-time listener, connection status
- `public/pages/matchmaker-bracket.html` - Real-time listener, connection status
- `public/pages/matchmaker-view.html` - Connection status, improved error handling
- `public/pages/matchmaker-tv.html` - Connection status indicator, error handling
- `public/pages/tournament-bracket.html` - Real-time listeners, connection status
- `public/pages/tournament-view.html` - Real-time listeners, connection status

---

## 4. Testing Notes

### Bracket Editing
1. Navigate to matchmaker-director.html with a tournament that has a generated bracket
2. Go to Bracket tab
3. Should see "EDITABLE" status if no matches have been played
4. Click "EDIT BRACKET" to enter edit mode
5. Click two positions to swap them
6. Click "REGENERATE" to completely reshuffle

### Real-time Updates
1. Open any tournament page in two browser windows
2. Make changes in one (start match, update score, etc.)
3. Verify changes appear instantly in the other window
4. Connection indicator should show "Live" when connected

### Bracket Locking
1. Complete a match in round 1
2. Return to matchmaker-director Bracket tab
3. Should show "LOCKED (matches in progress)"
4. Edit and Regenerate buttons should be hidden

---

## 5. Deployment

**DO NOT DEPLOY** - Coordinator will deploy all changes together.

When ready to deploy:
```bash
# Frontend only
firebase deploy --only hosting

# Backend only (for new cloud functions)
firebase deploy --only functions:swapBracketPositions,functions:regenerateBracket,functions:lockBracket
```

---

## 6. Known Limitations

1. **Bracket swap** only works for round 1 positions (by design)
2. **Lock detection** relies on tournament.bracket_locked field - if first match completes without calling lockBracket, editing may still be possible until next page load
3. **matchmaker-tv.html** connection indicator is floating overlay (TV mode doesn't have normal header)
4. **Registrations in tournament-view.html** still use one-time fetch (since they change infrequently)
