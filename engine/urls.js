// engine/urls.js - URL construction, basePath semantics (Phase 2)
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

// ---------- slug/glob matching (issues #25 + follow-on) ----------
// The scoping contracts (jsonLd map keys, og.scoped keys) key on page slugs,
// NOT raw urls - the engine keys pages by slug and never knows a deploy host.
//   '/'        exact root
//   '/faq'     exact page (trailing slashes normalized away)
//   '/blog/*'  exactly one segment under /blog
//   '/blog/**' /blog itself AND anything below it ('**' at the end only)
// Specificity ranks exact > literal-heavy glob > '**'; callers use it to
// pick the winning pattern when one value is decided (images).

function _forMatch(s) {
  return _norm(s).replace(/\/+$/, '') || '/';
}

export function slugMatchesGlob(pattern, slug) {
  const p = _forMatch(pattern);
  const s = _forMatch(slug);
  // '**' (with or without the root slash) means everything
  if (p === '**' || p === '/**') return true;
  if (!p.includes('*')) return p === s;
  // trailing '**' covers the stem directory itself AND everything below
  if (p.endsWith('/**')) {
    const stem = _forMatch(p.replace(/\/\*\*$/, ''));
    return s === stem || s.startsWith(stem + '/');
  }
  // single '*' (and mid-pattern '**' degrading the same way): one segment
  const re = new RegExp('^' + p
    .split('*').map((seg) => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+') + '$');
  return re.test(s);
}

// Higher number wins: exact match outranks every glob; between globs the
// one carrying more literal path characters is the more specific contract.
export function globSpecificity(pattern) {
  const p = _forMatch(pattern);
  if (!p.includes('*')) return 100000 + p.length;
  return p.replace(/\*+/g, '').length;
}
