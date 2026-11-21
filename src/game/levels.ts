// Levels: a map plus its waves. Milestone 1 has one level; the 12-level campaign comes in milestone 2.
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
}

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
