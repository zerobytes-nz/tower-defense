// The four tower families and their tiers. Pure data (no Phaser), shared by the sim, the bot and the UI.
// Costs are per step: tiers[0].cost builds it, tiers[1].cost upgrades to tier 2, and so on.
// Tier 4 (two branches per family) arrives in milestone 2.

export type TowerKind = 'archer' | 'catapult' | 'mage' | 'support';
export type DamageType = 'physical' | 'magic';

export interface TowerTier {
  cost: number;
  damage: number;    // per hit (support: 0)
  rate: number;      // seconds between attacks
  range: number;     // px
  splash?: number;   // px radius (catapult)
  /** Support aura: bonuses for other towers whose centre is inside `range`. */
  aura?: { damage: number; range: number; speed: number };
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  blurb: string;
  damageType: DamageType;
  hitsAir: boolean;
  /** Projectile speed in px/s (catapult boulders fly in a fixed time instead). */
  shotSpeed: number;
  tiers: TowerTier[];
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
  },
  catapult: {
    kind: 'catapult', name: 'Catapult', blurb: 'Boulders that crush groups. Ground only.',
    damageType: 'physical', hitsAir: false, shotSpeed: 0,
    tiers: [
      { cost: 110, damage: 26, rate: 2.4, range: 210, splash: 55 },
      { cost: 160, damage: 44, rate: 2.2, range: 222, splash: 62 },
      { cost: 230, damage: 68, rate: 2.0, range: 235, splash: 70 },
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
  },
  support: {
    kind: 'support', name: 'War Camp', blurb: 'No attack. Boosts towers around it.',
    damageType: 'physical', hitsAir: false, shotSpeed: 0,
    tiers: [
      { cost: 90, damage: 0, rate: 1, range: 190, aura: { damage: 0.15, range: 0, speed: 0 } },
      { cost: 130, damage: 0, rate: 1, range: 205, aura: { damage: 0.25, range: 0.1, speed: 0 } },
      { cost: 180, damage: 0, rate: 1, range: 220, aura: { damage: 0.35, range: 0.15, speed: 0.15 } },
    ],
  },
};

export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];
export const MAX_TIER = 3;
/** Selling gives back this share of everything spent on the tower. */
export const SELL_BACK = 0.7;

/** Gold spent to reach `tier` (1-based). */
export const spentTo = (kind: TowerKind, tier: number) => TOWERS[kind].tiers.slice(0, tier).reduce((s, t) => s + t.cost, 0);
