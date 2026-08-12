// The stage has no build step and no package.json, so node reads a `.js` file
// as CommonJS and refuses to import one of the site's ES modules directly. A
// `data:` URL is always parsed as an ES module, so loading the source through
// one gives real import semantics — no regex munging of the file, and no
// markers in the source that a rename can silently break.
//
// This only works for a module that imports nothing itself, which is exactly
// why js/play/harmony.js is written that way.
import { readFileSync } from 'node:fs';

export function loadModule(url) {
  const source = readFileSync(url, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
