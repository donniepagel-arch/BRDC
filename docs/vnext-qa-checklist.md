# BRDC VNext QA Checklist

Use this checklist for hands-on approval of the separate vnext site. The vnext pages must stay separate from classic pages until explicitly approved.

## Test Setup

- Base URL: `https://burningriverdarts.com`
- Primary test account: Donnie Pagel admin account
- Primary league: 2026 Triples League, `aOq4Y0ETxPZ66tM1uUtP`
- Test mobile and desktop for every approval pass.
- Hard refresh before testing after deploy.
- Do not submit real writes unless the test step explicitly says it is safe.

## Global Pass Criteria

- No `NaN`, `undefined`, `null`, `PIN`, `Classic`, `safe preview`, or `read-only preview` language in visible UI.
- No horizontal page overflow on mobile.
- Bottom nav must not hide primary actions.
- All vnext pages should link to other vnext pages where a vnext page exists.
- Classic scorer engines may still launch from vnext scorer setup until replacement scorer work is approved.
- Data must match classic for standings, stats, rosters, schedules, match hubs, and member counts.

## Primary Flow

1. Open `/pages/home-vnext.html`.
2. Confirm profile stats load: 3DA and MPR should show real values.
3. Confirm match night card loads and links to the vnext match hub.
4. Use each league tile tab: Standings, Schedule, Team Chat.
5. Use each community/event tile tab and confirm content changes without layout jump.
6. Confirm no full login modal flashes after signed-in state is known.

## Triples League Hub

URL: `/pages/triples-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP`

Check:
- Header shows 2026 Triples League and completed match count.
- Standings sort by night wins first and show all 10 teams.
- Top 6 playoff area is clear.
- User team is highlighted.
- Schedule week navigation works.
- Stats pane shows real 501 and cricket stats with no missing 3DA/MPR regressions.
- Teams pane shows rosters in A, B, C order.
- Fill-ins pane shows fill-ins separately and uses F/gray treatment where appropriate.
- Chat pane links to the active league/team chat experience.

## Match Hub

URLs:
- Completed match: `/pages/match-hub-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=0lxEeuAa7fEDSVeY3uCG`
- Scheduled match: `/pages/match-hub-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&match_id=CPWJV8dfu3qCnKdsg2RZ`

Check:
- Team sides match the scheduled home/away orientation.
- Set cards show the correct players on the correct team side.
- Night score matches the set card results.
- Performance tab does not duplicate players.
- Roster stats include both 3DA and MPR where available.
- Missing stats render as `-`, not `NaN`.

## Team Page

URL: `/pages/league-team-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&team_id=U5ZEAT55xiNM9Otarafx`

Check:
- Team page team is always visually treated as the primary team.
- Roster is A, B, C order.
- Captain badge is not confused with level badge.
- Match list is readable and links to vnext match hubs.
- Chat link goes to vnext messages.

## Player Profile

URLs:
- Donnie: `/pages/player-profile-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&player_id=X2DMb9bP4Q8fy9yr5Fam`
- Fill-in: `/pages/player-profile-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP&player_id=1NkQgUfa2lvS7v8k1ctY`

Check:
- 3DA, MPR, win percentage, match history, and league affiliation populate.
- Fill-ins show as fill-ins, not assigned to incorrect teams.
- Own-profile settings only appear for the signed-in user's profile.

## Messages

URL: `/pages/messages-vnext.html`

Check:
- Direct, rooms, challenges, and online counts load.
- Selecting a direct thread does not bounce back to lobby.
- Composer enables after a thread is selected.
- Challenge modal opens from a direct thread.
- Challenge cards appear in-thread after sending.
- Rooms link to the right league/team/tournament contexts.

## Captain Dashboard

URL: `/pages/captain-dashboard-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP`

Check:
- Team, rank, record, 3DA, and MPR load.
- Roster shows A, B, C with correct current replacements.
- Fill-ins list loads and includes stats.
- RSVP controls are visible and understandable.
- Team rename/photo/profile functions are not advertised unless functional.

## Director/Admin

URLs:
- `/pages/league-director-vnext.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
- `/pages/admin-vnext.html`

Check:
- Director board shows teams, matches, players, and import/report tools.
- Import report tooling must not require PIN language.
- Admin board loads leagues, tournaments, members, and health.
- Admin page must require signed-in admin auth; unauthenticated 401 is expected.

## Events, Tournaments, Trader, Scorer

URLs:
- `/pages/events-vnext.html`
- `/pages/tournament-view-vnext.html?tournament_id=<known tournament id>`
- `/pages/tournament-register-vnext.html?tournament_id=<known tournament id>`
- `/pages/tournament-runtime-vnext.html?tournament_id=<known tournament id>`
- `/pages/create-tournament-vnext.html`
- `/pages/dart-trader-vnext.html`
- `/pages/dart-trader-create-vnext.html`
- `/pages/scorer-setup-vnext.html`

Check:
- Tournament pages use email-auth wording, not PIN.
- Tournament register supports self and friend registration where intended.
- Tournament runtime links to rooms, registration, and scorer setup.
- Dart Trader has one navigation/sidebar system, not duplicated side menus.
- Scorer setup exposes 501, cricket, and choice options correctly.

## Automated Checks

Run:

```powershell
node scripts\qa\android-vnext-smoke.mjs
node scripts\qa\vnext-visual-audit.mjs
node scripts\qa\android-vnext-screenshots.mjs
```

Expected:
- `android-vnext-smoke.mjs` returns `"ok": true`.
- `vnext-visual-audit.mjs` should only fail admin in unauthenticated headless mode.
- Android screenshots should show signed-in data populated after load.
