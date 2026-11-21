// The fight: draws the Battle (src/game/sim.ts) and turns taps into build / upgrade / sell / call-wave actions.
// All rules live in the sim; this file only shows them.
import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, DEBUG, BOT, SEED } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { asset } from '../assets.ts';
import { button, label, panel } from '../ui.ts';
import { Battle, DT, type Enemy, type Shot, type Tower } from '../game/sim.ts';
import { LEVELS } from '../game/levels.ts';
import { TOWERS, TOWER_KINDS, type TowerKind } from '../game/towers.ts';
import { think } from '../game/bot.ts';

/** Where the archer stands on each tier of the Archer Tower, relative to the tower's base. */
const ARCHER_Y = [-72, -76, -86];
/** Enemies are drawn a bit bigger than the packed frames; flyers float this far above the road. */
const ENEMY_SCALE = 1.15, FLY_UP = 34;

type Menu =
  | { kind: 'build'; pad: number; pick: TowerKind | null }
  | { kind: 'tower'; tower: Tower; pick: 'upgrade' | 'sell' | null };

interface EnemyView { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse }
interface TowerView { body: Phaser.GameObjects.Image; unit?: Phaser.GameObjects.Sprite }

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
  private bars!: Phaser.GameObjects.Graphics;
  private rangeG!: Phaser.GameObjects.Graphics;
  private menu: Menu | null = null;
  private menuLayer!: Phaser.GameObjects.Container;

  private hudGold!: Phaser.GameObjects.Text;
  private hudLives!: Phaser.GameObjects.Text;
  private hudWave!: Phaser.GameObjects.Text;
  private waveBtn!: Phaser.GameObjects.Image;
  private waveRing!: Phaser.GameObjects.Graphics;
  private waveBonus!: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;
  private fastBtn!: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Container;
  private fps?: Phaser.GameObjects.Text;

  constructor() { super('Game'); }

  init(data: { level?: number }): void {
    this.levelIndex = data.level ?? 0;
    this.b = new Battle({ level: LEVELS[this.levelIndex], seed: SEED || Math.floor(Math.random() * 1e9) });
    this.speed = 1; this.paused = false; this.acc = 0; this.steps = 0; this.menu = null; this.overlay = undefined;
    this.enemyViews.clear(); this.towerViews.clear(); this.shotViews.clear();
  }

  create(): void {
    centreCamera(this);
    const map = this.b.map;
    wideBackground(this, map.bg).setDepth(-10);
    if (DEBUG) {
      const g = this.add.graphics().setDepth(-5).lineStyle(3, 0xff00ff, 0.8);
      g.strokePoints(this.b.track.pts);
      this.fps = this.add.text(GAME_W - 10, GAME_H - 10, '', { fontSize: '14px', color: '#0f0' }).setOrigin(1).setDepth(100);
    }

    // Build pads: the painted ones are part of the map art; extra ones get the pad sprite. Each is a tap target.
    map.pads.forEach((p, i) => {
      if (!p.painted) this.add.image(p.x, p.y, 'map.pad').setDepth(-9);
      this.add.zone(p.x, p.y - 20, 124, 110).setInteractive({ useHandCursor: true }).setDepth(1)
        .on('pointerup', () => this.tapPad(i));
    });

    this.rangeG = this.add.graphics().setDepth(2);
    this.bars = this.add.graphics().setDepth(900);
    this.menuLayer = this.add.container(0, 0).setDepth(1000);
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => { if (!over.length) this.closeMenu(); });

    this.makeHud();
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
    pause.on('pointerup', () => this.showPause());
    this.fastBtn = this.add.image(GAME_W - 118, 46, 'ui.fast').setScale(0.72).setDepth(950).setInteractive({ useHandCursor: true });
    this.fastBtn.on('pointerup', () => { this.speed = this.speed === 1 ? 2 : 1; this.fastBtn.setTint(this.speed === 2 ? 0xffe080 : 0xffffff); });

    const wb = this.b.map.waveButton;
    this.waveRing = this.add.graphics({ x: wb.x, y: wb.y }).setDepth(940);
    this.waveBtn = this.add.image(wb.x, wb.y, 'ui.wave').setScale(0.62).setDepth(941).setInteractive({ useHandCursor: true });
    this.waveBtn.on('pointerup', () => this.callWave());
    this.waveBonus = label(this, wb.x, wb.y + 44, '', 22, '#ffdd66').setDepth(942);
    this.tweens.add({ targets: this.waveBtn, scale: 0.7, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hint = label(this, wb.x + 70, wb.y + 4, 'Tap to start!', 26, '#ffffff').setOrigin(0, 0.5).setDepth(942);
    this.tweens.add({ targets: this.hint, x: wb.x + 82, duration: 500, yoyo: true, repeat: -1 });
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
  }

  private callWave(): void {
    if (this.paused || this.overlay) return;
    if (this.b.callWave()) { this.hint?.destroy(); this.hint = undefined; }
  }

  // ── Menus ─────────────────────────────────────────────────────────────────────────────────────────

  private tapPad(pad: number): void {
    if (this.paused || this.overlay || this.b.state === 'won' || this.b.state === 'lost') return;
    const t = this.b.towerOn(pad);
    if (this.menu && ((this.menu.kind === 'build' && this.menu.pad === pad) || (this.menu.kind === 'tower' && this.menu.tower === t))) { this.closeMenu(); return; }
    this.menu = t ? { kind: 'tower', tower: t, pick: null } : { kind: 'build', pad, pick: null };
    this.drawMenu();
  }

  private closeMenu(): void { this.menu = null; this.menuLayer.removeAll(true); this.rangeG.clear(); }

  /** A round menu option: icon + price tag. First tap picks it (shows what it does), second tap confirms. */
  private option(x: number, y: number, icon: (c: Phaser.GameObjects.Container) => void, price: string, enabled: boolean, picked: boolean, onTap: () => void): void {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(COLORS.panelEdge, 1).fillCircle(0, 0, 46);
    g.fillStyle(picked ? 0x4a8a2a : 0x6b4226, 1).fillCircle(0, 0, 42);
    g.lineStyle(3, picked ? 0xb8f080 : 0xc8a070, 1).strokeCircle(0, 0, 42);
    c.add(g);
    icon(c);
    const tag = label(this, 0, 44, price, 22, enabled ? '#ffdd66' : '#ff8a7a');
    c.add(tag);
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
        const def = TOWERS[k], cost = def.tiers[0].cost;
        this.option(cx + spots[i][0], cy + spots[i][1], (c) => c.add(this.add.image(0, 22, `tower.${k}.1`).setOrigin(0.5, 1).setScale(0.5)),
          String(cost), b.gold >= cost, m.pick === k, () => {
            if (m.pick === k) { if (b.build(m.pad, k)) this.closeMenu(); else this.flash(this.hudGold); return; }
            m.pick = k; this.drawMenu();
          });
      });
      if (m.pick) {
        this.drawRange(p.x, p.y - 18, TOWERS[m.pick].tiers[0].range);
        this.menuInfo(cx, cy, `${TOWERS[m.pick].name}`, TOWERS[m.pick].blurb);
      }
      return;
    }
    const t = m.tower, def = TOWERS[t.kind];
    const cx = Phaser.Math.Clamp(t.x, 90, GAME_W - 90), cy = Phaser.Math.Clamp(t.y - 20, 110, GAME_H - 96);
    this.drawRange(t.x, t.y, b.range(t));
    const up = b.upgradeCost(t);
    if (up !== null) {
      this.option(cx, cy - 88, (c) => c.add(label(this, 0, -2, '▲', 34, '#b8f080')), String(up), b.gold >= up, m.pick === 'upgrade', () => {
        if (m.pick === 'upgrade') { if (b.upgrade(t)) { m.pick = null; this.drawMenu(); } else this.flash(this.hudGold); return; }
        m.pick = 'upgrade'; this.drawMenu();
      });
    }
    this.option(cx, cy + 80, (c) => c.add(this.add.image(0, -4, 'ui.coin').setScale(0.8)), `+${b.sellValue(t)}`, true, m.pick === 'sell', () => {
      if (m.pick === 'sell') { b.sell(t); this.closeMenu(); return; }
      m.pick = 'sell'; this.drawMenu();
    });
    if (m.pick === 'upgrade' && up !== null) this.drawRange(t.x, t.y, def.tiers[t.tier].range * t.buff.range, 0xb8f080);
    const tier = def.tiers[t.tier - 1];
    const stats = t.kind === 'support'
      ? `Tier ${t.tier} · towers nearby +${Math.round(tier.aura!.damage * 100)}% damage`
      : `Tier ${t.tier} · ${Math.round(tier.damage * t.buff.damage)} dmg every ${tier.rate}s${t.buff.damage > 1 ? ' (boosted)' : ''}`;
    this.menuInfo(cx, cy, def.name, m.pick === 'sell' ? 'Tap again to sell' : m.pick === 'upgrade' ? 'Tap again to upgrade' : stats);
  }

  private menuInfo(cx: number, cy: number, title: string, text: string): void {
    const x = Phaser.Math.Clamp(cx + (cx > GAME_W / 2 ? -250 : 250), 190, GAME_W - 190);
    const c = this.add.container(x, cy);
    c.add(panel(this, 0, 0, 340, 76, 0.94));
    c.add(label(this, 0, -16, title, 24, '#ffcc33'));
    c.add(label(this, 0, 14, text, 17, '#e8d8b8'));
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
    if (!this.paused && !this.overlay) {
      this.acc += Math.min(delta / 1000, 0.1) * this.speed;
      while (this.acc >= DT) {
        this.acc -= DT;
        if (BOT && this.steps++ % 30 === 0) think(b);
        if (b.state === 'ready' && BOT) b.callWave();
        b.step();
        this.handleEvents();
      }
    }
    this.syncViews();
    this.refreshHud();
    if (this.menu) {
      // Keep prices greyed / lit as gold changes, and close the tower menu if the tower is gone.
      if (this.menu.kind === 'tower' && !b.towers.includes(this.menu.tower)) this.closeMenu();
    }
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
        case 'sold': { const v = this.towerViews.get(e.tower.id); v?.body.destroy(); v?.unit?.destroy(); this.towerViews.delete(e.tower.id); this.pop(e.tower.x, e.tower.y - 40, `+${e.gold}`, '#ffdd66'); break; }
        case 'shot': this.addShot(e.shot, e.tower); break;
        case 'hit': this.hitShot(e.shot, e.x, e.y); break;
        case 'early': this.pop(b.map.waveButton.x, b.map.waveButton.y - 40, `+${e.gold}`, '#ffdd66'); break;
        case 'wave': this.banner(e.n + 1 === b.waveCount ? 'Final wave!' : `Wave ${e.n + 1}`); break;
        case 'end': this.time.delayedCall(700, () => this.showEnd(e.won)); break;
      }
    }
    b.events.length = 0;
  }

  private syncViews(): void {
    const b = this.b;
    this.bars.clear();
    for (const e of b.enemies) {
      const v = this.enemyViews.get(e.id);
      if (!v) continue;
      const fy = e.def.flying ? FLY_UP : 0;
      v.sprite.setPosition(e.x, e.y + 6 - fy).setFlipX(e.facing < 0).setDepth(e.y);
      v.shadow.setPosition(e.x, e.y + 4);
      if (e.hp < e.maxHp) {
        const w = 30 * e.def.size, x = e.x - w / 2, y = e.y - 50 * e.def.size * ENEMY_SCALE - fy;
        this.bars.fillStyle(0x1a100a, 0.9).fillRect(x - 1, y - 1, w + 2, 6);
        this.bars.fillStyle(e.hp / e.maxHp > 0.4 ? 0x7ad04a : 0xe0503a, 1).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    for (const s of b.shots) {
      const v = this.shotViews.get(s.id);
      if (!v) continue;
      if (s.kind === 'arrow') v.setRotation(Math.atan2(s.ty - s.y, s.tx - s.x));
      else if (s.kind === 'boulder') v.setRotation(v.rotation + 0.15);
      v.setPosition(s.x, s.y);
    }
  }

  // ── Views ─────────────────────────────────────────────────────────────────────────────────────────

  private addEnemy(e: Enemy): void {
    const sprite = this.add.sprite(e.x, e.y, `enemy.${e.def.kind}.walk`).setOrigin(0.5, 1).setScale(ENEMY_SCALE).play(`enemy.${e.def.kind}.walk`);
    sprite.anims.setProgress(Math.random());
    const shadow = this.add.ellipse(e.x, e.y, 34 * e.def.size, 10, 0x000000, e.def.flying ? 0.18 : 0.28).setDepth(-1);
    this.enemyViews.set(e.id, { sprite, shadow });
  }

  private killEnemy(e: Enemy, gold: number): void {
    const v = this.enemyViews.get(e.id);
    if (!v) return;
    this.enemyViews.delete(e.id);
    v.shadow.destroy();
    v.sprite.play(`enemy.${e.def.kind}.die`);
    if (e.def.flying) this.tweens.add({ targets: v.sprite, y: e.y + 6, duration: 400, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: v.sprite, alpha: 0, delay: 650, duration: 350, onComplete: () => v.sprite.destroy() });
    this.pop(e.x, e.y - 50, `+${gold}`, '#ffdd66', 18);
  }

  private leakEnemy(e: Enemy): void {
    const v = this.enemyViews.get(e.id);
    if (v) { v.sprite.destroy(); v.shadow.destroy(); this.enemyViews.delete(e.id); }
    this.cameras.main.shake(140, 0.004);
    this.hudLives.setColor('#ff6a5a');
    this.time.delayedCall(300, () => this.hudLives.setColor('#ffffff'));
  }

  private drawTower(t: Tower, fresh: boolean): void {
    const old = this.towerViews.get(t.id);
    old?.body.destroy(); old?.unit?.destroy();
    const body = this.add.image(t.x, t.y + 32, `tower.${t.kind}.${t.tier}`).setOrigin(0.5, 1).setDepth(t.y);
    const v: TowerView = { body };
    if (t.kind === 'archer') {
      const key = `unit.archer.${t.tier}`;
      v.unit = this.add.sprite(t.x + 2, t.y + 32 + ARCHER_Y[t.tier - 1], key, 0).setOrigin(0.5, 1).setScale(asset(key).displayScale).setDepth(t.y + 0.5);
    }
    this.towerViews.set(t.id, v);
    body.setScale(fresh ? 0.6 : 1.1);
    this.tweens.add({ targets: body, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.pop(t.x, t.y - 70, fresh ? '' : `Tier ${t.tier}!`, '#b8f080');
  }

  private addShot(s: Shot, t: Tower): void {
    const v = this.towerViews.get(t.id);
    if (t.kind === 'archer' && v?.unit) { v.unit.setFlipX(t.aimX < t.x).play(`unit.archer.${t.tier}`); s.sy = s.y = v.unit.y - 30; s.sx = s.x = v.unit.x; }
    if (t.kind === 'catapult' && v) this.tweens.add({ targets: v.body, scaleY: 0.9, duration: 90, yoyo: true });
    if (t.kind === 'mage' && v) { v.body.setTint(0xffb0a0); this.time.delayedCall(120, () => v.body.clearTint()); s.sy = s.y = t.y - 70; }
    const img = this.add.image(s.x, s.y, `shot.${s.kind}`).setDepth(800);
    if (s.kind === 'bolt') this.tweens.add({ targets: img, scale: 1.3, duration: 120, yoyo: true, repeat: -1 });
    this.shotViews.set(s.id, img);
  }

  private hitShot(s: Shot, x: number, y: number): void {
    this.shotViews.get(s.id)?.destroy();
    this.shotViews.delete(s.id);
    if (s.kind === 'boulder') {
      const fx = this.add.sprite(x, y - 10, 'fx.blast').setDepth(y + 1).setScale(s.splash / 48).play('fx.blast');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    } else if (s.kind === 'bolt') {
      const c = this.add.circle(x, y, 10, 0xff8a6a, 0.8).setDepth(801);
      this.tweens.add({ targets: c, scale: 2.4, alpha: 0, duration: 220, onComplete: () => c.destroy() });
    }
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
    const c = this.shade(), x = GAME_W / 2, y = GAME_H / 2;
    c.add(panel(this, x, y, 420, 380));
    c.add(label(this, x, y - 130, 'Paused', 52, '#ffcc33'));
    c.add(button(this, x, y - 40, 'Resume', () => { c.destroy(); this.overlay = undefined; this.paused = false; }, 260, 64, 0x4a8a2a));
    c.add(button(this, x, y + 40, 'Restart', () => this.scene.restart({ level: this.levelIndex }), 260, 64));
    c.add(button(this, x, y + 120, 'Menu', () => this.scene.start('Menu'), 260, 64));
  }

  private showEnd(won: boolean): void {
    if (this.overlay) this.overlay.destroy();
    const b = this.b, c = this.shade(), x = GAME_W / 2, y = GAME_H / 2;
    c.add(panel(this, x, y, 520, 400));
    c.add(label(this, x, y - 140, won ? 'Victory!' : 'Defeat', 64, won ? '#ffcc33' : '#ff7a6a'));
    if (won) {
      for (let i = 0; i < 3; i++) {
        const s = this.add.image(x + (i - 1) * 84, y - 50, 'ui.star').setScale(0).setAlpha(i < b.stars ? 1 : 0.25);
        if (i >= b.stars) s.setTint(0x333333);
        c.add(s);
        this.tweens.add({ targets: s, scale: 1.8, delay: 250 + i * 220, duration: 300, ease: 'Back.easeOut' });
      }
      c.add(label(this, x, y + 20, `${b.lives} lives left · ${b.kills} enemies beaten`, 24, '#e8d8b8'));
    } else c.add(label(this, x, y - 40, `Held ${b.wave} of ${b.waveCount} waves`, 28, '#e8d8b8'));
    c.add(button(this, x - 120, y + 110, won ? 'Play again' : 'Try again', () => this.scene.restart({ level: this.levelIndex }), 220, 64, 0x4a8a2a));
    c.add(button(this, x + 120, y + 110, 'Menu', () => this.scene.start('Menu'), 220, 64));
  }
}
