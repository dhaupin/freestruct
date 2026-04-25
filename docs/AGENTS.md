# AGENTS.md

Engineering decisions and technical details for freestruct docs and the freestruct tool itself.

---

## Project Overview

**freestruct** is a framework-agnostic, post-build SEO layer for static doc sites. It runs *after* any SSG completes - no plugins, no dependencies on the SSG itself. It only reads the output HTML and injects SEO.

### Core Philosophy

- **No SSG dependencies** - Works with ANY static site generator
- **No plugins** - Pure post-build layer, doesn't touch your SSG
- **Zero runtime deps** - Can run with just Node.js built-ins (optional js-yaml for config)
- **One command** - `node docs/lib/inject.js` after your SSG builds

### Key Files

| File | Purpose |
|------|---------|
| `docs/lib/inject.js` | Core SEO injection script (2311 lines, 181 functions, pure Node.js) |
| `docs/ssr-config.yml` | Configuration for site metadata, CDN hooks, cache busting |
| `docs/_includes/inject-brand.html` | HTML template with `{{placeholder}}` tokens |

### Architecture

```
Your SSG Build (ANY - Jekyll/Hugo/Docusaurus/VitePress/MkDocs)
         ↓
   [SSG output folder - _site/public/build/site]
         ↓
   node docs/lib/inject.js [output-folder]
         ↓
   freestruct reads:
   - ssr-config.yml (your site config)
   - inject-brand.html (SEO template)
         ↓
   freestruct outputs (same folder):
   - Modified .html files with SEO injected
   - sitemap.xml, sitemap-priorities.xml
   - robots.txt
   - feed.xml (RSS)
   - 404.html
   - search.json (client-side search)
   - apis.json, rag-chunks.json, examples.json
   - toc.json, sidebar.json, breadcrumbs.json
   - seo-score.json, meta-summary.json
   - 45 total output files
   - 88 output files (v0.3.2)
         ↓
   CDN Purge Hooks (optional)
```

---

## SEO Injection System

### How inject.js Works

1. **Load config**: Reads `ssr-config.yml` via js-yaml
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

CDNs see different HTML → must re-fetch → fresh content.

### Hash Generation

```javascript
const buildHash = crypto.createHash('sha1')
  .update(JSON.stringify(config || {}) + String(Date.now()))
  .digest('hex').slice(0, 8);
```

Timestamp in milliseconds makes collisions practically impossible.

### CDN Purge Hooks

Configured in `ssr-config.yml`:

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
- PageFind compiled at build time → outputs to `docs/pagefind/`
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

freestruct works with ANY static site generator. Just point it at the output folder.

| SSG | Output Folder | Command |
|-----|--------------|---------|
| Jekyll | `_site` | `jekyll build && node docs/lib/inject.js docs/_site` |
| Hugo | `public` | `hugo && node docs/lib/inject.js public` |
| Docusaurus | `build` | `docusaurus build && node docs/lib/inject.js build` |
| VitePress | `.vitepress/dist` | `vitepress build && node docs/lib/inject.js .vitepress/dist` |
| MkDocs | `site` | `mkdocs build && node docs/lib/inject.js site` |
| Astro | `dist` | `astro build && node docs/lib/inject.js dist` |
| Eleventy | `_site` | `eleventy && node docs/lib/inject.js _site` |
| Any other | *any folder* | `node docs/lib/inject.js [your-output-folder]` |

Just set `outputDir` in `ssr-config.yml` or pass as argument.

---

## Theme Structure (Jekyll)

- `_includes/` - Partial templates (header, footer, inject-brand.html)
- `_layouts/` - Page templates (default, home, page)
- `assets/scss/` - Styles

No `_theme/` folder - not needed for this simple theme.

---

## Build & Deployment

### How to Use

freestruct is a *layer* - it runs AFTER your SSG builds.

```bash
# 1. Build your site with your SSG
YOUR_SSG_BUILD

# 2. Run freestruct on the output
node docs/lib/inject.js [output-folder]

# Example with Jekyll:
jekyll build && node docs/lib/inject.js docs/_site

# Example with Hugo:
hugo && node docs/lib/inject.js public

# Example with Docusaurus:
docusaurus build && node docs/lib/inject.js build
```

### GitHub Actions

```yaml
- name: Build with your SSG
  run: jekyll build  # or hugo, docusaurus build, etc.

- name: Inject SEO
  run: node docs/lib/inject.js docs/_site
```

### Configuration

```bash
# Optional: Pass output folder as argument
node docs/lib/inject.js /path/to/output
```

Default output folder: `docs/_site`

---

## Commands

freestruct is a layer - use your SSG's commands, then run inject.js:

```bash
# Build your site, then inject
jekyll build && node docs/lib/inject.js docs/_site

# Or inject only (your site is already built)
node docs/lib/inject.js
```

---

## Template Files

freestruct templates live in `docs/_freestruct/` (not `_includes/` which collides with Jekyll):

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
3. Document in `docs/guides/ssr-config.md`

### Testing locally

1. Build your site with your SSG
2. Run `node docs/lib/inject.js [output-folder]`
3. Check the output HTML files

### Important quirks

- 404.html files are skipped (no canonical injection)
- JSON-LD in inject-brand.html is static (not per-page)
- Purge hooks are commented out in inject.js (safety) - uncomment to enable
- preserveExistingMeta default: true (only adds missing tags)

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages (sister project)
- [PageFind](https://pagefind.app/) - Static search used by freestruct