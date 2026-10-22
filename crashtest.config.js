// crashtest.config.js - freestruct's crashtest run root (dogfood).
//
// Drives the freestruct-docs-shapes pack (packs/public/) against the
// freestruct-BUILT docs tree. The real component under attack is our own
// generated output; the transport is an in-process double (labs/
// static-site-target.js) modeling the GitHub Pages class of static host.
//
// Run:
//   npx crashtest run                     (from the freestruct repo root;
//                                          SITE_ROOT defaults to docs/_site)
//   SITE_ROOT=/tmp/fx/_site npx crashtest run --config crashtest.config.js
//
// This config never feeds crashtest's committed demo ledger - that baseline
// is crashtest's own dogfood, not ours (their labs/, their rules).
//
// In CI the docs workflow runs this AFTER the freestruct strict step, so the
// Pages build's tree is what gets attacked (see .github/workflows/docs.yml).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { makeSiteHandler } from './labs/static-site-target.js';

const SITE_ROOT = process.env.SITE_ROOT ?? 'docs/_site';
if (!existsSync(SITE_ROOT)) {
  throw new Error(
    `crashtest.config.js: SITE_ROOT "${SITE_ROOT}" does not exist - build the docs tree first (Jekyll + \`node bin/freestruct.mjs\`), or point SITE_ROOT at a built tree`,
  );
}

export default {
  baseUrl: 'https://docs.creadev.org',
  routes: {
    // One route bucket for the static host; all attacks issue URLs at it.
    site: makeSiteHandler(SITE_ROOT),
  },
  // Adopt OUR pack surface (absolute path - the run root may load from any cwd).
  packs: [join(fileURLToPath(new URL('.', import.meta.url)), 'packs')],
  seed: 0xC0FFEE,
};
