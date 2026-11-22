// The connected TheoSwap player on this device: their code, their AWIs, and the loadout they picked.
// Demo players use bundled items (src/demo.ts). Crystals are paid into the save once per NFT on connect.
import { parseAwis, defaultLoadout, battleAwis, type AWI, type AwiBattle } from './game/awi.ts';
import { fetchItems } from './theoswap.ts';
import { DEMO_PROFILES, type DemoId } from './demo.ts';
import { payCrystals } from './save.ts';

export type Source = 'live' | 'cache' | 'demo';
export interface Profile {
  code: string;          // TheoSwap user code, or demo:<id>
  label: string;         // "Collector (demo)", "Code AB12CD34"
  source: Source;
  awis: AWI[];
  /** AWI keys in the loadout (src/game/awi.ts: up to LOADOUT_SIZE). */
  loadout: string[];
  fetchedAt: number;
}

const LS = 'tower-defense.profile.v1';
let cache: Profile | null | undefined;

export function profile(): Profile | null {
  if (cache !== undefined) return cache;
  try { const v = localStorage.getItem(LS); cache = v ? (JSON.parse(v) as Profile) : null; } catch { cache = null; }
  return cache;
}
export function saveProfile(p: Profile | null): void {
  cache = p;
  try { if (p) localStorage.setItem(LS, JSON.stringify(p)); else localStorage.removeItem(LS); } catch { /* private mode */ }
}

function make(code: string, label: string, source: Source, awis: AWI[], fetchedAt: number): { profile: Profile; crystals: number } {
  const prev = profile();
  const p: Profile = { code, label, source, awis, fetchedAt, loadout: defaultLoadout(awis, prev?.code === code ? prev.loadout : undefined) };
  saveProfile(p);
  const crystals = payCrystals(awis.filter((a) => a.slot === 'crystal').flatMap((a) => a.tokens.map((token) => ({ token: `${code.startsWith('demo:') ? 'demo|' : ''}${token}`, amount: a.value }))));
  return { profile: p, crystals };
}

/** Look up a player's AWIs by their TheoSwap code. */
export async function connect(code: string): Promise<{ profile: Profile; crystals: number }> {
  const r = await fetchItems(code);
  return make(code, `Code ${code}`, r.cached ? 'cache' : 'live', parseAwis(r.results), r.at);
}

export function connectDemo(id: DemoId): { profile: Profile; crystals: number } {
  const d = DEMO_PROFILES[id];
  return make(`demo:${id}`, `${d.name} (demo)`, 'demo', parseAwis(d.sample), Date.now());
}

/** What the connected player's loadout brings into a battle (nothing for guests). */
export function currentAwis(): AwiBattle {
  const p = profile();
  return p ? battleAwis(p.awis, p.loadout) : { towers: {} };
}
