# Freestruct Deployment Guide

Everything release- and CI-shaped for this repo, in one place. Every claim is
checked against the workflows in `.github/workflows/` - where something is an
owner gate rather than something CI does, it says so.

**Also read:** [AGENTS.md](AGENTS.md) for the house rules and the version
freeze before touching anything this file points at; [README.md](README.md)
for the product story and consumer-facing quick start. The consumer-facing
CI recipe lives in the
[CI/CD guide](https://freestruct.creadev.org/guides/cicd).

---

## Overview

| Target | What it is | Runs on |
|--------|-----------|---------|
| GitHub Pages | This repo's own docs site (`docs/` is the dogfood: Jekyll + Freestruct + Pagefind) | `.github/workflows/docs.yml`, every push to `main` |
| Test battery | Fixture battery + version pins + docs audit + tarball e2e + pack selftest | `.github/workflows/test.yml`, every push/PR |
| npm release | Trusted Publisher (OIDC), dormant until the owner's bootstrap | `.github/workflows/publish.yml`, fires on `v*` tags ONLY |

Dependencies are deliberately tiny: the package runtime ships with one
dependency (`js-yaml`). CI tooling installs crashtest and pagefind from npm
caches keyed by pinned versions (see [Cache discipline](#cache-discipline)).

---

## 1. GitHub Pages (`docs.yml`)

The docs build is the dogfood proof: the Pages site at
https://freestruct.creadev.org is produced by the same pipeline a consumer
would run, gated at every step.

```text
Checkout -> Ruby setup -> bundle install -> jekyll build (inline cd: docs/)
         -> node setup (npm cache) -> npm ci
         -> node bin/freestruct.mjs --strict   (broken links FAIL the build)
         -> crashtest dogfood (the freestruct-docs-shapes pack attacks the tree)
         -> pagefind index (pinned, cached)
         -> upload-pages-artifact -> deploy-pages
```

Hard gates baked in:

- **`--strict`** - broken internal links fail the Pages build (the #4
  graduation; its first harvest caught and fixed three production 404s).
- **crashtest dogfood** - `freestruct-docs-shapes` attacks the tree the build
  just produced; any EXPLOITED row fails the deploy (hardened output only).
- **docs audit** - link/frontmatter/nav truth runs in `test.yml`; the Pages
  build additionally verifies rendering.

Deployment needs the GitHub Pages environment (`github-pages`) already
configured for the repository; the CNAME is `freestruct.creadev.org`
(`docs/CNAME`-free - the domain is set in repo Pages settings, and
`docs/_config.yml` pins the canonical scheme to https).

---

## 2. Test battery (`test.yml`)

Every push and pull request runs:

1. `npm test` - the fixture battery (118 pins), including the version-truth
   pin that enforces the triple agreement (README / package.json /
   CHANGELOG) and the pinned **1.1.0** (owner call, 2026-10-25).
2. Docs audit (`npm run lint:docs`) - frontmatter, links, nav symmetry,
   style, truthfulness, English-only language gate, and the engine-header
   comment format gate.
3. Tarball e2e (`npm run e2e`) - real `npm pack` -> install into a throwaway
   project -> run the README quick start through the bin shim -> assert
   artifacts + injections + exit shapes.
4. Crashtest pack selftest (`npm run packs:selftest`) - the pack must hold a
   hardened Freestruct build and trip a deliberately regressed one.
5. Template sync check (`npm run sync:check`) - engine/init/docs template
   copies byte-identical to the canonical pack.

The tarball e2e is also a hard gate inside `publish.yml` - no tag publishes
unless the fresh-install quick start is proven against that exact tree.

---

## 3. npm release (`publish.yml`)

**Dormant by design.** The workflow fires on `v*` tags only, and no tags
exist yet - the first publish is a manual owner step (npm OIDC cannot create
a brand-new package). There is no `NPM_TOKEN` secret anywhere; runs get
provenance automatically per npm Trusted Publishers.

The runbook (when it is time - all owner actions):

```bash
# 1. everything green: the composed check (battery + docs audit + pack
#    selftest), plus sync lockstep and the tarball e2e (CI runs all of these)
npm run check && npm run sync:check && npm run e2e

# 2. inspect the intended tarball (bin/, engine/, init/ per the files whitelist)
npm pack --dry-run

# 3. one-time manual bootstrap publish (creates the package; carries no
#    provenance - do NOT add publishConfig.provenance to package.json, the
#    sigstore cert needs a CI OIDC identity and would break this step)
npm publish

# 4. configure the Trusted Publisher on npmjs.com:
#    package freestruct -> Settings -> Trusted Publisher ->
#    user dhaupin, repo freestruct, workflow publish.yml

# 5. cut the first tag; every later release publishes with provenance:
#    npm version <bump> && git push --tags
```

`npm publish` also fires `prepublishOnly` -> `npm run check` (issue #37), so
even a manual bootstrap publish is gated on the battery, docs audit and pack
selftest. `packs:selftest` needs a crashtest checkout: with one present it
runs the real teeth, and with none present it prints a named skip and exits
0 (a local publish should not need a github-tarball install); `test.yml`
always installs crashtest, so the teeth run on every push/PR regardless.

**Phone publish lane (`scripts/ship-from-download.cjs`, issue #38).** A
GitHub zip carries no `.git` and no `node_modules`, and `/storage/emulated`
is a symlinkless FUSE mount where `npm install` dies EACCES creating
`node_modules/.bin` symlinks. The lane stages the zip-extracted tree into the
Termux home, installs, then publishes with this repo's `prepublishOnly` gate
riding unchanged - the script only reaches the launchpad, the gate still
rules:

```bash
NPM_TOKEN=npm_xxx node scripts/ship-from-download.cjs \
  --target /storage/emulated/0/Download/freestruct-main/freestruct-main \
  --root ~/web/freestruct-main          # [--dry-run] [--clean]
```

The token rides `NPM_TOKEN` (or `NPM_SHIP_TOKEN`, or `--token-file`), expands
from env into a staged one-line `.npmrc` that is unlinked in a finally - it
never lands in argv (ps-safe), on disk, or in the log. Refusals are named with
exit 0/1/2; `--clean` removes only the staged root, on every exit, so a failed
run cannot block the retry.

The version truth is enforced in CI: the battery pin refuses any README /
package.json / CHANGELOG triplet that disagrees. Everything currently ships
under one number, `1.1.0` (bumped from the 1.0.0 first stable on
2026-10-25, with the first post-1.0.0 surface; the trail: the 0.6.0 freeze
was lifted to 0.9.0, then promoted to 1.0.0; `labs/TASKS.md` VERSION POLICY
has the trail) - a future bump is one edit in those three places plus
`init/VERSION`, then the pin keeps them honest.

---

## Cache discipline

The CI toolchain follows the vant predeploy lesson, pinned-sha edition: never
ride a mutable latest, and cache what was measured to cost minutes cold.

| Dependency | Pin | Cache key |
|-----------|-----|-----------|
| crashtest (dogfood + selftest) | `github:dhaupin/crashtest#dc80a7c` | `crashtest-<sha>` on `node_modules/crashtest` |
| pagefind (docs indexer) | `pagefind@1.5.0` | `pagefind-<version>` on `node_modules/pagefind` |

Measured before caching (vanity metrics are not): the github-tarball install
of crashtest cost ~7m cold on a runner while the campaign itself ran in ~1s;
pagefind's binary resolution cost 355s cold. Bumping a pin in the workflow =
new cache key = fresh install, done consciously.

---

## Local docs preview (issue #36)

CI is the real verifier for anything Jekyll-shaped, but a local build gives a
faster strict-lint loop than waiting on a push. This sandbox has no root and no
system Ruby, so the recipe uses a prebuilt, platform-matched toolchain under
`$HOME` and never touches the repo (verified on Debian 13/x64 against the
`ruby-3.4.12-ubuntu-24.04-x64` asset; ruby-builder tags are the VERSION - a
`toolcache` tag 404s):

```bash
# 1. Unpack the prebuilt Ruby into $HOME (never the repo)
mkdir -p ~/rubies && cd ~/rubies
curl -sL -o ruby.tar.gz \
  https://github.com/ruby/ruby-builder/releases/download/ruby-3.4.12/ruby-3.4.12-ubuntu-24.04-x64.tar.gz
tar xzf ruby.tar.gz          # -> ~/rubies/x64

# 2. libruby.so lives in the unpacked lib tree; the shipped binstubs bake a
#    /opt/hostedtoolcache shebang, so shim each through the interpreter
for t in bundle gem rake jekyll; do
  printf '#!/bin/sh\nexec "$HOME/rubies/x64/bin/ruby" "$HOME/rubies/x64/bin/%s" "$@"\n' "$t" \
    > ~/rubies/shims/$t; chmod +x ~/rubies/shims/$t; done

# 3. Env: gems resolve under the unpacked prefix; RubyGems needs RUBYLIB when
#    the prefix moves. The ubuntu asset links libyaml-0.so.2 - if the sandbox
#    lacks it, drop the Debian lib into ~/rubies/x64/lib.
export PATH="$HOME/rubies/shims:$HOME/rubies/x64/bin:$PATH"
export GEM_HOME="$HOME/rubies/x64/lib/ruby/gems/3.4.0" GEM_PATH="$GEM_HOME"
export LD_LIBRARY_PATH="$HOME/rubies/x64/lib"
export RUBYLIB="$HOME/rubies/x64/lib/ruby/3.4.0:$HOME/rubies/x64/lib/ruby/3.4.0/x86_64-linux"

# 4. Build from a scratch COPY: jekyll writes _site beside the source, so the
#    copy carries every build product away from the tree. freestruct discovers
#    the config by walking up from cwd, so keep the docs/ name.
rm -rf /tmp/fspreview && mkdir -p /tmp/fspreview && cp -r docs /tmp/fspreview/docs
rm -rf /tmp/fspreview/docs/_site
cd /tmp/fspreview/docs && bundle install && bundle exec jekyll build

# 5. Strict run from the scratch root (config walk-up finds docs/freestruct.config.yml)
cd /tmp/fspreview && node /workspace/project/freestruct/bin/freestruct.mjs --strict

# 6. Serve under the real baseurl (symlink <webroot>/<baseurl> -> _site when a
#    baseurl is set) and capture dark+light frames; the theme key is
#    localStorage 'freestruct-theme' = 'light' (else dark).
cd /tmp/fspreview/docs/_site && python3 -m http.server 12000
```

The `.gitignore` block (`docs/.bundle/`, `docs/vendor/`, `docs/_site/`,
`docs/.jekyll-cache/`) is belt-and-suspenders: even with the scratch-copy
recipe, an accidental in-tree build taints nothing. `docs/Gemfile.lock` stays
tracked here - CI resolves against it - unlike eyestruct's recipe, which drops
that one ignore line.

Receipt: `labs/receipts/docs-preview-dark.png` and `docs-preview-light.png`
(the same CLI guide page in both themes, code fences painted by the rouge
token block from issue #30).

---

## Tracked artifacts (what NOT to commit)

- `labs/crashledger.json`, `labs/hardening.md`, `labs/run-meta.json` -
  crashtest run artifacts, regenerated per campaign, gitignored (`plan.md`
  stubs from `crashtest init` are likewise session-local).
- `docs/_site/`, `node_modules/`, `packs/local/` - build outputs and
  machine-private packs, gitignored.
- `.env*` - never commit secrets; CI never needs npm tokens (Trusted
  Publisher authenticates by OIDC).
