'use strict'

// test/distribution.test.cjs - the distribution contract (poststruct#79).
//
// The docs-shapes pack is only as useful as its DELIVERY: a consumer arms it
// by an EXACT npm pin, so it must ride the published tarball. npm honours
// package.json `files`, so a pack tree excluded there is invisible to
// `npm i freestruct` even though it is committed and green. This pins the two
// halves of that contract against the real tree - the `files` whitelist
// carries `packs/`, and every committed pack dir is one the whitelist would
// ship - so a refactor that drops `packs/` from `files` (silently
// un-delivering the pack) fails here instead of in a consumer's CI.
//
// Run by the root `test` script alongside the pin tests (the same convention
// as check-action-pins.test.js), never inside test/run.js - so the issue #43
// battery-size census is untouched.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const treeRoot = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(treeRoot, 'package.json'), 'utf8'))
const files = Array.isArray(pkg.files) ? pkg.files : []
const packsRoot = path.join(treeRoot, 'packs', 'public')

test('package.json `files` carries `packs/` (npm i freestruct must deliver the pack)', () => {
  assert.ok(
    files.some((f) => f === 'packs' || f === 'packs/' || f.startsWith('packs/')),
    'package.json `files` must carry `packs/` - otherwise npm i freestruct delivers no packs (poststruct#79)',
  )
})

test('every committed pack dir rides the whitelist', () => {
  const packDirs = fs.readdirSync(packsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
  assert.ok(packDirs.length > 0, `packs/public/ must carry at least one pack dir (found ${packDirs.length})`)
  for (const name of packDirs) {
    assert.ok(fs.existsSync(path.join(packsRoot, name, 'pack.json')), `pack dir packs/public/${name} must carry a pack.json`)
  }
  // A bare `packs/` ships the whole subtree; a pack-by-pack list must name
  // every committed pack, or a newly added pack silently does not ship.
  const barePacks = files.some((f) => f === 'packs' || f === 'packs/')
  const namedAll = packDirs.every((n) => files.includes(`packs/public/${n}`) || files.includes(`packs/public/${n}/`))
  assert.ok(barePacks || namedAll, `every pack dir must be delivered: ${packDirs.join(', ')} (files=${JSON.stringify(files)})`)
})
