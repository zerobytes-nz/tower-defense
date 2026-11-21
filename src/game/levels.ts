// Levels: a map plus its waves, grouped into worlds.
import type { EnemyKind } from './enemies.ts';

/** `count` enemies of one kind, `gap` seconds apart, starting `at` seconds into the wave. */
/** `path`: which road (maps with several); left out, groups and their members take turns. */
export interface Group { kind: EnemyKind; count: number; gap: number; at: number; path?: number }
export interface WaveDef { groups: Group[] }
export interface LevelDef {
  id: string;
  name: string;
  map: string;       // key in MAPS
  gold: number;      // starting gold
  lives: number;
  waves: WaveDef[];
  /** Enemy hit points × (1 + hpGrowth × wave index), so late waves of the same group hit harder. */
  hpGrowth: number;
  /** Health × for every non-boss enemy (the balance knob; 1 if left out). */
  hp?: number;
  /** 1-based world (level select pages). */
  world: number;
  /** Icy road: ground enemies move this much faster. */
  ice?: number;
  /** Pads under snow: can't be built on until wave `wave` (1-based) starts. */
  frozen?: { pads: number[]; wave: number };
}

export interface WorldDef { id: number; name: string; rule: string }
export const WORLDS: WorldDef[] = [
  { id: 1, name: 'The Green Frontier', rule: 'Learn the ropes: towers, the hero and spells.' },
  { id: 2, name: 'Sunscorch', rule: 'Enemies come in from two sides.' },
  { id: 3, name: 'Frostfall', rule: 'Icy roads speed enemies up, and some pads are snowed in.' },
];

/** A group: `count` enemies `gap` s apart, starting `at` s into the wave, on road `path` (default: alternate roads). */
const g = (kind: EnemyKind, count: number, gap: number, at = 0, path?: number): Group => ({ kind, count, gap, at, path });

export const LEVELS: LevelDef[] = [
  {
    id: 'meadow',
    name: 'Mill Meadow',
    map: 'meadow',
    gold: 300,
    lives: 20,
    hpGrowth: 0.06,
    world: 1,
    waves: [
      { groups: [g('grunt', 6, 1.6)] },
      { groups: [g('grunt', 6, 1.3), g('runner', 4, 0.9, 6)] },
      { groups: [g('runner', 10, 0.7), g('grunt', 4, 1.2, 4)] },
      { groups: [g('grunt', 8, 1.0), g('brute', 2, 3, 5)] },
      { groups: [g('bat', 6, 1.1), g('grunt', 6, 1.0, 3)] },
      { groups: [g('brute', 4, 2.2), g('shaman', 2, 3, 2), g('grunt', 8, 0.8, 4)] },
      { groups: [g('runner', 14, 0.5), g('bat', 6, 0.9, 5)] },
      { groups: [g('brute', 6, 1.6), g('shaman', 3, 2.5, 3), g('bat', 6, 0.8, 8)] },
      { groups: [g('grunt', 14, 0.6), g('runner', 10, 0.5, 4), g('brute', 4, 1.8, 8)] },
      { groups: [g('ogre', 1, 1, 6), g('grunt', 10, 0.8), g('shaman', 3, 2, 8), g('bat', 8, 0.7, 12)] },
    ],
  },
  {
    id: 'jungle',
    name: 'Jungle Camp',
    map: 'jungle',
    gold: 360,
    lives: 20,
    hpGrowth: 0.045,
    world: 1,
    waves: [
      { groups: [g('grunt', 5, 1.4, 0, 0), g('grunt', 5, 1.4, 3, 1)] },
      { groups: [g('runner', 8, 0.7, 0, 0), g('grunt', 6, 1.1, 2, 1)] },
      { groups: [g('scorpion', 8, 0.6, 0, 1), g('grunt', 6, 1.0, 3, 0)] },
      { groups: [g('brute', 3, 2.4, 0, 0), g('scorpion', 8, 0.6, 2, 1), g('shaman', 2, 3, 4, 0)] },
      { groups: [g('bat', 8, 0.9), g('runner', 10, 0.6, 3)] },
      { groups: [g('scorpion', 14, 0.45, 0, 1), g('brute', 4, 2, 3, 0)] },
      { groups: [g('grunt', 12, 0.7), g('shaman', 3, 2.4, 2), g('bat', 6, 0.8, 6)] },
      { groups: [g('ogre', 1, 1, 0, 0), g('scorpion', 12, 0.5, 2, 1), g('runner', 10, 0.5, 6, 0)] },
      { groups: [g('brute', 8, 1.3, 0, 1), g('shaman', 4, 2, 2, 1), g('bat', 10, 0.6, 4, 0)] },
      { groups: [g('scorpion', 16, 0.4, 0, 0), g('scorpion', 16, 0.4, 2, 1), g('brute', 4, 1.8, 6)] },
      { groups: [g('ogre', 2, 6, 0), g('grunt', 16, 0.5, 2), g('shaman', 4, 2, 6), g('bat', 10, 0.6, 8)] },
      { groups: [g('ogre', 2, 5, 0), g('brute', 6, 1.4, 2), g('scorpion', 18, 0.4, 4), g('bat', 10, 0.6, 10)] },
    ],
  },
  {
    id: 'ruins',
    name: 'Old Ruins',
    map: 'ruins',
    gold: 400,
    lives: 20,
    hpGrowth: 0.045,
    world: 1,
    waves: [
      { groups: [g('grunt', 8, 1.1), g('runner', 6, 0.8, 5)] },
      { groups: [g('imp', 4, 1.8), g('grunt', 8, 0.9, 3)] },
      { groups: [g('scorpion', 10, 0.5), g('imp', 4, 1.6, 4)] },
      { groups: [g('brute', 4, 2), g('imp', 6, 1.4, 3), g('bat', 6, 0.9, 6)] },
      { groups: [g('shaman', 4, 2), g('grunt', 14, 0.6, 1), g('runner', 12, 0.5, 6)] },
      { groups: [g('imp', 10, 0.9), g('brute', 6, 1.6, 4)] },
      { groups: [g('ogre', 2, 5), g('scorpion', 16, 0.4, 2), g('bat', 10, 0.6, 6)] },
      { groups: [g('imp', 12, 0.7), g('shaman', 4, 2, 2), g('brute', 8, 1.2, 5)] },
      { groups: [g('runner', 20, 0.35), g('bat', 14, 0.5, 4), g('ogre', 2, 4, 8)] },
      { groups: [g('brute', 8, 1.1), g('imp', 8, 0.9, 3), g('shaman', 4, 2, 6), g('scorpion', 14, 0.45, 9)] },
      { groups: [g('ogre', 3, 4), g('imp', 12, 0.7, 3), g('bat', 12, 0.6, 8)] },
      { groups: [g('treant', 1, 1, 4, 0), g('grunt', 14, 0.7), g('brute', 6, 1.6, 8), g('imp', 8, 1, 14), g('bat', 10, 0.7, 20)] },
    ],
  },
  // ── World 2: Sunscorch (two entrances) ──
  {
    id: 'oasis', name: 'Sunbaked Oasis', map: 'oasis', world: 2, gold: 380, lives: 20, hpGrowth: 0.05, hp: 1.35,
    waves: [
      { groups: [g('grunt', 6, 1.2, 0, 0), g('runner', 6, 0.8, 2, 1)] },
      { groups: [g('raider', 3, 2.2, 0, 0), g('grunt', 8, 0.9, 2, 1)] },
      { groups: [g('polyp', 4, 2.2, 0, 1), g('runner', 10, 0.6, 3, 0)] },
      { groups: [g('raider', 5, 1.8), g('shaman', 2, 3, 3), g('bat', 6, 0.9, 6)] },
      { groups: [g('polyp', 6, 1.6, 0, 0), g('scorpion', 10, 0.5, 2, 1)] },
      { groups: [g('brute', 5, 1.8, 0, 1), g('raider', 6, 1.4, 3, 0), g('mite', 12, 0.3, 6)] },
      { groups: [g('ogre', 1, 1, 0, 0), g('polyp', 6, 1.4, 2, 1), g('bat', 8, 0.7, 6)] },
      { groups: [g('raider', 10, 1), g('shaman', 4, 2, 3), g('runner', 14, 0.4, 6)] },
      { groups: [g('ogre', 2, 5), g('polyp', 8, 1.1, 2), g('imp', 6, 1.2, 6), g('bat', 10, 0.6, 10)] },
      { groups: [g('raider', 12, 0.8, 0, 0), g('polyp', 10, 1, 0, 1), g('brute', 6, 1.4, 8), g('ogre', 2, 4, 12)] },
    ],
  },
  {
    id: 'canyon', name: 'Bone Canyon', map: 'canyon', world: 2, gold: 400, lives: 20, hpGrowth: 0.05, hp: 0.82,
    waves: [
      { groups: [g('grunt', 8, 1, 0, 1), g('raider', 2, 3, 4, 0)] },
      { groups: [g('polyp', 4, 2, 0, 0), g('runner', 10, 0.6, 2, 1)] },
      { groups: [g('raider', 6, 1.4, 0, 1), g('imp', 4, 1.6, 3, 0)] },
      { groups: [g('scorpion', 14, 0.45), g('shaman', 3, 2.4, 3)] },
      { groups: [g('brute', 6, 1.6, 0, 0), g('polyp', 6, 1.4, 2, 1), g('bat', 8, 0.8, 6)] },
      { groups: [g('raider', 10, 1, 0, 0), g('raider', 6, 1.4, 4, 1), g('mite', 16, 0.25, 8)] },
      { groups: [g('ogre', 2, 5, 0, 0), g('imp', 8, 1, 2, 1), g('runner', 14, 0.4, 6)] },
      { groups: [g('polyp', 12, 0.9), g('shaman', 4, 2, 3), g('bat', 12, 0.6, 6)] },
      { groups: [g('raider', 12, 0.8), g('brute', 8, 1.2, 3), g('ogre', 2, 4, 8)] },
      { groups: [g('polyp', 12, 0.8, 0, 0), g('raider', 12, 0.8, 0, 1), g('imp', 10, 0.9, 8), g('bat', 14, 0.5, 12)] },
      { groups: [g('ogre', 4, 3), g('raider', 14, 0.7, 2), g('polyp', 10, 0.9, 6), g('shaman', 5, 1.8, 10)] },
    ],
  },
  {
    id: 'cave', name: 'Ember Pass', map: 'cave', world: 2, gold: 420, lives: 20, hpGrowth: 0.05, hp: 0.92,
    waves: [
      { groups: [g('raider', 4, 1.8, 0, 0), g('grunt', 10, 0.8, 1, 1)] },
      { groups: [g('polyp', 6, 1.6), g('runner', 12, 0.5, 3)] },
      { groups: [g('scorpion', 16, 0.4, 0, 1), g('raider', 6, 1.4, 3, 0)] },
      { groups: [g('imp', 8, 1.2), g('brute', 6, 1.6, 3), g('bat', 8, 0.8, 6)] },
      { groups: [g('ogre', 2, 4, 0, 0), g('polyp', 8, 1.2, 0, 1), g('shaman', 4, 2, 4)] },
      { groups: [g('raider', 14, 0.8), g('mite', 20, 0.25, 4), g('bat', 10, 0.6, 8)] },
      { groups: [g('polyp', 12, 0.9, 0, 0), g('imp', 10, 0.9, 0, 1), g('ogre', 2, 5, 8)] },
      { groups: [g('brute', 10, 1), g('raider', 12, 0.8, 3), g('shaman', 5, 1.8, 6), g('bat', 12, 0.5, 10)] },
      { groups: [g('ogre', 4, 3), g('polyp', 12, 0.8, 3), g('scorpion', 20, 0.35, 8)] },
      { groups: [g('raider', 16, 0.7, 0, 0), g('imp', 12, 0.8, 0, 1), g('brute', 8, 1.2, 8), g('bat', 14, 0.5, 12)] },
      { groups: [g('ogre', 4, 3), g('polyp', 14, 0.8, 2), g('raider', 12, 0.8, 6), g('shaman', 5, 1.8, 10)] },
      { groups: [g('golem', 1, 1, 4, 0), g('raider', 12, 0.8, 0, 1), g('polyp', 10, 1, 10), g('bat', 12, 0.6, 18), g('ogre', 2, 5, 24)] },
    ],
  },
  // ── World 3: Frostfall (icy roads, snowed-in pads) ──
  {
    id: 'snow', name: 'Frozen Watch', map: 'snow', world: 3, gold: 420, lives: 20, hpGrowth: 0.05, hp: 0.5, ice: 1.12,
    frozen: { pads: [6, 7], wave: 4 },
    waves: [
      { groups: [g('grunt', 10, 0.9, 0, 0), g('runner', 8, 0.6, 3, 1)] },
      { groups: [g('troll', 4, 1.8, 0, 0), g('grunt', 10, 0.8, 2, 1)] },
      { groups: [g('wraith', 6, 1.2), g('runner', 12, 0.5, 3)] },
      { groups: [g('ape', 2, 4, 0, 1), g('troll', 6, 1.4, 2, 0), g('shaman', 3, 2.4, 5)] },
      { groups: [g('raider', 8, 1.2, 0, 0), g('wraith', 8, 1, 2, 1), g('imp', 6, 1.2, 6)] },
      { groups: [g('ape', 4, 2.6), g('polyp', 8, 1.2, 2), g('bat', 10, 0.6, 6)] },
      { groups: [g('troll', 12, 0.8), g('wraith', 10, 0.8, 3), g('ogre', 2, 5, 8)] },
      { groups: [g('ape', 6, 2, 0, 0), g('raider', 10, 0.9, 0, 1), g('shaman', 5, 1.8, 6)] },
      { groups: [g('troll', 14, 0.7), g('wraith', 14, 0.6, 3), g('ape', 4, 2.4, 8)] },
      { groups: [g('ogre', 4, 3, 0, 0), g('ape', 6, 2, 0, 1), g('wraith', 16, 0.5, 6), g('imp', 10, 0.9, 10)] },
    ],
  },
  {
    id: 'crystal', name: 'Crystal Hollow', map: 'crystal', world: 3, gold: 440, lives: 20, hpGrowth: 0.05, hp: 0.77, ice: 1.15,
    frozen: { pads: [4, 6], wave: 5 },
    waves: [
      { groups: [g('troll', 4, 1.6, 0, 0), g('runner', 10, 0.6, 2, 1)] },
      { groups: [g('wraith', 8, 1), g('grunt', 10, 0.8, 3)] },
      { groups: [g('ape', 3, 3, 0, 1), g('raider', 6, 1.4, 2, 0)] },
      { groups: [g('imp', 8, 1.2), g('troll', 8, 1.1, 3), g('bat', 8, 0.8, 6)] },
      { groups: [g('polyp', 10, 1.1, 0, 0), g('wraith', 10, 0.8, 0, 1), g('shaman', 4, 2, 6)] },
      { groups: [g('ape', 6, 2.2), g('troll', 10, 0.9, 3), g('mite', 16, 0.3, 8)] },
      { groups: [g('ogre', 3, 4, 0, 1), g('wraith', 14, 0.6, 2, 0), g('raider', 10, 0.9, 6)] },
      { groups: [g('troll', 16, 0.6), g('ape', 6, 2, 4), g('shaman', 5, 1.8, 8)] },
      { groups: [g('ape', 8, 1.8, 0, 0), g('imp', 12, 0.8, 0, 1), g('wraith', 16, 0.5, 8)] },
      { groups: [g('ogre', 4, 3), g('troll', 16, 0.6, 2), g('polyp', 12, 0.9, 6), g('bat', 16, 0.5, 10)] },
      { groups: [g('ape', 10, 1.4, 0, 0), g('raider', 14, 0.7, 0, 1), g('wraith', 18, 0.5, 8), g('ogre', 3, 4, 12)] },
    ],
  },
  {
    id: 'dusk', name: 'Twilight Moor', map: 'dusk', world: 3, gold: 460, lives: 20, hpGrowth: 0.05, hp: 0.64, ice: 1.1,
    frozen: { pads: [0, 5], wave: 4 },
    waves: [
      { groups: [g('troll', 6, 1.4), g('runner', 12, 0.5, 3)] },
      { groups: [g('wraith', 8, 1), g('raider', 6, 1.4, 3)] },
      { groups: [g('ape', 4, 2.6), g('polyp', 6, 1.4, 3)] },
      { groups: [g('troll', 10, 0.9), g('imp', 8, 1.1, 3), g('bat', 10, 0.7, 6)] },
      { groups: [g('ogre', 2, 4), g('wraith', 12, 0.7, 2), g('shaman', 4, 2, 6)] },
      { groups: [g('ape', 6, 2), g('raider', 12, 0.8, 3), g('mite', 18, 0.25, 8)] },
      { groups: [g('troll', 16, 0.6), g('wraith', 14, 0.6, 3), g('ogre', 2, 5, 8)] },
      { groups: [g('ape', 8, 1.8), g('polyp', 12, 0.9, 3), g('imp', 10, 0.9, 7)] },
      { groups: [g('ogre', 4, 3), g('troll', 16, 0.6, 2), g('wraith', 18, 0.5, 6)] },
      { groups: [g('ape', 10, 1.4), g('raider', 16, 0.7, 3), g('shaman', 6, 1.6, 8), g('bat', 16, 0.5, 12)] },
      { groups: [g('ogre', 5, 2.6), g('ape', 8, 1.6, 4), g('wraith', 20, 0.45, 8), g('troll', 14, 0.7, 12)] },
      { groups: [g('yeti', 1, 1, 4, 0), g('troll', 14, 0.7), g('ape', 6, 2, 10), g('wraith', 14, 0.6, 16), g('ogre', 3, 4, 24)] },
    ],
  },
];

/** Seconds between waves before the next one starts by itself (the player can call it early). */
export const WAVE_BREAK = 18;
/** Gold for calling a wave early, per second skipped. */
export const EARLY_GOLD_PER_S = 1.5;

/** 3 stars with at least 18 lives left (of 20), 2 with 10, else 1. */
export function starsFor(livesLeft: number, livesStart: number): number {
  const f = livesLeft / livesStart;
  return f >= 0.9 ? 3 : f >= 0.5 ? 2 : livesLeft > 0 ? 1 : 0;
}
