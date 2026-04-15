# BRDC Repo Inventory

This file separates active application code from historical artifacts so cleanup does not accidentally remove unfinished features.

## Canonical App Areas

These are the main parts of the BRDC Firebase app and should be treated as current unless reviewed page-by-page.

- `public/`
- `functions/`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `.firebaserc`
- curated docs in `docs/`
- selected support scripts in `scripts/`

## Active Frontend Route Surfaces

These are clearly part of the current app model or directly referenced by hosting rewrites/navigation.

- `public/index.html`
- `public/pages/dashboard.html`
- `public/pages/player-profile.html`
- `public/pages/messages.html`
- `public/pages/friends.html`
- `public/pages/events-hub.html`
- `public/pages/game-setup.html`
- `public/pages/match-hub.html`
- `public/pages/league-view.html`
- `public/pages/register.html`
- `public/pages/leagues.html`
- `public/pages/tournaments.html`
- `public/pages/create-league.html`
- `public/pages/create-tournament.html`
- `public/pages/director-dashboard.html`
- `public/pages/league-director.html`
- `public/pages/x01-scorer.html`
- `public/pages/league-cricket.html`

## Feature Clusters To Keep For Now

These may feel "zombie" because they are not fully surfaced, but they appear to be real feature areas rather than obvious junk.

- `public/pages/matchmaker-*.html`
- `public/pages/stream-*.html`
- `public/pages/dart-trader*.html`
- `public/pages/chat-room.html`
- `public/pages/conversation.html`
- `public/pages/admin.html`
- `public/pages/captain-dashboard.html`
- `public/pages/live-*.html`
- `public/pages/team-profile.html`
- `public/pages/player-registration.html`
- `public/virtual-darts/`

## Obvious Historical Artifacts

These are clearly saved exports or external snapshots, not part of the active BRDC app.

- `old site.html`
- `old site_files/`
- `DartConnect.html`
- `DartConnect_files/`
- `dcleaderboard.html`
- `dcleaderboard_files/`
- `dcmatchreport.html`
- `dcmatchreport_files/`

These are strong archive/remove candidates.

## Obvious Temporary / Generated Clutter

These paths look like debug output, staging data, screenshots, or temporary import work rather than canonical product code.

- `temp/`
- `screenshots/`
- `deploy-full.log`
- `deploy-functions.log`
- `test-results-2026-01-17.txt`

These should not live in the long-term core repo unless there is a specific archival reason.

## Sensitive / High-Risk Items

These should be reviewed carefully before any commit or sync.

- `functions/service-account-key.json`
- any service-account or credential file outside `.gitignore`

## Cleanup Rule

Use this order:

1. Archive obvious historical artifacts.
2. Archive obvious temporary/generated clutter.
3. Review support scripts and docs separately.
4. Leave unfinished feature clusters alone until they are explicitly classified.
