// esbuild bundler for the Javis extension.
//
// Bundles the extension's entry points (service worker, side panel, content
// script) from src/ into dist/. Entry points are added as each phase lands
// them; only entries that exist on disk are built, so `npm run build` is safe
// to run at any point during the rebuild.

import { build, context } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

// Planned entry points. Each is built only once its source file exists.
const candidateEntries = {
  'service-worker': 'src/background/service-worker.js',
  sidepanel: 'src/ui/sidepanel/sidepanel.js',
  content: 'src/content/content.js',
  options: 'src/ui/options/options.js',
};

const entryPoints = Object.fromEntries(
  Object.entries(candidateEntries).filter(([, file]) => existsSync(resolve(root, file))),
);

const options = {
  entryPoints,
  bundle: true,
  format: 'esm',
  target: 'chrome127',
  outdir: resolve(root, 'dist'),
  sourcemap: true,
  logLevel: 'info',
};

if (Object.keys(entryPoints).length === 0) {
  console.log('[build] no entry points present yet — nothing to bundle.');
  process.exit(0);
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[build] watching for changes…');
} else {
  await build(options);
  console.log('[build] done.');
}
