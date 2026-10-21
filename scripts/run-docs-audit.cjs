#!/usr/bin/env node
/**
 * Docs audit runner (ported from dhaupin/prestruct scripts/check-docs-*.cjs).
 *
 * One gate-family for freestruct's docs truth. Four checks, all conservative:
 * only PROVEN violations fail.
 *
 *   frontmatter   every docs page carries title + description; nav_order is
 *                 an integer; permalink (when present) is absolute
 *   links         every markdown link resolves on disk or in nav data
 *                 (skips code fences, inline code, externals, anchors)
 *   nav           docs/_data/nav.yml URLs all resolve to real pages, and
 *                 every real page is listed exactly once (the menu layer is
 *                 explicit; stowaway pages fail the gate)
 *   style         fenced blocks carry a language tag; no heading level
 *                 skips; no trailing whitespace
 *   truthfulness  CLI flags used in docs/README exist in the injector; top
 *                 level config keys in yaml examples exist in the schema or
 *                 the documented-retired allowlist
 *
 * Exit 1 on any finding, evidence inline.
 * Run: node scripts/run-docs-audit.cjs [gate ...]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const NAV_FILE = path.join(DOCS, '_data', 'nav.yml');

const findings = [];
const collect = (lines, rel, n, msg) => findings.push(`${rel}:${n}: ${msg}`);

// ---------------------------------------------------------------------------
// File discovery: docs markdown + README (truthful prose lives in both)
// ---------------------------------------------------------------------------

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) {
      if (f.name.startsWith('_')) continue; // _data/_layouts/_includes/_freestruct are frame, not prose
      walk(path.join(d, f.name));
    } else if (f.name.endsWith('.md')) {
      files.push(path.join(d, f.name));
    }
  }
})(DOCS);
files.push(path.join(ROOT, 'README.md'));

const relOf = (p) => path.relative(ROOT, p);

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

const fmBlock = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
};

const pageUrl = (relDocPath, fm) => {
  // A page's deployment URL: permalink if declared, else the Jekyll path shape
  if (fm) {
    const p = fm.match(/^permalink:\s*(\S+)/m);
    if (p) return p[1];
  }
  const base = relDocPath === 'index.md' ? 'index' : relDocPath;
  return '/' + base.replace(/\.md$/, '');
};

// ---------------------------------------------------------------------------
// Gate: frontmatter
// ---------------------------------------------------------------------------

function gateFrontmatter() {
  for (const f of files) {
    if (path.basename(f) === 'README.md') continue; // no frontmatter domain there
    const rel = relOf(f);
    const text = fs.readFileSync(f, 'utf8');
    const fm = fmBlock(text);
    if (!fm) { collect([], rel, 1, 'no frontmatter block'); continue; }
    for (const field of ['title', 'description']) {
      const m = fm.match(new RegExp(`^${field}:\\s*(.*\\S)`, 'm'));
      if (!m) collect([], rel, 1, `missing frontmatter field "${field}"`);
      else if (m[1].trim().replace(/^["']|["']$/g, '') === '') {
        collect([], rel, 1, `frontmatter field "${field}" is empty`);
      }
    }
    const order = fm.match(/^nav_order:\s*(\S+)/m);
    if (order && !/^-?\d+$/.test(order[1])) {
      collect([], rel, 1, `nav_order "${order[1]}" is not an integer`);
    }
    const perm = fm.match(/^permalink:\s*(\S+)/m);
    if (perm && !perm[1].startsWith('/')) {
      collect([], rel, 1, `permalink "${perm[1]}" is not absolute (site links by it)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Gate: links
// ---------------------------------------------------------------------------

const urlSet = new Set(files.map((f) => {
  const t = fs.readFileSync(f, 'utf8');
  return urlKey(pageUrl(relOf(f).replace(/^docs\//, ''), fmBlock(t)));
}));

function resolveUrl(u) {
  // '/foo/bar' or '/foo/bar.html' or '/' -> true when a page owns it
  return urlSet.has(urlKey(u));
}

function gateLinks() {
  for (const f of files) {
    const rel = relOf(f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inFence = false;
    lines.forEach((line, i) => {
      const n = i + 1;
      if (/^\s*```/.test(line)) { inFence = !inFence; return; }
      if (inFence) return;
      const parts = line.split('`');
      for (let s = 0; s < parts.length; s += 2) { // outside inline code only
        for (const m of parts[s].matchAll(/\]\(([^)\s]+)\)/g)) {
          let u = m[1];
          if (/^(https?:|mailto:)/.test(u)) continue;
          const hash = u.indexOf('#');
          u = hash === -1 ? u : u.slice(0, hash);
          if (!u) continue; // pure anchor
          if (u.startsWith('#')) continue;
          if (u.startsWith('/')) {
            if (!resolveUrl(u)) collect([], rel, n, `broken docs link ${m[1]}`);
          } else {
            const target = path.resolve(path.dirname(f), u);
            const good = ['md', 'html', 'png', 'svg', 'yml', 'yaml'].some((ext) => fs.existsSync(`${target}${ext ? '.' + ext : ''}`)) ||
              fs.existsSync(target);
            if (!good) collect([], rel, n, `broken relative link ${m[1]}`);
          }
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Gate: nav (single menu layer, both directions)
// ---------------------------------------------------------------------------

function urlKey(u) {
  // Canonical key for a deployment url: '/' or 'x.html' both normalize
  const stem = String(u).replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  return '/' + (stem === '' || stem === 'index' ? 'index' : stem);
}

function parseNav() {
  // Minimal flat parse of docs/_data/nav.yml: sections + {title, url} items
  const nav = [];
  let section = null;
  fs.readFileSync(NAV_FILE, 'utf8').split('\n').forEach((line) => {
    if (/^\s*#/.test(line) || !line.trim()) return;
    const sec = line.match(/^- title: (.+)$/);
    if (sec && !line.startsWith(' ')) { section = { title: sec[1].trim().replace(/^["']|["']$/g, ''), items: [] }; nav.push(section); return; }
    const item = line.match(/^\s+- title: (.+)$/);
    const url = line.match(/^\s+url: (\S+)/);
    if (section && item && !url) section._pendingTitle = item[1].trim().replace(/^["']|["']$/g, '');
    else if (section && url) section.items.push({ title: section._pendingTitle || '', url: url[1] });
  });
  return nav;
}

function gateNav() {
  const nav = parseNav();
  const listed = {};
  for (const section of nav) {
    if (!section.items.length) findings.push(`nav: section "${section.title}" has no items`);
    for (const item of section.items) {
      if (!item.title) findings.push(`nav: item with url "${item.url}" has no title`);
      if (listed[item.url]) findings.push(`nav: "${item.url}" listed more than once`);
      const key = urlKey(item.url);
      listed[key] = item.title;
      if (item.url.startsWith('/') && !resolveUrl(item.url)) {
        findings.push(`nav: "url: ${item.url}" resolves to no docs page`);
      }
    }
  }
  // Reverse side: every real page must be listed (index included)
  for (const f of files) {
    if (path.basename(f) === 'README.md') continue;
    const rel = relOf(f).replace(/^docs\//, '');
    const url = pageUrl(rel, fmBlock(fs.readFileSync(f, 'utf8')));
    if (!listed[urlKey(url)]) findings.push(`nav: docs page ${rel} (url ${url}) exists but is NOT in the menu`);
  }
}

// ---------------------------------------------------------------------------
// Gate: style
// ---------------------------------------------------------------------------

function gateStyle() {
  for (const f of files) {
    const rel = relOf(f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inFence = false;
    let lastHeading = 0;
    lines.forEach((line, i) => {
      const n = i + 1;
      if (/^\s*```/.test(line)) {
        if (!inFence && !/^```[a-zA-Z0-9_-]+/.test(line.replace(/^\s*/, '').replace(/\s+$/, ''))) {
          collect([], rel, n, 'opening code fence has no language tag (use ```text to be explicit)');
        }
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const h = line.match(/^(#+)\s/);
      if (h) {
        const level = h[1].length;
        if (lastHeading && level > lastHeading + 1) {
          collect([], rel, n, `heading level skip h${lastHeading} -> h${level}`);
        }
        lastHeading = level;
      }
      if (/[^\s][ \t]+$/.test(line)) collect([], rel, n, 'trailing whitespace');
      if (!inFence && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line)) collect([], rel, n, 'emoji/dingbat in prose');
    });
  }
}

// ---------------------------------------------------------------------------
// Gate: truthfulness
// ---------------------------------------------------------------------------

// Flags the injector CLI actually parses (truth source: docs/lib/inject.js).
function cliFlags() {
  const src = fs.readFileSync(path.join(ROOT, 'docs', 'lib', 'inject.js'), 'utf8');
  const flags = new Set();
  for (const m of src.matchAll(/['"]--([a-zA-Z][\w-]*)['"]/g)) flags.add(m[1]);
  flags.add('help').add('h').add('version').add('V');
  return flags;
}

// Config schema keys (truth source: docs/lib/config.js README + test/fixture).
function schemaKeys() {
  // Truth source: the KNOWN_CONFIG_KEYS list + nested cache keys in config.js:
  // those are the keys the schema accepts without warning.
  const keys = new Set([
    'site', 'basePath', 'outputDir', 'searchIndex', 'generateSitemap',
    'generateRobots', 'generateFeed', 'generate404', 'readingTime',
    'lastModified', 'lazyLoad', 'linkCheck', 'minify', 'runHooks',
    'twitter', 'og', 'cacheBusting',
  ]);
  const src = fs.readFileSync(path.join(ROOT, 'docs', 'lib', 'config.js'), 'utf8');
  const known = src.match(/KNOWN_CONFIG_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (known) for (const m of known[1].matchAll(/'([a-zA-Z][\w]*)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\['([^']+)'(?:,\s*'[^']+')*\s*\]/g)) { // nested key lists
    for (const k of m[1].split(',')) if (/^[a-zA-Z][\w]*$/.test(k.trim())) keys.add(k.trim());
  }
  return keys;
}

// Keys documented AS retired are true statements too.
const RETIRED_OK = new Set(['generateNav', 'preserveExistingMeta', 'hash', 'nav', 'index', 'getting-started', 'guides', 'contributing', 'url', 'username']);

function gateTruthfulness() {
  const flags = cliFlags();
  const keys = schemaKeys();
  for (const f of files) {
    const rel = relOf(f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inFence = false;
    let fenceTag = '';
    let blockExempt = false;
    let prev = '';
    lines.forEach((line) => {
      if (/^\s*```/.test(line)) {
        if (!inFence) {
          fenceTag = (line.replace(/^\s*```/, '').trim() || '').split(/\s/)[0];
          // Escape hatch (prestruct convention): a <!-- TRUTH-KNOB: reason -->
          // comment directly above a fence exempts it from the config-key
          // check - for yaml that is NOT a freestruct config (Actions
          // workflows, Jekyll frontmatter samples).
          blockExempt = /\bTRUTH-KNOB:/.test(prev);
        }
        inFence = !inFence;
        prev = line;
        return;
      }
      prev = line;
      if (inFence) {
        // CLI flag promises
        for (const m of line.matchAll(/(?:^|\s)(?:npx\s+)?freestruct\s+(--[a-zA-Z][\w-]*)/g)) {
          const flag = m[1].slice(2);
          if (!flags.has(flag)) findings.push(`truthfulness ${rel}: docs promise \`freestruct ${m[1]}\` but the injector does not parse it`);
        }
        // Top-level config keys (column 0 of a yaml fence)
        if (fenceTag === 'yaml' && !blockExempt && /^\S+/.test(line)) {
          const km = line.match(/^([a-zA-Z][\w]*)\s*:/);
          if (km && !keys.has(km[1]) && !RETIRED_OK.has(km[1])) {
            findings.push(`truthfulness ${rel}: yaml example uses top-level key "${km[1]}" which exists in no schema and is not documented as retired`);
          }
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------

const gates = {
  frontmatter: gateFrontmatter,
  links: gateLinks,
  nav: gateNav,
  style: gateStyle,
  truthfulness: gateTruthfulness,
};

const requested = process.argv.slice(2);
const runGates = requested.length ? requested : Object.keys(gates);
for (const name of runGates) {
  if (!gates[name]) { console.error(`unknown gate: ${name} (have ${Object.keys(gates).join(', ')})`); process.exit(2); }
  const before = findings.length;
  gates[name]();
  console.log(`[gate] ${name}: ${findings.length - before} finding(s)`);
}

if (findings.length) {
  console.error(`\ndocs audit FAILED - ${findings.length} finding(s):`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
}
console.log('docs audit: all gates clean');
