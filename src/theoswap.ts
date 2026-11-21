// TheoSwap connection (wired into the game in milestone 4): fetch a player's items with their user code,
// and keep the last good answer per code for bad signal.
//
// The browser only ever calls OUR server: ./api/user-items?userCode=… . There, nginx (production) or the
// Vite dev server (npm run dev / preview, see vite.config.ts) adds the API key and forwards the request to
// TheoSwap's GET /api/public/user-items. No key is ever in this bundle (check-assets enforces it).

/** One entry of user-items `results`, as far as the game cares. */
export interface ApiItem {
  contract?: string;
  token_id?: string | number;
  tokenId?: string | number;
  itemData?: { itemId?: string; title?: string; Rarity?: string; [attr: string]: unknown } | null;
}

const PROXY = './api/user-items';
const LS_ITEMS = 'tower-defense.items.v1.'; // + code

const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown): void { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / full */ } },
};

/** User codes are 8 letters/digits on the TheoSwap profile page. */
export const normalizeCode = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 16).toUpperCase();

export class ConnectError extends Error {}

async function fetchResults(code: string): Promise<ApiItem[]> {
  const url = `${new URL(PROXY, document.baseURI)}?${new URLSearchParams({ userCode: code })}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; results?: ApiItem[] } | null;
    if (!body) throw new ConnectError(`TheoSwap answered ${res.status} with no data.`);
    if (body.status === false) throw new ConnectError(body.message || 'TheoSwap did not accept that code.');
    return Array.isArray(body.results) ? body.results : [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The items for a user code. On a network failure, falls back to the last good answer for that code
 * (`cached: true`). A clear "no" from TheoSwap (bad code) is not hidden by the cache.
 */
export async function fetchItems(code: string): Promise<{ results: ApiItem[]; cached: boolean; at: number }> {
  try {
    const results = await fetchResults(code);
    const at = Date.now();
    store.set(LS_ITEMS + code, { at, results });
    return { results, cached: false, at };
  } catch (e) {
    const hit = store.get<{ at: number; results: ApiItem[] }>(LS_ITEMS + code);
    if (e instanceof ConnectError || !hit) throw e instanceof ConnectError ? e : new ConnectError('Could not reach TheoSwap. Check your connection and try again.');
    return { ...hit, cached: true };
  }
}
