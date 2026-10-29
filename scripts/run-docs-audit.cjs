#!/usr/bin/env node
/**
 * Docs audit caller (freestruct's gate set over the shared runner).
 *
 * The runner (scripts/lib/docs-audit.cjs) owns discovery, the findings list,
 * the per-gate count line, and gate selection; this file owns freestruct's
 * GATE SET and its voice/exit. prestruct is the intended second caller of the
 * same runner (prestruct#75), so the two repos share ONE runner shape and
 * differ only in gates, globs and allow-lists.
 *
 * freestruct's gates (all conservative - only PROVEN violations fail):
 *
 *   frontmatter   every docs page carries title + description; nav_order is
 *                 an integer; permalink (when present) is absolute
 *   links         every markdown link resolves on disk or in nav data
 *                 (skips code fences, inline code, externals, anchors)
 *   nav           docs/_data/nav.yml URLs all resolve to real pages, and
 *                 every real page is listed exactly once (the menu layer is
 *                 explicit; stowaway pages fail the gate)
 *   style         fenced blocks carry a language tag; no heading level
 *                 skips; no trailing whitespace; pipe-table shape; hyphens
 *                 not em/en dashes; no emoji; exactly one h1 per page
 *   truthfulness  CLI flags used in docs/README exist in the injector; top
 *                 level config keys in yaml examples exist in the schema or
 *                 the documented-retired allowlist
 *   language      English-only prose (scripts/check-language.cjs owns the
 *                 logic; the gate shells out so one command covers it)
 *   jekyllfilters build-time Liquid constructs the Jekyll build would only
 *                 report from its stack trace: the two-arg single-arg filter
 *                 trap (crashtest#23) and unknown tags ({% seo %} in prose);
 *                 scripts/check-jekyll-filters.cjs owns the logic, shelled out
 *   codefmt       every engine source opens with its own path in a header
 *
 * Exit 1 on any finding, evidence inline.
 * Run: node scripts/run-docs-audit.cjs [gate ...]
 */
'use strict';

const path = require('path');
const { runDocsAudit } = require('./lib/docs-audit.cjs');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Gate: frontmatter
// ---------------------------------------------------------------------------

function gateFrontmatter(ctx) {
  const { files, relOf, collect, fs, fmBlock, path } = ctx;
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

function gateLinks(ctx) {
  const { files, relOf, collect, fs, path, resolveUrl } = ctx;
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

function parseNav(ctx) {
  // Minimal flat parse of docs/_data/nav.yml: sections + {title, url} items
  const { fs, navFile } = ctx;
  const nav = [];
  let section = null;
  fs.readFileSync(navFile, 'utf8').split('\n').forEach((line) => {
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

function gateNav(ctx) {
  const { files, relOf, findings, fs, path, fmBlock, urlKey, pageUrl, resolveUrl } = ctx;
  const nav = parseNav(ctx);
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
// Gate: language (English-only prose; ported from dhaupin/vant)
//
// The standalone checker owns the logic (scripts/check-language.cjs); the
// gate shells out to it so the single audit command covers every gate.
// ---------------------------------------------------------------------------

function gateLanguage(ctx) {
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, [path.join(ctx.root, 'scripts', 'check-language.cjs')], {
      cwd: ctx.root, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    for (const line of String(err.stdout || '').trim().split('\n').filter(Boolean)) ctx.findings.push(line);
    if (!err.stdout) ctx.findings.push(`language: checker failed to run: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Gate: jekyllfilters (build-time Liquid constructs; issue #47)
//
// The standalone checker owns the logic (scripts/check-jekyll-filters.cjs);
// the gate shells out to it so the single audit command covers it, exactly as
// the language gate does. A construct that only fails in Jekyll's stack trace
// (the two-arg single-arg filter trap, or an unknown tag like `{% seo %}` in
// prose) then fails lint:docs with a file:line instead.
// ---------------------------------------------------------------------------

function gateJekyllFilters(ctx) {
  const { execFileSync } = require('child_process');
  try {
    execFileSync(process.execPath, [path.join(ctx.root, 'scripts', 'check-jekyll-filters.cjs')], {
      cwd: ctx.root, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const out = String(err.stdout || '').trim().split('\n').filter(Boolean);
    const errOut = String(err.stderr || '').trim().split('\n').filter(Boolean);
    for (const line of [...out, ...errOut]) ctx.findings.push(line);
    if (!out.length && !errOut.length) ctx.findings.push(`jekyllfilters: checker failed to run: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Gate: codefmt (comment-format truth: engine headers name their own path)
//
// One mechanical format every engine source carries: line 1 is
//   // engine/<file>.js - <one-line purpose in English>
// so a reader grepping ANY comment always lands on a file that states where
// it is. The path check is what keeps the truth after moves (the rehaul left
// six headers behind saying 'docs/lib/...' for a week).
// ---------------------------------------------------------------------------

function gateCodeFormat(ctx) {
  const { root, findings, fs, path } = ctx;
  const dir = path.join(root, 'engine');
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js')) continue;
    const rel = `engine/${f}`;
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = raw.split('\n');
    // A shebang (needed when a source file is invoked directly) counts as
    // line 0: the header lands on line 2.
    const offset = raw.startsWith('#!') ? 1 : 0;
    const rel2 = `${rel}:${offset + 1}`;
    const first = lines[offset];
    if (!first || !first.startsWith(`// ${rel} - `)) {
      findings.push(`${rel2}: header comment must start "// ${rel} - <purpose>" (got: ${String(first).slice(0, 60)})`);
    }
    if (first && /[\u4E00-\u9FFF\u3040-\u30FF]/u.test(first)) {
      findings.push(`${rel2}: header comment must be English (the language gate covers prose, this gate covers headers)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Gate: style
// ---------------------------------------------------------------------------

function gateStyle(ctx) {
  const { files, relOf, collect, fs } = ctx;
  for (const f of files) {
    const rel = relOf(f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let inFence = false;
    let lastHeading = 0;
    let h1Count = 0;
    let inFm = false;
    lines.forEach((line, i) => {
      const n = i + 1;
      // Frontmatter is frame, not prose: its `#` comment lines (the
      // discussions posts carry them) are not headings, and it opens only at
      // line 1 (same rule as the unwrap tool). The flag gates ONLY the
      // heading logic below - the trailing-whitespace / dash / emoji checks
      // still see frontmatter lines, exactly as they always did.
      if (n === 1 && line === '---') { inFm = true; }
      else if (inFm && line === '---') { inFm = false; }
      if (!inFm && /^\s*```/.test(line)) {
        if (!inFence && !/^```[a-zA-Z0-9_-]+/.test(line.replace(/^\s*/, '').replace(/\s+$/, ''))) {
          collect([], rel, n, 'opening code fence has no language tag (use ```text to be explicit)');
        }
        inFence = !inFence;
        return;
      }
      if (inFence) return;
      const h = !inFm && line.match(/^(#+)\s/);
      if (h) {
        const level = h[1].length;
        if (level === 1) h1Count++;
        if (lastHeading && level > lastHeading + 1) {
          collect([], rel, n, `heading level skip h${lastHeading} -> h${level}`);
        }
        lastHeading = level;
      }
      if (/[^\s][ \t]+$/.test(line)) collect([], rel, n, 'trailing whitespace');
      // Inline-code spans are literal DATA, not prose (same posture as the
      // language gate) - the voice checks look at the line without them.
      const proseLine = line.replace(/`[^`]*`/g, '');
      if (!inFence && /^[^|`]*\t/.test(proseLine)) collect([], rel, n, 'tab in prose (use spaces)');
      // Voice rule (vant docs-style port): prose uses hyphens; em/en dashes
      // are typographic sugar that reads differently per renderer. CHANGELOG
      // is exempt (historical entries keep their punctuation).
      if (/—|–/.test(proseLine) && relOf(f) !== 'CHANGELOG.md') collect([], rel, n, 'em/en dash in prose (use a hyphen)');
      // Pipe-table shape (vant docs-style port): a table row line must end
      // with a pipe, headings never take pipes, bullets never end with them.
      // (Table checks keep the RAW line - a pipe inside a code span still
      // changes how a renderer splits the row.)
      if (/^\s*\|/.test(line) && !/\|\s*$/.test(line)) collect([], rel, n, 'table row does not end with a pipe');
      if (/^\s*\|[\s|:-]+$/.test(line) && !/^[\s|:-]+$/.test(line)) collect([], rel, n, 'malformed table divider row');
      if (h && line.match(/^(#+)\s/) && line.includes('|')) collect([], rel, n, 'pipe in heading (breaks table detect on some renderers)');
      if (!inFence && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(proseLine)) collect([], rel, n, 'emoji/dingbat in prose');
    });
    // Every living docs page needs exactly one h1, from its markdown body.
    // The layout is a passthrough (the page's own `#` is the heading), so a
    // page opening on `##` or prose ships with NO h1 at all - the rig-adoption
    // regression this rule now pins. README is exempt: it is not a rendered
    // page (no frontmatter), and its top heading is prose-anchored by design.
    if (rel !== 'README.md') {
      if (h1Count === 0) collect([], rel, 1, 'no h1 (docs pages need exactly one top-level `# ` heading)');
      else if (h1Count > 1) collect([], rel, 1, h1Count + ' h1 headings (docs pages need exactly one)');
    }
  }
}

// ---------------------------------------------------------------------------
// Gate: truthfulness
// ---------------------------------------------------------------------------

// Flags the injector CLI actually parses (truth source: engine/inject.js).
function cliFlags(root) {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'engine', 'inject.js'), 'utf8');
  const flags = new Set();
  for (const m of src.matchAll(/['"]--([a-zA-Z][\w-]*)['"]/g)) flags.add(m[1]);
  flags.add('help').add('h').add('version').add('V');
  return flags;
}

// Config schema keys (truth source: engine/config.js README + test/fixture).
function schemaKeys(root) {
  const fs = require('fs');
  // Truth source: the KNOWN_CONFIG_KEYS list + nested cache keys in config.js:
  // those are the keys the schema accepts without warning.
  const keys = new Set([
    'site', 'basePath', 'outputDir', 'searchIndex', 'generateSitemap',
    'generateRobots', 'generateFeed', 'generate404', 'readingTime',
    'lastModified', 'lazyLoad', 'linkCheck', 'minify', 'runHooks',
    'twitter', 'og', 'cacheBusting',
  ]);
  const src = fs.readFileSync(path.join(root, 'engine', 'config.js'), 'utf8');
  const known = src.match(/KNOWN_CONFIG_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/);
  if (known) for (const m of known[1].matchAll(/'([a-zA-Z][\w]*)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\['([^']+)'(?:,\s*'[^']+')*\s*\]/g)) { // nested key lists
    for (const k of m[1].split(',')) if (/^[a-zA-Z][\w]*$/.test(k.trim())) keys.add(k.trim());
  }
  return keys;
}

// Keys documented AS retired are true statements too.
const RETIRED_OK = new Set(['generateNav', 'preserveExistingMeta', 'hash', 'nav', 'index', 'getting-started', 'guides', 'contributing', 'url', 'username']);

function gateTruthfulness(ctx) {
  const { files, relOf, findings, fs } = ctx;
  const flags = cliFlags(ctx.root);
  const keys = schemaKeys(ctx.root);
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
  language: gateLanguage,
  jekyllfilters: gateJekyllFilters,
  codefmt: gateCodeFormat,
};

let result;
try {
  result = runDocsAudit({
    root: ROOT,
    gates,
    names: process.argv.slice(2),
    log: (line) => console.log(line),
  });
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

const { findings } = result;
if (findings.length) {
  console.error(`\ndocs audit FAILED - ${findings.length} finding(s):`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
}
console.log('docs audit: all gates clean');
