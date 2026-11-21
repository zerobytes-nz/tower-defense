// Map geometry in design pixels (1280×720; the kit's 1920×1080 maps are drawn at 2/3 scale).
// `path` is the centre line enemies walk, as control points; it is smoothed (Catmull-Rom) and sampled once.
// `pads` are build spots: the dirt patches painted into the map art (`painted`), or extra ones drawn on top.
// Pure data + geometry, no Phaser: the sim, the bot and the placeholder generator use it too.

export interface Pt { x: number; y: number }
export interface Pad extends Pt { painted: boolean }
export interface MapDef {
  id: string;
  name: string;
  bg: string;     // manifest key of the background
  path: Pt[];     // control points, first and last just off screen
  pads: Pad[];
  /** Where the call-next-wave skull sits (next to where enemies come in). */
  waveButton: Pt;
}

export const MAPS: Record<string, MapDef> = {
  meadow: {
    id: 'meadow',
    name: 'Mill Meadow',
    bg: 'bg.meadow',
    path: [
      { x: -40, y: 102 }, { x: 160, y: 102 }, { x: 600, y: 104 }, { x: 880, y: 106 }, { x: 955, y: 150 }, { x: 965, y: 235 },
      { x: 905, y: 320 }, { x: 760, y: 330 }, { x: 610, y: 335 }, { x: 568, y: 385 }, { x: 568, y: 470 },
      { x: 578, y: 560 }, { x: 575, y: 640 }, { x: 575, y: 780 },
    ],
    pads: [
      { x: 362, y: 196, painted: true }, { x: 835, y: 212, painted: true }, { x: 706, y: 436, painted: true },
      { x: 345, y: 492, painted: true }, { x: 465, y: 655, painted: true }, { x: 690, y: 655, painted: true },
      { x: 1052, y: 148, painted: false },
    ],
    waveButton: { x: 60, y: 168 },
  },
};

/** A walkable path: points every few pixels plus their running distance, for O(log n) position lookups. */
export interface Track { pts: Pt[]; dist: number[]; length: number }

export function buildTrack(ctrl: Pt[], step = 4): Track {
  const pts: Pt[] = [];
  const p = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  pts.push({ ...ctrl[ctrl.length - 1] });
  const dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, dist, length: dist[dist.length - 1] };
}

/** Position and heading (radians) at distance d along the track. */
export function pointAt(t: Track, d: number): { x: number; y: number; angle: number } {
  const D = Math.max(0, Math.min(t.length, d));
  let lo = 0, hi = t.dist.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t.dist[mid] <= D) lo = mid; else hi = mid; }
  const a = t.pts[lo], b = t.pts[hi];
  const seg = t.dist[hi] - t.dist[lo] || 1;
  const k = (D - t.dist[lo]) / seg;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
