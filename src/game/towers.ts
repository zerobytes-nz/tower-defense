// The four tower families, their tiers and their tier-4 branches. Pure data (no Phaser).
// Costs are per step: tiers[0].cost builds it, tiers[1].cost upgrades to tier 2, … a branch's cost buys tier 4.

export type TowerKind = 'archer' | 'catapult' | 'mage' | 'barracks';
export type DamageType = 'physical' | 'magic';

export interface SoldierStats { count: number; hp: number; damage: number; rate: number; armor: number; respawn: number; regen?: number }

export interface TowerTier {
  cost: number;
  damage: number;    // per hit (barracks: 0, the soldiers fight)
  rate: number;      // seconds between attacks
  range: number;     // px (barracks: how far the rally point may be from the tower)
  splash?: number;   // px radius (catapult)
  /** Aura (War Drums): bonuses for other towers whose centre is inside `range`. */
  aura?: { damage: number; range: number; speed: number };
  /** Barracks: soldiers that stand on the road near the rally point and block enemies. */
  soldiers?: SoldierStats;
  // Tier-4 tricks
  crit?: { chance: number; mult: number };
  pierce?: number;                          // share of armour ignored
  burn?: { dps: number; time: number };     // ground fire / burning
  stun?: number;                            // seconds
  chain?: { count: number; range: number; falloff: number };
  slow?: { pct: number; time: number };
}

export interface Branch extends TowerTier { id: string; name: string; blurb: string }

export interface TowerDef {
  kind: TowerKind;
  name: string;
  blurb: string;
  damageType: DamageType;
  hitsAir: boolean;
  /** Projectile speed in px/s (catapult boulders fly in a fixed time instead). */
  shotSpeed: number;
  tiers: TowerTier[];
  branches: [Branch, Branch];
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: {
    kind: 'archer', name: 'Archer Tower', blurb: 'Fast arrows. Hits flyers.',
    damageType: 'physical', hitsAir: true, shotSpeed: 900,
    tiers: [
      { cost: 70, damage: 9, rate: 0.7, range: 200 },
      { cost: 110, damage: 15, rate: 0.6, range: 215 },
      { cost: 160, damage: 24, rate: 0.55, range: 230 },
    ],
    branches: [
      { id: 'longbow', name: 'Longbow Keep', blurb: 'Huge range. 1 in 5 arrows hits ×3.', cost: 230, damage: 34, rate: 0.6, range: 290, crit: { chance: 0.2, mult: 3 } },
      { id: 'crossbow', name: 'Crossbow Fort', blurb: 'Rapid bolts that ignore armour.', cost: 230, damage: 26, rate: 0.36, range: 225, pierce: 1 },
    ],
  },
  catapult: {
    kind: 'catapult', name: 'Catapult', blurb: 'Boulders that crush groups. Ground only.',
    damageType: 'physical', hitsAir: false, shotSpeed: 0,
    tiers: [
      { cost: 110, damage: 26, rate: 2.4, range: 210, splash: 55 },
      { cost: 160, damage: 44, rate: 2.2, range: 222, splash: 62 },
      { cost: 230, damage: 68, rate: 2.0, range: 235, splash: 70 },
    ],
    branches: [
      { id: 'firepot', name: 'Fire Pot', blurb: 'Leaves the road burning.', cost: 300, damage: 80, rate: 2.0, range: 240, splash: 80, burn: { dps: 22, time: 4 } },
      { id: 'spiked', name: 'Spiked Boulder', blurb: 'Heavy hits that stun.', cost: 300, damage: 120, rate: 2.2, range: 240, splash: 72, stun: 1 },
    ],
  },
  mage: {
    kind: 'mage', name: 'Mage Tower', blurb: 'Magic bolts pierce armour. Hits flyers.',
    damageType: 'magic', hitsAir: true, shotSpeed: 520,
    tiers: [
      { cost: 100, damage: 22, rate: 1.3, range: 185 },
      { cost: 150, damage: 38, rate: 1.2, range: 197 },
      { cost: 220, damage: 60, rate: 1.1, range: 210 },
    ],
    branches: [
      { id: 'storm', name: 'Storm Spire', blurb: 'Lightning jumps to 3 more enemies.', cost: 280, damage: 78, rate: 1.2, range: 220, chain: { count: 3, range: 110, falloff: 0.7 } },
      { id: 'frost', name: 'Frost Sanctum', blurb: 'Freezing blasts slow everything near.', cost: 260, damage: 64, rate: 1.0, range: 215, splash: 55, slow: { pct: 0.45, time: 2.5 } },
    ],
  },
  barracks: {
    kind: 'barracks', name: 'Barracks', blurb: 'Soldiers block the road and fight.',
    damageType: 'physical', hitsAir: false, shotSpeed: 0,
    tiers: [
      { cost: 80, damage: 0, rate: 1, range: 170, soldiers: { count: 2, hp: 70, damage: 5, rate: 1, armor: 0.2, respawn: 10 } },
      { cost: 120, damage: 0, rate: 1, range: 180, soldiers: { count: 2, hp: 120, damage: 8, rate: 1, armor: 0.3, respawn: 9 } },
      { cost: 170, damage: 0, rate: 1, range: 190, soldiers: { count: 3, hp: 170, damage: 12, rate: 0.9, armor: 0.4, respawn: 8 } },
    ],
    branches: [
      { id: 'paladins', name: 'Paladin Hall', blurb: 'Tough knights who heal themselves.', cost: 240, damage: 0, rate: 1, range: 200,
        soldiers: { count: 3, hp: 300, damage: 18, rate: 0.9, armor: 0.5, respawn: 8, regen: 12 } },
      { id: 'drums', name: 'War Drums', blurb: 'Towers nearby hit 25% harder and faster.', cost: 220, damage: 0, rate: 1, range: 220,
        soldiers: { count: 3, hp: 170, damage: 12, rate: 0.9, armor: 0.4, respawn: 8 }, aura: { damage: 0.25, range: 0.1, speed: 0.2 } },
    ],
  },
};

export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];
/** Tiers 1–3 are upgrades; tier 4 is one of the two branches. */
export const MAX_TIER = 4;
/** Selling gives back this share of everything spent on the tower. */
export const SELL_BACK = 0.7;

/** Stats of a tower at `tier` (4 = its branch). */
export function tierStats(kind: TowerKind, tier: number, branch: 0 | 1 | null): TowerTier | Branch {
  return tier >= 4 && branch !== null ? TOWERS[kind].branches[branch] : TOWERS[kind].tiers[Math.min(tier, 3) - 1];
}

/** Gold spent to reach `tier` (1-based). */
export function spentTo(kind: TowerKind, tier: number, branch: 0 | 1 | null): number {
  const base = TOWERS[kind].tiers.slice(0, Math.min(tier, 3)).reduce((s, t) => s + t.cost, 0);
  return tier >= 4 && branch !== null ? base + TOWERS[kind].branches[branch].cost : base;
}

/** Art key of a tower: tiers 1–3, then the branch's own building. */
export const towerArt = (kind: TowerKind, tier: number, branch: 0 | 1 | null) =>
  tier >= 4 && branch !== null ? `tower.${kind}.${TOWERS[kind].branches[branch].id}` : `tower.${kind}.${tier}`;
