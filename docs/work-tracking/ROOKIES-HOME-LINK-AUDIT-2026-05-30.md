# Rookies Home Link Audit - 2026-05-30

Purpose: Work through every visible and generated link/action from `/rookies/` without relying on chat memory.

Current locked page: `https://fortheloveofdarts.com/rookies/`

## Home Page Baseline

- [ ] Desktop visual pass after each related page returns to home
- [ ] Mobile visual pass after each related page returns to home
- [ ] Confirm Rookies red theme stays consistent
- [ ] Confirm no horizontal overflow
- [ ] Confirm page still signs in as Brian Beach demo profile
- [ ] Confirm public signed-out landing still works

## Header / Identity

- [ ] `Profile` -> `/rookies/pages/player-profile-vnext.html?id=demo_brian_beach`
- [ ] `Edit profile` -> `/rookies/pages/player-profile-vnext.html?id=demo_brian_beach#profile`
- [ ] Verify Brian stats populate on profile
- [ ] Verify profile has fake demo email/phone only
- [ ] Verify edit/profile settings are safe for demo use

## Match Card

- [ ] Match hub link from next match card
- [ ] Team chat link from next match card
- [ ] `Lineups / RSVP` expand/collapse
- [ ] `I can play` RSVP save flow
- [ ] `Need fill-in` RSVP save flow
- [ ] Empty/no-match state links: chat/login and league schedule
- [ ] Playoff match links from bracket cards
- [ ] Completed playoff cards stay visually quiet
- [ ] Upcoming playoff cards stand out

## Event Management

- [ ] `All events` -> `/rookies/pages/director-home-vnext.html`
- [ ] `2026 Triples League` -> `/rookies/pages/league-director-vnext.html?league_id=rookies-demo-2026-triples`
- [ ] `Wing It Wednesdays` -> `/rookies/pages/wing-it-wednesdays-vnext.html`
- [ ] `+ Add event` -> `/rookies/pages/create-tournament-vnext.html`
- [ ] Director Home league card links: Director, View, Captain
- [ ] Director Home event card links: Manage/Runtime, View, Bracket
- [ ] Director Home add links: Add league, Add event
- [ ] Wing It Wednesdays week selector changes selected management link
- [ ] Wing It Wednesdays week cards work independently by week
- [ ] Create event flow loads, saves draft/scheduled events correctly, and returns to usable page
- [ ] Create league flow loads, saves draft league, and opens director page

## League Card

- [ ] `League page` header link
- [ ] Main tabs: Standings, Schedule, My Stats, Team chat
- [ ] Standings nested tabs: Playoffs, Regular season
- [ ] Playoffs bracket links and TBD final placeholder
- [ ] Regular season excludes playoff matches
- [ ] `Full standings`
- [ ] Schedule tab match rows
- [ ] `Full schedule`
- [ ] My Stats `Profile`
- [ ] My Stats `Full stats`
- [ ] Same-level player comparison profile links
- [ ] Team chat inline room link
- [ ] Team chat send message
- [ ] `Open team chat`
- [ ] `Send challenge`

## Clubhouse Card

- [ ] Defaults to `Play`
- [ ] Main tabs: Talk, Play, Catch Up
- [ ] Talk tab online player profile chips
- [ ] Talk tab recent conversations
- [ ] Talk tab League lobby
- [ ] Talk tab Team rooms
- [ ] Talk tab Event rooms
- [ ] Talk tab `Open chat`
- [ ] Talk tab `Challenge`
- [ ] Play tab `Casual scorer`
- [ ] Play tab `Challenge player`
- [ ] Play tab `Live room`
- [ ] Play tab `Dart Trader`
- [ ] Play tab active/live games links
- [ ] Catch Up feed renders recent activity
- [ ] Catch Up `Refresh feed`

## Events Card

- [ ] Title is `Events`
- [ ] Main tabs: Events, Leagues
- [ ] Event row `View`
- [ ] Event row `Discuss`
- [ ] Event row `Sign Up`
- [ ] Closed event state shows non-clickable `Closed`
- [ ] `Browse Events`
- [ ] Leagues row `View`
- [ ] Leagues row `Discuss`

## Signed-Out Landing

- [ ] `View league`
- [ ] `Events calendar`
- [ ] `Wing It Wednesdays`
- [ ] `Bracket`
- [ ] `Scorer`
- [ ] `Director login`
- [ ] Confirm signed-out pages expose public-safe viewing only

## Cross-Cutting Checks

- [ ] Back buttons and navigation context make sense
- [ ] Rookies branding carries through every linked page
- [ ] No BRDC-only pink accents on Rookies pages unless intentional
- [ ] No real player emails/phones exposed or used by demo flows
- [ ] No accidental SMS/email send on demo data
- [ ] Desktop screenshots for major pages
- [ ] Mobile screenshots for major pages
- [ ] Browser console reviewed for page-specific errors
- [ ] All changed frontend files deployed to `fortheloveofdarts`

