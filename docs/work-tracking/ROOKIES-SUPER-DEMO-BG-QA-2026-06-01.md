# Rookies Super Demo Background QA - 5/31/2026, 10:55:25 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-desktop.png

# Rookies Super Demo Background QA - 5/31/2026, 10:55:25 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles

## Findings
- FAIL: Background QA runner crashed
  - page.selectOption: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[name="game"]')[22m
[2m    - locator resolved to <select name="game">…</select>[22m
[2m  - attempting select option action[22m
[2m    2 × waiting for element to be visible and enabled[22m
[2m      - element is not visible[22m
[2m    - retrying select option action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible and enabled[22m
[2m      - element is not visible[22m
[2m    - retrying select option action[22m
[2m      - waiting 100ms[22m
[2m    59 × waiting for element to be visible and enabled[22m
[2m       - element is not visible[22m
[2m     - retrying select option action[22m
[2m       - waiting 500ms[22m

    at submitCreatePayload (E:\projects\brdc-firebase\temp\rookies-superdemo-bg-qa.mjs:210:16)
    at async main (E:\projects\brdc-firebase\temp\rookies-superdemo-bg-qa.mjs:362:5)

## Intercepted Payload Highlights

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T02-54-42-762Z\create-event-desktop.png

# Rookies Super Demo Background QA - 5/31/2026, 11:01:24 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Scorer setup team assignment flow did not enable launch
  - {"teamCards":2,"startEnabled":false,"setModeHiddenAfterSets":false,"corkRules":["cork_every_leg","alternate_cork_first_deciding","loser_starts_cork_first_deciding","winner_starts_cork_first_deciding","select-starter"],"corkWinnerVisible":true,"inRules":["straight","double","master"],"outRules":["double","straight","master"],"knockoutPresent":true,"knockoutText":"Up to 8 teams with up to 4 players per team."}
- FAIL: Scorer setup team assignment flow did not enable launch
  - {"teamCards":2,"startEnabled":false,"setModeHiddenAfterSets":false,"corkRules":["cork_every_leg","alternate_cork_first_deciding","loser_starts_cork_first_deciding","winner_starts_cork_first_deciding","select-starter"],"corkWinnerVisible":true,"inRules":["straight","double","master"],"outRules":["double","straight","master"],"knockoutPresent":true,"knockoutText":"Up to 8 teams with up to 4 players per team."}
- FAIL: Scorer setup team assignment flow did not enable launch
  - {"teamCards":2,"startEnabled":false,"setModeHiddenAfterSets":false,"corkRules":["cork_every_leg","alternate_cork_first_deciding","loser_starts_cork_first_deciding","winner_starts_cork_first_deciding","select-starter"],"corkWinnerVisible":true,"inRules":["straight","double","master"],"outRules":["double","straight","master"],"knockoutPresent":true,"knockoutText":"Up to 8 teams with up to 4 players per team."}
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-00-55-012Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 5/31/2026, 11:02:34 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-02-06-283Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 5/31/2026, 11:37:26 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T03-36-55-645Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 12:52:28 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T04-52-00-484Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 8:46:57 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T12-46-29-239Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 10:35:24 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]
- FAIL: Admin portal runtime/series management link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-34-48-768Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 10:36:28 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to event runtime/series management

## Findings
- FAIL: Admin portal create-event link not found
  - [{"text":"Events","href":"https://fortheloveofdarts.com/rookies/pages/events-vnext.html"},{"text":"Contact","href":"https://fortheloveofdarts.com/rookies/pages/contact-center-vnext.html"},{"text":"Manage","href":"https://fortheloveofdarts.com/rookies/pages/triples-vnext.html?league_id=rookies-demo-2026-triples#manage"},{"text":"View","href":"https://fortheloveofdarts.com/rookies/pages/triples-vnext.html?league_id=rookies-demo-2026-triples"},{"text":"Manage series","href":"https://fortheloveofdarts.com/rookies/pages/wing-it-wednesdays-vnext.html"},{"text":"View","href":"https://fortheloveofdarts.com/rookies/pages/tournament-view-vnext.html?tournament_id=rookies-wing-it-wednesdays-2026-06-03"}]

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-35-57-507Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 10:37:41 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T14-36-44-578Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 11:35:21 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-34-50-275Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 11:44:20 AM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T15-43-50-091Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 12:27:55 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-27-22-454Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 12:31:30 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-30-38-789Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 12:43:10 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T16-42-14-618Z\admin-portal-links-desktop.png

# Rookies Super Demo Background QA - 6/1/2026, 1:04:31 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\submit-blind_draw.png

# Rookies Super Demo Background QA - 6/1/2026, 1:04:31 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles

## Findings
- FAIL: Background QA runner crashed
  - page.goto: Timeout 45000ms exceeded.
Call log:
[2m  - navigating to "https://fortheloveofdarts.com/rookies/pages/create-tournament-vnext.html?preset=mixed_doubles_matchmaker&submitqa=1780333426880", waiting until "domcontentloaded"[22m

    at openPage (E:\projects\brdc-firebase\temp\rookies-superdemo-bg-qa.mjs:116:14)
    at async submitCreatePayload (E:\projects\brdc-firebase\temp\rookies-superdemo-bg-qa.mjs:231:20)
    at async main (E:\projects\brdc-firebase\temp\rookies-superdemo-bg-qa.mjs:407:5)

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-03-30-535Z\submit-blind_draw.png

# Rookies Super Demo Background QA - 6/1/2026, 1:05:54 PM

Safety: all Cloud Function create calls were intercepted locally. No live creates, registration, contact, SMS/email, upload, or Firestore mutation was intentionally performed.

## Passes
- PASS: Create event layout has no horizontal overflow on mobile
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on tablet
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Create event layout has no horizontal overflow on desktop
- PASS: Blind draw template sets entry type and draw type
- PASS: Weekly series template sets recurring series mode
- PASS: Blind draw template enables registration voting with weekly options
- PASS: Weekly series template enables registration voting question
- PASS: Matchmaker template exposes matchmaker settings and double-elimination mixed doubles
- PASS: Blind draw intercepted payload includes boards, draw, house player, runtime, mixed legs, cork/in/out rules, and registration voting
- PASS: Matchmaker intercepted payload includes mixed doubles, double elimination, matchmaker settings, winners/losers rules, mingle cutoff, boards
- PASS: Scorer setup layout has no horizontal overflow on mobile
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on tablet
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Scorer setup layout has no horizontal overflow on desktop
- PASS: Scorer setup team-name/player assignment flow enables launch
- PASS: Scorer setup shows set mode only after sets are selected
- PASS: Scorer setup exposes cork rules and cork-choice winner options
- PASS: Scorer setup includes free/double/master in/out rules
- PASS: Scorer setup exposes knockout/bracket mode
- PASS: Admin portal layout has no horizontal overflow on desktop
- PASS: Admin portal links to create event flow
- PASS: Admin portal links to event runtime/series management

## Findings
- No blocking findings in this run.

## Intercepted Payload Highlights
- createTournament: preset=blind_draw, entry=blind_draw, format=single_elimination, game=mixed, boards=8, draw=blind_draw_doubles/checked_in_only, matchmaker=false
- createMixedDoublesMatchmakerTournament: preset=mixed_doubles_matchmaker, entry=mixed_doubles, format=double_elimination, game=cricket, boards=12, draw=manual_teams/checked_in_only, matchmaker=true

## Screenshots
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\create-event-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\create-event-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\create-event-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\submit-blind_draw.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\submit-mixed_doubles_matchmaker.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\scorer-setup-mobile.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\scorer-setup-tablet.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\scorer-setup-desktop.png
- E:\projects\brdc-firebase\reports\rookies-superdemo-bg-qa\2026-06-01T17-04-50-021Z\admin-portal-links-desktop.png

