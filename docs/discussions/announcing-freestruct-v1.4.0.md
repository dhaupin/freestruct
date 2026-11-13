---
version: 1.4.0
permalink: /discussions/announcing-freestruct-v1.4.0/
layout: default
title: "Announcing freestruct v1.4.0"
description: The v1.4.0 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.4.0

freestruct is a post-build SEO layer for static doc sites. v1.4.0 is everything since the v1.3.0 tag: a presentation and family-plumbing round. The product site and docs site flip to light-first, the init kit turns on the breadcrumb trail, and the family's shared plumbing (the staging fast-forward sync and the Dependabot flow) lands. There is no engine-surface change, so the battery holds at 192. This post ships with the v1.4.0 tag:

```bash
npm i -D freestruct
```

## What landed

**Light mode by default.** The product site and the docs site shipped dark-first, with a persisted `light` as the opt-in. Now light is the first paint and a persisted `dark` is the opt-in: `<html>` pins `data-theme="light"`, the pre-paint bootstrap applies only a persisted `dark`, and the `theme-color` meta flips to the light paper. The CSS token blocks are untouched - the light block was already the second half of one set - so no palette, toggle handler, or gate changed.

**The breadcrumb opt-in in the init kit.** Google Search Console showed the family's properties under a breadcrumbs enhancement with zero results. freestruct has carried auto `BreadcrumbList` since 1.1.0, but the init kit did not turn it on, so a freshly scaffolded site shipped without the trail. `init/docs/freestruct.config.yml` now carries `breadcrumb: true` - the starter is the family default, so a new site is discoverable from birth. `breadcrumb` is a known key, so the kit stays schema-clean.

**The staging fast-forward sync.** `staging` is a permanent mirror of `main`, so a merge-commit promotion drifts the two by one every time. `.github/workflows/staging-ff-sync.yml` closes that gap: on every push to `main` it runs `git push origin origin/main:refs/heads/staging` - a fast-forward-only refspec, never a merge, never a force-push, and it fails loudly if `staging` ever moves ahead of `main`.

**The Dependabot flow.** `.github/dependabot.yml` carries the family flow: a weekly (Monday) pass, grouped minor/patch updates in one pull request, majors alone, and the `github-actions` ecosystem so the SHA-pinned refs move without a hand-edit.

**Housekeeping.** The `.gitignore` docs block now carries the in-tree Jekyll and pagefind products, and the family pins (the crashtest pack teeth, the packstruct manifest lint, and the prestruct `^1.3.0` floor) move to the current cuts.

## Quality layer

The fixture battery holds at 192 - this round changed presentation and plumbing, not the engine, so no new pins were needed and none regressed. CI runs the full gate set on every push and pull request: the battery, the docs audit, template sync lockstep, the tarball e2e, the crashtest pack selftest, and a live docs deploy that dogfoods freestruct against its own freshly built site.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
