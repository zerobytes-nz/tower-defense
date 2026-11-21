// The TheoSwap deep link: the game's website on TheoSwap is …/tower_defense/?userCode=$USER_CODE and TheoSwap
// fills in the player's code. Read once at start-up and taken out of the address bar. A link where it wasn't filled
// in ($USER_CODE) or a code too short to be real is ignored. Milestone 3 connects with it.
import { normalizeCode } from './theoswap.ts';

function read(): string {
  const q = new URLSearchParams(location.search), raw = q.get('userCode');
  if (raw === null) return '';
  q.delete('userCode');
  history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`);
  const clean = normalizeCode(raw);
  return clean.length >= 4 && clean !== 'USERCODE' ? clean : '';
}

/** The player code from the link, or '' (none, or unfilled / junk). */
export const linkCode = read();
