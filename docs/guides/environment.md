---
title: Environment Reference
description: Every environment variable Freestruct reads or sets - the one config override, the hook contract, and the CI knobs.
nav_order: 25
---

# Environment Reference

Freestruct is config-first: almost everything lives in `freestruct.config.yml`. A small, closed set of environment variables exists for the cases config cannot reach - staging overrides, hook commands, and CI toggles. This page lists every one.

## Read by the engine

| Variable | Effect |
|----------|--------|
| `FREESTRUCT_URL` | Replaces `site.url` for the run (staging-style CI). Announced on stdout as `[freestruct] env override: site.url -> ...`. |
| `FREESTRUCT_SKIP_PACKAGE_FALLBACK` | Set to `1` to make the run require a staged `inject-brand.html`; without one it exits `2` instead of falling back to the packaged template. The battery uses this to pin the staged-only exit shape. |

`FREESTRUCT_URL` is the only value-level override. There is no general env interpolation inside the config file - `site.url: $SITE_URL` does nothing; use `FREESTRUCT_URL` instead.

## Set on hook children

When `runHooks: true` lets a `cacheBusting.purge` or `hooks.postBuild` command run, the child process inherits these three, mirroring the `$SITE_URL` / `$BUILD_HASH` / `$OUTPUT_DIR` placeholders that are substituted into the command text:

| Variable | Value |
|----------|-------|
| `FREESTRUCT_SITE_URL` | The resolved site URL |
| `FREESTRUCT_BUILD_HASH` | This run's build hash |
| `FREESTRUCT_OUTPUT_DIR` | The output directory the run wrote into |

A hook script can read either form; the env vars exist so a script never has to do string surgery on a command line.

## Tooling knobs

These are read by the repo's own scripts, not the shipped engine:

| Variable | Read by | Effect |
|----------|---------|--------|
| `LINT_LANGUAGE_ALLOW_RE` | `scripts/check-language.cjs` | A regex that allowlists lines from the English-only prose gate, so intentional bilingual docs opt out without editing the checker. |
| `NPM_TOKEN` / `NPM_SHIP_TOKEN` | `scripts/ship-from-download.cjs` | The publish token for the phone ship-from-download lane; expands into a staged one-line `.npmrc` that is unlinked in a `finally`. |
| `GITHUB_TOKEN` | CI workflows and API calls | Authenticates GitHub API access in the lanes. |

## Related

- [Freestruct.config Reference](/guides/freestruct-config) - the config keys these env vars sit beside
- [Post-Render Hooks](/guides/post-render-hooks) - the hook seams that receive the child env
- [CI/CD](/guides/cicd) - wiring the overrides into a pipeline
