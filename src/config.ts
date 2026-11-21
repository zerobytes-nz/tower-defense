// Screen size and switches. Landscape 1280×720 (16:9), scaled with Scale.EXPAND: the design area stays centred
// and wider or taller screens see more (src/systems/wide.ts).
export const GAME_W = 1280;
export const GAME_H = 720;

const params = new URLSearchParams(location.search);
/** ?debug: FPS meter, the enemy path drawn on the map, window.__game. */
export const DEBUG = params.has('debug');
/** ?bot: the bot plays the level (for testing). */
export const BOT = params.has('bot');
/** ?seed=123: replay the same fight. */
export const SEED = Number(params.get('seed')) || 0;

export const FONT = '"Passion One", system-ui, sans-serif';

export const COLORS = {
  bg: 0x1f1a14,
  panel: 0x3a2618,
  panelEdge: 0x1a100a,
  gold: 0xffcc33,
  good: 0x8cc63f,
  bad: 0xe0503a,
  range: 0xfff2b0,
  text: '#ffffff',
  dim: '#e8d8b8',
  stroke: '#2b1d14',
};
