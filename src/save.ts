// The player's progress on this device: best stars per level, which enemy cards they have seen, and settings.
// localStorage only (a private window or blocked storage just starts fresh every time).

export interface Save {
  v: 1;
  stars: Record<string, number>;
  seen: string[];
  sound: boolean;
}

const KEY = 'tower-defense.save.v1';
const fresh = (): Save => ({ v: 1, stars: {}, seen: [], sound: true });

let cache: Save | null = null;

export function save(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<Save>) : null;
    cache = s && s.v === 1 ? { ...fresh(), ...s, stars: { ...(s.stars ?? {}) }, seen: [...(s.seen ?? [])] } : fresh();
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

export const totalStars = (): number => Object.values(save().stars).reduce((a, b) => a + b, 0);
