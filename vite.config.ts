import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import { resolveAssets, loadManifest, PUBLIC_DIR, MANIFEST_FILE } from './scripts/lib/assets.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * `virtual:asset-urls` → { [manifest key]: url }. Picks licensed/ → cc0/ → placeholder/,
 * the first file that exists with the size the manifest expects (see resolveAssets). Decided at dev/build
 * time, so a fresh clone makes zero requests for missing licensed files.
 */
function assetUrls(): Plugin {
  const ID = 'virtual:asset-urls', RID = '\0' + ID;
  return {
    name: 'alley-asset-urls',
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      const m = loadManifest();
      const urls: Record<string, string> = {};
      for (const r of resolveAssets(m)) {
        for (const [f, c] of [[r.licensedFile, r.licensed], [r.cc0File, r.cc0]] as const) {
          if (c.exists && !c.sizeOk) this.warn(`${f} is ${c.size?.width}×${c.size?.height}, expected ${r.asset.width}×${r.asset.height}: skipped`);
        }
        if (r.cc0.exists && !r.cc0Allowed) this.warn(`${r.cc0File} is ignored: source "${r.asset.source}" is not marked cc0 in the manifest`);
        urls[r.asset.key] = r.url;
      }
      return `export default ${JSON.stringify(urls)};`;
    },
    configureServer(server) {
      const m = loadManifest();
      const dir = path.join(PUBLIC_DIR, m.roots.licensed);
      server.watcher.add([dir, path.join(PUBLIC_DIR, m.roots.cc0), path.join(PUBLIC_DIR, m.roots.placeholder), 'assets.manifest.json']);
      const refresh = (file: string) => {
        if (!file.startsWith(PUBLIC_DIR + path.sep + 'assets') && !file.endsWith('assets.manifest.json')) return;
        // Invalidate the virtual module AND the manifest JSON that src/assets.ts imports:
        // otherwise a manifest edit (e.g. a new frame size) can be served stale until a restart.
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        for (const m of server.moduleGraph.getModulesByFile(MANIFEST_FILE) ?? []) server.moduleGraph.invalidateModule(m);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
      server.watcher.on('change', refresh);
    },
  };
}

/**
 * Build only: writes dist/sw.js, a small service worker that precaches the app shell, the PWA icons and
 * every art file the build resolved (about 8 MB with the kit art), so the game plays offline after the first visit.
 * The cache name changes whenever code or art changes; old caches are deleted on activate.
 * Requests to other origins (the TheoSwap API) are never touched.
 * When the kit art is imported, the icons drawn from it (`npm run pwa:icons:licensed`) replace public/icons/ in dist/.
 */
const ICON_FILES = fs.readdirSync(path.join(PUBLIC_DIR, 'icons'));
const LICENSED_ICONS = path.join(PUBLIC_DIR, loadManifest().roots.licensed, 'pwa-icons');
/** Where each shipped icon comes from: the licensed one when it was generated, else the committed one. */
const iconSource = (f: string) => (fs.existsSync(path.join(LICENSED_ICONS, f)) ? path.join(LICENSED_ICONS, f) : path.join(PUBLIC_DIR, 'icons', f));

/** Dev: serve the kit-art icons (when generated) at /icons/, the same ones a build ships. */
function devIcons(): Plugin {
  return {
    name: 'tower-defense-dev-icons',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const f = req.url?.split('?')[0].match(/\/icons\/([\w.-]+\.png)$/)?.[1];
        if (!f || !ICON_FILES.includes(f) || !fs.existsSync(path.join(LICENSED_ICONS, f))) return next();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(path.join(LICENSED_ICONS, f)).pipe(res);
      });
    },
  };
}

function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'tower-defense-sw',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    writeBundle() {
      for (const f of ICON_FILES) fs.copyFileSync(iconSource(f), path.join(outDir, 'icons', f));
      fs.rmSync(path.join(outDir, loadManifest().roots.licensed, 'pwa-icons'), { recursive: true, force: true });
    },
    generateBundle(_opts, bundle) {
      const code = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f) && f !== 'sw.js');
      const icons = [...ICON_FILES.map((f) => `icons/${f}`), 'fonts/PassionOne-Regular.ttf'];
      const art = resolveAssets(loadManifest()).filter((r) => r.state !== 'missing').map((r) => r.url);
      const files = ['./', 'manifest.webmanifest', ...icons, ...code, ...art];
      const h = createHash('sha256').update(SW_TEMPLATE);
      for (const f of code) { const o = bundle[f]; h.update(f).update(o.type === 'chunk' ? o.code : String(o.source)); }
      for (const f of [...icons, ...art]) h.update(f).update(fs.readFileSync(f.startsWith('icons/') ? iconSource(f.slice(6)) : path.join(PUBLIC_DIR, f)));
      const version = h.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: SW_TEMPLATE.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)) });
    },
  };
}

const SW_TEMPLATE = `// Generated by vite.config.ts (serviceWorker plugin). Do not edit.
const CACHE = 'tower-defense-__VERSION__';
const FILES = __FILES__;
const scoped = (f) => new URL(f, self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map(scoped))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tower-defense-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Player lookups (the TheoSwap proxy) are never cached here: the game keeps its own per-code cache.
  if (url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    // Page loads: network first (fresh deploys win), the cached shell when offline. ?userCode= is kept by the page itself.
    e.respondWith(fetch(req).catch(() => caches.match(scoped('./'), { ignoreVary: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`;

/**
 * Stand-in for the nginx proxy so `npm run dev` / `npm run preview` behave like the live site:
 * /api/user-items?userCode=… → TheoSwap /api/public/user-items with THEOSWAP_API_KEY from .env added here,
 * in Node. The name has no VITE_ prefix, so Vite never puts it in the browser bundle. Keep it the TEST key locally.
 */
function localProxy(mode: string): Record<string, ProxyOptions> {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.THEOSWAP_URL || 'https://www.theoswap.io';
  return {
    '/api/user-items': {
      target, changeOrigin: true,
      rewrite: (p) => {
        const q = new URLSearchParams(p.split('?')[1] ?? '');
        return `/api/public/user-items?${new URLSearchParams({ apiKey: env.THEOSWAP_API_KEY ?? '', userCode: q.get('userCode') ?? '' })}`;
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [assetUrls(), devIcons(), serviceWorker()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { port: 5183, strictPort: true, proxy: localProxy(mode) },
  preview: { proxy: localProxy(mode) },
}));
