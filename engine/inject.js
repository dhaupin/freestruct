#!/usr/bin/env node
// engine/inject.js - post-build SEO layer for static doc sites (Phase 1, ESM)
// Module map (was a 577-LOC single file, PRD 1.1):
//   config.js    config discovery + validation
//   scan.js      tree walk + page model (slugs, mtimes, noindex detection)
//   seo.js       meta/OG/Twitter/JSON-LD injection + late passes
//   xmllike.js   escaping + sitemap + robots + RSS
//   notfound.js  404 pipeline
//   linkcheck.js link validation
//   search.js    opt-in search.json
//   hooks.js     purge hooks + postBuild hooks
//   audit.js     the `freestruct audit` post-build verifier (issue #18)
//   indexnow.js  IndexNow key emission + submission (issue #19)
//
// CLI (Phase 0/2 contract):
//   --version   print the package.json version and exit 0 (works configless;
//               resolved one level up: engine/ is the package root's sibling dir)
//   validate | init [dir] | audit [--json] [--external] [outputDir] | help  subcommands
//   --strict    opt-in: broken internal links exit 1 instead of
//               shipping green
//   --tolerant  opt-out for CI tolerance: fatal config errors log and exit 0
//               (default is FAST_FAIL exit codes, see below)
//   <outputDir> positional output-directory override
//
// FAST_FAIL exit codes (PRD Phase 2, config-first diagnostics):
//   0 success | 1 config fatal | 2 template missing | 3 output dir missing
//   4 postBuild hook failure (issue #21: nonzero hook exits fail the build)
//
// Root resolution (Phase 1.2): the config is discovered by walking UP from
// the cwd; templates/snippets resolve next to the config file; the output
// dir defaults to docs/_site next to the config.

import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import { loadConfig } from './config.js';
import { getHtmlFiles, buildPages, computeBuildHash, htmlIsNoindex, hasSeoType } from './scan.js';
import { injectPage, addReadingTime, addLastModified, addLazyLoading, addTableWrap } from './seo.js';
import { generateSitemap, generateRobots, generateFeed } from './xmllike.js';
import { generate404, pipeline404 } from './notfound.js';
import { checkLinks } from './linkcheck.js';
import { generateSearchIndex } from './search.js';
import { generateLlms } from './llms.js';
import { runPurgeHooks, runPostBuildHooks } from './hooks.js';
import { auditOutput, auditExternalLinks } from './audit.js';
import { resolveIndexNowKey, emitIndexNowKeyFile, submitIndexNow, isValidIndexNowKey } from './indexnow.js';
import { resolveOgImageGeneration, renderPageOgImage } from './ogimage.js';

const FLAG_VALUES = new Set(['--version', '--strict', '--tolerant']);
const _argv = process.argv.slice(2);
const _flags = _argv.filter(a => FLAG_VALUES.has(a));
// Subcommands before the positional output-dir: the first bare word decides
// what the run is (validate/init/help mirror prestruct's command surface);
// any other bare word stays the outputDir override it always was.
const COMMANDS = new Set(['validate', 'init', 'help', 'audit', 'indexnow']);
const _firstArg = _argv.find(a => !a.startsWith('--'));
const _positional = _firstArg && !COMMANDS.has(_firstArg) ? _firstArg : undefined;
// Pass 26.16: dash-shaped args are FLAGS, never output dirs. The audit and
// indexnow subcommands validate their own flags; the default run must do the
// same for its set, instead of letting a typo'd flag ride as a positional
// and inject somewhere the user never meant (the same quiet-mistake class
// the source-tree guard closes).
const KNOWN_DEFAULT_DASHES = ['-h', '--help', '--version', '--strict', '--tolerant'];
const unknownDashArgs = _argv.filter(a => a.startsWith('-') && !KNOWN_DEFAULT_DASHES.includes(a));

export const EXIT_OK = 0;
export const EXIT_CONFIG = 1;
export const EXIT_TEMPLATE = 2;
export const EXIT_OUTPUT = 3;
export const EXIT_HOOK = 4;

function fail(message, code = EXIT_CONFIG) {
  console.error('[freestruct] ' + message);
  if (_flags.includes('--tolerant')) {
    console.log('[freestruct] --tolerant: continuing with exit 0 (CI tolerance mode)');
    process.exit(EXIT_OK);
  }
  process.exit(code);
}

function printVersion() {
  // engine/inject.js sits in engine/, one level under the package root -
  // that stays true inside an npm install (node_modules/freestruct/engine/).
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
}

// ---------- CLI subcommands (prestruct's init/validate/help surface) ----------

const HELP = `
freestruct -- post-build SEO layer for static doc sites

  freestruct                Run the full post-build pass (config discovered
                            by walking up from cwd; output dir defaults to
                            docs/_site, or pass one as an argument)
  freestruct validate       Load + validate the config; exit 1 on fatal errors
                            (no output tree is touched)
  freestruct init [dir]     Scaffold the consumer kit (starter config +
                            template copies) into <dir>/docs; the default dir
                            is the cwd. Existing files are never clobbered.
  freestruct audit [--json] [--external] [outputDir]
                            Verify the BAKED output (per-page head hygiene +
                            sitemap/robots/404-noindex contract) without
                            touching it; exit 0 clean / 1 findings. Works
                            against any SSG's build (issue #18). --external
                            also HEAD-checks up to 50 unique external hrefs
                            (warn-grade; needs a live network).
  freestruct indexnow [--dry-run] [outputDir]
                            POST the baked sitemap URL list to api.indexnow.
                            org (Bing/Seznam/Yandex). POST-deploy step: the
                            key file emitted during the run must be live.
                            --dry-run prints the request body for CI.
  freestruct help (--help)  This text.

Flags: --version | --strict | --tolerant
Exit codes: 0 ok | 1 config fatal | 2 template missing | 3 output dir missing
            | 4 hook failure | 1 audit findings (audit subcommand)
`;

function printHelp() {
  console.log(HELP);
}

/**
 * `freestruct validate`: config-only preflight for CI. Warnings still print
 * (collectConfigDiagnostics runs inside loadConfig); a fatal config error
 * exits EXIT_CONFIG, honoring --tolerant like every other fatal.
 */
function cmdValidate() {
  let loaded;
  try {
    loaded = loadConfig(process.cwd());
  } catch (e) {
    fail(e.message, EXIT_CONFIG);
  }
  console.log('[freestruct] config ok: ' + loaded.configPath);
  process.exit(EXIT_OK);
}

/**
 * `freestruct init [dir]`: copy the consumer scaffold kit (init/docs: starter
 * config + template copies) into <dir>/docs (default dir: cwd), never
 * clobbering an existing file. Mirrors the manual `cp -r node_modules/
 * freestruct/init/docs .` shape the init kit README describes.
 */
function cmdInit(dirArg) {
  const targetRoot = path.resolve(process.cwd(), dirArg || '.');
  const docsDir = path.join(targetRoot, 'docs');
  // engine/inject.js -> package root -> init/docs (files list ships init/)
  const kitDir = path.join(fileURLToPath(new URL('../init/docs', import.meta.url)));
  if (!fs.existsSync(kitDir)) fail('Scaffold kit not found at ' + kitDir, EXIT_TEMPLATE);

  let created = 0;
  let skipped = 0;
  function copy(src, dest) {
    if (fs.statSync(src).isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
      return;
    }
    if (fs.existsSync(dest)) { skipped++; console.log('  skip (exists): ' + path.relative(targetRoot, dest)); return; }
    fs.copyFileSync(src, dest);
    created++;
    console.log('  created: ' + path.relative(targetRoot, dest));
  }
  copy(kitDir, docsDir);
  console.log('[freestruct] init: ' + created + ' file(s) created in ' + docsDir + (skipped > 0 ? ', ' + skipped + ' existing file(s) left untouched' : ''));
  if (created === 0) console.log('[freestruct] init: nothing new to scaffold - the kit was already present');
  process.exit(EXIT_OK);
}

const STRICT = _flags.includes('--strict');

export function runInject(options = {}) {
  // Subcommand exclusivity: validate/init/help/audit/indexnow dispatch and
  // exit during the module body - the full pass must never run alongside
  // them (with --external the only path that lives past the import, this
  // guard is what keeps the engine from re-injecting mid-audit).
  if (_firstArg && COMMANDS.has(_firstArg)) return;
  // Unknown dash-words are typos, not directories: fail with the usage hint
  // instead of riding as a positional (Pass 26.16).
  if (unknownDashArgs.length) {
    fail('unknown flag(s): ' + unknownDashArgs.join(' ') + ' - run freestruct --help for the flag list', EXIT_CONFIG);
  }
  const cwd = options.cwd || process.cwd();
  console.log('freestruct: Loading config...');

  let loaded;
  try {
    loaded = loadConfig(cwd);
  } catch (e) {
    fail(e.message, EXIT_CONFIG);
  }
  const { config, configDir } = loaded;

  // output dir: CLI positional > config.outputDir > docs/_site (configDir already ends in docs/)
  const outputDir = _positional
    ? path.resolve(cwd, _positional)
    : path.resolve(configDir, config.outputDir || '_site');

  // File-at-path hardening (Pass 26.13): the existence check alone let an
  // outputDir pointing at a FILE through, and the tree walk crashed with an
  // uncaught ENOTDIR stack - fatal errors need a named cause + exit code.
  if (!fs.existsSync(outputDir)) fail('Output directory not found: ' + outputDir, EXIT_OUTPUT);
  else if (!fs.statSync(outputDir).isDirectory()) fail('Output directory is not a directory: ' + outputDir, EXIT_OUTPUT);
  // Source-tree hardening (Pass 26.15, tightened after CI): the outputDir
  // positional accepts any directory, and pointing it at an SSG SOURCE tree
  // (this repo's docs/, today - committed template copies and layout HTML
  // injected in place) poisons files silently. Sentinels are ONLY staging
  // dirs: Jekyll never exports underscore dirs into _site, but it DOES copy
  // bare files like the config into it (CI hit the over-fire), so config
  // files are not evidence. Staging dirs inside a built tree mean the
  // caller aimed at source: abort loudly with the fix spelled out.
  const sourceMarkers = [
    ['_layouts', '_layouts/ staging'],
    ['_freestruct', 'template staging'],
  ];
  for (const [marker, meaning] of sourceMarkers) {
    if (fs.existsSync(path.join(outputDir, marker))) {
      fail('Refusing to inject: ' + outputDir + ' looks like an SSG source tree (' + meaning +
        ' found inside). Point freestruct at the BUILT output instead (e.g. docs/_site).', EXIT_OUTPUT);
    }
  }
  // Template resolution: user-staged first (docs/_freestruct next to the
  // config), then the PACKAGE-shipped copy (npm install ships engine/_freestruct
  // - repo-shaped runs always hit the staged one, fresh-machine installs fall
  // back here; caught by the tarball e2e on a fresh install). The battery
  // pins the staged-only exit-2 shape via FREESTRUCT_SKIP_PACKAGE_FALLBACK.
  // engine/_freestruct is a SIBLING of this engine file, hence './', not '../'.
  const packageTemplateDir = path.join(fileURLToPath(new URL('./_freestruct/', import.meta.url)));
  let snippetDir = path.join(configDir, '_freestruct');
  if (!fs.existsSync(path.join(snippetDir, 'inject-brand.html')) &&
      process.env.FREESTRUCT_SKIP_PACKAGE_FALLBACK !== '1' &&
      fs.existsSync(path.join(packageTemplateDir, 'inject-brand.html'))) {
    snippetDir = packageTemplateDir;
  }
  const templatePath = path.join(snippetDir, 'inject-brand.html');
  if (!fs.existsSync(templatePath)) {
    fail('Template not found: ' + templatePath + ' (shipped copy also missing at ' + packageTemplateDir + ')', EXIT_TEMPLATE);
  }
  const template = fs.readFileSync(templatePath, 'utf8');

  const htmlFiles = getHtmlFiles(outputDir);
  console.log('Found ' + htmlFiles.length + ' HTML files');

  // Build hash is content-derived (see scan.js computeBuildHash): the pages
  // snapshot must exist before it can be computed, and empty trees hash the
  // config alone.
  const pagesForHash = htmlFiles.length > 0 ? buildPages(htmlFiles, outputDir) : [];
  const buildHash = computeBuildHash(config, pagesForHash);
  console.log('Build: ' + buildHash);

  if (htmlFiles.length > 0) {
    const pages = pagesForHash;
    const sitePages = pages.filter(p => !p.is404);

    // Per-page OG image generation (issue #22) runs BEFORE injection so the
    // SEO pipeline can wire the fresh PNGs into og/twitter (missing-only:
    // pages with their own og:image or a per-page override keep theirs).
    const generation = resolveOgImageGeneration(config, configDir);
    const generatedImages = {};
    if (generation) {
      for (const page of sitePages) {
        // Noindex pages are excluded from all artifacts (issue #5 posture):
        // a robots-blocked page needs no share preview.
        if (htmlIsNoindex(page.html)) continue;
        // Pages that ship their own og:image keep theirs (missing-only,
        // the pitch's own rule); a per-page ogImage override also wins
        // because the seo seam resolves overrides before generation.
        if (hasSeoType(page.html, 'og')) continue;
        const rendered = renderPageOgImage(generation, page, config, outputDir);
        if (rendered) generatedImages[page.slug] = rendered;
      }
    }

    // SEO pipeline over every regular page. The injectWarnings array is the
    // shuttle for per-page image-policy offenses (issue #20): report-only by
    // default, graduated to build failures by the --strict block below.
    const injectCtx = { config, template, buildHash, snippetDir, injectWarnings: [], generatedImages };
    for (const page of sitePages) injectPage(page, injectCtx);

    // 404 pipeline: generated when absent, user-supplied folded into the
    // same full treatment (Phase 1.4). Runs after regular pages so a 404
    // already present in the tree is not double-processed above.
    const processed404s = [];
    if (config.generate404 !== false) {
      let page404 = pages.find(p => p.is404);
      if (!page404) {
        const file404 = generate404(config, outputDir, buildHash, template, snippetDir);
        const html404 = fs.readFileSync(file404, 'utf8');
        page404 = {
          file: file404,
          rel: '404.html',
          slug: '/404',
          is404: true,
          html: html404,
          mtime: new Date(),
          title: html404.match(/<title>([^<]+)<\/title>/i)?.[1]?.split(' | ')[0] || null,
          description: html404.match(/<meta name="description" content="([^"]+)"/i)?.[1] || null,
        };
      }
      processed404s.push(pipeline404(page404, injectCtx));
    }

    // Late passes over every processed page, 404s included (Phase 1.4)
    const latePages = [...sitePages, ...processed404s];
    if (config.readingTime !== false) for (const page of latePages) addReadingTime(page.file);
    if (config.lastModified !== false) for (const page of latePages) addLastModified(page.file);
    if (config.lazyLoad !== false) for (const page of latePages) addLazyLoading(page.file);
    // table guard (issue #35): wrap wide tables so every downstream site is
    // mobile-safe by construction. Default-on; `tableWrap: false` opts out.
    if (config.tableWrap !== false) for (const page of latePages) addTableWrap(page.file);

    // noindex is honored by default (owner decision, issue #5):
    // noindex pages never ship into sitemap/feed/search
    const indexablePages = pages.filter(p => !p.is404 && !htmlIsNoindex(p.html));

    if (config.generateSitemap !== false) generateSitemap(indexablePages, config, outputDir);
    if (config.generateRobots !== false) generateRobots(config, outputDir);
    if (config.generateFeed !== false) generateFeed(indexablePages, config, outputDir);

    // link check over regular pages (404 targets excluded by design).
    // basePath threads through so root-absolute hrefs on a baseurl'd site
    // (which carry the deploy prefix) resolve against the tree, not the
    // prefix as a directory (issue #32).
    const brokenLinks = config.linkCheck !== false
      ? checkLinks(sitePages.map(p => p.file), outputDir, config.basePath)
      : [];

    // opt-in search index (owner decision: search.json is opt-in as of Phase 2)
    if (config.searchIndex === true) generateSearchIndex(indexablePages, config, outputDir);

    // opt-in llms.txt (SEO-gap pass, config.llms): the AI-consumable docs
    // summary, built from the same indexable page set sitemap/feed honor
    // (noindex stays honored everywhere). Missing-only: an existing file
    // is never overwritten.
    if (config.llms === true) generateLlms(indexablePages, config, outputDir);

    // --strict: report-only classes become build failures (Phase 0 contract)
    if (STRICT) {
      const problems = [];
      if (brokenLinks.length > 0) {
        problems.push(brokenLinks.length + ' broken internal link(s)');
      }
      // issue #20: SVG og:image offenses collected by the SEO pipeline (the
      // 404 pipeline included, same ctx) - report-only classes graduate here,
      // same as broken links.
      if (injectCtx.injectWarnings.length > 0) {
        problems.push(injectCtx.injectWarnings.length + ' SVG og:image value(s) (share previews blank; use a raster image or allowSvg: true)');
      }
      // noindex cannot leak into generated artifacts anymore (filtered above);
      // the gate stays as a defensive tripwire for future artifact changes.
      if (problems.length > 0) {
        console.log('[freestruct] strict mode: build failed:');
        for (const problem of problems) console.log('  - ' + problem);
        for (const w of injectCtx.injectWarnings) console.log('  - [issue #20] ' + w);
        for (const b of brokenLinks) console.log('  BROKEN: ' + b.file + ' -> ' + b.link);
        process.exit(1);
      }
    }
  }

  // purge hooks, if configured (gated by runHooks)
  if (config.cacheBusting?.purge) runPurgeHooks(config, buildHash, outputDir);

  // indexnow key file (issue #19): emitted during the run so the deployed
  // keyLocation resolves (the engine that owns the sitemap ships the key
  // file next to it). Submission is a separate subcommand - post-deploy.
  const indexNowContext = resolveIndexNowKey(config, configDir);
  if (indexNowContext) emitIndexNowKeyFile(indexNowContext.key, outputDir);

  // postBuild hooks (issue #21): general commands chained after the pass,
  // same runHooks gate as the purges. Unlike purges, a nonzero hook exit is
  // a build failure: exit 4, the first failing hook wins.
  const hookFailures = runPostBuildHooks(config, buildHash, outputDir);
  if (hookFailures.length > 0) {
    fail(hookFailures.length + ' postBuild hook(s) failed (exit ' + hookFailures.map(f => f.status).join(', ') + ')', EXIT_HOOK);
  }

  console.log('freestruct: Done (' + buildHash + ')');
}

// Module-level command dispatch: the bin shim IMPORTS runInject() rather
// than invoking this file as main, so commands must dispatch at import time
// (the pre-change --version module-level check had the same shape). Library
// importers pass no such argv and simply skip all of these.
if (_flags.includes('--version')) { printVersion(); process.exit(0); }
// `help` is the subcommand; --help is the flag alias (both print the same text)
if (_firstArg === 'help' || _argv.includes('--help')) { printHelp(); process.exit(EXIT_OK); }
// ---------- audit subcommand (issue #18) ----------

// `freestruct audit [outputDir] [--json]`: verify the BAKED output (heads +
// site artifacts) after any freestruct run. Reads only the directory, so it
// works against any SSG's build. Exit 0 clean / exit 1 findings; a missing
// output dir is the familiar exit 3. The config is discovered the same way
// the run walks up from cwd (it maps basePath for the on-disk asset checks);
// a configless audit just runs without the disk-mapping extras.
async function cmdAudit() {
  const auditArgs = _argv.slice(_argv.indexOf('audit') + 1);
  const useJson = auditArgs.includes('--json');
  const useExternal = auditArgs.includes('--external');
  const explicitDir = auditArgs.find(a => !a.startsWith('--'));

  if (auditArgs.filter(a => a.startsWith('--')).some(a => a !== '--json' && a !== '--external')) {
    fail('audit: only --json and --external are supported flags (got ' + auditArgs.filter(a => a.startsWith('--')).join(' ') + ')');
  }

  let config = null;
  let configDir = process.cwd();
  try {
    const loaded = loadConfig(process.cwd());
    config = loaded.config;
    configDir = loaded.configDir;
  } catch (e) {
    console.log('[freestruct] audit: config not discoverable (' + e.message.split('\n')[0] + ') - running without the on-disk asset mapping');
  }

  const outputDir = explicitDir
    ? path.resolve(process.cwd(), explicitDir)
    : path.resolve(configDir, (config && config.outputDir) || '_site');

  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    fail('Output directory not found (or not a directory): ' + outputDir, EXIT_OUTPUT);
  }

  const result = auditOutput({ outputDir, config, json: useJson && !useExternal, capture: useJson && useExternal });
  // The no-external path exits HERE, synchronously, exactly like the pre-
  // --external audit: a sync-crashing auditOutput must never let the
  // engine's own full pass run on an audit invocation.
  if (!useExternal) process.exit(result.fails.length > 0 ? 1 : EXIT_OK);
  // External mode is the only async path: collect the network warn rows
  // after the local audit, then decide the exit code.
  const { warns: externalWarns } = await auditExternalLinks({ outputDir, json: useJson });
  if (useJson) {
    console.log(JSON.stringify({ ok: result.fails.length === 0, pages: result.pages, fails: result.fails, warns: [...result.warns, ...externalWarns] }));
  } else {
    const totalWarns = result.warns.length + externalWarns.length;
    console.log(result.fails.length === 0
      ? '[freestruct] audit: 0 failures, ' + totalWarns + ' warning(s) - clean'
      : '[freestruct] audit: ' + result.fails.length + ' failure(s), ' + totalWarns + ' warning(s) - exiting 1');
  }
  process.exit(result.fails.length > 0 ? 1 : EXIT_OK);
}

// ---------- indexnow subcommand (issue #19) ----------

// `freestruct indexnow [--dry-run] [outputDir]`: read the baked sitemap.xml
// and POST its URL list to api.indexnow.org. POST-deploy by design - the
// keyLocation file emitted during the run must be LIVE for the engines to
// verify ownership, so this is documented as the post-deploy step (CI often
// wants --dry-run at build time). Exit 0 accepted/dry-run | 1 failure.
async function cmdIndexNow() {
  const idxArgs = _argv.slice(_argv.indexOf('indexnow') + 1);
  const dryRun = idxArgs.includes('--dry-run');
  const explicitDir = idxArgs.find(a => !a.startsWith('--'));

  if (idxArgs.filter(a => a.startsWith('--')).some(a => a !== '--dry-run')) {
    fail('indexnow: only --dry-run is a supported flag');
  }

  let config = null;
  let configDir = process.cwd();
  try {
    const loaded = loadConfig(process.cwd());
    config = loaded.config;
    configDir = loaded.configDir;
  } catch (e) {
    fail(e.message, EXIT_CONFIG);
  }
  if (config.indexNow === undefined || config.indexNow === null || config.indexNow === false) {
    fail('indexnow: indexNow is not configured in the config (set indexNow: true or { key: "<32-hex>" })', EXIT_CONFIG);
  }
  if (typeof config.indexNow === 'string' || (config.indexNow && typeof config.indexNow === 'object' && config.indexNow.key !== undefined)) {
    const key = typeof config.indexNow === 'string' ? config.indexNow : config.indexNow.key;
    if (!isValidIndexNowKey(key)) {
      fail('indexnow: the configured key is not 32 lowercase hex chars - refusing to submit a broken ownership signal', EXIT_CONFIG);
    }
  }

  const outputDir = explicitDir
    ? path.resolve(process.cwd(), explicitDir)
    : path.resolve(configDir, config.outputDir || '_site');
  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    fail('Output directory not found (or not a directory): ' + outputDir + ' - run freestruct first (indexnow reads the baked sitemap)', EXIT_OUTPUT);
  }

  const result = await submitIndexNow({ config, configDir, outputDir, dryRun });
  process.exit(result.ok ? EXIT_OK : 1);
}

if (_firstArg === 'validate') cmdValidate();
if (_firstArg === 'init') cmdInit(_argv[_argv.indexOf('init') + 1]);
if (_firstArg === 'audit') cmdAudit().catch((e) => fail('audit: ' + (e && e.message ? e.message : e)));
if (_firstArg === 'indexnow') { cmdIndexNow(); }

// Main-module detection: npm's .bin shim is a symlink, but import.meta.url
// resolves the target's real path. Comparing only the raw argv[1] made real
// installs run silently (exit 0, no work) - caught by the tarball e2e. Only
// the DEFAULT full-pass run needs the main-module gate.
const argvReal = process.argv[1]
  ? (() => { try { return fs.realpathSync(process.argv[1]); } catch (e) { return process.argv[1]; } })()
  : '';
const moduleReal = fileURLToPath(import.meta.url);
const invokedAsMain = argvReal === moduleReal || import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (invokedAsMain) runInject();
