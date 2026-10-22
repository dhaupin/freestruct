---
title: Engineering Decisions
description: Technical details for Freestruct
nav_order: 14
permalink: /engineering-decisions
---

# AGENTS.md

Engineering decisions and technical details for Freestruct docs and the Freestruct tool itself.

---

## Project Overview

**Freestruct** is a framework-agnostic, post-build SEO layer for static doc sites. It runs *after* any SSG completes - no plugins, no dependencies on the SSG itself. It only reads the output HTML and injects SEO.

### Core Philosophy

- **No SSG dependencies** - Works with ANY static site generator
- **No plugins** - Pure post-build layer, doesn't touch your SSG
- **Zero runtime deps** - Can run with just Node.js built-ins (optional js-yaml for config)
- **One command** - `node bin/freestruct.mjs` after your SSG builds

### Key Files

| File | Purpose |
|------|---------|
| `engine/inject.js` | Engine entry + CLI orchestrator (vanilla Node.js ESM) |
| `docs/freestruct.config.yml` | Configuration for site metadata, CDN hooks, cache busting (legacy name `ssr-config.yml` still read) |
| `docs/_includes/inject-brand.html` | HTML template with `{{placeholder}}` tokens |

### Architecture

```text
Your SSG Build (ANY - Jekyll/Hugo/Docusaurus/VitePress/MkDocs)
         v
   [SSG output folder - _site/public/build/site]
         v
   node bin/freestruct.mjs [output-folder]
         v
   freestruct reads:
   - freestruct.config.yml (your site config)
   - inject-brand.html (SEO template)
         v
   freestruct outputs (same folder):
   - Modified .html files with SEO injected
   - sitemap.xml (auto-generated)
   - 404.html (with SEO)
         v
   CDN Purge Hooks (optional)
```

---

## SEO Injection System

### How inject.js Works

1. **Load config**: Reads `freestruct.config.yml` via js-yaml
2. **Generate hash**: SHA1 of config + timestamp (8 chars)
3. **Find HTML files**: Recursive scan of outputDir
4. **Per-file injection**:
   - Extract title/description from existing HTML
   - Build canonical URL with `?v={hash}`
   - Replace template placeholders
   - Insert before `</head>`
5. **Generate sitemap.xml** and **404.html**
6. **Run purge hooks** (if configured)

### Template Placeholders

| Placeholder | Source |
|-------------|--------|
| `{{pageTitle}}` | Extracted from `<title>` or config.site.name |
| `{{pageDescription}}` | Extracted from `<meta description>` or config |
| `{{pageUrl}}` | Computed from file path |
| `{{canonicalUrl}}` | site.url + pageUrl + ?v=hash |
| `{{siteUrl}}` | config.site.url |
| `{{siteName}}` | config.site.name |
| `{{siteDescription}}` | config.site.description |
| `{{twitterUsername}}` | config.twitter.username |
| `{{twitterCard}}` | config.twitter.card |
| `{{ogImage}}` | config.og.image |
| `{{ogType}}` | config.og.type |
| `{{ogLocale}}` | config.og.locale |

---

## Cache Busting System

### Mechanism

Two layers ensure content freshness:

1. **`<meta name="freestruct-build" content="{hash}">`** - Debug tag in HTML head
2. **Canonical URL with query param** - `<link rel="canonical" href="...?v={hash}">`

CDNs see different HTML -> must re-fetch -> fresh content.

### Hash Generation

```javascript
const buildHash = crypto.createHash('sha1')
  .update(JSON.stringify(config || {}) + String(Date.now()))
  .digest('hex').slice(0, 8);
```

Timestamp in milliseconds makes collisions practically impossible.

### CDN Purge Hooks

Configured in `freestruct.config.yml`:

```yaml
cacheBusting:
  purge:
    - name: cloudflare
      command: >
        curl -X DELETE "https://api.cloudflare.com/..." \
        -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
        -d '{"files":["$SITE_URL/*"]}'
```

Available variables: `$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR`

---

## Search Implementation (PageFind)

### How it works
- PageFind compiled at build time -> outputs to `docs/pagefind/`
- Runtime: ES module dynamic import + `await pagefind.init()`
- Custom modal UI (not PageFindUI widget)

### Key files
- `docs/_includes/header.html` - Contains search modal and JS
- `docs/_config.yml` - `search.provider: pagefind`

### Pattern used (copied from prestruct)
```js
// Module script
var pagefind = null;
var pagefindPath = '/pagefind/pagefind.js';

async function initPagefind() {
  if (pagefind) return pagefind;
  pagefind = await import(pagefindPath);
  await pagefind.init();
  return pagefind;
}

window.doSearch = async function(q, resultsEl) {
  var pf = await initPagefind();
  var resp = await pf.search(q);
  // render results...
};
```

### Why this pattern
- PageFind needs WASM initialization (`await pagefind.init()`)
- Can't use `importmap` - doesn't handle WASM modules
- Dynamic `import()` loads pagefind + initializes in one step
- Modal is custom HTML in header.html (not automatic PageFindUI)

### Gotchas
- Path must include baseurl: `/pagefind/pagefind.js`
- Module script can't load from CDN (CORS)
- Search only works after JS hydrates (client-side only)

---

## Supported SSGs

Freestruct works with ANY static site generator. Just point it at the output folder.

| SSG | Output Folder | Command |
|-----|--------------|---------|
| Jekyll | `_site` | `jekyll build && node bin/freestruct.mjs docs/_site` |
| Hugo | `public` | `hugo && node bin/freestruct.mjs public` |
| Docusaurus | `build` | `docusaurus build && node bin/freestruct.mjs build` |
| VitePress | `.vitepress/dist` | `vitepress build && node bin/freestruct.mjs .vitepress/dist` |
| MkDocs | `site` | `mkdocs build && node bin/freestruct.mjs site` |
| Astro | `dist` | `astro build && node bin/freestruct.mjs dist` |
| Eleventy | `_site` | `eleventy && node bin/freestruct.mjs _site` |
| Any other | *any folder* | `node bin/freestruct.mjs [your-output-folder]` |

Just set `outputDir` in `freestruct.config.yml` or pass as argument.

---

## Theme Structure (Jekyll)

- `_includes/` - Partial templates (header, footer, inject-brand.html)
- `_layouts/` - Page templates (default, home, page)
- `assets/scss/` - Styles

No `_theme/` folder - not needed for this simple theme.

---

## Build & Deployment

### How to Use

Freestruct is a *layer* - it runs AFTER your SSG builds.

```bash
# 1. Build your site with your SSG
YOUR_SSG_BUILD

# 2. Run freestruct on the output
node bin/freestruct.mjs [output-folder]

# Example with Jekyll:
jekyll build && node bin/freestruct.mjs docs/_site

# Example with Hugo:
hugo && node bin/freestruct.mjs public

# Example with Docusaurus:
docusaurus build && node bin/freestruct.mjs build
```

### GitHub Actions

```yaml
- name: Build with your SSG
  run: jekyll build  # or hugo, docusaurus build, etc.

- name: Inject SEO
  run: node bin/freestruct.mjs docs/_site
```

### Configuration

```bash
# Optional: Pass output folder as argument
node bin/freestruct.mjs /path/to/output
```

Default output folder: `docs/_site`

---

## Commands

Freestruct is a layer - use your SSG's commands, then run inject.js:

```bash
# Build your site, then inject
jekyll build && node bin/freestruct.mjs docs/_site

# Or inject only (your site is already built)
node bin/freestruct.mjs
```

---

## Template Files

Freestruct templates live in `engine/_freestruct/` (canonical, packaged; `docs/_freestruct/` and `init/docs/_freestruct/` hold synced copies):

| File | Purpose |
|------|---------|
| `inject-brand.html` | SEO meta tags (auto-loaded) |
| `inject-header.html` | Before `</head>` (optional) |
| `inject-body-start.html` | After `<body>` (optional) |
| `inject-footer.html` | Before `</body>` (optional) |

Create or edit these files to add custom code. Files auto-load if they exist.

---

## Development Notes

### Adding a new SEO feature

1. Add placeholders to `inject-brand.html`
2. Handle replacement in `inject.js::injectFile()`
3. Document in `docs/guides/freestruct-config.md` (the Freestruct.config.yml Reference page)

### Testing locally

1. Build your site with your SSG
2. Run `node bin/freestruct.mjs [output-folder]`
3. Check the output HTML files

### Important quirks

- 404.html files get the full pipeline now (canonical included), with an explicit `robots noindex` meta (issue #11 fix); generated AND custom 404s get the same treatment
- JSON-LD in inject-brand.html is static (not per-page)
- Purge hooks are REAL and wired (`engine/hooks.js`), but gated: they only execute when `runHooks: true` is set in config; configured-but-unenabled hooks just log the skipped command (battery-pinned both ways)
- `preserveExistingMeta` is a RETIRED config key (missing-only injection is unconditional now); configuring it produces a named warning
- Missing-only injection: existing tags are never overwritten

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages (sister project)
- [PageFind](https://pagefind.app/) - Static search used by Freestruct