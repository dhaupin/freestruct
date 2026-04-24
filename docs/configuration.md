---
title: Configuration
description: Configure freestruct for your doc site
---

## ssr-config.yml

All freestruct configuration lives in `ssr-config.yml`. This is the single source of truth for SEO settings.

## Basic Setup

```yaml
site:
  url: https://example.com
  name: My Documentation
  description: Documentation for my project
```

## Full Configuration

```yaml
# Output directory from SSG build
outputDir: _site

# Preserve existing meta tags (default: true)
# Set to false to remove existing SEO and inject fresh
preserveExistingMeta: true

# Site info
site:
  url: https://example.com
  name: My Documentation
  description: Comprehensive docs for my project

# Author info
author:
  name: Your Name
  url: https://github.com/yourusername

# Twitter Card settings
twitter:
  username: "@yourhandle"
  card: summary  # summary, summary_large_image, app, player

# Open Graph settings
og:
  image: /assets/og-image.png
  locale: en_US
  type: website  # website, article, book, profile

# Keywords for search engines
keywords:
  - documentation
  - guides
  - api
```

## Template Placeholders

Available placeholders in `inject-brand.html`:

| Placeholder | Description |
|-------------|-------------|
| {{pageTitle}} | Page title |
| {{pageDescription}} | Page description |
| {{pageUrl}} | Full page URL |
| {{canonicalUrl}} | Canonical URL |
| {{siteUrl}} | Site base URL |
| {{siteName}} | Site name |
| {{siteDescription}} | Site description |
| {{twitterUsername}} | Twitter handle |
| {{twitterCard}} | Twitter card type |
| {{ogImage}} | OG image path |
| {{ogType}} | OG content type |
| {{ogLocale}} | OG locale |

## Frame-specific Output Dirs

| SSG | outputDir |
|-----|-----------|
| Jekyll | `_site` |
| Hugo | `public` |
| Docusaurus | `build` |
| VitePress | `.vitepress/dist` |
| MkDocs | `site` |
| Gatsby | `public` |

## Base Path

If your site is hosted at a subpath (e.g., `/freestruct`), set `basePath` to strip it from canonical URLs:

```yaml
basePath: /freestruct  # Strip this prefix from URLs
```

This ensures canonical URLs point to the correct location (e.g., `/docs/foo` instead of `/freestruct/docs/foo`).

## Sitemap Generation

freestruct generates `sitemap.xml` automatically (enabled by default):

```yaml
generateSitemap: true  # default - generates sitemap.xml
generateSitemap: false # skip
```

The sitemap includes all HTML pages except 404.html. It uses your site's `url` from config.

## 404 Page Generation

freestruct generates `404.html` automatically (enabled by default):

```yaml
generate404: true  # default - generates 404.html
generate404: false # skip
```

The generated 404 page includes:
- `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">` (prevents indexing and caching)
- Cache headers: `Cache-Control`, `Pragma`, `Expires`
- Full SEO meta tags
- Simple "Go home" link

**Custom 404**: If a `404.html` already exists in your SSG's output directory, freestruct will use it instead of generating a default page. This lets you provide your own styled 404 while still getting SEO injection.

## Preserve Existing Meta Tags

For page-specific SEO, add a comment to your page content:

```html
<!-- freestruct: {"title": "My Page", "ogType": "article", "ogImage": "/images/post.jpg"} -->
```

Available per-page options:
- `title`, `description`
- `ogType` (article, book, profile)
- `ogImage`
- `twitterCard` (summary_large_image)
- `publishedTime`, `author`, `section`

## Source Attribution

Injected HTML includes a source comment:

```html
<!-- injected by freestruct: https://github.com/dhaupin/freestruct -->
```

## Environment Overrides

You can override config values via environment variables:

```bash
FREESTRUCT_URL=https://staging.example.com node docs/lib/inject.js
```
