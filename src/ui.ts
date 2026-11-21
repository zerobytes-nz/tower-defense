// Small UI helpers shared by the scenes: outlined text and wooden buttons drawn with Phaser shapes.
import Phaser from 'phaser';
import { COLORS, FONT } from './config.ts';
import { isRealArt } from './assets.ts';

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 24, color = COLORS.text): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: COLORS.stroke, strokeThickness: Math.max(3, size / 6) })
    .setOrigin(0.5);
}

/** A rounded wooden panel (Graphics), centred on x,y. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.92): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(COLORS.panelEdge, alpha).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 18);
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.lineStyle(2, 0x6b4226, alpha).strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 10);
  return g;
}

/** A button: panel + text, with a press effect. Returns its container. */
export function button(scene: Phaser.Scene, x: number, y: number, text: string, onTap: () => void, w = 220, h = 64, fill = 0x7a4a22): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panelEdge, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
  g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 13);
  g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h / 2 - 6, 9);
  const t = label(scene, 0, 0, text, Math.round(h * 0.48));
  const c = scene.add.container(x, y, [g, t]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.94));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => { c.setScale(1); onTap(); });
  return c;
}

/** A kit header ribbon. The kit art has its word painted in; the placeholder ribbon gets it as text. */
export function header(scene: Phaser.Scene, x: number, y: number, key: string, text: string): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y, [scene.add.image(0, 0, key)]);
  if (!isRealArt(key)) c.add(label(scene, 0, -8, text, 30, '#fff4d0'));
  return c;
}

/** A button made from one image (the kit's round and square buttons), with a press effect. */
export function imageButton(scene: Phaser.Scene, x: number, y: number, key: string, onTap: () => void, scale = 1): Phaser.GameObjects.Image {
  const b = scene.add.image(x, y, key).setScale(scale).setInteractive({ useHandCursor: true });
  b.on('pointerdown', () => b.setScale(scale * 0.92));
  b.on('pointerout', () => b.setScale(scale));
  b.on('pointerup', () => { b.setScale(scale); onTap(); });
  return b;
}
