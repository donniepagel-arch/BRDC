# Plan: Split league-view.html into ES6 Modules

## Current State
- league-view.html: 6,482 lines total
- JavaScript: ~3,450 lines starting at line 3030
- All JavaScript inline in single `<script type="module">` block

## Target Module Structure
public/js/league-view/
├── app.js              - Main orchestrator
├── schedule.js         - Schedule tab functionality  
├── standings.js        - Standings tab functionality
├── stats.js            - Stats tab functionality
├── rules.js            - Rules tab rendering
├── registration.js     - Registration forms and display
├── live.js             - Live match & fillins display
├── match-night.js      - Match night banner logic
└── helpers.js          - Shared utilities

## Completed
- ✅ helpers.js created
- ✅ app.js created (partial - needs completion)

## Next Steps
1. Extract remaining ~3,000 lines of JavaScript from league-view.html
2. Create schedule.js module
3. Create standings.js module  
4. Create stats.js module
5. Create rules.js module
6. Create registration.js module
7. Create live.js module
8. Create match-night.js module
9. Update app.js to import and expose all window functions
10. Replace inline script in league-view.html with single script tag
11. Verify no syntax errors

## Window Functions Needing Exposure
- switchTab
- changeWeek
- changeTeamFilter
- toggleTeamExpand
- toggleExpandAll
- sortStandings
- viewTeam
- viewPlayer
- viewMatch
- goToMembers
- setStatsView
- setStatsLevel
- setStatsCategory
- setStatsPage
- changeStatsPage
- sortStats
- toggleStatsTeam
- expandMatch
- showDirectorLogin
- verifyDirectorPin
- openFillinModal
- openSubSignupModal
- lookupSubPin
- submitSubSignup
- lookupFillinPin
- handleFillinPhotoChange
- handleRegPhotoChange
- submitFillin
- openModal
- closeModal
- selectPayment
- lookupPin
- submitRegistration
- confirmAvailability
