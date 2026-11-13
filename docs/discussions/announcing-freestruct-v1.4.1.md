---
version: 1.4.1
permalink: /discussions/announcing-freestruct-v1.4.1/
layout: default
title: "Announcing freestruct v1.4.1"
description: The v1.4.1 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.4.1

freestruct is a post-build SEO layer for static doc sites. v1.4.1 is a distribution fix with no engine-surface change: the `freestruct-docs-shapes` pack now rides the published tarball, so a consumer who arms it by an exact npm pin actually receives it. The fixture battery holds at 192. This post ships with the v1.4.1 tag:

```bash
npm i -D freestruct
```

## What landed

**The pack rides the published tarball (poststruct#79).** `package.json` `files` carried `bin/`, `engine/`, and `init/` (plus the two `!init` negations), but not `packs/`. npm honours `files`, so `npm pack` shipped zero pack bytes and `npm i freestruct` installed a tree with no `node_modules/freestruct/packs/`. The `freestruct-docs-shapes` pack - the static-host wire truths (hostile-traversal refusal, generated-404 noindex, noindex artifact leaks, query-independent canonicals, XML artifact shape) - was committed and green yet undeliverable, because the family arms every verdict by an EXACT npm pin.

`packs/` joins the whitelist (`!init/node_modules` and `!init/dist` still exclude the kit's build products), so a consumer arms `node_modules/freestruct/packs/public/freestruct-docs-shapes` from the pin. The publish lane's verify job passes `--allowed "packs/"` - the family-default forbidden scan refuses `packs/` by prefix, so the flag de-asserts exactly that drift. `test/distribution.test.cjs` pins the two halves of the contract, so a refactor that drops the whitelist fails CI instead of a consumer's install.

## Quality layer

The fixture battery holds at 192 - this round changed distribution, not the engine, so no new pins were needed and none regressed. CI runs the full gate set on every push and pull request: the battery, the docs audit, template sync lockstep, the tarball e2e, the crashtest pack selftest, and a live docs deploy that dogfoods freestruct against its own freshly built site.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
