# freestruct

**SEO layer for static doc sites.**

Build your docs with any static site generator. Freestruct adds the SEO layer.

---

## Quick Start

```bash
npm install freestruct
```

```yaml
# freestruct.config.js
export default {
  siteUrl: 'https://example.com/docs',
  generator: 'jekyll',
  search: { provider: 'pagefind' }
}
```

```json
// package.json
{
  "scripts": {
    "build": "jekyll build && freestruct build"
  }
}
```

---

## Features

- **Search** - Pagefind or Algolia baked in
- **Meta** - Open Graph, Twitter cards, JSON-LD
- **Sitemap** - Auto-generated sitemap.xml + robots.txt

---

## Supported Generators

Jekyll, Hugo, Docusaurus, MkDocs, VitePress

---

## Status

Early concept. See [CONTRIBUTING](https://github.com/dhaupin/freestruct/blob/main/CONTRIBUTING.md) to shape the direction.