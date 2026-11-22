// Demo players, so the game can be shown without real wallets: bundled items in the same shape as the user-items
// API's `results`. With a test API key on the server, the Connect screen can also load TheoSwap's test codes.
import type { ApiItem } from './game/awi.ts';

export type DemoId = 'whale' | 'collector' | 'newbie';

const item = (n: number, itemId: string, Rarity: string, extra: Record<string, unknown> = {}): ApiItem => ({
  contract: '0x0000000000000000000000000000000000000000', token_id: n, itemData: { itemId, Rarity, ...extra },
});
const crystal = (n: number, itemId: string, Crystal: number) => item(n, itemId, 'Common', { Crystal });

export const DEMO_PROFILES: Record<DemoId, { name: string; blurb: string; sample: ApiItem[] }> = {
  whale: {
    name: 'Whale', blurb: '12 NFTs: both knights, every tower family, crystals',
    sample: [
      item(1, 'hero_black', 'Legendary'), item(2, 'hero_bronze', 'Rare'),
      item(3, 'tower_mage_storm', 'Epic'), item(4, 'tower_mage_frost', 'Rare'), item(5, 'tower_archer_venom', 'Legendary'),
      item(6, 'tower_archer_ranger', 'Common'), item(7, 'tower_catapult_ember', 'Epic'), item(8, 'tower_catapult_quake', 'Common'),
      item(9, 'tower_barracks_iron', 'Rare'), item(10, 'tower_barracks_iron', 'Rare'),
      crystal(11, 'vqfzxy', 640), crystal(12, 'cfx17w', 420),
    ],
  },
  collector: {
    name: 'Collector', blurb: '5 NFTs: a knight, three towers and a crystal',
    sample: [
      item(21, 'hero_bronze', 'Common'), item(22, 'tower_mage_frost', 'Rare'), item(23, 'tower_barracks_wolf', 'Common'),
      item(24, 'tower_archer_ranger', 'Epic'), crystal(25, 'c5y0iq', 260),
    ],
  },
  newbie: {
    name: 'New player', blurb: '1 NFT: one AWI tower',
    sample: [item(31, 'tower_catapult_ember', 'Common')],
  },
};
