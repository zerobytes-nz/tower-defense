// AWIs (Altered World Items): what a player's NFTs become in Tower Defense. Pure data and logic (no Phaser),
// so the sim and `npm run sim` use it too.
//
// TheoSwap's user-items API returns one item per NFT from the game's config tree. Each item has an `itemId`
// (e.g. "tower_mage_frost") plus the attributes the config rolled for that NFT (Rarity, Crystal, …).
// This file turns that list into AWIs, merges exact duplicates, and works out what the chosen ones do.
//
// Fairness: guests can clear everything. An AWI is a sidegrade with a look of its own; rarity adds a small,
// capped bonus (Legendary: +15 %).
import type { TowerKind, TowerTier } from './towers.ts';
import { HEROES, type HeroDef } from './heroes.ts';

export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_COLOR: Record<Rarity, number> = { Common: 0xd8d0c0, Rare: 0x4cc9f0, Epic: 0xb084ff, Legendary: 0xffc94d };
/** Damage (towers) or health and damage (heroes) bonus per rarity. */
export const RARITY_BONUS: Record<Rarity, number> = { Common: 0, Rare: 0.05, Epic: 0.1, Legendary: 0.15 };

export type AwiSlot = 'tower' | 'hero' | 'spell' | 'crystal';

/** An AWI tower: replaces its family's normal tower (same tiers and branches) and adds one trick. */
export interface TowerVariant {
  id: string;              // TheoSwap itemId
  kind: TowerKind;
  name: string;
  blurb: string;
  tint: number;
  /** Multiplies range (all tiers). */
  range?: number;
  /** Added to every tier unless the tier already has its own (branches keep their trick). */
  perk?: Pick<TowerTier, 'burn' | 'stun' | 'chain' | 'slow'>;
  /** Barracks: soldier health ×, armour +, damage ×, respawn time ×. */
  soldiers?: { hp?: number; armor?: number; damage?: number; respawn?: number };
}

export const TOWER_VARIANTS: Record<string, TowerVariant> = {
  tower_archer_ranger: { id: 'tower_archer_ranger', kind: 'archer', name: "Ranger's Roost", blurb: '+20% range.', tint: 0xa8e080, range: 1.2 },
  tower_archer_venom: { id: 'tower_archer_venom', kind: 'archer', name: 'Venom Nest', blurb: 'Arrows poison: magic damage over 3s.', tint: 0x9ad04a, perk: { burn: { dps: 6, time: 3 } } },
  tower_catapult_ember: { id: 'tower_catapult_ember', kind: 'catapult', name: 'Ember Mortar', blurb: 'Boulders leave the ground burning.', tint: 0xff9a5a, perk: { burn: { dps: 10, time: 2 } } },
  tower_catapult_quake: { id: 'tower_catapult_quake', kind: 'catapult', name: 'Quake Engine', blurb: 'Boulders stun for 0.4s.', tint: 0xc8b090, perk: { stun: 0.4 } },
  tower_mage_frost: { id: 'tower_mage_frost', kind: 'mage', name: 'Frostbite Tower', blurb: 'Bolts slow by 30% for 1.5s.', tint: 0x9ad8ff, perk: { slow: { pct: 0.3, time: 1.5 } } },
  tower_mage_storm: { id: 'tower_mage_storm', kind: 'mage', name: 'Tempest Tower', blurb: 'Bolts arc to one more enemy.', tint: 0xffe066, perk: { chain: { count: 1, range: 110, falloff: 0.5 } } },
  tower_barracks_iron: { id: 'tower_barracks_iron', kind: 'barracks', name: 'Iron Guard', blurb: 'Soldiers: +40% health, tougher armour.', tint: 0xb8c0d0, soldiers: { hp: 1.4, armor: 0.15 } },
  tower_barracks_wolf: { id: 'tower_barracks_wolf', kind: 'barracks', name: 'Wolf Den', blurb: 'Soldiers: +25% damage, back 40% sooner.', tint: 0xd8a070, soldiers: { damage: 1.25, respawn: 0.6 } },
};

/** AWI heroes: TheoSwap itemId → hero id in heroes.ts. */
export const HERO_ITEMS: Record<string, string> = { hero_silver: 'silver', hero_bronze: 'bronze', hero_black: 'black' };

/** Crystals pay out once per NFT into the crystal bank; every CRYSTALS_PER_STAR is a bonus star for upgrades. */
// The ids are the ones the original Tower Defense configs used (so the items keep their images).
export const CRYSTAL_ITEMS: Record<string, string> = { c5y0iq: 'Green', vqfzxy: 'Red', cfx17w: 'Blue' };
export const CRYSTALS_PER_STAR = 200;

/** AWI spells (milestone 4 part 2). */
export const SPELL_ITEMS: Record<string, string> = {};

export interface AWI {
  key: string;            // itemId:rarity[:value], identical AWIs share it
  slot: AwiSlot;
  itemId: string;
  name: string;
  rarity: Rarity;
  /** Crystal amount (crystals); spell attributes later. */
  value: number;
  count: number;          // how many NFTs gave exactly this AWI
  tokens: string[];       // "contract:tokenId"
}

/** One entry of user-items `results`, as far as the game cares. */
export interface ApiItem {
  contract?: string;
  token_id?: string | number;
  tokenId?: string | number;
  itemData?: { itemId?: string; title?: string; Rarity?: string; [attr: string]: unknown } | null;
}

function slotOf(itemId: string): AwiSlot | null {
  if (TOWER_VARIANTS[itemId]) return 'tower';
  if (HERO_ITEMS[itemId]) return 'hero';
  if (CRYSTAL_ITEMS[itemId]) return 'crystal';
  if (SPELL_ITEMS[itemId]) return 'spell';
  return null;
}

export function nameOf(itemId: string): string {
  return TOWER_VARIANTS[itemId]?.name ?? (HERO_ITEMS[itemId] ? HEROES[HERO_ITEMS[itemId]].name : CRYSTAL_ITEMS[itemId] ? `${CRYSTAL_ITEMS[itemId]} Crystal` : itemId);
}

/** "Legendary Frost Spire", "Green Crystal ×350" */
export const awiTitle = (a: AWI) => a.slot === 'crystal' ? `${a.name} ×${a.value}` : `${a.rarity} ${a.name}`;

const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

/**
 * Turn user-items results into AWIs. Items this game doesn't know (an old config, a renamed item) are skipped;
 * an unknown rarity counts as Common. Exact duplicates merge with a count. Sorted: heroes, towers, spells,
 * crystals; best rarity first.
 */
export function parseAwis(results: ApiItem[]): AWI[] {
  const byKey = new Map<string, AWI>();
  for (const r of results ?? []) {
    const itemId = String(r?.itemData?.itemId ?? '');
    const slot = slotOf(itemId);
    if (!slot) continue;
    const raw = r.itemData?.Rarity;
    const rarity: Rarity = (RARITIES as readonly string[]).includes(String(raw)) ? (raw as Rarity) : 'Common';
    const value = slot === 'crystal' ? Math.max(0, Math.round(num(r.itemData?.Crystal, 100))) : 0;
    const key = `${itemId}:${rarity}${slot === 'crystal' ? `:${value}` : ''}`;
    const token = `${r.contract ?? ''}:${r.token_id ?? r.tokenId ?? '?'}`;
    const a = byKey.get(key);
    if (a) { a.count++; a.tokens.push(token); continue; }
    byKey.set(key, { key, slot, itemId, name: nameOf(itemId), rarity, value, count: 1, tokens: [token] });
  }
  const order: AwiSlot[] = ['hero', 'tower', 'spell', 'crystal'];
  return [...byKey.values()].sort((x, y) => order.indexOf(x.slot) - order.indexOf(y.slot) || RARITIES.indexOf(y.rarity) - RARITIES.indexOf(x.rarity));
}

// ── Loadout ───────────────────────────────────────────────────────────────────────────────────────

/** The listing's inventory size: how many AWIs can be taken into a level. Crystals don't use a slot. */
export const LOADOUT_SIZE = 5;
/** At most one hero, one AWI tower per family and two AWI spells. */
export const SPELL_SLOTS = 2;

/** Why `a` can't be added to `picked` (null: it can). */
export function cantAdd(picked: AWI[], a: AWI): string | null {
  if (a.slot === 'crystal') return 'Crystals pay out on their own.';
  if (picked.some((p) => p.key === a.key)) return null;
  if (picked.length >= LOADOUT_SIZE) return `The loadout holds ${LOADOUT_SIZE}.`;
  if (a.slot === 'hero' && picked.some((p) => p.slot === 'hero')) return 'One hero at a time.';
  if (a.slot === 'tower' && picked.some((p) => p.slot === 'tower' && TOWER_VARIANTS[p.itemId].kind === TOWER_VARIANTS[a.itemId].kind)) return 'One AWI tower per family.';
  if (a.slot === 'spell' && picked.filter((p) => p.slot === 'spell').length >= SPELL_SLOTS) return `${SPELL_SLOTS} AWI spells at most.`;
  return null;
}

/** Best first: a hero, then towers, then spells, while the rules allow. Keeps a still-valid previous pick. */
export function defaultLoadout(awis: AWI[], previous?: string[]): string[] {
  const pool = awis.filter((a) => a.slot !== 'crystal');
  if (previous) {
    const kept: AWI[] = [];
    for (const k of previous) { const a = pool.find((x) => x.key === k); if (a && !cantAdd(kept, a)) kept.push(a); }
    if (kept.length || previous.length === 0) return kept.map((a) => a.key);
  }
  const picked: AWI[] = [];
  for (const a of pool) if (!cantAdd(picked, a)) picked.push(a);
  return picked.map((a) => a.key);
}

/** What the loadout changes in a battle. */
export interface AwiBattle {
  towers: Partial<Record<TowerKind, { variant: TowerVariant; bonus: number; rarity: Rarity }>>;
  hero?: HeroDef;
}

export function battleAwis(awis: AWI[], keys: string[]): AwiBattle {
  const out: AwiBattle = { towers: {} };
  for (const k of keys) {
    const a = awis.find((x) => x.key === k);
    if (!a) continue;
    const bonus = RARITY_BONUS[a.rarity];
    if (a.slot === 'tower') { const v = TOWER_VARIANTS[a.itemId]; out.towers[v.kind] = { variant: v, bonus, rarity: a.rarity }; }
    if (a.slot === 'hero') {
      const h = HEROES[HERO_ITEMS[a.itemId]];
      out.hero = { ...h, hp: Math.round(h.hp * (1 + bonus)), damage: +(h.damage * (1 + bonus)).toFixed(1), rarity: a.rarity };
    }
  }
  return out;
}

/** A tower tier with its AWI variant applied. */
export function variantStats(st: TowerTier, v: { variant: TowerVariant; bonus: number }): TowerTier {
  const { variant: w, bonus } = v;
  const out: TowerTier = { ...st, damage: st.damage * (1 + bonus), range: st.range * (w.range ?? 1) };
  if (w.perk) for (const [k, val] of Object.entries(w.perk)) if ((out as unknown as Record<string, unknown>)[k] === undefined) (out as unknown as Record<string, unknown>)[k] = val;
  if (st.soldiers) {
    const s = w.soldiers ?? {};
    out.soldiers = {
      ...st.soldiers,
      hp: Math.round(st.soldiers.hp * (s.hp ?? 1) * (1 + bonus)),
      armor: Math.min(0.8, st.soldiers.armor + (s.armor ?? 0)),
      damage: st.soldiers.damage * (s.damage ?? 1) * (1 + bonus),
      respawn: st.soldiers.respawn * (s.respawn ?? 1),
    };
  }
  return out;
}

/** What an AWI does, for the reveal cards and the loadout screen. */
export function perkText(a: AWI): string {
  const pct = Math.round(RARITY_BONUS[a.rarity] * 100), plus = pct ? ` +${pct}% ${a.slot === 'hero' ? 'health and damage' : 'damage'}.` : '';
  if (a.slot === 'tower') return `Replaces the ${TOWER_VARIANTS[a.itemId].kind === 'barracks' ? 'Barracks' : TOWER_VARIANTS[a.itemId].kind === 'mage' ? 'Mage Tower' : TOWER_VARIANTS[a.itemId].kind === 'archer' ? 'Archer Tower' : 'Catapult'}. ${TOWER_VARIANTS[a.itemId].blurb}${plus}`;
  if (a.slot === 'hero') { const h = HEROES[HERO_ITEMS[a.itemId]]; return `${h.ability.name}: ${h.ability.blurb}${plus}`; }
  if (a.slot === 'crystal') return `${a.value} crystals, paid once. Every ${CRYSTALS_PER_STAR} make a bonus star.`;
  return '';
}
