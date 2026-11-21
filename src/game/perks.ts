// The upgrade tree: stars earned in levels buy lasting perks. Pure data (no Phaser).
// Six columns of four. A column is bought top to bottom; Reset gives every star back.
import { noMods, type Mods } from './sim.ts';
import type { TowerKind } from './towers.ts';

export interface Perk {
  id: string;
  name: string;
  blurb: string;
  cost: number;     // stars
  /** Art key of the icon (the kit's upgrade icons). */
  icon: string;
  apply: (m: Mods) => void;
}

export interface PerkColumn { id: string; name: string; perks: [Perk, Perk, Perk, Perk] }

const COST = [1, 1, 2, 3] as const;
const dmg = (k: TowerKind, x: number) => (m: Mods) => { m.damage[k] *= 1 + x; };
const rng = (k: TowerKind, x: number) => (m: Mods) => { m.range[k] *= 1 + x; };
const p = (id: string, row: number, name: string, blurb: string, icon: number, apply: (m: Mods) => void): Perk =>
  ({ id, name, blurb, cost: COST[row], icon: `perk.${icon}`, apply });

export const PERKS: PerkColumn[] = [
  { id: 'archer', name: 'Archers', perks: [
    p('archer1', 0, 'Sharp Arrows', 'Archer Towers deal 10% more damage.', 5, dmg('archer', 0.1)),
    p('archer2', 1, 'Eagle Eye', 'Archer Towers reach 10% further.', 7, rng('archer', 0.1)),
    p('archer3', 2, 'Steel Tips', 'Archer Towers deal 10% more damage.', 6, dmg('archer', 0.1)),
    p('archer4', 3, 'Golden Bows', 'Archer Towers deal 15% more damage.', 8, dmg('archer', 0.15)),
  ] },
  { id: 'catapult', name: 'Catapults', perks: [
    p('catapult1', 0, 'Heavy Stones', 'Catapults deal 10% more damage.', 11, dmg('catapult', 0.1)),
    p('catapult2', 1, 'Bigger Blast', 'Boulders hit 15% wider.', 10, (m) => { m.splash *= 1.15; }),
    p('catapult3', 2, 'Long Arm', 'Catapults reach 10% further.', 9, rng('catapult', 0.1)),
    p('catapult4', 3, 'Spiked Shot', 'Catapults deal 15% more damage.', 12, dmg('catapult', 0.15)),
  ] },
  { id: 'mage', name: 'Mages', perks: [
    p('mage1', 0, 'Focus Crystal', 'Mage Towers deal 10% more damage.', 13, dmg('mage', 0.1)),
    p('mage2', 1, 'Far Sight', 'Mage Towers reach 10% further.', 14, rng('mage', 0.1)),
    p('mage3', 2, 'Emerald Staff', 'Mage Towers deal 10% more damage.', 15, dmg('mage', 0.1)),
    p('mage4', 3, 'Sun Staff', 'Mage Towers deal 15% more damage.', 16, dmg('mage', 0.15)),
  ] },
  { id: 'barracks', name: 'Barracks', perks: [
    p('barracks1', 0, 'Drill', 'Soldiers have 15% more health.', 4, (m) => { m.soldierHp *= 1.15; }),
    p('barracks2', 1, 'Better Blades', 'Soldiers hit 15% harder.', 2, dmg('barracks', 0.15)),
    p('barracks3', 2, 'Shield Wall', 'Soldiers have 20% more health.', 19, (m) => { m.soldierHp *= 1.2; }),
    p('barracks4', 3, 'Field Plans', 'Every tower costs 8% less.', 3, (m) => { m.cost *= 0.92; }),
  ] },
  { id: 'spells', name: 'Spells', perks: [
    p('spells1', 0, 'Hot Rocks', 'Spells are 15% stronger.', 17, (m) => { m.spellPower *= 1.15; }),
    p('spells2', 1, 'Quick Hands', 'Spells and Shield Slam recharge 10% faster.', 22, (m) => { m.cooldown *= 0.9; }),
    p('spells3', 2, 'Firestorm', 'Spells are 20% stronger.', 24, (m) => { m.spellPower *= 1.2; }),
    p('spells4', 3, 'Arcane Haste', 'Spells and Shield Slam recharge 15% faster.', 18, (m) => { m.cooldown *= 0.85; }),
  ] },
  { id: 'hero', name: 'Hero & Camp', perks: [
    p('hero1', 0, 'Winter Stores', 'Start every level with 40 more gold.', 21, (m) => { m.gold += 40; }),
    p('hero2', 1, 'Training', 'The hero is 12% stronger.', 23, (m) => { m.heroPower *= 1.12; }),
    p('hero3', 2, 'Magic Ward', 'Start every level with 3 more lives.', 1, (m) => { m.lives += 3; }),
    p('hero4', 3, "Hero's Aura", 'The hero is 18% stronger.', 20, (m) => { m.heroPower *= 1.18; }),
  ] },
];

export const ALL_PERKS = PERKS.flatMap((c) => c.perks);
export const perkById = (id: string) => ALL_PERKS.find((x) => x.id === id);
export const perksCost = (owned: string[]) => owned.reduce((s, id) => s + (perkById(id)?.cost ?? 0), 0);

/** A perk can be bought if the one above it in its column is owned. */
export function canBuy(owned: string[], id: string): boolean {
  if (owned.includes(id)) return false;
  for (const c of PERKS) { const i = c.perks.findIndex((x) => x.id === id); if (i >= 0) return i === 0 || owned.includes(c.perks[i - 1].id); }
  return false;
}

/** The sim's bonuses for these perks. */
export function modsFor(owned: string[]): Mods {
  const m = noMods();
  for (const id of owned) perkById(id)?.apply(m);
  return m;
}
