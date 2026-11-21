import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, FONT } from '../config.ts';
import { centreCamera } from '../systems/wide.ts';
import { preloadAll, setupAssets } from '../assets.ts';
import '../deeplink.ts';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    centreCamera(this);
    const w = 420, x = (GAME_W - w) / 2, y = GAME_H / 2;
    this.add.rectangle(x, y, w, 16, COLORS.panel).setOrigin(0, 0.5);
    const bar = this.add.rectangle(x, y, 1, 16, COLORS.gold).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => { bar.width = Math.max(1, w * p); });
    document.getElementById('loading')?.remove();
    preloadAll(this);
  }

  create(): void {
    setupAssets(this);
    // Passion One is a CSS @font-face (index.html); wait for it so the first texts aren't drawn in the fallback.
    const ready = document.fonts?.load(`40px ${FONT.split(',')[0]}`).catch(() => null) ?? Promise.resolve();
    Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => this.scene.start('Menu'));
  }
}
