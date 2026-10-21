// freestruct lib/urls.js - URL construction, basePath semantics (Phase 2)
// FIX (freestruct issue #3, crashtest-class): 0.4.x stripped basePath from the
// relative path and concatenated whatever site.url said, silently mapping
// sub-path installs onto the wrong URLs (404s). The contract now:
//   canonical = site.url + basePath + relSlug
//   - basePath unset: canonical = site.url + relSlug (output tree root == site.url)
//   - basePath set: it is the URL path prefix the output tree is served under.
//     If the tree ALSO nests that directory, the nested pages win (no doubling).

export function canonicalBase(config) {
  return config.site.url.replace(/\/$/, '');
}

// lead-slash only: directory slugs keep their trailing '/' (it is canonical)
const _norm = s => '/' + String(s).replace(/^\/+/, '');

export function pageUrlFor(config, slug) {
  const base = canonicalBase(config);
  const basePath = config.basePath ? _norm(config.basePath) : '';
  const slugPath = _norm(slug);

  // rel path already carries the deploy directory (e.g. tree nests docs/) -
  // trust the tree, never double the prefix
  if (basePath && (slugPath + '/').startsWith(basePath + '/')) {
    return base + slugPath;
  }
  return base + basePath + slugPath;
}
