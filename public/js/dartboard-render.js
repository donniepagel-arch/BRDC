// BRDC shared dartboard — realistic canvas render + scoring + geometry.
// Used by the aim game, checkout trainer, and cricket strategy teacher so they
// all share one good-looking board (no more flat "DOS" wedges).
// Globals (loaded via <script>): DB.draw(ctx,cx,cy,R,opts), DB.score(x,y,cx,cy,R),
// DB.targetPos(label,cx,cy,R), DB.SEG.
(function (root) {
  const SEG = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  // ring radii as a fraction of R (= double-ring OUTER edge), real board proportions
  const F = { do: 1.0, di: 0.953, to: 0.629, ti: 0.582, bo: 0.094, bi: 0.037 };
  const TAU = Math.PI * 2, WEDGE = Math.PI / 10;

  function geom(R) {
    return { RDO: R, RDI: R * F.di, RTO: R * F.to, RTI: R * F.ti, RBO: R * F.bo, RBI: R * F.bi };
  }

  // ── scoring (point relative to a board centered at cx,cy with outer radius R) ──
  function score(x, y, cx, cy, R) {
    const g = geom(R), dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r > g.RDO) return { score: 0, label: 'MISS', ring: 'miss', seg: 0, mult: 0 };
    if (r <= g.RBI) return { score: 50, label: 'BULL', ring: 'double', seg: 25, mult: 2 };
    if (r <= g.RBO) return { score: 25, label: '25', ring: 'single', seg: 25, mult: 1 };
    let a = Math.atan2(dx, -dy); if (a < 0) a += TAU;           // clockwise from top
    const seg = SEG[Math.floor(((a + WEDGE / 2) % TAU) / WEDGE) % 20];
    if (r >= g.RDI) return { score: seg * 2, label: 'D' + seg, ring: 'double', seg, mult: 2 };
    if (r >= g.RTI && r <= g.RTO) return { score: seg * 3, label: 'T' + seg, ring: 'triple', seg, mult: 3 };
    return { score: seg, label: '' + seg, ring: 'single', seg, mult: 1 };
  }

  // board position of a target label like "T20","D16","BULL","25" (for guides)
  function targetPos(label, cx, cy, R) {
    const g = geom(R);
    label = String(label).toUpperCase();
    if (label === 'BULL' || label === 'DB') return { x: cx, y: cy, r: g.RBI * 1.4 };
    if (label === '25' || label === 'SB') return { x: cx, y: cy - (g.RBO + g.RBI) / 2, r: g.RBO };
    const ring = label[0], n = parseInt(label.slice(1), 10), idx = SEG.indexOf(n);
    if (idx < 0) return null;
    const ang = idx * WEDGE - Math.PI / 2;
    const rad = ring === 'T' ? (g.RTI + g.RTO) / 2 : ring === 'D' ? (g.RDI + g.RDO) / 2 : (g.RTO + g.RDI) / 2;
    return { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, r: R * 0.05 };
  }

  // ── render ──
  // opts: { glow:'T20'|null, cricketOnly:bool, deadNums:Set, surround:bool(default true) }
  function draw(ctx, cx, cy, R, opts = {}) {
    const g = geom(R);
    const surround = opts.surround !== false;
    const SUR = R * 1.18;                       // outer black ring with numbers
    const cricketSet = opts.cricketOnly ? new Set([20, 19, 18, 17, 16, 15]) : null;
    const dead = opts.deadNums || new Set();

    ctx.save();
    // soft drop shadow under the whole board for depth
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = R * 0.10; ctx.shadowOffsetY = R * 0.03;
    ctx.beginPath(); ctx.arc(cx, cy, SUR, 0, TAU);
    const rim = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, SUR);
    rim.addColorStop(0, '#2c2620'); rim.addColorStop(1, '#0c0a08');
    ctx.fillStyle = rim; ctx.fill();
    ctx.restore();

    // thin metallic outer rim
    ctx.lineWidth = Math.max(2, R * 0.012); ctx.strokeStyle = 'rgba(190,200,210,.35)';
    ctx.beginPath(); ctx.arc(cx, cy, SUR - ctx.lineWidth, 0, TAU); ctx.stroke();

    const SISAL = '#E8D5A8', SISAL2 = '#DFC998', BLACK = '#211E19', RED = '#C9362C', GREEN = '#1C8B43';
    const wedgeAng = i => [i * WEDGE - Math.PI / 2 - WEDGE / 2, i * WEDGE - Math.PI / 2 + WEDGE / 2];

    // wedges: single shading + red/green double+treble bands
    for (let i = 0; i < 20; i++) {
      const [a0, a1] = wedgeAng(i), cream = i % 2 === 0;
      const sing = cream ? SISAL : BLACK, band = cream ? GREEN : RED;
      // outer single (treble outer → double inner)
      fillWedge(ctx, cx, cy, g.RTO, g.RDI, a0, a1, sing);
      // inner single (bull outer → treble inner)
      fillWedge(ctx, cx, cy, g.RBO, g.RTI, a0, a1, sing);
      // treble band
      fillWedge(ctx, cx, cy, g.RTI, g.RTO, a0, a1, band);
      // double band
      fillWedge(ctx, cx, cy, g.RDI, g.RDO, a0, a1, band);
    }

    // bull
    ctx.beginPath(); ctx.arc(cx, cy, g.RBO, 0, TAU); ctx.fillStyle = GREEN; ctx.fill();
    const bg = ctx.createRadialGradient(cx, cy - g.RBI * 0.4, g.RBI * 0.2, cx, cy, g.RBI);
    bg.addColorStop(0, '#E8463A'); bg.addColorStop(1, '#B22A20');
    ctx.beginPath(); ctx.arc(cx, cy, g.RBI, 0, TAU); ctx.fillStyle = bg; ctx.fill();

    // cricket focus: dim non-cricket + dead, gold-lift live cricket
    if (cricketSet) {
      for (let i = 0; i < 20; i++) {
        const n = SEG[i], [a0, a1] = wedgeAng(i), live = cricketSet.has(n) && !dead.has(n);
        fillWedge(ctx, cx, cy, g.RBO, g.RDO, a0, a1, live ? 'rgba(253,216,53,.14)' : 'rgba(8,10,20,.78)');
        if (live) { ctx.strokeStyle = 'rgba(253,216,53,.45)'; ctx.lineWidth = Math.max(1, R * 0.008); strokeWedge(ctx, cx, cy, g.RBO, g.RDO, a0, a1); }
      }
    }

    // spider wires — silver lines with a dark underlay, the thing that kills the "DOS" look
    const wireW = Math.max(1, R * 0.011);
    for (const pass of [['rgba(0,0,0,.5)', wireW * 1.7], ['#C7CDD6', wireW]]) {
      ctx.strokeStyle = pass[0]; ctx.lineWidth = pass[1];
      // radials
      for (let i = 0; i < 20; i++) {
        const a = i * WEDGE - Math.PI / 2 - WEDGE / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * g.RBO, cy + Math.sin(a) * g.RBO);
        ctx.lineTo(cx + Math.cos(a) * g.RDO, cy + Math.sin(a) * g.RDO);
        ctx.stroke();
      }
      // ring circles
      for (const rr of [g.RBI, g.RBO, g.RTI, g.RTO, g.RDI, g.RDO]) {
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      }
    }

    // numbers on the surround ring
    if (surround) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(R * 0.115)}px Inter, system-ui, sans-serif`;
      for (let i = 0; i < 20; i++) {
        const n = SEG[i], a = i * WEDGE - Math.PI / 2;
        const live = !cricketSet || (cricketSet.has(n) && !dead.has(n));
        ctx.fillStyle = cricketSet ? (live ? '#FDD835' : 'rgba(240,235,225,.28)') : '#F2ECE0';
        ctx.fillText(n, cx + Math.cos(a) * (R * 1.09), cy + Math.sin(a) * (R * 1.09));
      }
    }

    // glow guide
    if (opts.glow) {
      const p = targetPos(opts.glow, cx, cy, R);
      if (p) {
        ctx.save(); ctx.strokeStyle = '#FDD835'; ctx.lineWidth = Math.max(2, R * 0.014);
        ctx.shadowColor = '#FDD835'; ctx.shadowBlur = R * 0.07;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + R * 0.02, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  function fillWedge(ctx, cx, cy, rIn, rOut, a0, a1, color) {
    ctx.beginPath(); ctx.arc(cx, cy, rOut, a0, a1); ctx.arc(cx, cy, rIn, a1, a0, true);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function strokeWedge(ctx, cx, cy, rIn, rOut, a0, a1) {
    ctx.beginPath(); ctx.arc(cx, cy, rOut, a0, a1); ctx.arc(cx, cy, rIn, a1, a0, true);
    ctx.closePath(); ctx.stroke();
  }

  const DB = { SEG, geom, score, targetPos, draw, F };
  root.DB = DB;
  if (typeof module !== 'undefined' && module.exports) module.exports = DB;
})(typeof window !== 'undefined' ? window : globalThis);
