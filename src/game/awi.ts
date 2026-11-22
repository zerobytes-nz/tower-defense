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

// ── AWI spells ────────────────────────────────────────────────────────────────────────────────────
// Up to two ride along as extra spell buttons. Their numbers come from the NFT's attributes (TheoSwap rolls them
// within the config's ranges); a missing or odd value falls back to `def`, and every value is capped at `max`.
// The ids are the ones the original Tower Defense configs used.

export type AwiSpellId = 'armor' | 'rally' | 'fire' | 'acid' | 'slow' | 'rock' | 'freeze' | 'lightning';
/** road: tap the road; enemy: tap an enemy; instant: fires when the button is tapped. */
export type SpellTarget = 'road' | 'enemy' | 'instant';
/** Spell numbers: dmg (damage, or damage per second), time (s), pct (0..1), speed (attack speed 0..1), hp. */
export type SpellParams = Partial<Record<'dmg' | 'time' | 'pct' | 'speed' | 'hp', number>>;

export interface AwiSpellDef {
  id: AwiSpellId;
  itemId: string;
  name: string;
  target: SpellTarget;
  cooldown: number;
  radius: number;
  color: number;
  /** TheoSwap attribute → param. `pct`: the attribute is a percentage ("35" → 0.35). */
  attrs: { key: string; param: keyof SpellParams; pct?: boolean; def: number; max: number }[];
  /** What it does, with the numbers. */
  text: (p: SpellParams) => string;
  /** One short line for cards: "60/s · 8s". */
  stat: (p: SpellParams) => string;
}

const pc = (v = 0) => `${Math.round(v * 100)}%`;
export const AWI_SPELLS: Record<AwiSpellId, AwiSpellDef> = {
  armor: {
    id: 'armor', itemId: '0nyq0v', name: 'Armor Break', target: 'road', cooldown: 30, radius: 110, color: 0xff7a5a,
    attrs: [{ key: 'Damage Taken', param: 'pct', pct: true, def: 0.15, max: 0.6 }, { key: 'Duration', param: 'time', def: 6, max: 20 }],
    text: (p) => `Enemies in the area take ${pc(p.pct)} more damage for ${p.time}s.`, stat: (p) => `+${pc(p.pct)} dmg · ${p.time}s`,
  },
  rally: {
    id: 'rally', itemId: '05s41q', name: 'Troop Rally', target: 'instant', cooldown: 45, radius: 0, color: 0xffc94d,
    attrs: [{ key: 'Damage Buff', param: 'pct', pct: true, def: 0.15, max: 0.6 }, { key: 'Attack Speed', param: 'speed', pct: true, def: 0.15, max: 0.6 }, { key: 'Duration', param: 'time', def: 8, max: 20 }],
    text: (p) => `Every tower: +${pc(p.pct)} damage and ${pc(p.speed)} faster for ${p.time}s.`, stat: (p) => `+${pc(p.pct)} / +${pc(p.speed)} · ${p.time}s`,
  },
  fire: {
    id: 'fire', itemId: 'mb2qqv', name: 'Fire', target: 'enemy', cooldown: 25, radius: 0, color: 0xff8a3a,
    attrs: [{ key: 'Damage', param: 'dmg', def: 40, max: 100 }, { key: 'Duration', param: 'time', def: 5, max: 15 }],
    text: (p) => `Sets one enemy ablaze: ${p.dmg} magic damage a second for ${p.time}s.`, stat: (p) => `${p.dmg}/s · ${p.time}s`,
  },
  acid: {
    id: 'acid', itemId: 'vkvbbo', name: 'Acid Rain', target: 'road', cooldown: 35, radius: 85, color: 0x9ad04a,
    attrs: [{ key: 'Damage', param: 'dmg', def: 30, max: 90 }, { key: 'Duration', param: 'time', def: 8, max: 20 }],
    text: (p) => `A patch of road burns anything walking through: ${p.dmg} a second for ${p.time}s.`, stat: (p) => `${p.dmg}/s · ${p.time}s`,
  },
  slow: {
    id: 'slow', itemId: 'o591ot', name: 'Slow', target: 'instant', cooldown: 50, radius: 0, color: 0x9a8aff,
    attrs: [{ key: 'Speed Reduction', param: 'pct', pct: true, def: 0.25, max: 0.75 }, { key: 'Duration', param: 'time', def: 5, max: 15 }],
    text: (p) => `Every enemy on the map moves ${pc(p.pct)} slower for ${p.time}s (bosses half).`, stat: (p) => `-${pc(p.pct)} · ${p.time}s`,
  },
  rock: {
    id: 'rock', itemId: 'ftmz0g', name: 'Drop Rock', target: 'road', cooldown: 40, radius: 30, color: 0xb0a090,
    attrs: [{ key: 'Health', param: 'hp', def: 300, max: 1500 }],
    text: (p) => `Drops a rock on the road. Enemies stop to smash it (${p.hp} health).`, stat: (p) => `${p.hp} health`,
  },
  freeze: {
    id: 'freeze', itemId: 'wqgm6w', name: 'Freeze', target: 'road', cooldown: 45, radius: 95, color: 0x9ad8ff,
    attrs: [{ key: 'Speed Reduction', param: 'pct', pct: true, def: 0.4, max: 0.8 }, { key: 'Damage', param: 'dmg', def: 10, max: 25 }, { key: 'Duration', param: 'time', def: 6, max: 20 }],
    text: (p) => `A frozen patch of road: ${pc(p.pct)} slower and ${p.dmg} damage a second for ${p.time}s.`, stat: (p) => `-${pc(p.pct)} · ${p.time}s`,
  },
  lightning: {
    id: 'lightning', itemId: '5f00yg', name: 'Lightning Strike', target: 'enemy', cooldown: 30, radius: 0, color: 0xffe066,
    attrs: [{ key: 'Damage', param: 'dmg', def: 800, max: 2000 }],
    text: (p) => `${p.dmg} magic damage to one enemy (flyers too).`, stat: (p) => `${p.dmg} dmg`,
  },
};
/** TheoSwap itemId → AWI spell. */
export const SPELL_ITEMS: Record<string, AwiSpellId> = Object.fromEntries(Object.values(AWI_SPELLS).map((d) => [d.itemId, d.id]));

/** A spell's numbers from an NFT's attributes. */
export function spellParams(id: AwiSpellId, data: Record<string, unknown> = {}): SpellParams {
  const p: SpellParams = {};
  for (const a of AWI_SPELLS[id].attrs) {
    let v = Number(data[a.key]);
    if (!Number.isFinite(v) || v <= 0) v = a.def;
    else if (a.pct) v /= 100;
    p[a.param] = a.pct ? Math.min(a.max, +v.toFixed(2)) : Math.min(a.max, Math.round(v));
  }
  return p;
}

export interface AWI {
  key: string;            // itemId:rarity[:value], identical AWIs share it
  slot: AwiSlot;
  itemId: string;
  name: string;
  rarity: Rarity;
  /** Crystal amount (crystals). */
  value: number;
  /** Spells: the numbers rolled for this NFT. */
  params?: SpellParams;
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
  if (SPELL_ITEMS[itemId]) return AWI_SPELLS[SPELL_ITEMS[itemId]].name;
  return TOWER_VARIANTS[itemId]?.name ?? (HERO_ITEMS[itemId] ? HEROES[HERO_ITEMS[itemId]].name : CRYSTAL_ITEMS[itemId] ? `${CRYSTAL_ITEMS[itemId]} Crystal` : itemId);
}

/** "Legendary Frostbite Tower", "Green Crystal ×350", "Fire 60/s · 8s" */
export const awiTitle = (a: AWI) => a.slot === 'crystal' ? `${a.name} ×${a.value}` : a.slot === 'spell' ? `${a.name} ${awiStat(a)}` : `${a.rarity} ${a.name}`;
/** The short line under a card's name: rarity, crystal amount, or the spell's numbers. */
export const awiStat = (a: AWI) => a.slot === 'crystal' ? `×${a.value}` : a.slot === 'spell' ? AWI_SPELLS[SPELL_ITEMS[a.itemId]].stat(a.params ?? spellParams(SPELL_ITEMS[a.itemId])) : a.rarity;

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
    const params = slot === 'spell' ? spellParams(SPELL_ITEMS[itemId], r.itemData ?? {}) : undefined;
    const key = `${itemId}:${rarity}${slot === 'crystal' ? `:${value}` : ''}${params ? `:${Object.values(params).join(':')}` : ''}`;
    const token = `${r.contract ?? ''}:${r.token_id ?? r.tokenId ?? '?'}`;
    const a = byKey.get(key);
    if (a) { a.count++; a.tokens.push(token); continue; }
    byKey.set(key, { key, slot, itemId, name: nameOf(itemId), rarity, value, params, count: 1, tokens: [token] });
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
  /** Extra spell buttons, in loadout order (at most SPELL_SLOTS). */
  spells?: { def: AwiSpellDef; params: SpellParams }[];
}

export function battleAwis(awis: AWI[], keys: string[]): AwiBattle {
  const out: AwiBattle = { towers: {}, spells: [] };
  for (const k of keys) {
    const a = awis.find((x) => x.key === k);
    if (!a) continue;
    const bonus = RARITY_BONUS[a.rarity];
    if (a.slot === 'tower') { const v = TOWER_VARIANTS[a.itemId]; out.towers[v.kind] = { variant: v, bonus, rarity: a.rarity }; }
    if (a.slot === 'hero') {
      const h = HEROES[HERO_ITEMS[a.itemId]];
      out.hero = { ...h, hp: Math.round(h.hp * (1 + bonus)), damage: +(h.damage * (1 + bonus)).toFixed(1), rarity: a.rarity };
    }
    if (a.slot === 'spell' && out.spells!.length < SPELL_SLOTS) {
      const id = SPELL_ITEMS[a.itemId];
      out.spells!.push({ def: AWI_SPELLS[id], params: a.params ?? spellParams(id) });
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
  const d = AWI_SPELLS[SPELL_ITEMS[a.itemId]];
  return `Spell: ${d.text(a.params ?? spellParams(d.id))} Recharges in ${d.cooldown}s.`;
}
