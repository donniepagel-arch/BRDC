# Firebase Drift Audit

Date: 2026-04-09
Project: `brdc-v2`

## Confirmed

- Hosting and Firestore rules are now aligned with the repo baseline.
- The stale Hosting rewrite for `/api/:functionName` was removed from `firebase.json` and Hosting was redeployed.
- Frontend code primarily calls Cloud Functions directly via `https://us-central1-brdc-v2.cloudfunctions.net/...`.
- Live Cloud Functions are deployed in `us-central1` on `nodejs20`.

## Drift Found

### 1. Hosting config had stale function rewrite

- `firebase.json` still contained `/api/:functionName -> function :functionName`.
- Current frontend code does not rely on that pattern.
- Firebase Hosting warned about it during deploy because it is not a valid concrete endpoint mapping.
- Status: fixed locally and deployed.

### 2. Functions runtime config did not match production

- `functions/package.json` declared Node `22`.
- Live production functions are running on `nodejs20`.
- Status: fixed locally in repo, not yet deployed as functions.

### 3. Live functions inventory is larger than the repo's current intentional surface

- Production contains a large active function inventory across league, chat, social, notifications, matchmaker, import, and admin areas.
- The repo entrypoint (`functions/index.js`) still exports many modules, but the worktree is dirty and several areas are clearly in mixed historical states.
- This strongly suggests production is carrying a combination of:
  - currently intended functions
  - older functions that have not been explicitly retired
  - endpoints that may no longer be part of the desired long-term surface

### 4. Repo state is not clean enough for a blind functions deploy

- The repo has many unrelated tracked deletions, untracked files, migration scripts, archived assets, and local-only artifacts.
- A full `firebase deploy --only functions` from the current tree would be risky without first narrowing the intended export surface.

### 5. Sensitive local artifacts still need hygiene work

- Local project state includes a service account key file path under `functions/`.
- `.gitignore` was updated to ignore that path.
- Managed function environment/config still exists in production and should be reviewed separately.

### 6. Firestore index file lagged one BRDC-owned live query shape

- A semantic comparison of live indexes versus `firestore.indexes.json` was run on 2026-04-14.
- The raw Firebase export was noisy because it includes implicit `__name__` fields that are not stored in repo form.
- After normalizing away those implicit fields, the only BRDC-owned live index missing from the repo file was:
  - `messages(pinned ASC, timestamp ASC)`
- That index shape is used by the BRDC chat/message surfaces that read chronologically pinned-first message streams.
- Status: fixed locally in [firestore.indexes.json](E:\projects\brdc-firebase\firestore.indexes.json) and deployed with `firebase deploy --only firestore:indexes --project brdc-v2`.

### 7. Remaining live-only indexes appear to belong to other app domains in the shared Firebase project

- After the BRDC `messages(pinned ASC, timestamp ASC)` index was added locally, Firebase reported exactly four live indexes still not represented in `firestore.indexes.json`.
- Those remaining live-only indexes are:
  - `featured_banners(active ASC, priority ASC)`
  - `jobs(appt_date ASC, route_order ASC)`
  - `jobs(client_id ASC, created_at DESC)`
  - `service_areas(active ASC, city ASC)`
- Assessment:
  - these do not map to the BRDC frontend/function surface audited in this repo
  - they are likely owned by another app sharing the `brdc-v2` project
- Status: intentionally left in production and intentionally not added to the BRDC repo baseline

## Safe Next Actions

1. Build a canonical list of functions that the frontend actually uses.
2. Compare that list to:
   - live deployed functions
   - current `functions/index.js` exports
3. Mark each function as:
   - keep
   - legacy but still used
   - candidate for retirement
4. Only after that, do a controlled functions deploy.
5. Keep Firestore index drift reviews semantic:
   - ignore implicit live `__name__` fields
   - only pull BRDC-owned query shapes into `firestore.indexes.json`
   - do not delete shared-project indexes with `--force` unless ownership is proven

## Do Not Do Yet

- Do not run a blanket functions deploy from the current dirty worktree.
- Do not mass-delete live functions without proving no frontend path still depends on them.
