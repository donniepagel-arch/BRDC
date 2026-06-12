# Scorer Setup (vNext) — Assessment · 2026-06-06 (night)

Reviewed the live stepped wizard (`scorer-setup-vnext`, css?v=12 / SW v70) by driving every
step + state via Playwright and viewing the screenshots. Screens saved in `reports/`:
`assess-1b-players-added.png`, `assess-2-game-501.png`, `assess-2b-game-cricket.png`,
`assess-2c-game-customx01.png`, `assess-3-start.png`.

## TL;DR
The **structure is right now** — true click-through, one decision per screen, Start only at the
end, per-game-type disclosure working. The **remaining problems are presentation/density**, not
flow. Two changes would do most of the work: (1) warm the theme to the app standard, (2) stop
repeating the big header on every step. Then trim Step 2's field density.

## What works (verified)
- **Wizard flow** — Players → Game → Start, with progress dots (active/done), Back/Next, and
  Start appearing ONLY on the final step. Drove it end-to-end via MCP: add Donnie + Matt →
  auto-split Team 1 / Team 2 → Next → 501 → Next → Start (enabled, because players are set).
- **Progressive disclosure works** (this was silently broken before tonight's `[hidden]` fix):
  - Cricket → hides In/Out rules + custom score (only legs/leg-mode/sets/start-rule/cork shown)
  - Custom X01 → "X01 START" field appears; in/out rules show
  - 501/301/701 → in/out rules show, custom score hidden
- **Review summary** on Step 3 ("Game: All X01 custom · Legs: 3").
- **Start gating** — disabled until players are assigned.

## Issues, by priority

### HIGH — 1. Dark theme is off-standard
The setup page is dark navy. Per our standard ("Home is the standard; **only the actual scorers
are dark**"), the *setup* page should be warm-light (paper, diagonal hatch, feathered cards) like
the rest of the app. This is the single biggest visual inconsistency and likely a big part of the
"a lot going on" feeling. The dark scoring screens stay dark; setup should not be one of them.

### HIGH — 2. The page header repeats on every step
"PLAY NOW / SCORER SETUP / Pick players… / Player Hub / Challenge" eats ~30% of the screen on
**every** step. In a wizard it should appear once (Step 1), then collapse to a slim title bar on
Steps 2–3. The **Player Hub** and **Challenge** buttons are navigation that doesn't belong inside a
focused build flow — move them to the avatar/nav or drop them. Removing this repeat will make each
step feel far lighter.

### MED-HIGH — 3. Step 2 (Game) is still dense
Even with disclosure, 501 shows 8 fields (game type, legs, leg mode, sets, start scoring, finish
rule, start rule, cork option). Two trims:
- **Sets** defaults to `0` with a stepper ("Sets 0" reads oddly). Hide it behind a "Multiple
  sets?" toggle — most casual games are single-set.
- **Start rule + Cork option** are advanced; tuck them under an "Advanced / cork rules"
  collapsible (collapsed by default). That drops the common 501 view to ~4 fields
  (game type, legs, leg mode, in/out rules).

### LOW — 4. Step 3 ordering
"Record stats to player portal" toggle sits **above** the Review. Put Review first, then the
optional stat toggle, then Start — reads more naturally as a confirm screen.

### LOW — 5. Cork option dropdown text truncates
"Alternate, random first/decidi…" clips. Shorten the option labels or widen the control.

### LOW — 6. Progress dot labels hidden on mobile
Below 520px the dot labels (Players/Game/Start) are hidden, leaving bare 1·2·3. Consider keeping
short labels — they orient first-time users.

## Not yet verified
- **Start hand-off**: did not click Start (it launches a real game). Should confirm the launch
  carries the selected players + game type + rules into the X01/Cricket scorer correctly.

## Suggested next session order
1. Warm the theme to the light standard (biggest win, fast).
2. Collapse the repeating header → slim title on steps 2–3; relocate Player Hub/Challenge.
3. Trim Step 2 density (Sets behind a toggle; cork/start-rule under Advanced).
4. Reorder Step 3 (Review → stat toggle → Start).
5. Click Start once and verify the scorer hand-off.

Overall: the click-through was the right call — it's functional and the bones are good. It just
needs to look like the rest of the app and shed the header/field clutter.
