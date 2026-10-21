#!/usr/bin/env node
// freestruct - post-build SEO layer for static doc sites (Phase 1, ESM)
// Module map (was a 577-LOC single file, PRD 1.1):
//   config.js    config discovery + validation
//   scan.js      tree walk + page model (slugs, mtimes, noindex detection)
//   seo.js       meta/OG/Twitter/JSON-LD injection + late passes
//   xmllike.js   escaping + sitemap + robots + RSS
//   notfound.js  404 pipeline
//   linkcheck.js link validation
//   search.js    opt-in search.json
//   hooks.js     purge hooks
//
// CLI (Phase 0/2 contract):
//   --version   print the package.json version and exit 0 (works configless)
//   --strict    opt-in: broken links / noindex leaks exit 1 instead of
//               shipping green
//   --tolerant  opt-out for CI tolerance: fatal config errors log and exit 0
//               (default is FAST_FAIL exit codes, see below)
//   <outputDir> positional output-directory override
//
// FAST_FAIL exit codes (PRD Phase 2, config-first diagnostics):
//   0 success | 1 config fatal | 2 template missing | 3 output dir missing
//
// Root resolution (Phase 1.2): the config is discovered by walking UP from
// the cwd; templates/snippets resolve next to the config file; the output
// dir defaults to docs/_site next to the config.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';

import { loadConfig } from './config.js';
import { getHtmlFiles, buildPages, htmlIsNoindex } from './scan.js';
import { injectPage, addReadingTime, addLastModified, addLazyLoading } from './seo.js';
import { generateSitemap, generateRobots, generateFeed } from './xmllike.js';
import { generate404, pipeline404 } from './notfound.js';
import { checkLinks } from './linkcheck.js';
import { generateSearchIndex } from './search.js';
import { runPurgeHooks } from './hooks.js';

const FLAG_VALUES = new Set(['--version', '--strict', '--tolerant']);
const _argv = process.argv.slice(2);
const _flags = _argv.filter(a => FLAG_VALUES.has(a));
const _positional = _argv.find(a => !a.startsWith('--'));

export const EXIT_OK = 0;
export const EXIT_CONFIG = 1;
export const EXIT_TEMPLATE = 2;
export const EXIT_OUTPUT = 3;

function fail(message, code = EXIT_CONFIG) {
  console.error('[freestruct] ' + message);
  if (_flags.includes('--tolerant')) {
    console.log('[freestruct] --tolerant: continuing with exit 0 (CI tolerance mode)');
    process.exit(EXIT_OK);
  }
  process.exit(code);
}

function printVersion() {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  console.log(pkg.version);
}

if (_flags.includes('--version')) { printVersion(); process.exit(0); }

const STRICT = _flags.includes('--strict');

export function runInject(options = {}) {
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

  if (!fs.existsSync(outputDir)) fail('Output directory not found: ' + outputDir, EXIT_OUTPUT);

  const snippetDir = path.join(configDir, '_freestruct');
  const templatePath = path.join(snippetDir, 'inject-brand.html');
  if (!fs.existsSync(templatePath)) fail('Template not found: ' + templatePath, EXIT_TEMPLATE);
  const template = fs.readFileSync(templatePath, 'utf8');

  const buildHash = crypto.createHash('sha1')
    .update(JSON.stringify(config || {}) + String(Date.now()))
    .digest('hex').slice(0, 8);
  console.log('Build: ' + buildHash);

  const htmlFiles = getHtmlFiles(outputDir);
  console.log('Found ' + htmlFiles.length + ' HTML files');

  if (htmlFiles.length > 0) {
    const pages = buildPages(htmlFiles, outputDir);
    const sitePages = pages.filter(p => !p.is404);

    // SEO pipeline over every regular page
    const injectCtx = { config, template, buildHash, snippetDir };
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

    // noindex is honored by default (owner decision, issue #5):
    // noindex pages never ship into sitemap/feed/search
    const indexablePages = pages.filter(p => !p.is404 && !htmlIsNoindex(p.html));

    if (config.generateSitemap !== false) generateSitemap(indexablePages, config, outputDir);
    if (config.generateRobots !== false) generateRobots(config, outputDir);
    if (config.generateFeed !== false) generateFeed(indexablePages, config, outputDir);

    // link check over regular pages (404 targets excluded by design)
    const brokenLinks = config.linkCheck !== false ? checkLinks(sitePages.map(p => p.file), outputDir) : [];

    // opt-in search index (owner decision: search.json is opt-in as of Phase 2)
    if (config.searchIndex === true) generateSearchIndex(indexablePages, config, outputDir);

    // --strict: report-only classes become build failures (Phase 0 contract)
    if (STRICT) {
      const problems = [];
      if (brokenLinks.length > 0) {
        problems.push(brokenLinks.length + ' broken internal link(s)');
      }
      // noindex cannot leak into generated artifacts anymore (filtered above);
      // the gate stays as a defensive tripwire for future artifact changes.
      if (problems.length > 0) {
        console.log('[freestruct] strict mode: build failed:');
        for (const problem of problems) console.log('  - ' + problem);
        for (const b of brokenLinks) console.log('  BROKEN: ' + b.file + ' -> ' + b.link);
        process.exit(1);
      }
    }
  }

  // purge hooks, if configured (gated by runHooks)
  if (config.cacheBusting?.purge) runPurgeHooks(config, buildHash, outputDir);

  console.log('freestruct: Done (' + buildHash + ')');
}

const invokedAsMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) runInject();
