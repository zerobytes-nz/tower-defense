import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { button, label, panel } from '../ui.ts';
import { LEVELS } from '../game/levels.ts';
import { MAPS } from '../game/maps.ts';

/** Title screen. Milestone 2 replaces this with the world map and level select. */
export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    centreCamera(this);
    const level = LEVELS[0];
    wideBackground(this, MAPS[level.map].bg);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.45);
    panel(this, GAME_W / 2, GAME_H / 2, 560, 380);
    label(this, GAME_W / 2, GAME_H / 2 - 120, 'Tower Defense', 72, '#ffcc33');
    label(this, GAME_W / 2, GAME_H / 2 - 50, `Level 1 · ${level.name}`, 30);
    label(this, GAME_W / 2, GAME_H / 2 - 12, `${level.waves.length} waves · build, upgrade, hold the road`, 22, '#e8d8b8');
    button(this, GAME_W / 2, GAME_H / 2 + 90, 'Play', () => this.scene.start('Game', { level: 0 }), 260, 84, 0x4a8a2a);
  }
}
