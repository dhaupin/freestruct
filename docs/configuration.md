---
title: Configuration
description: Configure Freestruct for your doc site
nav_order: 2
---

## Configure

See the [Freestruct.config.yml Reference](/guides/freestruct-config) for complete options. Newer surface it covers: `hooks.postBuild` (general post-build commands behind the `runHooks` gate), `indexNow` (key emission + the `freestruct indexnow` post-deploy submission), `ogImageGeneration` (per-page branded OG images), and the slug-glob scoped maps (`jsonLd: {"/blog/**": [...], ...}` plus `og.scoped` image variants).

## Quick Example

```yaml
outputDir: _site

site:
  url: https://example.com
  name: My Docs
  description: Documentation for my project

twitter:
  username: "@handle"
  card: summary

og:
  image: /assets/og-image.png
```

## Supported SSGs

| SSG | outputDir |
|-----|-----------|
| Jekyll | `_site` |
| Hugo | `public` |
| Docusaurus | `build` |
| VitePress | `.vitepress/dist` |
| MkDocs | `site` |

## Related

- [Getting Started](/getting-started) - Install and set up Freestruct
- [Freestruct.config.yml Reference](/guides/freestruct-config) - All available options
