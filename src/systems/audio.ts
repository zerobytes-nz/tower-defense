// Sound effects synthesized with Web Audio: no audio files to license or download.
// The AudioContext starts on the first tap or key (browsers block audio before a user gesture).
// On/off is part of the save (save.ts). Busy sounds (arrows, hits) are rate-limited so a big fight doesn't clip.
import { save, write } from '../save.ts';

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let noise: AudioBuffer | null = null;
const last = new Map<string, number>();

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  bus = ctx.createGain(); bus.gain.value = save().sound ? 0.5 : 0; bus.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Call once at start-up: unlocks audio on the first user gesture. */
export function initAudio(): void {
  const unlock = () => { const c = ensure(); if (c?.state === 'suspended') void c.resume(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true });
}

export const soundOn = () => save().sound;
export function toggleSound(): void {
  save().sound = !save().sound; write();
  if (bus && ctx) bus.gain.setTargetAtTime(save().sound ? 0.5 : 0, ctx.currentTime, 0.02);
}

/** False if this sound played less than `gap` seconds ago (or audio is off). */
function ok(name: string, gap: number): boolean {
  if (!ctx || !bus || !save().sound || ctx.state !== 'running') return false;
  const t = ctx.currentTime;
  if (t - (last.get(name) ?? -1) < gap) return false;
  last.set(name, t);
  return true;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
  const c = ctx!, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus!); o.start(t); o.stop(t + dur + 0.02);
}

function hiss(dur: number, vol: number, freq: number, q = 1, delay = 0): void {
  const c = ctx!, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus!); s.start(t); s.stop(t + dur + 0.02);
}

const notes = (fs: number[], step: number, type: OscillatorType = 'triangle', vol = 0.18) => fs.forEach((f, i) => tone(type, f, f, step * 1.6, vol, i * step));

export const sfx = {
  tap: () => ok('tap', 0.04) && tone('triangle', 660, 520, 0.06, 0.12),
  build: () => { if (ok('build', 0.1)) { hiss(0.12, 0.3, 300, 2); tone('square', 180, 120, 0.12, 0.08, 0.04); notes([523, 784], 0.07); } },
  upgrade: () => ok('upgrade', 0.1) && notes([523, 659, 784, 1047], 0.06),
  sell: () => ok('sell', 0.1) && notes([988, 1319], 0.05, 'square', 0.08),
  deny: () => ok('deny', 0.15) && tone('square', 200, 140, 0.16, 0.1),
  arrow: () => ok('arrow', 0.07) && hiss(0.08, 0.12, 2600, 3),
  boulder: () => ok('boulder', 0.15) && tone('sine', 140, 60, 0.18, 0.2),
  bolt: () => ok('bolt', 0.1) && tone('sawtooth', 900, 1600, 0.12, 0.05),
  boom: () => { if (ok('boom', 0.1)) { hiss(0.3, 0.35, 180, 0.8); tone('sine', 90, 40, 0.3, 0.3); } },
  zap: () => { if (ok('zap', 0.12)) { hiss(0.12, 0.25, 4000, 6); tone('sawtooth', 1200, 300, 0.1, 0.05); } },
  hit: () => ok('hit', 0.06) && hiss(0.05, 0.12, 1200, 2),
  clang: () => ok('clang', 0.09) && tone('square', 1400, 900, 0.07, 0.05),
  death: () => ok('death', 0.08) && tone('triangle', 300, 120, 0.14, 0.12),
  coin: () => ok('coin', 0.08) && notes([1319, 1760], 0.04, 'square', 0.05),
  leak: () => { if (ok('leak', 0.2)) { tone('sawtooth', 220, 110, 0.3, 0.14); } },
  wave: () => ok('wave', 0.5) && notes([392, 392, 523], 0.11, 'sawtooth', 0.1),
  slam: () => { if (ok('slam', 0.2)) { tone('sine', 120, 50, 0.35, 0.35); hiss(0.25, 0.3, 500, 1); } },
  whoosh: () => ok('whoosh', 0.08) && hiss(0.5, 0.18, 700, 0.7),
  militia: () => ok('militia', 0.3) && notes([392, 523, 659], 0.08, 'square', 0.07),
  levelup: () => ok('levelup', 0.3) && notes([523, 659, 784, 1047, 1319], 0.07, 'triangle', 0.16),
  roots: () => { if (ok('roots', 0.3)) { tone('sawtooth', 80, 50, 0.6, 0.18); hiss(0.5, 0.25, 250, 1.5); } },
  card: () => ok('card', 0.3) && notes([659, 880], 0.09),
  win: () => ok('win', 1) && notes([523, 659, 784, 1047, 784, 1047], 0.12, 'triangle', 0.2),
  lose: () => ok('lose', 1) && notes([392, 330, 262, 196], 0.18, 'sawtooth', 0.12),
};
