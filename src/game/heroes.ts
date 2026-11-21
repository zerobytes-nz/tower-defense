// Heroes and player spells. Pure data. Milestone 4 adds AWI heroes (other knights and wizards) and AWI spells.

export interface HeroDef {
  id: string;
  name: string;
  /** Art key prefix: `${art}.idle`, `.walk`, `.attack`, `.die`. */
  art: string;
  hp: number;
  damage: number;
  rate: number;
  armor: number;
  speed: number;     // px/s
  respawn: number;   // seconds
  regen: number;     // hp/s while not fighting
  ability: { name: string; blurb: string; cooldown: number; radius: number; damage: number; stun: number };
}

export const HEROES: Record<string, HeroDef> = {
  silver: {
    id: 'silver', name: 'Sir Aldric', art: 'hero.silver',
    hp: 320, damage: 16, rate: 0.9, armor: 0.35, speed: 115, respawn: 12, regen: 8,
    ability: { name: 'Shield Slam', blurb: 'Stuns and hurts every enemy around him.', cooldown: 22, radius: 100, damage: 70, stun: 1.6 },
  },
};
export const DEFAULT_HERO = 'silver';

/** Hero level from experience (gold value of enemies killed while he is alive). Each level: +12% hp and damage. */
export const HERO_XP = [0, 60, 160, 320, 560];
export const heroLevel = (xp: number) => HERO_XP.filter((x) => xp >= x).length;
export const levelMult = (lvl: number) => 1 + 0.12 * (lvl - 1);

export type SpellId = 'meteor' | 'reinforce';

export interface SpellDef {
  id: SpellId;
  name: string;
  blurb: string;
  cooldown: number;
  /** Seconds after the first wave starts before it can be used the first time. */
  firstReady: number;
  /** Must be cast within this distance of the road. */
  roadSnap: number;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  meteor: { id: 'meteor', name: 'Meteor Shower', blurb: 'Three meteors crash down and set the road on fire.', cooldown: 40, firstReady: 8, roadSnap: 90 },
  reinforce: { id: 'reinforce', name: 'Reinforcements', blurb: 'Two militia hold the road for 15 seconds.', cooldown: 20, firstReady: 0, roadSnap: 50 },
};
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];

export const METEOR = { count: 3, radius: 70, damage: 90, spread: 45, delay: 0.25, fall: 0.6, burn: { dps: 15, time: 3 } };
export const MILITIA = { count: 2, hp: 90, damage: 6, rate: 1, armor: 0.2, life: 15 };
