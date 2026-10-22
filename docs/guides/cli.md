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
