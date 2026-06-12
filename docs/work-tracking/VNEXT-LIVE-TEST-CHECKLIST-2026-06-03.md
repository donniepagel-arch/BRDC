# BRDC vNext — Live Write-Path Test Checklist

Date: 2026-06-03
Live site: https://burningriverdarts.com (site `brdc-live-0428`, project `dashboard-ll`)
Status of automated QA: 28/28 pages green (render/overflow/console/demo-strip/syntax). Both scorer engines parse-clean. What remains below is the **human + credentialed live-write verification** that automation cannot safely do.

Mark each: ✅ pass / ⚠️ issue (note it) / ⛔ blocked.

## Director-auth write flows (need director/admin login)
- [ ] **create-tournament** — submit a real event. Verify write (`createTournament`; matchmaker path → `createMixedDoublesMatchmakerTournament`) + tournament/event image upload to Storage.
- [ ] **create-league** — submit. Verify `setDoc` to `leagues/{slug}`, **cork_option** saves correctly (reference bug was fixed here), slug-as-doc-id scheme is intended, RULE 21 fields persist (cork rules, roster min/max, weeks, board count).
- [ ] **tournament-runtime** — director actions: generate bracket, check-in, board assign, draw partners, start/end mingle, Cupid Shuffle, submit/confirm/dispute result, **send reminder**, delete entrant.
- [ ] **director-home** — real league/event lists populate for a director session.
- [ ] **admin** — load with real admin account; dashboard + members populate. Confirm NO console errors for a signed-in *non-admin* (the one edge still logged).
- [ ] **league-import** — paste a DartConnect recap → parse (dry-run) → **import** (`importMatchData` writes match + recalculates stats). Verify against RULE 17 set/leg hierarchy.

## Communication (sends real SMS / email / messages — go small first)
- [ ] **contact-center** — load real recipients, then a **careful** broadcast (`sendDirectorBroadcast`). Start with a 1-person audience / dry-run; this hits SMS + email.
- [ ] **messages** — send direct message / room chat / challenge (`sendDirectMessage`, `sendChatMessage`, `sendChallenge`).
- [ ] **captain-dashboard** — fill-in request (`sendFillinRequests` — SMS/push to candidates).

## Registration
- [ ] **tournament-register** — actual submit (`registerForTournament` / `matchmakerRegister`). Confirm phone/email required where appropriate + `sms_opt_in` stored.
- [ ] **matchmaker-mingle / matchmaker-tv** — point at a real matchmaker-enabled tournament; confirm live data (read-only surfaces, but need a real matchmaker event).

## Scorers — real-device feel (your iPhone)
- [ ] **X01 scorer** — starter-modal contrast readable; outshot suggestion does NOT deform calculator layout; running scores legible; current thrower obvious. Then a real scored leg saves correctly (`submitGameResult`/`finalizeMatch`).
- [ ] **Cricket scorer** — same feel check + **cork-flow / closeout**: correct starter selection, closeout marks highlight (5M–9M), saves correctly.

## Skipped per owner
- wing-it-wednesdays — owner building via the event builder.

## Live production smoke (2026-06-03) — PASS
Read-only sweep of all 25 vNext pages on https://burningriverdarts.com: every page RENDERS-OWN-CONTENT (no SPA-fallback masking), 0 horizontal overflow, no crashes/blank screens/auth-redirect loops. Only console output: expected "Missing player_id / tournament_id" on pages loaded without their query param (all gate to a clean UNAVAILABLE state). Auth-gated pages rendered in real director/admin mode (session = Donnie Pagel): admin (4 leagues), director-home, create-tournament, contact-center, league-import all in director mode; messages shows 10 real threads. OAuth confirmed working on the apex domain. The write-path items above remain to be exercised manually (they mutate real production data under the logged-in account — do them deliberately, small audiences first).

## Reference test data
- League: `aOq4Y0ETxPZ66tM1uUtP` · Match (Pagel v Pagel W1): `sgmoL4GyVUYP67aOS7wm`
- Home team `mgR4e3zldLsM9tAnXmK8` · Away team `U5ZEAT55xiNM9Otarafx`
