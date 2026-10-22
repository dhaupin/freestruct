// freestruct regression battery - Phase 1 (PRD labs/prd-freestruct.md)
//
// Runs the ESM engine orchestrator (engine/inject.js via bin/freestruct.mjs)
// against committed fixture
// sites and pins observable behavior. Phase 0 warts FIXED in Phase 1 have
// their pins flipped consciously, each noted here:
//   - noindex honored by default (issue #5, owner decision)
//   - XML escaping + per-page <lastmod> (issue #9)
//   - RSS per-page pubDate instead of one build stamp (issue #9)
//   - 404 pipeline: generated + custom get full SEO + noindex (issue #11)
//   - plain <meta name="description"> reaches bare pages (0.4.x wart)
//   - root page slug is '/' not '/index' (pageUrl precedence bug)
//   - search URLs come from the scan slug (end of the /no mangling)

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import yaml from 'js-yaml';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const INJECT = path.join(ROOT, 'engine', 'inject.js');
const FIXTURES = path.join(ROOT, 'test', 'fixtures');

const NODE_OK = parseInt(process.versions.node, 10) >= 20;
if (!NODE_OK) {
  console.error(`[freestruct battery] Node >= 20 required, running ${process.versions.node}`);
  process.exit(1);
}

// ---------- helpers ----------

assert.includes = (haystack, needle, msg) => {
  assert.ok(String(haystack).includes(needle), msg || `expected output to include: ${needle}`);
};

let tmpSeq = 0;
// scenario('main', { 'path/rel.conf': 'content' }) -> fresh tmp copy of the fixture
function scenario(name, files = {}) {
  const dir = path.join(os.tmpdir(), `freestruct-battery-${process.pid}-${++tmpSeq}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* tmp best-effort */ }
}

// Run the injector in a scenario dir. Default assumption is exit 0, silent stderr.
function runInject(dir, args = []) {
  const res = spawnSync(process.execPath, [INJECT, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(
    res.status, 0,
    `inject.js exited ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`
  );
  assert.ok(res.stderr.trim() === '', 'inject.js must not write to stderr on success');
  return res.stdout;
}

// Run the injector expecting a nonzero exit; returns {status, stdout, stderr}.
// opts.env (optional) is merged over the process env for staged-only pins.
function runInjectFailing(dir, args = [], env = {}) {
  const res = spawnSync(process.execPath, [INJECT, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.notStrictEqual(res.status, 0, 'expected nonzero exit, got 0');
  return res;
}

// Read a file relative to a dir; '.' resolves to the battery repo root.
function read(dir, rel) {
  const base = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  return fs.readFileSync(path.join(base, rel), 'utf8');
}

const sitemapLocs = sitemapText => [...sitemapText.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
const feedPubDates = feedText => [...feedText.matchAll(/<pubDate>([^<]*)<\/pubDate>/g)].map(m => m[1]);

// ---------- packaging self-checks ----------

test('bin shim has a shebang so npx freestruct works (issue #2)', () => {
  const first = fs.readFileSync(INJECT, 'utf8').split('\n')[0];
  assert.match(first, /^#!.*node/);
});

test('package.json is ESM, node >= 20, and ships the house structure (bin + engine + init, prestruct pattern)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  assert.strictEqual(pkg.type, 'module', 'Phase 1 runtime decision: ESM');
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.match(pkg.engines.node, /^>=20/);
  assert.ok(pkg.files.includes('bin/'), 'bin/ ships (thin CLI entry)');
  assert.ok(pkg.files.includes('engine/'), 'engine/ ships (runtime + packaged templates)');
  assert.ok(pkg.files.includes('init/'), 'init/ ships (consumer scaffold kit)');
  assert.ok(pkg.files.every(f => ['bin/', 'engine/', 'init/', '!init/node_modules', '!init/dist'].includes(f)),
    'files whitelist is the prestruct-shaped house structure');
  assert.strictEqual(pkg.bin.freestruct, 'bin/freestruct.mjs', 'bin entry is the thin shim');
  assert.strictEqual(pkg.main, 'engine/inject.js', 'main points at the engine');
});

// ---------- version truth (issue #7) ----------

test('README, package.json and CHANGELOG agree on one version (frozen 0.6.0 pin)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  const readme = read('.', 'README.md');
  const changelog = read('.', 'CHANGELOG.md');
  const readmeVer = (readme.match(/^## v(\d+\.\d+\.\d+)\s*$/m) || [])[1];
  const changeVer = (changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
  assert.ok(readmeVer, 'README must carry a "## vX.Y.Z" version heading');
  assert.ok(changeVer, 'CHANGELOG must open with a "## [X.Y.Z]" version entry');
  assert.strictEqual(readmeVer, pkg.version, 'README version heading must equal package.json version');
  assert.strictEqual(changeVer, pkg.version, 'CHANGELOG top entry must equal package.json version');
  // Owner call (labs/TASKS.md VERSION POLICY): the number is frozen on 0.6.0,
  // so the pin enforces exactly 0.6.0 everywhere until the owner unfreezes.
  assert.strictEqual(pkg.version, '0.6.0', 'version frozen at 0.6.0 by owner call - see the VERSION POLICY in labs/TASKS.md first');
});

test('README quickstart YAML example actually parses (issue #8)', () => {
  const readme = read('.', 'README.md');
  const block = (readme.match(/```yaml\n([\s\S]*?)```/) || [])[1];
  assert.ok(block, 'README must include one ```yaml config example');
  const parsed = yaml.load(block);
  assert.ok(parsed && parsed.site, 'README YAML example must parse and contain a site section');
  assert.ok(parsed.site.name && parsed.site.url, 'site.name and site.url present');
});

// ---------- CI workflow truth (pass 11: unquoted 'cd:' in a step name made
// docs.yml unparseable and silently killed the Pages verifier for two pushes) ----------

test('.github/workflows/*.yml are all parseable YAML (a dead SSG gate must never come from an unparsable workflow)', () => {
  const wfDir = path.join(ROOT, '.github', 'workflows');
  const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));
  assert.ok(files.length >= 3, `workflows present (${files.join(', ')})`);
  for (const f of files) {
    let parsed;
    try {
      parsed = yaml.load(fs.readFileSync(path.join(wfDir, f), 'utf8'));
    } catch (e) {
      assert.fail(`${f} is not valid YAML: ${e.message}`);
    }
    assert.ok(parsed && typeof parsed === 'object' && ('jobs' in parsed), `${f} parses to a jobs-bearing workflow`);
  }
});

// ---------- crashtest pack surface (packs/, the one-surface extension model) ----------

test('packs/ surface: a README ships, every public pack.json is schemaVersion 1, and each entry satisfies the scenario contract (name/description/attacks)', async () => {
  const packsDir = path.join(ROOT, 'packs');
  assert.ok(fs.existsSync(path.join(packsDir, 'README.md')), 'packs/README.md exists (what crashtest is, what packs are, links, pack list)');
  const pub = path.join(packsDir, 'public');
  const packs = fs.readdirSync(pub).filter((d) => fs.statSync(path.join(pub, d)).isDirectory() && fs.existsSync(path.join(pub, d, 'pack.json')));
  assert.ok(packs.includes('freestruct-docs-shapes'), 'the freestruct-docs-shapes pack ships');
  for (const pack of packs) {
    const dir = path.join(pub, pack);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'));
    } catch (e) {
      assert.fail(`${pack}/pack.json is unreadable JSON: ${e.message}`);
    }
    assert.strictEqual(manifest.schemaVersion, 1, `${pack}: schemaVersion 1`);
    assert.match(manifest.name, /^[a-z0-9][a-z0-9-]*$/, `${pack}: kebab-case manifest name`);
    assert.strictEqual(manifest.name, pack, `${pack}: manifest name matches its directory`);
    assert.ok(typeof manifest.description === 'string' && manifest.description.length > 0, `${pack}: one-line description present`);
    const entry = path.join(dir, manifest.entry ?? 'index.js');
    assert.ok(fs.existsSync(entry), `${pack}: entry ${manifest.entry ?? 'index.js'} exists in the pack dir`);
    // The scenario module contract (crashtest src/scenarios/contract.js shape,
    // self-checked here so the pin runs without a crashtest checkout):
    const mod = (await import(pathToFileURL(entry).href)).default;
    assert.ok(mod && typeof mod === 'object', `${pack}: entry default-exports an object`);
    assert.strictEqual(mod.name, pack, `${pack}: module name matches the manifest name`);
    assert.ok(typeof mod.description === 'string' && mod.description.length > 0, `${pack}: module description present`);
    assert.ok(Array.isArray(mod.attacks) && mod.attacks.length > 0, `${pack}: non-empty attacks array`);
    const seen = new Set();
    for (const a of mod.attacks) {
      assert.match(a.name, /^[a-z][a-z0-9-]*$/, `${pack}: attack name kebab-case (${a.name})`);
      assert.ok(!seen.has(a.name), `${pack}: unique attack name (${a.name})`);
      seen.add(a.name);
      assert.strictEqual(typeof a.run, 'function', `${pack}: attack ${a.name} has run(harness, ctx)`);
    }
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'packs-selftest.cjs')), 'the teeth-proof script ships too (hardened holds / regressed trips)');
});

// ---------- main fixture run: defaults ON ----------

test('default run: exit 0, stdout talks, build hash coherent across meta + assets', () => {
  const dir = scenario('main');
  try {
    const out = runInject(dir);
    assert.match(out, /Found \d+ HTML files/);
    assert.match(out, /freestruct: Done \(([0-9a-f]{8})\)/);

    const html = read(dir, 'docs/_site/index.html');
    const buildHash = (html.match(/<meta name="freestruct-build" content="([0-9a-f]{8})">/) || [])[1];
    assert.ok(buildHash, 'page carries the freestruct-build hash meta');
    assert.match(buildHash, /^[0-9a-f]{8}$/);

    // cache-busting: assets get ?v= with the SAME hash as the meta tag
    assert.includes(html, `/css/site.css?v=${buildHash}`, 'css asset busted with the build hash');
    assert.includes(html, `/js/app.js?v=${buildHash}`, 'js asset busted with the build hash');

    // no stacked query params
    assert.ok(!/[?&]v=[0-9a-f]{8}\?v=/i.test(html), 'existing ?v= params stripped, not stacked');

    // `<title>` is NOT rewritten by injection (pin current behavior)
    assert.includes(html, '<title>Home</title>');

    // every non-404 page carries the build tag + freestruct marker
    for (const rel of ['index.html', 'guide/index.html', 'noindex.html', 'existing-seo.html', 'check-me.html', 'a&b.html']) {
      const h = read(dir, `docs/_site/${rel}`);
      assert.ok(h.includes(`<meta name="freestruct-build" content="${buildHash}">`), rel + ' carries build tag');
      assert.ok(h.includes('<!-- freestruct -->'), rel + ' carries freestruct marker');
    }
  } finally { rmDir(dir); }
});

test('default run: full SEO pipeline on a bare page (slug fixed to /)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');

    // FIXED in Phase 1 (was the pageUrl precedence wart): root index is '/'
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/">');
    assert.includes(html, '<meta property="og:title" content="Home | Foo Docs">');
    assert.includes(html, '<meta property="og:url" content="https://docs.example.com/">');
    // FIXED: plain description meta now reaches bare pages (0.4.x dropped it)
    assert.includes(html, '<meta name="description" content="A test docs site">');
    assert.includes(html, '<meta property="og:image" content="https://docs.example.com/og.png">');
    assert.includes(html, '<meta property="og:locale" content="en_US">');
    assert.includes(html, '<meta name="twitter:card" content="summary_large_image">');
    assert.includes(html, '<meta name="twitter:site" content="@foos">');
    assert.strictEqual((html.match(/application\/ld\+json/g) || []).length, 2);

    // subdirectory page -> /guide/ slug; description from page meta wins
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.includes(guide, '<link rel="canonical" href="https://docs.example.com/guide/">');
    assert.includes(guide, '<meta property="og:title" content="Guide | Foo Docs">');
    assert.includes(guide, '<meta property="og:description" content="A deep dive guide page.">');
    // missing-only: the guide page already had a description -> exactly one meta
    assert.strictEqual((guide.match(/name="description"/g) || []).length, 1);

    // ampersand page: canonical keeps the raw & in the html attribute (fine in HTML)
    const ab = read(dir, 'docs/_site/a&b.html');
    assert.includes(ab, '<link rel="canonical" href="https://docs.example.com/a&b">');
  } finally { rmDir(dir); }
});

test('default run: missing-only gate leaves pages that already ship SEO untouched', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/existing-seo.html');

    assert.strictEqual((html.match(/property="og:title"/gi) || []).length, 1, 'exactly one og:title (no duplicate injection)');
    assert.strictEqual((html.match(/name="twitter:card"/gi) || []).length, 1, 'exactly one twitter:card');
    assert.strictEqual((html.match(/application\/ld\+json/g) || []).length, 1, 'existing JSON-LD preserved, template blocks not added');
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/existing">', 'existing canonical preserved verbatim');
    assert.strictEqual((html.match(/name="description"/g) || []).length, 1, 'own description kept, nothing injected');

    assert.match(html, /<meta name="freestruct-build" content="[0-9a-f]{8}">/);
  } finally { rmDir(dir); }
});

test('default run: idempotent - a second pass does not duplicate anything', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.strictEqual((html.match(/property="og:title"/gi) || []).length, 1);
    assert.strictEqual((html.match(/<meta name="freestruct-build"/g) || []).length, 1);
    assert.strictEqual((html.match(/rel="canonical"/g) || []).length, 1);
    assert.strictEqual((html.match(/application\/ld\+json/g) || []).length, 2);
    assert.strictEqual((html.match(/name="description"/g) || []).length, 1);
  } finally { rmDir(dir); }
});

test('default run: custom snippets get comments stripped + placeholders substituted (FIXED issue #10)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    // FIXED: placeholders in snippets are now substituted with real values
    assert.includes(html, '<link rel="stylesheet" href="https://docs.example.com/inject-header.css">',
      'header snippet {{siteUrl}} substituted');
    assert.match(html, /<meta name="build-tag" content="[0-9a-f]{8}">/, 'snippet {{buildHash}} substituted');
    assert.ok(!html.includes('This comment must be stripped'), 'snippet comments removed');
    assert.ok(!html.includes('{{siteUrl}}'), 'no raw placeholders survive');
  } finally { rmDir(dir); }
});

test('default run: reading-time, last-modified and lazy-loading metas land on pages', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.match(html, /<meta name="reading-time" content="\d+ min read">/);
    assert.match(html, /<meta name="last-modified" content="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // asset busting runs before lazy-load, so the img picks up its ?v= first
    assert.match(html, /<img src="\/img\/hero.png\?v=[0-9a-f]{8}" alt="hero" loading="lazy">/);
    assert.match(html, /<img src="\/img\/banner.png\?v=[0-9a-f]{8}" alt="banner" loading="eager">/);
  } finally { rmDir(dir); }
});

// ---------- artifacts ----------

test('sitemap.xml: escaped URLs, per-page lastmod, noindex pages excluded (FIXED #5/#9)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.includes(sitemap, '<?xml version="1.0"');
    assert.includes(sitemap, 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    const locs = sitemapLocs(sitemap);
    // noindex.html is now honored-by-default and excluded (was a 0.4.x wart)
    assert.strictEqual(locs.length, 5, 'five pages: index, guide, existing-seo, check-me, a&b');
    assert.includes(sitemap, '<loc>https://docs.example.com/guide/</loc>');
    // FIXED: root index is '/'
    assert.includes(sitemap, '<loc>https://docs.example.com/</loc>');
    // FIXED: raw ampersand is escaped (&amp;)
    assert.includes(sitemap, '<loc>https://docs.example.com/a&amp;b</loc>');
    assert.ok(!locs.some(l => l.includes('noindex')), 'noindex page excluded from sitemap');
    assert.ok(!locs.some(l => l.includes('404')), 'the 404 page is excluded');

    // FIXED (issue #9): real <lastmod> entries per url
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map(m => m[1]);
    assert.strictEqual(lastmods.length, 5, 'every url carries a lastmod');
    for (const lm of lastmods) assert.match(lm, /^\d{4}-\d{2}-\d{2}$/, 'W3C date format');
    assert.includes(sitemap, '<changefreq>weekly</changefreq>');
  } finally { rmDir(dir); }
});

test('robots.txt: generated with sitemap pointer', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const robots = read(dir, 'docs/_site/robots.txt');
    assert.includes(robots, 'User-agent: *');
    assert.includes(robots, 'Allow: /');
    assert.includes(robots, 'Sitemap: https://docs.example.com/sitemap.xml');
  } finally { rmDir(dir); }
});

test('feed.xml: noindex excluded, escaped titles, honest per-page pubDate (FIXED #5/#9)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const feed = read(dir, 'docs/_site/feed.xml');
    assert.includes(feed, '<rss version="2.0"');
    const items = (feed.match(/<item>/g) || []).length;
    assert.strictEqual(items, 5, 'one item per non-404, non-noindex page');

    // FIXED: escaped ampersand, not raw
    assert.includes(feed, '<title>Peas &amp; Carrots</title>');
    assert.includes(feed, '<link>https://docs.example.com/a&amp;b</link>');
    assert.ok(!feed.includes(' & '), 'XML validity: no naked ampersands anywhere in the feed');

    // FIXED (issue #9): pubDate comes from the page's own mtime, not the build stamp
    const pubDates = feedPubDates(feed);
    assert.ok(pubDates.length >= 5);
    for (const d of pubDates) {
      const parsed = new Date(d);
      assert.ok(!isNaN(parsed.getTime()), 'each pubDate parses as RFC1123 date');
      assert.ok(parsed.getTime() <= Date.now(), 'pubDate is not in the future');
    }
    const lastBuild = (feed.match(/<lastBuildDate>([^<]*)<\/lastBuildDate>/) || [])[1];
    assert.ok(!isNaN(new Date(lastBuild).getTime()), 'channel lastBuildDate parses');
  } finally { rmDir(dir); }
});

test('feed.xml: honest-date pin - pubDate equals the page mtime from BEFORE freestruct ran', () => {
  const dir = scenario('main');
  try {
    // stamp guide/index.html to a distinctive older date before the run;
    // buildPages captures mtime pre-injection, so the feed must carry it
    const guideMtime = new Date('2026-01-02T03:04:05Z');
    fs.utimesSync(path.join(dir, 'docs/_site/guide/index.html'), guideMtime, guideMtime);
    runInject(dir);
    const feed = read(dir, 'docs/_site/feed.xml');
    // split into per-item blocks FIRST, then find the guide item, or the
    // lazy-regex would swallow earlier items' pubDates into one block
    const items = (feed.match(/<item>[\s\S]*?<\/item>/g) || []);
    const guideItem = items.find(b => b.includes('<guid>https://docs.example.com/guide/</guid>'));
    assert.ok(guideItem, 'guide item present');
    const guidePubDate = (guideItem.match(/<pubDate>([^<]*)<\/pubDate>/) || [])[1];
    assert.strictEqual(new Date(guidePubDate).toISOString(), '2026-01-02T03:04:05.000Z',
      'guide item pubDate equals the page mtime from before freestruct ran');
    // the other items still reflect their own (copy-time) mtimes, not the guide's
    const pubDates = feedPubDates(feed).filter(d => d !== guidePubDate);
    assert.ok(pubDates.length >= 4);
    assert.ok(new Set(pubDates).size >= 1);
  } finally { rmDir(dir); }
});

test('search.json: noindex excluded (FIXED #5), slug-based urls, field shape stable', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const idx = JSON.parse(read(dir, 'docs/_site/search.json'));
    assert.strictEqual(idx.length, 5);
    const entry = idx.find(e => e.url === 'https://docs.example.com/guide/');
    assert.ok(entry, 'guide entry present with directory-slash url');
    assert.deepStrictEqual(Object.keys(entry).sort(), ['content', 'description', 'heading', 'title', 'url']);
    assert.strictEqual(entry.description, 'A deep dive guide page.');
    // FIXED: noindex excluded, and no more mangled /no url
    assert.ok(idx.some(e => e.url === 'https://docs.example.com/noindex') === false, 'noindex excluded from search.json');
    assert.ok(idx.some(e => e.url === 'https://docs.example.com/'), 'root page indexed under / (not /index)');
  } finally { rmDir(dir); }
});

// ---------- 404 pipeline (Phase 1.4: full treatment for both kinds) ----------

test('generated 404: full SEO pipeline + advertised noindex now shipped (FIXED #11)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/404.html');
    assert.includes(html, '<title>404');
    assert.includes(html, 'Search docs...');
    assert.match(html, /<meta name="freestruct-build" content="[0-9a-f]{8}">/);
    assert.includes(html, '<meta name="robots" content="noindex, nofollow">',
      'FIXED: the CHANGELOG-claimed noindex is real now');
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/404">');
    // the generated 404's title tag is '404 - Page Not Found | Foo Docs', so
    // the og:title composes from the extracted title, not a literal '404'
    assert.includes(html, '<meta property="og:title" content="404 - Page Not Found | Foo Docs">');

    // 404 stays out of the index artifacts
    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.ok(!sitemap.includes('404'), '404 excluded from sitemap');
    const search = JSON.parse(read(dir, 'docs/_site/search.json'));
    assert.ok(!search.some(e => (e.url || '').includes('404')), '404 excluded from search.json');
    const feed = read(dir, 'docs/_site/feed.xml');
    assert.ok(!feed.includes('404 - Page Not Found'), '404 excluded from feed items');
  } finally { rmDir(dir); }
});

test('custom 404: body preserved + full pipeline + noindex (FIXED #11)', () => {
  const CUSTOM_404 = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>Custom 404 | Foo Docs</title>',
    '</head>',
    '<body>',
    '<h1>Custom 404</h1>',
    '<p>CUSTOM_BODY_MARKER</p>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
  const dir = scenario('main', { 'docs/_site/404.html': CUSTOM_404 });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/404.html');
    assert.includes(html, 'CUSTOM_BODY_MARKER', 'custom body untouched');
    assert.includes(html, '<title>Custom 404 | Foo Docs</title>', 'custom title untouched');
    assert.match(html, /<meta name="freestruct-build" content="[0-9a-f]{8}">/);
    // FIXED: custom 404s get the full SEO treatment now
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/404">');
    assert.includes(html, '<meta name="robots" content="noindex, nofollow">');

    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.ok(!sitemap.includes('404'), 'custom 404 excluded from sitemap');
    const search = JSON.parse(read(dir, 'docs/_site/search.json'));
    assert.ok(!search.some(e => (e.url || '').includes('404')), 'custom 404 excluded from search.json');
  } finally { rmDir(dir); }
});

// ---------- link check: report-only (issue #4 wart) ----------

test('broken internal link: reported in stdout, exit code 0 anyway', () => {
  const dir = scenario('main');
  try {
    const out = runInject(dir); // exit 0 expected - that IS the wart
    assert.includes(out, 'Link check: 1 broken links found');
    assert.includes(out, 'ghost.html');
  } finally { rmDir(dir); }
});

// ---------- strict mode (opt-in; default behavior unchanged) ----------

test('--strict: broken internal links fail the build', () => {
  const dir = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, '--strict'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'strict mode must exit 1 on broken links');
    assert.includes(res.stdout, 'broken internal link');
    // noindex honored by default means no leak problem remains
    assert.ok(!res.stdout.includes('noindex page(s) leak'), 'no leak: noindex excluded from artifacts');
  } finally { rmDir(dir); }
});

test('--strict: passes when there is nothing broken', () => {
  const dir = scenario('main');
  try {
    // remove the broken-link page AND the index anchor pointing at it
    fs.rmSync(path.join(dir, 'docs/_site/check-me.html'));
    const idx = fs.readFileSync(path.join(dir, 'docs/_site/index.html'), 'utf8')
      .replace(/<a href="\/check-me.html">[^<]*<\/a>/, '');
    fs.writeFileSync(path.join(dir, 'docs/_site/index.html'), idx);
    const res = spawnSync(process.execPath, [INJECT, '--strict'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `strict run should pass\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
  } finally { rmDir(dir); }
});

// ---------- feature flags off ----------

test('config disabling every feature: artifacts absent, page passthrough minimal', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'generateSitemap: false',
      'generateFeed: false',
      'generate404: false',
      'generateRobots: false',
      'readingTime: false',
      'lastModified: false',
      'lazyLoad: false',
      'linkCheck: false',
      'searchIndex: false',
      'cacheBusting:',
      '  assetQueryParam: false',
      ''
    ].join('\n')
  });
  try {
    runInject(dir);
    const site = path.join(dir, 'docs/_site');
    for (const artifact of ['sitemap.xml', 'robots.txt', 'feed.xml', 'search.json', '404.html']) {
      assert.ok(!fs.existsSync(path.join(site, artifact)), `${artifact} must not exist`);
    }
    const html = read(dir, 'docs/_site/index.html');
    assert.ok(!html.includes('?v='), 'assetQueryParam: false must skip ?v= busting');
    assert.ok(!/meta[^>]*name="reading-time"/.test(html), 'readingTime off');
    assert.ok(!html.includes('last-modified'), 'lastModified off');
    assert.ok(!html.includes('loading="lazy"'), 'lazyLoad off');
    // searchIndex is opt-in (Phase 2) -> also assert absent when searchIndex: true is not set
    assert.ok(!fs.existsSync(path.join(site, 'search.json')), 'search.json absent when not opted in');

    // build tag is unconditional (always refreshed, pins current behavior)
    assert.match(html, /<meta name="freestruct-build" content="[0-9a-f]{8}">/);
  } finally { rmDir(dir); }
});

// ---------- error paths (exit 1 + no writes) ----------

test('missing config: exits 1 with a clear message', () => {
  const dir = scenario('main');
  try {
    fs.rmSync(path.join(dir, 'docs/ssr-config.yml'));
    const res = runInjectFailing(dir);
    assert.match((res.stdout || '') + (res.stderr || ''), /[Cc]onfig not found/);
    assert.ok(!fs.existsSync(path.join(dir, 'docs/_site/404.html')), 'no artifacts written on failure');
  } finally { rmDir(dir); }
});

test('unparseable config YAML: exits 1', () => {
  const dir = scenario('main', { 'docs/ssr-config.yml': 'site:\n  name: [unclosed\n' });
  try {
    const res = runInjectFailing(dir);
    assert.match((res.stdout || '') + (res.stderr || ''), /[Cc]onfig parse error/);
  } finally { rmDir(dir); }
});

test('config without a site section: exits 1', () => {
  const dir = scenario('main', { 'docs/ssr-config.yml': 'foo: bar\n' });
  try {
    const res = runInjectFailing(dir);
    assert.match((res.stdout || '') + (res.stderr || ''), /Invalid config/);
  } finally { rmDir(dir); }
});

test('missing template: exits 2 after config + outputDir validation (staged-only: fallback disabled)', () => {
  const dir = scenario('main');
  try {
    fs.rmSync(path.join(dir, 'docs/_freestruct'), { recursive: true, force: true });
    // FREESTRUCT_SKIP_PACKAGE_FALLBACK pins staged-only semantics; without it
    // the fresh-install package fallback would legitimately rescue this run.
    const res = runInjectFailing(dir, [], { FREESTRUCT_SKIP_PACKAGE_FALLBACK: '1' });
    assert.match((res.stdout || '') + (res.stderr || ''), /[Tt]emplate not found/);
  } finally { rmDir(dir); }
});

test('fresh-install template fallback: package copy rescues a config dir without _freestruct', () => {
// No staged docs/_freestruct in the fixture: production installs ship the
// template inside node_modules/freestruct/engine/_freestruct, so a repo that
  // only stages the config must still inject (tarball-e2e finding, pass 9).
  const dir = scenario('main');
  try {
    fs.rmSync(path.join(dir, 'docs/_freestruct'), { recursive: true, force: true });
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.ok(html.includes('freestruct-build'), 'injection happened via the package-shipped template');
  } finally { rmDir(dir); }
});

test('missing output directory: exits 1', () => {
  const dir = scenario('main');
  try {
    fs.rmSync(path.join(dir, 'docs/_site'), { recursive: true, force: true });
    const res = runInjectFailing(dir);
    assert.match((res.stdout || '') + (res.stderr || ''), /[Oo]utput directory not found/);
  } finally { rmDir(dir); }
});

// ---------- CLI flags ----------

test('--version prints the package.json version, no config/fixture needed', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  const res = spawnSync(process.execPath, [INJECT, '--version'], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.strictEqual(res.status, 0);
  assert.includes((res.stdout || '').trim(), pkg.version, `--version output must contain ${pkg.version}`);
});

test('positional output-dir arg still works: injects into a sibling copy of _site', () => {
  const dir = scenario('main');
  try {
    fs.cpSync(path.join(dir, 'docs/_site'), path.join(dir, 'out'), { recursive: true });
    runInject(dir, ['out']);
    const html = read(dir, 'out/index.html');
    assert.match(html, /<meta name="freestruct-build" content="[0-9a-f]{8}">/);
    assert.includes(html, '/css/site.css?v=');
  } finally { rmDir(dir); }
});

// ---------- root resolution (Phase 1.2) ----------

test('running with the exact docs/_site positional still works', () => {
  const dir = scenario('main');
  try {
    const out = runInject(dir, ['docs/_site']);
    assert.match(out, /Found \d+ HTML files/); // ran fine, not "Config not found"
  } finally { rmDir(dir); }
});

// ---------- Phase 2: config contract ----------

test('freestruct.config.yml is discovered first; ssr-config.yml still works (back-compat)', () => {
  const dir = scenario('main', {
    // Move the config to the new name: new name wins, old name deleted
    'docs/freestruct.config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      ''
    ].join('\n')
  });
  try {
    fs.rmSync(path.join(dir, 'docs/ssr-config.yml'));
    const out = runInject(dir);
    assert.match(out, /Found \d+ HTML files/); // ran, so the new name was found
  } finally { rmDir(dir); }
});

test('legacy ssr-config.yml alone still loads (back-compat read)', () => {
  const dir = scenario('main');
  try {
    // scenario('main') already ships docs/ssr-config.yml; no new config present
    const out = runInject(dir);
    assert.match(out, /Found \d+ HTML files/);
  } finally { rmDir(dir); }
});

test('retired/unknown config keys produce loud warnings but do not fail the run', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'preserveExistingMeta: true',
      'cacheBusting:',
      '  hash: true',
      'totallyUnknownFlag: 7',
      ''
    ].join('\n')
  });
  try {
    const out = runInject(dir);
    assert.includes(out, '[freestruct] config warning: retired config key "preserveExistingMeta"');
    assert.includes(out, '[freestruct] config warning: retired cacheBusting.hash');
    assert.includes(out, '[freestruct] config warning: unknown config key "totallyUnknownFlag"');
    // and the run still produced artifacts
    assert.ok(fs.existsSync(path.join(dir, 'docs/_site/sitemap.xml')));
    // this config did NOT opt into searchIndex -> default off (Phase 2)
    assert.ok(!fs.existsSync(path.join(dir, 'docs/_site/search.json')), 'search.json opt-in by default');
  } finally { rmDir(dir); }
});

test('--tolerant: fatal config error logs and exits 0 (CI tolerance mode)', () => {
  const dir = scenario('main');
  try {
    fs.rmSync(path.join(dir, 'docs/ssr-config.yml'));
    const res = spawnSync(process.execPath, [INJECT, '--tolerant'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, 'tolerant mode exits 0 even on fatal config errors');
    assert.match((res.stdout || '') + (res.stderr || ''), /[Cc]onfig not found/);
    assert.match((res.stdout || '') + (res.stderr || ''), /--tolerant: continuing with exit 0/);
  } finally { rmDir(dir); }
});

test('FAST_FAIL exit codes: template missing -> 2, outputDir missing -> 3', () => {
  const dirA = scenario('main');
  try {
    fs.rmSync(path.join(dirA, 'docs/_freestruct'), { recursive: true, force: true });
    assert.strictEqual(
      spawnSync(process.execPath, [INJECT], {
        cwd: dirA, encoding: 'utf8', env: { ...process.env, FREESTRUCT_SKIP_PACKAGE_FALLBACK: '1' },
      }).status, 2,
      'template missing exits 2 (staged-only pin; package fallback is off)');
  } finally { rmDir(dirA); }

  const dirB = scenario('main');
  try {
    fs.rmSync(path.join(dirB, 'docs/_site'), { recursive: true, force: true });
    assert.strictEqual(spawnSync(process.execPath, [INJECT], { cwd: dirB, encoding: 'utf8' }).status, 3,
      'outputDir missing exits 3');
  } finally { rmDir(dirB); }
});

// ---------- Phase 2: basePath semantics (issue #3) ----------

test('basePath set: canonical/sitemap/feed/search URLs get exactly one prefix', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'basePath: /help',
      'searchIndex: true',
      ''
    ].join('\n')
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    // tree nests _site at root -> canonical = url + basePath + slug
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/help/">');
    assert.includes(html, '<meta property="og:url" content="https://docs.example.com/help/">');

    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.includes(guide, '<link rel="canonical" href="https://docs.example.com/help/guide/">');

    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.includes(sitemap, '<loc>https://docs.example.com/help/</loc>');
    assert.includes(sitemap, '<loc>https://docs.example.com/help/guide/</loc>');
    assert.ok(!sitemap.includes('/help/help'), 'no doubled basePath');

    const feed = read(dir, 'docs/_site/feed.xml');
    assert.includes(feed, '<link>https://docs.example.com/help/guide/</link>');
    // The feed's own pointers followed the pageUrlFor contract too (they used
    // to be raw site.url guesses - the robots/self-link 404 class).
    assert.includes(feed, '<link>https://docs.example.com/help/</link>', 'channel link is the basePath home');
    assert.includes(feed, 'href="https://docs.example.com/help/feed.xml" rel="self"', 'atom self-link carries the prefix exactly once');
    assert.ok(!feed.includes('/help/help'), 'no doubled basePath in the feed');

    // robots.txt sitemap pointer + generated 404 home link: same contract
    const robots = read(dir, 'docs/_site/robots.txt');
    assert.includes(robots, 'Sitemap: https://docs.example.com/help/sitemap.xml', 'robots sitemap pointer is basePath-aware');
    assert.ok(!robots.includes('/help/help'), 'no doubled basePath in robots.txt');
    const nf404 = read(dir, 'docs/_site/404.html');
    assert.includes(nf404, 'href="https://docs.example.com/help/"', 'generated 404 home link is basePath-aware');
    assert.ok(!nf404.includes('/docs/'), 'no guessy /docs/ link in the generated 404');

    const search = JSON.parse(read(dir, 'docs/_site/search.json'));
    assert.ok(search.some(e => e.url === 'https://docs.example.com/help/'), 'root entry carries the prefix');
  } finally { rmDir(dir); }
});

test('basePath set + tree nests the directory: no doubled prefix (nested wins)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'basePath: /help',
      ''
    ].join('\n')
  });
  try {
    // make the output tree itself nest under /help/ like a jekyll sub-path build
    fs.cpSync(path.join(dir, 'docs/_site'), path.join(dir, 'nested/help'), { recursive: true });
    runInject(dir, ['nested/help']);
    const html = read(dir, 'nested/help/index.html');
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/help/">',
      'nested tree page canonical = /help/ (not /help/help/)');
    const guide = read(dir, 'nested/help/guide/index.html');
    assert.includes(guide, '<link rel="canonical" href="https://docs.example.com/help/guide/">');
  } finally { rmDir(dir); }
});

// ---------- purge hooks (Phase 1.1 split; README Security section) ----------
// The ONLY engine code that executes shell commands ran with zero pins - the
// leakiest feature got the least attention. Two canaries:
//   disabled-by-default: a configured purge NEVER executes without runHooks:true
//   enablement: runHooks:true executes, with $SITE_URL/$BUILD_HASH/$OUTPUT_DIR
//   substituted truthfully.

const purgeConfig = (markerPath, extraKeys = '') => [
  'site:',
  '  name: Foo Docs',
  '  url: https://docs.example.com',
  '  description: A test docs site',
  extraKeys,
  'cacheBusting:',
  '  purge:',
  '    - name: canary',
  `      command: node -e "require('fs').writeFileSync(process.argv[1], process.argv.slice(2).join('|'))" ${markerPath} "https://docs.example.com/$SITE_URL_PART" "$BUILD_HASH" "$OUTPUT_DIR"`,
].filter(Boolean).join('\n') + '\n';

test('purge hooks disabled by default: configured commands NEVER execute without runHooks', () => {
  const dir = scenario('main');
  try {
    const marker = path.join(dir, 'purge-marker.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), purgeConfig(marker));
    runInject(dir);
    const out = fs.readFileSync(path.join(dir, 'docs/_site/index.html'), 'utf8');
    assert.includes(out, 'freestruct-build', 'run completed normally');
    assert.ok(
      !fs.existsSync(marker),
      'the purge canary EXECUTED anyway - the runHooks gate leaked (docs say disabled by default)',
    );
  } finally { rmDir(dir); }
});

test('purge hooks: runHooks: true executes the canary with truthful substitutions', () => {
  const dir = scenario('main');
  try {
    const marker = path.join(dir, 'purge-marker.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), purgeConfig(marker, 'runHooks: true'));
    const out = runInject(dir);
    const hash = (out.match(/freestruct: Done \(([0-9a-f]{0,8})\)/) || [])[1];
    assert.ok(hash, 'run reports its build hash');
    assert.ok(fs.existsSync(marker), 'runHooks: true must actually execute the configured hook');
    const parts = fs.readFileSync(marker, 'utf8').split('|');
    assert.strictEqual(parts.length, 3, 'all three canary fields arrived');
    assert.match(parts[0], /^https:\/\/docs\.example\.com\//, '$SITE_URL substituted');
    assert.strictEqual(parts[1], hash, '$BUILD_HASH substituted with the printed build hash');
    assert.ok(parts[2].endsWith(path.join('docs', '_site')), '$OUTPUT_DIR substituted');
  } finally { rmDir(dir); }
});

// done
console.log('[freestruct battery] complete');
