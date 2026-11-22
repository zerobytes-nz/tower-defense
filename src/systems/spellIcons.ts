// AWI spell icons, drawn in code (no licensed art involved) and saved as textures `ui.awi.<spell id>`.
import Phaser from 'phaser';
import { AWI_SPELLS, type AwiSpellId } from '../game/awi.ts';

const S = 88, C = S / 2;
type G = Phaser.GameObjects.Graphics;
const pts = (a: number[][]) => a.map(([x, y]) => ({ x: C + x, y: C + y }));

const DRAW: Record<AwiSpellId, (g: G) => void> = {
  armor: (g) => { // a cracked shield
    const s = pts([[-20, -22], [20, -22], [20, 2], [0, 24], [-20, 2]]);
    g.fillStyle(0xd8d0c0, 1).fillPoints(s, true).lineStyle(4, 0x1a100a, 1).strokePoints(s, true);
    g.lineStyle(5, 0xc0302a, 1).strokePoints(pts([[-4, -22], [4, -8], [-4, 2], [4, 14]]), false);
  },
  rally: (g) => { // a banner on a pole
    g.fillStyle(0x6a4a2a, 1).fillRect(C - 18, C - 26, 5, 52);
    const f = pts([[-13, -26], [22, -18], [-13, -6]]);
    g.fillStyle(0xffc94d, 1).fillPoints(f, true).lineStyle(3, 0x1a100a, 1).strokePoints(f, true);
    g.lineStyle(5, 0xffffff, 1).strokePoints(pts([[0, 20], [8, 8], [16, 20]]), false);
  },
  fire: (g) => {
    g.fillStyle(0xff6a2a, 1).fillPoints(pts([[0, -26], [18, 4], [12, 20], [0, 24], [-12, 20], [-18, 4], [-6, -6]]), true);
    g.fillStyle(0xffd84a, 1).fillPoints(pts([[0, -6], [9, 10], [0, 20], [-9, 10]]), true);
  },
  acid: (g) => {
    g.fillStyle(0x6a7a6a, 1).fillEllipse(C, C - 14, 50, 22);
    g.fillStyle(0x9ad04a, 1);
    for (const [x, y] of [[-14, 8], [2, 16], [16, 6]]) g.fillPoints(pts([[x, y - 10], [x + 5, y], [x, y + 5], [x - 5, y]]), true);
  },
  slow: (g) => { // an hourglass
    g.fillStyle(0x9a8aff, 1).fillPoints(pts([[-16, -24], [16, -24], [3, 0], [16, 24], [-16, 24], [-3, 0]]), true);
    g.lineStyle(4, 0x1a100a, 1).strokePoints(pts([[-16, -24], [16, -24], [3, 0], [16, 24], [-16, 24], [-3, 0]]), true);
    g.fillStyle(0xffe8a0, 1).fillPoints(pts([[-9, 20], [9, 20], [0, 8]]), true);
  },
  rock: (g) => {
    const r = pts([[-24, 16], [-20, -6], [-6, -20], [12, -18], [24, -2], [22, 18]]);
    g.fillStyle(0x9a8a7a, 1).fillPoints(r, true).lineStyle(4, 0x1a100a, 1).strokePoints(r, true);
    g.lineStyle(3, 0x5a4a3a, 1).strokePoints(pts([[-6, -20], [-2, -2], [12, 6]]), false);
  },
  freeze: (g) => { // a snowflake
    g.lineStyle(6, 0xe8f6ff, 1);
    for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; g.lineBetween(C - Math.cos(a) * 26, C - Math.sin(a) * 26, C + Math.cos(a) * 26, C + Math.sin(a) * 26); }
    g.fillStyle(0x9ad8ff, 1).fillCircle(C, C, 7);
  },
  lightning: (g) => {
    const z = pts([[6, -28], [-14, 4], [0, 4], [-8, 28], [16, -6], [2, -6]]);
    g.fillStyle(0xffe066, 1).fillPoints(z, true).lineStyle(3, 0x1a100a, 1).strokePoints(z, true);
  },
};

/** Make the icon textures once per game. */
export function makeSpellIcons(scene: Phaser.Scene): void {
  for (const id of Object.keys(AWI_SPELLS) as AwiSpellId[]) {
    const key = `ui.awi.${id}`;
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x1a100a, 1).fillCircle(C, C, C - 1);
    g.fillStyle(0x3a2a40, 1).fillCircle(C, C, C - 5);
    g.lineStyle(4, AWI_SPELLS[id].color, 1).strokeCircle(C, C, C - 7);
    DRAW[id](g);
    g.generateTexture(key, S, S);
    g.destroy();
  }
}
