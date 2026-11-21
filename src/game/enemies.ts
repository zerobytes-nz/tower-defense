// Enemy types. Pure data. `armor` cuts physical damage, `resist` cuts magic damage (0–1).

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'shaman' | 'bat' | 'ogre';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;   // px/s
  armor: number;
  resist: number;
  flying?: boolean;
  bounty: number;  // gold on kill
  lives: number;   // lives lost if it gets through
  /** Heals other enemies in `radius` by `hps` hit points per second. */
  heal?: { radius: number; hps: number };
  /** Drawn size relative to a grunt. */
  size: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { kind: 'grunt', name: 'Orc Grunt', hp: 60, speed: 42, armor: 0, resist: 0, bounty: 9, lives: 1, size: 1 },
  runner: { kind: 'runner', name: 'Goblin Runner', hp: 34, speed: 82, armor: 0, resist: 0, bounty: 7, lives: 1, size: 0.85 },
  brute: { kind: 'brute', name: 'Iron Brute', hp: 170, speed: 33, armor: 0.5, resist: 0, bounty: 20, lives: 1, size: 1.05 },
  shaman: { kind: 'shaman', name: 'Hooded Shaman', hp: 90, speed: 40, armor: 0, resist: 0.5, bounty: 16, lives: 1, heal: { radius: 80, hps: 10 }, size: 1 },
  bat: { kind: 'bat', name: 'Cave Bat', hp: 46, speed: 62, armor: 0, resist: 0, flying: true, bounty: 10, lives: 1, size: 0.9 },
  ogre: { kind: 'ogre', name: 'Troll Chief', hp: 700, speed: 26, armor: 0.3, resist: 0.15, bounty: 80, lives: 3, size: 1.35 },
};

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];
