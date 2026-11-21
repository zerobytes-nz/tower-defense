// Enemy types. Pure data. `armor` cuts physical damage, `resist` cuts magic damage (0–1).

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'shaman' | 'bat' | 'ogre' | 'scorpion' | 'imp' | 'treant'
  | 'raider' | 'polyp' | 'mite' | 'golem' | 'wraith' | 'ape' | 'troll' | 'yeti';

export interface BossDef {
  /** Every `every` seconds once below `phase2` of its health:
   *  roots / freeze: towers within `radius` stop for `time` seconds; summon: calls `summon` minions around it. */
  ability: 'roots' | 'freeze' | 'summon';
  summon?: { kind: EnemyKind; count: number };
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
  /** A shield that soaks up physical damage (arrows, boulders, swords) before health; magic goes straight through. */
  shield?: number;
  /** Splits into these when it dies. */
  split?: { kind: EnemyKind; count: number };
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
  // World 2: Sunscorch
  raider: { kind: 'raider', name: 'Bone Knight', hp: 120, speed: 38, armor: 0.2, resist: 0, shield: 160, bounty: 18, lives: 1, size: 1, melee: { damage: 10, rate: 1 },
    tip: 'Its shield soaks up arrows, boulders and swords. Magic goes straight through.' },
  polyp: { kind: 'polyp', name: 'Sand Polyp', hp: 150, speed: 34, armor: 0.1, resist: 0.1, bounty: 10, lives: 1, size: 1, melee: { damage: 6, rate: 1 },
    split: { kind: 'mite', count: 3 }, tip: 'Bursts into three Dust Mites when it dies. Catapults catch them all.' },
  mite: { kind: 'mite', name: 'Dust Mite', hp: 28, speed: 70, armor: 0, resist: 0, bounty: 3, lives: 1, size: 0.6, melee: { damage: 2, rate: 0.8 },
    tip: 'Tiny and quick. Comes out of Sand Polyps.' },
  golem: { kind: 'golem', name: 'The Stone Golem', hp: 6400, speed: 15, armor: 0.55, resist: 0.1, bounty: 400, lives: 10, size: 2, melee: { damage: 90, rate: 1.8 },
    boss: { ability: 'summon', summon: { kind: 'mite', count: 5 }, phase2: 0.7, every: 7, radius: 0, time: 0 },
    tip: 'Boss. Heavy armour: use Mage Towers. Below 70% health it shakes out swarms of Dust Mites.' },
  // World 3: Frostfall
  wraith: { kind: 'wraith', name: 'Frost Wraith', hp: 90, speed: 58, armor: 0, resist: 0.6, flying: true, bounty: 14, lives: 1, size: 0.95, melee: { damage: 0, rate: 1 },
    tip: 'Flies, and shrugs off magic. Archers are the answer.' },
  ape: { kind: 'ape', name: 'Snow Ape', hp: 420, speed: 28, armor: 0.6, resist: 0.1, bounty: 30, lives: 2, size: 1.2, melee: { damage: 22, rate: 1.3 },
    tip: 'Thick fur shrugs off arrows. Costs 2 lives if it gets through.' },
  troll: { kind: 'troll', name: 'Ice Troll', hp: 200, speed: 44, armor: 0.25, resist: 0.4, bounty: 18, lives: 1, size: 1.05, melee: { damage: 16, rate: 1 },
    tip: 'Tough against everything. Hold it with soldiers while towers work.' },
  yeti: { kind: 'yeti', name: 'The Yeti', hp: 8200, speed: 19, armor: 0.35, resist: 0.35, bounty: 500, lives: 10, size: 2, melee: { damage: 110, rate: 1.6 },
    boss: { ability: 'freeze', phase2: 0.65, every: 8, radius: 260, time: 3 },
    tip: 'Boss. Below 65% health its roar freezes nearby towers. Spread your towers out.' },
};

export const ENEMY_KINDS = Object.keys(ENEMIES) as EnemyKind[];
