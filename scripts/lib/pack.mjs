// Turns source frames (PNG files) into the exact sheet a manifest entry expects (one row, or `columns` per row).
// Shared by `npm run assets:pack` (any frames you choose) and `npm run assets:import` (the CraftPix kit).
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { frameXY } from './assets.mjs';

/** Sort key: the last number in the file name ("Enemy-Walking_07.png" → 7). */
const num = (f) => Number((path.basename(f).match(/(\d+)(?!.*\d)/) ?? [0, 0])[1]);
export const sortFrames = (files) => [...files].sort((x, y) => num(x) - num(y) || x.localeCompare(y));

/** Pick `n` frames spread evenly over the list (first and last always kept). */
export function sampleFrames(sorted, n) {
  return Array.from({ length: n }, (_, i) =>
    sorted[Math.min(sorted.length - 1, Math.round((i * (sorted.length - 1)) / Math.max(1, n - 1)))]);
}

/**
 * Draw `files` into a canvas of the asset's size and return the PNG bytes.
 *   opts.scale  fixed scale for every frame (source px → file px), so different animations of one
 *               character keep the same size. Default: the largest scale at which every frame fits.
 *   opts.crop   [x, y, w, h] of the source to use, scaled to fill the frame exactly (backgrounds).
 *   opts.align  'bottom' (characters stand on the bottom edge; default for spritesheets) or 'center'.
 */
export async function packFrames(a, files, opts = {}) {
  const picked = sampleFrames(sortFrames(files), a.frameCount);
  const imgs = await Promise.all(picked.map((f) => loadImage(fs.readFileSync(f))));
  const canvas = createCanvas(a.width, a.height);
  const c = canvas.getContext('2d');
  c.imageSmoothingQuality = 'high';
  if (opts.crop) {
    const [sx, sy, sw, sh] = opts.crop;
    imgs.forEach((img, i) => { const [fx, fy] = frameXY(a, i); c.drawImage(img, sx, sy, sw, sh, fx, fy, a.frameWidth, a.frameHeight); });
    // patch: [[sx, sy, w, h, dx, dy], …] copies part of the packed image over another (in output pixels),
    // e.g. paint the background's trash-bin tile over with the plain tile above it.
    for (const [px, py, pw, ph, dx, dy] of opts.patch ?? []) c.putImageData(c.getImageData(px, py, pw, ph), dx, dy);
    return canvas.toBuffer('image/png');
  }
  const maxW = Math.max(...imgs.map((i) => i.width)), maxH = Math.max(...imgs.map((i) => i.height));
  const fit = Math.min(a.frameWidth / maxW, a.frameHeight / maxH);
  const s = opts.scale ? Math.min(opts.scale, fit) : fit;
  const align = opts.align ?? (a.type === 'spritesheet' ? 'bottom' : 'center');
  imgs.forEach((img, i) => {
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    const [fx, fy] = frameXY(a, i);
    const y = align === 'bottom' ? a.frameHeight - h : (a.frameHeight - h) / 2;
    c.drawImage(img, fx + Math.round((a.frameWidth - w) / 2), fy + Math.round(y), w, h);
  });
  return canvas.toBuffer('image/png');
}
