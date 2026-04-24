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

## Options

### outputDir

The output directory from your SSG build.

```yaml
outputDir: _site  # Jekyll
outputDir: public   # Hugo, Gatsby
outputDir: build   # Docusaurus
```

### generateSitemap

Generate `sitemap.xml` automatically (default: true).

```yaml
generateSitemap: true   # generates sitemap.xml
generateSitemap: false  # skip sitemap generation
```

### generate404

Generate `404.html` automatically (default: true).

```yaml
generate404: true   # generates 404.html
generate404: false  # skip 404 page generation
```

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

## Related

- [Getting Started](/getting-started)
- [Configuration](/configuration)
