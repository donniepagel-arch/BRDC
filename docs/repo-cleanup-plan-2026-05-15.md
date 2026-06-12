# Repo Cleanup Plan - 2026-05-15

Purpose: separate safe vnext work from live production fixes and temporary repair artifacts before any merge, deploy, or route replacement.

## Keep: VNext Product Files

These are the separate redesign pages and assets. They should remain separate until approved.

- `public/pages/*-vnext.html`
- `public/js/*-vnext.js`
- `public/css/*-vnext.css`
- `public/css/market-events-scorer-vnext.css`
- `docs/home-vnext-design-rules.md`
- `docs/home-vnext-rules.md`
- `docs/vnext-qa-checklist.md`

## Keep: VNext QA Tooling

These scripts are useful for repeatable validation.

- `scripts/qa/android-vnext-smoke.mjs`
- `scripts/qa/vnext-visual-audit.mjs`
- `scripts/qa/android-vnext-screenshots.mjs`

`scripts/qa/android-vnext-visual.mjs` is useful but currently blocked when Android Chrome's DevTools endpoint hangs. Keep for now, but do not treat it as the primary QA runner.

## Keep: Hosting/Recovery Configs

These should be reviewed and renamed only if confusing, but not deleted until deployments are stable.

- `firebase.brdc-v2-production-hosting.json`
- `firebase.brdc-v2-restore-hosting.json`
- `firebase.current-apex-hosting.json`
- `firebase.dashboard-ll-hosting.json`
- `firebase.fortheloveofdarts-hosting.json`
- `firebase.functions-default-only.json`

## Review Carefully: Classic Production Fixes

These affect the live classic site. Do not revert blindly.

- `functions/**`
- `firestore.rules`
- `public/components/brdc-navigation*.js`
- `public/js/firebase-config.js`
- `public/js/chat-*.js`
- `public/js/challenge-system.js`
- `public/js/dashboard/**`
- `public/js/league-view/**`
- `public/js/player-profile/**`
- `public/pages/*.html` except `*-vnext.html`
- `public/css/brdc-styles.css`
- `public/css/league-view.css`
- `public/css/dashboard/dashboard-feed.css`
- `public/css/captain-dashboard.css`
- `public/css/team-profile.css`

Before cleanup, each changed classic file should be assigned to one of:
- `live fix required`
- `vnext bridge required`
- `obsolete experiment`
- `unknown, inspect diff`

## Archive or Delete After Review: Temporary Repair Scripts

These are likely one-off import/data repair tools. Archive them under `docs/backups/temp-scripts-2026-05-15/` or delete after confirming no future use.

- `tmp-*.js`
- `tmp-*.mjs`
- `tmp-*.html`
- `scripts/emergency-seed-dashboard-ll.js`
- `scripts/restamp-fillin-player-refs.js`

## Ignore or Archive: Generated Reports

Generated reports should not be committed unless they are intentionally saved as release evidence.

- `reports/**`

Recommended:
- Keep the latest vnext report paths in final notes.
- Do not commit screenshot PNGs by default.

## Site Sections To Validate Before Replacing Classic Routes

1. Triples league standings, schedule, stats, rosters, fill-ins.
2. Match hub orientation, set results, performance stats, duplicate-player prevention.
3. Player profiles and team pages.
4. Dashboard match night card and feed.
5. Messages, rooms, direct messages, and challenge cards.
6. Captain dashboard RSVP, fill-ins, roster stats.
7. Director/admin auth and import tooling.
8. Tournament create, register, runtime, and bracket permissions.
9. Dart Trader layout and create/listing flows.
10. Scorer setup and classic scorer launch bridge.

## Next Cleanup Commands

Review current work:

```powershell
git status --short
git diff --stat
```

Identify temp files:

```powershell
Get-ChildItem -File tmp-* | Select-Object Name, LastWriteTime
Get-ChildItem reports -Recurse -File | Select-Object FullName, Length
```

Check vnext references stay vnext:

```powershell
rg -n "/pages/.*\\.html" public/pages public/js -g "*-vnext.html" -g "*-vnext.js"
```

Then inspect the results and confirm every route has `-vnext` when a vnext equivalent exists. Classic scorer links are allowed until vnext scorer engines replace them.

Check bad UI text:

```powershell
rg -n "PIN|Classic|safe preview|read-only in preview|NaN|undefined|null" public/pages public/js public/css -g "*-vnext.html" -g "*-vnext.js" -g "*-vnext.css"
```
