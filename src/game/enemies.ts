// Enemy types. Pure data. `armor` cuts physical damage, `resist` cuts magic damage (0–1).

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'shaman' | 'bat' | 'ogre' | 'scorpion' | 'imp' | 'treant';

export interface BossDef {
  /** Every `every` seconds once below `phase2` of its health: roots towers within `radius` for `time` seconds. */
  ability: 'roots';
  phase2: number;
  every: number;
  radius: number;
  time: number;
}

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
  /** Melee against blockers (hero, soldiers): damage per hit, seconds between hits. Flyers can't be blocked. */
  melee: { damage: number; rate: number };
  boss?: BossDef;
  /** Shown on the "new enemy" card the first time it appears. */
  tip: string;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { kind: 'grunt', name: 'Orc Grunt', hp: 60, speed: 42, armor: 0, resist: 0, bounty: 9, lives: 1, size: 1, melee: { damage: 6, rate: 1 },
    tip: 'The basic foot soldier. Anything beats it.' },
  runner: { kind: 'runner', name: 'Goblin Runner', hp: 34, speed: 82, armor: 0, resist: 0, bounty: 7, lives: 1, size: 0.85, melee: { damage: 3, rate: 0.8 },
    tip: 'Fast and fragile. Archers and soldiers catch it.' },
  brute: { kind: 'brute', name: 'Iron Brute', hp: 170, speed: 33, armor: 0.5, resist: 0, bounty: 20, lives: 1, size: 1.05, melee: { damage: 12, rate: 1.2 },
    tip: 'Armour halves arrows and boulders. Use Mage Towers.' },
  shaman: { kind: 'shaman', name: 'Hooded Shaman', hp: 90, speed: 40, armor: 0, resist: 0.5, bounty: 16, lives: 1, heal: { radius: 80, hps: 10 }, size: 1, melee: { damage: 4, rate: 1.2 },
    tip: 'Heals the enemies around it. Kill it first.' },
  bat: { kind: 'bat', name: 'Cave Bat', hp: 46, speed: 62, armor: 0, resist: 0, flying: true, bounty: 10, lives: 1, size: 0.9, melee: { damage: 0, rate: 1 },
    tip: 'Flies over soldiers and catapults. Archers and mages only.' },
  ogre: { kind: 'ogre', name: 'Troll Chief', hp: 700, speed: 26, armor: 0.3, resist: 0.15, bounty: 80, lives: 3, size: 1.35, melee: { damage: 30, rate: 1.5 },
    tip: 'Huge and hits hard. Costs 3 lives if it gets through.' },
  scorpion: { kind: 'scorpion', name: 'Sand Scorpion', hp: 70, speed: 64, armor: 0.4, resist: 0, bounty: 8, lives: 1, size: 0.9, melee: { damage: 5, rate: 0.7 },
    tip: 'Armoured and comes in swarms. Catapults and mages shine.' },
  imp: { kind: 'imp', name: 'Void Imp', hp: 130, speed: 46, armor: 0, resist: 0.8, bounty: 16, lives: 1, size: 0.95, melee: { damage: 8, rate: 1 },
    tip: 'Magic barely hurts it. Use arrows, boulders and soldiers.' },
  treant: { kind: 'treant', name: 'The Old Treant', hp: 4200, speed: 16, armor: 0.3, resist: 0.3, bounty: 300, lives: 10, size: 2, melee: { damage: 70, rate: 1.6 },
    boss: { ability: 'roots', phase2: 0.6, every: 9, radius: 230, time: 3.5 },
    tip: 'Boss. Below 60% health it roots nearby towers. Costs 10 lives.' },
};

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];
