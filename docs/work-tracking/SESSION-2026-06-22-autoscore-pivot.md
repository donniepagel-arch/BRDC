# SESSION WRAP-UP — BRDC Auto-Scoring (2026-06-21 → 22)

> Written for a **folder-shift**. Read the ⚠️ section FIRST — that's what breaks if you move things.
> Reconstructed by reading through the full session + verifying files on disk.

---

## ⚠️ BEFORE YOU MOVE ANY FOLDERS — do these two things

### 1. COMMIT first (uncommitted work that a move can lose/scramble)
`git status` in `E:\projects\brdc-firebase` showed real work NOT yet committed (HEAD was `4250bf8`):

**Modified (tracked):**
- `public/pages/autoscore-lab.html` — engine v-bumps, harvest, CV-cal wiring
- `public/pages/autoscore-capture.html` — CV-cal + loupe
- `scripts/qa/serve-public.mjs` — **the new HTTPS frame-relay** (`/stream-push`, `/stream-latest`, short aliases)

**New / untracked (the bulk of the session — easy to lose in a move):**
- `public/pages/autoscore-streamer.html` — phone camera → `/stream-push`
- `public/pages/autoscore-labeler.html` — tablet/iPad labeler (loupe + CV-cal + iOS hardening + Undo)
- `public/js/loupe.js` — iMessage-style magnifier loupe
- `darts-vision/cvcal.py` — **classical CV auto-calibration (works — keep)**
- `darts-vision/synth.py` + `darts-vision/synth/` — synthetic frame generator (deferred)
- scratch (safe to delete): `darts-vision/_calframe.jpg`, `_checklabel.py`, `_cvcal_vis.png`, `_cvcal_zoom.png`, `_labelcheck.png`, `_live.jpg`

➡️ **Recommended:** commit the real files (`autoscore-streamer/labeler.html`, `loupe.js`, `cvcal.py`, `synth.py`, the 3 modified). Note: `darts-vision/_*` scratch is **not** gitignored yet — don't blanket `git add -A`, or add `_*` to `darts-vision/.gitignore` first.

### 2. Hardcoded absolute paths that BREAK on move
If `brdc-firebase` (or `darts-vision`) changes location, update these:
| File:line | Hardcoded path |
|---|---|
| `darts-vision/dataset/data.yaml:2` | `path: E:/projects/brdc-firebase/darts-vision/dataset` |
| `darts-vision/train.py:22` | `SHIP_DIR = E:/projects/brdc-firebase/public/models/dart` |
| `darts-vision/flywheel.py:85` | `E:/projects/brdc-firebase/public/models/dart/dart-model.json` |
| `darts-vision/synth.py:5` | comment ref to `E:/viral attack/...` (harmless, comment only) |

**Structural dependency:** `scripts/qa/serve-public.mjs` finds the dataset via a **relative** hop — `path.resolve(root, '..', 'darts-vision', 'dataset')` (root = `public/`). So `darts-vision/` **must stay a sibling of `public/` inside `brdc-firebase`.** Moving `brdc-firebase` whole = fine. Pulling `darts-vision` out on its own = breaks capture writes.

**Regeneratable (don't sweat):** `scripts/qa/_lan-cert.pem` / `_lan-key.pem` (self-signed LAN cert) — regenerate with `MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -keyout _lan-key.pem -out _lan-cert.pem -days 825 -subj "/CN=192.168.40.51" -addext "subjectAltName=IP:192.168.40.51,DNS:localhost"`.

---

## THE STRATEGIC PIVOT (the headline)
Auto-scoring stopped being "a feature" and became **the input layer / sensor** the whole platform stands on. Two shipped products prove the phone-cam thesis: **DartsMind** (single phone, on-device AI, ~3 misreads/100) and **GranEye** (dual-camera). We build our own *because BRDC's moat is the layer on top* — league, tournaments, **handicaps** (auto-tracked skill → fair mixed matchups, the BRDC-only feature), online play, deep stats. Scoring is commodity; the platform is the differentiator.

**Unlock once it works:** live league scoring → training modes (trainers already built, just need real input) → handicaps → remote 2-phone play → heatmap/segment stats.

---

## DONNIE'S TEACHER RIG (tomorrow's experiment)
DartsMind on the **iPhone** (oracle) + BRDC on the **Android/webcam** (capture) + **one webcam seeing the board AND both phone screens** → the board state and DartsMind's verdict are in the *same frame*, auto-synced, no API. Three things to get right:
1. **Train on the camera you'll DEPLOY on** (domain match). Fixed **webcam/pi at the board** → train on it. Deploy on a phone → the phone must be the capture cam. **Make-or-break.**
2. **DartsMind gives a SCORE, not a tip pixel** (YOLO needs pixels). Use it as a **validator**: detector proposes a tip → homography → score → keep the (frame, tip) pair only if it matches DartsMind. Auto-curates pixel-perfect ground truth, hands-free.
3. Read the score by **screen-mirroring the iPhone** (clean digital read) rather than OCR-ing its screen through the webcam.

---

## KEY LEARNINGS (so we don't relitigate)
- **Classical tip detection can't reliably find the steel tip** — thin + low-contrast once buried, under-captured by frame-diff. It's a **MODEL problem**, not a CV-tuning problem. `findDartTip` in `autoscore-engine.js` was **reverted to original** (don't re-chase heuristics).
- **CV auto-calibration WORKS** (`cvcal.py`): HSV-threshold red+green rings → drop logo/rug outliers (central, thin, ring-shaped components) → convex-hull → fit ONE ellipse = outer double ring → lock center to the **bull** (compact red blob) → snap rotation from the red/green double-segment pattern. Replaces the fragile wedge-crossing auto-cal that kept failing ("10 crossings, want 20").
- **WiFi-adb is the enemy** (daemon self-restarts; drops on phone sleep/reboot; needs USB re-arm). Went **fully adb-free** via **HTTPS on the LAN** so the phone camera works over `https://192.168.40.51:5601` (https = secure context = `getUserMedia` allowed), no tunnel.
- **Phone must stay perfectly still** (touching it ruins calibration) → two-device companion-labeler pattern (phone streams, iPad labels).

---

## LIVE INFRA / RE-SETUP FACTS
- **PC LAN IP:** `192.168.40.51` (Ethernet). **A12 Android:** `192.168.40.37` (USB id `R58T20EY46B`) — dev stand-in only now; real capture target = **iPhone**.
- **Server:** `node scripts/qa/serve-public.mjs 5601 --https` from `E:\projects\brdc-firebase` (binds `0.0.0.0`). Servers are **down** when idle — restart on resume.
- **Short URL aliases** (typo-proof, in serve-public.mjs): `/lab` `/labeler` `/cap` `/streamer` `/stream` `/cam`.
- **Devices need WiFi only** + accept the self-signed cert once. Phone streamer holds a **screen wake-lock** so it won't sleep.
- **BRDC deploy (unchanged, in CLAUDE.md):** `firebase deploy --only hosting --config firebase.current-apex-hosting.json --project dashboard-ll` → burningriverdarts.com. Auto-score pages are local dev tooling, **not** deployed.

---

## FIRST MOVES NEXT SESSION
1. **Commit + (then) move folders** per the ⚠️ section.
2. **Decide labeling strategy** (gates everything): **(A)** DartsMind/GranEye teacher-validator → fast ground truth [recommended], vs **(B)** hand-label on iPhone with the loupe.
3. **Lock the deploy camera** (webcam/pi vs iPhone) → that's the training camera.
4. Capture a first **real labeled batch** from the deploy camera → train a **v0 model** (`darts-vision/`: `train.py` → `flywheel.py` → ONNX → `onnx-detector.js` already wired in the lab).
5. **Wire scored throws into a BRDC match** (the integration that makes it a platform feature).

## STILL OPEN (not locked)
- On-device model vs. consume-existing scorer for the *league* v0.
- How a scored throw enters a BRDC match (confirm UI/flow).
- Which mode ships first as proof (live league scoring vs a training drill).
- Loupe labeler is **deferred** — may be unneeded if the teacher auto-labels. Don't invest more until strategy (#2) is chosen.
