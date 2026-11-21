// Original placeholder art (MIT), drawn from code so a fresh clone runs without the CraftPix kit.
// One drawer per manifest key: draw(ctx, w, h, frame, frames) in the frame's own coordinates.
// Same sizes, frame counts and anchor points (feet / tower base on the bottom edge) as the real art.
// No text: fonts differ between machines, and CI checks that this output is byte-for-byte reproducible.
import { MAPS, buildTrack } from '../src/game/maps.ts';

const TAU = Math.PI * 2;
const OUT = '#2b1d14';
const ell = (c, x, y, rx, ry, fill, stroke, lw = 3) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
};
const rr = (c, x, y, w, h, r, fill, stroke, lw = 3) => {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
};
const poly = (c, pts, fill, stroke, lw = 3) => {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
};
/** Deterministic pseudo-random numbers, so the output never changes. */
const prng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// ── Maps ────────────────────────────────────────────────────────────────────────────────────────────
function map(id, grass, grass2, road, edge) {
  return (c, w, h) => {
    const m = MAPS[id], r = prng(7);
    c.fillStyle = grass; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) ell(c, r() * w, r() * h, 6 + r() * 22, 4 + r() * 12, grass2);
    const tracks = m.paths.map((p) => buildTrack(p));
    const stroke = (lw, col) => { for (const t of tracks) { c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); t.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); } };
    stroke(84, edge); stroke(72, road);
    const pts = tracks.flatMap((t) => t.pts);
    for (let i = 0; i < 120; i++) { const p = pts[Math.floor(r() * pts.length)]; ell(c, p.x + (r() - 0.5) * 50, p.y + (r() - 0.5) * 50, 3, 2, edge); }
    for (const p of m.pads.filter((p) => p.painted)) padShape(c, p.x, p.y, 55, 26);
    // trees around the edges
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h;
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 80) || m.pads.some((p) => Math.hypot(p.x - x, p.y - y) < 90)) continue;
      ell(c, x, y + 18, 20, 7, 'rgba(0,0,0,0.25)');
      rr(c, x - 4, y, 8, 18, 2, '#6b4a2b');
      ell(c, x, y - 8, 22, 20, '#3f8a2e', OUT, 2); ell(c, x - 6, y - 14, 8, 6, '#5fae3f');
    }
  };
}
function padShape(c, x, y, rx, ry) {
  ell(c, x, y, rx + 4, ry + 4, '#8a6a2e');
  ell(c, x, y, rx, ry, '#d9b45a');
  for (let i = 0; i < 6; i++) ell(c, x - rx * 0.6 + i * rx * 0.24, y + ((i % 2) - 0.5) * ry * 0.6, 4, 2, '#b8923e');
}

// ── Towers (base on the bottom edge, centred) ───────────────────────────────────────────────────────
const TIER = ['#8a5a32', '#9a9aa2', '#d0b060'];
function archerTower(tier) {
  return (c, w, h) => {
    const cx = w / 2, b = h - 8, wide = 34 + tier * 4;
    ell(c, cx, b, wide + 6, 10, 'rgba(0,0,0,0.3)');
    poly(c, [[cx - wide, b], [cx + wide, b], [cx + wide - 10, b - 70], [cx - wide + 10, b - 70]], tier === 1 ? '#7a4f2c' : '#a7a29a', OUT);
    for (let i = 1; i < 4; i++) { c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - wide + 6, b - i * 18); c.lineTo(cx + wide - 6, b - i * 18); c.stroke(); }
    rr(c, cx - wide + 4, b - 86, (wide - 4) * 2, 18, 4, TIER[tier - 1], OUT);
    rr(c, cx - 8, b - 30, 16, 30, 6, '#3a2414');
  };
}
function catapultTower(tier) {
  return (c, w, h) => {
    const cx = w / 2, b = h - 10;
    ell(c, cx, b, 54, 12, 'rgba(0,0,0,0.3)');
    rr(c, cx - 50, b - 22, 100, 22, 8, ['#8a5a32', '#8f8f99', '#7a3a3a'][tier - 1], OUT);
    for (const s of [-1, 1]) rr(c, cx + s * 30 - 6, b - 82 - tier * 6, 12, 64 + tier * 6, 4, '#5a3a22', OUT);
    rr(c, cx - 36, b - 62, 72, 10, 4, '#6b4a2b', OUT);
    c.lineWidth = 8; c.strokeStyle = '#4a2e18'; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 20, b - 30); c.lineTo(cx + 22, b - 92); c.stroke();
    ell(c, cx + 24, b - 96, 12, 8, '#3a2414', OUT, 2);
    if (tier === 3) ell(c, cx, b - 12, 10, 6, '#ffb030');
  };
}
function mageTower(tier) {
  return (c, w, h) => {
    const cx = w / 2, b = h - 8, top = b - 70 - tier * 10;
    ell(c, cx, b, 50, 11, 'rgba(0,0,0,0.3)');
    c.beginPath(); c.moveTo(cx - 46, b); c.quadraticCurveTo(cx - 50, top, cx, top - 10); c.quadraticCurveTo(cx + 50, top, cx + 46, b); c.closePath();
    c.fillStyle = '#c8a070'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    rr(c, cx - 12, b - 36, 24, 36, 12, '#5a3a22', OUT, 2);
    for (let i = 0; i < tier; i++) ell(c, cx - 20 + i * 20, top + 26, 6, 6, '#e8443a', OUT, 2);
    ell(c, cx, top - 18, 10, 10, '#ff6a5a', OUT, 2);
  };
}
function barracksTower(tier) {
  return (c, w, h) => {
    const cx = w / 2, b = h - 8;
    ell(c, cx, b, 56, 12, 'rgba(0,0,0,0.3)');
    rr(c, cx - 44, b - 56, 88, 56, 6, ['#c8a060', '#b07a4a', '#9a9aa2'][tier - 1], OUT);
    poly(c, [[cx - 54, b - 52], [cx, b - 96], [cx + 54, b - 52]], ['#e8b040', '#e07a30', '#7a7a84'][tier - 1], OUT);
    c.lineWidth = 5; c.strokeStyle = '#d8d8e0';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx - s * 14, b - 44); c.lineTo(cx + s * 14, b - 14); c.stroke(); }
    rr(c, cx - 4, b - 36, 8, 12, 2, '#6b4a2b');
  };
}

// ── Archer unit on the tower (feet on the bottom edge) ──────────────────────────────────────────────
function archerUnit(tier) {
  const cloak = ['#2f3b4a', '#9aa4b0', '#5a7a2a'][tier - 1];
  return (c, w, h, i, n) => {
    const cx = w / 2 - 4, b = h - 2, pull = Math.sin((i / n) * Math.PI) * 6;
    rr(c, cx - 11, b - 30, 22, 28, 8, cloak, OUT, 2);
    ell(c, cx, b - 38, 10, 10, '#f0d0a0', OUT, 2);
    c.beginPath(); c.ellipse(cx, b - 42, 11, 8, 0, Math.PI, TAU); c.fillStyle = '#c8ccd4'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = '#7a4a22';
    c.beginPath(); c.arc(cx + 10, b - 24, 16, -1.2, 1.2); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#eee'; c.beginPath(); c.moveTo(cx + 15, b - 39); c.lineTo(cx + 10 - pull, b - 24); c.lineTo(cx + 15, b - 9); c.stroke();
  };
}

// ── Shots and effects ───────────────────────────────────────────────────────────────────────────────
const arrow = (c, w, h) => {
  c.lineWidth = 2; c.strokeStyle = '#7a4a22'; c.beginPath(); c.moveTo(4, h / 2); c.lineTo(w - 8, h / 2); c.stroke();
  poly(c, [[w - 2, h / 2], [w - 10, h / 2 - 4], [w - 10, h / 2 + 4]], '#ccc');
  poly(c, [[2, h / 2 - 4], [8, h / 2], [2, h / 2 + 4]], '#e8e0d0');
};
const boulder = (c, w, h) => { ell(c, w / 2, h / 2, w / 2 - 3, h / 2 - 4, '#9a7a5a', OUT, 2); ell(c, w / 2 - 4, h / 2 - 4, 4, 3, '#b89a7a'); };
const bolt = (c, w, h) => { ell(c, w / 2, h / 2, w / 2 - 2, h / 2 - 2, 'rgba(255,90,70,0.5)'); ell(c, w / 2, h / 2, w / 4, h / 4, '#ffd0c0'); };
const blast = (c, w, h, i, n) => {
  const k = (i + 1) / n, r = w * 0.18 + w * 0.3 * k;
  if (k < 0.6) { ell(c, w / 2, h / 2, r, r * 0.8, '#ff8a2a'); ell(c, w / 2, h / 2, r * 0.6, r * 0.5, '#ffe06a'); }
  else { c.lineWidth = 6 * (1 - k) + 1; c.strokeStyle = `rgba(70,60,55,${(1 - k) * 2})`; c.beginPath(); c.ellipse(w / 2, h / 2, r, r * 0.8, 0, 0, TAU); c.stroke(); }
};

// ── Enemies (face right, feet on the bottom edge) ───────────────────────────────────────────────────
const SKIN = { grunt: '#6f8a3a', runner: '#8aa63a', brute: '#c86a3a', shaman: '#3a3a44', bat: '#7a6a6a', ogre: '#3a8a8a', imp: '#6a3a9a' };
const SIZE = { grunt: 0.5, runner: 0.38, brute: 0.52, shaman: 0.5, bat: 0.45, ogre: 0.62, imp: 0.46 };
function enemy(kind, mode) {
  return (c, w, h, i, n) => {
    const s = SIZE[kind] * (w / 96) * 96, cx = w / 2, b = h - 4, t = i / n;
    const fall = mode === 'die' ? t : 0;
    c.save();
    c.globalAlpha = 1 - fall * 0.6;
    c.translate(cx, b); c.rotate(fall * 1.3); c.translate(-cx, -b);
    if (kind === 'bat') {
      const y = b - s * 0.9 + Math.sin(t * TAU) * 4, flap = Math.sin(t * TAU * 2) * 0.6;
      for (const sd of [-1, 1]) poly(c, [[cx, y], [cx + sd * s * 0.9, y - s * (0.3 + flap * 0.3)], [cx + sd * s * 0.6, y + s * 0.2]], SKIN.bat, OUT, 2);
      ell(c, cx, y, s * 0.3, s * 0.26, SKIN.bat, OUT, 2);
      ell(c, cx + s * 0.08, y - 2, 3, 2, '#e03030');
    } else {
      const step = mode === 'walk' ? Math.sin(t * TAU) * s * 0.08 : 0;
      ell(c, cx, b, s * 0.4, s * 0.08, 'rgba(0,0,0,0.25)');
      rr(c, cx - s * 0.22 + step, b - s * 0.22, s * 0.16, s * 0.22, 3, '#3a2a22');
      rr(c, cx + s * 0.06 - step, b - s * 0.22, s * 0.16, s * 0.22, 3, '#3a2a22');
      rr(c, cx - s * 0.3, b - s * 0.78, s * 0.6, s * 0.6, s * 0.2, SKIN[kind], OUT, 2.5);
      ell(c, cx + s * 0.05, b - s * 0.92, s * 0.26, s * 0.24, kind === 'shaman' ? '#e8d8b0' : SKIN[kind], OUT, 2.5);
      if (kind === 'shaman') { c.beginPath(); c.ellipse(cx + s * 0.02, b - s * 0.98, s * 0.3, s * 0.3, 0, Math.PI, TAU); c.fillStyle = '#2a2a32'; c.fill(); }
      if (kind === 'brute') { c.beginPath(); c.ellipse(cx + s * 0.05, b - s * 0.98, s * 0.28, s * 0.22, 0, Math.PI, TAU); c.fillStyle = '#c8ccd4'; c.fill(); }
      ell(c, cx + s * 0.15, b - s * 0.94, 2.5, 2.5, kind === 'ogre' ? '#ffe040' : '#ffffff');
      // weapon
      c.lineWidth = Math.max(2, s * 0.06); c.lineCap = 'round';
      c.strokeStyle = kind === 'shaman' ? '#d0b060' : kind === 'runner' ? '#a07040' : '#c8ccd4';
      c.beginPath(); c.moveTo(cx + s * 0.25, b - s * 0.45); c.lineTo(cx + s * 0.62, b - s * (0.6 + step / s)); c.stroke();
    }
    c.restore();
  };
}

function scorpion(mode) {
  return (c, w, h, i, n) => {
    const t = i / n, fall = mode === 'die' ? t : 0, cx = w / 2, b = h - 6, s = w * 0.42;
    c.save(); c.globalAlpha = 1 - fall * 0.6;
    ell(c, cx, b, s * 0.7, s * 0.1, 'rgba(0,0,0,0.25)');
    for (let k = 0; k < 3; k++) { const st = mode === 'walk' ? Math.sin(t * TAU + k) * 3 : 0; c.lineWidth = 3; c.strokeStyle = OUT; c.beginPath(); c.moveTo(cx - s * 0.3 + k * s * 0.3, b - s * 0.2); c.lineTo(cx - s * 0.4 + k * s * 0.3 + st, b); c.stroke(); }
    ell(c, cx, b - s * 0.28, s * 0.55, s * 0.22 * (1 - fall * 0.5), '#c89a4a', OUT, 2.5);
    c.lineWidth = s * 0.12; c.strokeStyle = '#b0843a'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - s * 0.5, b - s * 0.3); c.quadraticCurveTo(cx - s * 0.9, b - s * 1.1, cx - s * 0.2, b - s * (1 - fall * 0.6)); c.stroke();
    ell(c, cx - s * 0.18, b - s * (1 - fall * 0.6), s * 0.08, s * 0.08, '#3a2414');
    for (const d of [-1, 1]) ell(c, cx + s * 0.65, b - s * 0.3 + d * s * 0.12, s * 0.14, s * 0.08, '#b0843a', OUT, 2);
    c.restore();
  };
}
function treant(mode) {
  return (c, w, h, i, n) => {
    const t = i / n, fall = mode === 'die' ? t : 0, cx = w * 0.36, b = h - 6, s = w * 0.3, sway = mode === 'walk' ? Math.sin(t * TAU) * 4 : 0;
    const lift = mode === 'cast' ? Math.sin(t * Math.PI) : 0;
    c.save(); c.globalAlpha = 1 - fall * 0.6; c.translate(cx, b); c.rotate(fall * 0.9); c.translate(-cx, -b);
    ell(c, cx, b, s * 0.8, s * 0.12, 'rgba(0,0,0,0.3)');
    for (const d of [-1, 1]) rr(c, cx + d * s * 0.25 - s * 0.12 + d * sway, b - s * 0.5, s * 0.24, s * 0.5, 6, '#5a3a22', OUT, 2.5);
    rr(c, cx - s * 0.45, b - s * 1.4, s * 0.9, s * 1.0, s * 0.3, '#6b4a2b', OUT, 3);
    for (const d of [-1, 1]) { c.lineWidth = s * 0.14; c.strokeStyle = '#5a3a22'; c.beginPath(); c.moveTo(cx + d * s * 0.4, b - s * 1.1); c.lineTo(cx + d * s * 0.85, b - s * (0.8 + lift * 0.9)); c.stroke(); }
    ell(c, cx, b - s * 1.6, s * 0.75, s * 0.45, '#3f8a2e', OUT, 3); ell(c, cx - s * 0.3, b - s * 1.75, s * 0.25, s * 0.15, '#5fae3f');
    for (const d of [-1, 1]) ell(c, cx + d * s * 0.16 + s * 0.1, b - s * 1.15, s * 0.07, s * 0.07, lift ? '#ffe040' : '#a0e060');
    c.restore();
  };
}
/** Knights: one drawer, three liveries. Feet on the bottom edge, facing right. */
const LIVERY = { hero: ['#c8ccd8', '#3a5aa8', '#ffd040'], soldier: ['#b08050', '#8a3a2a', '#c8ccd4'], militia: ['#8a8a6a', '#5a6a3a', '#a08060'] };
function knight(who, mode) {
  const [armour, cloth, trim] = LIVERY[who];
  return (c, w, h, i, n) => {
    const t = i / n, cx = w / 2, b = h - 3, s = who === 'hero' ? 1 : 0.85;
    const fall = mode === 'die' ? t : 0, step = mode === 'walk' ? Math.sin(t * TAU) * 4 : 0, bob = mode === 'idle' ? Math.sin(t * TAU) * 1.2 : 0;
    const swing = mode === 'attack' ? Math.sin(t * Math.PI) : 0;
    c.save(); c.globalAlpha = 1 - fall * 0.6; c.translate(cx, b); c.rotate(-fall * 1.2); c.scale(s, s); c.translate(-cx, -b);
    ell(c, cx, b, 16, 4, 'rgba(0,0,0,0.25)');
    rr(c, cx - 9 + step, b - 14, 7, 14, 2, '#4a4a52'); rr(c, cx + 2 - step, b - 14, 7, 14, 2, '#4a4a52');
    rr(c, cx - 12, b - 36 + bob, 24, 24, 7, armour, OUT, 2);
    rr(c, cx - 12, b - 22 + bob, 24, 8, 3, cloth);
    ell(c, cx + 1, b - 44 + bob, 10, 10, armour, OUT, 2);
    rr(c, cx + 2, b - 46 + bob, 9, 3, 1, OUT);
    if (who === 'hero') poly(c, [[cx - 4, b - 54 + bob], [cx + 2, b - 62 + bob], [cx + 6, b - 53 + bob]], trim, OUT, 1.5);
    // shield (left) and sword (right)
    rr(c, cx - 20, b - 34 + bob, 11, 18, 4, cloth, OUT, 2); ell(c, cx - 14.5, b - 25 + bob, 2.5, 2.5, trim);
    const a = -1.3 + swing * 2.2, hx = cx + 12, hy = b - 28 + bob;
    c.lineWidth = 3.5; c.strokeStyle = '#e8e8f0'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(a) * 22, hy + Math.sin(a) * 22); c.stroke();
    c.lineWidth = 2; c.strokeStyle = trim; c.beginPath(); c.moveTo(hx - Math.sin(a) * 5, hy + Math.cos(a) * 5); c.lineTo(hx + Math.sin(a) * 5, hy - Math.cos(a) * 5); c.stroke();
    c.restore();
  };
}
function t4(kind, id) {
  const base = { archer: archerTower(3), catapult: catapultTower(3), mage: mageTower(3), barracks: barracksTower(3) }[kind];
  const col = { longbow: '#5a8a2a', crossbow: '#5a5a6a', firepot: '#ff7a20', spiked: '#9aa0aa', storm: '#4ab0ff', frost: '#a8e8ff', paladins: '#ffd040', drums: '#c8402a' }[id];
  return (c, w, h) => {
    base(c, w, h);
    const cx = w / 2;
    poly(c, [[cx - 3, 12], [cx - 3, 34], [cx + 1, 34], [cx + 1, 12]], '#4a2e18');
    poly(c, [[cx + 1, 12], [cx + 22, 18], [cx + 1, 25]], col, OUT, 2);
    ell(c, cx, h - 22, 9, 9, col, OUT, 2);
  };
}
const meteor = (c, w, h) => {
  ell(c, w * 0.62, h * 0.38, w * 0.3, h * 0.3, 'rgba(255,140,40,0.55)');
  ell(c, w * 0.5, h * 0.5, w * 0.28, h * 0.27, '#7a4a3a', OUT, 2.5); ell(c, w * 0.42, h * 0.42, 5, 4, '#a8705a'); ell(c, w * 0.6, h * 0.58, 4, 3, '#ff9a40');
};
const fire = (c, w, h, i, n) => {
  const t = i / n, r = prng(11);
  ell(c, w / 2, h - 10, w / 2 - 4, 9, 'rgba(60,20,10,0.45)');
  for (let k = 0; k < 5; k++) {
    const x = 10 + k * ((w - 20) / 4), f = 0.6 + 0.4 * Math.sin((t + r()) * TAU), fh = (14 + r() * 14) * f;
    poly(c, [[x - 7, h - 10], [x, h - 10 - fh], [x + 7, h - 10]], '#ff7a20');
    poly(c, [[x - 3.5, h - 10], [x, h - 10 - fh * 0.55], [x + 3.5, h - 10]], '#ffe060');
  }
};
const roots = (c, w, h) => {
  c.lineCap = 'round';
  for (const [x0, a] of [[16, -1.1], [34, -1.4], [52, -1.6], [70, -1.9], [84, -2.2]]) {
    c.lineWidth = 7; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x0, h - 4); c.quadraticCurveTo(x0 + Math.cos(a) * 14, h - 24, x0 + Math.cos(a) * 6, h - 40); c.stroke();
    c.lineWidth = 4.5; c.strokeStyle = '#6b4a2b'; c.stroke();
  }
};
const roundButton = (inner) => (c, w, h) => { ell(c, w / 2, h / 2, w / 2 - 4, h / 2 - 4, '#6b4226', '#3a3a44', 5); ell(c, w / 2, h / 2, w / 2 - 12, h / 2 - 12, '#8a5a32'); inner(c, w, h); };
const uiMeteor = roundButton((c, w, h) => { meteor(c, w, h); });
const uiReinforce = roundButton((c, w, h) => {
  for (const d of [-1, 1]) { c.lineWidth = 6; c.strokeStyle = '#e8e8f0'; c.lineCap = 'round'; c.beginPath(); c.moveTo(w / 2 - d * 16, h * 0.68); c.lineTo(w / 2 + d * 16, h * 0.3); c.stroke(); }
  rr(c, w / 2 - 10, h * 0.62, 20, 6, 2, '#ffd040');
});
const uiHero = roundButton((c, w, h) => { c.save(); c.translate(w / 2 - 32, h / 2 - 38); knight('hero', 'idle')(c, 64, 64, 0, 4); c.restore(); });
const rally = (c, w, h) => { rr(c, w * 0.3, 4, 3, h - 8, 1, '#5a3a22'); poly(c, [[w * 0.3 + 3, 5], [w - 4, 11], [w * 0.3 + 3, 19]], '#3a5aa8', OUT, 2); ell(c, w * 0.32, h - 5, 8, 3, 'rgba(0,0,0,0.3)'); };

// ── UI ──────────────────────────────────────────────────────────────────────────────────────────────
const heart = (c, w, h) => {
  c.beginPath(); c.moveTo(w / 2, h - 4);
  c.bezierCurveTo(2, h * 0.55, 2, 4, w * 0.3, 4); c.bezierCurveTo(w * 0.42, 4, w / 2, h * 0.2, w / 2, h * 0.28);
  c.bezierCurveTo(w / 2, h * 0.2, w * 0.58, 4, w * 0.7, 4); c.bezierCurveTo(w - 2, 4, w - 2, h * 0.55, w / 2, h - 4);
  c.fillStyle = '#e8504a'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#7a1a1a'; c.stroke();
  ell(c, w * 0.3, h * 0.3, 4, 3, '#ffa0a0');
};
const coin = (c, w, h) => {
  ell(c, w / 2, h / 2 + 2, w / 2 - 3, h / 2 - 4, '#a86a10');
  ell(c, w / 2, h / 2, w / 2 - 3, h / 2 - 4, '#ffcc33', '#7a4a08', 3);
  ell(c, w / 2, h / 2, w / 2 - 10, h / 2 - 11, null, '#d89a18', 2.5);
  rr(c, w / 2 - 3, h / 2 - 8, 6, 16, 2, '#e8a820');
  ell(c, w / 2 - 6, h / 2 - 7, 3, 2, '#fff6c0');
};
const woodButton = (inner) => (c, w, h) => {
  rr(c, 4, 4, w - 8, h - 8, 10, '#6b4226', '#3a3a44', 5);
  rr(c, 12, 12, w - 24, h - 24, 6, '#8a5a32');
  for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) ell(c, x, y, 4, 4, '#c8ccd4');
  inner(c, w, h);
};
const pause = woodButton((c, w, h) => { for (const x of [w * 0.38, w * 0.62]) rr(c, x - 6, h * 0.3, 12, h * 0.4, 5, '#e8e8f0', OUT, 2); });
const fast = woodButton((c, w, h) => { for (const x of [w * 0.3, w * 0.5]) poly(c, [[x, h * 0.32], [x + w * 0.2, h / 2], [x, h * 0.68]], '#e8e8f0', OUT, 2); });
const wave = (c, w, h) => {
  ell(c, w / 2, h / 2, w / 2 - 3, h / 2 - 3, '#c8402a', '#5a1a10', 5);
  ell(c, w / 2, h / 2 - 4, w * 0.26, h * 0.24, '#eeeae0', OUT, 3);
  rr(c, w * 0.36, h * 0.6, w * 0.28, h * 0.14, 4, '#eeeae0', OUT, 3);
  ell(c, w * 0.4, h * 0.46, 6, 7, '#c8402a'); ell(c, w * 0.6, h * 0.46, 6, 7, '#c8402a');
};
const star = (c, w, h) => {
  const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? w * 0.2 : w * 0.46, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([w / 2 + Math.cos(a) * r, h / 2 + 2 + Math.sin(a) * r]); }
  poly(c, pts, '#ffcc33', '#7a4a08', 2.5);
};

// ── GUI boards and buttons (the kit's look: wood boards with steel rims, round steel buttons) ────────
const board = (rim = '#b8bcc4') => (c, w, h) => {
  rr(c, 3, 3, w - 6, h - 6, 22, rim, '#4a4a52', 4);
  rr(c, 14, 14, w - 28, h - 28, 14, '#6b3a22', '#3a1a0e', 3);
  const r = prng(w * 7 + h);
  c.strokeStyle = 'rgba(40,16,6,0.35)'; c.lineWidth = 2;
  for (let y = 30; y < h - 24; y += 22) { c.beginPath(); c.moveTo(20, y); c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 10, w * 0.7, y + (r() - 0.5) * 10, w - 20, y); c.stroke(); }
};
const inset = (c, w, h) => rr(c, 4, 4, w - 8, h - 8, 18, '#3a2418', '#8a5a2a', 3);
const ribbon = (c, w, h) => {
  poly(c, [[4, h * 0.35], [w * 0.14, h * 0.3], [w * 0.14, h * 0.8], [4, h * 0.85], [w * 0.08, h * 0.58]], '#c86a18', OUT, 3);
  poly(c, [[w - 4, h * 0.35], [w * 0.86, h * 0.3], [w * 0.86, h * 0.8], [w - 4, h * 0.85], [w * 0.92, h * 0.58]], '#c86a18', OUT, 3);
  rr(c, w * 0.12, h * 0.14, w * 0.76, h * 0.62, 12, '#f0a020', OUT, 3);
  rr(c, w * 0.15, h * 0.18, w * 0.7, h * 0.18, 8, 'rgba(255,255,255,0.25)');
};
const roundBtn = (icon) => (c, w, h) => {
  const r = w / 2 - 4;
  ell(c, w / 2, h / 2, r, r, '#c8ccd4', '#4a4a52', 4);
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; ell(c, w / 2 + Math.cos(a) * r * 0.88, h / 2 + Math.sin(a) * r * 0.88, 3, 3, '#8a8a92'); }
  ell(c, w / 2, h / 2, r * 0.74, r * 0.74, '#7a4226', '#3a1a0e', 3);
  icon(c, w / 2, h / 2, r * 0.42);
};
const W = '#eeeef4';
const ICON = {
  play: (c, x, y, s) => poly(c, [[x - s * 0.6, y - s], [x + s, y], [x - s * 0.6, y + s]], W, OUT, 3),
  menu: (c, x, y, s) => { for (const d of [-0.6, 0, 0.6]) rr(c, x - s, y + d * s - 4, s * 2, 8, 3, W, OUT, 2); },
  next: (c, x, y, s) => poly(c, [[x - s, y - 5], [x + s * 0.1, y - 5], [x + s * 0.1, y - s * 0.7], [x + s, y], [x + s * 0.1, y + s * 0.7], [x + s * 0.1, y + 5], [x - s, y + 5]], W, OUT, 2.5),
  back: (c, x, y, s) => poly(c, [[x + s, y - 5], [x - s * 0.1, y - 5], [x - s * 0.1, y - s * 0.7], [x - s, y], [x - s * 0.1, y + s * 0.7], [x - s * 0.1, y + 5], [x + s, y + 5]], W, OUT, 2.5),
  restart: (c, x, y, s) => { c.lineWidth = 8; c.strokeStyle = OUT; c.beginPath(); c.arc(x, y, s * 0.75, -2.2, 2.6); c.stroke(); c.lineWidth = 5; c.strokeStyle = W; c.stroke(); poly(c, [[x - s * 0.95, y - s * 0.9], [x - s * 0.15, y - s * 0.75], [x - s * 0.7, y - s * 0.15]], W, OUT, 2); },
  sound: (c, x, y, s) => { poly(c, [[x - s, y - s * 0.35], [x - s * 0.5, y - s * 0.35], [x, y - s * 0.8], [x, y + s * 0.8], [x - s * 0.5, y + s * 0.35], [x - s, y + s * 0.35]], W, OUT, 2.5); c.lineWidth = 4; c.strokeStyle = W; c.beginPath(); c.arc(x + s * 0.1, y, s * 0.6, -0.8, 0.8); c.stroke(); },
  soundoff: (c, x, y, s) => { ICON.sound(c, x - s * 0.15, y, s * 0.85); c.lineWidth = 5; c.strokeStyle = '#e03a2a'; c.beginPath(); c.moveTo(x - s, y - s); c.lineTo(x + s, y + s); c.stroke(); },
  settings: (c, x, y, s) => { for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; rr(c, x + Math.cos(a) * s * 0.8 - 5, y + Math.sin(a) * s * 0.8 - 5, 10, 10, 2, W); } ell(c, x, y, s * 0.7, s * 0.7, W, OUT, 2); ell(c, x, y, s * 0.28, s * 0.28, '#7a4226'); },
  forward: null, close: null,
};
ICON.forward = ICON.next;
const closeBtn = (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 12, '#c8ccd4', '#4a4a52', 3); rr(c, 10, 10, w - 20, h - 20, 8, '#a8302a'); c.lineWidth = 6; c.strokeStyle = W; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.33, h * 0.33); c.lineTo(w * 0.67, h * 0.67); c.moveTo(w * 0.67, h * 0.33); c.lineTo(w * 0.33, h * 0.67); c.stroke(); };
const plateBtn = (fill, mark) => (c, w, h) => { rr(c, 3, 3, w - 6, h - 6, 12, '#c8ccd4', '#4a4a52', 3); rr(c, 10, 9, w - 20, h - 18, 7, fill, '#3a1a0e', 2); mark(c, w, h); };
const levelBtn = (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 16, '#c8ccd4', '#4a4a52', 4); rr(c, 14, 14, w - 28, h - 28, 10, '#7a4226', '#3a1a0e', 3); for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) ell(c, x, y, 5, 5, '#8a8a92', '#4a4a52', 2); };
const starShape = (c, x, y, r, fill) => { const pts = []; for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([x + Math.cos(a) * rr2, y + Math.sin(a) * rr2]); } poly(c, pts, fill, OUT, 3); };
const starGroup = (c, w, h, i) => {
  const on = (k) => (i >= [2, 1, 3][k] ? '#ffcc33' : '#f4eee0');
  starShape(c, w * 0.2, h * 0.62, h * 0.3, on(0)); starShape(c, w * 0.8, h * 0.62, h * 0.3, on(2)); starShape(c, w * 0.5, h * 0.45, h * 0.42, on(1));
};
const tag = (c, w, h) => { rr(c, 2, 2, w - 4, h - 4, 10, '#3a2418', '#c87a2a', 3); starShape(c, w - 18, h / 2, h * 0.28, '#ffcc33'); };
const rope = (c, w, h) => { rr(c, w / 2 - 6, 0, 12, h, 5, '#a8783a', OUT, 2); c.strokeStyle = '#6a4a22'; c.lineWidth = 2; for (let y = 6; y < h; y += 12) { c.beginPath(); c.moveTo(w / 2 - 5, y); c.lineTo(w / 2 + 5, y + 8); c.stroke(); } };
const PERK_COL = ['#3ad0e0', '#c8ccd4', '#e8d8a0', '#c8ccd4', '#e83a2a', '#8a5a32', '#c8ccd4', '#e8a020', '#a8a8b0', '#ff8a2a', '#b07a4a', '#5a5a64', '#e83a2a', '#4ab0e8', '#3ac890', '#f0d020', '#ff7a20', '#ffe040', '#7a7a84', '#8ae040', '#a8e8ff', '#e0b060', '#c8ccd4', '#5a5a64'];
const perkIcon = (n) => (c, w, h) => {
  levelBtn(c, w, h);
  const col = PERK_COL[n - 1], x = w / 2, y = h / 2, s = w * 0.2;
  if (n % 4 === 1) ell(c, x, y, s, s, col, OUT, 2.5);
  else if (n % 4 === 2) poly(c, [[x, y - s * 1.2], [x + s, y], [x, y + s * 1.2], [x - s, y]], col, OUT, 2.5);
  else if (n % 4 === 3) rr(c, x - s, y - s, s * 2, s * 2, 5, col, OUT, 2.5);
  else starShape(c, x, y, s * 1.2, col);
};
const menuBg = (c, w, h) => {
  const r = prng(3);
  c.fillStyle = '#6a9a32'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) ell(c, r() * w, r() * h, 6 + r() * 22, 4 + r() * 12, '#78a83a');
  ell(c, w * 0.72, h * 0.62, 120, 46, '#3a8ac8', '#2a5a7a', 4);
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h; if (Math.hypot(x - w / 2, y - h / 2) < 260) continue; ell(c, x, y + 18, 22, 7, 'rgba(0,0,0,0.25)'); rr(c, x - 4, y, 8, 18, 2, '#6b4a2b'); ell(c, x, y - 8, 24, 20, '#3f8a2e', OUT, 2); }
};

export const drawers = {
  'bg.menu': menuBg,
  'gui.table': board(), 'gui.table.tall': board(), 'gui.upgrade.table': board(), 'gui.window': inset,
  'gui.stars': starGroup, 'gui.btn.level': levelBtn, 'gui.btn.play': roundBtn(ICON.play), 'gui.btn.close': closeBtn,
  'gui.btn.done': plateBtn('#4a8a2a', (c, w, h) => { c.lineWidth = 6; c.strokeStyle = W; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.36, h * 0.5); c.lineTo(w * 0.47, h * 0.64); c.lineTo(w * 0.66, h * 0.36); c.stroke(); }),
  'gui.btn.reset': plateBtn('#7a4226', (c, w, h) => ICON.restart(c, w / 2, h / 2, h * 0.22)),
  'gui.upgrade.bank': tag, 'gui.upgrade.cost': tag, 'gui.rope': rope,
  'bg.meadow': map('meadow', '#7aa83a', '#86b444', '#d8b860', '#a8883a'),
  'bg.jungle': map('jungle', '#3f7a2a', '#4a8a30', '#c8a060', '#8a6a3a'),
  'bg.ruins': map('ruins', '#8a9a6a', '#9aa678', '#b8b0a0', '#7a7468'),
  'fx.meteor': meteor, 'fx.fire': fire, 'fx.roots': roots, 'ui.meteor': uiMeteor, 'ui.reinforce': uiReinforce, 'ui.hero': uiHero, 'ui.rally': rally,
  'map.pad': (c, w, h) => padShape(c, w / 2, h / 2, w / 2 - 6, h / 2 - 6),
  'shot.arrow': arrow, 'shot.boulder': boulder, 'shot.bolt': bolt, 'fx.blast': blast,
  'ui.heart': heart, 'ui.coin': coin, 'ui.wave': wave, 'ui.pause': pause, 'ui.fast': fast, 'ui.star': star,
};
for (const t of [1, 2, 3]) {
  drawers[`tower.archer.${t}`] = archerTower(t);
  drawers[`tower.catapult.${t}`] = catapultTower(t);
  drawers[`tower.mage.${t}`] = mageTower(t);
  drawers[`tower.barracks.${t}`] = barracksTower(t);
  drawers[`unit.archer.${t}`] = archerUnit(t);
}
for (const k of Object.keys(SKIN)) for (const m of ['walk', 'die']) drawers[`enemy.${k}.${m}`] = enemy(k, m);
for (const m of ['walk', 'die']) { drawers[`enemy.scorpion.${m}`] = scorpion(m); drawers[`enemy.treant.${m}`] = treant(m); }
drawers['enemy.treant.cast'] = treant('cast');
for (const [kind, ids] of [['archer', ['longbow', 'crossbow']], ['catapult', ['firepot', 'spiked']], ['mage', ['storm', 'frost']], ['barracks', ['paladins', 'drums']]])
  for (const id of ids) drawers[`tower.${kind}.${id}`] = t4(kind, id);
for (const [key, who] of [['hero.silver', 'hero'], ['unit.soldier', 'soldier'], ['unit.militia', 'militia']])
  for (const m of ['idle', 'walk', 'attack', 'die']) drawers[`${key}.${m}`] = knight(who, m);
for (const k of ['levels', 'win', 'failed', 'settings', 'upgrade']) drawers[`gui.header.${k}`] = ribbon;
for (const k of ['menu', 'next', 'restart', 'back', 'forward', 'sound', 'soundoff', 'settings']) drawers[`gui.btn.${k}`] = roundBtn(ICON[k]);
for (let i = 1; i <= 24; i++) drawers[`perk.${i}`] = perkIcon(i);
