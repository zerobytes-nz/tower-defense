// Balance check: the bot plays every level with many seeds and prints win rate, lives left and stars.
//   npm run sim
//   npm run sim -- --seeds 200
//   npm run sim -- --passive     no hero and no spells: a player who only builds
// Node runs the game's own TypeScript (src/game/) directly (type stripping, Node ≥ 22.18).
import { Battle } from '../src/game/sim.ts';
import { think } from '../src/game/bot.ts';
import { LEVELS } from '../src/game/levels.ts';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const seeds = arg('--seeds', 40);
/** --passive: no hero, no spells (a player who only builds). */
const passive = process.argv.includes('--passive');

console.log(`Bot results over ${seeds} seeds\n`);
console.log('Level'.padEnd(16), 'win%'.padStart(5), 'lives'.padStart(6), '★avg'.padStart(5), 'wave(lost)'.padStart(11), 'time'.padStart(6));
for (const level of LEVELS) {
  let wins = 0, lives = 0, stars = 0, lostAt = 0, time = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const b = new Battle({ level, seed, hero: passive ? null : undefined });
    let k = 0;
    while ((b.state === 'ready' || b.state === 'playing') && b.time < 1200) { if (k++ % 30 === 0) think(b, { spells: !passive }); b.step(); b.events.length = 0; }
    if (b.state === 'won') { wins++; lives += b.lives; stars += b.stars; } else lostAt += b.wave + 1;
    time += b.time;
  }
  const losses = seeds - wins;
  console.log(level.name.padEnd(16), String(Math.round((wins / seeds) * 100)).padStart(5), (wins ? (lives / wins).toFixed(1) : '-').padStart(6),
    (wins ? (stars / wins).toFixed(1) : '-').padStart(5), (losses ? (lostAt / losses).toFixed(1) : '-').padStart(11), `${Math.round(time / seeds)}s`.padStart(6));
}
