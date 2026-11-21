# Tower Defense

A landscape tower defense game for the phone browser (Phaser 3 + TypeScript + Vite), and TheoSwap game 5
(https://games.theoswap.io/tower_defense/). Build towers on the pads beside the road, upgrade them, and stop the
waves. Players' NFTs become **AWIs (Altered World Items)**: towers, heroes and spells (milestone 4).
See [PLAN.md](PLAN.md) for the design and milestones.

The same NFTs are hero skins in [Altered Run](https://github.com/zerobytes-nz/altered-run) and unit cards in
[Altered Arena](https://github.com/zerobytes-nz/altered-arena).

```bash
npm install      # also installs the pre-commit hook
npm run dev      # http://localhost:5183
npm run build    # static site in dist/
npm run sim      # balance check: the bot plays every level, no browser
```

URL switches: `?bot` the bot plays · `?seed=N` same fight · `?debug` FPS meter and the enemy path.

Controls: tap the skull to send the first wave (or the next one early, for bonus gold). Tap a pad, pick a tower,
tap it again to build. Tap a tower to upgrade or sell it (tap the button twice). ×2 speeds up, ❚❚ pauses.

Screens: phones in landscape (portrait asks to turn the phone; Android goes full screen at the first level), tablets
and desktop browsers. The game is laid out on 1280×720 and fills any shape of screen; on small screens the HUD
buttons are drawn larger (`uiBoost` in `src/systems/wide.ts`).

## Art: read [ASSETS.md](ASSETS.md)

A fresh clone runs on **original placeholder art** (MIT, `public/assets/placeholder/`). The real art is the CraftPix
**Tower Defense 2D Game Kit**, which may **not** be redistributed, so **no kit images are in this repo**. With your
own copy of the kit, unzipped outside the repo:

```bash
npm run assets:import -- "/path/to/craftpix-net-519305-tower-defense-2d-game-kit"
npm run assets:status
```

The import only reads the kit and writes packed sheets to `public/assets/licensed/` (gitignored).
`npm run check-assets` (pre-commit hook and CI) fails if a licensed file or a key is ever staged.

## Code map

| Path | What |
|---|---|
| `src/game/` | Rules, pure TypeScript (no Phaser): `sim.ts` (the battle, seeded, 60 Hz), `towers.ts` (tiers and tier-4 branches), `enemies.ts`, `heroes.ts` (hero and spells), `perks.ts` (upgrade tree), `levels.ts`, `maps.ts` (roads and pads), `bot.ts`. `npm run sim` runs these in Node. |
| `src/scenes/` | Boot, Menu (title and level select), Game (draws the battle and handles taps, hero orders, spells). |
| `src/save.ts`, `src/systems/audio.ts` | Local save (stars, perks, seen enemies, sound) and synthesized sound effects. |
| `src/assets.ts` | Loads art by manifest key; `assets.manifest.json` is the list of every file. |
| `src/theoswap.ts`, `src/profile.ts`, `src/deeplink.ts` | TheoSwap connection (wired in in milestone 4). |
| `scripts/` | Asset rails (import, placeholders, docs, checks), PWA icons, deploy, sim. |

## TheoSwap and the API key

The browser only calls `./api/user-items?userCode=…` on its own server. In development Vite forwards it to TheoSwap
and adds `THEOSWAP_API_KEY` from `.env` (copy `.env.example`; use the **test** key). In production nginx adds the key.
`check-assets` rejects key-like `VITE_*` names, any key use in `src/`, and hard-coded key values. `npm run deploy`
refuses to upload a build that contains the key.

TheoSwap's website setting for the game is `https://games.theoswap.io/tower_defense/?userCode=$USER_CODE`; the game
reads the code once and ignores an unfilled `$USER_CODE`.

## Deploy

Same method as the other games (rsync `dist/` to the server, nginx proxy for the API). Not set up yet: it happens in
milestone 5, after the current files on the server are backed up.

```bash
npm run deploy:check   # build, then list what rsync would change (uploads nothing)
npm run deploy         # build, then rsync dist/ to DEPLOY_TARGET (from .env)
```

## Licence

Code and placeholder art: MIT (see [LICENSE](LICENSE)). The CraftPix art is not included and keeps its own licence.
The font Passion One is SIL OFL 1.1.
