// The battle itself: pure TypeScript, deterministic (seeded), fixed 60 Hz steps, no Phaser.
// The scene draws whatever this holds and reads `events` for one-off effects; `npm run sim` plays it headless.
import { ENEMIES, type EnemyDef, type EnemyKind } from './enemies.ts';
import { LEVELS, WAVE_BREAK, EARLY_GOLD_PER_S, starsFor, type LevelDef } from './levels.ts';
import { MAPS, buildTrack, pointAt, type MapDef, type Pt, type Track } from './maps.ts';
import { TOWERS, MAX_TIER, SELL_BACK, spentTo, tierStats, type TowerKind, type TowerTier } from './towers.ts';
import { HEROES, DEFAULT_HERO, METEOR, MILITIA, SPELLS, heroLevel, levelMult, type HeroDef, type SpellId } from './heroes.ts';

export const DT = 1 / 60;

/** Bonuses from the upgrade tree (and, in milestone 4, AWIs). 1 = no change. */
export interface Mods {
  gold: number;                               // extra starting gold
  lives: number;                              // extra lives
  damage: Record<TowerKind, number>;          // tower damage ×
  range: number;                              // tower range ×
  soldierHp: number;
  heroPower: number;                          // hero hp and damage ×
  spellPower: number;
  cooldown: number;                           // spell cooldowns ×
}
export const noMods = (): Mods => ({ gold: 0, lives: 0, damage: { archer: 1, catapult: 1, mage: 1, barracks: 1 }, range: 1, soldierHp: 1, heroPower: 1, spellPower: 1, cooldown: 1 });

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  path: number;     // which road
  dist: number;     // along its track
  offset: number;   // sideways from the centre line, px (so a crowd doesn't walk in single file)
  x: number; y: number;
  facing: 1 | -1;
  alive: boolean;
  slowUntil: number; slow: number;
  stunUntil: number;
  burnUntil: number; burnDps: number;
  /** The unit that stops this enemy (null: walking). `held`: that unit has reached it. */
  blocker: number | null;
  held: boolean;
  atkCd: number;
  bossCd: number;
}

export interface Tower {
  id: number;
  pad: number;      // index into map.pads
  kind: TowerKind;
  tier: number;     // 1..MAX_TIER (4 = branch)
  branch: 0 | 1 | null;
  x: number; y: number;
  cooldown: number;
  /** Multipliers from nearby War Drums, refreshed every step. */
  buff: { damage: number; range: number; speed: number };
  aimX: number;     // last target, for the archer's facing
  rootedUntil: number;
  /** Barracks: where its soldiers stand. */
  rally: Pt;
}

export type UnitKind = 'soldier' | 'hero' | 'militia';
export interface Unit {
  id: number;
  kind: UnitKind;
  tower: number | null;     // barracks id (soldiers)
  slot: number;
  x: number; y: number;
  home: Pt;                 // where it stands when idle
  hp: number; maxHp: number;
  damage: number; rate: number; armor: number; regen: number;
  speed: number;
  cooldown: number;
  target: number | null;    // enemy id
  alive: boolean;
  respawnAt: number;
  expires: number;          // militia
  facing: 1 | -1;
  moving: boolean;
  fighting: boolean;
  /** Hero only: ordered to walk (ignores enemies until he arrives). */
  ordered: boolean;
}

export interface Shot {
  id: number;
  kind: 'arrow' | 'boulder' | 'bolt';
  tower: number;
  x: number; y: number;
  sx: number; sy: number;     // start
  tx: number; ty: number;     // aim point (boulder) / last known target position
  target: number;             // enemy id (arrow, bolt)
  damage: number;
  magic: boolean;
  crit: boolean;
  stats: TowerTier;
  t: number; T: number;       // boulder flight time
  speed: number;
}

/** Burning ground (Fire Pot, Meteor). */
export interface Fire { id: number; x: number; y: number; r: number; dps: number; until: number }

export type SimEvent =
  | { type: 'wave'; n: number }
  | { type: 'spawn'; enemy: Enemy }
  | { type: 'shot'; shot: Shot; tower: Tower }
  | { type: 'hit'; shot: Shot; x: number; y: number }
  | { type: 'zap'; points: Pt[] }
  | { type: 'death'; enemy: Enemy; gold: number }
  | { type: 'leak'; enemy: Enemy }
  | { type: 'heal'; enemy: Enemy }
  | { type: 'built' | 'upgraded'; tower: Tower }
  | { type: 'sold'; tower: Tower; gold: number }
  | { type: 'early'; gold: number }
  | { type: 'unitDown'; unit: Unit }
  | { type: 'unitUp'; unit: Unit }
  | { type: 'strike'; unit: Unit; enemy: Enemy }
  | { type: 'levelup'; level: number }
  | { type: 'slam'; x: number; y: number; r: number }
  | { type: 'meteor'; x: number; y: number; r: number }
  | { type: 'meteorFall'; x: number; y: number; at: number }
  | { type: 'roots'; enemy: Enemy; towers: Tower[] }
  | { type: 'end'; won: boolean };

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pending { at: number; kind: EnemyKind; wave: number; path: number }
interface Impact { at: number; x: number; y: number }

export interface BattleOptions { level?: LevelDef; seed?: number; mods?: Mods; hero?: HeroDef | null }

const BLOCK_REACH = 26;    // a unit this close to its enemy holds it
const SOLDIER_ENGAGE = 80; // soldiers leave their spot for enemies this close to it
const HERO_ENGAGE = 95;

export class Battle {
  readonly level: LevelDef;
  readonly map: MapDef;
  /** One per road; `track` is the first (the hero starts on it). */
  readonly tracks: Track[];
  readonly track: Track;
  readonly rand: () => number;
  readonly mods: Mods;
  readonly heroDef: HeroDef | null;

  state: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  time = 0;
  gold: number;
  lives: number;
  readonly startLives: number;
  /** Index of the wave that started last (-1 before the first). */
  wave = -1;
  /** Seconds until the next wave starts by itself; null while a wave is still spawning or before the first. */
  countdown: number | null = null;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  units: Unit[] = [];
  shots: Shot[] = [];
  fires: Fire[] = [];
  events: SimEvent[] = [];
  kills = 0;
  leaks = 0;

  hero: Unit | null = null;
  heroXp = 0;
  heroLvl = 1;
  heroAbilityAt = 0;      // time the ability is ready
  spellReadyAt: Record<SpellId, number> = { meteor: Infinity, reinforce: Infinity };
  /** Every enemy kind that has appeared (for "new enemy" cards). */
  seen = new Set<EnemyKind>();

  private pending: Pending[] = [];
  private impacts: Impact[] = [];
  private nextId = 1;

  constructor(opts: BattleOptions = {}) {
    this.level = opts.level ?? LEVELS[0];
    this.map = MAPS[this.level.map];
    this.tracks = this.map.paths.map((p) => buildTrack(p));
    this.track = this.tracks[0];
    this.rand = rng(opts.seed ?? 1);
    this.mods = opts.mods ?? noMods();
    this.gold = this.level.gold + this.mods.gold;
    this.lives = this.startLives = this.level.lives + this.mods.lives;
    this.heroDef = opts.hero === undefined ? HEROES[DEFAULT_HERO] : opts.hero;
    if (this.heroDef) this.spawnHero();
  }

  get waveCount() { return this.level.waves.length; }
  get stars() { return this.state === 'won' ? starsFor(this.lives, this.startLives) : 0; }
  /** True when the player may start the next wave now (the first one, or early during a break). */
  get canCallWave() { return (this.state === 'ready' || (this.state === 'playing' && this.countdown !== null)) && this.wave < this.waveCount - 1; }
  /** Gold for calling the next wave right now. */
  get earlyBonus() { return this.state === 'playing' && this.countdown !== null ? Math.floor(this.countdown * EARLY_GOLD_PER_S) : 0; }
  get over() { return this.state === 'won' || this.state === 'lost'; }

  // ── Player actions ────────────────────────────────────────────────────────────────────────────────

  towerOn(pad: number) { return this.towers.find((t) => t.pad === pad); }

  build(pad: number, kind: TowerKind): Tower | null {
    const cost = TOWERS[kind].tiers[0].cost;
    if (this.over || this.towerOn(pad) || this.gold < cost || !this.map.pads[pad]) return null;
    this.gold -= cost;
    const p = this.map.pads[pad];
    const t: Tower = {
      id: this.nextId++, pad, kind, tier: 1, branch: null, x: p.x, y: p.y - 18, cooldown: 0.3,
      buff: { damage: 1, range: 1, speed: 1 }, aimX: p.x + 1, rootedUntil: 0, rally: this.nearestRoad(p.x, p.y),
    };
    this.towers.push(t);
    if (kind === 'barracks') this.syncSoldiers(t);
    this.events.push({ type: 'built', tower: t });
    return t;
  }

  /** Cost of the next tier; for tier 3 → 4 pass the branch. null when maxed. */
  upgradeCost(t: Tower, branch: 0 | 1 = 0): number | null {
    if (t.tier >= MAX_TIER) return null;
    return t.tier === 3 ? TOWERS[t.kind].branches[branch].cost : TOWERS[t.kind].tiers[t.tier].cost;
  }

  upgrade(t: Tower, branch: 0 | 1 = 0): boolean {
    const cost = this.upgradeCost(t, branch);
    if (cost === null || this.gold < cost || this.over) return false;
    this.gold -= cost;
    if (t.tier === 3) t.branch = branch;
    t.tier++;
    if (t.kind === 'barracks') this.syncSoldiers(t);
    this.events.push({ type: 'upgraded', tower: t });
    return true;
  }

  sellValue(t: Tower) { return Math.floor(spentTo(t.kind, t.tier, t.branch) * SELL_BACK); }

  sell(t: Tower): number {
    const gold = this.sellValue(t);
    this.gold += gold;
    this.towers = this.towers.filter((x) => x !== t);
    for (const u of this.units.filter((u) => u.tower === t.id)) this.removeUnit(u);
    this.events.push({ type: 'sold', tower: t, gold });
    return gold;
  }

  /** Move a barracks' rally point (must be on the road, within its range). */
  setRally(t: Tower, x: number, y: number): boolean {
    const p = this.nearestRoad(x, y);
    if (Math.hypot(p.x - x, p.y - y) > 60 || Math.hypot(p.x - t.x, p.y - t.y) > this.stats(t).range) return false;
    t.rally = p;
    for (const u of this.units) if (u.tower === t.id) { u.home = this.slotPos(p, u.slot); u.target = null; }
    return true;
  }

  /** Send the hero somewhere near the road. */
  moveHero(x: number, y: number): boolean {
    const h = this.hero;
    if (!h || !h.alive || this.over) return false;
    const p = this.nearestRoad(x, y);
    if (Math.hypot(p.x - x, p.y - y) > 90) return false;
    this.release(h);
    h.home = { x, y };
    h.ordered = true;
    return true;
  }

  get heroAbilityReady() { return !!this.hero?.alive && this.time >= this.heroAbilityAt && this.state === 'playing'; }

  /** The hero's ability (Shield Slam). */
  heroAbility(): boolean {
    const h = this.hero, def = this.heroDef;
    if (!h || !def || !this.heroAbilityReady) return false;
    const a = def.ability, dmg = a.damage * levelMult(this.heroLvl) * this.mods.heroPower;
    for (const e of this.enemies) {
      if (!e.alive || e.def.flying || Math.hypot(e.x - h.x, e.y - h.y) > a.radius) continue;
      e.stunUntil = Math.max(e.stunUntil, this.time + a.stun * (e.def.boss ? 0.4 : 1));
      this.damage(e, dmg, false);
    }
    this.heroAbilityAt = this.time + a.cooldown * this.mods.cooldown;
    this.events.push({ type: 'slam', x: h.x, y: h.y, r: a.radius });
    return true;
  }

  spellReady(id: SpellId) { return this.state === 'playing' && this.time >= this.spellReadyAt[id]; }
  /** 0..1 how far the spell's cooldown has run (1 = ready). */
  spellCharge(id: SpellId) {
    if (this.state !== 'playing') return 0;
    const cd = SPELLS[id].cooldown * this.mods.cooldown, left = this.spellReadyAt[id] - this.time;
    return Math.max(0, Math.min(1, 1 - left / cd));
  }

  castSpell(id: SpellId, x: number, y: number): boolean {
    if (!this.spellReady(id)) return false;
    const road = this.nearestRoad(x, y);
    if (Math.hypot(road.x - x, road.y - y) > SPELLS[id].roadSnap) return false;
    if (id === 'meteor') {
      for (let i = 0; i < METEOR.count; i++) {
        const a = this.rand() * Math.PI * 2, r = i === 0 ? 0 : METEOR.spread * (0.5 + this.rand() * 0.5);
        const imp = { at: this.time + METEOR.fall + i * METEOR.delay, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.6 };
        this.impacts.push(imp);
        this.events.push({ type: 'meteorFall', x: imp.x, y: imp.y, at: imp.at - this.time });
      }
    } else {
      for (let i = 0; i < MILITIA.count; i++) {
        const home = this.slotPos(road, i);
        const u = this.newUnit('militia', null, i, home, MILITIA.hp * this.mods.soldierHp, MILITIA.damage * this.mods.spellPower, MILITIA.rate, MILITIA.armor, 0, 90);
        u.x = home.x; u.y = home.y; u.expires = this.time + MILITIA.life;
        this.units.push(u);
        this.events.push({ type: 'unitUp', unit: u });
      }
    }
    this.spellReadyAt[id] = this.time + SPELLS[id].cooldown * this.mods.cooldown;
    return true;
  }

  /** Start the first wave, or the next one early (with bonus gold). */
  callWave(): boolean {
    if (!this.canCallWave) return false;
    const bonus = this.earlyBonus;
    if (bonus > 0) { this.gold += bonus; this.events.push({ type: 'early', gold: bonus }); }
    if (this.state === 'ready') {
      this.state = 'playing';
      for (const id of Object.keys(SPELLS) as SpellId[]) this.spellReadyAt[id] = this.time + SPELLS[id].firstReady;
      this.heroAbilityAt = this.time + 5;
    }
    this.startWave(this.wave + 1);
    return true;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────────────────────────

  stats(t: Tower): TowerTier { return tierStats(t.kind, t.tier, t.branch); }
  range(t: Tower) { return this.stats(t).range * t.buff.range * this.mods.range; }

  /** The closest point on the road to (x, y). */
  nearestRoad(x: number, y: number): Pt {
    let best = this.track.pts[0], bd = Infinity;
    for (const t of this.tracks) for (let i = 0; i < t.pts.length; i += 2) {
      const p = t.pts[i], d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return { x: best.x, y: best.y };
  }

  private slotPos(p: Pt, slot: number): Pt {
    const o = [[0, -14], [-18, 12], [18, 12]][slot % 3];
    return { x: p.x + o[0], y: p.y + o[1] };
  }

  private newUnit(kind: UnitKind, tower: number | null, slot: number, home: Pt, hp: number, damage: number, rate: number, armor: number, regen: number, speed: number): Unit {
    return {
      id: this.nextId++, kind, tower, slot, x: home.x, y: home.y, home, hp, maxHp: hp, damage, rate, armor, regen, speed,
      cooldown: 0, target: null, alive: true, respawnAt: 0, expires: Infinity, facing: 1, moving: false, fighting: false, ordered: false,
    };
  }

  private spawnHero() {
    const d = this.heroDef!;
    const p = pointAt(this.track, this.track.length * 0.62);
    this.hero = this.newUnit('hero', null, 0, { x: p.x, y: p.y }, d.hp * this.mods.heroPower, d.damage * this.mods.heroPower, d.rate, d.armor, d.regen, d.speed);
    this.units.push(this.hero);
  }

  /** Make a barracks' soldiers match its tier: more of them, tougher, healed. */
  private syncSoldiers(t: Tower) {
    const s = this.stats(t).soldiers!;
    const mine = this.units.filter((u) => u.tower === t.id);
    for (let i = 0; i < s.count; i++) {
      let u = mine[i];
      const hp = s.hp * this.mods.soldierHp, dmg = s.damage * this.mods.damage.barracks;
      if (!u) {
        u = this.newUnit('soldier', t.id, i, this.slotPos(t.rally, i), hp, dmg, s.rate, s.armor, s.regen ?? 0, 90);
        u.x = t.x; u.y = t.y + 10; // walk out of the door
        this.units.push(u);
        this.events.push({ type: 'unitUp', unit: u });
      } else {
        Object.assign(u, { maxHp: hp, damage: dmg, rate: s.rate, armor: s.armor, regen: s.regen ?? 0 });
        if (u.alive) u.hp = hp;
      }
    }
  }

  private release(u: Unit) {
    if (u.target !== null) {
      const e = this.enemies.find((x) => x.id === u.target);
      if (e && e.blocker === u.id) { e.blocker = null; e.held = false; }
    }
    u.target = null;
    u.fighting = false;
  }

  private removeUnit(u: Unit) {
    this.release(u);
    u.alive = false;
    this.units = this.units.filter((x) => x !== u);
    this.events.push({ type: 'unitDown', unit: u });
  }

  private startWave(n: number) {
    this.wave = n;
    this.countdown = null;
    const roads = this.tracks.length;
    this.level.waves[n].groups.forEach((gr, gi) => {
      // A group walks the road it names; otherwise groups take turns, and so do the members of a group.
      for (let i = 0; i < gr.count; i++) {
        const path = gr.path !== undefined ? gr.path % roads : (gi + i) % roads;
        this.pending.push({ at: this.time + gr.at + i * gr.gap, kind: gr.kind, wave: n, path });
      }
    });
    this.pending.sort((a, b) => a.at - b.at);
    this.events.push({ type: 'wave', n });
  }

  private spawn(p: Pending) {
    const def = ENEMIES[p.kind];
    const hp = Math.round(def.hp * (def.boss ? 1 : 1 + this.level.hpGrowth * p.wave));
    const e: Enemy = {
      id: this.nextId++, def, hp, maxHp: hp, path: p.path, dist: 0, offset: def.boss ? 0 : (this.rand() - 0.5) * 26,
      x: 0, y: 0, facing: 1, alive: true, slowUntil: 0, slow: 0, stunUntil: 0, burnUntil: 0, burnDps: 0,
      blocker: null, held: false, atkCd: 0.5, bossCd: def.boss?.every ?? 0,
    };
    this.place(e);
    this.enemies.push(e);
    this.seen.add(def.kind);
    this.events.push({ type: 'spawn', enemy: e });
  }

  private place(e: Enemy) {
    const p = pointAt(this.tracks[e.path], e.dist);
    e.x = p.x - Math.sin(p.angle) * e.offset;
    e.y = p.y + Math.cos(p.angle) * e.offset;
    const c = Math.cos(p.angle);
    if (Math.abs(c) > 0.2) e.facing = c > 0 ? 1 : -1;
  }

  /** Where enemy `e` will be in `s` seconds (for aiming boulders). */
  private lead(e: Enemy, s: number): Pt {
    if (e.held || this.time < e.stunUntil) return { x: e.x, y: e.y };
    const p = pointAt(this.tracks[e.path], e.dist + this.speedOf(e) * s);
    return { x: p.x - Math.sin(p.angle) * e.offset, y: p.y + Math.cos(p.angle) * e.offset };
  }

  private speedOf(e: Enemy) { return e.def.speed * (this.time < e.slowUntil ? 1 - e.slow : 1); }

  private damage(e: Enemy, amount: number, magic: boolean, pierce = 0) {
    if (!e.alive) return;
    const cut = magic ? e.def.resist : e.def.armor * (1 - pierce);
    e.hp -= amount * (1 - cut);
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    e.alive = false;
    if (e.blocker !== null) { const u = this.units.find((x) => x.id === e.blocker); if (u) { u.target = null; u.fighting = false; } }
    this.kills++;
    this.gold += e.def.bounty;
    if (this.hero?.alive) {
      this.heroXp += e.def.bounty;
      const lvl = heroLevel(this.heroXp);
      if (lvl > this.heroLvl) {
        this.heroLvl = lvl;
        const d = this.heroDef!, h = this.hero, k = levelMult(lvl) * this.mods.heroPower;
        h.maxHp = d.hp * k; h.hp = h.maxHp; h.damage = d.damage * k;
        this.events.push({ type: 'levelup', level: lvl });
      }
    }
    this.events.push({ type: 'death', enemy: e, gold: e.def.bounty });
  }

  // ── Simulation ────────────────────────────────────────────────────────────────────────────────────

  step() {
    if (this.state !== 'playing') return;
    this.time += DT;
    const now = this.time;

    // Spawns
    while (this.pending.length && this.pending[0].at <= now) this.spawn(this.pending.shift()!);
    if (!this.pending.length && this.countdown === null && this.wave < this.waveCount - 1) this.countdown = WAVE_BREAK;
    if (this.countdown !== null) {
      this.countdown -= DT;
      if (this.countdown <= 0) this.startWave(this.wave + 1);
    }

    // Burning: on enemies, and on the ground
    for (const e of this.enemies) if (e.alive && now < e.burnUntil) this.damage(e, e.burnDps * DT, true);
    for (const f of this.fires) for (const e of this.enemies) {
      if (e.alive && !e.def.flying && Math.hypot(e.x - f.x, e.y - f.y) <= f.r) { e.burnUntil = Math.max(e.burnUntil, now + 1); e.burnDps = Math.max(e.burnDps, f.dps); }
    }
    this.fires = this.fires.filter((f) => f.until > now);

    // Enemies walk (unless held by a unit or stunned)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.blocker !== null) {
        const u = this.units.find((x) => x.id === e.blocker);
        if (!u || !u.alive) { e.blocker = null; e.held = false; }
        else e.held = Math.hypot(u.x - e.x, u.y - e.y) <= BLOCK_REACH + 4;
      }
      if (e.held || now < e.stunUntil) continue;
      e.dist += this.speedOf(e) * DT;
      if (e.dist >= this.tracks[e.path].length) {
        e.alive = false;
        this.leaks++;
        this.lives = Math.max(0, this.lives - e.def.lives);
        this.events.push({ type: 'leak', enemy: e });
        continue;
      }
      this.place(e);
    }

    // Once a second: shamans heal their neighbours
    if (Math.floor(now) !== Math.floor(now - DT)) {
      for (const s of this.enemies) {
        if (!s.alive || !s.def.heal) continue;
        for (const e of this.enemies) {
          if (e === s || !e.alive || e.hp >= e.maxHp) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) > s.def.heal.radius) continue;
          e.hp = Math.min(e.maxHp, e.hp + s.def.heal.hps);
          this.events.push({ type: 'heal', enemy: e });
        }
      }
    }

    // Bosses
    for (const e of this.enemies) {
      const b = e.def.boss;
      if (!e.alive || !b || e.hp > e.maxHp * b.phase2) continue;
      e.bossCd -= DT;
      if (e.bossCd > 0) continue;
      e.bossCd = b.every;
      const hit = this.towers.filter((t) => Math.hypot(t.x - e.x, t.y - e.y) <= b.radius);
      for (const t of hit) t.rootedUntil = now + b.time;
      this.events.push({ type: 'roots', enemy: e, towers: hit });
    }

    this.stepUnits(now);

    // Enemies hit the unit holding them
    for (const e of this.enemies) {
      if (!e.alive || !e.held || now < e.stunUntil) continue;
      const u = this.units.find((x) => x.id === e.blocker);
      if (!u) continue;
      e.facing = u.x >= e.x ? 1 : -1;
      e.atkCd -= DT;
      if (e.atkCd > 0) continue;
      e.atkCd = e.def.melee.rate;
      u.hp -= e.def.melee.damage * (1 - u.armor);
      if (u.hp <= 0) this.unitDies(u, now);
    }

    // War Drums
    for (const t of this.towers) t.buff = { damage: 1, range: 1, speed: 1 };
    for (const s of this.towers) {
      const aura = this.stats(s).aura;
      if (!aura) continue;
      for (const t of this.towers) {
        if (t === s || t.kind === 'barracks' || Math.hypot(t.x - s.x, t.y - s.y) > this.stats(s).range) continue;
        t.buff.damage = Math.max(t.buff.damage, 1 + aura.damage);
        t.buff.range = Math.max(t.buff.range, 1 + aura.range);
        t.buff.speed = Math.max(t.buff.speed, 1 + aura.speed);
      }
    }

    // Towers fire
    for (const t of this.towers) {
      if (t.kind === 'barracks' || now < t.rootedUntil) continue;
      t.cooldown -= DT * t.buff.speed;
      if (t.cooldown > 0) continue;
      const target = this.pickTarget(t);
      if (!target) { t.cooldown = 0; continue; }
      const st = this.stats(t), def = TOWERS[t.kind];
      t.cooldown = st.rate;
      t.aimX = target.x;
      const crit = !!st.crit && this.rand() < st.crit.chance;
      const shot: Shot = {
        id: this.nextId++, kind: t.kind === 'archer' ? 'arrow' : t.kind === 'mage' ? 'bolt' : 'boulder', tower: t.id,
        x: t.x, y: t.y - 40, sx: t.x, sy: t.y - 40, tx: target.x, ty: target.y, target: target.id,
        damage: st.damage * t.buff.damage * this.mods.damage[t.kind] * (crit ? st.crit!.mult : 1), magic: def.damageType === 'magic', crit, stats: st,
        t: 0, T: 0.9, speed: def.shotSpeed,
      };
      if (shot.kind === 'boulder') { const p = this.lead(target, shot.T); shot.tx = p.x; shot.ty = p.y; }
      this.shots.push(shot);
      this.events.push({ type: 'shot', shot, tower: t });
    }

    // Shots fly
    for (const s of this.shots) {
      if (s.kind === 'boulder') {
        s.t += DT;
        const k = Math.min(1, s.t / s.T);
        s.x = s.sx + (s.tx - s.sx) * k;
        s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 90;
        if (k >= 1) { this.land(s, s.tx, s.ty, null); s.t = -1; }
        continue;
      }
      const e = this.enemies.find((x) => x.id === s.target);
      if (e?.alive) { s.tx = e.x; s.ty = e.y - (e.def.flying ? 46 : 22); }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), move = s.speed * DT;
      if (d <= move + 4) { this.land(s, s.tx, s.ty, e?.alive ? e : null); s.t = -1; }
      else { s.x += (dx / d) * move; s.y += (dy / d) * move; }
    }
    this.shots = this.shots.filter((s) => s.t >= 0);

    // Meteors
    for (const m of this.impacts) {
      if (m.at > now) continue;
      const dmg = METEOR.damage * this.mods.spellPower;
      for (const e of this.enemies) if (e.alive && !e.def.flying && Math.hypot(e.x - m.x, e.y - m.y) <= METEOR.radius) this.damage(e, dmg, false);
      this.fires.push({ id: this.nextId++, x: m.x, y: m.y, r: METEOR.radius * 0.7, dps: METEOR.burn.dps * this.mods.spellPower, until: now + METEOR.burn.time });
      this.events.push({ type: 'meteor', x: m.x, y: m.y, r: METEOR.radius });
      m.at = -1;
    }
    this.impacts = this.impacts.filter((m) => m.at >= 0);

    this.enemies = this.enemies.filter((e) => e.alive);

    // End
    if (this.lives <= 0) { this.state = 'lost'; this.events.push({ type: 'end', won: false }); }
    else if (this.wave === this.waveCount - 1 && !this.pending.length && !this.enemies.length) { this.state = 'won'; this.events.push({ type: 'end', won: true }); }
  }

  /** A shot arrives: damage, splash, and its branch trick. */
  private land(s: Shot, x: number, y: number, target: Enemy | null) {
    const st = s.stats, now = this.time;
    if (s.kind === 'boulder' || (s.kind === 'bolt' && st.splash)) {
      const r = st.splash ?? 0;
      for (const e of this.enemies) {
        if (!e.alive || (s.kind === 'boulder' && e.def.flying) || Math.hypot(e.x - x, e.y - (y + (s.kind === 'bolt' ? 22 : 0))) > r) continue;
        if (st.stun) e.stunUntil = Math.max(e.stunUntil, now + st.stun * (e.def.boss ? 0.3 : 1));
        if (st.slow) { e.slow = Math.max(st.slow.pct * (e.def.boss ? 0.5 : 1), now < e.slowUntil ? e.slow : 0); e.slowUntil = now + st.slow.time; }
        this.damage(e, s.damage, s.magic, st.pierce);
      }
      if (st.burn) this.fires.push({ id: this.nextId++, x, y, r: r * 0.8, dps: st.burn.dps, until: now + st.burn.time });
    } else if (target) {
      this.damage(target, s.damage, s.magic, st.pierce);
      if (st.chain) {
        const hit = new Set([target.id]), points: Pt[] = [{ x, y }];
        let from = target, dmg = s.damage;
        for (let i = 0; i < st.chain.count; i++) {
          let next: Enemy | null = null, nd = st.chain.range;
          for (const e of this.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            const d = Math.hypot(e.x - from.x, e.y - from.y);
            if (d < nd) { nd = d; next = e; }
          }
          if (!next) break;
          dmg *= st.chain.falloff;
          hit.add(next.id);
          points.push({ x: next.x, y: next.y - (next.def.flying ? 46 : 22) });
          this.damage(next, dmg, true);
          from = next;
        }
        if (points.length > 1) this.events.push({ type: 'zap', points });
      }
    }
    this.events.push({ type: 'hit', shot: s, x, y });
  }

  private unitDies(u: Unit, now: number) {
    this.release(u);
    u.alive = false;
    u.hp = 0;
    this.events.push({ type: 'unitDown', unit: u });
    if (u.kind === 'militia') { this.units = this.units.filter((x) => x !== u); return; }
    const t = u.tower !== null ? this.towers.find((x) => x.id === u.tower) : null;
    u.respawnAt = now + (u.kind === 'hero' ? this.heroDef!.respawn : t ? this.stats(t).soldiers!.respawn : 10);
  }

  private stepUnits(now: number) {
    for (const u of [...this.units]) {
      if (!u.alive) {
        if (now >= u.respawnAt) {
          u.alive = true; u.hp = u.maxHp; u.ordered = false;
          if (u.kind === 'hero') { u.x = u.home.x; u.y = u.home.y; }
          else { const t = this.towers.find((x) => x.id === u.tower); if (t) { u.x = t.x; u.y = t.y + 10; } }
          this.events.push({ type: 'unitUp', unit: u });
        }
        continue;
      }
      if (u.kind === 'militia' && now >= u.expires) { this.removeUnit(u); continue; }

      // Drop a target that is gone, flew off, or wandered too far from home
      let e = u.target !== null ? this.enemies.find((x) => x.id === u.target && x.alive) ?? null : null;
      const leash = u.kind === 'hero' ? HERO_ENGAGE * 1.6 : SOLDIER_ENGAGE * 1.5;
      if (!e || Math.hypot(e.x - u.home.x, e.y - u.home.y) > leash) { if (u.target !== null) this.release(u); e = null; }

      if (!e && !u.ordered) e = this.findFoe(u);
      if (e && u.target !== e.id) {
        u.target = e.id;
        if (e.blocker === null) e.blocker = u.id;
      }

      // Move: towards the foe (standing at its front), else home
      let gx = u.home.x, gy = u.home.y;
      if (e) { gx = e.x - e.facing * -18 * (e.blocker === u.id ? 1 : 0.6); gy = e.y + (u.slot - 1) * 4; }
      const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
      u.fighting = !!e && Math.hypot(e.x - u.x, e.y - u.y) <= BLOCK_REACH + 6;
      u.moving = d > 3 && !u.fighting;
      if (u.moving) {
        const step = Math.min(d, u.speed * DT);
        u.x += (dx / d) * step; u.y += (dy / d) * step;
        if (Math.abs(dx) > 1) u.facing = dx > 0 ? 1 : -1;
      } else if (u.ordered) u.ordered = false;

      if (u.fighting && e) {
        u.facing = e.x >= u.x ? 1 : -1;
        u.cooldown -= DT;
        if (u.cooldown <= 0) {
          u.cooldown = u.rate;
          this.damage(e, u.damage, false);
          this.events.push({ type: 'strike', unit: u, enemy: e });
        }
      } else {
        u.cooldown = Math.min(u.cooldown, 0.3);
        if (u.regen && !e) u.hp = Math.min(u.maxHp, u.hp + u.regen * DT);
      }
    }
  }

  /** The best enemy for a unit: one nobody is holding yet, else help with one that is held. */
  private findFoe(u: Unit): Enemy | null {
    const reach = u.kind === 'hero' ? HERO_ENGAGE : SOLDIER_ENGAGE;
    const cx = u.kind === 'hero' ? u.x : u.home.x, cy = u.kind === 'hero' ? u.y : u.home.y;
    let free: Enemy | null = null, held: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive || e.def.flying || Math.hypot(e.x - cx, e.y - cy) > reach) continue;
      if (e.blocker === null) { if (!free || e.dist > free.dist) free = e; }
      else if (!held || e.dist > held.dist) held = e;
    }
    return free ?? held;
  }

  /** The enemy furthest along the path that this tower can reach. */
  private pickTarget(t: Tower): Enemy | null {
    const r = this.range(t), air = TOWERS[t.kind].hitsAir;
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (!e.alive || (e.def.flying && !air)) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) > r) continue;
      if (!best || e.dist > best.dist) best = e;
    }
    return best;
  }
}
