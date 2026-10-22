#!/usr/bin/env node
// scripts/packs-selftest.cjs - teeth-proof for packs/public/freestruct-docs-shapes.
//
// Two temp trees, one pack, no lies:
//   HARDENED - a real freestruct build (bin/freestruct.mjs on a 3-page
//              fixture) attacked through the honest static-host double
//              (labs/static-site-target.js): every pack attack must answer
//              REFUSED.
//   VULNERABLE - the same tree deliberately regressed four ways:
//                (1) 404.html loses its noindex meta (issue #11 regression),
//                (2) sitemap.xml re-lists the noindex page (issue #5 leak),
//                (3) sitemap.xml carries a raw unescaped & (issue #9 class),
//                (4) the host double drops containment - traversal shapes
//                    escape the tree (package.json / .env content leaks).
//
// The pack must hold the hardened tree (zero EXPLOITED) and trip every
// planted regression on the vulnerable tree. Deterministic: same fixture,
// same seed, zero sockets. Needs a dhaupin/crashtest checkout (the loader is
// crashtest's own); test/run.js pins the pack's static shape repo-wide.
//
//   node scripts/packs-selftest.cjs
//   CRASHTEST_BIN=/path/to/crashtest/bin/crashtest.js node scripts/packs-selftest.cjs

const { cp, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { existsSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname } = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const ROOT = join(dirname(__filename), '..');
// A relative CRASHTEST_BIN (e.g. CI's node_modules/crashtest/bin/crashtest.js)
// must be resolved against the CALLING cwd now - the campaigns later spawn
// with temp-dir cwds, and a relative path would mysteriously vanish.
const CRASHTEST_BINS = [
  process.env.CRASHTEST_BIN && requires()
    ? join(process.cwd(), process.env.CRASHTEST_BIN)
    : process.env.CRASHTEST_BIN,
  '/home/daytona/crashtest/bin/crashtest.js',
].filter(Boolean);

/** existsSync re-reading never says why a bin was rejected; resolve once. */
function requires() {
  return existsSync(join(process.cwd(), process.env.CRASHTEST_BIN));
}

const FIXTURE = {
  config: 'site:\n  name: Fixture Docs\n  url: https://docs.creadev.org\nog:\n  image: /og.png\ntwitter:\n  username: freestructdoc\n',
  pages: {
    'index.html': '<html><head><title>Fixture Docs - Home</title><meta name="description" content="home"></head><body><h1>Home</h1><p>Fresh fixture for the freestruct pack selftest.</p></body></html>',
    'guides.html': '<html><head><title>Guides &amp; Walkthroughs: the deep dive</title><meta name="description" content="guides"></head><body><h1>Guides</h1><p>Everything about guides &amp; walkthroughs <a href="/guides.html">here</a>.</p></body></html>',
    'maintainer.html': '<html><head><title>Maintainer area</title><meta name="robots" content="noindex, nofollow"></head><body><h1>Maintainer</h1><p>Private maintainer notes.</p></body></html>',
  },
};

// TEMP negative-control run root: the containment DROPS voluntarily.
// Same resolution truth as labs/static-site-target.js minus the '..'
// refusal - the classic static-host regression the traversal attack is
// aimed at. Lives in the temp dir only; never committed.
function slippyConfig(siteRootHref) {
  return `// packs-selftest negative-control target (generated, temp)
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
const TYPES = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
async function resolveLoose(root, pathname) {
  const cand = [pathname.slice(1), pathname.slice(1) + '/index.html', pathname.slice(1) + '.html', 'index.html'];
  for (const c of cand) {
    try {
      return new Response(await readFile(join(root, c)), { status: 200, headers: { 'content-type': TYPES[extname(c)] ?? 'text/plain; charset=utf-8' } });
    } catch { /* next */ }
  }
  let err = '';
  try { err = await readFile(join(root, '404.html'), 'utf8'); } catch {}
  return new Response(err || 'Not Found', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
export default {
  baseUrl: 'https://docs.creadev.org',
  routes: {
    site: async ({ request }) => {
      let p;
      try { p = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('bad request', { status: 400 }); }
      return resolveLoose(process.env.SITE_ROOT, p);
    },
  },
  packs: [${JSON.stringify(join(ROOT, 'packs'))}],
  seed: 0xC0FFEE,
};
`;
}

function hardenedConfig() {
  return `// packs-selftest hardened target (generated, temp)
import { makeSiteHandler } from '${pathToFileURL(join(ROOT, 'labs', 'static-site-target.js')).href}';
export default {
  baseUrl: 'https://docs.creadev.org',
  routes: { site: makeSiteHandler(process.env.SITE_ROOT) },
  packs: [${JSON.stringify(join(ROOT, 'packs'))}],
  seed: 0xC0FFEE,
};
`;
}

/** Stage the fixture docs + run the REAL engine on it. Returns {base, site}. */
async function buildHardenedTree() {
  const base = await mkdtemp(join(tmpdir(), 'freestruct-ct-'));
  await mkdir(join(base, 'docs', '_site'), { recursive: true });
  await writeFile(join(base, 'docs', 'freestruct.config.yml'), FIXTURE.config);
  for (const [name, body] of Object.entries(FIXTURE.pages)) {
    await writeFile(join(base, 'docs', '_site', name), body);
  }
  execFileSync('node', [join(ROOT, 'bin', 'freestruct.mjs')], { cwd: base, stdio: 'pipe' });
  return { base, site: join(base, 'docs', '_site') };
}

/** Copy the hardened build and regress it: the four planted findings. */
async function buildVulnerableTree(hardened) {
  const base = await mkdtemp(join(tmpdir(), 'freestruct-ct-vuln-'));
  await cp(hardened.base, base, { recursive: true });
  const site = join(base, 'docs', '_site');
  const SITE = 'https://docs.creadev.org';
  // (1) the generated 404 ships no noindex
  const nf404 = (await readFile(join(site, '404.html'), 'utf8')).replace(/\bnoindex\b/gi, 'dofollow-broken-contract');
  await writeFile(join(site, '404.html'), nf404);
  // (2)+(3) sitemap re-lists the noindex page, with a raw unescaped &
  const sitemap = await readFile(join(site, 'sitemap.xml'), 'utf8');
  await writeFile(site + '/sitemap.xml', sitemap.replace('</urlset>', `  <url><loc>${SITE}/maintainer.html?c=1&z=raw</loc></url>\n</urlset>`));
  // (2b) feed lists the noindex page too
  const feed = await readFile(join(site, 'feed.xml'), 'utf8');
  await writeFile(join(site, 'feed.xml'), feed.replace('</channel>', `  <item><title>maintainer</title><link>${SITE}/maintainer.html</link></item>\n</channel>`));
  // (2c) the tree ships no search.json here (opt-in) - plant a leaking one
  await writeFile(join(site, 'search.json'), JSON.stringify([{ title: 'maintainer', url: `${SITE}/maintainer.html`, content: 'private notes' }]));
  // (4) escape targets OUTSIDE the tree, where travelsals land
  await writeFile(join(base, 'docs', '.env'), 'FIXTURE_API_KEY=leaky-seed-value\n');
  await writeFile(join(base, 'package.json'), '{"name":"fixture-vault","version":"1.0.0"}\n');
  return { base, site };
}

/** Run one crashtest campaign; return only OUR module's findings. */
function runCampaign(crashBin, cfgPath, siteRoot, cwd) {
  try {
    execFileSync('node', [crashBin, 'run', '--config', 'crashtest.config.js'], {
      cwd,
      env: { ...process.env, SITE_ROOT: siteRoot },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // A nonzero exit on the VULNERABLE target is crashtest's design
    // (EXPLOITED rows fail the run); the ledger is written either way.
    // A missing ledger means the failure is not that - rethrow.
    if (!existsSync(join(cwd, 'labs', 'crashledger.json'))) throw err;
    if (!siteRoot.includes('vuln') && !/refuse/i.test(String(err.stderr))) {
      // Hardened campaigns must exit clean; anything else is real failure.
      throw err;
    }
  }
  return JSON.parse(readFileSync(join(cwd, 'labs', 'crashledger.json'), 'utf8'))
    .findings
    .filter((f) => f.id.startsWith('freestruct-docs-shapes/'));
}

let failed = false;
const check = (name, ok, got) => {
  if (ok) console.error(`ok   ${name}`);
  else { console.error(`FAIL ${name} - got: ${got}`); failed = true; }
};

async function main() {
  const crashBin = CRASHTEST_BINS.find((p) => p && existsSync(p));
  if (!crashBin) {
    console.error('packs-selftest: no dhaupin/crashtest checkout found (set CRASHTEST_BIN)');
    process.exit(2);
  }

  // --- HARDENED: real build, honest double - everything must hold ---
  const hardened = await buildHardenedTree();
  const hCfg = join(hardened.base, 'crashtest.config.js');
  await writeFile(hCfg, hardenedConfig());
  const hRows = runCampaign(crashBin, 'crashtest.config.js', hardened.site, hardened.base);

  check('hardened: 5 pack attacks ran', hRows.length === 5, `${hRows.length} rows`);
  check('hardened: every pack attack REFUSED', hRows.every((r) => r.verdict === 'REFUSED'),
    JSON.stringify(hRows.filter((r) => r.verdict !== 'REFUSED')));

  // --- VULNERABLE: regressed tree + loose host - every planted finding trips ---
  const vuln = await buildVulnerableTree(hardened);
  const vCfg = join(vuln.base, 'crashtest.config.js');
  await writeFile(vCfg, slippyConfig());
  const vRows = runCampaign(crashBin, 'crashtest.config.js', vuln.site, vuln.base);
  // Ledger rows key attacks by id ("module/attack"), not a separate field.
  const vExp = new Set(vRows.filter((r) => r.verdict === 'EXPLOITED').map((r) => r.id.split('/')[1]));

  for (const attack of ['hostile-traversal-404', 'gen404-noindex-canary', 'noindex-artifact-leak', 'sitemap-xml-shape-canary']) {
    check(`vulnerable trips: ${attack}`, vExp.has(attack), [...vExp].join(','));
  }

  if (!process.env.KEEP_TEMP) {
    await rm(hardened.base, { force: true, recursive: true });
    await rm(vuln.base, { force: true, recursive: true });
  } else {
    console.error(`kept: ${hardened.base} / ${vuln.base}`);
  }
  if (failed) process.exit(1);
  console.error('packs-selftest: teeth proven (hardened tree holds; every planted regression trips)');
}

main().catch((err) => {
  console.error(`packs-selftest: ${err.message}`);
  process.exit(1);
});
