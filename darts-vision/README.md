# BRDC darts-vision — auto-score model (Option B)

Small in-browser vision model for dart auto-scoring. The robust, "snaps every time"
successor to the classical CV engine in `brdc-firebase/public/js/autoscore-engine.js`.

**Architecture:** YOLOv8-nano detector, 5 classes — `cal_top/right/bottom/left`
(board calibration points) + `dart` (tip). Runs **in-browser via onnxruntime-web on
WebGPU** (spike measured ~7ms/140fps on a 14MB model — real-time with headroom). No
server, no API, no cloud GPU. Scoring math reuses the existing engine's homography →
polar → segment pipeline; the model just replaces the fragile *detection* step.

## The self-teaching loop (plan C, seeded by A)

```
  classical engine ──auto-labels──► dataset ──trains──► YOLO model ──exports──► ONNX
        ▲                                                                          │
        └────────────── the model surpasses the engine that taught it ◄───────────┘
```

The classical auto-calibration becomes the **auto-labeler** that bootstraps training
data on the *actual BRDC board*. A COCO-pretrained nano gives the general-object prior
(the lightweight "seed by A"); optional DeepDarts-dataset pretraining can be added.

## Pipeline

### 1. Capture (human-in-the-loop, ~20-30 min at the board)
Local server + capture page (in the brdc-firebase repo):
```
cd E:\projects\brdc-firebase && node scripts/qa/serve-public.mjs 5601
# open http://localhost:5601/pages/autoscore-capture.html
```
Per turn: auto-calibrate (one tap on 20) → set empty-board baseline → throw darts →
**Freeze** (classical detector auto-proposes tips) → drag/fix dots, right-click to
delete, click empty to add → **Save**. Writes `dataset/{images,labels}/{train,val}/`.
Toggle "val split" on ~1 in 5 saves. **Target: 150+ frames** across varied lighting,
dart angles, and 1/2/3-dart counts.

### 2. Train + gate + ship (on the local 3090)
```
.venv\Scripts\python.exe train.py            # train -> eval -> gate -> export ONNX
.venv\Scripts\python.exe train.py --gate 0.80 --epochs 150
```
MC3-style: trains from `yolov8n.pt`, evaluates mAP against a gate. On PASS it exports
an ort-web ONNX to `brdc-firebase/public/models/dart/dart-yolov8n.onnx` + a meta json.
On FAIL it says RESPEC (capture more/more-varied data) instead of shipping junk.

### 3. Wire into the lab
Swap the classical detector for the ONNX model in the scorer-cam flow (next build
step after a model ships). Keep the classical engine as the offline fallback.

## Env
- Python 3.12 venv at `.venv` · torch 2.9.1+cu126 · ultralytics 8.4 · onnx · onnxruntime
- GPU: local RTX 3090 (24GB)
- Dataset + runs live here (gitignored from the firebase repo).

## The flywheel (runs forever, learns) — `flywheel.py`

Vision sibling of the MC3 coder flywheel. Same shape:

| MC3 coder flywheel | darts-vision flywheel |
|---|---|
| Warden polls the job queue | poll the dataset for new labeled frames |
| Coder builds (tiny→mid→big) | `train.py` fine-tunes YOLOv8n on the 3090 |
| `layer_gates`/`bigloop_gate` | mAP eval gate |
| RESPEC self-fix | RESPEC: hold for more/varied data |
| ship → looptlab | ship ONNX → brdc `public/models/dart` |
| `floor_probe` (smallest model that holds the contract) | floor-sweep: smallest imgsz that holds dart accuracy → faster WebGPU |
| build traces → QLoRA → floor↓ | **self-harvest**: deployed model's confident detections, cross-checked vs the classical engine, become the next training set → retrain → floor↓ |
| north star: 0.5B coder in WebGPU | north star: tiny dart net in WebGPU (already there) |

```
.venv\Scripts\python.exe flywheel.py            # the forever loop
.venv\Scripts\python.exe flywheel.py --status   # version, mAP, new-since-train
.venv\Scripts\python.exe flywheel.py --floor    # floor-finding sweep
```
Capture seeds it; the deployed model self-harvests to sustain it.

## Status
- [x] In-browser WebGPU ONNX inference proven (7ms/140fps)
- [x] `onnx-detector.js` — load + letterbox + infer + YOLOv8 decode + NMS, **validated on COCO**
- [x] Auto-label capture tool, verified end-to-end on the real board
- [x] `train.py` — fine-tune + mAP gate + ONNX export/ship (export path proven)
- [x] `flywheel.py` — forever-loop + gate/RESPEC + floor-sweep + self-harvest hooks (runs, HOLDs correctly)
- [x] torch 2.9.1+cu126 on the local RTX 3090
- [ ] **Capture session — needs hands-on darts at the board** ← only thing left to ignite
- [ ] First model trained + shipped (flywheel auto-fires at 120 frames)
- [ ] Wire `onnx-detector.js` into the scorer-cam + self-harvest POST
- [ ] (optional) DeepDarts-dataset pretrain booster
