---
title: Freestruct.config.yml Reference
description: Complete reference for freestruct.config.yml options
nav_order: 11
---

## Overview

`freestruct.config.yml` is the central configuration file for Freestruct. It defines your site's SEO settings that get injected into every page.

> NOTE: before v0.6.0 the file was named `ssr-config.yml`. Both names are read (the legacy name participates in the same upward search), but new installs should use `freestruct.config.yml`.

## Example

```yaml
outputDir: _site

site:
  url: https://example.com
  name: My Docs
  description: Documentation for my project

twitter:
  username: "@janedev"
  card: summary

og:
  image: /assets/og-image.png
  locale: en_US
  type: website
```

## Output Directory

The output directory from your SSG build.

```yaml
outputDir: _site  # Jekyll
outputDir: public   # Hugo, Gatsby
outputDir: build   # Docusaurus
```

## Generate Options

### generateSitemap

Generate `sitemap.xml` automatically (default: true).

```yaml
generateSitemap: true   # generates sitemap.xml
generateSitemap: false  # skip sitemap generation
```

### generateRobots

Generate `robots.txt` automatically (default: true).

```yaml
generateRobots: true   # generates robots.txt
generateRobots: false  # skip robots.txt
```

### generate404

Generate `404.html` automatically (default: true). If a custom `404.html` already exists in the output directory, Freestruct will use it instead of generating one.

```yaml
generate404: true   # generates 404.html (or uses custom)
generate404: false  # skip 404 page generation
```

### generateFeed

Generate RSS feed (feed.xml).

```yaml
generateFeed: true   # generates feed.xml (on by default)
generateFeed: false  # skip feed generation
```

### readingTime

Inject estimated reading time into each page.

```yaml
readingTime: true   # injects reading time meta (on by default)
readingTime: false  # skip reading time
```

### lastModified

Inject last-modified timestamp.

```yaml
lastModified: true   # injects current timestamp (on by default)
lastModified: false  # skip
```

### lazyLoad

Add loading="lazy" to images.

```yaml
lazyLoad: true   # adds lazy loading (on by default)
lazyLoad: false  # skip
```

### linkCheck

Check internal links for broken references.

```yaml
linkCheck: true   # check and warn (on by default)
linkCheck: false  # skip link checking
```

### searchIndex

Generate search.json for client-side search.

```yaml
searchIndex: true   # generates search.json (on by default)
searchIndex: false  # skip search index
```

### generateNav

Generate navigation from docs folder structure (default: true). Set false to use SSG menu.

```yaml
generateNav: true   # auto-generate from folder (default)
generateNav: false  # use SSG built-in menu
```

## Cache Busting Options

### cacheBusting

Configuration for the cache busting system.

```yaml
cacheBusting:
  hash: true              # generate build hash (default: true)
  assetQueryParam: true   # add ?v=hash to assets (default: true)
  hashInCanonicalUrl: false # add ?v=hash to canonical (default: false)
```

### runHooks

**Security: Disabled by default**. Enable to run purge commands defined in `cacheBusting.purge`.

```yaml
# Must be explicitly enabled
runHooks: true   # allow purge commands to execute
runHooks: false # default - no commands run
```

When enabled, you can define purge commands:

```yaml
cacheBusting:
  purge:
    - name: cloudflare
      command: "curl -X DELETE https://api.cloudflare.com/..."

runHooks: true  # required to enable
```

The same opt-in also gates the general `hooks.postBuild` seam (issue #21):

```yaml
runHooks: true

hooks:
  postBuild:
    - node scripts/faqp-schema.mjs
    - npm run seo:audit
```

PostBuild commands run after the whole pass (purges included) with a 30s
timeout, the `$SITE_URL` / `$BUILD_HASH` / `$OUTPUT_DIR` placeholders and the
matching `FREESTRUCT_*` env vars, and a nonzero exit fails the build with
exit code 4. Unknown hook seams and non-string entries are loud config
warnings, never silently ignored.

## Notify Options

### indexNow

IndexNow is a one-POST notify protocol shared by Bing, Seznam and Yandex; a
docs site that re-crawls one hour after shipping beats one that waits
next-crawl-day. Two config shapes:

```yaml
# generate a 32-hex key once and persist it next to the config
indexNow: true

# or bring your own already-registered key
indexNow:
  key: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab1
```

The run emits `<key>.txt` into the output dir (the keyLocation ownership
proof search engines probe) and, on the generate-once path, persists the key
to `indexnow-key.txt` next to the config - commit that file so the
keyLocation stays stable across runs. A wrong-shaped key is a loud config
warning and the key file never ships.

Submission is a SEPARATE, post-deploy step:

```bash
npx freestruct indexnow --dry-run   # print the request body, no network
npx freestruct indexnow             # POST the baked sitemap URL list
```

Deploy first: keyLocation must resolve live before a submission, otherwise
the engines reject the ownership signal. The command reads only the baked
`sitemap.xml`, surfaces the HTTP status in its output (200/202 accepted),
and exits `0` accepted / `1` failure / `3` missing output dir or sitemap.
Note that the run itself never submits - it only ships the key file.

## Image Generation Options

### ogImageGeneration

Per-page OG image generation (issue #22): instead of one shared banner,
freestruct renders a branded 1200x630 image per page from a template using
the title/description it already extracts, and wires `og:image`,
`twitter:image` and the issue #20 companions to the fresh PNG (missing-only:
pages with their own og set keep it wholesale).

```yaml
ogImageGeneration:
  template: og-template.svg    # configDir-relative; 1200x630 SVG
  font: ./brand/brand-bold.ttf # optional TTF/OTF loaded into the rasterizer
  width: 1200                  # optional (default 1200)
  height: 630                  # optional (default 630)
```

The template carries three placeholders, XML-escaped before substitution:
`{{ogTitle}}`, `{{ogDescription}}`, `{{ogUrl}}` - layout, colors and text
wrapping are yours to design (text elements rely on the configured font;
system fonts are unreliable in build sandboxes).

Rasterization is honest: PNG cannot be made in pure Node, so the engine
loads the OPTIONAL `@resvg/resvg-js` package (`npm install --save-dev
@resvg/resvg-js`) and, when it is absent, generation loud-skips per run -
never silently, never half-shipping. Deterministic: identical page meta
renders identical bytes, so the content-derived build hash stays honest.
Noindex pages receive no share preview; output lands in `og/<flattened-slug>.png`
with `og:image:width`/`height`/`alt` companions riding along.

## Path Options

### basePath

Optional base path to strip from canonical URLs (for subpath deployments).

```yaml
basePath: /myproject  # Strip /myproject from URLs
```

### preserveExistingMeta

Whether to preserve existing meta tags or replace them entirely.

```yaml
preserveExistingMeta: true   # default - only add missing tags
preserveExistingMeta: false  # remove existing SEO first, then inject fresh
```

## Site Options

### site

Site-level information.

| Key | Required | Description |
|-----|----------|-------------|
| `url` | Yes | Full URL of your site |
| `name` | Yes | Site name |
| `description` | No | Default site description |

### author

Optional author identity, shipped as a schema.org `Person` under
`"founder"` on the injected Organization JSON-LD block.

```yaml
author:
  name: Jane Doe
  url: https://janedoe.dev
```

| Key | Required | Description |
|-----|----------|-------------|
| `name` | Yes (to ship `founder`) | Author name |
| `url` | No | Author URL (GitHub, personal site, etc.) |

No author configured: the Organization JSON-LD carries no `founder` key.

### jsonLd

Custom structured data, appended after the built-in Organization and WebSite
JSON-LD blocks. Takes a single object, an array of objects, or (issue #25) a
slug-glob MAP that scopes blocks per page:

```yaml
# global - every page gets these (legacy form, unchanged)
jsonLd:
  - "@type": BreadcrumbList
    itemListElement:
      - "@type": ListItem
        position: 1

# scoped - blocks keyed by page-slug globs
jsonLd:
  "/":                       # exact keys match one page (the root here)
    - "@type": WebPage
      name: Landing
  "/guides/**":              # the directory AND everything below it
    - "@type": HowTo
  "/blog/*":                 # exactly one segment under /blog
    - "@type": BlogPosting
  "**":                      # anywhere at all
    - "@type": Organization
      name: My Docs
```

Scoped semantics: matching blocks land after any global list, most specific
first (exact keys outrank globs; between globs the one carrying more literal
path characters wins the order); every matching key ships, not just the
first. Pages with their own `application/ld+json` receive no blocks at all
(missing-only, scoped included). One malformed entry warns loudly and skips
only itself. Serialization neutralizes `<` (as `\u003c`) so a value cannot
close the script tag early; a non-object entry is skipped with a loud
`[freestruct] config warning`
  line; nothing dies silently.

## Meta Options

### twitter

Twitter Card meta tags.

| Key | Required | Description |
|-----|----------|-------------|
| `username` | No | Twitter handle (include @). Omit the whole twitter block without one: `twitter:site` and `twitter:creator` then stay out of the injected head (card type and `twitter:title` still inject) |
| `card` | No | Card type: `summary`, `summary_large_image`, `app`, `player` |

`twitter:description` ships alongside `twitter:title` on every page (same
value as `og:description`), and `twitter:image` ships whenever an
`og.image` (or per-page `ogImage`) is configured.

### og

Open Graph meta tags.

| Key | Required | Description |
|-----|----------|-------------|
| `image` | No | OG image path (absolute or relative to site url) |
| `locale` | No | Locale (default: `en_US`) |
| `type` | No | Content type: `website`, `article`, `book`, `profile` |

`og.image` is optional: with no image configured (and no per-page override),
no `og:image` or `twitter:image` tag ships at all - a bare image tag pointing
at the site root is a broken social card, not a fallback. Relative image
paths are joined onto `site.url`; absolute HTTP(S) values pass through
unchanged. Values that reach the head are HTML-attribute-escaped first.

`og.image` takes two shapes:

```yaml
# string form - same as ever
og.image: /assets/og-image.png

# object form ({ src, width, height, alt, allowSvg }) - the shared prestruct
# shape; additionally emits the companion tags scrapers size previews with:
og.image:
  src: /assets/og-image.png
  width: 1200
  height: 630
  alt: Docs banner
```

The object form ships `og:image:width`, `og:image:height` and
`og:image:alt` next to `og:image` (the string form stays companion-free).
Wrong shapes warn loudly and stay honest (no image ships from a missing
`src`); unknown companion keys name themselves as config warnings.

SVG sources are a trap: most social scrapers cannot render them and the
share preview blanks. An `.svg` src (string or object form) refuses silently
no more - it warns on every run, `og.image.allowSvg: true` accepts it
explicitly, and `--strict` fails the build until the trap is answered.

`og.scoped` (issue #25 follow-on) scopes image variants by page-slug glob,
using the same key language as the scoped `jsonLd` map (exact keys, `*` one
segment, `**` a sub-tree). Each value takes the plain `og.image` shapes;
the MOST SPECIFIC matching key wins for the page (an image is singular),
and the global `og.image` is the fallback:

```yaml
og:
  image: /og/default.png        # global fallback
  scoped:
    "/": /og/home.png           # the landing page gets its own card
    "/blog/**":                 # the sub-tree gets the article banner,
      src: /og/article.png      # with the #20 companions riding
      width: 1200
      height: 630
      alt: Article preview
```

Per-page `ogImage` overrides (and per-page generated images from
`ogImageGeneration`) still replace the whole image set ahead of any scoped
match - the resolution order is override, generated, scoped, global.

## Template Placeholders

Available placeholders in `inject-brand.html`:

| Placeholder | Description |
|-------------|-------------|
| `{{pageTitle}}` | Page title |
| `{{pageDescription}}` | Page description |
| `{{pageUrl}}` | Full page URL |
| `{{canonicalUrl}}` | Canonical URL |
| `{{siteUrl}}` | Site base URL |
| `{{siteName}}` | Site name |
| `{{siteDescription}}` | Site description |
| `{{twitterUsername}}` | Twitter handle |
| `{{twitterCard}}` | Twitter card type |
| `{{ogImage}}` | OG image path |
| `{{ogImageFull}}` | OG/Twitter image as a full URL (relative values joined onto the site url) |
| `{{ogType}}` | OG content type |
| `{{ogLocale}}` | OG locale |

## Per-Page Options

For page-specific SEO, add a data comment to the built page:

```html
<!-- freestruct: {"title": "My Page", "ogType": "article", "ogImage": "/images/post.jpg"} -->
```

| Key | Effect |
|-----|--------|
| `title` | Replaces the page part of the og/twitter title composition (the site name suffix still applies) |
| `description` | Replaces the injected description (og and twitter) |
| `ogType` | Replaces the injected `og:type` value |
| `ogImage` | Per-page og image; relative values join onto `site.url` like `og.image` |
| `twitterCard` | Replaces the injected `twitter:card` value |
| `publishedTime` | Ships `article:published_time` with the og injection |
| `author` | Ships `article:author` with the og injection |
| `section` | Ships `article:section` with the og injection |

Ground rules:

- Missing-only wins: a page that already ships its own description, Open
  Graph or Twitter tags keeps them, and overrides aimed at those groups are
  skipped with a loud `[freestruct] page warning` line (they never die
  silently).
- `article:published_time`, `article:author` and `article:section` ride the
  Open Graph injection: they ship only when freestruct actually injects og
  tags on that page.
- Unknown keys in the comment warn; malformed JSON in the comment warns and
  the whole comment is ignored.
- Attribute values are HTML-escaped before they land in the head.

## Source Attribution

Injected HTML includes a source comment:

```html
<!-- injected by freestruct: https://github.com/dhaupin/freestruct -->
```

## Environment Overrides

You can override config values via environment variables:

```bash
FREESTRUCT_URL=https://staging.example.com npx freestruct
```

## Related

- [Getting Started](/getting-started) - First-run installation and quick start
- [Configuration](/configuration) - The high-level overview of every feature
- [Troubleshooting](/guides/troubleshooting) - When a config key misbehaves
