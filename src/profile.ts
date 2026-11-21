// The TheoSwap-connected player: their code and the raw user-items results (AWIs are rebuilt from these with
// awi.ts, so a rule change never needs a re-connect). Kept in localStorage, so the player stays connected and keeps
// their AWIs (Altered World Items) offline. Their game progress is the 'me' save in save.ts.
import { fetchItems, type ApiItem } from './theoswap.ts';

export interface Connection {
  code: string;
  source: 'live' | 'cache'; // a fresh answer, or the last good one (offline)
  at: number;               // when the items were fetched
  results: ApiItem[];
}

const KEY = 'tower-defense.theoswap.v1';

export function loadConnection(): Connection | null {
  try { const v = localStorage.getItem(KEY); const c = v ? (JSON.parse(v) as Connection) : null; return c && typeof c.code === 'string' && Array.isArray(c.results) ? c : null; } catch { return null; }
}
const keep = (c: Connection): void => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode */ } };
export const forgetConnection = (): void => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } };

/** Sign in with a TheoSwap player code. Throws ConnectError with a message for the player. */
export async function connect(code: string): Promise<Connection> {
  const { results, cached, at } = await fetchItems(code);
  const c: Connection = { code, source: cached ? 'cache' : 'live', at, results };
  keep(c);
  return c;
}
