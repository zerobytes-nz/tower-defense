// Map geometry in design pixels (1280×720; the kit's 1920×1080 maps are drawn at 2/3 scale).
// `paths` are the centre lines enemies walk (one or more roads), as control points; each is smoothed (Catmull-Rom)
// and sampled once. Wave groups pick a road (`Group.path`), or alternate between them.
// `pads` are build spots: the dirt patches painted into the map art (`painted`), or extra ones drawn on top.
// Pure data + geometry, no Phaser: the sim, the bot and the placeholder generator use it too.

export interface Pt { x: number; y: number }
export interface Pad extends Pt { painted: boolean }
export interface MapDef {
  id: string;
  name: string;
  bg: string;     // manifest key of the background
  paths: Pt[][];  // control points, first and last just off screen
  pads: Pad[];
  /** Where the call-next-wave skull sits (next to where enemies come in). */
  waveButton: Pt;
}

export const MAPS: Record<string, MapDef> = {
  meadow: {
    id: 'meadow',
    name: 'Mill Meadow',
    bg: 'bg.meadow',
    paths: [[
      { x: -40, y: 102 }, { x: 160, y: 102 }, { x: 600, y: 104 }, { x: 880, y: 106 }, { x: 955, y: 150 }, { x: 965, y: 235 },
      { x: 905, y: 320 }, { x: 760, y: 330 }, { x: 610, y: 335 }, { x: 568, y: 385 }, { x: 568, y: 470 },
      { x: 578, y: 560 }, { x: 575, y: 640 }, { x: 575, y: 780 },
    ]],
    pads: [
      { x: 362, y: 196, painted: true }, { x: 835, y: 212, painted: true }, { x: 706, y: 436, painted: true },
      { x: 345, y: 492, painted: true }, { x: 465, y: 655, painted: true }, { x: 690, y: 655, painted: true },
      { x: 1052, y: 148, painted: false },
    ],
    waveButton: { x: 60, y: 168 },
  },
  jungle: {
    id: 'jungle',
    name: 'Jungle Camp',
    bg: 'bg.jungle',
    paths: [
      [
        { x: 1320, y: 205 }, { x: 1150, y: 198 }, { x: 930, y: 182 }, { x: 852, y: 210 }, { x: 815, y: 275 }, { x: 775, y: 345 },
        { x: 700, y: 378 }, { x: 652, y: 425 }, { x: 640, y: 500 }, { x: 595, y: 562 }, { x: 400, y: 568 }, { x: 150, y: 568 }, { x: -40, y: 568 },
      ],
      [
        { x: 1320, y: 566 }, { x: 1000, y: 566 }, { x: 760, y: 566 }, { x: 668, y: 520 }, { x: 645, y: 430 }, { x: 590, y: 360 },
        { x: 490, y: 345 }, { x: 440, y: 400 }, { x: 425, y: 480 }, { x: 380, y: 560 }, { x: 150, y: 568 }, { x: -40, y: 568 },
      ],
    ],
    pads: [
      { x: 700, y: 292, painted: true }, { x: 945, y: 258, painted: true }, { x: 1165, y: 315, painted: true },
      { x: 547, y: 440, painted: true }, { x: 800, y: 465, painted: true }, { x: 105, y: 660, painted: true },
      { x: 375, y: 656, painted: true }, { x: 875, y: 660, painted: true }, { x: 1145, y: 660, painted: true },
    ],
    waveButton: { x: 1222, y: 420 },
  },
  ruins: {
    id: 'ruins',
    name: 'Old Ruins',
    bg: 'bg.ruins',
    paths: [
      [
        { x: -40, y: 545 }, { x: 60, y: 540 }, { x: 172, y: 470 }, { x: 205, y: 362 }, { x: 282, y: 302 }, { x: 450, y: 296 },
        { x: 560, y: 318 }, { x: 618, y: 380 }, { x: 655, y: 428 }, { x: 722, y: 402 }, { x: 790, y: 322 }, { x: 870, y: 298 },
        { x: 1000, y: 330 }, { x: 1150, y: 334 }, { x: 1320, y: 334 },
      ],
      [
        { x: -40, y: 545 }, { x: 60, y: 540 }, { x: 172, y: 470 }, { x: 205, y: 362 }, { x: 282, y: 302 }, { x: 450, y: 296 },
        { x: 565, y: 306 }, { x: 650, y: 268 }, { x: 760, y: 226 }, { x: 900, y: 214 }, { x: 1100, y: 232 }, { x: 1320, y: 240 },
      ],
    ],
    pads: [
      { x: 980, y: 150, painted: true }, { x: 480, y: 426, painted: true }, { x: 912, y: 354, painted: true }, { x: 685, y: 582, painted: true },
      { x: 300, y: 205, painted: false }, { x: 110, y: 250, painted: false }, { x: 765, y: 485, painted: false }, { x: 600, y: 190, painted: false },
    ],
    waveButton: { x: 60, y: 462 },
  },
  oasis: {
    id: 'oasis',
    name: 'Sunbaked Oasis',
    bg: 'bg.oasis',
    paths: [
      [{ x: 300, y: 760 }, { x: 305, y: 660 }, { x: 330, y: 590 }, { x: 400, y: 545 }, { x: 520, y: 535 }, { x: 700, y: 525 }, { x: 880, y: 525 }, { x: 1030, y: 505 }, { x: 1100, y: 450 }, { x: 1110, y: 360 }, { x: 1060, y: 290 }, { x: 960, y: 250 }, { x: 910, y: 170 }, { x: 870, y: 80 }, { x: 790, y: 45 }, { x: 700, y: 70 }, { x: 630, y: 150 }, { x: 580, y: 240 }, { x: 480, y: 275 }, { x: 300, y: 285 }, { x: 150, y: 262 }, { x: -40, y: 255 }],
      [{ x: -40, y: 370 }, { x: 50, y: 400 }, { x: 120, y: 470 }, { x: 200, y: 525 }, { x: 300, y: 550 }, { x: 400, y: 545 }, { x: 520, y: 535 }, { x: 700, y: 525 }, { x: 880, y: 525 }, { x: 1030, y: 505 }, { x: 1100, y: 450 }, { x: 1110, y: 360 }, { x: 1060, y: 290 }, { x: 960, y: 250 }, { x: 910, y: 170 }, { x: 870, y: 80 }, { x: 790, y: 45 }, { x: 700, y: 70 }, { x: 630, y: 150 }, { x: 580, y: 240 }, { x: 480, y: 275 }, { x: 300, y: 285 }, { x: 150, y: 262 }, { x: -40, y: 255 }]
    ],
    pads: [{ x: 110, y: 140, painted: true }, { x: 510, y: 190, painted: true }, { x: 775, y: 170, painted: true }, { x: 1010, y: 185, painted: true }, { x: 220, y: 462, painted: true }, { x: 665, y: 400, painted: true }, { x: 975, y: 395, painted: true }, { x: 455, y: 655, painted: true }, { x: 845, y: 600, painted: true }],
    waveButton: { x: 60, y: 560 },
  },
  canyon: {
    id: 'canyon',
    name: 'Bone Canyon',
    bg: 'bg.canyon',
    paths: [
      [{ x: 800, y: 170 }, { x: 770, y: 230 }, { x: 720, y: 290 }, { x: 650, y: 330 }, { x: 610, y: 390 }, { x: 630, y: 460 }, { x: 700, y: 510 }, { x: 850, y: 530 }, { x: 1000, y: 545 }, { x: 1100, y: 565 }, { x: 1320, y: 575 }],
      [{ x: -40, y: 470 }, { x: 100, y: 470 }, { x: 210, y: 460 }, { x: 270, y: 400 }, { x: 300, y: 320 }, { x: 380, y: 300 }, { x: 480, y: 310 }, { x: 560, y: 350 }, { x: 610, y: 400 }, { x: 640, y: 470 }, { x: 700, y: 510 }, { x: 850, y: 530 }, { x: 1000, y: 545 }, { x: 1100, y: 565 }, { x: 1320, y: 575 }]
    ],
    pads: [{ x: 225, y: 175, painted: true }, { x: 645, y: 245, painted: true }, { x: 360, y: 380, painted: true }, { x: 755, y: 450, painted: true }, { x: 720, y: 660, painted: true }, { x: 1000, y: 460, painted: false }, { x: 180, y: 560, painted: false }, { x: 555, y: 188, painted: false }],
    waveButton: { x: 60, y: 380 },
  },
  cave: {
    id: 'cave',
    name: 'Ember Pass',
    bg: 'bg.cave',
    paths: [
      [{ x: 1320, y: 215 }, { x: 1150, y: 215 }, { x: 1000, y: 210 }, { x: 900, y: 225 }, { x: 830, y: 280 }, { x: 790, y: 350 }, { x: 720, y: 395 }, { x: 620, y: 400 }, { x: 480, y: 370 }, { x: 330, y: 335 }, { x: 220, y: 300 }, { x: 140, y: 250 }, { x: 80, y: 180 }, { x: 40, y: 130 }, { x: -40, y: 110 }],
      [{ x: 1090, y: 760 }, { x: 1080, y: 660 }, { x: 1000, y: 610 }, { x: 860, y: 580 }, { x: 740, y: 540 }, { x: 670, y: 470 }, { x: 640, y: 420 }, { x: 560, y: 395 }, { x: 480, y: 370 }, { x: 330, y: 335 }, { x: 220, y: 300 }, { x: 140, y: 250 }, { x: 80, y: 180 }, { x: 40, y: 130 }, { x: -40, y: 110 }]
    ],
    pads: [{ x: 205, y: 225, painted: true }, { x: 1105, y: 300, painted: true }, { x: 550, y: 485, painted: true }, { x: 845, y: 515, painted: true }, { x: 200, y: 605, painted: true }, { x: 960, y: 455, painted: false }, { x: 330, y: 430, painted: false }, { x: 700, y: 280, painted: false }],
    waveButton: { x: 1210, y: 420 },
  },
  snow: {
    id: 'snow',
    name: 'Frozen Watch',
    bg: 'bg.snow',
    paths: [
      [{ x: 1320, y: 150 }, { x: 1100, y: 150 }, { x: 800, y: 150 }, { x: 560, y: 150 }, { x: 460, y: 180 }, { x: 420, y: 250 }, { x: 440, y: 320 }, { x: 530, y: 360 }, { x: 610, y: 410 }, { x: 625, y: 480 }, { x: 580, y: 540 }, { x: 520, y: 590 }, { x: 500, y: 660 }, { x: 495, y: 760 }],
      [{ x: 1320, y: 585 }, { x: 1100, y: 585 }, { x: 860, y: 585 }, { x: 740, y: 560 }, { x: 660, y: 510 }, { x: 625, y: 480 }, { x: 580, y: 540 }, { x: 520, y: 590 }, { x: 500, y: 660 }, { x: 495, y: 760 }]
    ],
    pads: [{ x: 585, y: 265, painted: true }, { x: 855, y: 265, painted: true }, { x: 1120, y: 265, painted: true }, { x: 500, y: 470, painted: true }, { x: 795, y: 480, painted: true }, { x: 1080, y: 480, painted: true }, { x: 365, y: 640, painted: true }, { x: 330, y: 230, painted: false }],
    waveButton: { x: 1220, y: 360 },
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Hollow',
    bg: 'bg.crystal',
    paths: [
      [{ x: -40, y: 400 }, { x: 200, y: 400 }, { x: 420, y: 405 }, { x: 600, y: 420 }, { x: 780, y: 440 }, { x: 900, y: 440 }, { x: 1000, y: 410 }, { x: 1050, y: 330 }, { x: 1090, y: 250 }, { x: 1170, y: 215 }, { x: 1320, y: 212 }],
      [{ x: 430, y: 760 }, { x: 430, y: 620 }, { x: 435, y: 500 }, { x: 470, y: 440 }, { x: 560, y: 420 }, { x: 700, y: 435 }, { x: 780, y: 440 }, { x: 900, y: 440 }, { x: 1000, y: 410 }, { x: 1050, y: 330 }, { x: 1090, y: 250 }, { x: 1170, y: 215 }, { x: 1320, y: 212 }]
    ],
    pads: [{ x: 410, y: 295, painted: true }, { x: 885, y: 350, painted: true }, { x: 285, y: 510, painted: true }, { x: 565, y: 510, painted: true }, { x: 660, y: 300, painted: false }, { x: 960, y: 585, painted: false }, { x: 560, y: 612, painted: false }],
    waveButton: { x: 60, y: 300 },
  },
  dusk: {
    id: 'dusk',
    name: 'Twilight Moor',
    bg: 'bg.dusk',
    paths: [
      [{ x: -40, y: 505 }, { x: 120, y: 480 }, { x: 210, y: 400 }, { x: 280, y: 320 }, { x: 380, y: 250 }, { x: 440, y: 160 }, { x: 520, y: 95 }, { x: 680, y: 70 }, { x: 860, y: 72 }, { x: 1040, y: 80 }, { x: 1150, y: 110 }, { x: 1195, y: 185 }, { x: 1195, y: 320 }, { x: 1190, y: 450 }, { x: 1195, y: 600 }, { x: 1200, y: 760 }],
      [{ x: -40, y: 505 }, { x: 120, y: 480 }, { x: 210, y: 400 }, { x: 280, y: 320 }, { x: 380, y: 250 }, { x: 440, y: 160 }, { x: 520, y: 95 }, { x: 680, y: 70 }, { x: 860, y: 72 }, { x: 950, y: 110 }, { x: 985, y: 200 }, { x: 975, y: 320 }, { x: 960, y: 420 }, { x: 990, y: 520 }, { x: 1080, y: 590 }, { x: 1170, y: 650 }, { x: 1200, y: 760 }]
    ],
    pads: [{ x: 570, y: 195, painted: true }, { x: 1045, y: 205, painted: true }, { x: 85, y: 445, painted: true }, { x: 350, y: 425, painted: true }, { x: 820, y: 390, painted: true }, { x: 1095, y: 430, painted: true }, { x: 1045, y: 650, painted: true }],
    waveButton: { x: 60, y: 600 },
  },
  lava: {
    id: 'lava',
    name: 'Molten Gate',
    bg: 'bg.lava',
    paths: [
      [{ x: 1320, y: 530 }, { x: 1100, y: 530 }, { x: 960, y: 530 }, ...[{ x: 820, y: 528 }, { x: 760, y: 490 }, { x: 722, y: 420 }, { x: 705, y: 300 }, { x: 690, y: 190 }, { x: 640, y: 125 }, { x: 560, y: 98 }, { x: 440, y: 100 }, { x: 345, y: 130 }, { x: 285, y: 200 }, { x: 240, y: 285 }, { x: 165, y: 330 }, { x: 105, y: 405 }, { x: 95, y: 490 }, { x: 140, y: 560 }, { x: 235, y: 600 }, { x: 300, y: 655 }, { x: 315, y: 770 }]],
      [{ x: 955, y: -40 }, { x: 955, y: 150 }, { x: 955, y: 350 }, { x: 945, y: 470 }, { x: 900, y: 525 }, ...[{ x: 820, y: 528 }, { x: 760, y: 490 }, { x: 722, y: 420 }, { x: 705, y: 300 }, { x: 690, y: 190 }, { x: 640, y: 125 }, { x: 560, y: 98 }, { x: 440, y: 100 }, { x: 345, y: 130 }, { x: 285, y: 200 }, { x: 240, y: 285 }, { x: 165, y: 330 }, { x: 105, y: 405 }, { x: 95, y: 490 }, { x: 140, y: 560 }, { x: 235, y: 600 }, { x: 300, y: 655 }, { x: 315, y: 770 }]],
    ],
    pads: [{ x: 190, y: 265, painted: true }, { x: 525, y: 230, painted: true }, { x: 838, y: 197, painted: true }, { x: 840, y: 422, painted: true }, { x: 1088, y: 424, painted: true }, { x: 235, y: 470, painted: true }, { x: 195, y: 675, painted: true }, { x: 960, y: 628, painted: true }],
    waveButton: { x: 1210, y: 640 },
  },
  hollow: {
    id: 'hollow',
    name: 'Hollow Woods',
    bg: 'bg.hollow',
    paths: [
      [{ x: 1320, y: 100 }, { x: 1100, y: 100 }, { x: 900, y: 100 }, { x: 700, y: 100 }, { x: 540, y: 102 }, { x: 465, y: 130 }, { x: 432, y: 195 }, { x: 440, y: 270 }, { x: 490, y: 318 }, { x: 580, y: 333 }, { x: 760, y: 336 }, { x: 830, y: 370 }, { x: 850, y: 435 }, { x: 815, y: 500 }, { x: 720, y: 528 }, { x: 560, y: 532 }, { x: 400, y: 532 }, { x: 250, y: 520 }, { x: 100, y: 512 }, { x: -40, y: 510 }],
    ],
    pads: [{ x: 585, y: 205, painted: true }, { x: 780, y: 205, painted: true }, { x: 980, y: 205, painted: true }, { x: 480, y: 435, painted: true }, { x: 680, y: 435, painted: true }, { x: 965, y: 435, painted: true }, { x: 580, y: 655, painted: true }],
    waveButton: { x: 1210, y: 190 },
  },
  bog: {
    id: 'bog',
    name: 'Witch Bog',
    bg: 'bg.bog',
    paths: [
      [...[{ x: 1320, y: 360 }, { x: 1235, y: 300 }, { x: 1150, y: 215 }, { x: 1060, y: 140 }, { x: 960, y: 108 }, { x: 890, y: 135 }, { x: 852, y: 195 }, { x: 830, y: 265 }], { x: 790, y: 195 }, { x: 700, y: 178 }, { x: 570, y: 180 }, { x: 480, y: 220 }, { x: 445, y: 300 }, { x: 445, y: 390 }, { x: 430, y: 445 }, ...[{ x: 400, y: 480 }, { x: 300, y: 560 }, { x: 200, y: 640 }, { x: 110, y: 720 }, { x: 60, y: 780 }]],
      [...[{ x: 1320, y: 360 }, { x: 1235, y: 300 }, { x: 1150, y: 215 }, { x: 1060, y: 140 }, { x: 960, y: 108 }, { x: 890, y: 135 }, { x: 852, y: 195 }, { x: 830, y: 265 }], { x: 828, y: 340 }, { x: 800, y: 405 }, { x: 720, y: 432 }, { x: 600, y: 438 }, { x: 490, y: 442 }, ...[{ x: 400, y: 480 }, { x: 300, y: 560 }, { x: 200, y: 640 }, { x: 110, y: 720 }, { x: 60, y: 780 }]],
    ],
    pads: [{ x: 340, y: 178, painted: true }, { x: 755, y: 110, painted: true }, { x: 1020, y: 205, painted: true }, { x: 295, y: 402, painted: true }, { x: 870, y: 488, painted: true }, { x: 155, y: 535, painted: true }, { x: 505, y: 540, painted: true }, { x: 365, y: 662, painted: true }],
    waveButton: { x: 1210, y: 450 },
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
