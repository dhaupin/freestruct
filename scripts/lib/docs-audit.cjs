#!/usr/bin/env node
// scripts/lib/docs-audit.cjs - the shared docs-audit runner: one findings
// list, per-gate count lines, and gate selection, driven by a caller-supplied
// gate set. freestruct's scripts/run-docs-audit.cjs is the first caller;
// prestruct's consolidated runner is the intended second (prestruct#75), so
// the two repos share ONE runner shape and differ only in gates, globs and
// allow-lists.
//
// Boundary: the runner owns discovery, the shared findings list, the generic
// markdown/url helpers, and the run loop. It NEVER prints the final report or
// exits - the caller owns voice and exit code, so each repo keeps its own
// contract (freestruct's report-only-by-default voice is not prestruct's).
//
// A gate is a plain function `(ctx) => void` that pushes findings through
// `ctx.collect` (or `ctx.findings`). `ctx` carries the discovered files, the
// relative-path helper, and the generic helpers, so a gate never re-implements
// the walker or the exit.
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- generic markdown / url helpers ----------

// The frontmatter block, or null. Only the block at line 1 counts.
function fmBlock(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

// Canonical key for a deployment url: '/' and 'index.html' both normalize.
function urlKey(u) {
  const stem = String(u).replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
  return '/' + (stem === '' || stem === 'index' ? 'index' : stem);
}

// Default page URL: the declared permalink, else the Jekyll path shape. A
// caller with a different routing model overrides this via `config.urlFor`.
function pageUrl(relDocPath, fm) {
  if (fm) {
    const p = fm.match(/^permalink:\s*(\S+)/m);
    if (p) return p[1];
  }
  const base = relDocPath === 'index.md' ? 'index' : relDocPath;
  return '/' + base.replace(/\.md$/, '');
}

// Docs markdown (recursively, `_`-prefixed dirs skipped as frame) + README.
function discoverFiles({ docsDir, readme }) {
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) {
        if (f.name.startsWith('_')) continue; // _data/_layouts/_includes are frame, not prose
        walk(path.join(d, f.name));
      } else if (f.name.endsWith('.md')) {
        files.push(path.join(d, f.name));
      }
    }
  })(docsDir);
  if (readme && fs.existsSync(readme)) files.push(readme);
  return files;
}

// ---------- the runner ----------

// config: {
//   root,                     // repo root (absolute)
//   docsDir  = 'docs',        // docs directory, relative to root
//   readme   = 'README.md',   // extra prose surface, relative to root (optional)
//   navFile,                  // nav data file, relative to root (default <docsDir>/_data/nav.yml)
//   gates,                    // { name: (ctx) => void }
//   names,                    // requested gate names (default: all, in order)
//   urlFor,                   // (relDocPath, fm) => url (default pageUrl)
//   log,                      // (line) => void (default: no-op)
// }
// Returns { findings, files }. Throws on an unknown gate name.
function runDocsAudit(config) {
  const root = config.root;
  const docsRel = config.docsDir || 'docs';
  const docsDir = path.join(root, docsRel);
  const readme = path.join(root, config.readme || 'README.md');
  const navFile = path.join(root, config.navFile || path.join(docsRel, '_data', 'nav.yml'));
  const gates = config.gates || {};
  const log = config.log || (() => {});
  const urlFor = config.urlFor || pageUrl;

  const files = discoverFiles({ docsDir, readme });
  const findings = [];
  const relOf = (p) => path.relative(root, p);
  const collect = (lines, rel, n, msg) => findings.push(`${rel}:${n}: ${msg}`);

  // A file's path relative to the docs dir, for URL derivation. README (not
  // under docsDir) falls through unchanged.
  const docsPrefix = docsRel.split(path.sep).join('/') + '/';
  const urlSet = new Set(files.map((f) => {
    const rel = relOf(f);
    const docRel = rel.startsWith(docsPrefix) ? rel.slice(docsPrefix.length) : rel;
    return urlKey(urlFor(docRel, fmBlock(fs.readFileSync(f, 'utf8'))));
  }));
  const resolveUrl = (u) => urlSet.has(urlKey(u));

  const ctx = {
    root, docsDir, navFile, files, relOf, collect, findings,
    fs, path, fmBlock, urlKey, pageUrl: urlFor, resolveUrl,
  };

  const requested = (config.names && config.names.length) ? config.names : Object.keys(gates);
  for (const name of requested) {
    if (!gates[name]) throw new Error(`unknown gate: ${name} (have ${Object.keys(gates).join(', ')})`);
    const before = findings.length;
    gates[name](ctx);
    log(`[gate] ${name}: ${findings.length - before} finding(s)`);
  }

  return { findings, files };
}

module.exports = { runDocsAudit, fmBlock, urlKey, pageUrl, discoverFiles };
