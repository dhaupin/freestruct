# AGENTS.md

Engineering decisions and technical details for freestruct docs and the freestruct tool itself.

---

## Project Overview

**freestruct** is a framework-agnostic SEO layer for static doc sites. It runs post-build as a Node.js script that reads SSG output and injects SEO meta tags, Open Graph, Twitter Cards, JSON-LD, cache-busting hashes, and generates sitemaps.

### Key Files

| File | Purpose |
|------|---------|
| `docs/lib/inject.js` | Core SEO injection script (Node.js, ~200 lines) |
| `docs/ssr-config.yml` | Configuration for site metadata, CDN hooks, etc. |
| `docs/_includes/inject-brand.html` | HTML template with `{{placeholder}}` tokens |
| `package.json` | npm dependencies (`js-yaml` only) |

### Architecture

```
SSG Build (Jekyll/Hugo/Docusaurus)
         ↓
   docs/_site/ (output)
         ↓
   node docs/lib/inject.js
         ↓
   Reads ssr-config.yml
   Reads inject-brand.html template
   Injects into every .html file:
   - Meta tags (title, description, canonical)
   - Open Graph tags
   - Twitter Cards
   - JSON-LD structured data
   - Cache-busting hash (?v=abc123)
         ↓
   Generates sitemap.xml, 404.html
   Runs CDN purge hooks (optional)
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

## SSG Compatibility

| SSG | outputDir | Notes |
|-----|-----------|-------|
| Jekyll | `_site` | Default for this repo |
| Hugo | `public` | |
| Docusaurus | `build` | |
| VitePress | `.vitepress/dist` | |
| MkDocs | `site` | |

Just point `outputDir` to your SSG's output folder.

---

## Theme Structure (Jekyll)

- `_includes/` - Partial templates (header, footer, inject-brand.html)
- `_layouts/` - Page templates (default, home, page)
- `assets/scss/` - Styles

No `_theme/` folder - not needed for this simple theme.

---

## Build & Deployment

### Local Build

```bash
npm install
jekyll build
npm run inject  # or: node docs/lib/inject.js
```

### GitHub Actions

Runs on push to main:
1. `jekyll build`
2. PageFind indexes built HTML
3. Outputs to `docs/_site/`
4. Deployed to http://freestruct.creadev.org/

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Jekyll build + inject SEO |
| `npm run inject` | Run inject.js only |
| `jekyll serve` | Local dev server |

---

## Development Notes

### Adding a new SEO feature

1. Add placeholders to `inject-brand.html`
2. Handle replacement in `inject.js::injectFile()`
3. Document in `docs/guides/ssr-config.md`

### Testing locally

1. Make changes to source files
2. Run `jekyll build && npm run inject`
3. Check generated files in `docs/_site/`

### Important quirks

- 404.html files are skipped (no canonical injection)
- JSON-LD in inject-brand.html is static (not per-page)
- Purge hooks are commented out in inject.js (safety) - uncomment to enable
- preserveExistingMeta default: true (only adds missing tags)

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages (sister project)
- [PageFind](https://pagefind.app/) - Static search used by freestruct