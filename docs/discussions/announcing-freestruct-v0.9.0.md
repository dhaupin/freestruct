---
version: 0.9.0
permalink: /discussions/announcing-freestruct-v0.9.0/
# Family release-post shape (the crashtest docs precedent): layout default
# renders the post in the normal frame, and the trailing-slash permalink
# lands the artifact as dir/index.html - an extensionless fragment would be
# served by Pages as application/octet-stream: never injected, absent from
# sitemap/feed/llms.
layout: default
title: "Announcing freestruct v0.9.0"
description: The v0.9.0 Discussions release post - the first npm line, the rehaul-era stack promoted to one version number, per the Creadev family release-post convention
---

# freestruct v0.9.0

freestruct is a post-build SEO layer for static doc sites. It runs after your SSG builds, on the finished HTML, with no plugin and no template edits. v0.9.0 is the first release line on npm, and it is a truth promotion rather than a new behavior change: the rehaul-era stack that accumulated under the 0.6.0 freeze was renamed up to one number, and every artifact now names it.

```bash
npm i -D freestruct
```

## What 0.9.0 is

The 0.6.0 freeze held the version at one number everywhere behind a CI pin while the engine was rebuilt. 0.9.0 is the owner call that promotes the committed truth: nothing in this line is a new behavior change, it is the post-0.6.0 work that had already shipped to the tree, now carrying one release number. The stack that rides the number:

- **The prestruct-shaped house structure.** `engine/` for the pipeline, `init/` for the consumer scaffold kit, a `bin/` shim, and a template sync gate that keeps the copies byte-identical.
- **The crashtest pack surface.** `packs/` is dogfooded in CI, so the built docs are attacked the way a static host serves them.
- **The CI gate family.** A tarball e2e that installs the packed package on a fresh machine, a pack-selftest leg, the `--strict` graduation into the docs CI (its harvest fixed three production 404s), and the docs audit (frontmatter, links, nav, style, truthfulness, English-only language, engine-header codefmt).
- **The SEO port wave from prestruct.** A deterministic, content-derived build hash so identical content rebuilds to an identical `freestruct-build` meta and `?v=` asset params; the CLI subcommands `validate`, `init`, and `help`; the `FREESTRUCT_URL` env override, implemented after being documented but never honored; HTML-attribute escaping for every injected og/twitter/canonical value and JSON-safe literals inside the generated JSON-LD; `og:image` ship-when-set parity; the `author` config key; per-page data comments; and the `jsonLd` config key.
- **The toolchain bump.** GitHub Actions moved to Node-24-compatible majors, Jekyll 4.3 to 4.4, Ruby 3.3 to 3.4, `js-yaml` 4 to 5.5.0, and the Pagefind and Prism pins moved with them.

## What ships in the package

The npm tarball is exactly the 25-file files whitelist: the engine (`engine/`), the bin shim, the consumer scaffold kit (`init/`), and the LICENSE, README, and package.json. Verify it yourself:

```bash
npm pack freestruct
tar -tzf freestruct-*.tgz
```

## The release ladder

0.9.x is the manual npm ladder. The governed ladder begins at 1.0.0: tag v1.x.0 and `publish.yml` runs the three-job family release lane over OIDC Trusted Publishing. The full runbook lives in DEPLOY.md in the repository.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
