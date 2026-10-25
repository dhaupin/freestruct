---
version: 1.0.0
permalink: /discussions/announcing-freestruct-v1.0.0/
# Family release-post shape (the crashtest docs precedent): layout default
# renders the post in the normal frame, and the trailing-slash permalink
# lands the artifact as dir/index.html - an extensionless fragment would be
# served by Pages as application/octet-stream: never injected, absent from
# sitemap/feed/llms.
layout: default
title: "Announcing freestruct v1.0.0"
description: The v1.0.0 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.0.0

freestruct is a post-build SEO layer for static doc sites. v1.0.0 is the first stable release. It is on npm now:

```bash
npm i -D freestruct
```

This post covers what the engine does, what ships in the package, and how to start using it. Repo links at the end.

## Why it exists

Every static site generator ships a template engine, not an SEO layer. After your build, the output tree still misses what crawlers and social cards need: canonical URLs, Open Graph, Twitter Cards, structured data, a real sitemap, an RSS feed, a noindex 404 page. Fixing it means either a plugin coupled to one SSG (Hugo for the Hugo users, Jekyll for the Jekyll users) or hand-editing templates. freestruct is neither: it runs AFTER your SSG builds, on the finished HTML, with no plugin and no template edits. Jekyll, Hugo, MkDocs, Docusaurus, VitePress, Astro, Eleventy - whatever emitted the tree, the same one command finishes it.

## How the engine works

One pass over the output tree:

1. **Config discovery** - `docs/freestruct.config.yml` is found by walking up from the cwd (legacy `ssr-config.yml` is still read). Config-first, no magic: unknown and retired keys produce loud `[freestruct] config warning` lines, and fatal errors exit with their own exit code.
2. **Page snapshot** - every page is modeled once pre-injection (slug, mtime, title, description, noindex flag). mtimes are captured here so sitemap `lastmod` and RSS `pubDate` reflect your SSG build, not the decoration pass.
3. **Missing-only injection** - pages that already ship canonical/OG/Twitter/JSON-LD/description keep them; bare pages get the full set, value-escaped into attributes and JSON-safe inside the LD+JSON blocks.
4. **Page-level overrides** - a `<!-- freestruct: {...} -->` comment tunes the injected tags per page (title, description, ogType, ogImage, twitterCard, publishedTime, author, section).
5. **Artifacts** - `sitemap.xml` (real per-page `lastmod`, noindex pages excluded), `robots.txt`, `feed.xml`, a generated-or-adopted `404.html` that gets the full pipeline plus an explicit noindex.
6. **Cache busting** - assets get `?v={hash}`, where the hash is derived from config + content, not the clock: identical content rebuilds to an identical hash, so CDNs cache correctly; real changes always flip it.

## What ships in the package

25 files: the engine (`engine/`, nine modules), the bin shim, and the consumer scaffold kit (`init/`: starter config plus template copies). Nothing else. Verify it yourself:

```bash
npm pack freestruct
tar -tzf freestruct-*.tgz
```

## Config

One file, `docs/freestruct.config.yml`, not two. The required part is two lines; everything else has a working default:

```yaml
# docs/freestruct.config.yml
site:
  name: My Docs
  url: https://example.com/docs
  description: Documentation for my project

# Optional facts the structured data picks up:
author:
  name: Your Name
  url: https://github.com/you

# Site-level custom JSON-LD, appended after the built-in Organization +
# WebSite blocks (missing-only, same as everything else):
jsonLd:
  - "@type": BreadcrumbList
    itemListElement:
      - "@type": ListItem
        position: 1
```

Every key has a working default; the reference lists each one with its default and its warning behavior when it is wrong.

## The CLI

```bash
npx freestruct            # the full post-build pass
npx freestruct validate   # config-only preflight (exit 1 on fatal errors)
npx freestruct init       # scaffold the starter kit into ./docs
npx freestruct --strict   # broken internal links fail the CI build
```

Exit codes are part of the documented contract: 0 ok, 1 config fatal, 2 template missing, 3 output dir missing.

## Quality layer

The engine's behavior is pinned by a committed fixture battery (52 tests, red-checked before each change), a docs audit with seven gates, template sync checks, a tarball e2e that installs the packed package on a fresh machine, and a crashtest pack that attacks the built docs the way a static host serves them. CI runs all of it on every push.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
