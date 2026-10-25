---
layout: default
title: Freestruct - post-build SEO for static doc sites
description: One command after any SSG builds - every page of your docs gets full SEO meta, a real sitemap, an RSS feed, a noindex 404 and cache-busted assets.
nav_order: 0
---

# Your docs deserve real SEO. One command after the build.

Freestruct is a post-build SEO layer for static doc sites. Run it after any
static site generator - Jekyll, Hugo, Astro, you name it - and your build
stays untouched. Freestruct reads the built HTML and finishes the SEO every
page still needs: complete meta, a real `sitemap.xml`, `robots.txt`, an RSS
feed, a noindex `404.html`, cache-busted assets and validated links.
No plugins, no template edits.

## The pipeline

| Stage | What happens |
| --- | --- |
| Any SSG | your build, untouched |
| Built tree | plain HTML files |
| Freestruct | `npx freestruct` - one command, zero plugins |
| SEO-grade tree | meta + artifacts, fresh on every run |

## Install

```bash
npm i -D freestruct && npx freestruct
```

## What lands on every page

Rank in search. Look sharp in every link preview. Everything below is
injected into your built pages missing-only: what you already set stays
yours. Nothing overwritten, nothing guessed.

- **Meta + canonical** - Full search-engine armor: title, description, a
  self canonical, plus Open Graph, Twitter and JSON-LD blocks - added only
  where a page is missing them, so your own settings always win.
- **`sitemap.xml`** - Every page, one entry, real per-page `<lastmod>` dates
  crawlers can trust - properly escaped XML.
- **`robots.txt`** - Waves crawlers in and hands them your sitemap. The
  pointer stays correct even on sub-path installs.
- **RSS feed** - A feed readers actually subscribe to: escaped titles,
  per-page `pubDate`, honest per-page dates.
- **A noindex 404** - Dead ends resolve to a 404 that search engines skip.
  Generated when your tree lacks one; a 404 you ship is finished, not
  overwritten.
- **Cache-busted assets** - Every asset URL carries a fresh per-build hash,
  so CDNs always serve the latest version - with optional purge hooks for
  your CDN.
- **Sub-path friendly URLs** - Canonical, sitemap, feed and 404 links carry
  `site.url + basePath` exactly once, so sub-path installs just work.
- **Link validation** - Every internal link is checked on every run - and
  with `--strict` a broken one fails the build, so dead links never ship.
  `freestruct audit` verifies the same truth independently on the baked
  output (heads, 404 noindex, sitemap/robots) with `--json` for CI.
- **Search-engine notify** - with `indexNow` in the config the key file
  ships into the output (IndexNow's keyLocation proof, Bing/Seznam/Yandex)
  and `freestruct indexnow` submits the baked sitemap after deploy.
- **Scoped config** - `jsonLd` and `og.scoped` keys take slug globs
  (`/faq` exact, `/blog/*` one segment, `/guides/**` a sub-tree), so
  page-specific schema and per-directory image variants stay config-side.
- **Per-page OG images** - `ogImageGeneration` renders a branded 1200x630
  PNG per page from your SVG template (needs the optional
  `@resvg/resvg-js` package; loud skip without it), wired under
  missing-only.
- **Discovery extras** - Opt-in keys that finish the modern head:
  `search` for the SearchAction sitelinks JSON-LD, `breadcrumb: true` for
  auto BreadcrumbList, `article.scoped` for per-page article JSON-LD,
  `verification` for site-ownership metas, `locales` for hreflang
  alternates, and `llms: true` for the AI-consumable `llms.txt` summary.
  All missing-only; all pinned.
- **Loud diagnostics** - When something is off you get the named cause and
  an exit code that says which step failed (1 config, 2 template, 3 output
  dir, 4 hook failure), never a mystery crash. `--tolerant` keeps
  experiments soft.

## It generates HTML too

Freestruct does not stop at injecting tags into your pages. It also writes
complete HTML and machine-readable output for you:

- A noindex `404.html`, generated when your built tree lacks one. Your own
  404 is respected and finished - never overwritten.
- `sitemap.xml`, `robots.txt` and `feed.xml` written as real artifacts your
  host can serve as-is.
- Packaged SEO templates - the meta/canonical block, Open Graph, Twitter
  and JSON-LD segments - ready to use as-is or as starting points. Stage a
  copy in `docs/_freestruct/` and it always wins over the package-shipped
  template.
- The `init/` scaffold kit: a commented starter config plus template
  copies, version-stamped to your install. Copy + go:

```bash
npm install --save-dev freestruct
cp -r node_modules/freestruct/init/docs .
```

## Any generator. No plugins.

Your SSG builds - Freestruct finishes. Jekyll, Hugo, Docusaurus, MkDocs,
VitePress, Astro, Eleventy - or anything that emits HTML.

## Quick start

1. **Build like always** - Your SSG stays untouched; whatever it emits is
   the input.

   ```bash
   jekyll build   # or hugo, mkdocs build, ...
   ```

2. **Add one config** - Site name + URL; options are optional. Unknown or
   retired keys warn loudly, they never die silently.

   ```yaml
   # docs/freestruct.config.yml
   site:
     name: My Docs
     url: https://example.com/docs
   ```

3. **Run Freestruct** - Config and output dir are discovered
   automatically; every page and artifact gets finished.

   ```bash
   npx freestruct
   ```

## For agents too

Freestruct is agent-hardened and CI-proven. The boring trust facts are
pinned by an 89-test battery and run on every push:

- `exit 0` quietly means the tree finished; `1 / 2 / 3 / 4` name exactly
  which step failed (config, template, output dir, hook failure)
- fresh-install behavior is proven by the tarball e2e: real pack, real
  install, real quick start
- an adversarial crashtest pack attacks our own built docs in CI on every
  push
- broken-links-as-failures is how our own Pages deploy runs
- `AGENTS.md` at the repo root orients a coding agent in one file
- config semantics are battery-pinned before any doc claims them

## With Freestruct vs doing it by hand

| With Freestruct | Doing it by hand |
| --- | --- |
| Write 4 lines of config once | Edit every page template |
| Run one command after build | Maintain a plugin per SSG forever |
| Switch SSGs without changing the SEO plan | Re-implement meta + sitemap each time |
| Trust a CI that attacks its own output | Hope nothing regresses |

## Explore

- [Getting started](/getting-started)
- [Config guide](/guides/freestruct-config)
- [CI/CD recipes](/guides/cicd)
- [Troubleshooting](/guides/troubleshooting)
