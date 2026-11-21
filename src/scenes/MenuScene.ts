import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { header, imageButton, label } from '../ui.ts';
import { isRealArt } from '../assets.ts';
import { LEVELS } from '../game/levels.ts';
import { MAPS } from '../game/maps.ts';
import { PERKS, canBuy, perkById, perksCost, type Perk } from '../game/perks.ts';
import { save, write, totalStars, unlocked } from '../save.ts';
import { sfx, soundOn, toggleSound } from '../systems/audio.ts';

type Page = 'title' | 'levels' | 'upgrades';

/** Title screen, World 1's level select and the upgrade tree. `{ page }` opens one directly. */
export class MenuScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private dim!: Phaser.GameObjects.Rectangle;

  constructor() { super('Menu'); }

  create(data: { page?: Page; levels?: boolean }): void {
    centreCamera(this);
    wideBackground(this, 'bg.menu');
    this.dim = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.3);
    this.layer = this.add.container(0, 0);
    const page = data?.page ?? (data?.levels ? 'levels' : 'title');
    this.show(page);
  }

  private show(page: Page): void {
    this.layer.removeAll(true);
    this.dim.setAlpha(page === 'title' ? 0 : 1);
    if (page === 'title') this.title(); else if (page === 'levels') this.levels(); else this.upgrades();
  }

  private soundButton(x: number, y: number): Phaser.GameObjects.Image {
    const b = imageButton(this, x, y, soundOn() ? 'gui.btn.sound' : 'gui.btn.soundoff', () => {
      toggleSound(); sfx.tap(); b.setTexture(soundOn() ? 'gui.btn.sound' : 'gui.btn.soundoff');
    }, 0.8);
    return b;
  }

  // ── Title ─────────────────────────────────────────────────────────────────────────────────────────

  private title(): void {
    const x = GAME_W / 2;
    const logo = label(this, x, 190, 'Tower Defense', 104, '#ffcc33');
    logo.setStroke('#5a2a0a', 16).setShadow(0, 6, '#00000088', 6, true, true);
    this.layer.add(logo);
    this.layer.add(label(this, x, 268, 'Build towers. Lead the hero. Hold the road.', 28, '#fff4d0'));
    const play = imageButton(this, x, 440, 'gui.btn.play', () => { sfx.tap(); this.show('levels'); });
    this.tweens.add({ targets: play, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.layer.add(play);
    this.layer.add(this.soundButton(70, 66));
  }

  // ── Level select ──────────────────────────────────────────────────────────────────────────────────

  private levels(): void {
    const ids = LEVELS.map((l) => l.id), cx = GAME_W / 2, cy = 392;
    this.layer.add(this.add.image(cx, cy, 'gui.table').setScale(1.6));
    this.layer.add(header(this, cx, 96, 'gui.header.levels', 'Levels'));
    this.layer.add(label(this, cx, 158, 'World 1 · The Green Frontier', 32, '#ffcc33'));

    const w = 270, gap = 22, x0 = cx - (LEVELS.length - 1) * (w + gap) / 2;
    LEVELS.forEach((lv, i) => {
      const x = x0 + i * (w + gap), y = 370, open = unlocked(ids, i), stars = save().stars[lv.id] ?? 0;
      const c = this.add.container(x, y);
      c.add(this.add.image(0, -40, 'gui.window').setDisplaySize(w, 300));
      const thumb = this.add.image(0, -88, MAPS[lv.map].bg).setDisplaySize(w - 34, (w - 34) * (9 / 16));
      if (!open) thumb.setTint(0x4a4a4a);
      c.add(thumb);
      c.add(label(this, 0, 18, `${i + 1}. ${lv.name}`, 26, open ? '#ffffff' : '#9a8a7a'));
      const boss = lv.waves.some((wv) => wv.groups.some((g) => g.kind === 'treant'));
      c.add(label(this, 0, 46, `${lv.waves.length} waves${boss ? ' · Boss' : ''}`, 18, '#e8d8b8'));
      c.add(this.add.sprite(0, 88, 'gui.stars', stars).setScale(0.55));
      if (!open) c.add(label(this, 0, -88, 'Locked', 34, '#e8d8b8'));
      c.setSize(w, 300);
      if (open) {
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => c.setScale(0.97));
        c.on('pointerout', () => c.setScale(1));
        c.on('pointerup', () => { sfx.tap(); this.scene.start('Game', { level: i }); });
      }
      this.layer.add(c);
    });

    // Stars and the upgrade tree
    const free = totalStars() - perksCost(save().perks);
    this.layer.add(this.add.image(cx - 70, 612, 'gui.upgrade.bank'));
    this.layer.add(label(this, cx - 92, 612, String(free), 30, '#ffdd66'));
    const up = imageButton(this, cx + 50, 608, 'perk.23', () => { sfx.tap(); this.show('upgrades'); }, 0.75);
    this.layer.add(up);
    this.layer.add(label(this, cx + 130, 612, 'Upgrades', 26, '#fff4d0').setOrigin(0, 0.5));
    if (free > 0) this.tweens.add({ targets: up, angle: { from: -6, to: 6 }, duration: 260, yoyo: true, repeat: -1 });

    this.layer.add(imageButton(this, 70, GAME_H - 66, 'gui.btn.back', () => { sfx.tap(); this.show('title'); }, 0.8));
    this.layer.add(this.soundButton(GAME_W - 70, 66));
  }

  // ── Upgrade tree ──────────────────────────────────────────────────────────────────────────────────

  private pick: string | null = null;

  private upgrades(): void {
    const s = save(), cx = GAME_W / 2, cy = 400;
    const owned = s.perks, free = totalStars() - perksCost(owned);
    this.layer.add(this.add.image(cx, cy, 'gui.upgrade.table').setScale(0.95));
    this.layer.add(header(this, cx, 108, 'gui.header.upgrade', 'Upgrade'));
    this.layer.add(this.add.image(cx + 352, 132, 'gui.btn.close').setInteractive({ useHandCursor: true }).on('pointerup', () => { sfx.tap(); this.show('levels'); }));

    PERKS.forEach((col, ci) => {
      const x = cx + (ci - 2.5) * 106;
      this.layer.add(label(this, x, 158, col.name, 17, '#e8d8b8'));
      col.perks.forEach((perk, ri) => {
        const y = 214 + ri * 100;
        const has = owned.includes(perk.id), can = canBuy(owned, perk.id), afford = can && free >= perk.cost;
        const icon = this.add.image(x, y, perk.icon).setInteractive({ useHandCursor: true });
        if (!has) icon.setAlpha(afford ? 0.95 : 0.5);
        if (!has && !afford) icon.setTint(0x8a8a8a);
        if (this.pick === perk.id) icon.setScale(1.1);
        icon.on('pointerup', () => this.tapPerk(perk));
        this.layer.add(icon);
        if (has) this.layer.add(label(this, x + 28, y + 28, '✔', 26, '#7aff7a'));
        else {
          this.layer.add(this.add.image(x, y + 46, 'gui.upgrade.cost').setScale(0.8));
          this.layer.add(label(this, x - 8, y + 46, String(perk.cost), 20, afford ? '#ffdd66' : '#c8a088'));
        }
      });
    });

    // Info line for the picked perk
    const p = this.pick ? perkById(this.pick) : null;
    let text = 'Tap a perk to see what it does. Stars come from levels: up to 3 each.';
    if (p) {
      const has = owned.includes(p.id), can = canBuy(owned, p.id);
      text = `${p.name}: ${p.blurb} ` + (has ? '(owned)' : !can ? '(buy the one above it first)' : free < p.cost ? `(needs ${p.cost} ★)` : `Tap again to buy for ${p.cost} ★.`);
    }
    this.layer.add(label(this, cx, 606, text, 20, '#fff4d0').setWordWrapWidth(700).setAlign('center'));

    this.layer.add(this.add.image(cx - 300, 660, 'gui.upgrade.bank'));
    this.layer.add(label(this, cx - 322, 660, String(free), 28, '#ffdd66'));
    this.layer.add(imageButton(this, cx + 190, 660, 'gui.btn.reset', () => {
      if (!owned.length) { sfx.deny(); return; }
      sfx.sell(); s.perks = []; write(); this.pick = null; this.show('upgrades');
    }));
    this.layer.add(imageButton(this, cx + 300, 660, 'gui.btn.done', () => { sfx.tap(); this.pick = null; this.show('levels'); }));
    if (!isRealArt('gui.btn.reset')) this.layer.add(label(this, cx + 190, 700, 'Reset', 16, '#e8d8b8'));
    if (!isRealArt('gui.btn.done')) this.layer.add(label(this, cx + 300, 700, 'Done', 16, '#e8d8b8'));
  }

  private tapPerk(p: Perk): void {
    const s = save(), free = totalStars() - perksCost(s.perks);
    if (this.pick === p.id && canBuy(s.perks, p.id) && free >= p.cost) {
      s.perks.push(p.id); write(); sfx.upgrade();
    } else if (this.pick === p.id) sfx.deny();
    else sfx.tap();
    this.pick = p.id;
    this.show('upgrades');
  }
}
