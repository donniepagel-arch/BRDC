#!/usr/bin/env python
"""
BRDC dart-detector training loop (MC3-style: train -> eval-gate -> export -> ship).

Fine-tunes YOLOv8-nano (COCO-pretrained = the lightweight "seed by (a)" transfer
prior) on the auto-labeled BRDC board dataset, evaluates against a mAP gate, and
on PASS exports an ORT-web-compatible ONNX straight into the BRDC site's models
dir so the lab can load it. On FAIL it reports what's missing instead of shipping.

Usage:
    .venv\\Scripts\\python.exe train.py            # train + gate + export
    .venv\\Scripts\\python.exe train.py --epochs 150 --gate 0.80
    .venv\\Scripts\\python.exe train.py --eval-only # just score the current best
"""
import argparse, shutil, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "dataset" / "data.yaml"
RUNS = ROOT / "runs"
# ship target: same-origin models dir the lab/scorer loads from
SHIP_DIR = Path("E:/projects/brdc-firebase/public/models/dart")


def count_samples():
    tr = len(list((ROOT / "dataset/images/train").glob("*.jpg")))
    va = len(list((ROOT / "dataset/images/val").glob("*.jpg")))
    return tr, va


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--model", default="yolov8n.pt")  # COCO-pretrained nano
    ap.add_argument("--gate", type=float, default=0.75, help="min mAP50-95 to ship")
    ap.add_argument("--eval-only", action="store_true")
    args = ap.parse_args()

    import torch
    from ultralytics import YOLO

    dev = 0 if torch.cuda.is_available() else "cpu"
    tr, va = count_samples()
    print(f"[data] train={tr}  val={va}  device={dev} "
          f"({torch.cuda.get_device_name(0) if dev == 0 else 'CPU'})")
    if tr < 30 and not args.eval_only:
        print(f"[HOLD] only {tr} training images — capture more in autoscore-capture.html "
              f"(aim for 150+ for a first usable model). Not training on too little.")
        sys.exit(2)
    if va < 5 and not args.eval_only:
        print(f"[WARN] only {va} val images — gate will be noisy. Toggle 'val split' while capturing.")

    best = RUNS / "dart/weights/best.pt"
    if not args.eval_only:
        model = YOLO(args.model)
        model.train(data=str(DATA), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                    device=dev, project=str(RUNS), name="dart", exist_ok=True,
                    patience=30, degrees=8, translate=0.08, scale=0.4, fliplr=0.0,
                    mosaic=1.0, close_mosaic=15)
        best = RUNS / "dart/weights/best.pt"

    if not best.exists():
        print(f"[ERR] no trained weights at {best}")
        sys.exit(1)

    # ---- eval gate ----
    model = YOLO(str(best))
    metrics = model.val(data=str(DATA), device=dev)
    mAP = float(metrics.box.map)       # mAP50-95
    mAP50 = float(metrics.box.map50)
    print(f"[eval] mAP50-95={mAP:.3f}  mAP50={mAP50:.3f}  gate={args.gate}")

    if mAP < args.gate:
        print(f"[RESPEC] below gate ({mAP:.3f} < {args.gate}). Capture more / more varied "
              f"frames (lighting, dart angles, dart counts) and retrain. Not shipping.")
        sys.exit(3)

    # ---- export ONNX for ort-web + ship ----
    print("[ship] exporting ONNX (opset 17, simplified, static) for onnxruntime-web…")
    onnx_path = model.export(format="onnx", imgsz=args.imgsz, opset=17,
                             simplify=True, dynamic=False)
    SHIP_DIR.mkdir(parents=True, exist_ok=True)
    dst = SHIP_DIR / "dart-yolov8n.onnx"
    shutil.copy(onnx_path, dst)
    meta = {"mAP50_95": round(mAP, 4), "mAP50": round(mAP50, 4),
            "imgsz": args.imgsz, "classes": ["cal_top", "cal_right", "cal_bottom", "cal_left", "dart"],
            "train_imgs": tr, "val_imgs": va}
    (SHIP_DIR / "dart-model.json").write_text(json.dumps(meta, indent=2))
    print(f"[SHIP_DONE] {dst}  ({dst.stat().st_size//1024} KB)")
    print(f"[SHIP_DONE] meta -> {SHIP_DIR/'dart-model.json'}")


if __name__ == "__main__":
    main()
