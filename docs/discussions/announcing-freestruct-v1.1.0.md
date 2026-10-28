---
version: 1.1.0
permalink: /discussions/announcing-freestruct-v1.1.0/
# Family release-post shape (the crashtest docs precedent): layout default
# renders the post in the normal frame, and the trailing-slash permalink
# lands the artifact as dir/index.html - an extensionless fragment would be
# served by Pages as application/octet-stream: never injected, absent from
# sitemap/feed/llms.
layout: default
title: "Announcing freestruct v1.1.0"
description: The v1.1.0 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.1.0

freestruct is a post-build SEO layer for static doc sites. v1.1.0 is the first post-stable release: a suite of new surface that includes the entire issue sweep and the SEO-gap pass, everything battery-pinned. This post ships with the v1.1.0 tag: npm has the tarball by the time you read it:

```bash
npm i -D freestruct
```

## What landed

Three groups of work, in one release.

**The verification layer.** `freestruct audit` verifies a BAKED output tree independently of the run that produced it, so it works after any SSG's build: per-page head hygiene (titles, descriptions, absolute canonicals, the core og/twitter set, the SVG share-preview trap, JSON-LD parse checks, h1 sanity), the 404 noindex contract, and the sitemap/robots artifacts. It prints a human report, prints a `--json` digest for CI annotations, and exits 1 on FAIL findings. Duplicated tags now ride the FAIL class too - a double canonical or double og:title is always consumer-caused (missing-only injection cannot duplicate), so the audit names it instead of grading around it. A failing `hooks.postBuild` command now also fails the build with the documented exit code 4.

**The consumer surface.** `og.image` takes the structured `{ src, width, height, alt }` form and ships its companion tags; SVG sources warn loudly and fail under `--strict`, because a broken share preview is worse than no tag. A slug-glob scoped config form now keys blocks per page: `jsonLd`, `og.scoped` and `article.scoped` all take exact keys (`/faq`), one-segment globs (`/blog/*`) and sub-tree globs (`/guides/**`), most specific first. `ogImageGeneration` renders a branded 1200x630 PNG per page from a consumer SVG template (opt-in through the optional `@resvg/resvg-js` rasterizer). IndexNow support ships end to end: `indexNow: true` emits the keyLocation ownership file during the run, and `freestruct indexnow` POSTs the baked sitemap to the API after deploy (`--dry-run` first, of course).

**The SEO-gap pass.** Eight additions that finish the modern head, all opt-in, all missing-only:

- **Feed autodiscovery** - every injected head carries the `rel="alternate" type="application/rss+xml"` link, since feed.xml shipped for a year with nothing pointing readers at it.
- **SearchAction** - `search.url` drives the WebSite JSON-LD's potentialAction. The old hardcoded `?s=` default is gone: a search target for every consumer is a bug, not a feature, and no config now ships a bare WebSite block.
- **Auto breadcrumbs** - `breadcrumb: true` builds a BreadcrumbList from each page's own position in the URL tree.
- **Per-page article JSON-LD** - `article.scoped` emits typed Article / TechArticle / NewsArticle blocks from the page facts.
- **Site verification** - `verification` with the engine-owned meta name spellings (`google-site-verification`, `msvalidate.01`, and friends).
- **hreflang** - `locales` maps slug globs to language codes and stem-swaps the alternates in both directions, x-default included.
- **llms.txt** - `llms: true` emits the AI-consumable docs summary over the same indexable page set sitemap and feed honor, so noindex stays honored everywhere.
- **External link audit** - `freestruct audit --external` HEAD-checks up to 50 unique external hrefs (warn-grade, opt-in, needs a live network).

## Config

Still one file, `docs/freestruct.config.yml`. The two required lines are unchanged; the new keys slot in beside them:

```yaml
# docs/freestruct.config.yml
site:
  name: My Docs
  url: https://example.com/docs
  description: Documentation for my project

# Discovery options - opt-in, missing-only, loudly diagnostic:
search:
  url: https://example.com/search?q={search_term_string}
breadcrumb: true
verification:
  google: goog-code-123
locales:
  "/": en
  "/de/**": de
llms: true
```

Wrong-shaped values warn at load with the named fix and the run stays honest: a placeholder-less search URL ships no SearchAction, a list where one image belongs ships no image, and an unknown section title passes through with a `config warning` line.

## The CLI

```bash
npx freestruct            # the full post-build pass
npx freestruct validate   # config-only preflight
npx freestruct audit      # verify the baked output; --json, --external
npx freestruct indexnow   # post-deploy search-engine notify
npx freestruct init       # scaffold the starter kit
npx freestruct --strict   # broken links + SVG og:image fail the CI build
```

Exit codes remain part of the contract: 0 ok, 1 config fatal, 2 template missing, 3 output dir missing, 4 hook failure.

## Quality layer

The fixture battery grew from 49 pins at the 1.0.0 sweep's start to 118 now, with red-checked additions per change and the hunt passes that found and fixed the noindex-junk and line-flattening classes before any release. Post-draft hardening sweeps walked the untouched engine corners and shipped what they caught, all pinned: the missing-only gates became tag-anchored (a page quoting `application/ld+json` in its own prose can no longer silence its structured-data injection), a consumer basePath with a trailing slash no longer doubles every injected URL, a file at the outputDir path fails as a named error instead of a stack dump, headless `.html` fragments name themselves on the run rather than silently skipping injection, `.htm` and mixed-case extensions join the full pipeline, the link checker resolves pretty-URL routes (directory index and `.htm` sibling shapes, root-relative hrefs on nested pages), and the breadcrumb trail coexists with any config `jsonLd` form - our own docs shipped exactly that footgun live. The last sweeps closed two quiet-mistake classes outright: the injector now refuses to walk an SSG source tree (a wrong positional could stamp build meta into committed templates, silently), and a typo'd CLI flag fails loudly instead of riding as an output directory; the audit also stops repeating the twitter absence rows for teams without a configured handle. The family sweep landed next: the link checker now resolves root-absolute hrefs against the configured `basePath`, so a baseurl'd site's nav passes `--strict` instead of flagging every menu link; config-gated audit absences (`og:image`, `twitter:image`) collapse to one line each with an affected-page count instead of repeating on every page; and the release gate is composed - `npm run check` (battery + docs audit + pack selftest) runs from `prepublishOnly`, so a dirty tree cannot publish. Two construction guards followed: a default-on `tableWrap` pass wraps every wide table in a scroll container, so a phone no longer pins the whole page to a table's min-content width, and the init kit's starter config now seeds the family JSON-LD identity, so scaffolded ports ship founder and maintainer from birth. CI runs the standard gates (docs audit with seven gates, template sync lockstep, tarball e2e), plus crashtest two ways: the pack selftest proves the attack surface holds, and the docs deploy dogfoods a second campaign against the freshly built site. Packstruct's manifest lint holds the `/packs` spec from drifting. All of it runs on every push and PR.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
