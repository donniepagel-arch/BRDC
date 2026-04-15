# BRDC QA Remediation

**Date:** 2026-04-10  
**Source:** Claude-in-Chrome QA report against `burningriverdarts.com`  
**Scope:** Immediate P1 fixes that are safe to deploy without mutating live league history.

## Fixed And Deployed

### P1-A: Cricket scorer `legsToWin` reference error

**File:** `public/pages/league-cricket.html`
**Follow-up file:** `public/sw.js`

The league cricket scorer parsed the URL value into `LEGS_TO_WIN`, but one live-match metadata block referenced `legsToWin`. That threw `ReferenceError: legsToWin is not defined` during match-hub launches.

**Fix:** changed the metadata assignment to use `LEGS_TO_WIN`.

**Follow-up fix:** the first retest still saw the old code on `burningriverdarts.com` because the service worker served scorer pages cache-first. The service worker cache was bumped to `brdc-v56`, and scorer pages now use network-first with offline fallback so live scorer fixes are not hidden behind stale cache.

**Deploy:** Firebase Hosting deployed.

### P1-B: Admin dashboard unauthorized on saved-session restore

**File:** `public/pages/admin.html`

The admin page restored `brdc_session` from local storage and immediately called `adminGetDashboard` before Firebase Auth had rehydrated. That meant `callFunction()` sent no bearer token, so the function returned `Unauthorized`. The flow also double-called `loadDashboard()`.

**Fixes:**

- wait for `onAuthStateChanged` before restoring the dashboard from saved session
- remove duplicate `loadDashboard()` calls after email/Google login

**Deploy:** Firebase Hosting deployed.

### P1-C: Dart Trader missing Firestore indexes

**File:** `firestore.indexes.json`

The listings page queries `dart_trader_listings` by `status in [...]` plus `created_at desc`. The user listings tab also queries by `seller_id` plus `created_at desc`.

**Indexes added:**

- `dart_trader_listings`: `status ASC`, `created_at DESC`
- `dart_trader_listings`: `seller_id ASC`, `created_at DESC`

**Deploy:** Firestore indexes deployed.

### P1-D: Presence heartbeat permission failure

**File:** `firestore.rules`

The messages page writes to `presence_heartbeats/{playerId}`, where `playerId` is the BRDC player document id. The rule only allowed writes where the document id matched the Firebase Auth UID, so valid users were blocked.

**Fix:** allow authenticated users to create/update/delete their own presence doc when the player document's `firebase_uid` matches `request.auth.uid`. The direct UID-keyed path is still allowed for compatibility.

**Deploy:** Firestore rules deployed.

## Not Changed In This Batch

### P1-E: Week 9 away-team 501 data issue

**Reported match:** `leagues/aOq4Y0ETxPZ66tM1uUtP/matches/TNUKhFB5xrtTNmzmTaob`

This is a historical data-integrity issue, not a safe code/config patch. The QA report indicates J. Ragnoni away-team 501 throw data is missing in the match document while league-level stats may contain values elsewhere.

**Decision:** do not rewrite or recalculate this match until the source DartConnect game-detail report is verified.

**Next safe task:**

1. Fetch or identify the exact DartConnect source report for this match.
2. Run the BRDC import parser in validation-only mode using the scheduled match as the anchor.
3. Compare parsed throw ownership and game layout against the existing Firestore match document.
4. Only then decide whether to re-import or manually repair the match.

## Deploy Notes

- Hosting deploy completed successfully.
- Firestore rules compiled and deployed successfully.
- Firestore indexes deployed successfully.
- Firebase reported 5 deployed indexes that are not present in `firestore.indexes.json`; they were left untouched because this was not an index-pruning task.

## Retest Targets

Ask Claude in Chrome to retest:

- `/pages/league-cricket.html` launched from match hub
- `/pages/admin.html` after a normal auth session restore
- `/pages/dart-trader.html`
- `/pages/messages.html` presence/online indicator behavior

If the Dart Trader page still errors immediately after deployment, wait for Firestore index build completion and retest.
