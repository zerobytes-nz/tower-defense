// Copies the three hero knights out of YOUR download of CraftPix "Knight Characters Free Sprite"
// into public/assets/licensed/ (gitignored). The pack folder is only read: nothing in it is moved or changed.
//
//   npm run assets:import-knights -- "<pack folder>"     (the one that holds PNG/black_knight/, PNG/silver_knight/ …)
//
// Every manifest entry with a `pack` field ({ folder, anim }) is made from PNG/<folder>/*<anim>_NNN.png.
// The pack's frames are trimmed, so each animation comes on a different canvas size. To keep the knight still,
// every animation of one knight uses ONE scale (from its idle height) and is placed so its feet (the mean x of
// the lowest visible pixels) stand at the frame's bottom centre, FEET px up — the same spot as the placeholder.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadManifest, PUBLIC_DIR, ROOT } from './lib/assets.mjs';
import { sampleFrames } from './lib/pack.mjs';

/** Idle height in file pixels (2× the game's pixels). The spear and the halberd make those two taller. */
const IDLE_HEIGHT = { silver_knight: 116, bronze_knight: 134, black_knight: 132 };
const FEET = 6;

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'PNG', 'silver_knight'))) {
  console.error('Usage: npm run assets:import-knights -- "<pack folder that contains PNG/silver_knight/>"\nGet the pack from CraftPix.net (see ASSETS.md).');
  process.exit(1);
}
const m = loadManifest();

const cache = new Map();
async function img(f) { if (!cache.has(f)) cache.set(f, await loadImage(fs.readFileSync(f))); return cache.get(f); }
const lastNum = (f) => Number((path.basename(f).match(/(\d+)(?!.*\d)/) ?? [0, 0])[1]);
function frames(folder, anim) {
  const d = path.join(dir, 'PNG', folder);
  return fs.readdirSync(d).filter((f) => new RegExp(`${anim}_\\d+\\.png$`, 'i').test(f)).map((f) => path.join(d, f)).sort((a, b) => lastNum(a) - lastNum(b));
}

/** Union of the visible pixels of some frames, and the feet x (mean x of the visible pixels in the lowest 12%). */
async function measure(files) {
  const ims = await Promise.all(files.map(img));
  const data = ims.map((im) => { const c = createCanvas(im.width, im.height).getContext('2d'); c.drawImage(im, 0, 0); return c.getImageData(0, 0, im.width, im.height).data; });
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  ims.forEach((im, k) => { const d = data[k];
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } });
  const band = Math.max(2, Math.round((y1 - y0) * 0.12));
  let sx = 0, n = 0;
  ims.forEach((im, k) => { const d = data[k];
    for (let y = y1 - band; y <= y1; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 8) { sx += x; n++; } });
  return { x0, y0, x1, y1, h: y1 - y0 + 1, feetX: n ? sx / n : (x0 + x1) / 2, bottom: y1 };
}

const notes = [];
let n = 0;
const scales = new Map();
for (const a of m.assets.filter((x) => x.pack)) {
  const { folder, anim } = a.pack;
  if (!scales.has(folder)) {
    const idle = frames(folder, 'IDLE');
    if (!idle.length) { notes.push(`${a.key}: no PNG/${folder}/*IDLE_*.png`); continue; }
    scales.set(folder, IDLE_HEIGHT[folder] / (await measure(idle)).h);
  }
  const files = frames(folder, anim);
  if (!files.length) { notes.push(`${a.key}: no PNG/${folder}/*${anim}_*.png`); continue; }
  const s = scales.get(folder), mm = await measure(files);
  const cv = createCanvas(a.width, a.height), c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  let clipped = 0;
  for (const [i, f] of sampleFrames(files, a.frameCount).entries()) {
    const im = await img(f);
    const dx = i * a.frameWidth + Math.round(a.frameWidth / 2 - mm.feetX * s);
    const dy = Math.round(a.frameHeight - FEET - (mm.bottom + 1) * s);
    if (dx + mm.x0 * s < i * a.frameWidth - 1 || dx + (mm.x1 + 1) * s > (i + 1) * a.frameWidth + 1 || dy + mm.y0 * s < -1) clipped++;
    c.save(); c.beginPath(); c.rect(i * a.frameWidth, 0, a.frameWidth, a.frameHeight); c.clip();
    c.drawImage(im, dx, dy, Math.round(im.width * s), Math.round(im.height * s));
    c.restore();
  }
  if (clipped) notes.push(`${a.key}: ${clipped} frame(s) cut at the frame edge`);
  const out = path.join(PUBLIC_DIR, m.roots.licensed, a.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  n++;
}
console.log(`✔ Wrote ${n} files to ${path.relative(ROOT, path.join(PUBLIC_DIR, m.roots.licensed))}/ (gitignored).`);
for (const x of notes) console.log('  note: ' + x);
