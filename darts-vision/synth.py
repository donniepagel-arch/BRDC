#!/usr/bin/env python3
"""Synthetic labeled dart-frame factory — volume data for the YOLO flywheel.

The flywheel is data-starved: hand-thrown + hand-labeled frames are slow. This
ports the reusable trick from `E:/viral attack/runtime/layered.py` — paste a
transparent layer onto a background at a KNOWN pixel position and the position
IS the label — to manufacture perfectly-labeled dart frames with zero throwing.

Pipeline (per frame):
  pick a clean board background (with its 4 known cal-point pixels)
    -> sample N dart-tip positions on the board face
    -> rotate a dart sprite about its TIP, alpha_composite so the tip lands there
    -> emit YOLO labels: cal_top/right/bottom/left (0-3) + each dart tip (4)
  light domain randomization (brightness/contrast/blur, sprite scale/rotation, count)

Backgrounds:  synth/backgrounds/<name>.jpg  +  <name>.json
  {"w":720,"h":1280,"cal":{"top":[x,y],"right":[x,y],"bottom":[x,y],"left":[x,y]}}
Sprites:      synth/sprites/<name>.png  (RGBA)  + optional <name>.json {"tip":[x,y]}
  If no sprites exist, procedural dart silhouettes are drawn (tip at bottom-center).

Label box matches the lab's harvest exactly: box = max(16, round(W*0.02)).

Usage:
  .venv/Scripts/python.exe synth.py --n 2000           # 2000 frames, 80/20 split
  .venv/Scripts/python.exe synth.py --n 50 --preview    # also dump label-overlay PNGs to synth/_preview
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent
SYNTH = ROOT / "synth"
BG_DIR = SYNTH / "backgrounds"
SPRITE_DIR = SYNTH / "sprites"
DS = ROOT / "dataset"
CLASS = {"top": 0, "right": 1, "bottom": 2, "left": 3, "dart": 4}


# ── sprites ──────────────────────────────────────────────────────────────────
def _procedural_dart(seed: int) -> tuple[Image.Image, tuple[int, int]]:
    """Draw a simple dart silhouette (barrel + shaft + flight), tip at bottom-center.
    Good enough to teach 'thin protruding object -> tip here'; swap in rembg cut-outs
    of real dart photos (synth/sprites/*.png) for photoreal grounding."""
    rng = random.Random(seed)
    W, H = 64, 220
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = W // 2
    barrel = rng.choice([(60, 60, 64), (40, 40, 48), (120, 90, 40), (180, 180, 190)])
    flight_col = rng.choice([(200, 40, 40), (40, 160, 60), (220, 180, 40), (40, 90, 200)])
    tip_y = H - 4
    # point (steel tip): thin triangle up from the very bottom
    d.polygon([(cx, tip_y), (cx - 3, tip_y - 26), (cx + 3, tip_y - 26)], fill=(150, 150, 155, 255))
    # barrel
    d.rounded_rectangle([cx - 7, tip_y - 110, cx + 7, tip_y - 26], radius=6, fill=barrel + (255,))
    # shaft
    d.rectangle([cx - 3, tip_y - 150, cx + 3, tip_y - 110], fill=(30, 30, 34, 255))
    # flight (two angled quads)
    d.polygon([(cx, tip_y - 150), (cx - 26, tip_y - 205), (cx - 4, tip_y - 150)], fill=flight_col + (255,))
    d.polygon([(cx, tip_y - 150), (cx + 26, tip_y - 205), (cx + 4, tip_y - 150)], fill=flight_col + (255,))
    return img, (cx, tip_y)


def load_sprites() -> list[tuple[Image.Image, tuple[int, int]]]:
    out = []
    if SPRITE_DIR.is_dir():
        for p in sorted(SPRITE_DIR.glob("*.png")):
            im = Image.open(p).convert("RGBA")
            meta = p.with_suffix(".json")
            if meta.exists():
                tip = tuple(json.loads(meta.read_text())["tip"])
            else:
                tip = (im.width // 2, im.height - 1)  # assume tip at bottom-center
            out.append((im, tip))
    if not out:  # fall back to procedural set
        out = [_procedural_dart(s) for s in range(6)]
    return out


# ── geometry ─────────────────────────────────────────────────────────────────
def board_center(cal: dict) -> tuple[float, float]:
    xs = [cal[k][0] for k in cal]
    ys = [cal[k][1] for k in cal]
    return sum(xs) / 4.0, sum(ys) / 4.0


def sample_tip(cal: dict, rng: random.Random) -> tuple[float, float]:
    """Sample a point on the board face by bilinear-blending the 4 cal corners.
    Pull slightly inward (most darts land inside the double ring); occasionally wide."""
    cxc, cyc = board_center(cal)
    # radial sample: direction + fraction of the way to a blended edge
    ang = rng.uniform(0, 2 * math.pi)
    # blend the cardinal edge points by the angle's projection
    ux, uy = math.cos(ang), math.sin(ang)
    ex = cal["right"][0] if ux >= 0 else cal["left"][0]
    ey = cal["bottom"][1] if uy >= 0 else cal["top"][1]
    rx = abs(ex - cxc)
    ry = abs(ey - cyc)
    frac = min(1.05, abs(rng.gauss(0.62, 0.26)))  # mostly inside, a few near/over the edge
    return cxc + ux * rx * frac, cyc + uy * ry * frac


def paste_dart(canvas: Image.Image, sprite: Image.Image, tip: tuple[int, int],
               at: tuple[float, float], center: tuple[float, float], rng: random.Random):
    """Rotate the sprite about its tip and alpha_composite so the tip lands at `at`.
    Barrel biased to point away from board center (tip in, flight out) + noise."""
    scale = rng.uniform(0.55, 1.05)
    sw, sh = max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale))
    s = sprite.resize((sw, sh), Image.LANCZOS)
    tx, ty = tip[0] * scale, tip[1] * scale
    # desired barrel direction: outward from center (sprite points "up" = -y by default)
    radial = math.degrees(math.atan2(at[1] - center[1], at[0] - center[0]))
    deg = -(radial - 90) + rng.uniform(-35, 35)
    # rotate about the tip: translate tip->origin via rotation center trick
    rot = s.rotate(deg, resample=Image.BICUBIC, expand=True, center=(tx, ty))
    # PIL keeps `center` fixed under expand=True, so the tip stays at (tx,ty) in the new image
    px, py = int(round(at[0] - tx)), int(round(at[1] - ty))
    canvas.alpha_composite(rot, (px, py))  # ← the viral-attack technique (layered.py:179)


# ── frame assembly ───────────────────────────────────────────────────────────
def jitter(img: Image.Image, rng: random.Random) -> Image.Image:
    img = ImageEnhance.Brightness(img).enhance(rng.uniform(0.78, 1.18))
    img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.85, 1.18))
    img = ImageEnhance.Color(img).enhance(rng.uniform(0.9, 1.12))
    if rng.random() < 0.35:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.1)))
    return img


def yolo_line(cls: int, x: float, y: float, W: int, H: int, box: int) -> str:
    return f"{cls} {x / W:.6f} {y / H:.6f} {box / W:.6f} {box / H:.6f}"


def make_frame(bg_path: Path, sprites, rng: random.Random):
    meta = json.loads(bg_path.with_suffix(".json").read_text())
    cal = meta["cal"]
    W, H = meta["w"], meta["h"]
    canvas = Image.open(bg_path).convert("RGBA").resize((W, H))
    box = max(16, round(W * 0.02))
    lines = [yolo_line(CLASS[k], cal[k][0], cal[k][1], W, H, box) for k in ("top", "right", "bottom", "left")]
    center = board_center(cal)
    n = rng.choices([1, 2, 3, 0], weights=[40, 35, 20, 5])[0]
    for _ in range(n):
        sprite, tip = rng.choice(sprites)
        at = sample_tip(cal, rng)
        paste_dart(canvas, sprite, tip, at, center, rng)
        lines.append(yolo_line(CLASS["dart"], at[0], at[1], W, H, box))
    out = jitter(canvas.convert("RGB"), rng)
    return out, "\n".join(lines) + "\n"


def overlay_preview(img: Image.Image, label: str, dest: Path):
    im = img.convert("RGB"); d = ImageDraw.Draw(im); W, H = im.size
    col = {0: (0, 255, 255), 1: (0, 255, 255), 2: (0, 255, 255), 3: (0, 255, 255), 4: (255, 200, 40)}
    for ln in label.strip().splitlines():
        c, x, y, w, h = ln.split()
        c = int(c); x = float(x) * W; y = float(y) * H; w = float(w) * W; h = float(h) * H
        d.rectangle([x - w / 2, y - h / 2, x + w / 2, y + h / 2], outline=col[c], width=2)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=500, help="frames to generate")
    ap.add_argument("--val", type=float, default=0.2, help="val split fraction")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--preview", action="store_true", help="also dump label-overlay PNGs to synth/_preview")
    ap.add_argument("--prefix", default="synth", help="filename prefix")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    backgrounds = sorted(BG_DIR.glob("*.jpg")) + sorted(BG_DIR.glob("*.png"))
    backgrounds = [p for p in backgrounds if p.with_suffix(".json").exists()]
    if not backgrounds:
        raise SystemExit(
            f"No backgrounds in {BG_DIR}\n"
            "Add clean board photos (no darts) as <name>.jpg + <name>.json:\n"
            '  {"w":720,"h":1280,"cal":{"top":[x,y],"right":[x,y],"bottom":[x,y],"left":[x,y]}}\n'
            "Use grab_bg.py to capture one from the A12 with the current calibration."
        )
    sprites = load_sprites()
    print(f"backgrounds={len(backgrounds)}  sprites={len(sprites)}  -> {args.n} frames")

    for split_dir in ("images/train", "images/val", "labels/train", "labels/val"):
        (DS / split_dir).mkdir(parents=True, exist_ok=True)

    n_train = n_val = 0
    for i in range(args.n):
        bg = backgrounds[i % len(backgrounds)] if len(backgrounds) > 1 else backgrounds[0]
        bg = rng.choice(backgrounds)
        img, label = make_frame(bg, sprites, rng)
        split = "val" if rng.random() < args.val else "train"
        name = f"{args.prefix}_{i:05d}"
        img.save(DS / f"images/{split}/{name}.jpg", quality=92)
        (DS / f"labels/{split}/{name}.txt").write_text(label)
        if split == "val":
            n_val += 1
        else:
            n_train += 1
        if args.preview and i < 24:
            overlay_preview(img, label, SYNTH / "_preview" / f"{name}.png")
    print(f"wrote train={n_train} val={n_val} into {DS}")
    if args.preview:
        print(f"previews -> {SYNTH/'_preview'}")


if __name__ == "__main__":
    main()
