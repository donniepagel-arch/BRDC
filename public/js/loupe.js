// Stateless iMessage-style magnifier loupe for precise touch point-placement.
// Paints onto the visible 2D context, ON TOP of everything else. The caller owns
// all state (when/where to show it); this only draws.
//
//   ctx    : the visible canvas 2d context
//   source : any CanvasImageSource holding the SAME pixels shown under the point
//            (the freezeImg offscreen canvas, the <video>, or a photo <img>)
//   point  : { x, y } in CANVAS coords — the live position being dragged/placed
//   scale  : stage.width / rect.width  (canvas px per screen px) — pass it LIVE
//   opts   : { color, radius, zoom, screenOffset, srcCanvasW, srcCanvasH }
//
// NOTE: this draws only on the visible ctx. Saved frames read freezeImg / offscreen
// video canvases, never ctx — so the loupe never leaks into captured training data.

const DEFAULTS = {
    color: '#FF469A',   // ring color = point-type color
    radius: 56,         // loupe radius in CANVAS px (~25 screen px at scale 2.2)
    zoom: 2.75,         // magnification of the source crop
    screenOffset: 90,   // gap above the finger, in SCREEN px (iMessage feel)
};

export function drawLoupe(ctx, source, point, scale, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const W = o.srcCanvasW ?? ctx.canvas.width;
    const H = o.srcCanvasH ?? ctx.canvas.height;
    const R = o.radius;
    const margin = 4 * scale;

    // Loupe center: a fixed SCREEN distance above the finger (×scale → canvas px),
    // flipped below when it would clip the top, then clamped fully on-canvas.
    const off = o.screenOffset * scale;
    let cx = point.x;
    let cy = point.y - off;
    if (cy - R < margin) cy = point.y + off;          // flip below near the top
    cx = Math.min(Math.max(cx, R + margin), W - R - margin);
    cy = Math.min(Math.max(cy, R + margin), H - R - margin);

    // Source crop: a box centered on the TRUE point (unclamped, so the crosshair
    // stays exactly on the pixel; black backing fills any out-of-bounds edge).
    const srcSide = (2 * R) / o.zoom;
    const sx = point.x - srcSide / 2;
    const sy = point.y - srcSide / 2;
    const dx = cx - R, dy = cy - R, d = 2 * R;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(dx, dy, d, d);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, sx, sy, srcSide, srcSide, dx, dy, d, d);
    // crosshair on the true point (= loupe center, since the crop is centered there)
    const ch = R * 0.5;
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(cx - ch, cy); ctx.lineTo(cx + ch, cy);
    ctx.moveTo(cx, cy - ch); ctx.lineTo(cx, cy + ch);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = o.color; ctx.lineWidth = 1.5 * scale; ctx.stroke();
    ctx.restore();   // drop the clip before the border so the ring isn't clipped

    // border ring (point-type color) + dark hairline for contrast on light boards
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = 3 * scale; ctx.strokeStyle = o.color; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R + 1.5 * scale, 0, Math.PI * 2);
    ctx.lineWidth = 1 * scale; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
}
