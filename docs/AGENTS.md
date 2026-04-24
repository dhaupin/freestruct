# AGENTS.md

Engineering decisions and technical details for freestruct docs.

## Search Implementation

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
var pagefindPath = '/freestruct/pagefind/pagefind.js';

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
- Path must include baseurl: `/freestruct/pagefind/pagefind.js`
- Module script can't load from CDN (CORS)
- Search only works after JS hydrates (client-side only)

---

## Theme Structure

- `_includes/` - Partial templates (header, footer)
- `_layouts/` - Page templates (default, home, page)
- `assets/scss/` - Styles

No `_theme/` folder - not needed for this simple theme.

---

## Build

GitHub Actions builds with Jekyll:
- Runs on push to main
- Outputs to `docs/_site/`
- PageFind indexes the built HTML
- Deployed to GitHub Pages at `https://dhaupin.github.io/freestruct/`