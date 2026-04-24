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

## Template Customization

The `inject-brand.html` template controls what gets injected. Edit it to add/remove meta tags:

```html
<!-- inject-brand.html -->
<meta property="og:title" content="{{pageTitle}}">
<meta property="og:description" content="{{pageDescription}}">
<!-- Add your custom tags here -->
```

Available placeholders:
- `{{pageTitle}}` - Page title (from HTML or config)
- `{{pageDescription}}` - Page description
- `{{pageUrl}}` - Full page URL
- `{{canonicalUrl}}` - Canonical URL
- `{{siteUrl}}` - Site base URL
- `{{siteName}}` - Site name
- `{{siteDescription}}` - Site description
- `{{twitterUsername}}` - Twitter handle
- `{{twitterCard}}` - Twitter card type
- `{{ogImage}}` - OG image path
- `{{ogType}}` - OG content type
- `{{ogLocale}}` - OG locale

## Frame-specific Output Dirs

| SSG | outputDir |
|-----|-----------|
| Jekyll | `_site` |
| Hugo | `public` |
| Docusaurus | `build` |
| VitePress | `.vitepress/dist` |
| MkDocs | `site` |
| Gatsby | `public` |

## Preserving Existing Meta Tags

By default, freestruct removes existing SEO meta tags before injecting to avoid conflicts. To preserve existing tags:

```yaml
preserveExistingMeta: true
```

When true, freestruct will inject new SEO tags alongside any existing ones.

## Per-Page Config

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

## Environment Overrides

You can override config values via environment variables:

```bash
FREESTRUCT_URL=https://staging.example.com node docs/lib/inject.js
```
