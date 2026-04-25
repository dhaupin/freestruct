# freestruct

**Post-build SEO layer for static doc sites.**

Build your docs with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress. Run freestruct after build for full SEO coverage.

---

## Problem

Static doc sites require the same SEO work every time:

- Meta tags and Open Graph
- Sitemap and canonical URLs
- Cache busting
- Search indexing
- CI/CD wiring

Every project reinvents the wheel.

---

## Solution

One tool that wraps the SEO pain points:

```bash
npm install freestruct
npx freestruct
```

No template changes needed. Works with any SSG.

---

## Features

### SEO
- Title, description, canonical per page
- Open Graph tags
- Twitter cards
- JSON-LD structured data

### Search
- Generates `search.json` post-build
- Works with any client-side search
- No external dependencies

### Sitemap
- Auto-generated `sitemap.xml`
- Auto-generated `robots.txt`
- Auto-generated `feed.xml` (RSS)

### Performance
- Cache-busting hash per build
- Lazy loading on images
- Reading time injection

### DX
- Auto 404 page with search
- Link validation
- Custom injection hooks

---

## Quick Start

```bash
npm install freestruct
```

```yaml
# docs/ssr-config.yml
site:
  name: My Docs
  url: https://example.com/docs
  description: My documentation

twitter:
  username: "@handle"

og:
  image: /og-default.png
```

```bash
# Run after your SSG builds
npx freestruct
```

```json
// package.json
{
  "scripts": {
    "build": "jekyll build && freestruct"
  }
}
```

---

## Configuration

All features are on by default. Disable in `docs/ssr-config.yml`:

```yaml
generateSitemap: false    # skip sitemap
generateFeed: false      # skip RSS
generate404: false     # skip 404 page
generateRobots: false  # skip robots.txt
readingTime: false     # skip read time
lastModified: false   # skip timestamp
lazyLoad: false       # skip lazy loading
linkCheck: false      # skip link check
searchIndex: false    # skip search index
```

---

## Security

Purge hooks run commands via `execSync`. Only use trusted commands. See docs/guides/cache-busting.md.

---

## v0.3.1

**1545 lines, 58 functions, 45 outputs, 0 deps**

See CHANGELOG.md for full history.

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages