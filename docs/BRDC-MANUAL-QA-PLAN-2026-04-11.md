# BRDC Manual QA Plan - 2026-04-11

## Objective

Retest the highest-risk live BRDC flows after backend cleanup and function refactors, with emphasis on:

- admin dashboard stability
- league/tournament drafts and templates
- tournament-day helper flows
- messaging/navigation overlays
- scorer and match flows

## Rules

- Do not intentionally mutate real league data unless the step explicitly says it is safe and reversible.
- Prefer read-only navigation first.
- If a flow would create or edit real data, stop before the final confirmation click unless the page is already using test/draft data.
- Record console errors exactly.
- Record route, timestamp, account used, and whether data was mutated.

## Test account

- Account: Donnie Pagel (Admin)

## Priority 1 regression set

### 1. Admin dashboard

- Route: `/pages/admin.html`
- Verify:
  - page loads without `Unauthorized`
  - stats row renders
  - LEAGUES tab renders
  - TOURNAMENTS tab renders
  - PERMISSIONS tab renders
  - PLAYERS tab renders
  - FEEDBACK tab renders
  - BOTS tab renders
- Capture:
  - any console errors
  - any skeletons that do not resolve

### 2. Create tournament templates/drafts

- Route: `/pages/create-tournament.html`
- Verify:
  - page loads for authenticated admin
  - save/load template controls render
  - `getTournamentTemplates` returns data or empty state cleanly
  - existing draft can load without console errors
  - deleting a draft does not throw
- Safe mutation rule:
  - do not create a real tournament
  - if saving a draft is needed for test coverage, use clearly temporary test values and note mutation

### 3. Create league drafts

- Route: `/pages/create-league.html`
- Verify:
  - page loads for authenticated admin
  - `saveLeagueDraft` works or fails cleanly
  - reopening the page can restore the draft
- Safe mutation rule:
  - do not create a real league
  - if saving a draft is needed, use throwaway values only

### 4. Director dashboard draft access

- Route: `/pages/director-dashboard.html`
- Verify:
  - page loads
  - draft inspection panel can read league/tournament drafts
  - delete draft controls work without console errors
  - add-event controls still render

### 5. Tournament-day helpers

- Routes:
  - `/pages/matchmaker-director.html`
  - `/pages/matchmaker-register.html`
- Verify:
  - check-in related UI loads
  - no console errors around `checkInPlayer`
  - if a check-in modal/workflow exists, open it but avoid final mutation unless using clear test data

## Priority 2 regression set

### 6. Messages and chat drawer

- Routes:
  - `/pages/messages.html`
  - `/pages/dashboard.html`
- Verify:
  - recent chat list resolves
  - room/channel lists resolve
  - no presence permission errors
  - no stuck loading text in main messaging view

### 7. Player profile stats

- Route: `/pages/player-profile.html`
- Verify:
  - stats tabs render
  - `getPlayerStatsFiltered` loads without error
  - no obvious missing leaderboard values or `undefined`

### 8. League view and league director

- Routes:
  - `/pages/league-view.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
  - `/pages/league-director.html?league_id=aOq4Y0ETxPZ66tM1uUtP`
- Verify:
  - standings
  - stats
  - members
  - director tools
  - no `undefined` values in stat leaderboards

### 9. Match hub and scorer launch

- Routes:
  - completed match hub
  - cricket scorer launch
  - x01 scorer launch
- Verify:
  - scorer loads from match hub
  - cricket no longer throws `legsToWin is not defined`
  - live launch shows correct player names and format

## Priority 3 spot checks

### 10. Dart Trader

- Route: `/pages/dart-trader.html`
- Verify:
  - no index error
  - empty state is clean if no listings exist

### 11. Matchmaker / heartbreaker routes

- Routes:
  - `/pages/matchmaker-view.html`
  - `/pages/matchmaker-mingle.html`
  - `/pages/matchmaker-bracket.html`
- Verify:
  - no obvious function failures
  - no broken fetches on status endpoints

## Console watch list

- `Unauthorized`
- `Missing or insufficient permissions`
- `The query requires an index`
- `ReferenceError`
- `Failed to fetch`
- `undefined`
- stuck skeleton/loading states

## Output format for tester

Use this exact structure:

```md
# BRDC QA Report

## Summary
- Overall:
- Live data mutated:

## Passes
- route:
- result:

## Failures
- severity:
- route:
- steps:
- actual:
- expected:
- console:

## Notes
- residual risks:
- suggested next fix:
```
