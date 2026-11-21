// Levels: a map plus its waves. Milestone 1 has one level; the 12-level campaign comes in milestone 2.
import type { EnemyKind } from './enemies.ts';

/** `count` enemies of one kind, `gap` seconds apart, starting `at` seconds into the wave. */
export interface Group { kind: EnemyKind; count: number; gap: number; at: number }
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

const g = (kind: EnemyKind, count: number, gap: number, at = 0): Group => ({ kind, count, gap, at });

export const LEVELS: LevelDef[] = [
  {
    id: 'meadow-1',
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
