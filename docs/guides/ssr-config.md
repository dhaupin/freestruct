---
title: ssr-config.yml Reference
description: Complete reference for ssr-config.yml options
---

## Overview

`ssr-config.yml` is the central configuration file for freestruct. It defines your site's SEO settings that get injected into every page.

## Example

```yaml
outputDir: _site

site:
  url: https://example.com
  name: My Docs
  description: Documentation for my project

author:
  name: Jane Developer
  url: https://github.com/janedev

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

### generate404

Generate `404.html` automatically (default: true). If a custom `404.html` already exists in the output directory, freestruct will use it instead of generating one.

```yaml
generate404: true   # generates 404.html (or uses custom)
generate404: false  # skip 404 page generation
```

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

Author information for schema.org.

| Key | Required | Description |
|-----|----------|-------------|
| `name` | No | Author name |
| `url` | No | Author URL (GitHub, personal site, etc.) |

## Meta Options

### twitter

Twitter Card meta tags.

| Key | Required | Description |
|-----|----------|-------------|
| `username` | Yes | Twitter handle (include @) |
| `card` | No | Card type: `summary`, `summary_large_image`, `app`, `player` |

### og

Open Graph meta tags.

| Key | Required | Description |
|-----|----------|-------------|
| `image` | No | OG image path (absolute or relative to site url) |
| `locale` | No | Locale (default: `en_US`) |
| `type` | No | Content type: `website`, `article`, `book`, `profile` |

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
| `{{ogType}}` | OG content type |
| `{{ogLocale}}` | OG locale |

## Per-Page Options

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

## Related

- [Getting Started](/getting-started)
- [Configuration](/configuration)
