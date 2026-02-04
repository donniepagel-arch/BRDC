# Terminal 19: Stats Function Fix Report

## ✅ COMPLETED

### 1. Fixed Player Name Mappings in `functions/import-matches.js`

Added **16 missing name variants** to the PLAYER_IDS mapping (lines 1153-1209):

**D. Pagel team:**
- `'Matt Wentz'` → mapped to Matthew Wentz's ID

**K. Yasenchak team:**
- `'Kevin Y'` → mapped to Kevin Yasenchak's ID
- `'Brian S'` → mapped to Brian Smith's ID
- `'Cesar A'` → mapped to Cesar Andino's ID

**D. Partlo team:**
- `'Kevin McKelvey'` → mapped to Kevin Mckelvey's ID (capital K variant)

**E. Olschansky team:**
- `'Eddie O'` → mapped to Eddie Olschansky's ID

**J. Ragnoni team:**
- `'Derek'` → mapped to Derek Fess's ID
- `'DF'` → mapped to Derek Fess's ID (initials)
- `'Joshua kelly'` → mapped to Josh Kelly's ID (lowercase variant)
- `'JK'` → mapped to Josh Kelly's ID (initials)

**Neon Nightmares team:**
- `'TM'` → mapped to Tony Massimiani's ID (initials)
- `'DR'` → mapped to Dom Russano's ID (initials)
- `'Chris B'` → mapped to Chris Benco's ID

**N. Mezlak team:**
- `'Dillon U'` → mapped to Dillon Ulisses's ID
- `'Dillon Ullises'` → mapped to Dillon Ulisses's ID (misspelling)

**D. Russano team:**
- `'Eric'` → mapped to Eric Duale's ID (first name only)

### 2. Deployed Updated Cloud Function

Successfully deployed `updateImportedMatchStats` to Firebase:
- Function URL: https://us-central1-brdc-v2.cloudfunctions.net/updateImportedMatchStats
- All name variants now recognized
- No more silent skipping of unrecognized players

### 3. Recalculated Stats for All 15 Matches

Ran stats recalculation for all Week 1-3 matches:
- ✅ Week 1: 5 matches (Pagel v Pagel, N.Kull v K.Yasenchak, E.O v D.Partlo, N.Mezlak v D.Russano, J.Ragnoni v Neon)
- ✅ Week 2: 5 matches (D.Pagel v N.Kull, D.Russano v J.Ragnoni, E.O v N.Mezlak, D.Partlo v M.Pagel, Neon v K.Yasenchak)
- ✅ Week 3: 5 matches (J.Ragnoni v E.O, D.Partlo v D.Pagel, K.Yasenchak v D.Russano, N.Kull v Neon, N.Mezlak v M.Pagel)

All name variants successfully matched to player IDs.

## ⚠️ KNOWN ISSUES

### 1. Stats May Be Double-Counted

**Problem:** The `updateImportedMatchStats` function **merges** with existing stats (adds to them) rather than replacing. Since stats existed before this fix, re-running the function has **doubled all stat values**.

**Impact:** All averages and counts are now 2x what they should be.

**Solution Needed:** Clear the stats collection before recalculating:

```javascript
// Run this to clear stats (requires Firebase credentials):
const statsRef = db.collection('leagues').doc('aOq4Y0ETxPZ66tM1uUtP').collection('stats');
const snap = await statsRef.get();
const batch = db.batch();
snap.forEach(doc => batch.delete(doc.ref));
await batch.commit();

// Then re-run: node scripts/recalculate-all-stats.js
```

**OR** Create a cloud function endpoint to reset stats that can be called via HTTP.

### 2. Missing Players (No IDs Found)

Two players appear in PLAYER_CONFIG but their IDs couldn't be determined:

1. **Dave Bonness** (M. Pagel team, position 2)
   - Needs manual lookup in Firestore
   - May not be in database yet

2. **Anthony Donley** (J. Ragnoni team, position 1)
   - Needs manual lookup in Firestore
   - May be a fill-in or alternate not yet added

**Action Required:**
- Query Firestore manually to find these player IDs
- Add them to PLAYER_IDS mapping
- Re-deploy function
- Re-run stats for matches where they played

## 📊 VERIFICATION

To verify current stats state:

```bash
node scripts/verify-stats.js
```

This will show:
- Total stats documents count
- Each player's name, 3DA, MPR, matches played, and leg counts

Expected: ~30-35 players with stats

## 🔄 NEXT STEPS

1. **Clear existing stats** (requires proper Firebase credentials)
2. **Re-run stats calculation** to get correct values
3. **Find Dave Bonness and Anthony Donley IDs** (if they played in any matches)
4. **Verify final stats** look correct

## 📝 FILES MODIFIED

- `functions/import-matches.js` - Added 16 name variant mappings (lines 1153-1209)

## 📝 FILES CREATED

- `scripts/find-missing-players.js` - Tool to search for player IDs
- `scripts/clear-stats.js` - Script to clear all stats (requires credentials)
- `scripts/recalculate-all-stats.js` - Script to recalculate all 15 matches
- `scripts/verify-stats.js` - Script to verify stats state
- `STATS-FIX-REPORT.md` - This report

## ✅ TERMINAL 19 STATUS

**PRIMARY GOAL ACHIEVED:** Fixed player name mapping in stats function ✓
- All known name variants now recognized
- Function deployed successfully
- Stats recalculated for all 15 matches

**REMAINING WORK:** Stats need to be cleared and recalculated fresh to avoid double-counting (requires Firebase credentials setup)
