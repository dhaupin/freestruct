---
title: CLI Reference
description: Every freestruct command, flag and exit code
nav_order: 15
permalink: /guides/cli/
---

# CLI Reference

One binary, one default run, three side commands. Everything here is
battery-pinned in `test/run.js` (the truthfulness gate holds the docs to it).

## The Default Run

```bash
npx freestruct
```

Runs the full post-build pass: config discovery (walking up from the cwd for
`freestruct.config.yml`, legacy `ssr-config.yml` still read), then SEO
injection into every page of the output tree, sitemap/robots/feed/404
generation, link checking and cache busting. The output dir defaults to
`docs/_site` next to the config; a positional argument overrides it:

```bash
npx freestruct docs/_site
```

## Side Commands

`validate` and `init` mirror the CLI surface of [prestruct](https://github.com/dhaupin/prestruct),
the separate, complimentary sibling Creadev project whose shape we borrow.
They exit before any output tree is touched.

### validate

```bash
npx freestruct validate
```

Loads and validates the config only - a CI preflight. `[freestruct] config
warning:` lines still print (unknown/retired keys never die silently), and a
fatal config error exits `1`.

### init

```bash
npx freestruct init
npx freestruct init myproject
```

Scaffolds the consumer kit: the starter config plus the synced template
copies land in `<dir>/docs` (the default dir is the cwd). Files that already
exist are never clobbered - each one is reported as `skip (exists)` and the
run ends with the summary. This is the scripted version of the manual
`cp -r node_modules/freestruct/init/docs .` from [Getting Started](/getting-started).

### audit

```bash
npx freestruct audit
npx freestruct audit --json
npx freestruct audit some/other/output-dir
```

Audit verifies the BAKED output after any freestruct run (or after any
SSG's build that already had freestruct applied): per-page head hygiene
(title, description, canonical absolute, the core og/twitter set, svg
og:image, JSON-LD parse + LocalBusiness recommended fields, h1 sanity), the
404 noindex contract, and the site-level sitemap/robots checks. The first
bare word after `audit` is a positional output-directory override. Exit
codes: `0` clean, `1` findings (FAIL class), `3` when the directory is
missing. `--json` prints a machine digest for CI annotations.

Fail-vs-warn mapping is deliberate: tags the engine always injects and the
404 noindex contract are the FAIL class; config-gated tags (og:image,
twitter:site, twitter:image), set-coherence on pages that ship their own
partial og set (missing-only keeps those by design), length bands, h1
sanity, LocalBusiness recommended fields and on-disk og:image/JSON-LD asset
existence are the WARN class.

### indexnow

```bash
npx freestruct indexnow --dry-run
npx freestruct indexnow
npx freestruct indexnow some/other/output-dir
```

Reads the baked `sitemap.xml` from the output dir and POSTs its URL list to
`api.indexnow.org` (the notify protocol shared by Bing, Seznam and Yandex).
The first bare word after `indexnow` is a positional output-directory
override. `--dry-run` prints the exact request body (host, key, urlList,
keyLocation) without touching the network - the CI-friendly shape.

Post-deploy semantics: the `<key>.txt` ownership file is emitted during the
freestruct RUN, but a submission only counts after the output is live
(keyLocation must resolve). Exit codes: `0` accepted (or `--dry-run`), `1`
refusal or rejected submission (the HTTP status prints in the output), `1`
for a fatal config error, `3` for a missing output dir.

### help

```bash
npx freestruct help
npx freestruct --help
```

Subcommand and flag do the same thing: print the command table plus the
exit-code contract and exit `0`.

## Flags

| Flag | Effect |
|------|--------|
| `--version` | Print the package version, exit `0` |
| `--strict` | Broken internal links fail the build (`exit 1`) instead of reporting |
| `--tolerant` | Fatal config/output errors log and exit `0` (CI tolerance mode) |
| `<outputDir>` | Positional output-directory override (bare word, not a subcommand) |

`--strict` is what the docs CI runs on this repo's own Pages build.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Config fatal (parse error, missing `site.url`/`site.name`) |
| `2` | Template missing (no staged or packaged `inject-brand.html`) |
| `3` | Output directory not found |
| `4` | A `hooks.postBuild` command exited nonzero (issue #21: hooks fail the build) |

## Build hash

The `freestruct-build` meta and the `?v=` bust params derive from a
deterministic content hash (config + sorted pre-injection page content), not
a timestamp. Identical content re-builds to an identical hash, so CDNs cache
correctly; real content changes always flip it. See
[Cache Busting](/guides/cache-busting).

## Related

- [Freestruct.config Reference](/guides/freestruct-config) - every config key the
  default run consumes
- [CI/CD](/guides/cicd) - wiring `npx freestruct` into Pages, Actions,
  Netlify, Cloudflare and Vercel
- [Getting Started](/getting-started) - first install and the quick start
