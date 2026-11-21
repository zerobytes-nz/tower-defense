// The fight: draws the Battle (src/game/sim.ts) and turns taps into build / upgrade / sell / hero / spell actions.
// All rules live in the sim; this file only shows them.
import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, DEBUG, BOT, SEED } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { asset } from '../assets.ts';
import { button, header, imageButton, label, panel } from '../ui.ts';
import { Battle, DT, type Enemy, type Shot, type Tower, type Unit } from '../game/sim.ts';
import { LEVELS } from '../game/levels.ts';
import { ENEMIES, type EnemyKind } from '../game/enemies.ts';
import { TOWERS, TOWER_KINDS, MAX_TIER, towerArt, type TowerKind } from '../game/towers.ts';
import { SPELLS, SPELL_IDS, METEOR, HERO_XP, type SpellId } from '../game/heroes.ts';
import { think } from '../game/bot.ts';
import { save, markSeen, recordStars } from '../save.ts';
import { modsFor } from '../game/perks.ts';
import { sfx, soundOn, toggleSound } from '../systems/audio.ts';

/** Where the archer stands on each tier of the Archer Tower, relative to the tower's base. */
const ARCHER_Y = [-72, -76, -86, -96];
/** Enemies are drawn a bit bigger than the packed frames; flyers float this far above the road. */
const ENEMY_SCALE = 1.15, FLY_UP = 34;
/** Sprite anchor per enemy where the art isn't centred in its frame. */
const ORIGIN_X: Partial<Record<EnemyKind, number>> = { treant: 0.36 };
/** The bottom-left action bar. */
const BAR_Y = GAME_H - 58;

type Menu =
  | { kind: 'build'; pad: number; pick: TowerKind | null }
  | { kind: 'tower'; tower: Tower; pick: 'upgrade' | 'sell' | 'b0' | 'b1' | null };

/** A pending "tap the map" order. */
type Aim = { kind: 'hero' } | { kind: 'spell'; id: SpellId } | { kind: 'rally'; tower: Tower } | null;

interface EnemyView { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; casting: number }
interface TowerView { body: Phaser.GameObjects.Image; unit?: Phaser.GameObjects.Sprite; roots?: Phaser.GameObjects.Image }
interface UnitView { sprite: Phaser.GameObjects.Sprite; art: string; state: string; busyUntil: number; dead: boolean }
interface ActionButton { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; shade: Phaser.GameObjects.Graphics; ring: Phaser.GameObjects.Graphics; text?: Phaser.GameObjects.Text }

export class GameScene extends Phaser.Scene {
  private b!: Battle;
  private levelIndex = 0;
  private speed = 1;
  private paused = false;
  private acc = 0;
  private steps = 0;

  private enemyViews = new Map<number, EnemyView>();
  private towerViews = new Map<number, TowerView>();
  private shotViews = new Map<number, Phaser.GameObjects.Image>();
  private unitViews = new Map<number, UnitView>();
  private fireViews = new Map<number, Phaser.GameObjects.Sprite>();
  private bars!: Phaser.GameObjects.Graphics;
  private rangeG!: Phaser.GameObjects.Graphics;
  private menu: Menu | null = null;
  private menuLayer!: Phaser.GameObjects.Container;
  private aim: Aim = null;
  private aimHint!: Phaser.GameObjects.Text;
  private heroRing!: Phaser.GameObjects.Graphics;

  private hudGold!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private hudWave!: Phaser.GameObjects.Text;
  private waveBtn!: Phaser.GameObjects.Image;
  private waveRing!: Phaser.GameObjects.Graphics;
  private waveBonus!: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;
  private fastBtn!: Phaser.GameObjects.Image;
  private heroBtn?: ActionButton;
  private slamBtn?: ActionButton;
  private spellBtns = new Map<SpellId, ActionButton>();
  private overlay?: Phaser.GameObjects.Container;
  private card?: Phaser.GameObjects.Container;
  private cardQueue: EnemyKind[] = [];
  private fps?: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  init(data: { level?: number }): void {
    this.levelIndex = data.level ?? 0;
    this.b = new Battle({ level: LEVELS[this.levelIndex], seed: SEED || Math.floor(Math.random() * 1e9), mods: BOT ? undefined : modsFor(save().perks) });
    this.speed = 1; this.paused = false; this.acc = 0; this.steps = 0; this.menu = null; this.aim = null;
    this.overlay = undefined; this.card = undefined; this.cardQueue = [];
    this.enemyViews.clear(); this.towerViews.clear(); this.shotViews.clear(); this.unitViews.clear(); this.fireViews.clear(); this.spellBtns.clear();
  }

  create(): void {
    centreCamera(this);
    const map = this.b.map;
    wideBackground(this, map.bg).setDepth(-10);
    if (DEBUG) {
      const g = this.add.graphics().setDepth(-5).lineStyle(3, 0xff00ff, 0.8);
      for (const t of this.b.tracks) g.strokePoints(t.pts);
      this.fps = this.add.text(GAME_W - 10, GAME_H - 10, '', { fontSize: '14px', color: '#0f0' }).setOrigin(1).setDepth(100);
    }

    // Build pads: the painted ones are part of the map art; extra ones get the pad sprite. Each is a tap target.
    map.pads.forEach((p, i) => {
      if (!p.painted) this.add.image(p.x, p.y, 'map.pad').setDepth(-9);
      this.add.zone(p.x, p.y - 20, 124, 110).setInteractive({ useHandCursor: true }).setDepth(1)
        .on('pointerup', (ptr: Phaser.Input.Pointer) => this.tapPad(i, ptr));
    });

    this.rangeG = this.add.graphics().setDepth(2);
    this.heroRing = this.add.graphics().setDepth(3);
    this.bars = this.add.graphics().setDepth(900);
    this.menuLayer = this.add.container(0, 0).setDepth(1000);
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.overlay || this.card) return;
      if (this.aim) this.doAim(p.worldX, p.worldY); else this.closeMenu();
    });

    this.makeHud();
    this.makeActionBar();
    for (const u of this.b.units) this.unitView(u);
    this.b.events.length = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tweens.killAll());
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────────────────────────

  private makeHud(): void {
    const top = this.add.container(16, 14).setDepth(950);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panelEdge, 0.85).fillRoundedRect(0, 0, 360, 58, 14);
    g.fillStyle(COLORS.panel, 0.9).fillRoundedRect(3, 3, 354, 52, 12);
    top.add(g);
    top.add(this.add.image(30, 29, 'ui.heart').setScale(0.8));
    this.hudLives = label(this, 64, 29, '', 28).setOrigin(0, 0.5);
    top.add(this.hudLives);
    top.add(this.add.image(130, 29, 'ui.coin').setScale(0.8));
    this.hudGold = label(this, 154, 29, '', 28, '#ffdd66').setOrigin(0, 0.5);
    top.add(this.hudGold);
    this.hudWave = label(this, 236, 29, '', 24, '#e8d8b8').setOrigin(0, 0.5);
    top.add(this.hudWave);

    const pause = this.add.image(GAME_W - 46, 46, 'ui.pause').setScale(0.72).setDepth(950).setInteractive({ useHandCursor: true });
    pause.on('pointerup', () => { sfx.tap(); this.showPause(); });
    this.fastBtn = this.add.image(GAME_W - 118, 46, 'ui.fast').setScale(0.72).setDepth(950).setInteractive({ useHandCursor: true });
    this.fastBtn.on('pointerup', () => { sfx.tap(); this.speed = this.speed === 1 ? 2 : 1; this.fastBtn.setTint(this.speed === 2 ? 0xffe080 : 0xffffff); });

    const wb = this.b.map.waveButton;
    this.waveRing = this.add.graphics({ x: wb.x, y: wb.y }).setDepth(940);
    this.waveBtn = this.add.image(wb.x, wb.y, 'ui.wave').setScale(0.62).setDepth(941).setInteractive({ useHandCursor: true });
    this.waveBtn.on('pointerup', () => this.callWave());
    this.waveBonus = label(this, wb.x, wb.y + 44, '', 22, '#ffdd66').setDepth(942);
    this.tweens.add({ targets: this.waveBtn, scale: 0.7, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const right = wb.x > GAME_W / 2;
    this.hint = label(this, wb.x + (right ? -70 : 70), wb.y + 4, 'Tap to start!', 26, '#ffffff').setOrigin(right ? 1 : 0, 0.5).setDepth(942);
    this.tweens.add({ targets: this.hint, x: this.hint.x + (right ? -12 : 12), duration: 500, yoyo: true, repeat: -1 });

    this.aimHint = label(this, GAME_W / 2, GAME_H - 40, '', 26, '#ffffff').setDepth(960).setVisible(false);
  }

  /** Hero portrait, his ability, and the two spells: bottom left. */
  private makeActionBar(): void {
    let x = 58;
    if (this.b.hero) {
      this.heroBtn = this.actionButton(x, 'ui.hero', () => this.setAim(this.aim?.kind === 'hero' ? null : { kind: 'hero' }));
      this.heroBtn.text = label(this, 28, 26, '1', 20, '#ffdd66');
      this.heroBtn.c.add(this.heroBtn.text);
      x += 86;
      this.slamBtn = this.actionButton(x, 'ui.hero', () => {
        if (this.b.heroAbility()) { sfx.tap(); this.setAim(null); } else sfx.deny();
      });
      this.slamBtn.img.setTint(0xa0c8ff);
      this.slamBtn.c.add(label(this, 0, 2, '✦', 30, '#ffffff'));
      x += 86;
    }
    for (const id of SPELL_IDS) {
      this.spellBtns.set(id, this.actionButton(x, `ui.${id}`, () => {
        if (!this.b.spellReady(id)) { sfx.deny(); return; }
        sfx.tap();
        this.setAim(this.aim?.kind === 'spell' && this.aim.id === id ? null : { kind: 'spell', id });
      }));
      x += 86;
    }
  }

  private actionButton(x: number, key: string, onTap: () => void): ActionButton {
    const c = this.add.container(x, BAR_Y).setDepth(950);
    const img = this.add.image(0, 0, key).setScale(0.8);
    const shade = this.add.graphics();
    const ring = this.add.graphics();
    c.add([img, shade, ring]);
    c.setSize(76, 76).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.overlay && !this.card && !this.paused) onTap(); });
    return { c, img, shade, ring };
  }

  /** Grey pie for the part of the cooldown still to run; a gold ring when ready; a green one while aiming. */
  private drawCharge(btn: ActionButton, charge: number, armed: boolean): void {
    btn.shade.clear(); btn.ring.clear();
    if (charge < 1) {
      btn.shade.fillStyle(0x000000, 0.55).slice(0, 0, 34, -Math.PI / 2 + Math.PI * 2 * charge, Math.PI * 1.5, false).fillPath();
    } else btn.ring.lineStyle(4, armed ? 0x7aff7a : COLORS.gold, 1).strokeCircle(0, 0, 36);
    btn.c.setScale(armed ? 1.1 : 1);
  }

  private refreshHud(): void {
    const b = this.b;
    this.hudLives.setText(String(b.lives));
    this.hudGold.setText(String(b.gold));
    this.hudWave.setText(`Wave ${Math.max(0, b.wave + 1)}/${b.waveCount}`);
    const can = b.canCallWave;
    if (this.hint && b.state !== 'ready') { this.hint.destroy(); this.hint = undefined; }
    this.waveBtn.setVisible(can);
    this.waveRing.clear();
    if (can && b.countdown !== null) {
      this.waveRing.lineStyle(7, 0x1a100a, 0.8).strokeCircle(0, 0, 36);
      this.waveRing.lineStyle(5, COLORS.gold, 1).beginPath()
        .arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.countdown / 18), false).strokePath();
    }
    const bonus = b.earlyBonus;
    this.waveBonus.setText(can && bonus > 0 ? `+${bonus}` : '').setVisible(can);

    const h = b.hero;
    if (h && this.heroBtn && this.slamBtn && b.heroDef) {
      this.heroBtn.text!.setText(String(b.heroLvl));
      const respawn = h.alive ? 1 : 1 - Math.max(0, h.respawnAt - b.time) / b.heroDef.respawn;
      this.drawCharge(this.heroBtn, respawn, this.aim?.kind === 'hero');
      const cd = b.heroDef.ability.cooldown * b.mods.cooldown;
      this.drawCharge(this.slamBtn, b.state === 'playing' && h.alive ? Math.min(1, 1 - (b.heroAbilityAt - b.time) / cd) : 0, false);
      // XP bar under the portrait
      const lo = HERO_XP[b.heroLvl - 1] ?? 0, hi = HERO_XP[b.heroLvl];
      this.heroBtn.shade.fillStyle(0x1a100a, 0.9).fillRect(-30, 36, 60, 6);
      this.heroBtn.shade.fillStyle(0x7ad0ff, 1).fillRect(-29, 37, hi === undefined ? 58 : 58 * Math.min(1, (b.heroXp - lo) / (hi - lo)), 4);
    }
    for (const [id, btn] of this.spellBtns) this.drawCharge(btn, b.spellCharge(id), this.aim?.kind === 'spell' && this.aim.id === id);
  }

  private callWave(): void {
    if (this.paused || this.overlay || this.card) return;
    if (this.b.callWave()) { this.hint?.destroy(); this.hint = undefined; }
  }

  // ── Aiming: hero moves, spells, rally points ──────────────────────────────────────────────────────

  private setAim(a: Aim): void {
    this.aim = a;
    if (a) this.closeMenu(true);
    const text = !a ? '' : a.kind === 'hero' ? 'Tap the road to send Sir Aldric' : a.kind === 'rally' ? 'Tap the road to move the soldiers'
      : `Tap the road: ${SPELLS[a.id].name}`;
    this.aimHint.setText(text).setVisible(!!a);
    this.rangeG.clear();
    if (a?.kind === 'rally') this.drawRange(a.tower.x, a.tower.y, this.b.range(a.tower), 0xb8f080);
  }

  private doAim(x: number, y: number): void {
    const a = this.aim, b = this.b;
    if (!a) return;
    const ok = a.kind === 'hero' ? b.moveHero(x, y) : a.kind === 'spell' ? b.castSpell(a.id, x, y) : b.setRally(a.tower, x, y);
    if (!ok) { sfx.deny(); this.pop(x, y - 10, a.kind === 'rally' ? 'Too far' : 'On the road!', '#ff8a7a', 20); return; }
    if (a.kind === 'spell' && a.id === 'reinforce') sfx.militia(); else sfx.tap();
    if (a.kind !== 'spell') {
      const flag = this.add.image(x, y, 'ui.rally').setOrigin(0.3, 1).setDepth(y);
      this.tweens.add({ targets: flag, alpha: 0, delay: 600, duration: 300, onComplete: () => flag.destroy() });
    }
    this.setAim(null);
  }

  // ── Menus ─────────────────────────────────────────────────────────────────────────────────────────

  private tapPad(pad: number, ptr: Phaser.Input.Pointer): void {
    if (this.paused || this.overlay || this.card || this.b.over) return;
    if (this.aim) { this.doAim(ptr.worldX, ptr.worldY); return; }
    const t = this.b.towerOn(pad);
    if (this.menu && ((this.menu.kind === 'build' && this.menu.pad === pad) || (this.menu.kind === 'tower' && this.menu.tower === t))) { this.closeMenu(); return; }
    sfx.tap();
    this.menu = t ? { kind: 'tower', tower: t, pick: null } : { kind: 'build', pad, pick: null };
    this.drawMenu();
  }

  private closeMenu(keepAim = false): void {
    this.menu = null; this.menuLayer.removeAll(true); this.rangeG.clear();
    if (!keepAim && this.aim) this.setAim(null);
  }

  /** A round menu option: icon + price tag. First tap picks it (shows what it does), second tap confirms. */
  private option(x: number, y: number, icon: (c: Phaser.GameObjects.Container) => void, price: string, enabled: boolean, picked: boolean, onTap: () => void): void {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panelEdge, 1).fillCircle(0, 0, 46);
    g.fillStyle(picked ? 0x4a8a2a : 0x6b4226, 1).fillCircle(0, 0, 42);
    g.lineStyle(3, picked ? 0xb8f080 : 0xc8a070, 1).strokeCircle(0, 0, 42);
    c.add(g);
    icon(c);
    if (price) c.add(label(this, 0, 44, price, 22, enabled ? '#ffdd66' : '#ff8a7a'));
    if (picked) c.add(label(this, 0, -4, '✔', 34, '#ffffff'));
    c.setSize(100, 100).setInteractive({ useHandCursor: true }).on('pointerup', onTap);
    if (!enabled) c.setAlpha(0.6);
    this.menuLayer.add(c);
  }

  private drawMenu(): void {
    this.menuLayer.removeAll(true);
    this.rangeG.clear();
    const m = this.menu;
    if (!m) return;
    const b = this.b;
    if (m.kind === 'build') {
      const p = b.map.pads[m.pad];
      const cx = Phaser.Math.Clamp(p.x, 90, GAME_W - 90), cy = Phaser.Math.Clamp(p.y - 30, 100, GAME_H - 96);
      const spots = [[-74, -62], [74, -62], [-74, 62], [74, 62]];
      TOWER_KINDS.forEach((k, i) => {
        const cost = b.price(TOWERS[k].tiers[0].cost);
        this.option(cx + spots[i][0], cy + spots[i][1], (c) => c.add(this.add.image(0, 22, `tower.${k}.1`).setOrigin(0.5, 1).setScale(0.5)),
          String(cost), b.gold >= cost, m.pick === k, () => {
            if (m.pick === k) { if (b.build(m.pad, k)) { sfx.build(); this.closeMenu(); } else { sfx.deny(); this.flash(this.hudGold); } return; }
            sfx.tap(); m.pick = k; this.drawMenu();
          });
      });
      if (m.pick) {
        this.drawRange(p.x, p.y - 18, TOWERS[m.pick].tiers[0].range * b.mods.range[m.pick]);
        this.menuInfo(cx, cy, TOWERS[m.pick].name, TOWERS[m.pick].blurb);
      }
      return;
    }

    const t = m.tower, def = TOWERS[t.kind];
    const cx = Phaser.Math.Clamp(t.x, 100, GAME_W - 100), cy = Phaser.Math.Clamp(t.y - 20, 110, GAME_H - 96);
    this.drawRange(t.x, t.y, b.range(t));
    if (t.kind === 'barracks') {
      const f = this.add.image(t.rally.x, t.rally.y, 'ui.rally').setOrigin(0.3, 1);
      this.menuLayer.add(f);
    }
    const confirm = (pick: NonNullable<typeof m.pick>, act: () => boolean) => {
      if (m.pick === pick) { if (act()) { m.pick = null; this.drawMenu(); } else { sfx.deny(); this.flash(this.hudGold); } return; }
      sfx.tap(); m.pick = pick; this.drawMenu();
    };
    if (t.tier < 3) {
      const up = b.upgradeCost(t)!;
      this.option(cx, cy - 88, (c) => c.add(label(this, 0, -2, '▲', 34, '#b8f080')), String(up), b.gold >= up, m.pick === 'upgrade',
        () => confirm('upgrade', () => { const ok = b.upgrade(t); if (ok) sfx.upgrade(); return ok; }));
      if (m.pick === 'upgrade') this.drawRange(t.x, t.y, def.tiers[t.tier].range * t.buff.range * b.mods.range[t.kind], 0xb8f080);
    } else if (t.tier < MAX_TIER) {
      ([0, 1] as const).forEach((br) => {
        const d = def.branches[br], cost = b.upgradeCost(t, br)!, pick = br ? 'b1' : 'b0';
        this.option(cx + (br ? 74 : -74), cy - 78, (c) => c.add(this.add.image(0, 24, `tower.${t.kind}.${d.id}`).setOrigin(0.5, 1).setScale(0.48)),
          String(cost), b.gold >= cost, m.pick === pick, () => confirm(pick, () => { const ok = b.upgrade(t, br); if (ok) sfx.upgrade(); return ok; }));
      });
    }
    const sellX = t.kind === 'barracks' ? cx + 74 : cx;
    this.option(sellX, cy + 80, (c) => c.add(this.add.image(0, -4, 'ui.coin').setScale(0.8)), `+${b.sellValue(t)}`, true, m.pick === 'sell',
      () => confirm('sell', () => { b.sell(t); sfx.sell(); this.closeMenu(); return true; }));
    if (t.kind === 'barracks') {
      this.option(cx - 74, cy + 80, (c) => c.add(this.add.image(0, 2, 'ui.rally').setScale(1.2)), '', true, false, () => { sfx.tap(); this.setAim({ kind: 'rally', tower: t }); });
    }

    const s = b.stats(t);
    const name = t.tier >= MAX_TIER && t.branch !== null ? def.branches[t.branch].name : def.name;
    const stats = t.kind === 'barracks'
      ? `Tier ${t.tier} · ${s.soldiers!.count} soldiers, ${Math.round(s.soldiers!.hp * b.mods.soldierHp)} hp each`
      : `Tier ${t.tier} · ${Math.round(s.damage * t.buff.damage * b.mods.damage[t.kind])} dmg every ${s.rate}s${t.buff.damage > 1 ? ' (boosted)' : ''}`;
    let text = stats, title = name;
    if (m.pick === 'sell') text = 'Tap again to sell';
    else if (m.pick === 'upgrade') text = 'Tap again to upgrade';
    else if (m.pick === 'b0' || m.pick === 'b1') { const d = def.branches[m.pick === 'b1' ? 1 : 0]; title = d.name; text = `${d.blurb} Tap again to build.`; }
    else if (t.tier === 3) text = `${stats} · Pick a path!`;
    if (b.time < t.rootedUntil) text = 'Held by roots!';
    this.menuInfo(cx, cy, title, text);
  }

  private menuInfo(cx: number, cy: number, title: string, text: string): void {
    const x = Phaser.Math.Clamp(cx + (cx > GAME_W / 2 ? -260 : 260), 200, GAME_W - 200);
    const c = this.add.container(x, cy);
    c.add(panel(this, 0, 0, 360, 84, 0.94));
    c.add(label(this, 0, -18, title, 24, '#ffcc33'));
    const t = label(this, 0, 16, text, 17, '#e8d8b8');
    t.setWordWrapWidth(340).setAlign('center');
    c.add(t);
    this.menuLayer.add(c);
  }

  private drawRange(x: number, y: number, r: number, color: number = COLORS.range): void {
    this.rangeG.fillStyle(color, 0.12).fillCircle(x, y, r);
    this.rangeG.lineStyle(2, color, 0.7).strokeCircle(x, y, r);
  }

  private flash(t: Phaser.GameObjects.Text): void {
    t.setColor('#ff6a5a');
    this.time.delayedCall(260, () => t.setColor('#ffdd66'));
  }

  // ── Frame loop ────────────────────────────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const b = this.b;
    if (!this.paused && !this.overlay && !this.card) {
      this.acc += Math.min(delta / 1000, 0.1) * this.speed;
      while (this.acc >= DT) {
        this.acc -= DT;
        if (BOT && this.steps++ % 30 === 0) think(b);
        b.step();
        this.handleEvents();
        if (this.card) { this.acc = 0; break; }
      }
    }
    this.syncViews();
    this.refreshHud();
    if (this.menu?.kind === 'tower' && !b.towers.includes(this.menu.tower)) this.closeMenu();
    if (this.aim?.kind === 'rally' && !b.towers.includes(this.aim.tower)) this.setAim(null);
    if (this.fps) this.fps.setText(`${Math.round(this.game.loop.actualFps)} fps`);
  }

  private handleEvents(): void {
    const b = this.b;
    for (const e of b.events) {
      switch (e.type) {
        case 'spawn': this.addEnemy(e.enemy); break;
        case 'death': this.killEnemy(e.enemy, e.gold); break;
        case 'leak': this.leakEnemy(e.enemy); break;
        case 'heal': { const v = this.enemyViews.get(e.enemy.id); if (v) { v.sprite.setTint(0x9aff9a); this.time.delayedCall(180, () => v.sprite.clearTint()); } break; }
        case 'built': case 'upgraded': this.drawTower(e.tower, e.type === 'built'); if (this.menu) this.drawMenu(); break;
        case 'sold': {
          const v = this.towerViews.get(e.tower.id); v?.body.destroy(); v?.unit?.destroy(); v?.roots?.destroy();
          this.towerViews.delete(e.tower.id); this.pop(e.tower.x, e.tower.y - 40, `+${e.gold}`, '#ffdd66'); break;
        }
        case 'shot': this.addShot(e.shot, e.tower); break;
        case 'hit': this.hitShot(e.shot, e.x, e.y); break;
        case 'zap': this.zap(e.points); break;
        case 'early': this.pop(b.map.waveButton.x, b.map.waveButton.y - 40, `+${e.gold}`, '#ffdd66'); sfx.coin(); break;
        case 'wave': this.banner(e.n + 1 === b.waveCount ? 'Final wave!' : `Wave ${e.n + 1}`); sfx.wave(); break;
        case 'unitUp': this.unitView(e.unit); break;
        case 'unitDown': this.unitDown(e.unit); break;
        case 'strike': this.strike(e.unit); break;
        case 'levelup': if (b.hero) this.pop(b.hero.x, b.hero.y - 70, `Level ${e.level}!`, '#7ad0ff', 26); sfx.levelup(); break;
        case 'slam': this.ring(e.x, e.y, e.r, 0xa0c8ff); this.cameras.main.shake(160, 0.006); sfx.slam(); break;
        case 'meteorFall': this.meteorFall(e.x, e.y, e.at); break;
        case 'meteor': this.blast(e.x, e.y, e.r); this.cameras.main.shake(140, 0.006); sfx.boom(); break;
        case 'roots': this.roots(e.enemy, e.towers); break;
        case 'end':
          if (e.won && !BOT) recordStars(b.level.id, b.stars);
          if (e.won) sfx.win(); else sfx.lose();
          this.time.delayedCall(700, () => this.showEnd(e.won));
          break;
      }
    }
    b.events.length = 0;
  }

  private syncViews(): void {
    const b = this.b, now = this.time.now;
    this.bars.clear();
    for (const e of b.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      const fy = e.def.flying ? FLY_UP : 0;
      v.sprite.setPosition(e.x, e.y + 6 - fy).setFlipX(e.facing < 0).setDepth(e.y);
      v.shadow.setPosition(e.x, e.y + 4);
      const stunned = b.time < e.stunUntil, still = stunned || e.held;
      if (v.casting < now) {
        if (still && v.sprite.anims.isPlaying) v.sprite.anims.pause();
        else if (!still && v.sprite.anims.isPaused) v.sprite.anims.resume();
      }
      if (!v.sprite.isTinted || v.sprite.tintTopLeft !== 0x9aff9a) {
        const tint = stunned ? 0xfff08a : b.time < e.burnUntil ? 0xffa070 : b.time < e.slowUntil ? 0x9ad8ff : null;
        if (tint === null) v.sprite.clearTint(); else v.sprite.setTint(tint);
      }
      if (e.hp < e.maxHp) this.hpBar(e.x, e.y - 50 * e.def.size * ENEMY_SCALE - fy, 30 * e.def.size, e.hp / e.maxHp, e.def.boss ? 0xd04ae0 : undefined);
    }
    for (const s of b.shots) {
      const v = this.shotViews.get(s.id);
      if (!v) continue;
      if (s.kind === 'arrow') v.setRotation(Math.atan2(s.ty - s.y, s.tx - s.x));
      else if (s.kind === 'boulder') v.setRotation(v.rotation + 0.15);
      v.setPosition(s.x, s.y);
    }
    // Soldiers, militia, hero
    for (const u of b.units) {
      const v = this.unitViews.get(u.id);
      if (!v || !u.alive) continue;
      v.sprite.setPosition(u.x, u.y + 4).setFlipX(u.facing < 0).setDepth(u.y + 0.2);
      if (v.busyUntil < now) {
        const state = u.moving ? 'walk' : 'idle';
        if (state !== v.state) {
          v.state = state;
          if (state === 'walk') v.sprite.play(`${v.art}.walk`);
          else if (this.anims.exists(`${v.art}.idle`)) v.sprite.play(`${v.art}.idle`);
          else v.sprite.stop().setTexture(`${v.art}.walk`, 0);
        }
      }
      if (u.hp < u.maxHp) this.hpBar(u.x, u.y - (u.kind === 'hero' ? 64 : 54), 26, u.hp / u.maxHp, 0x7ad0ff);
    }
    // Selected hero: a ring under him
    this.heroRing.clear();
    const h = b.hero;
    if (h?.alive && this.aim?.kind === 'hero') this.heroRing.lineStyle(3, 0x7aff7a, 1).strokeEllipse(h.x, h.y + 4, 46, 16);
    // Burning ground
    const live = new Set(b.fires.map((f) => f.id));
    for (const [id, s] of this.fireViews) if (!live.has(id)) { this.fireViews.delete(id); this.tweens.add({ targets: s, alpha: 0, duration: 250, onComplete: () => s.destroy() }); }
    for (const f of b.fires) {
      if (this.fireViews.has(f.id)) continue;
      const s = this.add.sprite(f.x, f.y + 8, 'fx.fire').setOrigin(0.5, 1).setScale(f.r / 32).setDepth(f.y - 2).setAlpha(0.9).play('fx.fire');
      this.fireViews.set(f.id, s);
    }
    // Roots wear off
    for (const t of b.towers) {
      const v = this.towerViews.get(t.id);
      if (v?.roots && b.time >= t.rootedUntil) { const r = v.roots; v.roots = undefined; v.body.clearTint(); this.tweens.add({ targets: r, alpha: 0, duration: 300, onComplete: () => r.destroy() }); }
    }
  }

  private hpBar(cx: number, y: number, w: number, k: number, color?: number): void {
    const x = cx - w / 2;
    this.bars.fillStyle(0x1a100a, 0.9).fillRect(x - 1, y - 1, w + 2, 6);
    this.bars.fillStyle(color ?? (k > 0.4 ? 0x7ad04a : 0xe0503a), 1).fillRect(x, y, w * Math.max(0, k), 4);
  }

  // ── Views ─────────────────────────────────────────────────────────────────────────────────────────

  private addEnemy(e: Enemy): void {
    const k = e.def.kind;
    const sprite = this.add.sprite(e.x, e.y, `enemy.${k}.walk`).setOrigin(ORIGIN_X[k] ?? 0.5, 1).setScale(ENEMY_SCALE).play(`enemy.${k}.walk`);
    sprite.anims.setProgress(Math.random());
    const shadow = this.add.ellipse(e.x, e.y, 34 * e.def.size, 10, 0x000000, e.def.flying ? 0.18 : 0.28).setDepth(-1);
    this.enemyViews.set(e.id, { sprite, shadow, casting: 0 });
    if (!BOT && !save().seen.includes(k) && !this.cardQueue.includes(k)) { this.cardQueue.push(k); this.nextCard(); }
    if (e.def.boss) { this.banner(`${e.def.name}!`); this.cameras.main.shake(300, 0.004); }
  }

  private killEnemy(e: Enemy, gold: number): void {
    const v = this.enemyViews.get(e.id);
    if (!v) return;
    this.enemyViews.delete(e.id);
    v.shadow.destroy();
    v.sprite.clearTint().play(`enemy.${e.def.kind}.die`);
    if (e.def.flying) this.tweens.add({ targets: v.sprite, y: e.y + 6, duration: 400, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: v.sprite, alpha: 0, delay: 650, duration: 350, onComplete: () => v.sprite.destroy() });
    this.pop(e.x, e.y - 50, `+${gold}`, '#ffdd66', 18);
    sfx.death();
  }

  private leakEnemy(e: Enemy): void {
    const v = this.enemyViews.get(e.id);
    if (v) { v.sprite.destroy(); v.shadow.destroy(); this.enemyViews.delete(e.id); }
    this.cameras.main.shake(140, 0.004);
    this.hudLives.setColor('#ff6a5a');
    this.time.delayedCall(300, () => this.hudLives.setColor('#ffffff'));
    sfx.leak();
  }

  private drawTower(t: Tower, fresh: boolean): void {
    const old = this.towerViews.get(t.id);
    old?.body.destroy(); old?.unit?.destroy(); old?.roots?.destroy();
    const body = this.add.image(t.x, t.y + 32, towerArt(t.kind, t.tier, t.branch)).setOrigin(0.5, 1).setDepth(t.y);
    const v: TowerView = { body };
    if (t.kind === 'archer') {
      const key = `unit.archer.${Math.min(3, t.tier)}`;
      v.unit = this.add.sprite(t.x + 2, t.y + 32 + ARCHER_Y[t.tier - 1], key, 0).setOrigin(0.5, 1).setScale(asset(key).displayScale).setDepth(t.y + 0.5);
    }
    this.towerViews.set(t.id, v);
    body.setScale(fresh ? 0.6 : 1.1);
    this.tweens.add({ targets: body, scale: 1, duration: 260, ease: 'Back.easeOut' });
    const branch = t.tier >= MAX_TIER && t.branch !== null ? TOWERS[t.kind].branches[t.branch].name : '';
    this.pop(t.x, t.y - 70, fresh ? '' : branch ? `${branch}!` : `Tier ${t.tier}!`, '#b8f080');
  }

  private addShot(s: Shot, t: Tower): void {
    const v = this.towerViews.get(t.id);
    if (t.kind === 'archer' && v?.unit) { v.unit.setFlipX(t.aimX < t.x).play(v.unit.texture.key); s.sy = s.y = v.unit.y - 30; s.sx = s.x = v.unit.x; sfx.arrow(); }
    if (t.kind === 'catapult' && v) { this.tweens.add({ targets: v.body, scaleY: 0.9, duration: 90, yoyo: true }); sfx.boulder(); }
    if (t.kind === 'mage' && v) { v.body.setTint(0xffb0a0); this.time.delayedCall(120, () => v.body.clearTint()); s.sy = s.y = t.y - 70; sfx.bolt(); }
    const img = this.add.image(s.x, s.y, `shot.${s.kind}`).setDepth(800);
    if (s.kind === 'bolt') this.tweens.add({ targets: img, scale: 1.3, duration: 120, yoyo: true, repeat: -1 });
    this.shotViews.set(s.id, img);
  }

  private hitShot(s: Shot, x: number, y: number): void {
    this.shotViews.get(s.id)?.destroy();
    this.shotViews.delete(s.id);
    if (s.kind === 'boulder') { this.blast(x, y, (s.stats.splash ?? 48) * this.b.mods.splash); sfx.boom(); }
    else if (s.kind === 'bolt') {
      const c = this.add.circle(x, y, 10, 0xff8a6a, 0.8).setDepth(801);
      this.tweens.add({ targets: c, scale: 2.4, alpha: 0, duration: 220, onComplete: () => c.destroy() });
    } else sfx.hit();
    if (s.crit) this.pop(x, y - 30, 'Crit!', '#ffcc33', 18);
  }

  private blast(x: number, y: number, r: number): void {
    const fx = this.add.sprite(x, y - 10, 'fx.blast').setDepth(y + 1).setScale(r / 48).play('fx.blast');
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }

  /** Chain lightning: a jagged line through the points, fading fast. */
  private zap(points: { x: number; y: number }[]): void {
    const g = this.add.graphics().setDepth(820);
    for (const [w, col] of [[6, 0x4ab0ff], [2, 0xffffff]] as const) {
      g.lineStyle(w, col, 1).beginPath();
      points.forEach((p, i) => {
        if (i === 0) { g.moveTo(p.x, p.y - 30); return; }
        const q = points[i - 1];
        for (let k = 1; k <= 3; k++) g.lineTo(q.x + ((p.x - q.x) * k) / 4 + (Math.random() - 0.5) * 16, q.y - 30 + ((p.y - q.y) * k) / 4 + (Math.random() - 0.5) * 16);
        g.lineTo(p.x, p.y - 30);
      });
      g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
    sfx.zap();
  }

  private ring(x: number, y: number, r: number, color: number): void {
    const c = this.add.ellipse(x, y, 20, 10).setStrokeStyle(6, color, 1).setDepth(y + 1);
    this.tweens.add({ targets: c, width: r * 2, height: r * 1.1, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
  }

  private meteorFall(x: number, y: number, at: number): void {
    const m = this.add.image(x + 220, y - 560, 'fx.meteor').setDepth(890).setScale(1.3).setRotation(-0.6);
    this.tweens.add({ targets: m, x, y: y - 12, duration: (at * 1000) / this.speed, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
    const mark = this.add.ellipse(x, y, METEOR.radius * 2, METEOR.radius * 1.1, 0xff4020, 0.15).setStrokeStyle(2, 0xff6a3a, 0.7).setDepth(1);
    this.tweens.add({ targets: mark, alpha: 0, delay: (at * 1000) / this.speed, duration: 200, onComplete: () => mark.destroy() });
    sfx.whoosh();
  }

  private roots(e: Enemy, towers: Tower[]): void {
    const v = this.enemyViews.get(e.id);
    if (v && this.anims.exists(`enemy.${e.def.kind}.cast`)) {
      v.casting = this.time.now + 700;
      v.sprite.play(`enemy.${e.def.kind}.cast`).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (this.enemyViews.has(e.id)) v.sprite.play(`enemy.${e.def.kind}.walk`); });
    }
    this.ring(e.x, e.y, e.def.boss!.radius, 0x6b8a2b);
    for (const t of towers) {
      const tv = this.towerViews.get(t.id);
      if (!tv) continue;
      tv.roots?.destroy();
      tv.roots = this.add.image(t.x, t.y + 34, 'fx.roots').setOrigin(0.5, 1).setDepth(t.y + 1).setScale(1.1, 0);
      this.tweens.add({ targets: tv.roots, scaleY: 1.1, duration: 300, ease: 'Back.easeOut' });
      tv.body.setTint(0x9a8a6a);
    }
    if (this.menu) this.drawMenu();
    this.cameras.main.shake(260, 0.006);
    sfx.roots();
  }

  // Units (hero, soldiers, militia)

  private unitArt(u: Unit): string { return u.kind === 'hero' ? this.b.heroDef!.art : `unit.${u.kind}`; }

  private unitView(u: Unit): void {
    let v = this.unitViews.get(u.id);
    if (!v) {
      const art = this.unitArt(u);
      const sprite = this.add.sprite(u.x, u.y, `${art}.walk`, 0).setOrigin(0.5, 1).setScale(u.kind === 'hero' ? 1.15 : 0.95);
      if (u.kind === 'hero') sprite.setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.overlay && !this.card) { sfx.tap(); this.setAim(this.aim?.kind === 'hero' ? null : { kind: 'hero' }); } });
      v = { sprite, art, state: '', busyUntil: 0, dead: false };
      this.unitViews.set(u.id, v);
    }
    v.dead = false; v.state = ''; v.sprite.setVisible(true).setAlpha(1);
    this.tweens.add({ targets: v.sprite, alpha: { from: 0, to: 1 }, duration: 250 });
  }

  private unitDown(u: Unit): void {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    v.dead = true; v.state = 'die';
    v.sprite.play(`${v.art}.die`);
    if (u.kind === 'hero' && this.aim?.kind === 'hero') this.setAim(null);
    this.tweens.add({
      targets: v.sprite, alpha: 0, delay: 600, duration: 300, onComplete: () => {
        if (!this.b.units.includes(u)) { v.sprite.destroy(); this.unitViews.delete(u.id); } else if (v.dead) v.sprite.setVisible(false);
      },
    });
  }

  private strike(u: Unit): void {
    const v = this.unitViews.get(u.id);
    if (!v || v.dead) return;
    v.state = 'attack'; v.busyUntil = this.time.now + 380 / this.speed;
    v.sprite.play(`${v.art}.attack`);
    sfx.clang();
  }

  private pop(x: number, y: number, text: string, color: string, size = 22): void {
    if (!text) return;
    const t = label(this, x, y, text, size, color).setDepth(960);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private banner(text: string): void {
    const t = label(this, GAME_W / 2, GAME_H * 0.3, text, 54, '#ffcc33').setDepth(970).setAlpha(0).setScale(0.7);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut', hold: 700, yoyo: true, onComplete: () => t.destroy() });
  }

  // ── New-enemy cards ───────────────────────────────────────────────────────────────────────────────

  private nextCard(): void {
    if (this.card || this.overlay || !this.cardQueue.length) return;
    const kind = this.cardQueue.shift()!, d = ENEMIES[kind];
    this.closeMenu();
    const x = GAME_W / 2, y = GAME_H / 2 - 40;
    const c = this.add.container(0, 0).setDepth(1900);
    c.add(this.add.rectangle(x, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.35).setInteractive());
    c.add(panel(this, x, y, 560, 250));
    c.add(label(this, x, y - 96, d.boss ? 'Boss!' : 'New enemy!', 26, d.boss ? '#ff8a7a' : '#7ad0ff'));
    const s = this.add.sprite(x - 180, y + 50, `enemy.${kind}.walk`).setOrigin(ORIGIN_X[kind] ?? 0.5, 1).setScale(d.boss ? 0.9 : 1.6).play(`enemy.${kind}.walk`);
    c.add(s);
    c.add(label(this, x + 70, y - 52, d.name, 36, '#ffcc33'));
    const tip = label(this, x + 70, y + 6, d.tip, 21, '#e8d8b8').setWordWrapWidth(330).setAlign('center');
    c.add(tip);
    c.add(button(this, x + 70, y + 84, 'Got it', () => {
      sfx.tap(); markSeen(kind); c.destroy(); this.card = undefined; this.nextCard();
    }, 180, 54, 0x4a8a2a));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.card = c;
    sfx.card();
  }

  // ── Overlays ──────────────────────────────────────────────────────────────────────────────────────

  private shade(): Phaser.GameObjects.Container {
    this.closeMenu();
    const c = this.add.container(0, 0).setDepth(2000);
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.55).setInteractive());
    this.overlay = c;
    return c;
  }

  private showPause(): void {
    if (this.overlay) return;
    this.paused = true;
    const c = this.shade(), x = GAME_W / 2, y = GAME_H / 2 + 20;
    c.add(this.add.image(x, y, 'gui.table').setScale(0.95));
    c.add(header(this, x, y - 180, 'gui.header.settings', 'Settings'));
    c.add(label(this, x, y - 112, 'Paused', 40, '#ffcc33'));
    const resume = () => { sfx.tap(); c.destroy(); this.overlay = undefined; this.paused = false; };
    c.add(imageButton(this, x, y - 10, 'gui.btn.play', resume, 0.6));
    const row = y + 82;
    const snd = imageButton(this, x - 150, row, soundOn() ? 'gui.btn.sound' : 'gui.btn.soundoff', () => { toggleSound(); sfx.tap(); snd.setTexture(soundOn() ? 'gui.btn.sound' : 'gui.btn.soundoff'); }, 0.85);
    c.add(snd);
    c.add(imageButton(this, x, row, 'gui.btn.restart', () => this.scene.restart({ level: this.levelIndex }), 0.85));
    c.add(imageButton(this, x + 150, row, 'gui.btn.menu', () => this.scene.start('Menu', { page: 'levels' }), 0.85));
    for (const [dx, t] of [[-150, 'Sound'], [0, 'Restart'], [150, 'Levels']] as const) c.add(label(this, x + dx, row + 46, t, 18, '#e8d8b8'));
  }

  private showEnd(won: boolean): void {
    if (this.overlay) this.overlay.destroy();
    this.card?.destroy(); this.card = undefined;
    const b = this.b, c = this.shade(), x = GAME_W / 2, y = GAME_H / 2 + 20;
    c.add(this.add.image(x, y, 'gui.table.tall').setScale(1.2));
    c.add(header(this, x, y - 252, won ? 'gui.header.win' : 'gui.header.failed', won ? 'You win!' : 'Failed'));
    c.add(this.add.image(x, y - 22, 'gui.window').setDisplaySize(330, 300));
    const stars = this.add.sprite(x, y - 100, 'gui.stars', won ? 0 : 0).setScale(0.95);
    c.add(stars);
    if (won) {
      for (let i = 1; i <= b.stars; i++) this.time.delayedCall(250 + i * 260, () => { stars.setFrame(i); this.tweens.add({ targets: stars, scale: 1.05, duration: 120, yoyo: true }); sfx.coin(); });
      c.add(label(this, x, y + 2, b.stars === 3 ? 'Perfect defence!' : 'Level complete!', 30, '#ffffff'));
      c.add(label(this, x, y + 40, `${b.lives} lives left · ${b.kills} enemies`, 20, '#e8d8b8'));
      c.add(label(this, x, y + 72, b.stars < 3 ? 'Lose fewer lives for more stars.' : 'Spend stars on upgrades!', 18, '#b8a888'));
    } else {
      stars.setAlpha(0.35);
      c.add(label(this, x, y + 2, `Held ${b.wave} of ${b.waveCount} waves`, 28, '#ffffff'));
      c.add(label(this, x, y + 42, 'Try the hero, spells,', 20, '#e8d8b8'));
      c.add(label(this, x, y + 68, 'upgrades or a new tower mix.', 20, '#e8d8b8'));
    }
    const next = won && this.levelIndex + 1 < LEVELS.length;
    const by = y + 218, btns: [string, () => void][] = [
      ['gui.btn.menu', () => this.scene.start('Menu', { page: 'levels' })],
      ['gui.btn.restart', () => this.scene.restart({ level: this.levelIndex })],
    ];
    if (next) btns.push(['gui.btn.next', () => this.scene.restart({ level: this.levelIndex + 1 })]);
    btns.forEach(([key, fn], i) => c.add(imageButton(this, x + (i - (btns.length - 1) / 2) * 110, by, key, () => { sfx.tap(); fn(); }, 0.9)));
  }
}
