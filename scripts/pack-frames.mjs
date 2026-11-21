// Packs frames you choose into the exact file the manifest expects (for art from somewhere other than the kit).
//
//   npm run assets:pack -- <manifest key> <frame files...> [--scale 0.7]
//
// Example:
//   npm run assets:pack -- enemy.grunt.walk ~/Downloads/my-orc/Walk_*.png
//
// Frames are sorted by the number in their file name, scaled uniformly, centred horizontally and aligned to the
// bottom edge (single images are centred), then written as a horizontal strip. If you pass more frames than the
// manifest needs, they are sampled evenly. Output: public/assets/cc0/<path> when the asset's source is marked
// "cc0": true, otherwise public/assets/licensed/<path> (gitignored). For the CraftPix kit itself use `npm run assets:import`.
import fs from 'node:fs';
import path from 'node:path';
import { loadManifest, isCc0, PUBLIC_DIR, ROOT } from './lib/assets.mjs';
import { packFrames } from './lib/pack.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--scale');
const scale = at >= 0 ? Number(args[at + 1]) : undefined;
const [key, ...files] = args.filter((_, i) => at < 0 || (i !== at && i !== at + 1));
const m = loadManifest();
const a = m.assets.find((x) => x.key === key);
if (!a || !files.length) {
  console.error('Usage: npm run assets:pack -- <manifest key> <frame files...> [--scale 0.7]');
  if (key && !a) console.error(`Unknown key "${key}".`);
  process.exit(1);
}
if (files.length !== a.frameCount) console.warn(`Note: got ${files.length} frames, ${key} needs ${a.frameCount}; ${files.length > a.frameCount ? 'sampling evenly' : 'repeating frames'}.`);
const out = path.join(PUBLIC_DIR, isCc0(m, a) ? m.roots.cc0 : m.roots.licensed, a.path);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await packFrames(a, files, { scale }));
console.log(`Wrote ${path.relative(ROOT, out)} (${a.width}×${a.height}, ${a.frameCount} frame${a.frameCount > 1 ? 's' : ''}).`);
