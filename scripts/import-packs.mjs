// Copies the units out of YOUR downloads of two more CraftPix packs into public/assets/licensed/ (gitignored).
// The pack folders are only read: nothing in them is moved or changed.
//
//   npm run assets:import-packs -- --knights "<folder>" --tactical "<folder>"     (either one, or both)
//
//   --knights   Knight Characters Free Sprite: the folder that holds PNG/silver_knight/ (the three heroes, hero buttons)
//   --tactical  Tactical Strategy Game Kit: the folder that holds 2d-fantasy-people-warrior-character-sprites/ (soldiers, militia)
//
// Manifest entries with `pack: { from, dir, anim, idleHeight }` are made from <folder>/<dir>/*<anim>_NNN.png.
// The frames are trimmed differently per animation, so to keep a unit still every animation of one unit uses ONE
// scale (its idle is idleHeight file px tall) and is placed so its feet (the mean x of the lowest visible pixels)
// stand at the frame's bottom centre, FEET px up: the same spot as the placeholder.
// Entries with `portrait: { from, dir }` become a round button with the unit's idle pose inside.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { loadManifest, PUBLIC_DIR, ROOT } from './lib/assets.mjs';
import { sampleFrames } from './lib/pack.mjs';

const FEET = 6;
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const DIRS = { knights: arg('--knights'), tactical: arg('--tactical') };
const CHECK = { knights: 'PNG/silver_knight', tactical: '2d-fantasy-people-warrior-character-sprites' };
for (const [k, d] of Object.entries(DIRS)) if (d && !fs.existsSync(path.join(d, CHECK[k]))) { console.error(`--${k}: ${d} has no ${CHECK[k]}/`); process.exit(1); }
if (!DIRS.knights && !DIRS.tactical) {
  console.error('Usage: npm run assets:import-packs -- --knights "<folder with PNG/silver_knight/>" --tactical "<folder with 2d-fantasy-people-warrior-character-sprites/>"\nGet the packs from CraftPix.net (see ASSETS.md).');
  process.exit(1);
}
const m = loadManifest();

const cache = new Map();
async function img(f) { if (!cache.has(f)) cache.set(f, await loadImage(fs.readFileSync(f))); return cache.get(f); }
const lastNum = (f) => Number((path.basename(f).match(/(\d+)(?!.*\d)/) ?? [0, 0])[1]);
function frames(from, sub, anim) {
  const d = path.join(DIRS[from], sub);
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
async function scaleOf(from, dir, idleHeight) {
  const k = `${from}/${dir}`;
  if (!scales.has(k)) { const idle = frames(from, dir, 'idle'); scales.set(k, idle.length ? idleHeight / (await measure(idle)).h : 0); }
  return scales.get(k);
}
function save(a, cv) {
  const out = path.join(PUBLIC_DIR, m.roots.licensed, a.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  n++;
}
for (const a of m.assets.filter((x) => x.pack && DIRS[x.pack.from])) {
  const { from, dir, anim, idleHeight, flip } = a.pack; // flip: the pack's unit faces left
  const s = await scaleOf(from, dir, idleHeight);
  const files = frames(from, dir, anim);
  if (!s || !files.length) { notes.push(`${a.key}: no ${dir}/*${s ? anim : 'idle'}_NNN.png`); continue; }
  const mm = await measure(files);
  const cv = createCanvas(a.width, a.height), c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  let clipped = 0;
  for (const [i, f] of sampleFrames(files, a.frameCount).entries()) {
    const im = await img(f);
    const dx = i * a.frameWidth + Math.round(a.frameWidth / 2 - mm.feetX * s);
    const dy = Math.round(a.frameHeight - FEET - (mm.bottom + 1) * s);
    if (dx + mm.x0 * s < i * a.frameWidth - 1 || dx + (mm.x1 + 1) * s > (i + 1) * a.frameWidth + 1 || dy + mm.y0 * s < -1) clipped++;
    c.save(); c.beginPath(); c.rect(i * a.frameWidth, 0, a.frameWidth, a.frameHeight); c.clip();
    if (flip) { const mid = i * a.frameWidth + a.frameWidth / 2; c.translate(mid, 0); c.scale(-1, 1); c.translate(-mid, 0); }
    c.drawImage(im, dx, dy, Math.round(im.width * s), Math.round(im.height * s));
    c.restore();
  }
  if (clipped) notes.push(`${a.key}: ${clipped} frame(s) cut at the frame edge`);
  save(a, cv);
}
// Hero buttons: a wooden disc with a dark rim (like the placeholder), the knight's head and shoulders inside.
for (const a of m.assets.filter((x) => x.portrait && DIRS[x.portrait.from])) {
  const idle = frames(a.portrait.from, a.portrait.dir, 'idle');
  if (!idle.length) { notes.push(`${a.key}: no idle frames`); continue; }
  const im = await img(idle[0]), mm = await measure(idle);
  const w = a.width, h = a.height, R = w / 2;
  const cv = createCanvas(w, h), c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  const disc = (r, col) => { c.beginPath(); c.arc(R, R, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
  disc(R - 1, '#3a3a44'); disc(R - 6, '#8a5a32');
  c.save(); c.beginPath(); c.arc(R, R, R - 6, 0, Math.PI * 2); c.clip();
  // Same body size for every knight (idleHeight evens out the spear and halberd), feet below the rim: head and chest show.
  const s = ((await scaleOf(a.portrait.from, a.portrait.dir, a.portrait.idleHeight)) * h * 0.95) / 116;
  c.drawImage(im, R - mm.feetX * s, h * 1.02 - (mm.bottom + 1) * s, im.width * s, im.height * s);
  c.restore();
  c.beginPath(); c.arc(R, R, R - 4, 0, Math.PI * 2); c.lineWidth = 5; c.strokeStyle = '#2b1d14'; c.stroke();
  save(a, cv);
}
console.log(`✔ Wrote ${n} files to ${path.relative(ROOT, path.join(PUBLIC_DIR, m.roots.licensed))}/ (gitignored).`);
for (const x of notes) console.log('  note: ' + x);
