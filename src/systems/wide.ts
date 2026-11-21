// Wide phones (19.5:9, 20:9…) and tall screens (tablets, desktop windows): the game uses Scale.EXPAND, so the canvas
// fills the whole screen. Every scene is still laid out on the 1280×720 design area; the camera keeps that area
// centred, and the spare width on each side shows a mirrored copy of the scene's background instead of black bars.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.ts';

/** How far full-screen shades and backgrounds must reach past the design area to cover any margin. */
export const BLEED = 1200;

/** Centre the 1280×720 design area in this scene's camera, now and on every resize. Call first in create(). */
export function centreCamera(scene: Phaser.Scene): void {
  const fit = () => {
    const cam = scene.cameras.main;
    cam.setSize(scene.scale.width, scene.scale.height);
    cam.setScroll(-(scene.scale.width - GAME_W) / 2, -(scene.scale.height - GAME_H) / 2);
  };
  fit();
  scene.scale.on(Phaser.Scale.Events.RESIZE, fit);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, fit));
}

/**
 * A 1280×720 background with mirrored copies to the left and right, so the side margins on wide phones continue the
 * art. Returned as one container (depth, alpha, destroy act on all three).
 */
export function wideBackground(scene: Phaser.Scene, key: string): Phaser.GameObjects.Container {
  // The copies tuck 4 px under the real image, so the art's 1–2 px edge border doesn't show as a seam.
  const tuck = 4;
  return scene.add.container(0, 0, [
    scene.add.image(tuck, 0, key).setOrigin(1, 0).setFlipX(true),
    scene.add.image(GAME_W - tuck, 0, key).setOrigin(0, 0).setFlipX(true),
    scene.add.image(0, 0, key).setOrigin(0),
  ]);
}
