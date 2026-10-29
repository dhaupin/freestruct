#!/usr/bin/env node
/**
 * Fiction-signature gate for freestruct (pattern from dhaupin/prestruct's
 * scripts/check-fiction-signatures.cjs, itself from dhaupin/vant).
 *
 * The wrong-claims the docs audit and issue walk actually caught, now gated
 * instead of remembered. A signature is a string that is FICTION when a
 * living surface presents it as current state:
 *
 *   1. `ssr-config.yml`      - the pre-0.6.0 config name. The shipped name is
 *                              `freestruct.config.yml`; the legacy name is read
 *                              back-compat, so a bare mention is fine when it
 *                              says so (negation below waives those lines).
 *   2. `preserveExistingMeta` - a RETIRED key. Missing-only injection is
 *                              unconditional now; configuring it warns.
 *   3. `generateNav`          - a RETIRED key (nav lives in the SSG/layout).
 *   4. `cacheBusting.hash`    - a RETIRED key; the hash is always generated.
 *                              `cacheBusting.hashInCanonicalUrl` is LIVE and
 *                              not matched (negative lookahead).
 *   5. `npm run validate`     - no such npm script. The side command is
 *                              `npx freestruct validate`; the composed local
 *                              gate is `npm run check` / `npm run gate`.
 *   6. `degit dhaupin/freestruct` - the pre-package install story. The shipped
 *                              path is `npm i -D freestruct` + `npx freestruct init`.
 *
 * SCOPE: markdown and YAML files, tree-wide, minus the allow-list. Code files
 * are out of scope: engine/init comments QUOTE retired keys as lessons (that
 * is the docs, not fiction).
 *
 * Allow-list (files that legitimately carry these strings):
 *   - this file (the signatures) and other scripts/check-* gates (they quote)
 *   - AGENTS.md, docs/AGENTS.md, labs/**  (history quotes the fiction it fixed)
 *   - CHANGELOG.md                        (historical release records)
 *   - node_modules / .git / docs/_site at any depth (vendored or built)
 *
 * A line that DEBUNKS a signature ("retired", "legacy", "no longer", "there is
 * no", "was removed") is the gate doing its job in prose - not a regression. A
 * line containing `FICTION-OK:` waives itself (and the next line) for a
 * deliberate, documented reason.
 *
 * Add a signature here the moment a fiction is caught twice. Exit 1 on hits
 * outside the allow-list.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// signature: [regex, human explanation]
const SIGNATURES = [
  [/\bssr-config\.ya?ml\b/,
    'legacy config name - the shipped name is freestruct.config.yml (ssr-config.yml is read back-compat only)'],
  [/\bpreserveExistingMeta\b/,
    'retired config key - missing-only injection is unconditional; configuring it only warns'],
  [/\bgenerateNav\b/,
    'retired config key - nav lives in the SSG or layout; configuring it only warns'],
  [/cacheBusting\.hash(?!InCanonicalUrl)/,
    'retired config key - the build hash is always generated; only cacheBusting.hashInCanonicalUrl is live'],
  [/npm\s+run\s+validate\b/,
    'no such npm script - the side command is `npx freestruct validate`; the local gate is `npm run check`'],
  [/degit\s+dhaupin\/freestruct/i,
    'pre-package install story - the shipped path is `npm i -D freestruct` + `npx freestruct init`'],
];

// path relative to ROOT; return true to skip the file
function allowListed(rel) {
  if (rel === 'scripts/check-fiction-signatures.cjs') return true;
  if (/^scripts\/check-.*\.(js|mjs|cjs)$/.test(rel)) return true; // gates may quote signatures
  if (rel === 'AGENTS.md') return true;
  if (rel === 'docs/AGENTS.md') return true;
  if (rel.startsWith('labs/')) return true;
  if (rel === 'CHANGELOG.md') return true;
  if (rel === 'package-lock.json') return true;
  // Skip installed/built/vendored trees at ANY depth (docs/_site is the built
  // site; node_modules ships third-party markdown).
  const segments = rel.split('/');
  if (segments.includes('node_modules') || segments.includes('.git') || segments.includes('_site')) return true;
  return false;
}

// A line (or its neighbour) that debunks the pattern is the gate WORKING in
// prose - lesson-telling, not fiction-telling.
const NEGATION =
  /there is no\b|does not exist|never existed|no such|removed|deleted|was replaced|replaced by|do not use|don't use|never use|must not|avoid|legacy|back-compat|pre-package|old (approach|practice|form|version|name)|previous(ly)?|instead of|broke|broken|migrat|historic|history|rule|lesson|gotcha|bad|wrong|stale|retired|no longer|does nothing|produces? (only )?a (named )?warning|currently|today|now|since|because of|lore|folklore|errata|not include|including|causes|cause|remove|removing|symptom|fix:/i;

// Flags a purposeful, documented exception. Applies to the line itself AND the
// line after it (agents write the waiver, then the flagged content).
function fictionOk(lines, i) {
  if (/FICTION-OK/.test(lines[i] || '')) return true;
  if (i > 0 && /FICTION-OK/.test(lines[i - 1] || '')) return true;
  return false;
}

const TEXT_EXT = new Set(['.md', '.yml', '.yaml']);

const hits = [];
let scanned = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + f.name;
    const rel = path.relative(ROOT, p);
    if (f.isDirectory()) { walk(p); continue; }
    if (allowListed(rel)) continue;
    if (!TEXT_EXT.has(path.extname(f.name))) continue;
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    scanned++;
    const lines = text.split('\n');
    for (const [re, why] of SIGNATURES) {
      for (let i = 0; i < lines.length; i++) {
        if (!re.test(lines[i])) continue;
        const context = (lines[i - 1] || '') + '\n' + lines[i] + '\n' + (lines[i + 1] || '');
        if (NEGATION.test(context)) continue;
        if (fictionOk(lines, i)) continue;
        hits.push(`${rel}:${i + 1}: "${lines[i].trim().slice(0, 110)}" - ${why}`);
      }
    }
  }
})(ROOT);

if (hits.length) {
  console.error(`FICTION SIGNATURES: FAIL (${hits.length} hit${hits.length === 1 ? '' : 's'} in ${scanned} files)`);
  for (const h of hits) console.error('  ' + h);
  console.error('  (fix the text, or document why with a FICTION-OK: <reason> line,');
  console.error('   or if the signature itself is stale, update the signature AND the ledger)');
  process.exit(1);
}
console.log(`FICTION SIGNATURES: PASS (${scanned} files scanned, ${SIGNATURES.length} signatures)`);
