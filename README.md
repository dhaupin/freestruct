# freestruct

**SEO layer for static doc sites.**

Build your docs with any static site generator. Freestruct adds the SEO layer.

---

## Problem

Markdown doc sites (Jekyll, Hugo, Docusaurus, MkDocs) require the same SEO work every time:

- Client-side search setup
- Meta tags and Open Graph
- Sitemap and canonical URLs
- Structured data
- CI/CD wiring

Every project reinvents the wheel.

---

## Solution

One tool that wraps the SEO pain points:

```bash
npm install freestruct
freestruct build
```

---

## Features

### Search
- Pagefind (or Algolia/DocSearch) baked in
- Automatic indexing post-build
- Keyboard shortcut (⌘K)
- baseurl handling

### Meta
- Title, description, canonical per page
- Open Graph tags
- Twitter cards
- JSON-LD structured data

### Sitemap
- Auto-generated sitemap.xml
- robots.txt with defaults
- 404 noindex handling

### Generators

Adapter pattern for any SSG:

- Jekyll
- Hugo
- Docusaurus
- MkDocs
- VitePress

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
  search: { provider: 'pagefind' },
  meta: {
    twitter: '@handle',
    ogImage: '/og-default.png'
  }
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

## Status

Early concept. See [CONTRIBUTING](CONTRIBUTING.md) to shape the direction.

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages