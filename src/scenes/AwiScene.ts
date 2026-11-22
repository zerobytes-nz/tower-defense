// AWIs (Altered World Items): connect a TheoSwap player code (or pick a demo player), see the NFTs turn into
// AWIs, and pick the loadout of up to 5 that comes into every level.
import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.ts';
import { centreCamera, wideBackground, BLEED } from '../systems/wide.ts';
import { button, imageButton, label, panel } from '../ui.ts';
import { sfx } from '../systems/audio.ts';
import { DEMO_PROFILES, type DemoId } from '../demo.ts';
import { connect, connectDemo, profile, saveProfile, type Profile } from '../profile.ts';
import { normalizeCode } from '../theoswap.ts';
import { save, crystalStars } from '../save.ts';
import {
  RARITY_COLOR, RARITIES, TOWER_VARIANTS, HERO_ITEMS, CRYSTALS_PER_STAR, LOADOUT_SIZE,
  SPELL_ITEMS, AWI_SPELLS, awiTitle, awiStat, cantAdd, perkText, type AWI,
} from '../game/awi.ts';
import { makeSpellIcons } from '../systems/spellIcons.ts';
import { HEROES } from '../game/heroes.ts';

type Page = 'connect' | 'reveal' | 'loadout';
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const CRYSTAL_COLOR: Record<string, number> = { c5y0iq: 0x5ad06a, vqfzxy: 0xe8504a, cfx17w: 0x4a9ae8 };

/** An AWI's picture: its tower (tinted), its knight (tinted), its spell icon, or a crystal. */
export function awiIcon(scene: Phaser.Scene, a: AWI, size: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  if (a.slot === 'tower') {
    const v = TOWER_VARIANTS[a.itemId];
    const img = scene.add.image(0, size * 0.42, `tower.${v.kind}.2`).setOrigin(0.5, 1);
    img.setScale((size * 0.95) / Math.max(img.width, img.height)).setTint(v.tint);
    c.add(img);
  } else if (a.slot === 'hero') {
    const h = HEROES[HERO_ITEMS[a.itemId]];
    const img = scene.add.sprite(0, size * 0.45, `${h.art}.idle`, 0).setOrigin(0.5, 1);
    img.setScale((size * 1.05) / img.height); // wide frames: the knight stands in the middle
    c.add(img);
  } else if (a.slot === 'spell') {
    makeSpellIcons(scene);
    const img = scene.add.image(0, 0, `ui.awi.${SPELL_ITEMS[a.itemId]}`);
    img.setScale((size * 0.85) / img.width);
    c.add(img);
  } else {
    const g = scene.add.graphics(), r = size * 0.36, col = CRYSTAL_COLOR[a.itemId] ?? 0xffffff;
    g.fillStyle(col, 1).fillPoints([{ x: 0, y: -r * 1.2 }, { x: r * 0.8, y: -r * 0.2 }, { x: 0, y: r * 1.1 }, { x: -r * 0.8, y: -r * 0.2 }], true);
    g.fillStyle(0xffffff, 0.45).fillPoints([{ x: 0, y: -r * 1.2 }, { x: r * 0.8, y: -r * 0.2 }, { x: 0, y: -r * 0.1 }], true);
    g.lineStyle(3, 0x1a100a, 1).strokePoints([{ x: 0, y: -r * 1.2 }, { x: r * 0.8, y: -r * 0.2 }, { x: 0, y: r * 1.1 }, { x: -r * 0.8, y: -r * 0.2 }], true);
    c.add(g);
  }
  return c;
}

/** A card: rarity frame, picture, name. */
function card(scene: Phaser.Scene, a: AWI, w: number, h: number, picked = false): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const col = a.slot === 'crystal' ? CRYSTAL_COLOR[a.itemId] : a.slot === 'spell' ? AWI_SPELLS[SPELL_ITEMS[a.itemId]].color : RARITY_COLOR[a.rarity];
  const g = scene.add.graphics();
  g.fillStyle(0x1a100a, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 14);
  g.fillStyle(picked ? 0x4a6a2a : 0x5a3a22, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.lineStyle(4, col, 1).strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 10);
  c.add(g);
  const icon = awiIcon(scene, a, h * 0.56);
  icon.setY(-h * 0.1);
  c.add(icon);
  c.add(label(scene, 0, h / 2 - 34, a.slot === 'crystal' ? `${a.name}` : a.name, Math.round(h * 0.1), '#ffffff').setWordWrapWidth(w - 12).setAlign('center'));
  c.add(label(scene, 0, h / 2 - 14, awiStat(a), Math.round(h * (a.slot === 'spell' ? 0.075 : 0.085)), hex(col)));
  if (a.count > 1) c.add(label(scene, w / 2 - 20, -h / 2 + 18, `×${a.count}`, 20, '#ffdd66'));
  c.setSize(w, h);
  return c;
}

export class AwiScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private dom?: Phaser.GameObjects.DOMElement;
  private status?: Phaser.GameObjects.Text;
  private busy = false;
  private info = '';

  constructor() { super('Awi'); }

  /** `code`: from the ?userCode= deep link, connect right away. `page`: open a page directly. */
  create(data: { code?: string; page?: Page; crystals?: number }): void {
    centreCamera(this);
    wideBackground(this, 'bg.menu');
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W + BLEED * 2, GAME_H + BLEED * 2, 0x000000, 0.45);
    this.layer = this.add.container(0, 0);
    this.busy = false; this.info = '';
    const code = data?.code;
    if (data) delete data.code; // a restart without new data must not log straight back in
    if (code) { this.show('connect'); this.field(code); this.run(() => connect(code)); return; }
    this.show(data?.page ?? (profile() ? 'loadout' : 'connect'), data?.crystals ?? 0);
  }

  private show(page: Page, crystals = 0): void {
    this.dom?.destroy(); this.dom = undefined;
    this.layer.removeAll(true);
    if (page === 'connect') this.connectPage(); else if (page === 'reveal') this.revealPage(crystals); else this.loadoutPage();
  }

  // ── Connect ───────────────────────────────────────────────────────────────────────────────────────

  private connectPage(): void {
    const cx = GAME_W / 2;
    this.layer.add(panel(this, cx, 352, 900, 560, 0.95));
    this.layer.add(label(this, cx, 112, 'Connect TheoSwap', 46, '#ffcc33'));
    this.layer.add(label(this, cx, 158, 'Your NFTs become AWIs (Altered World Items): towers, knights and crystals.', 22, '#fff4d0'));
    this.layer.add(label(this, cx, 214, 'Enter the player code from your TheoSwap profile', 22, '#e8d8b8'));
    this.field('');
    this.layer.add(button(this, cx + 190, 270, 'Connect', () => this.submit(), 170, 60, 0x4a8a2a));
    this.status = label(this, cx, 326, '', 20, '#ffb0a0').setWordWrapWidth(820).setAlign('center');
    this.layer.add(this.status);
    this.layer.add(label(this, cx, 384, 'No NFTs handy? Try a demo player:', 22, '#e8d8b8'));
    (Object.keys(DEMO_PROFILES) as DemoId[]).forEach((id, i) => {
      const x = cx + (i - 1) * 280, d = DEMO_PROFILES[id];
      this.layer.add(button(this, x, 446, d.name, () => this.run(async () => connectDemo(id)), 240, 60, 0x2a4a7a));
      this.layer.add(label(this, x, 500, d.blurb, 17, '#c8d8f0').setWordWrapWidth(240).setAlign('center'));
    });
    this.layer.add(label(this, cx, 584, 'Guests can play everything. AWIs add looks and small sidegrades.', 18, '#b8a888'));
    this.layer.add(imageButton(this, 70, GAME_H - 66, 'gui.btn.back', () => { sfx.tap(); this.leave(); }, 0.8));
  }

  /** The code box: a real <input> so phones get their keyboard. */
  private field(value: string): void {
    this.dom?.destroy();
    this.dom = this.add.dom(GAME_W / 2 - 90, 270).createFromHTML(
      '<input type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="16" placeholder="PLAYER CODE" ' +
      'style="width:330px;height:60px;box-sizing:border-box;padding:0 16px;font:700 28px system-ui,sans-serif;letter-spacing:3px;' +
      'text-transform:uppercase;color:#fff4d0;background:#2a1a10;border:3px solid #c87a2a;border-radius:10px;outline:none;user-select:text;-webkit-user-select:text">');
    const input = this.dom.node.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); });
  }

  private submit(): void {
    const input = this.dom?.node.querySelector('input') as HTMLInputElement | undefined;
    const code = normalizeCode(input?.value ?? '');
    if (code.length < 4) { this.status?.setColor('#ffb0a0').setText('Enter the code from your TheoSwap profile.'); sfx.deny(); return; }
    sfx.tap();
    this.run(() => connect(code));
  }

  private run(task: () => Promise<{ profile: Profile; crystals: number }>): void {
    if (this.busy) return;
    this.busy = true;
    this.status?.setColor('#c8d8f0').setText('Connecting to TheoSwap…');
    task().then(
      (r) => { this.busy = false; (this.dom?.node.querySelector('input') as HTMLInputElement | null)?.blur(); this.show('reveal', r.crystals); },
      (e: unknown) => { this.busy = false; sfx.deny(); this.status?.setColor('#ffb0a0').setText(e instanceof Error ? e.message : 'Something went wrong.'); },
    );
  }

  // ── Reveal: each NFT flips over into its AWI ───────────────────────────────────────────────────────

  private revealPage(crystals: number): void {
    const p = profile()!, cx = GAME_W / 2;
    this.layer.add(label(this, cx, 70, p.awis.length ? 'Your AWIs' : 'No AWIs yet', 48, '#ffcc33'));
    this.layer.add(label(this, cx, 116, p.awis.length
      ? `${p.awis.reduce((n, a) => n + a.count, 0)} NFTs from ${p.label}${p.source === 'cache' ? ' (saved copy: no signal)' : ''}`
      : 'None of these NFTs has a Tower Defense item yet. You can still play everything as a guest.', 22, '#fff4d0').setWordWrapWidth(1000).setAlign('center'));
    const list = p.awis.slice(0, 12), per = Math.min(6, Math.max(1, list.length)), w = 176, h = 210;
    list.forEach((a, i) => {
      const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, list.length - row * per);
      const x = cx + (col - (inRow - 1) / 2) * (w + 16), y = 268 + row * (h + 18);
      const back = this.add.image(x, y, 'gui.window').setDisplaySize(w, h);
      const c = card(this, a, w, h).setPosition(x, y).setScale(0, 1);
      this.layer.add([back, c]);
      this.tweens.add({ targets: back, scaleX: 0, delay: 250 + i * 160, duration: 140, onComplete: () => back.destroy() });
      this.tweens.add({ targets: c, scaleX: 1, delay: 390 + i * 160, duration: 160, ease: 'Back.easeOut', onStart: () => (RARITIES.indexOf(a.rarity) >= 2 ? sfx.upgrade() : sfx.card()) });
    });
    if (p.awis.length > list.length) this.layer.add(label(this, cx, 640, `…and ${p.awis.length - list.length} more`, 20, '#e8d8b8'));
    if (crystals) {
      const s = save().crystals;
      this.layer.add(label(this, cx, 628, `+${crystals} crystals paid in · bank ${s.bank} = ${crystalStars(CRYSTALS_PER_STAR)} bonus ★ for upgrades`, 22, '#9ad0ff'));
    }
    this.layer.add(button(this, cx, 682, 'Continue', () => { sfx.tap(); this.show('loadout'); }, 240, 60, 0x4a8a2a));
  }

  // ── Loadout ───────────────────────────────────────────────────────────────────────────────────────

  private loadoutPage(): void {
    const p = profile();
    if (!p) { this.show('connect'); return; }
    const cx = GAME_W / 2, pool = p.awis.filter((a) => a.slot !== 'crystal');
    const picked = p.loadout.map((k) => pool.find((a) => a.key === k)).filter((a): a is AWI => !!a);
    this.layer.add(label(this, cx, 54, 'Loadout', 46, '#ffcc33'));
    this.layer.add(label(this, cx, 96, `Up to ${LOADOUT_SIZE} AWIs come into every level: one knight, one tower per family, two spells.`, 20, '#fff4d0'));

    // The five slots
    for (let i = 0; i < LOADOUT_SIZE; i++) {
      const x = cx + (i - 2) * 150, y = 196, a = picked[i];
      if (!a) {
        const g = this.add.graphics();
        g.lineStyle(3, 0xc8a070, 0.7).strokeRoundedRect(x - 64, y - 76, 128, 152, 12);
        this.layer.add([g, label(this, x, y, 'Empty', 22, '#b8a888')]);
        continue;
      }
      const c = card(this, a, 128, 152, true).setPosition(x, y);
      c.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(a));
      this.layer.add(c);
    }

    // Everything they own
    this.layer.add(label(this, cx, 304, pool.length ? 'Tap an AWI to add or remove it' : 'No AWIs to equip.', 20, '#e8d8b8'));
    pool.slice(0, 16).forEach((a, i) => {
      const per = 8, row = Math.floor(i / per), col = i % per;
      const x = cx + (col - 3.5) * 132, y = 392 + row * 148;
      const on = p.loadout.includes(a.key);
      const c = card(this, a, 120, 136, on).setPosition(x, y);
      if (!on && cantAdd(picked, a)) c.setAlpha(0.5);
      c.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(a));
      this.layer.add(c);
    });

    this.layer.add(label(this, cx, 612, this.info || 'Knights replace Sir Aldric. AWI towers replace their family\'s tower, same upgrades.', 20, '#fff4d0').setWordWrapWidth(1000).setAlign('center'));
    const s = save().crystals;
    this.layer.add(label(this, 30, 678, `${p.label}${p.source === 'cache' ? ' · saved copy' : ''}${s.bank ? ` · crystals ${s.bank} (${crystalStars(CRYSTALS_PER_STAR)} ★)` : ''}`, 20, '#c8d8f0').setOrigin(0, 0.5));
    this.layer.add(button(this, GAME_W - 360, 672, 'Disconnect', () => { sfx.tap(); saveProfile(null); this.show('connect'); }, 200, 52, 0x7a2a1a));
    this.layer.add(button(this, GAME_W - 130, 672, 'Done', () => { sfx.tap(); this.leave(); }, 180, 60, 0x4a8a2a));
  }

  private toggle(a: AWI): void {
    const p = profile()!, pool = p.awis;
    if (p.loadout.includes(a.key)) {
      p.loadout = p.loadout.filter((k) => k !== a.key);
      sfx.tap(); this.info = `${awiTitle(a)}: ${perkText(a)}`;
    } else {
      const picked = p.loadout.map((k) => pool.find((x) => x.key === k)).filter((x): x is AWI => !!x);
      const why = cantAdd(picked, a);
      if (why) { sfx.deny(); this.info = why; } else { p.loadout.push(a.key); sfx.upgrade(); this.info = `${awiTitle(a)}: ${perkText(a)}`; }
    }
    saveProfile(p);
    this.show('loadout');
  }

  private leave(): void { this.scene.start('Menu', { page: 'title' }); }
}
