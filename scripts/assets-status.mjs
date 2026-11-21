// Prints which assets the game will use: licensed, cc0, placeholder, or missing.
// Usage: npm run assets:status
import { loadManifest, resolveAssets } from './lib/assets.mjs';

const m = loadManifest();
const rows = resolveAssets(m);
const icon = { licensed: '●', cc0: '◆', placeholder: '○', missing: '✖' };
const pad = (s, n) => String(s).padEnd(n);
const kw = Math.max(...rows.map((r) => r.asset.key.length)) + 2;
console.log(`\n${pad('KEY', kw)}${pad('USING', 14)}FILE`);
for (const r of rows) {
  let note = '';
  if (r.licensed.exists && !r.licensed.sizeOk) note = `  ← licensed file is ${r.licensed.size?.width ?? '?'}×${r.licensed.size?.height ?? '?'}, needs ${r.asset.width}×${r.asset.height}`;
  else if (r.cc0.exists && !r.cc0.sizeOk) note = `  ← cc0 file is ${r.cc0.size?.width ?? '?'}×${r.cc0.size?.height ?? '?'}, needs ${r.asset.width}×${r.asset.height}`;
  else if (r.cc0.exists && !r.cc0Allowed) note = `  ← cc0 file ignored: source "${r.asset.source}" is not CC0`;
  const file = { licensed: r.licensedFile, cc0: r.cc0File }[r.state] ?? r.placeholderFile;
  console.log(`${pad(r.asset.key, kw)}${icon[r.state]} ${pad(r.state, 12)}${file}${note}`);
}
const count = (s) => rows.filter((r) => r.state === s).length;
console.log(`\n${count('licensed')} licensed · ${count('cc0')} cc0 · ${count('placeholder')} placeholder · ${count('missing')} missing  (of ${rows.length})\n`);
if (count('missing')) process.exitCode = 1;
