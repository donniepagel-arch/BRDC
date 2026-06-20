# RESUME — Auto-Score Capture Session (2026-06-15)

Grounding note before a `/compact`. The auto-score CV stack is **built + deployed**; the
only thing left to light the training flywheel is a **real capture session on the A12**,
which is **set up right now and waiting on one human tap.**

## THE ONE BLOCKER (do this first on resume)
The A12 is mounted at the board with the **Auto-Score Lab open and loaded clean**
(`http://localhost:5601/pages/autoscore-lab.html`, screen 385×854, 0 console errors,
camera permission = "prompt"). **Donnie must tap "Start camera" → Allow** on the phone
(the native permission dialog needs a real gesture; an injected click won't trigger it).
Once the stream is live, I drive the rest over WiFi-adb.

## LIVE CONNECTION STATE (re-establish if any dropped)
- **A12**: WiFi-adb `192.168.40.37:5555` (re-armed via `adb tcpip 5555`) **and** USB `R58T20EY46B` (SM-A125U). A stray `emulator-5554` is also connected — always target the A12 explicitly with `-s`.
- **ADB**: `C:\Users\gcfrp\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- **Local server**: `node scripts/qa/serve-public.mjs 5601` (serves `public/`; endpoints `/capture`, `/capture/stats`, `/snap`, `/__qa/*`). Run from `E:\projects\brdc-firebase`.
- **Bridges (on the WiFi transport)**:
  ```bash
  ADB="C:/Users/gcfrp/AppData/Local/Android/Sdk/platform-tools/adb.exe"
  "$ADB" connect 192.168.40.37:5555
  "$ADB" -s 192.168.40.37:5555 reverse tcp:5601 tcp:5601      # phone localhost:5601 → PC server (camera needs localhost = secure ctx)
  "$ADB" -s 192.168.40.37:5555 forward tcp:9222 localabstract:chrome_devtools_remote   # so I can watch via CDP
  ```
- **Open the lab on the phone**: `"$ADB" -s 192.168.40.37:5555 shell "am start -a android.intent.action.VIEW -d 'http://localhost:5601/pages/autoscore-lab.html' com.android.chrome" < /dev/null`
- **Watch/eval the lab over CDP**: `node scripts/qa/droid-eval-url.mjs scripts/qa/_expr_lab.js "autoscore-lab"` (expr file holds the in-page check; both are gitignored `_*` scratch). Pull a frame: page POSTs a canvas dataURL to `/snap`, then Read `scripts/qa/_snap.jpg`.

## THE CAPTURE FLOW (once camera is live)
1. **Auto-calibrate**: I tap "Auto-calibrate" then one tap inside the 20 wedge → homography. Verify the cyan rings hug the real board through the low-end A12 cam (the point of this test — real-world, lower-end phone).
2. **Capture/label**: `autoscore-capture.html` is the labeling surface (Freeze → drag dots to the true tips → Save → POST `/capture`). OR the lab's 🌾 harvest toggle auto-saves classical detections — but classical **mis-locates at the board edge** (proven: a real D20 scored MISS via single-cam parallax), so the **capture tool's manual-correct is the trustworthy path** for clean labels.
3. Frames land in **`E:/projects/darts-vision/dataset/{images,labels}/{train,val}`** (serve-public.mjs `/capture` writes there; ~80/20 split).
4. At **120 train + 20 val frames**, `flywheel.py` (in `E:\projects\darts-vision`, py3.12 venv on the 3090) auto-trains YOLOv8n → mAP gate → exports ONNX to `public/models/dart/` → the lab's `onnx-detector.js` picks it up (WebGPU, proven 7ms/140fps).

## STATE OF THINGS (so nothing's re-litigated)
- **Built + deployed (sw v90)**: classical engine + auto-cal + edge-snap (`autoscore-engine.js`), `onnx-detector.js` (in-browser YOLO, WebGPU), shared realistic `dartboard-render.js`, the aim game + checkout/cricket trainers (with dart-flight + target-hide). All live on burningriverdarts.com, all in the BRDC repo (pushed).
- **darts-vision** (`E:\projects\darts-vision`): the Python training flywheel — committed locally, has `requirements.txt`. **NOT yet folded into BRDC** (recon done: would move the dir into `brdc-firebase/darts-vision/`, fix `data.yaml` path + `serve-public.mjs`'s `../../darts-vision` → `../darts-vision`, drop the inner `.git`; same-drive so `mv` is instant). Pending finalization item — but capture works as-is at the current sibling path.
- **Repo hygiene done this session**: scratch QA artifacts untracked (`scripts/qa/_*` gitignored, kept on disk), stray worktree pruned, CLAUDE.md slimmed 1580→88 lines (full rules in `docs/CLAUDE-RULES-REFERENCE.md`).

## PENDING (after capture lights the flywheel)
- Fold `darts-vision/` into BRDC (above) — backup/consolidation.
- Donnie eyes-on / feel-test: the dart-flight anticipation, the games + trainers, real throws.
- Trader rule eyes-on (edit one of his listings to confirm the firestore rule).
