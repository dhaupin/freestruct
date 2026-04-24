---
layout: home
title: freestruct
description: SEO layer for static doc sites
---

Build your docs with any static site generator. freestruct adds the SEO layer.

## Features

- **Search** - Pagefind baked in, works out of the box
- **SEO** - Open Graph, Twitter cards, JSON-LD schema
- **Sitemap** - Auto-generated sitemap.xml + robots.txt
- **Fast** - Minimal dependencies, Pagespeed optimized

## Quick Start

```bash
npm install freestruct
```

```yaml
# _config.yml
search:
  provider: pagefind
```

```json
// package.json
{
  "scripts": {
    "build": "jekyll build && freestruct build"
  }
}
```

## Supported Generators

- Jekyll
- Hugo
- Docusaurus
- MkDocs
- VitePress