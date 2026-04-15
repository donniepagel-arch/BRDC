# League-View Module Split - Status Report

## Completed Modules (3/9)

### ✅ helpers.js
- isRegistrationClosed()
- showError()
- getOrdinal()
- formatGameType()
- formatLeagueName()
- getTeamRecord()
- getTeamName()
- getPlayerName()

### ✅ schedule.js  
- renderSchedule()
- reloadScheduleView()
- loadAllMatchCards()
- loadLeagueMatchCard()
- loadByeCard()

### ✅ standings.js
- initStandings()
- renderStandingsTable()
- sortTeams()
- getTeamPlayers()
- renderByTeamView()
- renderTeamRow()
- toggleTeamExpand()
- toggleExpandAll()
- sortStandingsColumn()

## Remaining Modules (6/9) - NEED EXTRACTION

### ⏳ stats.js - ~600 lines
Functions needed:
- initStats()
- renderStatsTab()
- getPlayerStatValues()
- formatStatValue()
- renderStatsPlayerView()
- renderStatsTeamView()
- setStatsView()
- setStatsLevel()
- setStatsCategory()
- setStatsPage()
- changeStatsPage()
- sortStats()
- toggleStatsTeam()

Lines: 4327-4850 approximately
Includes STATS_CATEGORIES constant

### ⏳ rules.js - ~400 lines
Functions needed:
- renderRules()
- renderRoundsDetail() (nested)
- getGameShortName() (nested)
- renderTiebreakers() (nested)

Lines: 4850-5250 approximately

### ⏳ registration.js - ~800 lines
Functions needed:
- renderRegistrationTab()
- renderSubSignupForm()
- renderFillinForm()
- renderSignupsList()
- renderRegistrationForm()
- getLevelRanges()
- showSuccess()
- openModal()
- closeModal()
- selectPayment()
- lookupPin()
- submitRegistration()
- lookupSubPin()
- submitSubSignup()
- lookupFillinPin()
- handleFillinPhotoChange()
- handleRegPhotoChange()
- submitFillin()
- openSubSignupModal()
- openFillinModal()

Lines: 5250-6050 approximately

### ⏳ live.js - ~200 lines  
Functions needed:
- renderLive()
- renderFillins()
- expandMatch()

Lines: 5050-5250 approximately

### ⏳ match-night.js - ~200 lines
Functions needed:
- checkMatchNightForLeague()
- showMatchNightBanner()
- confirmAvailability()
- calculateStandings()
- showDirectorLogin()
- verifyDirectorPin()

Lines: 6100-6300 approximately

### ⏳ app.js - NEEDS COMPLETION
Must add:
- Imports from all 6 remaining modules
- Window exposure for ALL onclick functions (see list below)

## Window Functions Requiring Exposure

From HTML onclick handlers, these MUST be exposed on window in app.js:

```javascript
// Already exposed in app.js:
window.switchTab
window.goToMembers
window.changeWeek
window.changeTeamFilter
window.viewTeam
window.viewPlayer  
window.viewMatch
window.confirmAvailability

// Need to add from standings.js:
window.toggleTeamExpand
window.toggleExpandAll
window.sortStandings

// Need to add from stats.js:
window.setStatsView
window.setStatsLevel
window.setStatsCategory
window.setStatsPage
window.changeStatsPage
window.sortStats
window.toggleStatsTeam

// Need to add from live.js:
window.expandMatch

// Need to add from match-night.js:
window.showDirectorLogin
window.verifyDirectorPin

// Need to add from registration.js:
window.openFillinModal
window.openSubSignupModal
window.lookupSubPin
window.submitSubSignup
window.lookupFillinPin
window.handleFillinPhotoChange
window.handleRegPhotoChange
window.submitFillin
window.openModal
window.closeModal
window.selectPayment
window.lookupPin
window.submitRegistration
```

## Final Step: Update league-view.html

Replace lines 3030-6463 (entire script block) with:
```html
<script type="module" src="/js/league-view/app.js"></script>
```

Keep these non-module scripts (if they exist):
```html
<script src="/js/stats-helpers.js"></script>
<script src="/js/brdc-toast.js"></script>
```

## Extraction Approach

For each remaining module:

1. **Read** the specific line range from league-view.html
2. **Extract** all functions in that section
3. **Add** imports at top:
   ```javascript
   import { state, [cache functions] } from '/js/league-view/app.js';
   import { [helpers] } from '/js/league-view/helpers.js';
   ```
4. **Export** all public functions
5. **Reference** state.xxx instead of bare globals
6. **Save** to public/js/league-view/{module}.js

## Testing Checklist

After completion:
- [ ] All 9 module files created
- [ ] app.js imports from all modules
- [ ] All window functions exposed
- [ ] league-view.html updated (single script tag)
- [ ] Page loads without errors
- [ ] All tabs functional
- [ ] All onclick handlers work
- [ ] No console errors

