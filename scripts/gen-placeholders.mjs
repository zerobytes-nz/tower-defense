// Regenerates public/assets/placeholder/** from assets.manifest.json + placeholder-art.mjs.
// Usage: npm run assets:placeholders
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { loadManifest, validateManifest, frameXY, PUBLIC_DIR } from './lib/assets.mjs';
import { drawers } from './placeholder-art.mjs';

const m = loadManifest();
const errs = validateManifest(m);
if (errs.length) { console.error('Manifest errors:\n  ' + errs.join('\n  ')); process.exit(1); }

let n = 0;
const missing = [];
for (const a of m.assets) {
  if (a.type === 'audio') continue; // no generated sounds yet
  const draw = drawers[a.key];
  if (!draw) { missing.push(a.key); continue; }
  const canvas = createCanvas(a.width, a.height);
  const c = canvas.getContext('2d');
  for (let i = 0; i < a.frameCount; i++) {
    c.save();
    const [fx, fy] = frameXY(a, i);
    c.beginPath(); c.rect(fx, fy, a.frameWidth, a.frameHeight); c.clip();
    c.translate(fx, fy);
    draw(c, a.frameWidth, a.frameHeight, i, a.frameCount); // file pixels
    c.restore();
  }
  const out = path.join(PUBLIC_DIR, m.roots.placeholder, a.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  n++;
}
console.log(`Wrote ${n} placeholder files to public/${m.roots.placeholder}/`);
if (missing.length) { console.error(`No placeholder drawer for: ${missing.join(', ')}`); process.exit(1); }
