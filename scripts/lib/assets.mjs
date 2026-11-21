// Shared helpers for the asset manifest. Used by the npm scripts AND the Vite plugin,
// so the rules (paths, sizes, fallback) live in exactly one place.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const MANIFEST_FILE = path.join(ROOT, 'assets.manifest.json');
export const PUBLIC_DIR = path.join(ROOT, 'public');

export function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

/** Read width/height from a PNG header (no decoding). Returns null if not a PNG. */
export function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

const TYPES = new Set(['image', 'spritesheet', 'audio']);
const REQUIRED = ['key', 'type', 'path', 'usedFor', 'source'];
const IMAGE_REQUIRED = ['width', 'height', 'frameWidth', 'frameHeight', 'frameCount', 'displayScale'];

/** Returns a list of human-readable problems with the manifest itself. */
export function validateManifest(m) {
  const errs = [];
  if (!m.roots?.licensed || !m.roots?.cc0 || !m.roots?.placeholder) errs.push('manifest.roots.licensed / roots.cc0 / roots.placeholder missing');
  const keys = new Set(), paths = new Set();
  for (const [i, a] of (m.assets ?? []).entries()) {
    const id = a.key ?? `assets[${i}]`;
    for (const f of REQUIRED) if (a[f] === undefined || a[f] === '') errs.push(`${id}: missing "${f}"`);
    if (!TYPES.has(a.type)) errs.push(`${id}: type must be one of ${[...TYPES].join(', ')}`);
    if (keys.has(a.key)) errs.push(`${id}: duplicate key`);
    if (paths.has(a.path)) errs.push(`${id}: duplicate path ${a.path}`);
    keys.add(a.key); paths.add(a.path);
    if (a.path && (a.path.startsWith('/') || a.path.includes('..'))) errs.push(`${id}: path must be relative, inside the asset root`);
    if (a.source && !m.sources?.[a.source]) errs.push(`${id}: unknown source "${a.source}"`);
    if (a.type !== 'audio') {
      for (const f of IMAGE_REQUIRED) if (typeof a[f] !== 'number') errs.push(`${id}: "${f}" must be a number`);
      if (!a.path?.endsWith('.png')) errs.push(`${id}: images must be .png`);
      const { cols, rows } = grid(a);
      if (a.columns !== undefined && (!Number.isInteger(a.columns) || a.columns < 1 || a.columns >= a.frameCount)) errs.push(`${id}: "columns" must be a whole number below frameCount (leave it out for a single row)`);
      if (a.width !== a.frameWidth * cols || a.height !== a.frameHeight * rows)
        errs.push(`${id}: width/height must be ${cols} column(s) × ${rows} row(s) of ${a.frameWidth}×${a.frameHeight} frames (${a.frameWidth * cols}×${a.frameHeight * rows})`);
      if (a.width > 4096 || a.height > 4096) errs.push(`${id}: ${a.width}×${a.height} is over 4096 px, too big for many phones' GPUs; use "columns" to wrap frames into rows`);
      if (a.type === 'image' && a.frameCount !== 1) errs.push(`${id}: an "image" has frameCount 1`);
    }
  }
  for (const [k, s] of Object.entries(m.sources ?? {})) {
    if (!s.name || !s.url || !s.licence) errs.push(`sources.${k}: needs name, url and licence`);
    if (s.cc0 && !/^https:\/\//.test(s.licenceUrl ?? '')) errs.push(`sources.${k}: a cc0 source needs a licenceUrl (https) that shows the CC0 terms`);
  }
  return errs;
}

/**
 * Frame layout of a sheet: left to right, top to bottom, `columns` frames per row (default: one row).
 * Phaser's spritesheet loader reads frames in the same order.
 */
export function grid(a) {
  const cols = a.columns ?? a.frameCount ?? 1;
  return { cols, rows: Math.ceil((a.frameCount ?? 1) / cols) };
}
/** Top-left pixel of frame i. */
export const frameXY = (a, i) => { const { cols } = grid(a); return [(i % cols) * a.frameWidth, Math.floor(i / cols) * a.frameHeight]; };

/** True when the asset's source pack is CC0 / public domain, so its files may be committed to public/<roots.cc0>/. */
export const isCc0 = (m, a) => m.sources?.[a.source]?.cc0 === true;

/**
 * Resolve every asset to the file the game will actually use. Order of preference:
 *   1. public/<roots.licensed>/<path>    your own copy, gitignored (any licence)
 *   2. public/<roots.cc0>/<path>         committed CC0 art (only for sources marked "cc0": true)
 *   3. public/<roots.placeholder>/<path> committed original placeholder (MIT)
 * A file is only used when it has the exact pixel size the manifest lists.
 */
export function resolveAssets(m = loadManifest()) {
  return m.assets.map((a) => {
    const lic = path.join(PUBLIC_DIR, m.roots.licensed, a.path);
    const cc = path.join(PUBLIC_DIR, m.roots.cc0, a.path);
    const ph = path.join(PUBLIC_DIR, m.roots.placeholder, a.path);
    const check = (file) => {
      if (!fs.existsSync(file)) return { exists: false, sizeOk: false, size: null };
      if (a.type === 'audio') return { exists: true, sizeOk: true, size: null };
      const size = pngSize(file);
      return { exists: true, size, sizeOk: !!size && size.width === a.width && size.height === a.height };
    };
    const licensed = check(lic), cc0 = check(cc), placeholder = check(ph);
    const cc0Allowed = isCc0(m, a);
    const state = licensed.exists && licensed.sizeOk ? 'licensed'
      : cc0Allowed && cc0.exists && cc0.sizeOk ? 'cc0'
      : placeholder.exists && placeholder.sizeOk ? 'placeholder' : 'missing';
    const root = { licensed: m.roots.licensed, cc0: m.roots.cc0 }[state] ?? m.roots.placeholder;
    return {
      asset: a, state, licensed, cc0, cc0Allowed, placeholder,
      licensedFile: path.relative(ROOT, lic), cc0File: path.relative(ROOT, cc), placeholderFile: path.relative(ROOT, ph),
      url: `${root}/${a.path}`,
    };
  });
}

export const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|tga|psd|ase|aseprite|svg|ogg|mp3|wav|m4a|aac|flac|webm|mp4)$/i;
