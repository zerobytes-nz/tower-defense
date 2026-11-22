# Tower Defense: plan

TheoSwap game 5 (code `of8EB6RG`), replacing the old Fiverr build at https://games.theoswap.io/tower_defense/.
A classic path tower defense for phones (landscape 1280×720): build towers on pads along a road and stop the enemy
waves. The same NFTs that are hero skins in Altered Run and unit cards in Altered Arena become **AWIs (Altered World
Items)** here: towers, heroes and spells.

Art: the CraftPix *Tower Defense 2D Game Kit* (never committed; see ASSETS.md), plus the CraftPix knight and wizard
packs that Altered Arena already uses (heroes and soldiers). Sound: our own Web Audio synth (no sound files).

## What makes it fun (review, 2026-11-22)

Milestone 1 plays, but it is a "place and watch" game. Classic TD games stay fun through decisions during the fight
and variety between fights. The plan now leans on these:

1. **Hands on the battlefield.** A **hero** you tap-to-move, who blocks and fights on the road and has an ability
   button. **Barracks** soldiers block the road too, so enemies stop and fight (the kit monsters all have attack
   animations). Blocking + ranged fire is the core fun of the genre, and it makes every pad matter more.
   (Support tower becomes the Barracks; the War Camp aura moves to a tier-4 branch.)
2. **Spells with cooldowns**, cast by dragging onto the road: two for everyone (Meteor, Reinforcements), and
   AWI spells in the loadout. Something to do between builds.
3. **Real choices per tower:** tier 4 splits into two branches, each with a signature trick (Longbow crits / Crossbow
   armour pierce; Fire Pot burning ground / Spiked Boulder stun; Storm chain lightning / Frost slow; War Drums aura /
   Paladins that heal).
4. **Enemies that ask questions:** armoured (needs magic), magic-resistant (needs physical), flyers (no catapults,
   no blocking), runners, healers, shield walls, splitters, and bosses with two phases. Each new enemy gets an
   intro card the first time it appears, so players learn the counters.
5. **Each world plays differently:** Greenwood (the basics), Sunscorch (two entrances), Frostfall (icy road: enemies
   speed up; frozen pads), The Deadlands (the fallen rise as skeletons unless magic or fire finishes them). Maps with two paths force split defences.
6. **Juice:** coins fly to the counter, kill popups, boss intro and slow-motion finish, screen shake on leaks, sounds
   for every shot and hit (moved forward from milestone 4: sound is half of how a TD game feels).
7. **Reasons to replay:** 3 stars per level (lives), a **Heroic** challenge per level (one tower type banned / one
   life), **Endless** on cleared maps with a best-wave record, and a star-paid **upgrade tree** (the kit's upgrade
   screen) so failed runs still move you forward.
8. **AWIs that feel special but stay fair:** an AWI tower is a named variant with its own look (tint, aura, particles)
   and one perk that is a sidegrade, with rarity giving a capped stat bonus. Guests can clear everything; AWIs make it
   faster, flashier and give 3 stars more easily.

## Milestones

1. **Core loop** ✅ (2026-11-22)
   Repo rails (licensed / placeholder split, manifest → ASSETS.md, check-assets hook + CI, PWA, MIT, `.env.example`,
   TheoSwap proxy client, `?userCode=` deep link), kit import script, Mill Meadow map with traced path and pads,
   4 towers × 3 tiers, 6 enemies, 10 waves, gold/lives/stars, call-wave-early bonus, ×2 speed, pause, win/lose,
   `npm run sim` + `?bot`.
2. **Depth** ✅ (2026-11-22)
   Hero Sir Aldric (tap him or his portrait, then the road; blocks, levels up to 5 in the fight, Shield Slam) and
   Barracks soldiers with a movable rally flag; melee (enemies stop and fight blockers, flyers pass over). Tier-4
   branches, two per tower (Longbow / Crossbow, Firepot / Spiked, Storm / Frost, Paladins / War Drums). Spells:
   Meteor Shower + Reinforcements on cooldowns. New-enemy cards. Synth sound effects with an on/off switch.
   World 1: Mill Meadow, Jungle Camp (two roads), Old Ruins (the road splits; the Old Treant boss roots towers).
   Title screen, level select with stars and locks, pause (sound, restart, map), win/lose with Next. Local save.
   Bot (`npm run sim`): wins all three levels, ★ 3.0 / 2.6 / 1.9. Moved to M3: the between-level upgrade tree
   and the kit's GUI art for the screens (M2 uses the shared wooden panels).
3. **Campaign** ✅
   - ✅ Part 1 (2026-11-22): upgrade tree (24 perks in 6 columns, bought top-down with stars, Reset refunds;
     `src/game/perks.ts` → the sim's `Mods`), kit GUI on the title, level select, upgrade, pause and win/lose screens.
     The whole tree makes World 1 easy even for a build-only player; Worlds 2–4 are balanced assuming some perks.
   - ✅ Part 2 (2026-11-22): World 2 Sunscorch (two entrances: Sunbaked Oasis, Bone Canyon, Ember Pass with the
     Stone Golem, who summons Dust Mites) and World 3 Frostfall (icy roads speed ground enemies up, snowed-in pads
     open at a set wave: Frozen Pass, Crystal Lake, Twilight Moor with the Yeti, who freezes towers). New enemies:
     Bone Knight (shield that soaks physical damage; magic goes through), Sand Polyp (splits into 3 Dust Mites),
     Wraith, Ice Ape, Ice Troll. Level select pages per world. Per-level `hp` tuned so the bot (no perks) wins all
     nine: ★ 3.0/2.7/1.8 · 2.8/1.8/2.1 · 1.9/1.8/1.4; with the whole tree, 3★ everywhere.
     Phone and desktop pass: HUD, speed/pause, wave and action buttons grow ×1.15–1.3 when the screen shows the game
     below 80 % size (about 48 px on a 667×375 phone); backgrounds mirror on all four sides (tall windows, tablets);
     full screen + landscape lock on Android at the first level start; portrait phones get "Turn your phone sideways".
     Checked at 667×375, 375×812, 768×1024, 1024×768 and 1366×768.
   - ✅ Part 3 (2026-11-22): World 4 The Deadlands (an enemy killed by physical damage may rise as a skeleton;
     magic and fire put it down for good): Molten Gate (two entrances), Hollow Woods, Witch Bog (the road splits
     round the hanging tree) with the Skull Knight, who puts bone shields on itself and everything near it. New
     enemies: Ash Reaver (armour + shield), Bog Ghoul (heals itself unless burning), Risen Skeleton.
     Heroic on every cleared level: 5 lives, upgrades give no extra lives, one tower type banned (rotates; never
     Archers where there are flyers), +1 ★ the first time. Endless on every cleared level: the waves loop, each loop
     30 % bigger, faster and ×1.15 health; best wave saved and shown on the level card. A cleared level asks
     Normal / Heroic / Endless. Bot: World 4 ★ 2.5 / 2.4 / 1.4; Heroic with the whole tree wins 11 of 12 levels every
     time (Witch Bog about 40 %); Endless with the whole tree reaches wave 40–60.

4. **AWIs**
   New configs for Free (default) and Theo Swap, drafted and shown as a dry run before anything changes: Towers
   (2 named variants per family), Heroes (Silver / Bronze / Black Knight, Arcane / Fire Wizard), Spells (8), Crystals
   (3, paid out once per NFT). Loadout of up to 5 AWIs (the listing's inventory size). Connect screen with code and
   deep link, NFT reveal, demo profiles (Guest / Collector / Whale) and test items.
   - ✅ Part 1 (2026-11-22): connect (code, deep link, demo players), NFT reveal, loadout screen, AWI towers (8, two
     per family, rarity +0–15 % damage) and knights (Sir Aldric, Dame Brona, The Black Knight), crystals paid once
     per NFT into a bank (200 = a bonus star). Wizards dropped for now (no art in the kit's style).
   - ✅ Part 2 (2026-11-22): the 8 AWI spells, using the original items' ids and attributes, so each NFT's rolled
     numbers count (capped; missing values fall back to defaults). Up to 2 ride along as extra spell buttons:
     Armor Break (area takes +X % damage), Troop Rally (all towers +X % damage and speed), Fire (one enemy burns),
     Acid Rain (burning patch of road), Slow (whole map), Drop Rock (blocks the road until smashed), Freeze (slowing,
     hurting patch), Lightning Strike (one enemy, flyers too). Icons drawn in code. Bot, mid rolls, one spell each:
     +0.2–0.5 ★ on the harder levels, no runaway.
     TheoSwap: draft configs **21** "Free AWIs (2026)" (Common–Epic) and **22** "Theo Swap AWIs (2026)" (Rare–
     Legendary), not published, not default; live configs 11 / 12 untouched. Test codes (5 NFTs each, the game's
     inventory size), saved: EEEEEEEE (config 21), FFFFFFFF and GGGGGGGG (config 22). AAAAAAAA–DDDDDDDD hold old
     config-11 spells and crystals (which still work).
5. **Polish and launch**
   Daily challenge, achievements (kit screen), balance sim per world, real-phone FPS. With the user's OK at each step:
   Jira epic, deploy over `/tower_defense/` (no backup: the old Fiverr build is being retired, user's call
   2026-11-22), nginx proxy with the new live API key, publish the configs and set the default, TheoSwap icon /
   banner / item images. (GitHub repo + CI: done in M2.)
   **TheoSwap state (2026-11-22, done by the user and with their OK):** old configs 11 / 12 deleted; 21 renamed
   **Free** (published, public, default) and 22 renamed **Theo Swap** (published, private). Item images (rendered
   from the game, 256×256) saved on all 22 items of both. The test key works and the test codes return the new
   items: EEEEEEEE exactly as saved; FFFFFFFF / GGGGGGGG get Free-config rolls, because a private config only
   applies to NFTs from the collections assigned to it (test tokens have none).
   **Still blocking real players:** no NFT collection is assigned to either config. Needs the exact contract
   address(es) and chain from the user, then `assign_contract` (dry run first). Theo Swap (22) only takes effect
   for its assigned collections.

## Art still wanted

Art review (2026-11-22): almost all the code-drawn art now has kit or pack art.
- The kit's own `magic-effects-game-sprite` and `td-gui/interface_game/ico_1–8` match the 8 AWI spells one to one:
  buttons, plus an effect each (fireball, falling rocks, acid rain, lightning, ice patch, slow swirl, sword buff,
  cracking shield). Meteor Shower uses the fireball and burning ground; crystals use `td-gui/shop/crystal_1–3`.
- Heroes: CraftPix *Knight Characters* (silver / bronze / black), with a round portrait button each.
- Barracks soldiers and militia: CraftPix *Tactical Strategy Game Kit* human warriors 2 and 1 (mirrored to face
  right; no death animation, so they play their hurt frames and fade).
- Still code-drawn (`source: own`): the gold coin, the rally flag and the boss roots: no pack had better ones.
- TheoSwap item images for configs 21 / 22: the new tower and knight items have none yet (upload on the Developer
  page or with `upload_config_image`); the spells and crystals reuse the old item ids, so the old images can be copied.

## Notes

- The old game is unbundled source on the server; its client code contained a live API key. The user is rolling a
  new key; the new game never ships one (check-assets and deploy both refuse).
- `tower-defence.pdf` (the old brief) is out of date and is not used.
