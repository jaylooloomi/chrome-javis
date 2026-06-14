// esbuild bundler for the Snapfill extension.
//
// Produces a loadable MV3 extension in dist/:
//   - service-worker.js, sidepanel.js, options.js  (ESM)
//   - content.js                                   (IIFE, injected as a classic
//                                                    content script)
//   - copied static assets: manifest.json, *.html, *.css, images/

import { build, context } from 'esbuild';
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const watch = process.argv.includes('--watch');
const r = (p) => resolve(root, p);

const common = {
  bundle: true,
  target: 'chrome127',
  sourcemap: true,
  logLevel: 'info',
  outdir: dist,
};

// ESM entry points (service worker module + extension pages).
const esmOptions = {
  ...common,
  format: 'esm',
  entryPoints: {
    'service-worker': r('src/background/service-worker.js'),
    sidepanel: r('src/ui/sidepanel/sidepanel.js'),
    options: r('src/ui/options/options.js'),
  },
};

// Content script must be a classic script (IIFE) for static injection.
const contentOptions = {
  ...common,
  format: 'iife',
  entryPoints: { content: r('src/content/content.js') },
};

const staticAssets = [
  ['manifest.json', 'manifest.json'],
  ['src/ui/sidepanel/sidepanel.html', 'sidepanel.html'],
  ['src/ui/sidepanel/sidepanel.css', 'sidepanel.css'],
  ['src/ui/options/options.html', 'options.html'],
];

function copyStatic() {
  for (const [from, to] of staticAssets) {
    if (existsSync(r(from))) cpSync(r(from), resolve(dist, to));
  }
  if (existsSync(r('images'))) cpSync(r('images'), resolve(dist, 'images'), { recursive: true });
}

async function run() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  if (watch) {
    const ctxs = await Promise.all([context(esmOptions), context(contentOptions)]);
    await Promise.all(ctxs.map((c) => c.watch()));
    copyStatic();
    console.log('[build] watching… (static assets copied once)');
  } else {
    await Promise.all([build(esmOptions), build(contentOptions)]);
    copyStatic();
    console.log(`[build] done -> ${dist}`);
  }
}

run().catch((err) => {
  console.error('[build] failed:', err);
  process.exit(1);
});
