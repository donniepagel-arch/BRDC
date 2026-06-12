# Camera Auto-Scoring (Computer Vision) — Scope (2026-06-07)

## Where things stand
Today's "auto-score" is a **manual relay**: a person on the board phone types each score; it shows on
the scorer as a "Score Assist" card to Approve/Reject. **No computer vision exists.** This doc scopes
the net-new CV build that would make it actually automatic.

## The good news: the integration surface already exists
A CV detector does **not** need new plumbing. It just has to write the **same documents** the manual
board phone already writes:

```
streaming_sessions/{sessionCode}/autoscore_candidates
  { game:'x01'|'cricket', score|darts, darts, source, status:'candidate', confidence, timestamp }
```

The relay (Firestore `onSnapshot`) and the scorer's **Score Assist** UI (Apply → `submitScore()`) are
already built and **verified working** (round-trip tested 2026-06-07). So the CV project is isolated to
ONE job: **turn the board-camera image into a score candidate.** Everything downstream is done.

## The hard part (the whole project, really)
Reliable dart scoring from a single phone camera is a real ML problem:
1. **Board calibration / pose** — find the board, its orientation, and the 20 segments + rings + bull
   (homography from the board's known geometry). Must survive camera angle, lighting, glare, occlusion
   by the player's hand/dart.
2. **Dart detection** — locate each dart **tip** (not body), per throw, and map the tip to a segment +
   ring → score. The tip is small and often occluded/angled.
3. **Temporal logic** — know *when* a dart has landed (frame diff before/after), handle 1–3 darts per
   turn, bounce-outs, and the player reaching in to pull darts.
4. **Confidence** — every candidate needs a calibrated confidence so the scorer can gate auto-apply.

## Approaches (pick one to prototype)
| Option | Where it runs | Pros | Cons |
|---|---|---|---|
| **A. In-browser** (TF.js / MediaPipe / OpenCV.js) on the board phone | client | no server cost; reuses `stream-camera.html`; private | phone compute limits; harder accuracy; big model download |
| **B. Server CV** — board phone streams frames to Cloud Run (Python + OpenCV/YOLO) | server | real compute, better models, easier iteration | latency, $ per frame, upload bandwidth |
| **C. Off-the-shelf / existing models** (e.g. open-source DeepDarts-style dartboard models) | either | huge head start; published accuracy | licensing; usually tuned to specific camera setups; may need retrain |

**Recommendation:** don't build the vision from scratch first. **Prototype with an existing
open-source dart-detection model + a small labeled clip from the actual venue camera angle** to get a
real accuracy read before committing. If accuracy on *our* board/lighting is usable, wrap it
(Option B server-side is easiest to iterate) and have it emit `autoscore_candidates` with confidence.

## Phased plan
- **Phase 0 — DONE:** manual board-phone relay + scorer Score Assist (works; keep as the fallback).
- **Phase 1 — Calibration + single-frame detection:** board pose + per-turn dart-tip → segment → write
  candidate (confidence included). **Human still confirms.** This is the milestone that proves CV is
  viable here.
- **Phase 2 — Temporal robustness:** detect dart-landing via frame diff; handle 1–3 darts, bounce-outs,
  hand occlusion.
- **Phase 3 — Confidence-gated auto-apply:** above a threshold, auto-submit without the human tap;
  below it, fall back to the Phase-0 manual card.

## Integration checklist (when CV is ready)
- Emit to `streaming_sessions/{code}/autoscore_candidates` with `{score|darts, confidence, source:'cv'}`.
- Reuse the existing session-code handshake (scorer derives `buildStreamingSessionCode(...)`).
- Extend the assist beyond tournament matches (today `initTournamentAutoscoreAssist` only binds for
  `tournament:<id>:<matchId>` — add league/casual).
- Add a confidence threshold setting in the scorer for Phase 3 auto-apply.

## Honest take
The **streaming + manual-assist** half is built and (data-layer) working — a guided live test is all
that's left there (see `LIVESTREAM-TEST-RUNBOOK-2026-06-07.md`). The **vision** half is a genuine
multi-week ML effort whose success hinges entirely on detection accuracy at the real venue camera
angle/lighting — so it should start as a **time-boxed accuracy prototype**, not a full build.
