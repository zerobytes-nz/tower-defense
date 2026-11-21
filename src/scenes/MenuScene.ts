import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { button, label, panel } from '../ui.ts';
import { LEVELS } from '../game/levels.ts';
import { MAPS } from '../game/maps.ts';
import { save, totalStars, unlocked } from '../save.ts';
import { sfx, soundOn, toggleSound } from '../systems/audio.ts';

/** Title screen, then World 1's level select. `{ levels: true }` opens the level select directly. */
export class MenuScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() { super('Menu'); }

  create(data: { levels?: boolean }): void {
    centreCamera(this);
    wideBackground(this, MAPS[LEVELS[0].map].bg);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.45);
    this.layer = this.add.container(0, 0);
    if (data?.levels) this.levels(); else this.title();
  }

  private title(): void {
    this.layer.removeAll(true);
    const x = GAME_W / 2, y = GAME_H / 2;
    this.layer.add(panel(this, x, y, 560, 380));
    this.layer.add(label(this, x, y - 120, 'Tower Defense', 72, '#ffcc33'));
    this.layer.add(label(this, x, y - 46, 'Build towers. Lead the hero. Hold the road.', 24, '#e8d8b8'));
    this.layer.add(button(this, x, y + 50, 'Play', () => { sfx.tap(); this.levels(); }, 260, 84, 0x4a8a2a));
    const snd = button(this, x, y + 140, this.soundText(), () => { toggleSound(); sfx.tap(); (snd.list[1] as Phaser.GameObjects.Text).setText(this.soundText()); }, 200, 50);
    this.layer.add(snd);
  }

  private soundText(): string { return `Sound: ${soundOn() ? 'on' : 'off'}`; }

  private levels(): void {
    this.layer.removeAll(true);
    const ids = LEVELS.map((l) => l.id);
    this.layer.add(label(this, GAME_W / 2, 70, 'World 1 · The Green Frontier', 46, '#ffcc33'));
    this.layer.add(this.add.image(GAME_W / 2 - 60, 128, 'ui.star').setScale(0.8));
    this.layer.add(label(this, GAME_W / 2 - 34, 128, `${totalStars()} / ${LEVELS.length * 3}`, 28).setOrigin(0, 0.5));

    const w = 340, gap = 40, x0 = GAME_W / 2 - (LEVELS.length - 1) * (w + gap) / 2;
    LEVELS.forEach((lv, i) => {
      const x = x0 + i * (w + gap), y = GAME_H / 2 + 40, open = unlocked(ids, i), stars = save().stars[lv.id] ?? 0;
      const c = this.add.container(x, y);
      c.add(panel(this, 0, 0, w, 330));
      const thumb = this.add.image(0, -60, MAPS[lv.map].bg).setDisplaySize(w - 30, (w - 30) * (9 / 16));
      if (!open) thumb.setTint(0x555555);
      c.add(thumb);
      c.add(label(this, 0, 60, `${i + 1}. ${lv.name}`, 30, open ? '#ffffff' : '#9a8a7a'));
      c.add(label(this, 0, 94, `${lv.waves.length} waves${lv.waves.some((wv) => wv.groups.some((g) => g.kind === 'treant')) ? ' · Boss' : ''}`, 20, '#e8d8b8'));
      for (let s = 0; s < 3; s++) {
        const st = this.add.image((s - 1) * 46, 134, 'ui.star').setScale(0.9);
        if (s >= stars) st.setTint(0x333333).setAlpha(0.5);
        c.add(st);
      }
      if (!open) c.add(label(this, 0, -60, '🔒', 64));
      c.setSize(w, 330);
      if (open) {
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => c.setScale(0.97));
        c.on('pointerout', () => c.setScale(1));
        c.on('pointerup', () => { sfx.tap(); this.scene.start('Game', { level: i }); });
      }
      this.layer.add(c);
    });
    this.layer.add(button(this, 110, GAME_H - 50, 'Back', () => { sfx.tap(); this.title(); }, 160, 56));
  }
}
