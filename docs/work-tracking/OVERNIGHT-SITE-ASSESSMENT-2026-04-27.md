# Overnight Site Assessment - 2026-04-27

## Goal

Run a non-mutating overnight pass against the live site to catch the regressions that have been recurring before league night:

- Missing or stale 3DA/MPR stats.
- Visible `NaN`, `undefined`, or broken fallback values.
- Console errors from auth, CORS, missing indexes, or chat/tournament functions.
- League tab regressions: standings, schedule, stats, members, match hub.
- Dashboard feed regressions, including expanded weekly result cards.
- Chat/message route regressions.
- Tournament route regressions.

## Runner

```powershell
cd E:\projects\brdc-firebase
node .\scripts\qa\overnight-site-assessment.mjs
```

The runner writes a timestamped JSON report to `reports/`.

## Optional Environment Overrides

```powershell
$env:BRDC_BASE_URL='https://burningriverdarts.com'
$env:BRDC_CDP_URL='http://127.0.0.1:9222'
$env:BRDC_LEAGUE_ID='aOq4Y0ETxPZ66tM1uUtP'
$env:BRDC_MATCH_ID='e2nibslUoRKdtWA5Nzqy'
$env:BRDC_TOURNAMENT_ID='2uU3CpIFDdJUzmcTv5PQ'
$env:BRDC_REPORT_DIR='reports'
node .\scripts\qa\overnight-site-assessment.mjs
```

If Android Chrome DevTools is available at `127.0.0.1:9222`, the runner uses the signed-in phone session. If not, it falls back to a headless Chromium session, which is useful for public pages but less useful for authenticated dashboard checks.

## Routes Covered

- `/pages/dashboard.html`
- `/pages/messages.html`
- `/pages/league-view.html?league_id=...`
- `/pages/league-director.html?league_id=...`
- `/pages/match-hub.html?league_id=...&match_id=...`
- `/pages/player-profile.html`
- `/pages/members.html?league_id=...`
- `/pages/events-hub.html`
- `/pages/tournaments.html`
- `/pages/tournament-view.html?tournament_id=...`
- `/pages/tournament-bracket.html?tournament_id=...`
- `/pages/dart-trader.html`
- `/pages/game-setup.html`
- `/pages/x01-scorer.html`
- `/pages/league-cricket.html?league_id=...`

## What Counts As A Failure

- Any console error.
- Any visible `NaN` or `undefined`.
- Route shell loads but expected route content does not appear.
- Tabs fail to switch.
- Expanded feed cards do not expose team/player stat rows.

## Manual Follow-Up Checklist

Use this after reviewing the JSON report:

- Confirm dashboard feed weekly result cards show team `3DA` and `MPR` in expanded details.
- Confirm player profile feed cards show `3DA` and `MPR`.
- Confirm Triples league standings shows top 6 playoff labels.
- Confirm Triples league schedule week selector changes the rendered matches.
- Confirm Triples league stats `PERFORMANCE` tab has populated 501 averages and cricket MPR.
- Confirm match hub `GAMES`, `PERFORMANCE`, `AWARDS`, and `LEADERS` tabs have no duplicates or missing stat columns.
- Confirm messages direct chat does not redirect back to lobby when selecting a user.
- Confirm tournament view registration and bracket pages have no permission errors.

## Notes

This runner is read-only. It clicks tabs and expanders only. It does not submit forms, send messages, register users, save matches, or create tournament data.
