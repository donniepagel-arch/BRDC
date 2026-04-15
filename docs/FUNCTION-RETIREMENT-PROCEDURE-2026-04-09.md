# BRDC Function Retirement Procedure

Date: 2026-04-09
Project: `brdc-v2`
Scope: controlled production retirement plan for the 14 low-risk live-only functions

## Objective

Retire the clearest production-only drift functions without affecting the active BRDC site.

This procedure intentionally excludes:

- `recalcPlayerStats`

That endpoint should be handled separately because it appears related to the repo's current `recalculatePlayerStats` capability.

## Retirement Set

All are currently live in `us-central1`.

- `addOrgPlayer`
- `approveOrgPlayer`
- `createOrgEvent`
- `deleteOrgEvent`
- `importOrgPlayers`
- `orgBlast`
- `registerForOrgEvent`
- `removeOrgPlayer`
- `sendOrgMessage`
- `updateOrgEvent`
- `updateOrgPlayer`
- `adminUpdateSquare`
- `claimSquare`
- `initSquaresGame`

## Preconditions

Before deleting anything:

1. confirm the current BRDC site is healthy
2. confirm no active work depends on org/events or squares features
3. capture the live function inventory for recordkeeping
4. document that rollback means redeploying or restoring from the real source, not from the current repo

Reason:

These 14 functions do not exist in the current repo, so rollback is not a normal repo redeploy. If one of them turns out to be needed, recovery requires the older source bundle or another deployment source.

## Safe Execution Model

Retire them in one controlled batch, then immediately verify the core BRDC flows.

Do not mix this with any other Firebase deploy or cleanup work.

## Exact Delete Command

```powershell
firebase functions:delete `
  addOrgPlayer,approveOrgPlayer,createOrgEvent,deleteOrgEvent,importOrgPlayers,orgBlast,registerForOrgEvent,removeOrgPlayer,sendOrgMessage,updateOrgEvent,updateOrgPlayer,adminUpdateSquare,claimSquare,initSquaresGame `
  --project brdc-v2 `
  --region us-central1 `
  --force
```

## Verification Checklist

Run these checks immediately after deletion:

1. Hosting loads:
   - homepage/login
   - dashboard

2. League flows load:
   - league list
   - league detail
   - match hub if applicable

3. Messaging flows load:
   - messages panel
   - conversation thread

4. Events and tournaments still load:
   - events hub
   - tournament pages

5. No obvious console or network failures appear in the actively used site surfaces

## Verification Targets

Minimum practical checks:

- [burningriverdarts.com](https://burningriverdarts.com/)
- [dashboard.html](E:\projects\brdc-firebase\public\pages\dashboard.html)
- [league-view.html](E:\projects\brdc-firebase\public\pages\league-view.html)
- [messages.html](E:\projects\brdc-firebase\public\pages\messages.html)
- [events-hub.html](E:\projects\brdc-firebase\public\pages\events-hub.html)
- [tournament-view.html](E:\projects\brdc-firebase\public\pages\tournament-view.html)

## Rollback Reality

There is no clean repo rollback for these 14 functions because they are not in the current repo.

If deletion causes a regression, rollback options are:

1. redeploy from the original older source if available
2. restore from another machine/repo/export that still contains those functions
3. temporarily re-create compatibility stubs only if the missing behavior is well understood

Because of that, deletion should happen only when you are comfortable treating these functions as stale drift.

## Recommended Execution Order

1. snapshot current live function list
2. delete the 14 functions in one batch
3. verify the core BRDC flows immediately
4. if healthy, record the retirement as complete
5. only after that move to the separate `recalcPlayerStats` decision

## Definition of Done

This task is complete only when one of the following is true:

- the 14 functions have been retired and the core BRDC flows are verified healthy
- or a conscious hold decision is recorded and no deletion is performed
