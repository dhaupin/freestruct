#!/usr/bin/env node
/**
 * Tarball e2e: install-and-run the REAL packaged artifact the way a fresh
 * machine experiences it (PRD 4.1 step 5; prestruct's e2e caught bugs that
 * repo-shape runs cannot see - npm-pack disk state, bin shim, node_modules
 * leakage, template fallback resolution).
 *
 * What it does (all local; npm's own registry cache supplies js-yaml):
 *   1. `npm pack` the current tree into a temp dir
 *   2. create a throwaway project; `npm install ./freestruct-<ver>.tgz`
 *   3. scaffold the README quick-start shape (minimal docs/_site + config)
 *   4. run the installed bin; assert exit 0 + the full artifact set +
 *      injected markers (canonical/og/build hash) on a real page
 *   5. assert the config-fatal exit-code shapes still hold in-package
 *      (exit 1 config fatal, --tolerant downgrade)
 *
 * Exit 0 = proven; anything else fails loudly with evidence inline.
 * Run: node scripts/e2e-install.cjs
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'freestruct-e2e-'));
const failures = [];
const log = (s) => console.log('[e2e] ' + s);
const die = (msg) => { console.error('[e2e] FAIL: ' + msg); process.exit(1); };

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { status: res.status, out: (res.stdout || '') + (res.stderr || '') };
}

try {
  // 1. Pack the real artifact (never a dry run: morphology is the point).
  const packed = run('npm', ['pack', '--pack-destination', TMP], { cwd: ROOT });
  const tarball = path.join(TMP, `freestruct-${pkg.version}.tgz`);
  if (!fs.existsSync(tarball)) die(`npm pack produced no ${path.basename(tarball)}\n${packed.out}`);
  log('packed ' + path.basename(tarball));

  // 2. Fresh project installs the tarball from disk.
  const proj = path.join(TMP, 'fresh-site');
  fs.mkdirSync(proj);
  fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ name: 'fresh-site', version: '1.0.0', private: true }));
  const inst = run('npm', ['install', tarball, '--no-audit', '--no-fund'], { cwd: proj });
  const bin = path.join(proj, 'node_modules', '.bin', 'freestruct');
  if (!fs.existsSync(bin)) die(`bin shim missing after install\n${inst.out}`);
  log('installed from tarball; bin shim present');

  // 3. README quick-start shape: config + a two-page SSG output tree.
  const siteDir = path.join(proj, 'docs', '_site', 'guide');
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(proj, 'docs', 'freestruct.config.yml'),
    'site:\n  name: Fresh Site\n  url: https://example.com/docs\n  description: e2e fixture\n');
  fs.writeFileSync(path.join(proj, 'docs', '_site', 'index.html'),
    '<html><head><title>Home</title></head><body><a href="/guide/">Guide</a></body></html>\n');
  fs.writeFileSync(path.join(siteDir, 'index.html'),
    '<html><head><title>Guide</title></head><body><a href="../index.html">Home</a></body></html>\n');

  // 4. Run as a consumer would (npx resolves the local bin), assert the tree.
  const ver = run('npx', ['freestruct', '--version'], { cwd: proj });
  if (ver.status !== 0 || !ver.out.includes(pkg.version)) {
    failures.push(`--version: expected exit 0 + ${pkg.version}, got ${ver.status} / ${ver.out.trim()}`);
  }
  const main = run('npx', ['freestruct'], { cwd: proj });
  if (main.status !== 0) failures.push(`default run exit ${main.status}:\n${main.out}`);
  for (const artifact of ['sitemap.xml', 'robots.txt', 'feed.xml', '404.html']) {
    if (!fs.existsSync(path.join(proj, 'docs', '_site', artifact))) failures.push(`missing artifact: ${artifact}`);
  }
  const injected = fs.readFileSync(path.join(proj, 'docs', '_site', 'index.html'), 'utf8');
  if (!injected.includes('rel="canonical"')) failures.push('canonical not injected');
  if (!injected.includes('name="freestruct-build"')) failures.push('freestruct-build marker missing');
  if (main.status === 0 && !/[Ll]ink check/.test(main.out)) failures.push('link check report absent');
  log('default run: artifacts + injection verified');

  // 5. In-package exit-code shapes (PRD Phase 2 contract on the real install).
  fs.writeFileSync(path.join(proj, 'docs', 'freestruct.config.yml'), 'site: {}\n');
  const fatal = run('npx', ['freestruct'], { cwd: proj });
  if (fatal.status !== 1) failures.push(`config fatal expected exit 1, got ${fatal.status}`);
  const tol = run('npx', ['freestruct', '--tolerant'], { cwd: proj });
  if (tol.status !== 0) failures.push(`--tolerant expected exit 0, got ${tol.status}`);
  log('exit-code shapes hold on the installed package');
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}

if (failures.length) {
  console.error('\ntarball e2e FAILED - ' + failures.length + ' finding(s):');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\ntarball e2e: fresh-install quick start proven');
