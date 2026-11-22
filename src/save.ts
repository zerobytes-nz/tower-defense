// The player's progress on this device: best stars per level, which enemy cards they have seen, and settings.
// localStorage only (a private window or blocked storage just starts fresh every time).

export interface Save {
  v: 1;
  stars: Record<string, number>;
  seen: string[];
  sound: boolean;
  /** Upgrade-tree perks bought with stars (perks.ts). */
  perks: string[];
  /** Levels cleared on Heroic (each is worth one more star). */
  heroic: string[];
  /** Best wave reached in Endless, per level. */
  endless: Record<string, number>;
  /** Crystal AWIs: crystals paid in (once per NFT, by token) and the tokens already paid. */
  crystals: { bank: number; paid: string[] };
}

import { CRYSTALS_PER_STAR } from './game/awi.ts';

const KEY = 'tower-defense.save.v1';
const fresh = (): Save => ({ v: 1, stars: {}, seen: [], sound: true, perks: [], heroic: [], endless: {}, crystals: { bank: 0, paid: [] } });

let cache: Save | null = null;

export function save(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : null;
    cache = s && s.v === 1 ? { ...fresh(), ...s, stars: { ...(s.stars ?? {}) }, seen: [...(s.seen ?? [])], perks: [...(s.perks ?? [])], heroic: [...(s.heroic ?? [])], endless: { ...(s.endless ?? {}) }, crystals: { bank: s.crystals?.bank ?? 0, paid: [...(s.crystals?.paid ?? [])] } } : fresh();
  } catch { cache = fresh(); }
  return cache;
}

export function write(): void {
  try { localStorage.setItem(KEY, JSON.stringify(save())); } catch { /* private mode */ }
}

/** Keeps the best result. Returns true if it is a new best. */
export function recordStars(level: string, stars: number): boolean {
  const s = save();
  if ((s.stars[level] ?? 0) >= stars) return false;
  s.stars[level] = stars;
  write();
  return true;
}

export function markSeen(kind: string): void {
  const s = save();
  if (!s.seen.includes(kind)) { s.seen.push(kind); write(); }
}

/** A level is open once the one before it has at least one star (the first is always open). */
export function unlocked(levelIds: string[], i: number): boolean {
  return i === 0 || (save().stars[levelIds[i - 1]] ?? 0) > 0;
}

/** A Heroic clear. Returns true the first time (that's the bonus star). */
export function recordHeroic(level: string): boolean {
  const s = save();
  if (s.heroic.includes(level)) return false;
  s.heroic.push(level); write();
  return true;
}

/** Keeps the best Endless wave. Returns true if it is a new best. */
export function recordEndless(level: string, wave: number): boolean {
  const s = save();
  if ((s.endless[level] ?? 0) >= wave) return false;
  s.endless[level] = wave; write();
  return true;
}

/** Crystal AWIs: pay each NFT's crystals in once. Returns how many crystals were new. */
export function payCrystals(nfts: { token: string; amount: number }[]): number {
  const c = save().crystals;
  let paid = 0;
  for (const n of nfts) if (!c.paid.includes(n.token)) { c.paid.push(n.token); c.bank += n.amount; paid += n.amount; }
  if (paid) write();
  return paid;
}

/** Bonus stars from the crystal bank. */
export const crystalStars = (per: number): number => Math.floor(save().crystals.bank / per);

/** Up to 3 per level, plus 1 per Heroic clear, plus crystal stars (src/game/awi.ts). */
export const totalStars = (): number => Object.values(save().stars).reduce((a, b) => a + b, 0) + save().heroic.length + crystalStars(CRYSTALS_PER_STAR);

/** Stars not yet spent on perks. */
export const freeStars = (spent: number): number => totalStars() - spent;
