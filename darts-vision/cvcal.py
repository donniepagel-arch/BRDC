#!/usr/bin/env python3
"""Classical auto-calibration from the board's red+green rings — no taps, no ML.

  1. HSV-threshold the high-saturation red+green ring pixels
  2. keep only central, thin, ring-shaped components (drop logo/rug outliers)
  3. convex-hull -> fit ONE ellipse = the outer double ring
  4. lock the center to the BULL (red inner-bull centroid near the ellipse center)
  5. cast up/right/down/left rays from the bull -> 4 cal points (20/6/3/11 outer-double)
  6. homography (board mm -> image) -> draw ALL rings to prove the fit hugs

Prints the 4 cal points (top/right/bottom/left) ready to feed the lab's calibrate().
"""
import json
import sys
from pathlib import Path
import cv2
import numpy as np

R = dict(singleBull=15.9, tripleInner=99, tripleOuter=107, doubleInner=162, doubleOuter=170)

argv = [a for a in sys.argv[1:] if not a.startswith("--")]
JSON_ONLY = "--json" in sys.argv          # print only {"cal":...,"bull":...}; skip the viz
src = Path(argv[0] if argv else "synth/backgrounds/board_a12_01.jpg")
img = cv2.imread(str(src))
H, W = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

S, V = 120, 60
red = cv2.inRange(hsv, (0, S, V), (12, 255, 255)) | cv2.inRange(hsv, (168, S, V), (180, 255, 255))
green = cv2.inRange(hsv, (38, S, V), (90, 255, 255))
mask = red | green
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

# keep central, ring-shaped components -> drop logo/rug
n, lab, stats, cents = cv2.connectedComponentsWithStats(mask, 8)
keep = np.zeros_like(mask)
icx, icy = W / 2, H / 2
for i in range(1, n):
    a = stats[i, cv2.CC_STAT_AREA]
    bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
    off = np.hypot(cents[i][0] - icx, cents[i][1] - icy) / W
    if a > 200 and off < 0.20 and a / max(1, bw * bh) < 0.45:
        keep[lab == i] = 255

pts = cv2.findNonZero(keep)
hull = cv2.convexHull(pts)
ell = cv2.fitEllipse(hull)                                  # outer double ring
(ecx, ecy), (d1, d2), ang = ell
a, b, th = d1 / 2, d2 / 2, np.deg2rad(ang)


def inside(px, py):                                         # point inside the fitted ellipse?
    dx, dy = px - ecx, py - ecy
    xr = dx * np.cos(-th) - dy * np.sin(-th)
    yr = dx * np.sin(-th) + dy * np.cos(-th)
    return (xr / a) ** 2 + (yr / b) ** 2 <= 1.0


# lock center to the BULL: the compact, solid red disk nearest the ellipse center
# (ring arcs are thin/low-fill; the inner bull is a small solid blob)
rn, rlab, rstats, rcents = cv2.connectedComponentsWithStats(red, 8)
bcx, bcy = ecx, ecy
best = 1e9
for i in range(1, rn):
    ra = rstats[i, cv2.CC_STAT_AREA]
    rw, rh = rstats[i, cv2.CC_STAT_WIDTH], rstats[i, cv2.CC_STAT_HEIGHT]
    fill = ra / max(1, rw * rh)
    dist = np.hypot(rcents[i][0] - ecx, rcents[i][1] - ecy)
    if 30 < ra < 2500 and fill > 0.5 and max(rw, rh) < 0.12 * W and dist < best and dist < 0.12 * W:
        best, (bcx, bcy) = dist, (rcents[i][0], rcents[i][1])

def edge_r(ux, uy):                                        # radius from bull to outer-double edge
    r = 5.0
    while inside(bcx + ux * r, bcy + uy * r) and r < max(W, H):
        r += 1.0
    return r


# Detect board ROTATION from the red/green double-segment pattern so the 4 rays land on
# true wedge CENTERS (20/6/3/11), not just image up/right/down/left. The 20 doubles
# alternate red/green every 18° -> a square wave; its phase = the wire grid offset.
hsv_full = hsv
sig = []                                                   # (+1 red, -1 green) sampled mid-double-ring
for deg in range(0, 360):
    rad = np.deg2rad(deg)                                  # 0=up, clockwise
    ux, uy = np.sin(rad), -np.cos(rad)
    rr = edge_r(ux, uy) * 0.96                             # just inside the outer double edge
    px, py = int(bcx + ux * rr), int(bcy + uy * rr)
    if 0 <= px < W and 0 <= py < H:
        sig.append(1 if red[py, px] else (-1 if green[py, px] else 0))
    else:
        sig.append(0)
sig = np.array(sig)
# wire offset: wires sit at colour sign-changes; fit them to an 18° grid (circular mean mod 18)
trans = [d for d in range(360) if sig[d] != 0 and sig[(d + 1) % 360] != 0 and sig[d] != sig[(d + 1) % 360]]
if trans:
    ph = np.angle(np.mean(np.exp(1j * np.deg2rad(np.array(trans) % 18 * 20)))) / np.deg2rad(20)
    beta = ph % 18                                         # wire grid phase (deg)
else:
    beta = 9.0
centers = (beta + 9 + np.arange(20) * 18) % 360            # wedge-center image-angles

cal = {}
for name, cdir in [("top", 0), ("right", 90), ("bottom", 180), ("left", 270)]:
    # wedge center nearest this cardinal direction (board mounted 20-up -> these ARE 20/6/3/11)
    k = int(np.argmin(np.abs((centers - cdir + 180) % 360 - 180)))
    rad = np.deg2rad(centers[k])
    ux, uy = np.sin(rad), -np.cos(rad)
    rr = edge_r(ux, uy)
    cal[name] = [round(bcx + ux * rr), round(bcy + uy * rr)]
print(f"wire phase beta={beta:.1f}  cardinals snapped to centers "
      f"{[round(centers[int(np.argmin(np.abs((centers-c+180)%360-180)))],1) for c in (0,90,180,270)]}", file=sys.stderr)

if JSON_ONLY:
    print(json.dumps({"cal": cal, "bull": [round(bcx), round(bcy)],
                      "ellipse": {"c": [round(ecx), round(ecy)], "axes": [round(d1), round(d2)], "angle": round(ang, 1)}}))
    sys.exit(0)

print(f"ellipse c=({ecx:.0f},{ecy:.0f}) axes=({d1:.0f},{d2:.0f}) ang={ang:.1f}  bull=({bcx:.0f},{bcy:.0f})")
print("cal:", json.dumps(cal))

# homography board(mm) -> image, from the 4 cal points, and draw ALL rings to verify
board = np.float32([[0, -R["doubleOuter"]], [R["doubleOuter"], 0], [0, R["doubleOuter"]], [-R["doubleOuter"], 0]])
imgpts = np.float32([cal["top"], cal["right"], cal["bottom"], cal["left"]])
Hbi = cv2.getPerspectiveTransform(board, imgpts)


def to_img(bx, by):
    p = Hbi @ np.array([bx, by, 1.0])
    return p[0] / p[2], p[1] / p[2]


vis = img.copy()
for rr in (R["singleBull"], R["tripleInner"], R["tripleOuter"], R["doubleInner"], R["doubleOuter"]):
    poly = []
    for d in range(0, 361, 4):
        rad = np.deg2rad(d)
        x, y = to_img(rr * np.sin(rad), -rr * np.cos(rad))
        poly.append([int(x), int(y)])
    cv2.polylines(vis, [np.array(poly)], True, (0, 0, 0), 4)
    cv2.polylines(vis, [np.array(poly)], True, (61, 239, 255), 2)
for i in range(20):                                        # wedge wires
    rad = np.deg2rad(i * 18 + 9)
    x1, y1 = to_img(R["singleBull"] * np.sin(rad), -R["singleBull"] * np.cos(rad))
    x2, y2 = to_img(R["doubleOuter"] * np.sin(rad), -R["doubleOuter"] * np.cos(rad))
    cv2.line(vis, (int(x1), int(y1)), (int(x2), int(y2)), (180, 220, 235), 1)
cv2.circle(vis, (int(bcx), int(bcy)), 5, (0, 0, 255), -1)
for nm, p in cal.items():
    cv2.circle(vis, tuple(p), 7, (255, 0, 255), 2)

cv2.imwrite(str(src.parent / "_cvcal_vis.png"), vis)
zoom = cv2.resize(vis[150:950, 100:650], None, fx=2, fy=2)
cv2.imwrite(str(src.parent / "_cvcal_zoom.png"), zoom)
print(f"-> {src.parent/'_cvcal_zoom.png'}")
