# Auto-Score Lab — CV dart detection (2026-06-09)

**What:** The camera scores the darts. First real implementation of the planned
"board cam auto-scoring" feature — until now, score assist was a human typing
candidates on the board phone.

## Pieces

| File | Role |
|---|---|
| `public/js/autoscore-engine.js` (?v=3) | Pure engine: board geometry + polar scoring, 4-point homography calibration, frame-diff dart detection, PCA thin-end tip finding, turn state machine. No DOM deps — runs in browser and Node. |
| `public/pages/autoscore-lab.html` | Test surface: Camera mode (tap-4 calibration → live detection), Photo mode (load a board photo, tap dart tips to verify scores), in-browser self-test. Dark scorer-family theme. |
| `scripts/qa/autoscore-engine-test.mjs` | 125-test Node suite. Run: `node scripts/qa/autoscore-engine-test.mjs` |

## How it works
1. **Calibrate:** tap 4 landmarks (double-ring outer edge at top-of-20, right-of-6,
   bottom-of-3, left-of-11) → homography from camera pixels to board millimeters.
   Saved to localStorage; survives reloads while the camera doesn't move.
2. **Detect:** downscaled grayscale frames (~320w, ~7fps) diffed against a settled
   baseline. Big diff = player at board (ignored). Small persistent diff = dart:
   blob → principal axis → **thin end = tip**. Dart folded into baseline; next
   diff finds dart 2, 3.
3. **Score:** tip px → homography → mm → polar → segment/ring (official radii:
   bull 6.35/15.9, triple 99–107, double 162–170).
4. **Turn reset:** when the board returns to its turn-start image (threshold scales
   with the accumulated dart footprint — NOT an absolute fraction), darts were
   pulled → new turn.
5. **Feed:** with `?session=CODE`, "Send to scorer" posts the turn to
   `streaming_sessions/{code}/autoscore_candidates` (same path as manual score
   assist; scorer confirms before applying). Board-phone score-assist panel in
   stream-camera.html links here with the session code attached.

## Verification done (2026-06-09, all passing)
- **Node suite 125/125**: every segment × ring (80), wedge boundaries, bulls, edge
  radii, homography round-trip through a synthetic oblique camera (<0.05mm),
  degenerate + NaN calibration rejection, tip detection both orientations,
  noise/denoise, full simulated turn, small-dart false-reset regression.
- **In-browser self-test 8/8** on the deployed code path.
- **True end-to-end in browser**: mocked `getUserMedia` with a synthetic board
  canvas stream → calibrated via real UI click events → drew darts onto the
  synthetic board → detector scored **T20=60 (73% conf), then D16=32 (69%), turn
  total 92** → pulled darts → clean turn reset. Production pipeline, zero stubs.

## Bugs the e2e run caught (both fixed + regression-tested)
1. `computeHomography` silently produced an all-NaN calibration from non-finite
   input (NaN comparisons bypass the degeneracy guard) → now throws.
2. False "darts pulled" reset right after each dart when the dart footprint was
   under the absolute reset threshold → threshold now scales with accumulated
   dart area.

## Real-board test (Donnie, ~10 min)
1. Phone → `burningriverdarts.com/pages/autoscore-lab.html` (board cam mount,
   board filling most of the frame, steady light).
2. Start camera → Calibrate → tap the 4 guided landmarks → cyan ring overlay
   should hug the real rings. If not, recalibrate.
3. **Photo-mode sanity first** (optional): photograph board with 3 darts, load in
   Photo mode, calibrate, tap each dart tip → check labels.
4. Camera mode → Start detecting → throw a turn. Watch chips + log.
5. From a streaming session: board phone → score assist panel → "Try Auto-Score
   (beta)" link carries the session code; Send to scorer posts candidates.

## Tuning knobs (createDetector opts) if real-world flaky
`pixelThreshold` (28) — lighting sensitivity; `handFrac` (0.06) — player-present
cutoff; `minDartArea` — min dart size px; `stableFrames` (3) — settle frames;
detection interval 130ms in lab page.

## v4 hardening (2026-06-11, Fable review) — DEPLOYED LIVE
Fresh-eyes review found two real-world holes in the detector state machine; both
fixed + regression-tested (suite now **133/133**, device self-test 8/8 on v4):
1. **MOTION deadlock**: a stale baseline (auto-exposure shift after the player
   leaves frame, camera bump, detection started with someone at the board) left
   the detector in MOTION forever. Now: if the scene is frame-to-frame STATIC
   (≤ stillEps px) for `deadlockFrames` (15) while far from baseline, the scene
   is adopted as the new baseline → `{type:'rebaseline'}` event, turn cleared.
2. **One-frame glint = phantom dart pair**: a transient reflection used to mint
   a dart AND poison the baseline (second phantom on revert). Now a dart-sized
   diff must persist with a consistent footprint for `confirmFrames` (2)
   evaluations — also means the scored frame is settled, not the arrival frame.
Engine bumped to `?v=4`; **deployed to burningriverdarts.com (sw brdc-v82)** —
the live URL in the test steps below now actually serves the lab (pre-v82 it
was the SPA catch-all; only localhost:5601 worked).

## Known limits (v1, by design)
- Single camera: tip = thin end of the visible blob; steep parallax or a dart
  occluding another can mis-locate the tip. Two-camera fusion is the v2 path.
- Fixed camera assumed between calibration and play (recalibrate if bumped).
- Robocam wobble, flickering bar TVs in frame, or someone walking through =
  motion noise; the state machine waits out anything big, but persistent partial
  occlusion can confuse the baseline.
