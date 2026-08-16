#!/usr/bin/env node
// Minifies the JavaScript inside a staged copy of the site, in place.
//
// The repo has no build step on purpose — what is checked in is what a
// developer serves over `python3 -m http.server`, and the layering rules in
// AGENTS.md are readable because the shipped files are the authored ones. That
// stays true: this only ever runs over the deploy staging directory (`_site`),
// never over the working tree, and it changes bytes rather than structure.
// One file in, the same file out at the same path, with the same imports and
// the same `?v=` stamps — so every site-absolute path, the import map, and the
// hand-bumped cache stamps keep meaning exactly what they meant.
//
//   node tools/minify.mjs _site/js _site/vendor
//
// esbuild is fetched by `npx` at the pinned version below rather than being a
// dependency, because adding a package.json to the root would give the repo a
// node_modules and an install step it otherwise does not need.

import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ESBUILD = 'esbuild@0.28.2';

/** Every `.js` file under `dir`, recursively, as absolute paths. */
async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await collect(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) found.push(full);
  }
  return found;
}

const bytes = async (file) => (await stat(file)).size;

// esbuild refuses to overwrite its own inputs, so each root is minified into a
// scratch directory and moved back over the originals only once the whole root
// succeeded. A failure therefore leaves the staged site untouched rather than
// half-minified.
async function minifyRoot(root) {
  const files = await collect(root);
  if (files.length === 0) throw new Error(`no .js files under ${root}`);

  const before = (await Promise.all(files.map(bytes))).reduce((a, b) => a + b, 0);
  const out = await mkdtemp(path.join(tmpdir(), 'av2-minify-'));

  try {
    const result = spawnSync('npx', [
      '--yes', ESBUILD,
      ...files,
      '--minify',
      // Every file the site ships is an ES module (module `<script>` tags, the
      // import map, or an import from one of those). Saying so lets esbuild
      // rename top-level bindings instead of treating them as globals.
      '--format=esm',
      // Keeps the vendored Three.js licence headers, which minification would
      // otherwise strip off MIT-licensed code we redistribute.
      '--legal-comments=eof',
      `--outbase=${root}`,
      `--outdir=${out}`,
      '--log-level=warning',
    ], { stdio: ['ignore', 'inherit', 'inherit'] });

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`esbuild exited ${result.status} for ${root}`);

    let after = 0;
    for (const file of files) {
      const staged = path.join(out, path.relative(root, file));
      // A missing or empty output is the failure mode that would otherwise ship
      // a blank module and take the stage down with a silent `undefined`.
      const size = await stat(staged).then((s) => s.size).catch(() => 0);
      if (size === 0) throw new Error(`esbuild produced nothing for ${file}`);
      after += size;
      await mkdir(path.dirname(file), { recursive: true });
      await rename(staged, file);
    }

    const saved = Math.round((1 - after / before) * 100);
    const kb = (n) => `${Math.round(n / 1024)} KB`;
    console.log(`${root}: ${files.length} files, ${kb(before)} → ${kb(after)} (−${saved}%)`);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error('usage: node tools/minify.mjs <dir>...');
  process.exit(1);
}
for (const root of roots) await minifyRoot(root);
