#!/usr/bin/env python
"""
flywheel.py — the darts-vision FOREVER loop. Vision sibling of the MC3 coder
flywheel (flywheel-tools/tiny_loop + loop-eval). Same shape, different modality:

  MC3 coder flywheel                    darts-vision flywheel
  ──────────────────                    ─────────────────────
  Warden polls job queue           →    poll the dataset for new labeled frames
  Coder builds (tiny→mid→big)      →    train.py fine-tunes YOLOv8n on the 3090
  layer_gates / bigloop_gate       →    mAP eval gate (in train.py)
  RESPEC self-fix                  →    RESPEC: hold for more/varied data
  ship → looptlab                  →    ship ONNX → brdc public/models/dart
  floor_probe (smallest model that →    floor-probe: smallest imgsz/model that
    holds the contract)                   still holds dart-tip accuracy
  build traces → QLoRA → floor↓    →    deployed model SELF-HARVESTS: its confident
                                          detections (cross-checked vs the classical
                                          engine, human only on disagreement) become
                                          the next training set → retrain → floor↓
  north star: 0.5B coder in WebGPU →    north star: tiny dart net in WebGPU (already)

"runs forever and learns": the model that's deployed generates the data that
trains its successor. Capture seeds it; self-harvest sustains it.

Usage:
  .venv\\Scripts\\python.exe flywheel.py            # run the forever loop
  .venv\\Scripts\\python.exe flywheel.py --once     # one cycle then exit
  .venv\\Scripts\\python.exe flywheel.py --status   # print state and exit
  .venv\\Scripts\\python.exe flywheel.py --floor    # floor-finding sweep
"""
import argparse, json, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DS = ROOT / "dataset"
STATE = ROOT / "flywheel_state.json"
LOG = ROOT / "flywheel.log"
PY = str(ROOT / ".venv" / "Scripts" / "python.exe")

# ── tunables (mirror MC3's gate/threshold knobs) ──
RETRAIN_DELTA = 40     # retrain after this many NEW labeled frames since last train
MIN_TRAIN     = 120    # don't train below this (train.py also guards)
MIN_VAL       = 20
GATE          = 0.75   # mAP50-95 floor to ship
POLL_SECONDS  = 120    # how often the forever loop checks for new data
FLOOR_SIZES   = [640, 512, 416, 320]  # floor-finding: smallest imgsz that still passes


def now():
    # flywheel runs on the wall clock of the host; subprocess stamps real time
    return subprocess.run([PY, "-c", "import datetime;print(datetime.datetime.now().isoformat(timespec='seconds'))"],
                          capture_output=True, text=True).stdout.strip()


def count():
    tr = len(list((DS / "images/train").glob("*.jpg"))) if (DS / "images/train").exists() else 0
    va = len(list((DS / "images/val").glob("*.jpg"))) if (DS / "images/val").exists() else 0
    return tr, va


def load_state():
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"version": 0, "last_train_count": 0, "best_map": 0.0, "history": [], "floor_imgsz": None}


def save_state(s):
    STATE.write_text(json.dumps(s, indent=2))


def logline(msg):
    line = f"{now()}  {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def train_cycle(state, imgsz=640, gate=GATE):
    """One build cycle: invoke train.py (train→gate→export→ship). Returns verdict."""
    tr, va = count()
    logline(f"CYCLE v{state['version']+1}: train={tr} val={va} imgsz={imgsz} gate={gate}")
    r = subprocess.run([PY, str(ROOT / "train.py"), "--imgsz", str(imgsz), "--gate", str(gate)],
                       cwd=str(ROOT))
    # train.py exit codes: 0 ship, 2 HOLD(too little), 3 RESPEC(below gate)
    if r.returncode == 0:
        meta = json.loads((Path("E:/projects/brdc-firebase/public/models/dart/dart-model.json")).read_text())
        state["version"] += 1
        state["last_train_count"] = tr
        state["best_map"] = max(state["best_map"], meta["mAP50_95"])
        state["history"].append({"v": state["version"], "t": now(), "verdict": "SHIP",
                                 "map": meta["mAP50_95"], "train": tr, "val": va, "imgsz": imgsz})
        save_state(state)
        logline(f"SHIP_DONE v{state['version']}  mAP={meta['mAP50_95']}  imgsz={imgsz}")
        return "SHIP"
    elif r.returncode == 3:
        state["last_train_count"] = tr  # don't spin on the same data
        state["history"].append({"v": "-", "t": now(), "verdict": "RESPEC", "train": tr, "val": va})
        save_state(state)
        logline("RESPEC: below gate — need more/varied frames (lighting, angles, dart counts)")
        return "RESPEC"
    else:
        logline(f"HOLD: train.py exit {r.returncode} (not enough data yet)")
        return "HOLD"


def floor_sweep(state):
    """Find the smallest imgsz that still passes the gate — the vision 'floor_probe'."""
    logline("FLOOR sweep: smallest imgsz that still holds dart accuracy")
    passing = None
    for sz in FLOOR_SIZES:
        v = train_cycle(state, imgsz=sz)
        if v == "SHIP":
            passing = sz  # keep going smaller
        else:
            break
    state["floor_imgsz"] = passing
    save_state(state)
    logline(f"FLOOR = imgsz {passing} (smallest that ships). Smaller = faster WebGPU inference.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--floor", action="store_true")
    args = ap.parse_args()
    state = load_state()

    if args.status:
        tr, va = count()
        print(json.dumps({**state, "train_now": tr, "val_now": va,
                          "new_since_train": tr - state["last_train_count"],
                          "retrain_at": state["last_train_count"] + RETRAIN_DELTA}, indent=2))
        return
    if args.floor:
        floor_sweep(state); return

    logline(f"flywheel up. retrain_delta={RETRAIN_DELTA} gate={GATE} poll={POLL_SECONDS}s")
    while True:
        tr, va = count()
        new = tr - state["last_train_count"]
        if tr >= MIN_TRAIN and va >= MIN_VAL and new >= RETRAIN_DELTA:
            train_cycle(state)
        else:
            need = max(0, RETRAIN_DELTA - new)
            gate_reason = (f"+{need} new frames" if tr >= MIN_TRAIN
                           else f"{MIN_TRAIN - tr} more to reach {MIN_TRAIN} floor")
            logline(f"HOLD: train={tr} val={va} - waiting for {gate_reason}")
        if args.once:
            break
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
