---
title: Configuration
description: Configure freestruct for your doc site
---

## Configure

See the [ssr-config.yml Reference](/guides/ssr-config) for complete options.

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

- [Getting Started](/getting-started) - Install and set up freestruct
- [ssr-config.yml Reference](/guides/ssr-config) - All available options
