// A simple player for `npm run sim` and `?bot`: builds on the pads that see the most road, in a fixed tower mix,
// then upgrades. Good enough to tell whether a level is fair; a sharp human does better.
import type { Battle } from './sim.ts';
import { TOWERS, type TowerKind } from './towers.ts';

const PLAN: TowerKind[] = ['archer', 'mage', 'archer', 'catapult', 'archer', 'mage', 'support', 'catapult'];

/** How much of the road a tower on this pad covers (track samples within an average range). */
export function padValue(b: Battle, pad: number, range = 160): number {
  const p = b.map.pads[pad];
  let n = 0;
  for (let i = 0; i < b.track.pts.length; i += 3) if (Math.hypot(b.track.pts[i].x - p.x, b.track.pts[i].y - p.y + 18) <= range) n++;
  return n;
}

const order = new WeakMap<Battle, number[]>();

/** One decision. Call every half second or so. */
export function think(b: Battle, opts: { mix?: TowerKind[] } = {}): void {
  if (b.state === 'ready') { b.callWave(); return; }
  if (b.state !== 'playing') return;
  let pads = order.get(b);
  if (!pads) { pads = b.map.pads.map((_, i) => i).sort((x, y) => padValue(b, y) - padValue(b, x)); order.set(b, pads); }
  const mix = opts.mix ?? PLAN;
  // Build on the next free pad if we can afford the planned tower…
  const free = pads.filter((p) => !b.towerOn(p));
  const built = b.towers.length;
  if (free.length && built < mix.length) {
    const kind = mix[built];
    if (b.gold >= TOWERS[kind].tiers[0].cost) { b.build(free[0], kind); return; }
    if (built < 3) return; // save up for the first few towers
  }
  // …otherwise upgrade the cheapest upgradable attacking tower.
  const up = b.towers
    .map((t) => ({ t, c: b.upgradeCost(t) }))
    .filter((x): x is { t: typeof x.t; c: number } => x.c !== null)
    .sort((x, y) => x.c - y.c)[0];
  if (up && b.gold >= up.c) b.upgrade(up.t);
}
