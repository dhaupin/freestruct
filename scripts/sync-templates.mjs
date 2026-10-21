#!/usr/bin/env node
// Template sync (prestruct's scripts/sync-engine.mjs pattern, sized to
// freestruct): engine/_freestruct/ is the CANONICAL packaged template set.
// The example site (docs/_freestruct) and the consumer scaffold
// (init/docs/_freestruct) hold synced copies so their builds exercise the
// recommended staged-template shape.
//
// Drift between these copies is the failure prestruct's published qc.test
// once shipped with (W1 engine-drift). `node scripts/sync-templates.mjs`
// syncs; `node scripts/sync-templates.mjs check` exits 1 on any drift (CI
// gate).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANON = path.join(ROOT, 'engine', '_freestruct');
const TARGETS = [path.join(ROOT, 'docs', '_freestruct'), path.join(ROOT, 'init', 'docs', '_freestruct')];

function listDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => f.name);
}

const canonical = listDir(CANON);
const pairs = canonical.map(name => ({ name, source: path.join(CANON, name) }));
const check = process.argv[2] === 'check';

if (!check) {
  for (const target of TARGETS) {
    fs.mkdirSync(target, { recursive: true });
    for (const { name, source } of pairs) fs.copyFileSync(source, path.join(target, name));
    // Delete copies that no longer exist canonically (retired templates).
    for (const stale of listDir(target)) {
      if (!canonical.includes(stale)) fs.rmSync(path.join(target, stale));
    }
  }
  console.log(`[sync] engine/_freestruct -> ${TARGETS.length} copies (${pairs.length} files each)`);
  process.exit(0);
}

let drifted = 0;
const missing = [];
for (const target of TARGETS) {
  if (!fs.existsSync(target)) { missing.push(path.relative(ROOT, target)); continue; }
  if (listDir(target).some(name => !canonical.includes(name))) {
    console.error(`[sync] DRIFT: ${path.relative(ROOT, target)} contains templates not in the canonical set`);
    drifted++;
  }
  for (const { name, source } of pairs) {
    const copy = path.join(target, name);
    if (!fs.existsSync(copy)) { console.error(`[sync] DRIFT: ${path.relative(ROOT, target)}/${name} is missing`); drifted++; }
    else if (fs.readFileSync(copy, 'utf8') !== fs.readFileSync(source, 'utf8')) {
      console.error(`[sync] DRIFT: ${path.relative(ROOT, target)}/${name} differs from the canonical engine copy`);
      drifted++;
    }
  }
}
if (missing.length) console.error('[sync] missing copy dirs (run sync): ' + missing.join(', '));
if (drifted || missing.length) process.exit(1);
console.log('[sync] check: engine/_freestruct copies are in lockstep across docs/ and init/');
