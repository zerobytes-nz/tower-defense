#!/usr/bin/env node
// Build the game and rsync dist/ to the web server.
//   npm run deploy:check   → build, then show what would change (rsync --dry-run)
//   npm run deploy         → build, then upload for real
// The target comes from DEPLOY_TARGET (environment or .env, which is gitignored), e.g.
//   DEPLOY_TARGET=user@host:/var/www/games.example.com/tower-defense/
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/assets.mjs';

const dry = process.argv.includes('--dry-run');

/** A value from .env.production (wins, like Vite's build) or .env. */
function fromDotEnv(name) {
  for (const file of ['.env.production', '.env']) {
    const f = path.join(ROOT, file);
    if (!fs.existsSync(f)) continue;
    const line = fs.readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`));
    const v = line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
    if (v) return v;
  }
  return '';
}

let target = process.env.DEPLOY_TARGET || fromDotEnv('DEPLOY_TARGET');
if (!/^[^\s:]+:\/\S+$/.test(target)) {
  console.error('✘ Set DEPLOY_TARGET in .env, e.g. DEPLOY_TARGET=user@host:/var/www/games.example.com/tower-defense/');
  process.exit(1);
}
if (!target.endsWith('/')) target += '/';

const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Home-screen icons drawn from the kit art (gitignored; the build ships them in place of the committed ones).
run('npm', ['run', 'pwa:icons:licensed']);
run('npm', ['run', 'build']);

// Never upload an API key: the game only talks to its own server's proxy (./api/user-items), which adds the key.
const key = process.env.THEOSWAP_API_KEY || fromDotEnv('THEOSWAP_API_KEY');
if (key.length >= 8) {
  const js = fs.readdirSync(path.join(ROOT, 'dist/assets')).filter((f) => f.endsWith('.js'));
  const leak = js.find((f) => fs.readFileSync(path.join(ROOT, 'dist/assets', f), 'utf8').includes(key));
  if (leak) { console.error(`\n✘ dist/assets/${leak} contains the API key. Not uploading.`); process.exit(1); }
}
console.log('✔ No API key in the build: it reaches TheoSwap through the proxy.');
// dist/ with the trailing slash = upload the folder's contents. --delete removes files the new build no longer has.
run('rsync', ['-avz', '--delete', ...(dry ? ['--dry-run'] : []), 'dist/', target]);
console.log(dry ? '\n✔ Dry run only: nothing was uploaded. Run `npm run deploy` to upload.' : `\n✔ Deployed to ${target}`);
