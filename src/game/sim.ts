// The battle itself: pure TypeScript, deterministic (seeded), fixed 60 Hz steps, no Phaser.
// The scene draws whatever this holds and reads `events` for one-off effects; `npm run sim` plays it headless.
import { ENEMIES, type EnemyDef, type EnemyKind } from './enemies.ts';
import { LEVELS, WAVE_BREAK, EARLY_GOLD_PER_S, starsFor, type LevelDef } from './levels.ts';
import { MAPS, buildTrack, pointAt, type MapDef, type Pt, type Track } from './maps.ts';
import { TOWERS, MAX_TIER, SELL_BACK, spentTo, type TowerKind, type TowerTier } from './towers.ts';

export const DT = 1 / 60;

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  dist: number;     // along the track
  offset: number;   // sideways from the centre line, px (so a crowd doesn't walk in single file)
  x: number; y: number;
  facing: 1 | -1;
  alive: boolean;
  slowUntil: number; slow: number;
}

export interface Tower {
  id: number;
  pad: number;      // index into map.pads
  kind: TowerKind;
  tier: number;     // 1..MAX_TIER
  x: number; y: number;
  cooldown: number;
  /** Multipliers from nearby War Camps, refreshed every step. */
  buff: { damage: number; range: number; speed: number };
  aimX: number;     // last target, for the archer's facing
}

export interface Shot {
  id: number;
  kind: 'arrow' | 'boulder' | 'bolt';
  x: number; y: number;
  sx: number; sy: number;     // start
  tx: number; ty: number;     // aim point (boulder) / last known target position
  target: number;             // enemy id (arrow, bolt)
  damage: number;
  magic: boolean;
  splash: number;
  t: number; T: number;       // boulder flight time
  speed: number;
}

export type SimEvent =
  | { type: 'wave'; n: number }
  | { type: 'spawn'; enemy: Enemy }
  | { type: 'shot'; shot: Shot; tower: Tower }
  | { type: 'hit'; shot: Shot; x: number; y: number }
  | { type: 'death'; enemy: Enemy; gold: number }
  | { type: 'leak'; enemy: Enemy }
  | { type: 'heal'; enemy: Enemy }
  | { type: 'built' | 'upgraded'; tower: Tower }
  | { type: 'sold'; tower: Tower; gold: number }
  | { type: 'early'; gold: number }
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

interface Pending { at: number; kind: EnemyKind; wave: number }

export interface BattleOptions { level?: LevelDef; seed?: number }

export class Battle {
  readonly level: LevelDef;
  readonly map: MapDef;
  readonly track: Track;
  readonly rand: () => number;

  state: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  time = 0;
  gold: number;
  lives: number;
  /** Index of the wave that started last (-1 before the first). */
  wave = -1;
  /** Seconds until the next wave starts by itself; null while a wave is still spawning or before the first. */
  countdown: number | null = null;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  shots: Shot[] = [];
  events: SimEvent[] = [];
  kills = 0;
  leaks = 0;

  private pending: Pending[] = [];
  private nextId = 1;

  constructor(opts: BattleOptions = {}) {
    this.level = opts.level ?? LEVELS[0];
    this.map = MAPS[this.level.map];
    this.track = buildTrack(this.map.path);
    this.rand = rng(opts.seed ?? 1);
    this.gold = this.level.gold;
    this.lives = this.level.lives;
  }

  get waveCount() { return this.level.waves.length; }
  get stars() { return this.state === 'won' ? starsFor(this.lives, this.level.lives) : 0; }
  /** True when the player may start the next wave now (the first one, or early during a break). */
  get canCallWave() { return (this.state === 'ready' || (this.state === 'playing' && this.countdown !== null)) && this.wave < this.waveCount - 1; }
  /** Gold for calling the next wave right now. */
  get earlyBonus() { return this.state === 'playing' && this.countdown !== null ? Math.floor(this.countdown * EARLY_GOLD_PER_S) : 0; }

  // ── Player actions ────────────────────────────────────────────────────────────────────────────────

  towerOn(pad: number) { return this.towers.find((t) => t.pad === pad); }

  build(pad: number, kind: TowerKind): Tower | null {
    const cost = TOWERS[kind].tiers[0].cost;
    if (this.state === 'won' || this.state === 'lost' || this.towerOn(pad) || this.gold < cost || !this.map.pads[pad]) return null;
    this.gold -= cost;
    const p = this.map.pads[pad];
    const t: Tower = { id: this.nextId++, pad, kind, tier: 1, x: p.x, y: p.y - 18, cooldown: 0.3, buff: { damage: 1, range: 1, speed: 1 }, aimX: p.x + 1 };
    this.towers.push(t);
    this.events.push({ type: 'built', tower: t });
    return t;
  }

  upgradeCost(t: Tower): number | null { return t.tier >= MAX_TIER ? null : TOWERS[t.kind].tiers[t.tier].cost; }

  upgrade(t: Tower): boolean {
    const cost = this.upgradeCost(t);
    if (cost === null || this.gold < cost || this.state === 'won' || this.state === 'lost') return false;
    this.gold -= cost;
    t.tier++;
    this.events.push({ type: 'upgraded', tower: t });
    return true;
  }

  sellValue(t: Tower) { return Math.floor(spentTo(t.kind, t.tier) * SELL_BACK); }

  sell(t: Tower): number {
    const gold = this.sellValue(t);
    this.gold += gold;
    this.towers = this.towers.filter((x) => x !== t);
    this.events.push({ type: 'sold', tower: t, gold });
    return gold;
  }

  /** Start the first wave, or the next one early (with bonus gold). */
  callWave(): boolean {
    if (!this.canCallWave) return false;
    const bonus = this.earlyBonus;
    if (bonus > 0) { this.gold += bonus; this.events.push({ type: 'early', gold: bonus }); }
    this.state = 'playing';
    this.startWave(this.wave + 1);
    return true;
  }

  // ── Simulation ────────────────────────────────────────────────────────────────────────────────────

  tier(t: Tower): TowerTier { return TOWERS[t.kind].tiers[t.tier - 1]; }
  range(t: Tower) { return this.tier(t).range * t.buff.range; }

  private startWave(n: number) {
    this.wave = n;
    this.countdown = null;
    for (const gr of this.level.waves[n].groups) {
      for (let i = 0; i < gr.count; i++) this.pending.push({ at: this.time + gr.at + i * gr.gap, kind: gr.kind, wave: n });
    }
    this.pending.sort((a, b) => a.at - b.at);
    this.events.push({ type: 'wave', n });
  }

  private spawn(p: Pending) {
    const def = ENEMIES[p.kind];
    const hp = Math.round(def.hp * (1 + this.level.hpGrowth * p.wave));
    const e: Enemy = {
      id: this.nextId++, def, hp, maxHp: hp, dist: 0, offset: (this.rand() - 0.5) * 26,
      x: 0, y: 0, facing: 1, alive: true, slowUntil: 0, slow: 0,
    };
    this.place(e);
    this.enemies.push(e);
    this.events.push({ type: 'spawn', enemy: e });
  }

  private place(e: Enemy) {
    const p = pointAt(this.track, e.dist);
    e.x = p.x - Math.sin(p.angle) * e.offset;
    e.y = p.y + Math.cos(p.angle) * e.offset;
    const c = Math.cos(p.angle);
    if (Math.abs(c) > 0.2) e.facing = c > 0 ? 1 : -1;
  }

  /** Where enemy `e` will be in `s` seconds (for aiming boulders). */
  private lead(e: Enemy, s: number): Pt {
    const p = pointAt(this.track, e.dist + this.speedOf(e) * s);
    return { x: p.x - Math.sin(p.angle) * e.offset, y: p.y + Math.cos(p.angle) * e.offset };
  }

  private speedOf(e: Enemy) { return e.def.speed * (this.time < e.slowUntil ? 1 - e.slow : 1); }

  private damage(e: Enemy, amount: number, magic: boolean) {
    if (!e.alive) return;
    const cut = magic ? e.def.resist : e.def.armor;
    e.hp -= amount * (1 - cut);
    if (e.hp <= 0) {
      e.alive = false;
      this.kills++;
      this.gold += e.def.bounty;
      this.events.push({ type: 'death', enemy: e, gold: e.def.bounty });
    }
  }

  step() {
    if (this.state !== 'playing') return;
    this.time += DT;

    // Spawns
    while (this.pending.length && this.pending[0].at <= this.time) this.spawn(this.pending.shift()!);
    if (!this.pending.length && this.countdown === null && this.wave < this.waveCount - 1) this.countdown = WAVE_BREAK;
    if (this.countdown !== null) {
      this.countdown -= DT;
      if (this.countdown <= 0) this.startWave(this.wave + 1);
    }

    // Enemies walk
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.dist += this.speedOf(e) * DT;
      if (e.dist >= this.track.length) {
        e.alive = false;
        this.leaks++;
        this.lives = Math.max(0, this.lives - e.def.lives);
        this.events.push({ type: 'leak', enemy: e });
        continue;
      }
      this.place(e);
    }
    // Shamans heal their neighbours once a second
    if (Math.floor(this.time) !== Math.floor(this.time - DT)) {
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

    // War Camp auras
    for (const t of this.towers) t.buff = { damage: 1, range: 1, speed: 1 };
    for (const s of this.towers) {
      const aura = this.tier(s).aura;
      if (!aura) continue;
      for (const t of this.towers) {
        if (t === s || t.kind === 'support' || Math.hypot(t.x - s.x, t.y - s.y) > this.tier(s).range) continue;
        // The strongest camp counts (they don't stack), so spamming camps isn't the answer.
        t.buff.damage = Math.max(t.buff.damage, 1 + aura.damage);
        t.buff.range = Math.max(t.buff.range, 1 + aura.range);
        t.buff.speed = Math.max(t.buff.speed, 1 + aura.speed);
      }
    }

    // Towers fire
    for (const t of this.towers) {
      if (t.kind === 'support') continue;
      t.cooldown -= DT * t.buff.speed;
      if (t.cooldown > 0) continue;
      const target = this.pickTarget(t);
      if (!target) { t.cooldown = 0; continue; }
      const tier = this.tier(t), def = TOWERS[t.kind];
      t.cooldown = tier.rate;
      t.aimX = target.x;
      const shot: Shot = {
        id: this.nextId++, kind: t.kind === 'archer' ? 'arrow' : t.kind === 'mage' ? 'bolt' : 'boulder',
        x: t.x, y: t.y - 40, sx: t.x, sy: t.y - 40, tx: target.x, ty: target.y, target: target.id,
        damage: tier.damage * t.buff.damage, magic: def.damageType === 'magic', splash: tier.splash ?? 0,
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
        if (k >= 1) {
          for (const e of this.enemies) if (e.alive && !e.def.flying && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash) this.damage(e, s.damage, false);
          this.events.push({ type: 'hit', shot: s, x: s.tx, y: s.ty });
          s.t = -1;
        }
        continue;
      }
      const e = this.enemies.find((x) => x.id === s.target);
      if (e?.alive) { s.tx = e.x; s.ty = e.y - (e.def.flying ? 46 : 22); }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), move = s.speed * DT;
      if (d <= move + 4) {
        if (e?.alive) this.damage(e, s.damage, s.magic);
        this.events.push({ type: 'hit', shot: s, x: s.tx, y: s.ty });
        s.t = -1;
      } else { s.x += (dx / d) * move; s.y += (dy / d) * move; }
    }
    this.shots = this.shots.filter((s) => s.t >= 0);
    this.enemies = this.enemies.filter((e) => e.alive);

    // End
    if (this.lives <= 0) { this.state = 'lost'; this.events.push({ type: 'end', won: false }); }
    else if (this.wave === this.waveCount - 1 && !this.pending.length && !this.enemies.length) { this.state = 'won'; this.events.push({ type: 'end', won: true }); }
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
