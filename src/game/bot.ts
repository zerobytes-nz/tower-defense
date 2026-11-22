// A simple player for `npm run sim` and `?bot`: builds on the pads that see the most road, in a fixed tower mix,
// upgrades, picks branches, and fires spells and the hero's ability at the biggest crowd. Good enough to tell whether
// a level is fair; a sharp human does better.
import type { Battle } from './sim.ts';
import { TOWERS, type TowerKind } from './towers.ts';

const PLAN: TowerKind[] = ['archer', 'barracks', 'mage', 'archer', 'catapult', 'mage', 'archer', 'catapult', 'barracks'];

/** How much of the road a tower on this pad covers (track samples within an average range). */
export function padValue(b: Battle, pad: number, range = 200): number {
  const p = b.map.pads[pad];
  let n = 0;
  for (const t of b.tracks) for (let i = 0; i < t.pts.length; i += 3) if (Math.hypot(t.pts[i].x - p.x, t.pts[i].y - p.y + 18) <= range) n++;
  return n;
}

const order = new WeakMap<Battle, number[]>();

export interface BotOptions { mix?: TowerKind[]; spells?: boolean }

/** One decision. Call every half second or so. */
export function think(b: Battle, opts: BotOptions = {}): void {
  if (b.state === 'ready') { b.callWave(); return; }
  if (b.state !== 'playing') return;

  // Spells and the hero's ability: at the densest group of ground enemies.
  if (opts.spells !== false) {
    const crowd = densest(b);
    if (crowd && crowd.n >= 4 && b.spellReady('meteor')) b.castSpell('meteor', crowd.x, crowd.y);
    const lead = b.enemies.filter((e) => !e.def.flying).sort((x, y) => y.dist - x.dist)[0];
    if (lead && lead.dist > b.tracks[lead.path].length * 0.6 && b.spellReady('reinforce')) b.castSpell('reinforce', lead.x + 30 * lead.facing, lead.y);
    b.awiSpells.forEach((s, i) => {
      if (!b.awiSpellReady(i)) return;
      const ground = b.enemies.filter((e) => !e.def.flying);
      switch (s.def.target) {
        case 'instant': if (b.enemies.length >= 8 || b.enemies.some((e) => e.def.boss)) b.castAwiSpell(i); break;
        case 'enemy': {
          const big = [...b.enemies].sort((x, y) => y.hp - x.hp)[0];
          if (big && big.hp > (s.params.dmg ?? 0) * 0.5) b.castAwiSpell(i, big.x, big.y - (big.def.flying ? 46 : 18));
          break;
        }
        case 'road':
          if (s.def.id === 'rock') {
            const lead = ground.sort((x, y) => y.dist - x.dist)[0];
            if (lead && lead.dist > b.tracks[lead.path].length * 0.5) b.castAwiSpell(i, lead.x + 50 * lead.facing, lead.y);
          } else if (crowd && crowd.n >= 4) b.castAwiSpell(i, crowd.x, crowd.y);
          break;
      }
    });
    const h = b.hero;
    if (h?.alive && b.heroAbilityReady && b.enemies.filter((e) => !e.def.flying && Math.hypot(e.x - h.x, e.y - h.y) < 90).length >= 3) b.heroAbility();
  }

  let pads = order.get(b);
  if (!pads) { pads = b.map.pads.map((_, i) => i).sort((x, y) => padValue(b, y) - padValue(b, x)); order.set(b, pads); }
  // Heroic bans one tower type: build the closest stand-in instead.
  const mix = (opts.mix ?? PLAN).map((k) => k === b.banned ? (k === 'mage' ? 'archer' : k === 'archer' ? 'mage' : k === 'catapult' ? 'mage' : 'archer') : k);
  // Build on the next free pad if we can afford the planned tower…
  const free = pads.filter((p) => !b.towerOn(p) && !b.padFrozen(p));
  const built = b.towers.length;
  if (free.length && built < mix.length) {
    const kind = mix[built];
    if (b.gold >= b.price(TOWERS[kind].tiers[0].cost)) { b.build(free[0], kind); return; }
    if (built < 3) return; // save up for the first few towers
  }
  // …otherwise upgrade the cheapest upgradable tower (branches alternate by tower id).
  const up = b.towers
    .map((t) => ({ t, br: (t.id % 2) as 0 | 1, c: b.upgradeCost(t, (t.id % 2) as 0 | 1) }))
    .filter((x) => x.c !== null)
    .sort((x, y) => x.c! - y.c!)[0];
  if (up && b.gold >= up.c!) b.upgrade(up.t, up.br);
}

function densest(b: Battle): { x: number; y: number; n: number } | null {
  let best: { x: number; y: number; n: number } | null = null;
  for (const e of b.enemies) {
    if (e.def.flying) continue;
    const n = b.enemies.filter((o) => !o.def.flying && Math.hypot(o.x - e.x, o.y - e.y) < 70).length;
    if (!best || n > best.n) best = { x: e.x, y: e.y, n };
  }
  return best;
}
