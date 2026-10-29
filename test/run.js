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
import { createRequire } from 'module';
import { load as yamlLoad } from 'js-yaml';

const require = createRequire(import.meta.url);

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

test('publish gate: check composes the battery + audit + claims + pack selftest, and prepublishOnly runs gate (issue #37)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  assert.strictEqual(pkg.scripts.check, 'npm test && npm run lint:docs && npm run lint:claims && npm run packs:selftest',
    'check composes the fast gates');
  // gate adds sync:check, which the local publish path would otherwise skip.
  assert.strictEqual(pkg.scripts.gate, 'npm run sync:check && npm run check',
    'gate runs sync:check before check');
  assert.strictEqual(pkg.scripts.prepublishOnly, 'npm run gate',
    'prepublishOnly gates the publish on gate (sync lockstep + check)');
  // The heavyweight e2e leg stays a CI-side gate (publish.yml), not in check.
  assert.ok(!/e2e/.test(pkg.scripts.check), 'the heavyweight e2e leg stays out of the local gate');
  const publish = read('.', '.github/workflows/publish.yml');
  assert.includes(publish, 'npm run check', 'publish.yml runs the composed gate');
  assert.includes(publish, 'e2e-install.cjs', 'the tarball e2e stays a CI-side publish gate');
});

test('packs:selftest degrades gracefully without a crashtest checkout (named skip, exit 0 - issue #37)', () => {
  // A local `npm run check` / `npm publish` has no crashtest install; the
  // gate must skip with a named line, never hard-fail (CI always installs
  // crashtest, so the teeth still run where it matters). CRASHTEST_BIN set
  // but missing stays loud (exit 2) - a misconfig, not an absent checkout.
  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'packs-selftest.cjs')], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, CRASHTEST_BIN: '' },
  });
  assert.strictEqual(res.status, 0, 'an absent checkout is exit 0 either way (skip or teeth proven)\n' + res.stderr);
  // Fresh clone / CI battery: no crashtest -> named skip. A dev who happens
  // to have one installed runs the real teeth (also exit 0) - both are fine.
  assert.match(res.stderr, /skipped|teeth proven/, 'the gate names what it did');
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'packs-selftest.cjs')], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, CRASHTEST_BIN: '/no/such/crashtest.js' },
  });
  assert.strictEqual(bad.status, 2, 'an explicitly-requested-but-missing checkout is still loud');
});

// ---------- version truth (issue #7) ----------

test('README, package.json and CHANGELOG agree on one version (1.2.0 owner pin)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  const readme = read('.', 'README.md');
  const changelog = read('.', 'CHANGELOG.md');
  const readmeVer = (readme.match(/^## v(\d+\.\d+\.\d+)\s*$/m) || [])[1];
  const changeVer = (changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1];
  assert.ok(readmeVer, 'README must carry a "## vX.Y.Z" version heading');
  assert.ok(changeVer, 'CHANGELOG must open with a "## [X.Y.Z]" version entry');
  assert.strictEqual(readmeVer, pkg.version, 'README version heading must equal package.json version');
  assert.strictEqual(changeVer, pkg.version, 'CHANGELOG top entry must equal package.json version');
  // Owner call: the pin moved to 1.0.0 - the first stable release, then to
  // 1.1.0 on 2026-10-25 with the first post-stable surface, and to 1.2.0 on
  // 2026-10-28 with the post-queue engine sweep. The manual npm bootstrap is
  // done; only the tag remains owner-gated (see labs/TASKS.md VERSION POLICY).
  assert.strictEqual(pkg.version, '1.2.0', 'version pinned at 1.2.0 by owner call - see the VERSION POLICY in labs/TASKS.md first');
});

// ---------- version-truth census (issue #41) ----------
// package.json is THE single version source. Any living surface that names the
// CURRENT version is a hand-synced second truth, and hand-sync dies quietly -
// the release-day stale-README catch is the one-mortem this leg retires. The
// leg derives the version from package.json and refuses every living surface
// that drifted. LAWFUL others stay out of scope: range pins (^1.0.0) bind 1.x
// compatibility, dated era rows (CHANGELOG sections, the release posts, the
// pass log's dated entries) keep their era wording by design, and a workflow
// comment naming another package's version is not ours to move.

// The living surfaces that hand-copy the current version, each with the
// claim's own regex (anchored to the claim line, so a dated era row - which
// says "1.2.0" about the past - never matches). A claim's capture must equal
// the root version or the leg names file/line/claim/truth.
const VERSION_CLAIMS = [
  { file: 'README.md', re: /^- Current release: \*\*(\d+\.\d+\.\d+)\*\*/m, label: 'README current-release line' },
  { file: 'AGENTS.md', re: /everything ships under \*\*(\d+\.\d+\.\d+)\*\*/, label: 'AGENTS version pin' },
  { file: 'CONTRIBUTING.md', re: /The version is pinned at (\d+\.\d+\.\d+)/, label: 'CONTRIBUTING version pin' },
  { file: 'DEPLOY.md', re: /the pinned \*\*(\d+\.\d+\.\d+)\*\*/, label: 'DEPLOY battery line' },
  { file: 'DEPLOY.md', re: /currently ships under one number, `(\d+\.\d+\.\d+)`/, label: 'DEPLOY version-truth paragraph' },
  { file: 'labs/TASKS.md', re: /the pin wall enforces (\d+\.\d+\.\d+) everywhere/, label: 'labs/TASKS reminder line' },
  { file: '.github/workflows/release.yml', re: /^#\s+git tag v(\d+\.\d+\.\d+)$/m, label: 'release.yml tag example' },
];

test('version census: the living version claims are non-empty and derive from package.json (#41)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'package.json version must be a plain X.Y.Z the census can derive');
  // The scaffold kit's version stamp is the "side truth" (freestruct ships no
  // second package.json); it must equal the root exactly.
  const side = read('.', 'init/VERSION').trim();
  assert.strictEqual(side, pkg.version, 'init/VERSION drifted from package.json - the release commit moves them together');
  // Every claim pattern must match at least once, or the census has silently
  // stopped seeing a surface it is meant to guard (a broken regex must fail
  // loudly, never degrade to a green pass).
  for (const { file, re, label } of VERSION_CLAIMS) {
    const m = read('.', file).match(re);
    assert.ok(m, `census spec lost its shape: ${label} (${file}) did not match - fix the claim regex, do not drop the surface`);
    assert.strictEqual(m[1], pkg.version, `${label} (${file}) carries ${m[1]}, package.json says ${pkg.version} - move them together or drop the number`);
  }
});

test('version census: no living surface hand-copies a stale version (#41)', () => {
  const root = JSON.parse(read('.', 'package.json')).version;
  const stale = [];
  for (const { file, re, label } of VERSION_CLAIMS) {
    const body = read('.', file);
    re.lastIndex = 0;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(body)) !== null) {
      if (m[1] !== root) {
        const line = body.slice(0, m.index).split('\n').length;
        stale.push(`${file}:${line} ${label} carries ${m[1]}, truth is ${root}`);
      }
    }
  }
  assert.deepEqual(stale, [], stale.length ? `stale version claims found:\n${stale.join('\n')}` : '');
});

// ---------- count census (issue #43) ----------
// The version census above pins one class of hand-copied number; this pins the
// other: counts a living page asserts about the repo (test-battery size, engine
// module count). Both are DERIVED here from source, never hand-written, so a
// doc line can only ever say the true number. A claim's regex is anchored to the
// sentence that states the fact, so historical prose ("grew 49 -> 75 -> 103
// pins") never matches. A broken regex fails loudly instead of going green.
const ENGINE_MODULES = fs.readdirSync(path.join(ROOT, 'engine'))
  .filter((f) => f.endsWith('.js') && f !== 'inject.js').length;
const BATTERY_TESTS = (fs.readFileSync(path.join(ROOT, 'test', 'run.js'), 'utf8')
  .match(/^test\(/gm) || []).length;

const COUNT_CLAIMS = [
  { file: 'docs/index.md', re: /a (\d+)-test battery/, derive: () => BATTERY_TESTS, label: 'homepage battery size' },
  { file: 'AGENTS.md', re: /inject\.js` orchestrator \+ the (\w+) lib modules/, words: true, derive: () => ENGINE_MODULES, label: 'AGENTS engine module count' },
  { file: 'AGENTS.md', re: /the fixture battery \((\d+) pins\)/, derive: () => BATTERY_TESTS, label: 'AGENTS battery size' },
  { file: 'CONTRIBUTING.md', re: /one orchestrator \+ (\w+) modules/, words: true, derive: () => ENGINE_MODULES, label: 'CONTRIBUTING engine module count' },
  { file: 'CONTRIBUTING.md', re: /the battery \((\d+) pins\)/, derive: () => BATTERY_TESTS, label: 'CONTRIBUTING battery size' },
  { file: 'DEPLOY.md', re: /the fixture battery \((\d+) pins\)/, derive: () => BATTERY_TESTS, label: 'DEPLOY battery size' },
];

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

test('count census: living count claims are derived from source, never hand-copied (#43)', () => {
  assert.ok(BATTERY_TESTS > 0, 'the count census must see the battery');
  assert.ok(ENGINE_MODULES > 0, 'the count census must see the engine modules');
  for (const { file, re, words, derive, label } of COUNT_CLAIMS) {
    const m = read('.', file).match(re);
    assert.ok(m, `count census spec lost its shape: ${label} (${file}) did not match - fix the claim regex, do not drop the surface`);
    const expected = derive();
    const got = words ? NUM_WORDS.indexOf(m[1]) : Number(m[1]);
    assert.ok(got >= 0, `${label} (${file}) names "${m[1]}", which is not a known number word`);
    assert.strictEqual(got, expected, `${label} (${file}) says ${m[1]} (${got}); source says ${expected} - derive it, do not hand-copy`);
  }
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

test('cache steps ride one pinned actions/cache major (the #29 straggler class)', () => {
  const wfDir = path.join(ROOT, '.github', 'workflows');
  const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));
  const versions = new Map();
  for (const f of files) {
    const text = fs.readFileSync(path.join(wfDir, f), 'utf8');
    for (const m of text.matchAll(/uses:\s*actions\/cache@(v\d+)/g)) {
      if (!versions.has(m[1])) versions.set(m[1], []);
      versions.get(m[1]).push(f);
    }
  }
  assert.ok(versions.size > 0, 'at least one actions/cache step is present');
  assert.strictEqual(versions.size, 1, `every actions/cache step rides ONE major (found ${[...versions.entries()].map(([v, fs2]) => `${v} in ${fs2.join(',')}`).join('; ')})`);
  const [major] = versions.keys();
  assert.ok(Number(major.slice(1)) >= 6, `actions/cache is pinned at v6+ (found ${major})`);
});

test('docs layout: the rouge token block covers the common vocabulary (#30)', () => {
  const layout = fs.readFileSync(path.join(ROOT, 'docs', '_layouts', 'default.html'), 'utf8');
  assert.ok(/Rouge token colors/.test(layout), 'the rouge token block is present');
  // bash/js fences emit these families; each must carry a rule or the fence
  // renders half-painted (the #30 monochrome report).
  for (const cls of ['nb', 'nf', 'nv', 's', 's1', 's2', 'sb', 'si', 'c', 'c1', 'k', 'kd', 'nt', 'gp']) {
    assert.ok(new RegExp(`\\.highlight \\.${cls}\\b`).test(layout), `the token block styles .${cls}`);
  }
});

test('docs lane is reusable: docs.yml is a thin caller of the workflow_call lane (#31)', () => {
  const lanePath = path.join(ROOT, '.github', 'workflows', 'docs-lane.yml');
  const callerPath = path.join(ROOT, '.github', 'workflows', 'docs.yml');
  assert.ok(fs.existsSync(lanePath), 'the reusable docs lane ships');
  const lane = yamlLoad(fs.readFileSync(lanePath, 'utf8'));
  assert.ok(lane.on && 'workflow_call' in lane.on, 'the lane is on: workflow_call');
  const inputs = lane.on.workflow_call.inputs || {};
  for (const name of ['docs-path', 'output-dir', 'ruby-version', 'node-version', 'pagefind-version', 'crashtest-ref', 'freestruct-cmd', 'strict']) {
    assert.ok(name in inputs, `the lane exposes the ${name} input`);
  }
  // The receipts the inline lane kept must survive the promotion: both pagefind
  // scopes are cached, and the crashtest + pagefind installs stay pinned.
  const laneText = fs.readFileSync(lanePath, 'utf8');
  assert.match(laneText, /node_modules\/pagefind\n\s+node_modules\/@pagefind/, 'the pagefind cache carries BOTH scopes');
  assert.match(laneText, /github:dhaupin\/crashtest#\$/, 'crashtest install stays pinned to the input ref');
  assert.match(laneText, /pagefind@\$/, 'pagefind install stays pinned to the input version');

  const caller = yamlLoad(fs.readFileSync(callerPath, 'utf8'));
  const job = caller.jobs.docs;
  assert.ok(job && typeof job.uses === 'string' && job.uses.endsWith('docs-lane.yml'),
    'docs.yml dogfoods the lane via a uses: caller job (no inlined steps)');
  assert.ok(!job.steps, 'the caller carries no steps (the runbook lives in the lane)');
});

// ---------- staging flow (issue #44) ----------
// staging is the permanent integration branch: work lands there first, and
// staging -> main is the only promotion path. Two invariants keep that honest,
// and they pull against each other: CI must VERIFY staging (so the trigger
// lists include it), but a staging build must NEVER deploy to production. The
// trigger alone cannot carry the second invariant once it carries the first -
// the deploy job itself has to gate on the ref. This pins both.

test('staging flow: test.yml and docs.yml verify staging as well as main (#44)', () => {
  const branchesOf = (wf, event) => {
    const b = wf?.on?.[event]?.branches;
    return Array.isArray(b) ? b : (b ? [b] : []);
  };
  for (const file of ['test.yml', 'docs.yml']) {
    const wf = yamlLoad(read('.github/workflows', file));
    for (const event of ['push', 'pull_request']) {
      const branches = branchesOf(wf, event);
      assert.ok(branches.includes('main'), `${file} ${event} triggers on main`);
      assert.ok(branches.includes('staging'), `${file} ${event} triggers on staging (work is verified where it lands)`);
    }
  }
});

test('staging flow: the reusable docs lane gates its deploy job to main, so no caller can publish staging (#44)', () => {
  const lane = yamlLoad(read('.github/workflows', 'docs-lane.yml'));
  const deploy = lane.jobs.deploy;
  assert.ok(deploy, 'the lane carries a deploy job');
  // The load-bearing guard: without this, adding staging to any caller's
  // trigger list publishes staging content to production. It must live in the
  // reusable lane (not the caller) so every caller inherits it.
  assert.strictEqual(deploy.if, "github.ref == 'refs/heads/main'",
    'the deploy job is gated to main by ref (a staging push or a PR merge ref skips it)');
  // And the caller must NOT re-implement the guard - the whole point of the
  // lane is that the guard is defined once.
  const caller = yamlLoad(read('.github/workflows', 'docs.yml'));
  assert.ok(!caller.jobs.docs.if, 'the caller does not re-implement the deploy guard (it lives in the lane)');
});

test('staging flow: the promotion fast-forward is documented, so the integration branch never drifts (#44)', () => {
  // A merge-commit promotion leaves main one commit ahead of staging on every
  // promotion, even when the flow is followed exactly. The sync is a required
  // step, so the house rules must name it (the command is the one bit of the
  // flow a battery can check; the git operation itself is a human/CI act).
  const agents = read('.', 'AGENTS.md');
  assert.match(agents, /git push origin origin\/main:staging/,
    'AGENTS.md names the promotion fast-forward (git push origin origin/main:staging)');
  assert.match(agents, /fast-forward `staging` to `main`/i,
    'AGENTS.md states the fast-forward rule in prose, not just as a bare command');
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

test('init kit (issue #33): the starter config seeds the family identity - founder + maintainer JSON-LD, no unknown keys', () => {
  // The shipped init kit config, verbatim, must scaffold ownership from birth.
  const seeded = fs.readFileSync(path.join(ROOT, 'init', 'docs', 'freestruct.config.yml'), 'utf8');
  const dir = scenario('main', { 'docs/ssr-config.yml': seeded });
  try {
    const stdout = runInject(dir);
    assert.ok(!/unknown config key/.test(stdout), 'the seeded starter config is schema-clean');
    const html = read(dir, 'docs/_site/index.html');
    assert.includes(html, '"founder": { "@type": "Person", "name": "Creadev.org", "url": "https://creadev.org" }',
      'the author block ships the family founder');
    assert.includes(html, '"name":"your-github-handle"', 'the jsonLd maintainer placeholder reaches the page');
    assert.includes(html, '"jobTitle":"My Docs maintainer"', 'the maintainer jobTitle is wired');
  } finally { rmDir(dir); }
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

test('linkcheck: an UPPER-CASE HREF is checked too, so --strict catches it (case-insensitive attrs)', () => {
  const dir = scenario('main', {
    'docs/_site/caps.html': "<html><head><title>C</title></head><body><A HREF='/gone-caps/'>caps</A><a href='/ok2/'>ok</a></body></html>\n",
    'docs/_site/ok2/index.html': '<html><head><title>Ok</title></head><body>ok</body></html>\n',
  });
  try {
    // HTML attribute names are case-insensitive: an upper-case HREF is a real
    // link. The matcher was the one href regex without /i, so the broken
    // target shipped green under --strict.
    const out = runInject(dir);
    assert.includes(out, '/gone-caps/', 'an upper-case HREF broken link is reported');
    assert.ok(!/-> \/ok2\//.test(out), 'a resolvable upper-case link is not flagged');
    const strict = runInjectFailing(dir, ['--strict']);
    assert.strictEqual(strict.status, 1, '--strict fails on the upper-case break');
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

test('missing-only: an UPPER-CASE description meta still suppresses injection (case-insensitive gate)', () => {
  const dir = scenario('main');
  try {
    // Valid HTML: an SSG or hand-authored page may write the meta in caps.
    // The description branch of hasSeoType used to be the one branch without
    // the /i flag, so the gate missed it and freestruct injected a SECOND
    // description - which its own audit then FAILed as a duplicate.
    const idx = path.join(dir, 'docs/_site/index.html');
    let html = fs.readFileSync(idx, 'utf8');
    html = html.replace('</head>', '<META NAME="description" CONTENT="Page own desc">\n</head>');
    fs.writeFileSync(idx, html);

    runInject(dir);
    const out = read(dir, 'docs/_site/index.html');
    assert.strictEqual((out.match(/name="description"/gi) || []).length, 1,
      'the upper-case meta is honored; no second description injected');

    const res = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!/duplicate meta description/.test(res.stdout + res.stderr),
      'no engine-caused duplicate for the audit to fail');
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

test('rerun hygiene: body-start/footer snippets never duplicate and the build hash stays put (bug fix)', () => {
  const dir = scenario('main');
  try {
    // The main fixture ships a header snippet; add the body-start + footer
    // pair the bug reproduced with (they live in the BODY, so the old
    // marker-only strip in computeBuildHash could not neutralize them).
    fs.writeFileSync(path.join(dir, 'docs/_freestruct/inject-body-start.html'), '<div id="bs">BODYSTART</div>\n');
    fs.writeFileSync(path.join(dir, 'docs/_freestruct/inject-footer.html'), '<div id="ft">FOOTER</div>\n');
    const hashOf = () => read(dir, 'docs/_site/index.html').match(/<meta name="freestruct-build" content="([0-9a-f]{8})"/)[1];
    const first = runInject(dir);
    const hashA = hashOf();
    runInject(dir);
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    assert.strictEqual((html.match(/id="bs"/g) || []).length, 1, 'body-start snippet injected exactly once after a rerun');
    assert.strictEqual((html.match(/id="ft"/g) || []).length, 1, 'footer snippet injected exactly once after a rerun');
    assert.strictEqual((html.match(/<!-- freestruct -->/g) || []).length, 1, 'the generated head marker stays single');
    assert.strictEqual((html.match(/<meta name="freestruct-build"/g) || []).length, 1, 'the build meta stays single');
    assert.strictEqual(hashOf(), hashA, 'the content-derived hash does not churn across reruns');
    void first;
  } finally { rmDir(dir); }
});

test('rerun hygiene: the table wrapper does not churn the content-derived build hash (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/table.html': '<html><head><title>Table</title></head><body><table><tr><td>1</td></tr></table></body></html>\n',
  });
  try {
    const hashOf = () => read(dir, 'docs/_site/table.html').match(/<meta name="freestruct-build" content="([0-9a-f]{8})"/)[1];
    runInject(dir);
    const hashA = hashOf();
    // The tableWrap pass runs AFTER computeBuildHash, so run 1 hashes the bare
    // table and run 2 sees the wrapper the first run added - without the strip
    // in stable() the hash churned on every pass for any site with a table.
    runInject(dir);
    assert.strictEqual(hashOf(), hashA, 'the hash does not churn when a table gains its wrapper');
    assert.strictEqual((read(dir, 'docs/_site/table.html').match(/class="fs-table-wrap"/g) || []).length, 1, 'the wrapper stays single across reruns');
  } finally { rmDir(dir); }
});

test('minify: verbatim blocks survive byte-for-byte and attribute-form tags are protected (bug fix)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com',
      'minify: true',
    ].join('\n') + '\n',
    'docs/_site/code.html': [
      '<html><head><title>Code</title></head><body>',
      '<p>a</p>',
      '<p>b</p>',
      '<pre class="highlight"><code>def foo():',
      '    return 1',
      '</code></pre>',
      '<script>',
      '// keep this comment line',
      'var x = 1;',
      '</script>',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/code.html');
    // <pre class="..."> (attribute form) must be detected: its inner newlines
    // and indentation are significant and survive untouched.
    assert.includes(html, 'def foo():\n    return 1', 'pre class="..." content preserved byte-for-byte');
    // Inline JS with a // comment must not be collapsed onto one line (that
    // would comment out the rest of the script).
    assert.includes(html, '// keep this comment line\nvar x = 1;', 'inline script newlines preserved');
    // Outside blocks, redundant whitespace is still removed (body region:
    // late-pass head metas are appended after minify by design).
    assert.includes(html, '<body><p>a</p>', 'inter-tag whitespace outside blocks is minified');
  } finally { rmDir(dir); }
});

test('cache-busting: asset links shown in a code example are left as-is, live ones still bust (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/code.html': [
      '<html><head><title>Code</title></head><body>',
      '<pre><code>&lt;link href="/style.css"&gt;</code></pre>',
      '<code>&lt;script src="/app.js"&gt;&lt;/script&gt;</code>',
      '<script>var s = \'<link href="/inline.css">\';</script>',
      '<link rel="stylesheet" href="/real.css">',
      '<script src="/live.js"></script>',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/code.html');
    // A docs page that SHOWS a link must not have its example rewritten.
    assert.includes(html, '&lt;link href="/style.css"&gt;', 'the <pre><code> example is not busted');
    assert.includes(html, '&lt;script src="/app.js"&gt;', 'the inline-code example is not busted');
    assert.includes(html, "'<link href=\"/inline.css\">'", 'a link inside a script body is not busted');
    // Live attributes still bust.
    assert.match(html, /href="\/real\.css\?v=[0-9a-f]{8}"/, 'a live stylesheet link is busted');
    assert.match(html, /<script src="\/live\.js\?v=[0-9a-f]{8}"><\/script>/, 'a live script src is busted');
    // Rerun idempotency: the protected regions survive a second pass unchanged.
    runInject(dir);
    const again = read(dir, 'docs/_site/code.html');
    assert.includes(again, '&lt;link href="/style.css"&gt;', 'example still intact after a rerun');
    assert.match(again, /href="\/real\.css\?v=[0-9a-f]{8}"/, 'live asset still single-busted after a rerun');
  } finally { rmDir(dir); }
});

test('cache-busting: an asset carrying an existing query or fragment is still busted (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/queried.html': [
      '<html><head><title>Queried</title></head><body>',
      '<link rel="stylesheet" href="/style.css?foo=bar">',
      '<link rel="stylesheet" href="/legacy.css#iefix">',
      '<script src="/app.js?x=1"></script>',
      '<img src="/pic.png?a=b#frag">',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/queried.html');
    // Before the fix the raw value's "ext" was '.css?foo=bar' / '.css#iefix',
    // so the asset missed the set and was never busted (stale at the edge).
    assert.match(html, /href="\/style\.css\?foo=bar&v=[0-9a-f]{8}"/, 'an existing query keeps its param and gains v=');
    assert.match(html, /href="\/legacy\.css\?v=[0-9a-f]{8}#iefix"/, 'a fragment is preserved after the injected query');
    assert.match(html, /src="\/app\.js\?x=1&v=[0-9a-f]{8}"/, 'a script with a query is busted');
    assert.match(html, /src="\/pic\.png\?a=b&v=[0-9a-f]{8}#frag"/, 'query + fragment both survive, v= inserted');
  } finally { rmDir(dir); }
});

test('cache-busting: only real asset extensions are busted, case-insensitively (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/exts.html': [
      '<html><head><title>Exts</title></head><body>',
      '<a href="/x.cs">cs</a>',
      '<a href="/x.tt">tt</a>',
      '<a href="/x.j">j</a>',
      '<a href="/real.css">css</a>',
      '<a href="/img.PNG">upper png</a>',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/exts.html');
    // '.cs' / '.tt' / '.j' are NOT assets (old substring test busted them).
    assert.ok(/href="\/x\.cs"/.test(html), 'a .cs href is not cache-busted');
    assert.ok(/href="\/x\.tt"/.test(html), 'a .tt href is not cache-busted');
    assert.ok(/href="\/x\.j"/.test(html), 'a .j href is not cache-busted');
    assert.match(html, /href="\/real\.css\?v=[0-9a-f]{8}"/, 'a real .css href is busted');
    assert.match(html, /href="\/img\.PNG\?v=[0-9a-f]{8}"/, 'an uppercase .PNG is busted (case-insensitive)');
  } finally { rmDir(dir); }
});

test('linkcheck: single-quoted hrefs are checked too, so --strict catches them (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/quotes.html': "<html><head><title>Q</title></head><body><a href='/gone-sq/'>sq</a><a href=\"/gone-dq/\">dq</a><a href='/ok/'>ok</a></body></html>\n",
    'docs/_site/ok/index.html': '<html><head><title>Ok</title></head><body>ok</body></html>\n',
  });
  try {
    const out = runInject(dir);
    assert.includes(out, '/gone-sq/', 'a single-quoted broken link is reported');
    assert.includes(out, '/gone-dq/', 'a double-quoted broken link is reported');
    assert.ok(!/-> \/ok\//.test(out), 'a resolvable single-quoted link is not flagged');
    const strict = runInjectFailing(dir, ['--strict']);
    assert.strictEqual(strict.status, 1, '--strict fails on the single-quoted break');
  } finally { rmDir(dir); }
});

test('linkcheck: a query string on an internal link is not a broken route (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/queried.html': '<html><head><title>Q</title></head><body><a href="/ok?utm_source=x">ok query</a><a href="/ok/?s=hi">ok query slash</a><a href="/ok/index.html?x=1">ok file query</a><a href="/gone?q=1">gone query</a></body></html>\n',
    'docs/_site/ok/index.html': '<html><head><title>Ok</title></head><body>ok</body></html>\n',
  });
  try {
    const out = runInject(dir);
    // Before the fix the query rode into the resolved path, so '/ok?utm_source=x'
    // looked for a file literally named 'ok?utm_source=x' and was reported broken.
    assert.ok(!/-> \/ok\?utm_source=x/.test(out), 'a query on a valid directory link is not flagged');
    assert.ok(!/-> \/ok\/\?s=hi/.test(out), 'a query on a trailing-slash link is not flagged');
    assert.ok(!/-> \/ok\/index\.html\?x=1/.test(out), 'a query on a valid file link is not flagged');
    assert.includes(out, '/gone?q=1', 'a genuinely missing link is still reported with its query');
    const strict = runInjectFailing(dir, ['--strict']);
    assert.strictEqual(strict.status, 1, '--strict still fails on the real break only');
  } finally { rmDir(dir); }
});

test('cli: -h is a help alias like --help (bug fix - it used to ride as an output dir)', () => {
  const dir = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, '-h'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, '-h exits 0');
    assert.includes(res.stdout, 'freestruct -- post-build SEO layer', '-h prints the help text');
    assert.ok(!/Output directory not found/.test(res.stdout + res.stderr), '-h never rides as a positional output dir');
    // Control: a real typo'd flag still fails loudly (not silently as a dir).
    const bad = runInjectFailing(dir, ['--definitely-not-a-flag']);
    assert.strictEqual(bad.status, 1);
  } finally { rmDir(dir); }
});

test('audit: a basePath without its leading slash still strips from the og:image on-disk check (bug fix)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com',
      'basePath: myproject',
      'og:', '  image: /og.png',
    ].join('\n') + '\n',
  });
  try {
    // The real image sits at the tree root (served under /myproject/og.png);
    // the audit must resolve the stripped path and NOT warn it is missing.
    fs.writeFileSync(path.join(dir, 'docs/_site/og.png'), 'PNG');
    const res = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    const out = res.stdout + res.stderr;
    assert.ok(!/og:image points at .* which does not exist on disk/.test(out),
      'basePath (no leading slash) is normalized before the on-disk resolve');
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

test('reading-time: script/style bodies and comments do not count as prose (bug fix)', () => {
  const scriptWords = Array.from({ length: 600 }, (_, i) => 'w' + i).join(' ');
  const dir = scenario('main', {
    'docs/_site/rt.html': [
      '<html><head><title>RT</title></head><body>',
      '<p>one two three four five</p>',
      '<script>' + scriptWords + '</script>',
      '<style>.a{color:red} .b{color:blue}</style>',
      '<!-- ' + scriptWords + ' -->',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/rt.html');
    const minutes = Number(html.match(/<meta name="reading-time" content="(\d+) min read">/)[1]);
    // The estimator stripped tags only, so a 600-word inline script (and a
    // comment) counted as page prose and inflated the estimate to 4 minutes
    // for a five-word page. Only the five real words should count now.
    assert.strictEqual(minutes, 1, 'inline script/style/comment words do not count');
  } finally { rmDir(dir); }
});

test('lazy-loading: a self-closing <img/> stays well-formed (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/selfclose.html': [
      '<html><head><title>SelfClose</title></head><body>',
      '<img src="/img/a.png"/>',
      '<img src="/img/b.png" />',
      '<img src="/img/c.png" alt="c">',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/selfclose.html');
    // No dangling '/ loading=' artifact: the attribute lands before the close.
    assert.ok(!/\/\s+loading="lazy"/.test(html), 'no malformed "/ loading=" artifact');
    assert.match(html, /<img src="\/img\/a\.png\?v=[0-9a-f]{8}" loading="lazy">/, 'self-closing img repaired and lazied');
    assert.match(html, /<img src="\/img\/b\.png\?v=[0-9a-f]{8}" loading="lazy">/, 'spaced self-closing img repaired and lazied');
    assert.match(html, /<img src="\/img\/c\.png\?v=[0-9a-f]{8}" alt="c" loading="lazy">/, 'plain img still lazied');
  } finally { rmDir(dir); }
});

test('lazy-loading: an existing LOADING attribute (any case) is not duplicated (bug fix)', () => {
  const dir = scenario('main', {
    'docs/_site/caps-loading.html': [
      '<html><head><title>Caps</title></head><body>',
      '<img src="/img/a.png" LOADING="eager">',
      '<img src="/img/b.png" loading = "eager">',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/caps-loading.html');
    // Attribute names are case-insensitive and whitespace around '=' is legal,
    // so the lowercase-only guard let these collect a SECOND loading attribute.
    const imgs = html.match(/<img[^>]*>/gi) || [];
    assert.strictEqual(imgs.length, 2);
    for (const img of imgs) {
      assert.strictEqual((img.match(/loading\s*=/gi) || []).length, 1, 'exactly one loading attribute per img: ' + img);
    }
    assert.ok(!/loading="lazy"/i.test(html), 'an author-set loading wins; nothing overwritten');
  } finally { rmDir(dir); }
});

test('table guard (issue #35): wide tables wrap in a scroll container, nested wrap once, idempotent, opt-out', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com',
      '  description: A test docs site', '',
    ].join('\n'),
    'docs/_site/tables.html': '<html><head><title>Tables</title></head><body><h1>Tables</h1>'
      + '<table><tr><td>plain</td></tr></table>'
      + '<div class="printable"><table><tr><td>after printable</td></tr></table></div>'
      + '<div class="table-wrap"><table><tr><td>already</td></tr></table></div>'
      + '<table><tr><td>outer<table><tr><td>inner</td></tr></table></td></tr></table>'
      + '</body></html>',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/tables.html');
    // 3 wrappers: plain, printable-neighbour, outer (the nested inner shares its outer's)
    assert.strictEqual((html.match(/fs-table-wrap/g) || []).length, 3, 'exactly the outermost tables wrap');
    assert.includes(html, '<div class="fs-table-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%"><table><tr><td>plain</td></tr></table></div>',
      'the plain table is wrapped with the inline scroll container');
    assert.includes(html, '<div class="printable"><div class="fs-table-wrap"',
      'a table after an unrelated class="printable" div still wraps (delimited-segment match)');
    assert.includes(html, '<div class="table-wrap"><table><tr><td>already</td></tr></table></div>',
      'a consumer .table-wrap is left alone (no double container)');
    assert.includes(html, 'outer<table>', 'the nested table stays inside its outer wrap');
    // idempotent: a second pass must not stack wrappers
    runInject(dir);
    assert.strictEqual((read(dir, 'docs/_site/tables.html').match(/fs-table-wrap/g) || []).length, 3,
      'a second run does not stack wrappers');
  } finally { rmDir(dir); }

  // opt-out + a table-less page is a no-op (no rewrite, no hash flip)
  const dir2 = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com',
      '  description: A test docs site', 'tableWrap: false', '',
    ].join('\n'),
    'docs/_site/tables.html': '<html><head><title>Tables</title></head><body><h1>T</h1><table><tr><td>x</td></tr></table></body></html>',
  });
  try {
    runInject(dir2);
    assert.ok(!read(dir2, 'docs/_site/tables.html').includes('fs-table-wrap'), 'tableWrap: false opts out');
  } finally { rmDir(dir2); }
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

test('search.json: content and heading carry plain text, never script/style bodies or tags (bug fix)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com',
      '  description: A test docs site', 'searchIndex: true',
    ].join('\n') + '\n',
    'docs/_site/leaky.html': [
      '<html><head><title>Leaky</title></head><body>',
      '<h1>Title <em>with</em> <code>markup</code></h1>',
      '<p>Visible prose</p>',
      '<script>var token = "SHOULD_NOT_INDEX";</script>',
      '<style>.x{color:red}</style>',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const idx = JSON.parse(read(dir, 'docs/_site/search.json'));
    const entry = idx.find(e => e.url === 'https://docs.example.com/leaky');
    assert.ok(entry, 'leaky page is indexed');
    // Before the fix the body pass stripped tags only, so a script/style body
    // shipped its raw source into the index; the h1 pass returned inner HTML.
    assert.ok(!entry.content.includes('SHOULD_NOT_INDEX'), 'script body is not in the index');
    assert.ok(!entry.content.includes('color:red'), 'style body is not in the index');
    assert.ok(!/<[a-z]/i.test(entry.content), 'content carries no tags');
    assert.ok(!/<[a-z]/i.test(entry.heading), 'heading carries no tags');
    assert.strictEqual(entry.heading, 'Title with markup', 'heading is the readable text of the h1');
    assert.includes(entry.content, 'Visible prose', 'visible prose is kept');
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

test('generated 404: a quote- or markup-bearing site name is escaped, not injected (bug fix)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: "Evil <script>alert(1)</script> & \\"Co\\""',
      '  url: https://docs.example.com',
      '  description: A test docs site',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/404.html');
    // The generated 404 interpolated the raw site name into <title>/text and
    // the raw home URL into href/action; a name with '<'/'"' broke the title
    // and injected live markup into the error page.
    assert.ok(!/<script>alert\(1\)<\/script>/.test(html), 'no live script tag from the site name');
    assert.includes(html, '&lt;script&gt;alert(1)&lt;/script&gt;', 'the site name is escaped in the title');
    assert.includes(html, '&quot;Co&quot;', 'the embedded quote is escaped');
    assert.ok(!/name="Evil/.test(html), 'no broken attribute from the raw name');
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

test('404 noindex survives a rerun (bug fix: the strip swallowed it on run 2)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    // Run 2: the marker from run 1 now precedes </head>, so the pre-injection
    // noindex landed INSIDE the region stripInjectedRegions deletes and was
    // dropped - the audit then failed the 404 it had just passed.
    runInject(dir);
    const html = read(dir, 'docs/_site/404.html');
    assert.strictEqual((html.match(/<meta name="robots" content="noindex, nofollow">/g) || []).length, 1,
      'exactly one noindex after a rerun (not zero, not two)');
  } finally { rmDir(dir); }
});

test('feed.xml: pubDate/lastmod stay put across a rerun (freestruct does not date its own writes)', () => {
  const dir = scenario('main');
  try {
    // freestruct rewrites every decorated page, so without restoring the
    // pre-injection mtime the NEXT run captured freestruct's own write as the
    // page date - and pubDate/lastmod churned every rerun with no content
    // change, contradicting the honest-date contract (issue #9).
    const guideMtime = new Date('2026-01-02T03:04:05Z');
    fs.utimesSync(path.join(dir, 'docs/_site/guide/index.html'), guideMtime, guideMtime);
    const pubOf = (feed) => {
      const item = (feed.match(/<item>[\s\S]*?<\/item>/g) || [])
        .find(b => b.includes('<guid>https://docs.example.com/guide/</guid>'));
      return (item.match(/<pubDate>([^<]*)<\/pubDate>/) || [])[1];
    };
    const locOf = (sm) => {
      const block = (sm.match(/<url>[\s\S]*?<\/url>/g) || [])
        .find(b => b.includes('<loc>https://docs.example.com/guide/</loc>'));
      return (block.match(/<lastmod>([^<]*)<\/lastmod>/) || [])[1];
    };
    runInject(dir);
    const pub1 = pubOf(read(dir, 'docs/_site/feed.xml'));
    const loc1 = locOf(read(dir, 'docs/_site/sitemap.xml'));
    runInject(dir);
    const pub2 = pubOf(read(dir, 'docs/_site/feed.xml'));
    const loc2 = locOf(read(dir, 'docs/_site/sitemap.xml'));
    assert.strictEqual(pub1, 'Fri, 02 Jan 2026 03:04:05 GMT', 'run 1 carries the pre-run mtime');
    assert.strictEqual(pub2, pub1, 'pubDate does not drift on a rerun');
    assert.strictEqual(loc2, loc1, 'sitemap lastmod does not drift on a rerun');
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
      'tableWrap: false',
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
      'og:',
      '  image: /og.png',
      ''
    ].join('\n')
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/index.html');
    // tree nests _site at root -> canonical = url + basePath + slug
    assert.includes(html, '<link rel="canonical" href="https://docs.example.com/help/">');
    assert.includes(html, '<meta property="og:url" content="https://docs.example.com/help/">');
    // og:image is a site-local asset (served under basePath like every other
    // root asset); the old site.url + src join pointed at the domain root,
    // where the share preview 404s on a sub-path install.
    assert.includes(html, '<meta property="og:image" content="https://docs.example.com/help/og.png">',
      'og:image carries the basePath prefix');

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

test('purge hooks: every configured hook is reported when disabled, not just the first (bug fix)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      'cacheBusting:',
      '  purge:',
      '    - name: cloudflare',
      '      command: echo cf',
      '    - name: fastly',
      '      command: echo fastly',
      '    - name: bunny',
      '      command: echo bunny',
    ].join('\n') + '\n');
    const out = runInject(dir);
    // The old disabled branch `return`ed inside the loop, so only cloudflare
    // printed and the other two were silently hidden.
    assert.includes(out, 'Purge hook cloudflare: running...');
    assert.includes(out, 'Purge hook fastly: running...');
    assert.includes(out, 'Purge hook bunny: running...');
  } finally { rmDir(dir); }
});

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

test('purge hooks: the FREESTRUCT_* env vars reach the child (bug fix - README claimed them)', () => {
  const dir = scenario('main');
  try {
    const marker = path.join(dir, 'purge-env.txt');
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      'runHooks: true',
      'cacheBusting:',
      '  purge:',
      '    - name: envcanary',
      `      command: node -e "require('fs').writeFileSync(process.argv[1], [process.env.FREESTRUCT_SITE_URL, process.env.FREESTRUCT_BUILD_HASH, process.env.FREESTRUCT_OUTPUT_DIR].join('|'))" ${marker}`,
    ].join('\n') + '\n');
    const out = runInject(dir);
    const hash = (out.match(/freestruct: Done \(([0-9a-f]{0,8})\)/) || [])[1];
    assert.ok(fs.existsSync(marker), 'the purge hook ran');
    const parts = fs.readFileSync(marker, 'utf8').split('|');
    assert.strictEqual(parts[0], 'https://docs.example.com', 'FREESTRUCT_SITE_URL reaches the child');
    assert.strictEqual(parts[1], hash, 'FREESTRUCT_BUILD_HASH reaches the child');
    assert.ok(parts[2].endsWith(path.join('docs', '_site')), 'FREESTRUCT_OUTPUT_DIR reaches the child');
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

test('audit: a valid description meta with a leading attribute is not a false FAIL (bug fix)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const idx = path.join(dir, 'docs/_site/index.html');
    // Rewrite the description meta with another attribute FIRST (valid HTML);
    // the audit's grabMeta must still find it (old single-char class did not).
    const before = fs.readFileSync(idx, 'utf8');
    assert.match(before, /<meta name="description"/, 'fixture page carries an injected description meta');
    fs.writeFileSync(idx, before
      .replace(/<meta name="description" content="([^"]*)"\s*\/?>/i,
        '<meta charset="utf-8" name="description" content="$1">'));
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!/FAIL .*missing meta description/.test(out.stdout),
      'a description meta carrying a leading attribute is still found\n' + out.stdout);
  } finally { rmDir(dir); }
});

test('audit: an attribute value carrying the OTHER quote kind is read whole (apostrophe bug fix)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const idx = path.join(dir, 'docs/_site/index.html');
    // A description with an apostrophe ("this repo's docs") used to truncate at
    // the apostrophe, so the audit measured a short length and warned
    // "outside 70-165" on a perfectly good description.
    const desc = "this repo's docs - a scratch copy, a strict run, and a local server for previewing";
    fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
      .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${desc}">`));
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!/WARN index\.html: description \d+ chars/.test(out.stdout),
      'an apostrophe inside the description does not fake a length warning\n' + out.stdout);
  } finally { rmDir(dir); }
});

test('audit: title/description length grades the DECODED text, not the raw markup (bug fix)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const idx = path.join(dir, 'docs/_site/index.html');
    // 60 VISIBLE characters, but every letter is a numeric entity: the raw
    // match is 240 chars, so the old raw-length grader warned "> 65" on a
    // title that renders well inside the band.
    const titleVisible = 'Plenty long enough title here for the audit band okay';
    const titleRaw = titleVisible.replace(/[a-z]/g, (c) => '&#' + c.charCodeAt(0) + ';');
    // 80 VISIBLE characters as '&amp;' runs: raw 400, decoded 80 (in band).
    const descVisible = 'A'.repeat(80);
    const descRaw = descVisible.replace(/A/g, '&amp;');
    fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
      .replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${titleRaw}</title>`)
      .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${descRaw}">`));
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!/WARN index\.html: title \d+ chars/.test(out.stdout),
      'an entity-heavy title is not graded on its markup length\n' + out.stdout);
    assert.ok(!/WARN index\.html: description \d+ chars/.test(out.stdout),
      'an entity-heavy description is not graded on its markup length\n' + out.stdout);
  } finally { rmDir(dir); }
});

test('audit: a noindex page is exempt from the content-quality classes but not the structural ones', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const stub = path.join(dir, 'docs/_site/stub.html');
    // A redirect stub: noindex, a short description, no h1, no JSON-LD. The
    // content-quality classes grade indexable content, so they must stay quiet
    // here (the page is deliberately out of the index); the structural classes
    // (title/canonical presence) still apply.
    fs.writeFileSync(stub, [
      '<html lang="en"><head><meta charset="UTF-8">',
      '<title>Moved</title>',
      '<meta name="robots" content="noindex, nofollow">',
      '<meta name="description" content="Short stub.">',
      '<link rel="canonical" href="https://docs.example.com/real">',
      '</head><body><p>moved</p></body></html>',
    ].join('\n'));
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(!/WARN stub\.html: description \d+ chars/.test(out.stdout), 'no description-length noise on a noindex stub\n' + out.stdout);
    assert.ok(!/WARN stub\.html: no non-empty <h1>/.test(out.stdout), 'no h1 noise on a noindex stub\n' + out.stdout);
    assert.ok(!/WARN stub\.html: no JSON-LD/.test(out.stdout), 'no JSON-LD noise on a noindex stub\n' + out.stdout);
    // Control: the SAME shape without noindex still gets graded.
    fs.writeFileSync(stub, fs.readFileSync(stub, 'utf8').replace(/<meta name="robots"[^>]*>\n?/, ''));
    const out2 = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.ok(/WARN stub\.html: description \d+ chars/.test(out2.stdout), 'without noindex the description IS graded (control)\n' + out2.stdout);
    assert.ok(/WARN stub\.html: no non-empty <h1>/.test(out2.stdout), 'without noindex the h1 absence IS graded (control)\n' + out2.stdout);
  } finally { rmDir(dir); }
});

test('audit: duplicate head tags ride the FAIL class (never engine-caused - missing-only cannot duplicate)', () => {
  const dir = scenario('main');
  try {
    runInject(dir);
    const idx = path.join(dir, 'docs/_site/index.html');
    const html = fs.readFileSync(idx, 'utf8');
    fs.writeFileSync(idx, html
      .replace('</title>', '</title>\n<title>Second</title>')
      .replace(/<link rel="canonical"[^>]*>/i, (m) => m + '\n<link rel="canonical" href="https://docs.example.com/other">')
      .replace(/<meta name="description"[^>]*>/i, (m) => m + '\n<meta name="description" content="second description planted by the doctor pass">')
      .replace(/<meta property="og:title"[^>]*>/i, (m) => m + '\n<meta property="og:title" content="Duplicated">'));
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 1, 'a duplicated head surface exits 1');
    assert.includes(out.stdout, 'duplicate canonical link');
    assert.includes(out.stdout, 'duplicate meta description');
    assert.includes(out.stdout, 'duplicate og:title');
    assert.includes(out.stdout, 'multiple <title> elements');
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

test('audit: config-gated absences collapse to one line each with a page count (issue #28)', () => {
  const dir = scenario('main');
  try {
    // No og.image configured -> the engine ships no og:image / twitter:image
    // anywhere; the audit must say so ONCE, not once per page.
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      '',
    ].join('\n'));
    runInject(dir);
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 0, 'config-gated absence is report-grade\n' + out.stdout);
    // ONE config line each, with a count - and no per-page og:image rows.
    assert.includes(out.stdout, 'WARN config: og:image not configured - ', 'og:image collapses to one config line');
    assert.includes(out.stdout, 'page(s) affected', 'the config line carries an affected-page count');
    assert.includes(out.stdout, 'WARN config: twitter:image not configured - ', 'twitter:image collapses too');
    assert.ok(!/WARN [^:]*\.html: og:image absent/.test(out.stdout), 'no per-page og:image noise');
    assert.ok(!/WARN [^:]*\.html: twitter:image absent/.test(out.stdout), 'no per-page twitter:image noise');

    // The count matches the non-404 page total (7 baked pages - 1 404).
    const countMatch = out.stdout.match(/og:image not configured - (\d+) page\(s\)/);
    assert.ok(countMatch, 'count present');
    assert.strictEqual(countMatch[1], '6', 'the count is the real affected-page total');

    // Page-shaped classes still repeat (the distinguishing test from the ask):
    // a page shipping its own partial og set still warns per page.
    assert.includes(out.stdout, 'og:url absent', 'SSG-partial-set coherence stays per-page');

    // The JSON digest carries the collapsed rows on the config page key.
    const jsonOut = spawnSync(process.execPath, [INJECT, 'audit', '--json'], { cwd: dir, encoding: 'utf8' });
    const digest = JSON.parse(jsonOut.stdout);
    assert.ok(digest.warns.some(w => w.page === 'config' && /og:image not configured/.test(w.msg)), 'digest carries the config row');
  } finally { rmDir(dir); }
});

test('audit: og.scoped partial coverage keeps the collapsed line truthful (issue #28 edge)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'og:',
      '  scoped:',
      '    "/guide/**": /guide.png',
      '',
    ].join('\n'),
  });
  try {
    runInject(dir);
    const out = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(out.status, 0, 'scoped-partial absence stays report-grade\n' + out.stdout);
    // og.image IS configured (via og.scoped) - the line must not claim
    // otherwise, and must still collapse to one row with a count.
    assert.includes(out.stdout, 'og:image absent on ', 'partial coverage reads as absent-on-N, not not-configured');
    assert.ok(!/config: og:image not configured/.test(out.stdout), 'no false not-configured claim when og.scoped is set');
    assert.includes(out.stdout, 'WARN config: twitter:image absent on ', 'twitter:image tracks the same config state');
  } finally { rmDir(dir); }
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
      '<sitemap><url><loc>https://docs.example.com/</loc><lastmod>2026-10-22</lastmod></url>'
      + '<url><loc>https://docs.example.com/a&amp;b</loc><lastmod>2026-10-22</lastmod></url></sitemap>');
    const res2 = spawnSync(process.execPath, [INJECT, 'indexnow', '--dry-run'], { cwd: dir2, encoding: 'utf8' });
    assert.strictEqual(res2.status, 0, 'dry-run is exit 0');
    const body = (res2.stdout + '') || '';
    assert.includes(body, 'https://docs.example.com/', 'urlList carries the sitemap URL');
    // The sitemap writer XML-escapes '&' to '&amp;'; submission must decode it
    // back or the engines are asked to crawl a URL that does not exist.
    assert.includes(body, 'https://docs.example.com/a&b', 'escaped &amp; in <loc> decodes before submission');
    assert.ok(!body.includes('a&amp;b'), 'the escaped form is not posted');
    assert.includes(body, 'keyLocation', 'the request names the keyLocation');
  } finally { rmDir(dir2); }

  const dir3 = scenario('main');
  try {
    const res = spawnSync(process.execPath, [INJECT, 'indexnow'], { cwd: dir3, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'indexnow without config -> loud config fatal');
  } finally { rmDir(dir3); }
});

test('indexnow: keyLocation honors basePath (a sub-path install probes the served key file, not the domain root)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'basePath: /myproject',
      'indexNow:',
      '  key: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'docs/_site/sitemap.xml'),
      '<sitemap><url><loc>https://docs.example.com/myproject/</loc><lastmod>2026-10-22</lastmod></url></sitemap>');
    const res = spawnSync(process.execPath, [INJECT, 'indexnow', '--dry-run'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, 'dry-run is exit 0');
    const payload = JSON.parse(res.stdout.slice(res.stdout.indexOf('{')));
    // The key file ships in the output root, served under basePath; a raw
    // site.url + '/' + key pointed at the domain root, where the engines'
    // keyLocation probe 404s and the submission is refused.
    assert.strictEqual(payload.keyLocation,
      'https://docs.example.com/myproject/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1.txt',
      'keyLocation carries the basePath prefix');
  } finally { rmDir(dir); }
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

test('absolute hrefs resolve at the output ROOT from nested pages; script/data shapes stay out', () => {
  const dir = scenario('main', {
    'docs/_site/guides/deep.html':
      '<html><head><title>D</title></head><body><h1>d</h1>'
      + '<a href="/guide">root dir link</a>'
      + '<a href="/no-such-route">gone</a>'
      + '<a href="data:image/svg+xml;utf8,<svg></svg>">icon</a>'
      + '<script>document.write("<a href=/ghost-script>js chrome</a>");</script>'
      + '<pre><code><a href="fence-ghost">taught shape</a></code></pre>'
      + '</body></html>',
  });
  try {
    const out = runInject(dir);
    assert.includes(out, 'Link check: 2 broken links found', 'fixture ghost + the real miss - the nested root link resolves');
    assert.includes(out, '/no-such-route');
    assert.ok(!out.includes('/ghost-script'), 'inline script chrome stays out of the checker');
    assert.ok(!out.includes('fence-ghost'), 'code-fence taught shapes stay out of the checker');
    assert.ok(!out.includes('data:image'), 'data: URI targets stay out of the checker');
  } finally { rmDir(dir); }
});

test('a headless .html fragment names itself on the run: whole head surface skips, page stays honest', () => {
  const dir = scenario('main', {
    'docs/_site/headless.html':
      '<h1>a bare fragment with no html shell</h1>',
  });
  try {
    const out = runInject(dir);
    assert.includes(out, 'headless.html: no </head> found', 'the run names the headless page');
    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.ok(/\/headless</.test(sitemap), 'the fragment stays an indexable page (missing-only, no guesses)');
    const f = read(dir, 'docs/_site/headless.html');
    assert.ok(!f.includes('<meta name="description"'), 'no head injection lands on a headless page');
  } finally { rmDir(dir); }
});

test('a consumer basePath carrying a trailing slash normalizes away - no doubled junction anywhere', () => {
  const dir = scenario('main', {});
  try {
    const cfg = path.join(dir, 'docs/ssr-config.yml');
    fs.writeFileSync(cfg, [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com/',
      '  description: A test docs site',
      'basePath: /myproject/',
    ].join('\n') + '\n');
    runInject(dir);
    const guide = read(dir, 'docs/_site/guide/index.html');
    assert.includes(guide, 'href="https://docs.example.com/myproject/guide/"', 'canonical joins single-slash over the slash-y basePath');
    assert.includes(guide, 'href="https://docs.example.com/myproject/feed.xml"', 'the feed alternate joins single-slash too');
    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.ok(!/myproject\/\//.test(sitemap), 'no doubled junction in sitemap urls');
    assert.includes(sitemap, 'https://docs.example.com/myproject/', 'the basePath root still ships its trailing slash');
  } finally { rmDir(dir); }
});

test('missing-only gates are tag-anchored: page PROSE quoting the SEO strings cannot silence injection', () => {
  const dir = scenario('main', {
    'docs/_site/doc-wordy.html':
      '<html><head><title>Docs</title></head><body><h1>Docs</h1>'
      + '<p>write <code>application/ld+json</code> and <code>property="og:title"</code>'
      + ' and <code>rel="canonical"</code> and <code>name="twitter:card"</code> quotes.</p></body></html>',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/doc-wordy.html');
    assert.ok((html.match(/<script[^>]+type="application\/ld\+json"/g) || []).length >= 2, 'the built-in Organization + WebSite still inject over prose quotes');
    assert.ok(html.includes('property="og:title"'), 'og injection survives prose quotes');
    assert.ok(html.includes('rel="canonical" href="https://docs.example.com/doc-wordy"'), 'canonical injects over prose quotes');
  } finally { rmDir(dir); }
});

test('linkcheck route shapes: dir index + .htm sibling resolve, real misses report, assets stay out', () => {
  const dir = scenario('main', {
    'docs/_site/index.html':
      '<html><head><title>H</title></head><body><h1>h</h1>'
      + '<a href="/blog/">dir index</a>'
      + '<a href="/contact.htm">htm sibling</a>'
      + '<a href="/nowhere">gone</a>'
      + '<a href="/css/site.css">style</a>'
      + '</body></html>',
    'docs/_site/blog/index.htm':
      '<html><head><title>P</title></head><body><h1>p</h1></body></html>',
    'docs/_site/contact.htm':
      '<html><head><title>C</title></head><body><h1>c</h1></body></html>',
  });
  try {
    const out = runInject(dir);
    assert.includes(out, 'Link check: 2 broken links found');
    assert.includes(out, '/nowhere');
    assert.includes(out, 'ghost.html', "the fixture's own ghost link still reports");
    assert.ok(!out.includes('site.css'), 'the stylesheet href stays out of the checker');
  } finally { rmDir(dir); }
});

test('linkcheck: root-absolute hrefs carry the basePath prefix and still resolve (issue #32)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'basePath: /myrepo',
      ''
    ].join('\n'),
    // nav + crosslinks are root-absolute WITH the deploy prefix (the
    // Jekyll/baseurl shape that failed every --strict run)
    'docs/_site/index.html':
      '<html><head><title>Home</title></head><body><h1>Home</h1>'
      + '<a href="/myrepo/guides/cli">CLI</a>'
      + '<a href="/myrepo/">Home</a>'
      + '</body></html>',
    'docs/_site/guides/cli.html':
      '<html><head><title>CLI</title></head><body><h1>CLI</h1>'
      + '<a href="/myrepo/guides/cli">self</a>'
      + '</body></html>',
    // the main fixture's own page carries a deliberate ghost link; replace
    // it so this pin isolates the basePath resolution question
    'docs/_site/check-me.html':
      '<html><head><title>Check me</title></head><body><h1>Check me</h1>'
      + '<a href="/myrepo/">Home</a>'
      + '</body></html>',
  });
  try {
    const out = runInject(dir);
    assert.includes(out, 'Link check: All links OK', 'prefixed root-absolute hrefs resolve against the tree');
    // The same tree under --strict must pass: the whole point of the fix.
    const res = spawnSync(process.execPath, [INJECT, '--strict'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `--strict must pass for a baseurl'd site\n${res.stdout}\n${res.stderr}`);
  } finally { rmDir(dir); }
});

test('linkcheck: a root-absolute href with a DIFFERENT prefix stays broken (issue #32 strip is exact)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'basePath: /myrepo',
      ''
    ].join('\n'),
    'docs/_site/index.html':
      '<html><head><title>Home</title></head><body><h1>Home</h1>'
      + '<a href="/otherrepo/guides/cli">foreign prefix</a>'
      + '</body></html>',
  });
  try {
    const out = runInject(dir);
    assert.ok(!out.includes('All links OK'), 'a foreign prefix is not silently stripped');
    assert.includes(out, '/otherrepo/guides/cli', 'the offending href is named');
  } finally { rmDir(dir); }
});

test('.htm and mixed-case extensions join the full pipeline (injection + sitemap + extension-stripped slugs)', () => {
  const dir = scenario('main', {
    'docs/_site/UPPER.HTML':
      '<html><head><title>Upper</title></head><body><h1>upper</h1></body></html>',
    'docs/_site/legacy.htm':
      '<html><head><title>Legacy</title></head><body><h1>legacy</h1></body></html>',
  });
  try {
    runInject(dir);
    const upper = read(dir, 'docs/_site/UPPER.HTML');
    assert.ok(upper.includes('<!-- freestruct -->'), 'upper-case .HTML is modeled and injected');
    assert.includes(upper, 'rel="canonical" href="https://docs.example.com/UPPER"', 'the slug strips the extension');
    const legacy = read(dir, 'docs/_site/legacy.htm');
    assert.ok(legacy.includes('<!-- freestruct -->'), '.htm is modeled and injected');
    assert.includes(legacy, 'rel="canonical" href="https://docs.example.com/legacy"', '.htm strips like .html');
    const sitemap = read(dir, 'docs/_site/sitemap.xml');
    assert.ok(/\/UPPER</.test(sitemap), 'mixed-case page reaches the sitemap');
    assert.ok(/\/legacy</.test(sitemap), '.htm page reaches the sitemap');
    assert.ok(!/\.htm/i.test(sitemap), 'no extension leaks into any sitemap URL');
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

test('llms: a title with markdown brackets is escaped so the link stays whole (bug fix)', () => {
  const dir = scenario('main');
  try {
    fs.writeFileSync(path.join(dir, 'docs/ssr-config.yml'), [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: A test docs site',
      'llms: true',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'docs/_site/tricky.html'),
      '<html><head><title>Foo] bar</title></head><body><h1>Beta [preview] guide</h1></body></html>');
    runInject(dir);
    const llms = read(dir, 'docs/_site/llms.txt');
    const line = llms.split('\n').filter((l) => l.includes('/tricky'))[0];
    // The label was emitted raw, so a ']' in the title closed the markdown
    // label early: '- [Foo] bar](https://...)' - the URL spilled into prose
    // and the link broke. Brackets (and the backslash) escape now.
    assert.ok(line.includes('- [Foo\\] bar](https://docs.example.com/tricky)'),
      'the bracketed title escapes and the link stays whole (' + JSON.stringify(line) + ')');
    assert.ok(!line.includes('[Foo] bar]'), 'the raw label never ships');
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

test('pass-hunt: injecting an SSG SOURCE tree refuses loudly before any file is touched (Pass 26.15)', () => {
  const dir = scenario('main');
  try {
    // The real-world hit: a run over the source dir stamped build-hash meta
    // into committed template copies, in place, silently. Sentinels are the
    // STAGING dirs only - CI proved a built _site legitimately carries the
    // config file (Jekyll copies it), so that marker must not gate.
    const res = runInjectFailing(dir, ['docs']);
    assert.strictEqual(res.status, 3, 'the source-tree refusal exits EXIT_OUTPUT (3)');
    assert.includes(res.stderr, 'template staging', 'the refusal is loud and names the staging sentinel');
    assert.includes(res.stderr, 'SSG source tree', 'the message names what it hit');
    assert.includes(res.stderr, 'docs/_site', 'the message spells the fix');
    // The poisoned template copy proves the point: BEFORE the guard, this
    // file was the contamination shape (injected junk inside a template).
    assert.ok(!read(dir, 'docs/_freestruct/inject-brand.html').includes('freestruct-build'), 'template staging stays uninjected when the guard fires');
    // A built tree that carries the config file (the Jekyll copy class)
    // still injects: a config file alone never gates the guard.
    fs.writeFileSync(path.join(dir, 'docs/_site/freestruct.config.yml'), 'site:\n  url: https://docs.example.com\n');
    runInject(dir);
    assert.ok(read(dir, 'docs/_site/index.html').includes('freestruct-build'), 'the config-file-in-output case does not over-fire');
  } finally { rmDir(dir); }
});

test('pass-hunt: a built tree with none of the sentinels still injects (the guard does not over-fire)', () => {
  const dir = scenario('main');
  try {
    runInject(dir); // docs/_site holds no config/_layouts/_freestruct -> unmolested
    const root = read(dir, 'docs/_site/index.html');
    assert.ok(root.includes('freestruct-build'), 'the normal path still injects fully');
  } finally { rmDir(dir); }
});

test('pass-hunt: a typo\'d flag rides as NO directory (Pass 26.16)', () => {
  const dir = scenario('main');
  try {
    const res = runInjectFailing(dir, ['--definitely-not-a-flag']);
    assert.strictEqual(res.status, 1, 'unknown dash-words fail loudly, never as a positional output dir');
    assert.includes(res.stderr, 'unknown flag(s)', 'the refusal names the flag');
    assert.includes(res.stderr, 'freestruct --help', 'the refusal spells the usage hint');
    // Control: the known flags still pass clean.
    runInject(dir);
    assert.ok(read(dir, 'docs/_site/index.html').includes('freestruct-build'), 'the known-flag path still runs the full pass');
  } finally { rmDir(dir); }
});

test('prose: unwrap-prose joins hard-wrapped paragraphs but never touches structure (#39)', () => {
  const src = [
    '---',
    'title: t',
    '---',
    '',
    'A paragraph that was hard-wrapped at the old',
    'seventy-two column boundary keeps flowing.',
    '',
    '---',
    '',
    '- a bullet that also wrapped',
    '  across two lines',
    '  - a nested bullet stays nested',
    '    and its wrap joins too',
    '',
    '| a | b |',
    '|---|---|',
    '',
    '```bash',
    'echo "this line stays',
    'exactly as written"',
    '```',
    '',
    '    indented code stays',
    '    on its own two lines',
    '',
    '<div class="note">',
    '<p>A multi-line HTML block',
    'stays verbatim too.</p>',
    '</div>',
    '',
  ].join('\n');
  const f = path.join(os.tmpdir(), `freestruct-unwrap-${process.pid}-${++tmpSeq}.md`);
  fs.writeFileSync(f, src);
  try {
    const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'unwrap-prose.cjs'), f], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = fs.readFileSync(f, 'utf8');
    assert.includes(out, 'A paragraph that was hard-wrapped at the old seventy-two column boundary keeps flowing.', 'the wrapped paragraph joins into one line');
    assert.includes(out, '- a bullet that also wrapped across two lines', 'a wrapped bullet joins');
    assert.includes(out, '  - a nested bullet stays nested and its wrap joins too', 'a nested bullet stays nested and joins');
    assert.includes(out, 'echo "this line stays\nexactly as written"', 'fenced code is never touched');
    assert.includes(out, 'title: t', 'frontmatter is preserved');
    // Indented code (4+ spaces) is structural: the two lines stay two lines.
    assert.includes(out, '    indented code stays\n    on its own two lines', 'indented code survives unjoined');
    // An HTML block runs verbatim to the blank line; its lines are not joined.
    assert.includes(out, '<div class="note">\n<p>A multi-line HTML block\nstays verbatim too.</p>\n</div>', 'HTML block survives unjoined');
    // A bare `---` rule later in the file must NOT open frontmatter (the
    // labs/TASKS.md regression): prose after it still unwraps.
    assert.includes(out, 'the old seventy-two', 'the later rule did not swallow the body');
    assert.ok(out.split('\n')[0] === '---' && out.split('\n')[1] === 'title: t', 'frontmatter block intact');
  } finally { try { fs.rmSync(f, { force: true }); } catch (e) { /* best-effort */ } }
});

test('prose: unwrap-prose flushes every thematic-break form and probes frontmatter (issue #39, prestruct merge)', () => {
  // The prestruct/eyestruct hardening: a rule with NO surrounding blank lines
  // must flush the buffer, not join into it (TASKS.md pass separators and
  // CHANGELOG rules were collapsing). All three forms, and a top-of-file rule
  // that is not frontmatter.
  const { unwrap } = require(path.join(ROOT, 'scripts', 'unwrap-prose.cjs'));
  assert.strictEqual(unwrap('para one\nline two\n---\npara two\nmore\n'), 'para one line two\n---\npara two more\n',
    'a --- rule with no blank lines flushes');
  assert.strictEqual(unwrap('para one\nline two\n***\npara two\nmore\n'), 'para one line two\n***\npara two more\n',
    'a *** rule flushes');
  assert.strictEqual(unwrap('para one\nline two\n___\npara two\nmore\n'), 'para one line two\n___\npara two more\n',
    'a ___ rule flushes');
  // A top-of-file `---` whose next line is not `key: value` is a rule, not
  // frontmatter, so the body after it still unwraps.
  assert.strictEqual(unwrap('---\npara one\nline two\n---\npara three\n'), '---\npara one line two\n---\npara three\n',
    'a bare top-of-file rule is not frontmatter');
  // Real frontmatter is still emitted verbatim.
  assert.strictEqual(unwrap('---\ntitle: t\nnav_order: 3\n---\n\npara one\nline two\n'), '---\ntitle: t\nnav_order: 3\n---\n\npara one line two\n',
    'real frontmatter stays verbatim');
});

test('claims gate: the fiction-signature gate ships, runs clean, and is wired into check + CI (prestruct port)', () => {
  const pkg = JSON.parse(read('.', 'package.json'));
  assert.strictEqual(pkg.scripts['lint:claims'], 'node scripts/check-fiction-signatures.cjs',
    'lint:claims runs the fiction-signature gate');
  assert.includes(pkg.scripts.check, 'npm run lint:claims', 'check runs the claims gate');
  const test = read('.', '.github/workflows/test.yml');
  assert.includes(test, 'check-fiction-signatures.cjs', 'CI runs the claims gate');
  // The gate must pass on the shipped tree.
  const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-fiction-signatures.cjs')], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.strictEqual(res.status, 0, 'the claims gate is clean on the shipped tree\n' + res.stderr);
  assert.match(res.stdout, /FICTION SIGNATURES: PASS/, 'the gate reports its pass line');
  // And it must actually catch a fiction: a retired key presented as live fails.
  const probe = path.join(ROOT, 'docs', 'guides', '_fiction_probe_battery.md');
  fs.writeFileSync(probe, 'Set preserveExistingMeta in your config to dedupe tags.\n');
  try {
    const bad = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-fiction-signatures.cjs')], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.strictEqual(bad.status, 1, 'a retired key presented as live trips the gate');
    assert.match(bad.stderr, /preserveExistingMeta/, 'the hit names the offending line');
  } finally { try { fs.rmSync(probe, { force: true }); } catch (e) { /* best-effort */ } }
});

// ---------- playbooks leg (#34) ----------
// The playbooks leg is the family-scaffold shape guides/ does not carry: one
// page per runbook recipe, each with a permalink under /playbooks/ and a row
// in the index table. This pin holds the shape so a half-added recipe (page on
// disk, no index row, or a nav entry with no page) cannot ship.

test('docs: the playbooks leg ships one page per recipe, indexed and in the nav (#34)', () => {
  const pbDir = path.join(ROOT, 'docs', 'playbooks');
  assert.ok(fs.existsSync(pbDir), 'docs/playbooks/ exists (the playbooks leg)');
  const pages = fs.readdirSync(pbDir).filter((f) => f.endsWith('.md')).sort();
  assert.ok(pages.includes('index.md'), 'the leg carries an index page');
  assert.ok(pages.length >= 9, `the leg ships the index plus the recipes (found ${pages.length} files)`);

  const index = fs.readFileSync(path.join(pbDir, 'index.md'), 'utf8');
  const fm = (t) => (t.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  assert.includes(fm(index), 'permalink: /playbooks/', 'the index owns the /playbooks/ permalink');

  for (const f of pages) {
    if (f === 'index.md') continue;
    const text = fs.readFileSync(path.join(pbDir, f), 'utf8');
    const block = fm(text);
    assert.includes(block, 'title:', `${f} carries a title`);
    assert.includes(block, 'description:', `${f} carries a description`);
    const perm = (block.match(/^permalink:\s*(\S+)/m) || [])[1];
    assert.ok(perm && perm.startsWith('/playbooks/'), `${f} carries a /playbooks/ permalink (got ${perm})`);
    assert.ok(index.includes(`](${perm})`), `the index table links ${f} by its permalink ${perm}`);
  }

  // The nav is the menu layer: the leg's pages are listed (the audit gate's
  // reverse check also holds this, but the pin keeps it in the battery).
  const nav = fs.readFileSync(path.join(ROOT, 'docs', '_data', 'nav.yml'), 'utf8');
  assert.includes(nav, 'url: /playbooks/', 'the nav lists the playbooks leg');
  assert.includes(nav, 'url: /playbooks/first-run/', 'the nav lists a recipe page');
});

// ---------- ship-from-download lane (#38) ----------
// The generic phone publish lane is family-reusable (zero repo imports), so
// these pins drive it through the runner seam: no npm, no network. The gate
// itself (whatever prepublishOnly the staged tree carries) is proven
// elsewhere; what is pinned here is that the lane assembles and refuses
// correctly and that the token never lands on disk, in argv, or in the log.

const { ship, tokenProblems, expandHome, TOKEN_ENV, TOKEN_ENV_ALIAS } = require(path.join(ROOT, 'scripts', 'ship-from-download.cjs'));

function shipTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ship-lane-'));
}
function mkPkgTree(root, name = 'lib-x', version = '1.0.0', withLock = true) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name, version }));
  if (withLock) fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
}
function fakeRunner(status = 0, statuses = null) {
  const calls = [];
  const run = (cmd, args, o) => {
    calls.push({ cmd, args: [...args], o });
    const key = args[0] === 'publish' ? 'publish' : 'install';
    return { status: statuses && key in statuses ? statuses[key] : status };
  };
  run.calls = calls;
  return run;
}
const GOOD_SHIP_TOKEN = 'npm_LIVE-AMPLE-HELLO-WORLD-0123456789abcdef';

test('ship lane (#38): the token never lands in a file, in argv, or in the log', () => {
  const base = shipTmp();
  try {
    mkPkgTree(path.join(base, 'src-tree'));
    const run = fakeRunner(0, { install: 0, publish: 1 }); // publish fails, unlink still runs
    const npmrc = path.join(base, 'dest', '.npmrc');
    const r = ship({ target: path.join(base, 'src-tree'), root: path.join(base, 'dest'), token: GOOD_SHIP_TOKEN, run });
    assert.strictEqual(r.code, 1, 'publish failure surfaces npm\'s code');
    assert.strictEqual(fs.existsSync(npmrc), false, 'the staged .npmrc is unlinked in finally even on failure');
    assert.strictEqual(run.calls.length, 2, 'install then publish');
    assert.strictEqual(run.calls[1].o.env[TOKEN_ENV], GOOD_SHIP_TOKEN, 'the token rides the child ENV under the standard name');
    assert.ok(!JSON.stringify(run.calls[1].args).includes(GOOD_SHIP_TOKEN), 'never in argv (ps-safe)');
    assert.ok(!r.out.join('\n').includes(GOOD_SHIP_TOKEN), 'never in the log');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('ship lane (#38): the staged .npmrc holds the ${NPM_TOKEN} expansion, never the raw token', () => {
  const base = shipTmp();
  try {
    mkPkgTree(path.join(base, 'src-tree'));
    let captured = null;
    const origWrite = fs.writeFileSync;
    fs.writeFileSync = (p, c, ...rest) => { if (String(p).endsWith('.npmrc')) captured = c; return origWrite(p, c, ...rest); };
    try {
      const r = ship({ target: path.join(base, 'src-tree'), root: path.join(base, 'dest'), token: GOOD_SHIP_TOKEN, run: fakeRunner(0) });
      assert.strictEqual(r.code, 0);
    } finally { fs.writeFileSync = origWrite; }
    assert.ok(captured && captured.includes(`\${${TOKEN_ENV}}`), 'the .npmrc carries the env placeholder');
    assert.ok(captured && !captured.includes(GOOD_SHIP_TOKEN), 'the raw token never hits the staged file');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('ship lane (#38): named refusals, exit 2, nothing staged before the refusal', () => {
  const base = shipTmp();
  try {
    mkPkgTree(path.join(base, 'src-tree'), 'crashtest', '1.2.0');
    const noRoot = ship({ target: path.join(base, 'src-tree'), run: fakeRunner() });
    assert.strictEqual(noRoot.code, 2, 'a missing --root is a precondition refusal');
    // no name in package.json refuses before any copy
    fs.mkdirSync(path.join(base, 'nameless'));
    fs.writeFileSync(path.join(base, 'nameless', 'package.json'), JSON.stringify({ version: '1.0.0' }));
    const bad = ship({ target: path.join(base, 'nameless'), root: path.join(base, 'dest-a'), token: GOOD_SHIP_TOKEN, run: fakeRunner() });
    assert.strictEqual(bad.code, 2);
    assert.includes(bad.out.join('\n'), 'BAD_PACKAGE_NAME');
    assert.strictEqual(fs.existsSync(path.join(base, 'dest-a')), false, 'nothing copied on refusal');
    // a non-empty root refuses and NEVER deletes
    const root = path.join(base, 'dest-b');
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'sentinel.txt'), 'do not touch');
    const occupied = ship({ target: path.join(base, 'src-tree'), root, token: GOOD_SHIP_TOKEN, run: fakeRunner() });
    assert.strictEqual(occupied.code, 2);
    assert.includes(occupied.out.join('\n'), 'ROOT_OCCUPIED');
    assert.includes(occupied.out.join('\n'), 'rm -rf', 'the refusal carries the exact command as advice');
    assert.strictEqual(fs.existsSync(path.join(root, 'sentinel.txt')), true, 'the lane never deletes on its own');
    // shared-storage roots (the EACCES-symlink class) refuse
    for (const shared of ['/storage/emulated/0/Download/dest', '/sdcard/dest']) {
      const r = ship({ target: path.join(base, 'src-tree'), root: shared, token: GOOD_SHIP_TOKEN, run: fakeRunner() });
      assert.strictEqual(r.code, 2, shared);
      assert.includes(r.out.join('\n'), 'SHARED_STORAGE_ROOT');
    }
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('ship lane (#38): --clean removes ONLY the staged root, on every exit, and the retry closes', () => {
  const base = shipTmp();
  try {
    const target = path.join(base, 'src-tree');
    mkPkgTree(target);
    const root = path.join(base, 'dest');
    // publish fails -> --clean still removes the stage so the retry is not blocked
    const r = ship({ target, root, token: GOOD_SHIP_TOKEN, run: fakeRunner(0, { install: 0, publish: 1 }), clean: true });
    assert.strictEqual(r.code, 1);
    assert.strictEqual(fs.existsSync(root), false, 'a failed run with --clean leaves nothing behind');
    assert.includes(r.out.join('\n'), '--clean removed');
    assert.strictEqual(fs.existsSync(target), true, '--clean never touches the --target');
    // the retry loop closes: the SAME root stages fresh
    const r2 = ship({ target, root, token: GOOD_SHIP_TOKEN, run: fakeRunner(0) });
    assert.strictEqual(r2.code, 0, 'the same root stages fresh after a cleaned failure');
    // default (no --clean) never deletes
    const root2 = path.join(base, 'dest-keep');
    const r3 = ship({ target, root: root2, token: GOOD_SHIP_TOKEN, run: fakeRunner(0) });
    assert.strictEqual(r3.code, 0);
    assert.strictEqual(fs.existsSync(root2), true, 'default keeps the staged root');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('ship lane (#38): tokenProblems describes shape, never the value; exports are the standard names', () => {
  assert.strictEqual(tokenProblems('npm_live-ok-hello-0123456789abcdef'), null, 'a well-formed npm_ token passes');
  const gib = 'Zq7kxWmPv9hRt2LqBnJ4f';
  for (const bad of [null, '', gib, gib.slice(0, 12)]) {
    const msg = tokenProblems(bad) || '';
    assert.ok(msg.length > 0, 'a malformed token gets a named diagnosis');
    if (bad && bad.length > 4) assert.ok(!msg.includes(bad), 'the diagnosis never repeats the input verbatim');
  }
  assert.strictEqual(expandHome('~/web/x'), path.join(os.homedir(), 'web/x'), 'expandHome resolves ~');
  assert.strictEqual(expandHome('/abs/x'), '/abs/x', 'absolute paths pass through');
  assert.strictEqual(TOKEN_ENV, 'NPM_TOKEN', 'the standard npm env name is primary');
  assert.strictEqual(TOKEN_ENV_ALIAS, 'NPM_SHIP_TOKEN', 'the generic fallback rides along');
});

test('pass-hunt: entity-encoded source facts decode ONCE (feed/search/llms never double-encode or carry raw entities)', () => {
  // An SSG that entity-encodes its own output (Hugo, Jekyll with smart
  // escaping) hands freestruct '&amp;' in the <title>/description. The old
  // extractors read the raw match, so the feed re-escaped it into '&amp;amp;'
  // (which a reader sees as the literal '&amp;'), and search.json/llms.txt
  // carried the entity into a plain-text/JSON context that renders it raw.
  const dir = scenario('main', {
    'docs/_site/amp.html': [
      '<html lang="en"><head><meta charset="UTF-8">',
      '<title>Guides &amp; Tips</title>',
      '<meta name="description" content="Tips &amp; tricks for &quot;docs&quot;">',
      '</head><body><h1>Guides &amp; Tips</h1><p>body</p></body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const feed = read(dir, 'docs/_site/feed.xml');
    assert.includes(feed, '<title>Guides &amp; Tips</title>', 'feed title is escaped exactly once');
    assert.ok(!feed.includes('&amp;amp;'), 'no double-encoded entity in the feed');
    assert.includes(feed, '<description>Tips &amp; tricks for &quot;docs&quot;</description>',
      'feed description decodes then re-escapes once');

    const idx = JSON.parse(read(dir, 'docs/_site/search.json'));
    const entry = idx.find((e) => e.url === 'https://docs.example.com/amp');
    assert.ok(entry, 'the entity page is indexed');
    assert.strictEqual(entry.title, 'Guides & Tips', 'search.json title carries a plain ampersand');
    assert.strictEqual(entry.description, 'Tips & tricks for "docs"', 'search.json description decodes quotes');
    assert.strictEqual(entry.heading, 'Guides & Tips', 'search.json heading decodes too');
    assert.ok(!/&(amp|quot|lt|gt|#39);/.test(entry.content), 'search.json content carries no raw entities');
  } finally { rmDir(dir); }
});

test('pass-hunt: numeric and named entities decode (a typographic title is not double-escaped into the feed)', () => {
  // The decoder mapped only five named entities, so a smart-quoted title
  // ('&#8217;', '&mdash;') survived as literal entity text - the feed then
  // escaped the '&' into '&amp;#8217;', which a reader sees verbatim. The
  // decoder now handles decimal, hex and the common named set.
  const dir = scenario('main', {
    'docs/_site/smart.html': [
      '<html lang="en"><head><meta charset="UTF-8">',
      '<title>Rock &#8217;n&#8217; Roll</title>',
      '<meta name="description" content="It&#8217;s a test &mdash; really &copy; 2026">',
      '</head><body><h1>Rock &#8217;n&#8217; Roll</h1><p>body</p></body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const feed = read(dir, 'docs/_site/feed.xml');
    assert.includes(feed, '<title>Rock \u2019n\u2019 Roll</title>', 'numeric entities decode before the feed re-escapes');
    assert.ok(!feed.includes('&amp;#8217;'), 'no double-escaped numeric entity in the feed');
    assert.ok(!feed.includes('&amp;mdash;'), 'no double-escaped named entity in the feed');

    const idx = JSON.parse(read(dir, 'docs/_site/search.json'));
    const entry = idx.find((e) => e.url === 'https://docs.example.com/smart');
    assert.strictEqual(entry.title, 'Rock \u2019n\u2019 Roll', 'search.json decodes numeric entities');
    assert.strictEqual(entry.description, 'It\u2019s a test \u2014 really \u00a9 2026', 'named entities decode too');
  } finally { rmDir(dir); }
});

test('pass-hunt: meta extraction is attribute-order and quote tolerant (a reordered/single-quoted meta is read, not silently defaulted)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:',
      '  name: Foo Docs',
      '  url: https://docs.example.com',
      '  description: SITE DEFAULT - must not leak onto a page with its own description',
    ].join('\n') + '\n',
    'docs/_site/reordered.html': [
      '<html lang="en"><head><meta charset="UTF-8">',
      '<title>Reordered</title>',
      `<meta content='A single-quoted description' name='description'>`,
      '</head><body><h1>Reordered</h1></body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/reordered.html');
    assert.includes(html, 'og:description" content="A single-quoted description"',
      'the reordered single-quoted description is read (no site-default fallback)');
    // The site default may ride the Organization JSON-LD; the PAGE description
    // surfaces (og/twitter/description meta) must carry the page's own value.
    const head = html.match(/<head>[\s\S]*?<\/head>/)[0];
    assert.ok(!/og:description" content="SITE DEFAULT/.test(head), 'the site default never leaks into og:description');
    assert.ok(!/<meta name="description" content="SITE DEFAULT/.test(head), 'the site default never leaks into the description meta');
  } finally { rmDir(dir); }
});

test('pass-hunt: the minifier never fuses words across a line break (text whitespace survives)', () => {
  const dir = scenario('main', {
    'docs/ssr-config.yml': [
      'site:', '  name: Foo Docs', '  url: https://docs.example.com', 'minify: true',
    ].join('\n') + '\n',
    'docs/_site/wrap.html': [
      '<html><head><title>Wrap</title></head><body>',
      '<p>Hello',
      'world this is',
      'wrapped text</p>',
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/wrap.html');
    assert.includes(html, '<p>Hello world this is wrapped text</p>', 'line breaks in text collapse to spaces, not joiners');
    assert.ok(!html.includes('Helloworld'), 'words are never fused across a line break');
  } finally { rmDir(dir); }
});

test('pass-hunt: cache-busting reaches single-quoted href/src too (both quote styles)', () => {
  const dir = scenario('main', {
    'docs/_site/quotes.html': [
      '<html><head><title>Q</title>',
      `<link rel="stylesheet" href='/css/sq.css'>`,
      `<script src='/js/sq.js'></script>`,
      '</head><body>',
      `<img src='/img/sq.png'>`,
      '</body></html>',
    ].join('\n') + '\n',
  });
  try {
    runInject(dir);
    const html = read(dir, 'docs/_site/quotes.html');
    assert.match(html, /href='\/css\/sq\.css\?v=[0-9a-f]{8}'/, 'a single-quoted css href is busted (quote style preserved)');
    assert.match(html, /src='\/js\/sq\.js\?v=[0-9a-f]{8}'/, 'a single-quoted js src is busted');
    assert.match(html, /src='\/img\/sq\.png\?v=[0-9a-f]{8}'/, 'a single-quoted img src is busted');
  } finally { rmDir(dir); }
});

test('pass-hunt: an og:image that escapes the output tree is not treated as a present on-disk file', () => {
  const dir = scenario('main', {
    'docs/_site/trav.html': [
      '<html><head><title>Trav</title>',
      '<meta name="description" content="d">',
      '<link rel="canonical" href="https://docs.example.com/trav">',
      '<meta property="og:image" content="/../../../../etc/hostname">',
      '</head><body><h1>Trav</h1></body></html>',
    ].join('\n') + '\n',
  });
  try {
    const res = spawnSync(process.execPath, [INJECT, 'audit'], { cwd: dir, encoding: 'utf8' });
    const out = res.stdout + res.stderr;
    // The escape resolves outside the tree; it must NOT be silently accepted as
    // an existing file. The audit names the escape (the honest verdict).
    assert.ok(/og:image points at .*etc\/hostname .*which escapes the output directory/.test(out),
      'an out-of-tree og:image is reported as escaping, not accepted');
  } finally { rmDir(dir); }
});

// done
console.log('[freestruct battery] complete');
