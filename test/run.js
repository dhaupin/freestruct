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
import { load as yamlLoad } from 'js-yaml';

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

test('README, package.json and CHANGELOG agree on one version (1.1.0 owner pin)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  const readme = read('.', 'README.md');
  const changelog = read('.', 'CHANGELOG.md');
  const readmeVer = (readme.match(/^## v(\d+\.\d+\.\d+)\s*$/m) || [])[1];
  const changeVer = (changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
  assert.ok(readmeVer, 'README must carry a "## vX.Y.Z" version heading');
  assert.ok(changeVer, 'CHANGELOG must open with a "## [X.Y.Z]" version entry');
  assert.strictEqual(readmeVer, pkg.version, 'README version heading must equal package.json version');
  assert.strictEqual(changeVer, pkg.version, 'CHANGELOG top entry must equal package.json version');
  // Owner call: the pin moved to 1.0.0 - the first stable release, and to
  // 1.1.0 on 2026-10-25 with the first post-stable surface. The manual npm
  // bootstrap is done; only the tag remains
  // owner-gated (see labs/TASKS.md VERSION POLICY).
  assert.strictEqual(pkg.version, '1.1.0', 'version pinned at 1.1.0 by owner call - see the VERSION POLICY in labs/TASKS.md first');
});

test('README quickstart YAML example actually parses (issue #8)', () => {
  const readme = read('.', 'README.md');
  const block = (readme.match(/```yaml\n([\s\S]*?)```/) || [])[1];
  assert.ok(block, 'README must include one ```yaml config example');
  const parsed = yamlLoad(block);
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
      parsed = yamlLoad(fs.readFileSync(path.join(wfDir, f), 'utf8'));
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

test('config contract: twitter block optional - no handle, no identity tags', () => {
  // Same fixture config as 'main' with the twitter block dropped entirely:
  // without a handle the engine must leave twitter:site/creator out rather
  // than rendering content="" placeholders (twitter:card still injects).
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      '',
      'og:',
      '  image: /og.png',
      '',
      'searchIndex: true',
      '',
    ].join('\n'),
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '<meta name="twitter:card" content="summary">');
    assert.includes(html, '<meta name="twitter:title" content="Home | Foo Docs">');
    assert.ok(!/name="twitter:site"/.test(html), 'no twitter:site without a handle');
    assert.ok(!/name="twitter:creator"/.test(html), 'no twitter:creator without a handle');
  } finally { rmDir(dir); }
});

test('defaults: og.image optional means no image tags, escapes attributes, twitter parity', () => {
  // Same fixture as 'main' minus the og block (no image anywhere). No image
  // configured -> no og:image/twitter:image ship at all; values are
  // attribute-escaped; twitter:description accompanies twitter:title.
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A "broken" <b>docs</b> description',
      '',
      'twitter:',
      '  username: "@foos"',
      '  card: summary_large_image',
      '',
      'searchIndex: true',
      '',
    ].join('\n'),
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.ok(!/og:image/.test(html), 'no og:image without a configured image');
    assert.ok(!/twitter:image/.test(html), 'no twitter:image without a configured image');
    assert.includes(html, '<meta name="description" content="A &quot;broken&quot; &lt;b&gt;docs&lt;/b&gt; description">');
    assert.includes(html, '<meta name="twitter:description" content="A &quot;broken&quot; &lt;b&gt;docs&lt;/b&gt; description">');
    assert.includes(html, '<meta name="twitter:card" content="summary_large_image">');
    // raw ampersand stays raw in canonical attributes (existing contract)
    const ab = read(dir, 'docs/_site/a&b.html');
    assert.includes(ab, '<link rel="canonical" href="https://docs.example.com/a&b">');
  } finally { rmDir(dir); }
});

test('defaults: no author key means no JSON-LD founder; author ships Person with url', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      '',
      'author:',
      '  name: Jane Doe',
      '  url: https://janedoe.dev',
      '',
      'searchIndex: true',
      '',
    ].join('\n'),
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '"founder": { "@type": "Person", "name": "Jane Doe", "url": "https://janedoe.dev" }');
  } finally { rmDir(dir); }
  // main fixture carries no author: Organization JSON-LD must not have founder
  const bare = scenario('main');
  try {
    runInject(bare);
    const html = read(bare, 'docs/_site/index.html');
    assert.ok(!html.includes('"founder"'), 'no founder without a configured author');
  } finally { rmDir(bare); }
});

test('per-page freestruct comment overrides the injected tags and warns loudly', () => {
  const files = [
    'site:',
    '  name: Foo Docs',
    '  url: https://docs.example.com',
    '  description: A test docs site',
    '',
    'twitter:',
    '  username: "@foos"',
    '  card: summary_large_image',
    '',
    'og:',
    '  image: /og.png',
    '',
    'searchIndex: true',
    '',
  ].join('\n');
  const dir = scenario('main', { 'docs/ssr-config.yml': files });
  try {
    const indexHtml = path.join(dir, 'docs/_site/index.html');
    let html = fs.readFileSync(indexHtml, 'utf8');
    html = html.replace('</head>',
      '<!-- freestruct: {"title": "Guide Home", "ogType": "article", "ogImage": "/post.jpg", "twitterCard": "player", "publishedTime": "2026-10-01", "author": "Jane Roe", "section": "Docs", "bogus": 1} -->\n</head>');
    fs.writeFileSync(indexHtml, html);

    const stdout = runInject(dir);
    assert.includes(stdout, 'unknown per-page key(s) "bogus" ignored');

    const out = read(dir, 'docs/_site/index.html');
    assert.includes(out, '<meta property="og:title" content="Guide Home | Foo Docs">');
    assert.includes(out, '<meta property="og:type" content="article">');
    assert.includes(out, '<meta property="og:image" content="https://docs.example.com/post.jpg">');
    assert.includes(out, '<meta name="twitter:image" content="https://docs.example.com/post.jpg">');
    assert.includes(out, '<meta name="twitter:card" content="player">');
    assert.includes(out, '<meta property="article:published_time" content="2026-10-01">');
    assert.includes(out, '<meta property="article:author" content="Jane Roe">');
    assert.includes(out, '<meta property="article:section" content="Docs">');
  } finally { rmDir(dir); }

  // malformed JSON in the comment: warn + ignore, standard injection still lands
  const bad = scenario('main', { 'docs/ssr-config.yml': files });
  try {
    const indexHtml = path.join(bad, 'docs/_site/index.html');
    let html = fs.readFileSync(indexHtml, 'utf8');
    html = html.replace('</head>', '<!-- freestruct: {"ogType": article} -->\n</head>');
    fs.writeFileSync(indexHtml, html);

    const stdout = runInject(bad);
    assert.includes(stdout, 'malformed JSON in the freestruct per-page comment');
    assert.includes(read(bad, 'docs/_site/index.html'), '<meta property="og:type" content="website">');
  } finally { rmDir(bad); }
});

test('defaults: build hash is content-derived (deterministic, idempotent, content-sensitive)', () => {
  const run = (dir) => {
    runInject(dir);
    return read(dir, 'docs/_site/index.html').match(/<meta name="freestruct-build" content="([0-9a-f]{8})"/)[1];
  };
  // identical content in two independent trees -> identical hash
  const a = scenario('main');
  const b = scenario('main');
  try {
    const hashA = run(a);
    assert.strictEqual(hashA, run(b), 'identical content builds an identical hash');
    // rerun over the already-injected tree -> still the same hash
    assert.strictEqual(hashA, run(a), 'rerunning on an injected tree keeps the hash');
  } finally { rmDir(a); rmDir(b); }
  // a real content change flips the hash
  const c = scenario('main');
  try {
    const before = run(c);
    const indexHtml = path.join(c, 'docs/_site/index.html');
    fs.writeFileSync(indexHtml, fs.readFileSync(indexHtml, 'utf8').replace('Welcome to the Foo Docs fixture site', 'Welcome CHANGED'));
    run(c);
    const after = read(c, 'docs/_site/index.html').match(/<meta name="freestruct-build" content="([0-9a-f]{8})"/)[1];
    assert.notStrictEqual(before, after, 'content change produces a new hash');
  } finally { rmDir(c); }
});

test('cli: validate ok/fatal, init scaffold + no-clobber, help', () => {
  // validate: config-only preflight
  const ok = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, 'validate'], { cwd: ok, encoding: 'utf8' });
    assert.strictEqual(res.status, 0);
    assert.includes(res.stdout, 'config ok');
    assert.ok(!fs.existsSync(path.join(ok, 'docs', '_site', 'sitemap.xml')) && !fs.existsSync(path.join(ok, 'sitemap.xml')), 'validate touches no output tree');
  } finally { rmDir(ok); }

  const bad = scenario('main', {
    'docs/ssr-config.yml': ['site:', '  name: OnlyName', ''].join('\n'),
  });
  try {
    const res = spawnSync(process.execPath, [INJECT, 'validate'], { cwd: bad, encoding: 'utf8' });
    assert.notStrictEqual(res.status, 0);
    assert.includes(res.stderr, 'Invalid config');
  } finally { rmDir(bad); }

  // init: fresh scaffold into <dir>/docs, then a no-clobber rerun
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), `freestruct-cli-init-${process.pid}-`));
  try {
    const first = spawnSync(process.execPath, [INJECT, 'init'], { cwd: fresh, encoding: 'utf8' });
    assert.strictEqual(first.status, 0);
    assert.ok(fs.existsSync(path.join(fresh, 'docs', 'freestruct.config.yml')));
    assert.ok(fs.existsSync(path.join(fresh, 'docs', '_freestruct', 'inject-brand.html')));

    const again = spawnSync(process.execPath, [INJECT, 'init'], { cwd: fresh, encoding: 'utf8' });
    assert.strictEqual(again.status, 0);
    assert.includes(again.stdout, 'nothing new to scaffold');
    assert.includes(again.stdout, 'skip (exists)');
  } finally { rmDir(fresh); }

  // help (subcommand) and its --help flag alias must print the same text
  const help = spawnSync(process.execPath, [INJECT, 'help'], { encoding: 'utf8' });
  assert.strictEqual(help.status, 0);
  assert.includes(help.stdout, 'freestruct validate');
  assert.includes(help.stdout, 'freestruct init');
  const flag = spawnSync(process.execPath, [INJECT, '--help'], { encoding: 'utf8' });
  assert.strictEqual(flag.status, 0);
  assert.strictEqual(flag.stdout, help.stdout, '--help prints the same help text');
});

test('config contract: FREESTRUCT_URL env override redirects the canonical origin, loudly', () => {
  const dir = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, FREESTRUCT_URL: 'https://staging.example.com' },
    });
    assert.strictEqual(res.status, 0);
    assert.includes(res.stdout, 'env override: site.url -> https://staging.example.com');
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '<link rel="canonical" href="https://staging.example.com/">');
    assert.includes(html, '<meta property="og:url" content="https://staging.example.com/">');
    // stderr must stay clean like every successful run
    assert.strictEqual(res.stderr.trim(), '', 'env override must not emit stderr noise');
  } finally { rmDir(dir); }
});

test('config contract: jsonLd hook appends custom structured data (missing-only, script-safe)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      '',
      'jsonLd:',
      '  - "@type": BreadcrumbList',
      '    position: 1',
      '  - 5',
      '',
      'searchIndex: true',
      '',
    ].join('\n'),
  });
  try {
    const stdout = runInject(dir);
    assert.includes(stdout, 'jsonLd[1] is not an object; block skipped');
    const html = read(dir, 'docs/_site/index.html');
    assert.strictEqual((html.match(/application\/ld\+json/g) || []).length, 3, 'built-in Organization + WebSite + one custom block');
    assert.includes(html, '{"@type":"BreadcrumbList","position":1}');
    // existing-seo page keeps its own JSON-LD (missing-only), no extra blocks
    const existing = read(dir, 'docs/_site/existing-seo.html');
    assert.strictEqual((existing.match(/application\/ld\+json/g) || []).length, 1);
  } finally { rmDir(dir); }

  // script-safety: '<' in a value renders as \u003c in the serialized block
  const hostile = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      '',
      'jsonLd:',
      '  name: "</script>alert(1)<x>"',
      '',
      'searchIndex: true',
      '',
    ].join('\n'),
  });
  try {
    runInject(hostile);
    const html = read(hostile, 'docs/_site/index.html');
    assert.includes(html, '"name":"\\u003c/script>alert(1)\\u003cx>"');
  } finally { rmDir(hostile); }
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

// ---------- $-expansion trap (issue #24, latent hardening) ----------
// Any config- or content-carried value that rides a STRING-form
// String.replace() replacer is treated as replacement syntax: a $& / $' /
// $1..9 in it corrupts the surrounding output instead of printing literally.
// The engine now uses function replacers at every such spot; these pins keep
// the class dead.

test('purge hooks: $-syntax in a config-carried site url stays LITERAL in the executed command (issue #24)', () => {
  const dir = scenario('main');
  try {
    const marker = path.join(dir, 'purge-marker.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      "  url: https://docs.example.com/$&/keep-literal/",
      'runHooks: true',
      'cacheBusting:',
      '  purge:',
      `    - command: node -e "require('fs').writeFileSync(process.argv[1], process.argv.slice(2).join('|'))" ${marker} "https://docs.example.com/$SITE_URL_PART" "$SITE_URL"`,
    ].join('\n') + '\n');
    runInject(dir);
    assert.ok(fs.existsSync(marker), 'hook still runs under runHooks: true');
    const partsOfMarker = fs.readFileSync(marker, 'utf8');
    assert.ok(!partsOfMarker.includes('$SITE_URL'),
      'the $-placeholder was never substituted - a literal $ value corrupted the placeholder substitution');
    const markerParts = partsOfMarker.split('|');
    assert.strictEqual(markerParts.length, 2, 'both canary fields arrived');
    assert.strictEqual(markerParts[1], 'https://docs.example.com/$&/keep-literal/',
      'config-carried $& prints LITERALLY into the executed command instead of expanding to the match');
    assert.strictEqual(markerParts[0], 'https://docs.example.com/' + markerParts[1] + '_PART',
      'placeholder substitution truthfully carried the $-bearing url');
  } finally { rmDir(dir); }
});

// The pin payloads are assembled with concatenation so the SOURCE stays free
// of replacement-syntax sequences (the file is itself a replacement carrier
// by subject matter - keep no false positives inside test/run.js).
const SNIPPET_DOLLAR = '$& $1 $.'.replace(/\./g, "'");

test('custom snippets carrying $-syntax print literally and the page stays intact (issue #24)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/_freestruct/inject-footer.html'),
      '<span data-canary="' + SNIPPET_DOLLAR + '</span>');
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, SNIPPET_DOLLAR, 'snippet $ sequences print literally');
    assert.includes(html, '</body>', '</body> not swallowed by replacement-syntax expansion');
    assert.ok((html.match(/<\/body>/g) || []).length === 1, 'exactly one </body> remains');
  } finally { rmDir(dir); }
});

test('config-carried $ sequences in the seo block do not rewrite the document head (issue #24)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: "$& Docs"',
      '  url: https://docs.example.com',
    ].join('\n') + '\n');
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '$& Docs', 'config value prints literally in the head');
    assert.ok((html.match(/<\/head>/g) || []).length === 1, '</head> not rewritten by replacement syntax');
  } finally { rmDir(dir); }
});

// ---------- structured og.image (issue #20) ----------
// The string form stays back-compat. The object form { src, width, height,
// alt, allowSvg } additionally emits the companions scrapers size previews
// with, and the SVG trap (share previews blank) warns loudly / fails clean
// under --strict.

test('og.image object form emits width/height/alt companions; the string form stays back-compat (issue #20)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image:',
      '    src: /banner.png',
      '    width: 1200',
      '    height: 630',
      '    alt: Docs banner',
    ].join('\n') + '\n');
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '<meta property="og:image" content="https://docs.example.com/banner.png">', 'src joined onto the site url like the string form');
    assert.includes(html, '<meta property="og:image:width" content="1200">');
    assert.includes(html, '<meta property="og:image:height" content="630">');
    assert.includes(html, '<meta property="og:image:alt" content="Docs banner">');
  } finally { rmDir(dir); }
});

test('og.image string form: no companion tags ship (back-compat shape, issue #20)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '<meta property="og:image" content="https://docs.example.com/og.png">');
    assert.ok(!/og:image:(width|height|alt)/.test(html), 'string form stays companion-free');
  } finally { rmDir(dir); }
});

test('og.image svg src warns loudly by default, allowSvg opts out, --strict fails the build (issue #20)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image: /previews/banner.svg',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'SVG', 'the svg trap warns loudly by default');
  } finally { rmDir(dir); }

  const dir2 = scenario('main');
  try {
    fs.writeFileSync(path.join(dir2, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image:',
      '    src: /previews/banner.svg',
      '    allowSvg: true',
    ].join('\n') + '\n');
    const out2 = runInject(dir2);
    assert.ok(!/SVG/.test(out2), 'allowSvg: true is the way out');
  } finally { rmDir(dir2); }

  const dir3 = scenario('main');
  try {
    fs.writeFileSync(path.join(dir3, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image: /previews/banner.svg',
    ].join('\n') + '\n');
    const res = spawnSync(process.execPath, [INJECT, '--strict'], { cwd: dir3, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, '--strict graduates the svg warning to a build failure');
    assert.includes(res.stdout, 'SVG og:image');
  } finally { rmDir(dir3); }
});

test('og.image shape diagnostics: unknown companion keys and bad values warn (issue #20)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image:',
      '    src: /banner.png',
      '    width: nan',
      '    cardStyle: fancy',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'unknown og.image companion key(s): "cardStyle"', 'unknown companion key names itself');
    assert.includes(out, 'og.image.width must be a positive number', 'non-numeric width warns');
  } finally { rmDir(dir); }
});

// ---------- general postBuild hooks (issue #21) ----------
// The purge runner generalized into a first-class seam: hooks.postBuild
// commands chain after the pass, behind the same runHooks opt-in. Nonzero
// hook exits fail the build (expressed as exit code 4).

test('postBuild hooks disabled by default: configured commands NEVER execute without runHooks (issue #21)', () => {
  const dir = scenario('main');
  try {
    const marker = path.join(dir, 'hook-marker.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'hooks:',
      `  postBuild: node -e "require('fs').writeFileSync(process.argv[1], 'ran')" ${marker}`,
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.ok(!fs.existsSync(marker), 'the postBuild canary EXECUTED without runHooks');
    assert.includes(out, 'PostBuild hooks disabled', 'the gate says so loudly');
  } finally { rmDir(dir); }
});

test('postBuild hooks with runHooks: true execute with placeholders + FREESTRUCT_* env (issue #21)', () => {
  const dir = scenario('main');
  try {
    const envMarker = path.join(dir, 'hook-env.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'runHooks: true',
      'hooks:',
      `  postBuild: node -e "require('fs').writeFileSync(process.argv[1], (process.env.FREESTRUCT_SITE_URL||'') + '|' + String(process.env.FREESTRUCT_OUTPUT_DIR||'').split('/').pop())" ${JSON.stringify(envMarker)}`,
    ].join('\n') + '\n');
    runInject(dir);
    const parts = fs.readFileSync(envMarker, 'utf8').split('|');
    assert.strictEqual(parts[0], 'https://docs.example.com', 'FREESTRUCT_SITE_URL reaches the hook child');
    assert.strictEqual(parts[1], '_site', 'FREESTRUCT_OUTPUT_DIR reaches the hook child');
  } finally { rmDir(dir); }
});

test('a failing postBuild hook fails the whole build with exit 4 (issue #21)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'runHooks: true',
      'hooks:',
      '  postBuild:',
      '    - node -e "process.exit(7)"',
    ].join('\n') + '\n');
    const res = spawnSync(process.execPath, [INJECT], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 4, 'exit code 4 is the documented hook-failure code');
    assert.includes(res.stderr + res.stdout, 'postBuild hook(s) failed', 'the failure names what failed (the FAST_FAIL channel is stderr)');
  } finally { rmDir(dir); }
});

test('hooks shape diagnostics: unknown seams and non-string entries warn (issue #21)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'hooks:',
      '  postBuild:',
      '    - node -e 0',
      '    - 42',
      '  preBuild:',
      '    - node -e 0',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'unknown hooks seam "preBuild"', 'unknown seam names itself');
    assert.includes(out, 'every hooks.postBuild entry must be a non-empty string command', 'non-string entry warns');
  } finally { rmDir(dir); }
});

// ---------- freestruct audit (issue #18) ----------
// Post-build verification over the baked output only: heads + site
// artifacts, exit 0 clean / exit 1 findings (exit 3 when the dir is gone).

test('audit: a real engine run audits CLEAN, doctored output FAILS with exit 1 (issue #18)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 0, 'a genuine freestruct run passes its own audit\n' + out.stdout);
    assert.includes(out.stdout, 'audit: 0 failures', 'clean summary printed');

    // Doctor the output: strip the description meta from the home page.
    const idx = path.join(dir, 'docs/_site/index.html');
    fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
      .replace(/<meta name="description"[^>]*>\n?/i, ''));
    const out2 = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out2.status, 1, 'head regression exits 1');
    assert.includes(out2.stdout, 'FAIL index.html: missing meta description');
    assert.includes(out2.stdout, 'exiting 1');
  } finally { rmDir(dir); }
});

test('audit: the 404 noindex contract is checked independently of the og set (issue #18)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const f404 = path.join(dir, 'docs/_site/404.html');
    fs.writeFileSync(f404, fs.readFileSync(f404, 'utf8')
      .replace(/<meta name="robots"[^>]*>\n?/gi, ''));
    const out = spawnSync(process.execPath, [INJECT, 'audit', '--json'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 1);
    const digest = JSON.parse(out.stdout);
    assert.ok(digest.fails.some(f => f.page.includes('404') && /noindex/.test(f.msg)), 'noindex contract reported');
    assert.ok(!digest.fails.some(f => f.page.includes('404') && /twitter:card/.test(f.msg)), 'the full og set is out of scope for 404s by design');
  } finally { rmDir(dir); }
});

test('audit: svg og:image FAILs it, missing output dir is exit 3, --json parses (issue #18)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image: /banner.svg',
    ].join('\n') + '\n');
    runInject(dir);
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 1, 'svg og:image is audit-grade FAIL');
    assert.includes(out.stdout, 'og:image is SVG');
  } finally { rmDir(dir); }

  const dir2 = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, 'audit', 'not-here'], { cwd: dir2, encoding: 'utf8' });
    assert.strictEqual(res.status, 3, 'missing output dir keeps the familiar exit 3');
  } finally { rmDir(dir2); }
});

// ---------- indexnow (issue #19) ----------
// Key-file emission during the run (the keyLocation contract), generate-
// once-and-persist key handling, and a network-free --dry-run submission
// that surfaces the full request body.

test('indexnow: the configured key ships as <key>.txt in the output dir (issue #19)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'indexNow:',
      '  key: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'key file written: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1.txt');
    const keyFile = fs.readFileSync(path.join(dir, 'docs/_site/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1.txt'), 'utf8').trim();
    assert.strictEqual(keyFile, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1', 'the key file carries the key (keyLocation ownership proof)');
  } finally { rmDir(dir); }
});

test('indexnow: true generates once and REUSES the persisted key on the next run (issue #19)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'indexNow: true',
    ].join('\n') + '\n');
    const out1 = runInject(dir);
    assert.includes(out1, 'generated a new key and persisted it');
    const keyFile = path.join(dir, 'docs/indexnow-key.txt');
    const key = fs.readFileSync(keyFile, 'utf8').trim();
    assert.match(key, /^[a-f0-9]{32}$/, 'generated key is the documented 32-hex shape');

    const out2 = runInject(dir);
    assert.ok(!out2.includes('generated a new key'), 'second run reuses, never regenerates');
    assert.includes(out2, 'key file written: ' + key + '.txt');
  } finally { rmDir(dir); }
});

test('indexnow: bad key shapes warn loudly; --dry-run prints the payload and exits 0; no sitemap exits 1 (issue #19)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'indexNow:',
      '  key: short-key',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'indexNow key must be 32 lowercase hex chars', 'bad key shape warns at config load');
  } finally { rmDir(dir); }

  const dir2 = scenario('main');
  try {
    fs.writeFileSync(path.join(dir2, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'indexNow:',
      '  key: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1',
    ].join('\n') + '\n');
    // dry-run BEFORE any freestruct pass: sitemap.xml exists? not yet -> exit 1
    const res1 = spawnSync(process.execPath, [INJECT, 'indexnow', '--dry-run'], { cwd: dir2, encoding: 'utf8' });
    assert.strictEqual(res1.status, 1, 'no baked sitemap -> refusal (exit 1)');
    assert.includes(res1.stdout, 'no sitemap.xml');

    fs.writeFileSync(path.join(dir2, 'docs/_site/sitemap.xml'),
      '<sitemap><url><loc>https://docs.example.com/</loc><lastmod>2026-10-22</lastmod></url></sitemap>');
    const res2 = spawnSync(process.execPath, [INJECT, 'indexnow', '--dry-run'], { cwd: dir2, encoding: 'utf8' });
    assert.strictEqual(res2.status, 0, 'dry-run is exit 0');
    const body = (res2.stdout + '') || '';
    assert.includes(body, 'https://docs.example.com/', 'urlList carries the sitemap URL');
    assert.includes(body, 'keyLocation', 'the request names the keyLocation');
  } finally { rmDir(dir2); }

  const dir3 = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, 'indexnow'], { cwd: dir3, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'indexnow without config -> loud config fatal');
  } finally { rmDir(dir3); }
});

// ---------- per-page OG image generation (issue #22) ----------
// The SVG template renders per page, the optional @resvg/resvg-js
// rasterizer produces PNGs (devDependency: consumers opt in), and the seo
// seam wires og/twitter to the fresh PNG under the missing-only rule.

const OG_TEMPLATE = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">',
  '<rect width="1200" height="630" fill="#0f172a"/>',
  '<text x="60" y="200">{{ogTitle}}</text>',
  '<text x="60" y="420">{{ogDescription}}</text>',
  '</svg>',
].join('\n');

test('ogImageGeneration: per-page PNGs render, tags wire to them, own-image pages keep theirs (issue #22)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/og-template.svg'), OG_TEMPLATE);
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'ogImageGeneration:',
      '  template: og-template.svg',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.ok(!/resvg-js is not installed/.test(out), 'rasterizer present in dev, no loud skip');

    const png = fs.readFileSync(path.join(dir, 'docs/_site/og/index.png'));
    assert.ok(png.length > 0, 'a real PNG rendered for the root page');
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '<meta property="og:image" content="https://docs.example.com/og/index.png">', 'og:image wired to the generated file');
    assert.includes(html, '<meta property="og:image:width" content="1200">', 'issue #20 companions ride along');
    assert.includes(html, '<meta property="og:image:alt" content="Home - page preview image">', 'alt comes from the pre-injection page title');
    assert.includes(html, '<meta name="twitter:image" content="https://docs.example.com/og/index.png">');

    // missing-only: existing-seo.html ships its own OG set -> generation
    // spends no PNG on it and wiring never touches its tags
    assert.ok(!fs.existsSync(path.join(dir, 'docs/_site/og/existing-seo.png')), 'pages with their own og set are skipped, not overwritten');
    const existing = read(dir, 'docs/_site/existing-seo.html');
    assert.includes(existing, '<meta property="og:title" content="Own SEO">', 'the page kept its own og set wholesale');
    assert.ok(!/og:image/.test(existing), 'no generated og:image was wired onto an og-owning page');
  } finally { rmDir(dir); }
});

test('ogImageGeneration: per-page override wins, noindex pages are skipped (issue #22 + missing-only)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/og-template.svg'), OG_TEMPLATE);
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'ogImageGeneration:',
      '  template: og-template.svg',
    ].join('\n') + '\n');
    // a per-page override page + a noindex page
    fs.writeFileSync(path.join(dir, 'docs/_site/override.html'),
      '<!-- freestruct: {"ogImage": "/brand/override.png"} -->\n</head>\n<body><h1>o</h1></body></html>');
    fs.writeFileSync(path.join(dir, 'docs/_site/hidden.html'),
      '<html><head><meta name="robots" content="noindex"></head><body><h1>h</h1></body></html>');
    runInject(dir);
    const overrideHtml = read(dir, 'docs/_site/override.html');
    assert.includes(overrideHtml, '<meta property="og:image" content="https://docs.example.com/brand/override.png">');
    assert.ok(!fs.existsSync(path.join(dir, 'docs/_site/og/hidden.png')), 'noindex pages receive no share preview');
  } finally { rmDir(dir); }
});

test('ogImageGeneration: missing template files warn loudly and the run stays green (issue #22)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'ogImageGeneration:',
      '  template: no-such-template.svg',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'ogImageGeneration.template "no-such-template.svg" not found', 'loud single warning');
    assert.includes(out, 'Done (', 'the run completes cleanly');
    assert.ok(!fs.existsSync(path.join(dir, 'docs/_site/og')), 'nothing half-rendered');
  } finally { rmDir(dir); }
});

// ---------- scoped jsonLd + og.scoped (issue #25 + follow-on) ----------
// The config side learns what the per-page comment side already knows:
// glob-keyed scoping on page slugs. jsonLd: legacy object/list untouched or
// a slug-glob map; og.scoped: most-specific matching image variant.

test('jsonLd legacy shapes untouched: single object and list still reach every page (issue #25 back-compat)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'jsonLd:',
      '  - "@type": WebSite',
      '    name: Foo Docs',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    const deep = read(dir, 'docs/_site/guide/index.html');
    for (const [label, html] of [['root', root], ['deep', deep]]) {
      assert.ok(html.includes('"@type"'), label + ' keeps its jsonLd block');
    }
  } finally { rmDir(dir); }
});

test('jsonLd scoped map: \'/guide/**\' lands on the deep guide, never on root (issue #25)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'jsonLd:',
      '  "/guide/**":',
      '    - "@type": BreadcrumbList',
      '      name: Guides trail',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    const deep = read(dir, 'docs/_site/guide/index.html');
    assert.includes(deep, 'BreadcrumbList', 'scoped block reached the matching sub-tree');
    assert.ok(!/BreadcrumbList/.test(root), 'scoped block never reached root');
  } finally { rmDir(dir); }
});

test('jsonLd scoped map: exact key is exact, \'*\' is one segment, specificity orders output, and og-owning pages stay untouched (issue #25)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'jsonLd:',
      '  "/":',
      '    - "@type": WebPage',
      '      name: Landing',
      '  "/*":',
      '    - "@type": ItemList',
      '      name: Top level',
      '  "**":',
      '    - "@type": Organization',
      '      name: Everywhere',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    const deep = read(dir, 'docs/_site/guide/index.html');
    const own = read(dir, 'docs/_site/existing-seo.html');
    assert.includes(root, 'WebPage');
    assert.includes(root, 'Organization', 'the everywhere-glob reaches root too');
    assert.ok(!/ItemList/.test(root), '/* is exactly one segment - never the bare root');
    assert.ok(!/WebPage/.test(deep), 'exact key never bleeds into a subtree');
    assert.includes(deep, 'ItemList', '/* matches a one-segment page');
    assert.includes(deep, 'Organization');
    assert.ok(!/Organization/.test(own), 'missing-only: an og-jsonLd-owning page gets no scoped blocks either');
  } finally { rmDir(dir); }
});

test('jsonLd scoped map: one malformed entry warns loudly without nuking the others (issue #25)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'jsonLd:',
      '  "/":',
      '    - just-a-string-not-an-object',
      '  "/guide/**":',
      '    - "@type": ItemList',
      '      name: Guided',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'jsonLd "/" must map to an LD+JSON object', 'the bad entry names itself');
    const deep = read(dir, 'docs/_site/guide/index.html');
    assert.includes(deep, 'ItemList', 'the healthy entry still ships');
  } finally { rmDir(dir); }
});

test('og.scoped: most-specific variant wins over the global image; override still wins; companions ride (follow-on)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  image: /og/global-default.png',
      '  scoped:',
      '    "/": /og/home.png',
      '    "/guide/**":',
      '      src: /og/guide.png',
      '      width: 1200',
      '      height: 630',
      '      alt: Guide banner',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    const deep = read(dir, 'docs/_site/guide/index.html');
    assert.includes(root, '<meta property="og:image" content="https://docs.example.com/og/home.png">', 'exact scoped wins over the global default');
    assert.ok(!/og:image:width/.test(root), 'string variant stays companion-free');
    assert.includes(deep, '<meta property="og:image" content="https://docs.example.com/og/guide.png">', 'sub-tree variant wins over the global default');
    assert.includes(deep, '<meta property="og:image:width" content="1200">', 'the structured variant rides companions');
    assert.includes(deep, '<meta property="og:image:alt" content="Guide banner">');
  } finally { rmDir(dir); }
});

test('og.scoped: a list-valued variant warns loudly and ships NO image - never synthesized garbage', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site description that is long enough',
      'og:',
      '  scoped:',
      '    "/guide/**":',
      '      - /og/aar.png',
      '      - /og/bbb.png',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'must be an og image string or a { src, width, height, alt, allowSvg } object', 'the shape diagnostic names the value class');
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(!/og:image/.test(guide), 'honest absence: no garbage comma-joined og:image');
  } finally { rmDir(dir); }
});

// ---------- SEO-gap pass (feed link / SearchAction / breadcrumb / article /
// hreflang / verification / llms / audit --external) ----------
// Eight consumer surface additions, one battery pin each: config-gated,
// missing-only, engine-owned shapes.

test('feed autodiscovery: injected pages carry the rss alternate link (SEO-gap pass)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.includes(root, '<link rel="alternate" type="application/rss+xml" title="Foo Docs feed" href="https://docs.example.com/feed.xml">');
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.includes(guide, '<link rel="alternate" type="application/rss+xml"');
  } finally { rmDir(dir); }
});

test('feed autodiscovery: a page with its own rss alternate stays silent (missing-only)', () => {
  const dir = scenario('main', {
    'docs/_site/own-feed.html':
      '<html><head><title>O</title><link rel="alternate" type="application/rss+xml" href="/old.xml"></head><body><h1>o</h1></body></html>',
  });
  try {
    runInject(dir);
    const own = read(dir, 'docs/_site/own-feed.html');
    assert.ok(!own.includes('Foo Docs feed'), 'the engine never adds its feed link beside the page-owned one');
  } finally { rmDir(dir); }
});

test('SearchAction: no search.url ships NO potentialAction (the hardcoded ?s= default is gone)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.ok(!/potentialAction/.test(root), 'the WebSite block stays bare without config.search.url');
    assert.includes(root, '"@type": "WebSite"', 'the WebSite block itself still ships');
  } finally { rmDir(dir); }
});

test('SearchAction: the configured url lands with the placeholder', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'search:',
      '  url: https://docs.example.com/search?q={search_term_string}',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.includes(root, '"@type": "SearchAction"');
    assert.includes(root, '"target": "https://docs.example.com/search?q={search_term_string}"');
    assert.includes(root, '"query-input": "required name=search_term_string"');
  } finally { rmDir(dir); }
});

test('SearchAction: a url without the placeholder warns loudly and omits the block (fresh tree)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'search:',
      '  url: https://docs.example.com/search',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'search.url must contain the {search_term_string} placeholder', 'the schema.org contract is named');
    assert.ok(!/potentialAction/.test(read(dir, 'docs/_site/index.html')), 'a broken search target never ships');
  } finally { rmDir(dir); }
});

test('breadcrumb: true builds BreadcrumbList from the URL tree; root ships none; own jsonLd pages stay silent', () => {
  const dir = scenario('main', {
    'docs/_site/own-ld.html':
      '<html><head><title>L</title><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><h1>l</h1></body></html>',
  });
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'breadcrumb: true',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.ok(!/BreadcrumbList/.test(root), 'the root page gets no one-element breadcrumb');
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(/BreadcrumbList/.test(guide), 'the deep page gets the trail');
    assert.includes(guide, '"item":"https://docs.example.com/"', 'the trail starts at the site root');
    assert.includes(guide, '"item":"https://docs.example.com/guide"', 'the trail names the owning directory');
    const own = read(dir, 'docs/_site/own-ld.html');
    assert.ok(!/BreadcrumbList/.test(own), 'a page with its own JSON-LD stays untouched');
  } finally { rmDir(dir); }
});

test('breadcrumb coexists with a global config jsonLd (the docs-site shape); page-owned ld+json still suppresses the trail', () => {
  const dir = scenario('main', {
    'docs/_site/own-ld.html':
      '<html><head><title>L</title><script type="application/ld+json">{"@type":"WebPage"}</script></head><body><h1>l</h1></body></html>',
  });
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'breadcrumb: true',
      'jsonLd:',
      '  - "@type": Person',
      '    name: Tester',
    ].join('\n') + '\n');
    runInject(dir);
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(/BreadcrumbList/.test(guide), 'a global config jsonLd does not block the trail');
    assert.includes(guide, '"name":"Tester"', 'the config jsonLd block still ships beside it');
    const own = read(dir, 'docs/_site/own-ld.html');
    assert.ok(!/BreadcrumbList/.test(own), 'a page with its own JSON-LD still stays untouched');
  } finally { rmDir(dir); }
});

test('verification: provider codes land as engine-owned meta names; unknown providers warn', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'verification:',
      '  google: goog-code-123',
      '  bing: bing-code-456',
      '  antler: who-owns-this',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'unknown verification provider "antler"', 'the provider list is named');
    const root = read(dir, 'docs/_site/index.html');
    assert.includes(root, '<meta name="google-site-verification" content="goog-code-123">');
    assert.includes(root, '<meta name="msvalidate.01" content="bing-code-456">', 'bing rides the engine-owned name');
    assert.ok(!/antler/.test(root), 'unknown providers ship no tag');
  } finally { rmDir(dir); }
});

test('llms: true emits llms.txt over the indexable pages; noindex stays honored; an existing file is untouched', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'llms: true',
    ].join('\n') + '\n');
    runInject(dir);
    const llms = read(dir, 'docs/_site/llms.txt');
    assert.includes(llms, '# Foo Docs');
    assert.includes(llms, '- [', 'pages list as markdown links');
    assert.ok(!llms.includes('/noindex'), 'noindex pages never ship into the summary');
    fs.writeFileSync(path.join(dir, 'docs/_site/llms.txt'), 'hand-rolled');
    const out = runInject(dir);
    assert.includes(out, 'llms.txt exists - leaving it untouched');
    assert.strictEqual(read(dir, 'docs/_site/llms.txt'), 'hand-rolled');
  } finally { rmDir(dir); }
});

test('locales: hreflang alternates stem-swap across the locale trees; pages with own hreflang stay silent', () => {
  const dir = scenario('main', {
    'docs/_site/de/deep/index.html':
      '<html><head><title>D</title></head><body><h1>d</h1></body></html>',
    'docs/_site/own-lang.html':
      '<html><head><title>L</title><link rel="alternate" hreflang="sv" href="/sv/"></head><body><h1>l</h1></body></html>',
  });
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'locales:',
      '  "/": en',
      '  "/de/**": de',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.includes(root, '<link rel="alternate" hreflang="de" href="https://docs.example.com/de/">', 'the root swaps onto the locale tree');
    const deep = read(dir, 'docs/_site/de/deep/index.html');
    assert.ok(/hreflang="en" href="https:\/\/docs.example.com\/deep\/"/.test(deep), 'the stem swap works both directions');
    assert.ok(!/(\shreflang=)/.test(read(dir, 'docs/_site/own-lang.html').replace(/hreflang="sv"/, '')), 'a page carrying its own hreflang never gets more added');
    const ownHlCount = (read(dir, 'docs/_site/own-lang.html').match(/hreflang=/g) || []).length;
    assert.strictEqual(ownHlCount, 1, 'exactly the page-owned alternate ships');
  } finally { rmDir(dir); }
});

test('article.scoped: TechArticle lands on the subtree with the page facts; invalid types warn and ship nothing', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'article:',
      '  scoped:',
      '    "/guide/**": TechArticle',
      '    "/": Manual',
    ].join('\n') + '\n');
    const out = runInject(dir);
    assert.includes(out, 'article.scoped "/" must be "Article", "TechArticle" or "NewsArticle"', 'the invalid type names itself');
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(/"@type":"TechArticle"/.test(guide), 'the tree gets the typed block');
    assert.ok(/"url":"https:\/\/docs.example.com\/guide\/?"/.test(guide), 'the block carries the page canonical');
    const root = read(dir, 'docs/_site/index.html');
    assert.ok(!/("Article"|"TechArticle"|"NewsArticle")/.test(root), 'an invalid type ships no block on any page');
  } finally { rmDir(dir); }
});

test('audit --external: the json digest parses with the warns merged; unknown audit flags fail loudly', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const out = spawnSync(process.execPath, [INJECT, 'audit', '--json', '--external'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 0, 'external mode on a tree without external links stays clean\n' + out.stdout + out.stderr);
    const digest = JSON.parse(out.stdout);
    assert.strictEqual(digest.ok, true);
    assert.ok(Array.isArray(digest.warns), 'the warns array merges the audit + external rows');
    const bad = spawnSync(process.execPath, [INJECT, 'audit', '--bad'], { cwd: dir, encoding: 'utf8' });
    assert.ok(bad.status !== 0, 'unknown flags fail');
    assert.includes(bad.stdout + bad.stderr, 'only --json and --external are supported flags');
  } finally { rmDir(dir); }
});

test('article.scoped: a scoped jsonLd receiver skips the generated article; elsewhere it coexists with the config jsonLd set', () => {
  const dir = scenario('main', {
    'docs/_site/blog/post.html':
      '<html><head><title>Post</title></head><body><h1>post</h1></body></html>',
  });
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'article:',
      '  scoped:',
      '    "/**": TechArticle',
      'jsonLd:',
      '  "/guide/**":',
      '    - "@type": HowTo',
      '      name: Wired Guide',
    ].join('\n') + '\n');
    runInject(dir);
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(/HowTo/.test(guide), 'the scoped jsonLd block ships to the guide');
    assert.ok(!/TechArticle/.test(guide), 'the generated article skips a scoped jsonLd receiver');
    const post = read(dir, 'docs/_site/blog/post.html');
    assert.ok(/TechArticle/.test(post), 'the generated article ships where no scoped jsonLd block lands');
  } finally { rmDir(dir); }
});

test('pass-hunt: the noindex 404 ships NO generated extras (breadcrumb/article/feed/verification/alternates stay off noindex pages)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'breadcrumb: true',
      'verification:',
      '  google: goog-404',
      'article:',
      '  scoped:',
      '    "**": TechArticle',
      'locales:',
      '  "/": en',
      '  "/de/**": de',
    ].join('\n') + '\n');
    runInject(dir);
    const p404 = read(dir, 'docs/_site/404.html');
    for (const junk of ['BreadcrumbList', 'TechArticle', 'google-site-verification', 'hreflang=', 'rel="alternate" type="application/rss+xml"']) {
      assert.ok(!p404.includes(junk), 'the 404 never gets ' + junk);
    }
    // and a noindex fixture page never gets them either (the original list-page class)
    const hidden = read(dir, 'docs/_site/noindex.html');
    assert.ok(!hidden.includes('BreadcrumbList'), 'noindex pages stay artifact-free');
    // the regular pages keep the full generated set
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.ok(/BreadcrumbList/.test(guide), 'the regular page keeps its trail');
    assert.includes(guide, '<meta name="google-site-verification" content="goog-404">');
    assert.includes(read(dir, 'docs/_site/index.html'), '<link rel="alternate" type="application/rss+xml"');
  } finally { rmDir(dir); }
});

test('pass-hunt: a Title with embedded newlines stays one llms.txt list entry (line-flattened)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'llms: true',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'docs/_site/weird.html'),
      '<html><head><title>Bad\nTitle</title><meta name="description" content="two\nlines here"></head><body><h1>w</h1></body></html>');
    runInject(dir);
    const llms = read(dir, 'docs/_site/llms.txt');
    const weirdLine = llms.split('\n').filter((l) => l.includes('/weird'));
    assert.strictEqual(weirdLine.length, 1, 'exactly one list line for the newlined page (' + JSON.stringify(weirdLine) + ')');
    assert.ok(weirdLine[0].includes('Bad Title'), 'the title flattens to single-space segments');
    assert.ok(weirdLine[0].includes('two lines here'), 'the description flattens too');
  } finally { rmDir(dir); }
});

test('pass-hunt: a hostile search.url (quote + tag) lands as an escaped JSON string, never as markup', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'search:',
      '  url: \'https://docs.example.com/search?q=\"><svg onload=alert(1)>{search_term_string}\'',
    ].join('\n') + '\n');
    runInject(dir);
    const root = read(dir, 'docs/_site/index.html');
    assert.ok(/"@type": "SearchAction"/.test(root), 'the block ships');
    assert.ok(root.includes('\\u003csvg'), 'every tag-open in the target is neutralized to \u003c');
    assert.ok(!root.includes('<svg'), 'nothing imitating a tag ships raw');
  } finally { rmDir(dir); }
});

test('final-gate: verification dedupe is attribute-order tolerant', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'verification:',
      '  google: engine-ships',
      'llms: true',
    ].join('\n') + '\n');
    // page writes its own verification meta in the OTHER attribute order
    fs.writeFileSync(path.join(dir, 'docs/_site/own-order.html'),
      '<html><head><meta content="page-owned" name="google-site-verification"><title>O</title></head><body><h1>o</h1></body></html>');
    runInject(dir);
    const own = read(dir, 'docs/_site/own-order.html');
    assert.ok((own.match(/google-site-verification/g) || []).length === 1, 'a page-owned verification meta in the other attribute order still wins (exactly one ships)');
    assert.ok(!own.includes('engine-ships'), 'the engine adds no second meta beside a page-owned one');
  } finally { rmDir(dir); }
});

test('final-gate: a control byte in a page fact is a LOUD build failure (the escaped-or-fail XML contract precedes every consumer)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/_site/ctrl.html'),
      '<html><head><title>Ctrl\u0000Title</title></head><body><h1>c</h1></body></html>');
    const res = runInjectFailing(dir);
    assert.strictEqual(res.status, 1, 'the loud-fail contract exits 1');
    assert.includes(res.stderr, 'XML safety: value for feed title contains control character U+0000', 'the refusal names the value class and the field');
  } finally { rmDir(dir); }
});

// done
console.log('[freestruct battery] complete');
