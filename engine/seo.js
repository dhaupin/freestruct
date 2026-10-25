// engine/seo.js - meta/OG/Twitter/JSON-LD injection + late passes (Phase 1.1)
// Same observable behavior as 0.4.x with one deliberate fix:
//  - the template's plain <meta name="description"> is now actually injected
//    for pages without one (it was silently dropped in 0.4.x).
// Late passes (reading-time / last-modified / lazy-load) are exported here and
// fed by the orchestrator, 404 pages included (PRD 1.4 consistency).

import fs from 'fs';
import path from 'path';
import { hasSeoType } from './scan.js';
import { pageUrlFor, slugMatchesGlob, globSpecificity } from './urls.js';

function minifyHtml(html) {
  // Conservative HTML minifier - removes unnecessary whitespace
  // Preserves content inside <pre>, <textarea>, <script>, <style> tags
  let inBlock = false;
  let result = '';
  let i = 0;
  while (i < html.length) {
    if (html.slice(i, i + 5) === '<pre>') inBlock = true;
    else if (html.slice(i, i + 10) === '<textarea') inBlock = true;
    else if (html.slice(i, i + 8) === '<script>') inBlock = true;
    else if (html.slice(i, i + 7) === '<style>') inBlock = true;
    else if (html.slice(i, i + 6) === '</pre>') inBlock = false;
    else if (html.slice(i, i + 11) === '</textarea>') inBlock = false;
    else if (html.slice(i, i + 9) === '</script>') inBlock = false;
    else if (html.slice(i, i + 8) === '</style>') inBlock = false;

    if (inBlock) result += html[i];
    else if (html[i] === '\n' || html[i] === '\r' || html[i] === '\t') { /* skip */ }
    else result += html[i];
    i++;
  }
  return result
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- injection value escaping ----------

// HTML-attribute escaping for config/page values that land inside
// content="..." or href="...": a raw " in a site description silently
// truncates every generated tag (ported from prestruct's escapeHtmlAttr).
// '&' is deliberately NOT escaped: the battery pins the raw ampersand in
// canonical attributes as valid HTML, and escaping it would double-encode
// legit URLs that already contain &amp; from the SSG.
function escAttr(value) {
  return String(value == null ? '' : value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON-safe embedding for values that go INSIDE the generated JSON-LD
// literals (the attribute escaper would put &quot; into invalid JSON).
// Backslash-escape JSON special characters via JSON.stringify semantics,
// then render '<' as \u003c so a value can never close the script tag early.
function escJson(value) {
  return JSON.stringify(String(value == null ? '' : value)).slice(1, -1).replace(/</g, '\\u003c');
}

// ---------- per-page overrides ----------

// Per-page override contract (ssr-config.md "Per-Page Options"): an HTML
// comment in the built page tunes freestruct's own injected tags:
//   <!-- freestruct: {"title": "My Page", "ogType": "article"} -->
// Missing-only still wins: a page that already ships its own og/twitter
// keeps them, and override attempts on that group warn loudly instead of
// silently doing nothing.
const PERPAGE_KEYS = Object.freeze([
  'title', 'description', 'ogType', 'ogImage', 'twitterCard',
  'publishedTime', 'author', 'section',
]);

function pageWarn(page, message) {
  console.log('[freestruct] page warning: ' + page.rel + ': ' + message);
}

function readPageOverrides(html, page) {
  const comment = /<!--\s*freestruct:([\s\S]*?)-->/.exec(html);
  if (!comment) return null;
  const body = comment[1].slice(comment[1].indexOf('{'), comment[1].lastIndexOf('}') + 1);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    pageWarn(page, 'malformed JSON in the freestruct per-page comment (' + e.message + '); ignoring it');
    return null;
  }
  if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
    pageWarn(page, 'freestruct per-page comment must be a flat {...} object; ignoring it');
    return null;
  }
  const unknown = Object.keys(parsed).filter(k => !PERPAGE_KEYS.includes(k));
  if (unknown.length > 0) {
    pageWarn(page, 'unknown per-page key(s) "' + unknown.join('", "') + '" ignored (known: ' + PERPAGE_KEYS.join(', ') + ')');
  }
  return parsed;
}

/**
 * Inject the SEO pipeline into one page (written to disk).
 * Missing-only semantics against the PRE-INJECTION snapshot (page.html):
 * pages that ship their own OG/Twitter/JSON-LD/canonical/description keep them.
 * Page-level freestruct comments refine the injected tags (see PERPAGE_KEYS).
 */
export function injectPage(page, { config, template, buildHash, snippetDir, injectWarnings, generatedImages }) {
  let html = page.html;
  const siteName = config.site.name;
  const siteUrl = config.site.url;
  const overrides = readPageOverrides(html, page);

  let pageTitle = (page.title || siteName) + ' | ' + siteName;
  let pageDescription = (page.description !== undefined && page.description !== null)
    ? page.description
    : config.site.description;
  let ogType = config.og?.type || 'website';
  let twitterCard = config.twitter?.card || 'summary';
  if (overrides) {
    if (overrides.title !== undefined && overrides.title !== '') pageTitle = String(overrides.title) + ' | ' + siteName;
    if (overrides.description !== undefined) pageDescription = String(overrides.description);
    if (overrides.ogType) ogType = String(overrides.ogType);
    if (overrides.twitterCard) twitterCard = String(overrides.twitterCard);
  }

  const canonicalUrl = pageUrlFor(config, page.slug)
    + (config.cacheBusting?.hashInCanonicalUrl === true ? '?v=' + buildHash : '');

  // og image (issue #20): config accepts the back-compat string form or the
  // structured { src, width, height, alt } object form (shared prestruct
  // shape so configs move between engines). Per-page overrides win over the
  // config either way; relative values join onto the site url, absolute
  // HTTP(S) values pass through as-is. No image anywhere: no og:image/
  // twitter:image ship at all (a bare image tag pointing at the site root is
  // a broken card).
  const ogImageCfg = config.og?.image;
  const ogImageObj = (ogImageCfg !== undefined && ogImageCfg !== null
    && typeof ogImageCfg === 'object' && !Array.isArray(ogImageCfg))
    ? ogImageCfg : null;
  const hasPerpageOgImage = overrides?.ogImage !== undefined && overrides.ogImage !== '';
  // Resolution order (issue #20 + #22): per-page override > per-page
  // GENERATED image (issue #22 deliverables, keyed by slug) > the config
  // (object or string form). Pages that ship their own og:image keep it
  // before any of this matters - missing-only.
  const generatedForPage = (generatedImages && generatedImages[page.slug]) || null;
  // og.scoped (issue #25 follow-on): image variants keyed by the same slug
  // globs as jsonLd; the MOST SPECIFIC matching pattern wins (exact > glob).
  // Per-page overrides and per-page generated images (#22) still rank ahead;
  // the global og.image is the deepest fallback.
  const ogScopedCfg = config.og?.scoped;
  let scopedForPage = null;
  if (ogScopedCfg && typeof ogScopedCfg === 'object' && !Array.isArray(ogScopedCfg)) {
    let bestScore = -1;
    for (const [pattern, variant] of Object.entries(ogScopedCfg)) {
      if (!slugMatchesGlob(pattern, page.slug)) continue;
      const score = globSpecificity(pattern);
      if (score > bestScore) { bestScore = score; scopedForPage = variant; }
    }
  }
  const scopedIsObject = scopedForPage !== null && typeof scopedForPage === 'object' && !Array.isArray(scopedForPage);
  const allowSvgAccept = scopedForPage === null
    ? (ogImageObj ? ogImageObj.allowSvg === true : false)
    : (scopedIsObject ? scopedForPage.allowSvg === true : false);
  const companionsSource = hasPerpageOgImage ? null
    : (generatedForPage || (scopedIsObject ? scopedForPage : null) || (!scopedForPage ? ogImageObj : null));
  const rawOgImage = hasPerpageOgImage
    ? String(overrides.ogImage)
    : (generatedForPage ? generatedForPage.src
      : (scopedForPage !== null
        ? (scopedIsObject ? String(scopedForPage.src || '') : String(scopedForPage))
        : (ogImageObj ? String(ogImageObj.src || '') : (ogImageCfg || ''))));
  const ogImageFull = rawOgImage && !/^(https?:)?\/\//i.test(rawOgImage)
    ? siteUrl + rawOgImage
    : rawOgImage;

  // issue #20, the SVG trap: an SVG og:image cannot be rendered by most
  // social scrapers and the share preview blanks. Loud warning always from
  // here (config value or per-page override); under --strict the orchestrator
  // graduates the collected offenses to build failures (same ladder as the
  // report classes), and allowSvg: true is the explicit way out.
  if (rawOgImage && /\.svg$/i.test(rawOgImage.split(/[?#]/)[0])
      && hasPerpageOgImage !== true && !allowSvgAccept) {
    // Loud in every run; under --strict the orchestrator also graduates the
    // collected offenses (injectWarnings) to build failures.
    pageWarn(page, 'og image "' + rawOgImage + '" is an SVG: most social scrapers cannot render it and the share preview blanks (ship a raster image, or set allowSvg: true in the og.image object to accept it)');
    injectWarnings.push('og image "' + rawOgImage + '" is an SVG: most social scrapers cannot render it and the share preview blanks (ship a raster image, or set allowSvg: true in the og.image object to accept it)');
  }

  // Add cache-busting query param to assets (css, js, images, fonts, ...)
  if (config.cacheBusting?.assetQueryParam !== false) {
    const assetExts = '.css.js.png.jpg.jpeg.gif.svg.webp.ico.woff.woff2.ttf.otf.wasm.json';
    html = html.replace(/(href|src)=\"([^\"]+)\"/gi,
      (match, attr, url) => {
        const cleanUrl = url.replace(/\?v=[^"]*/, '');
        const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.'));
        if (assetExts.includes(ext)) {
          return attr + '=\"' + cleanUrl + '?v=' + buildHash + '\"';
        }
        return match;
      });
  }

  const replacements = {
    '{{pageTitle}}': escAttr(pageTitle),
    '{{pageDescription}}': escAttr(pageDescription),
    '{{pageUrl}}': escAttr(canonicalUrl),
    '{{canonicalUrl}}': escAttr(canonicalUrl),
    '{{siteUrl}}': escAttr(siteUrl),
    '{{siteName}}': escAttr(siteName),
    '{{siteDescription}}': escAttr(config.site.description),
    '{{buildHash}}': buildHash,
    '{{twitterUsername}}': escAttr(config.twitter?.username || ''),
    '{{twitterCard}}': escAttr(twitterCard),
    '{{ogImage}}': escAttr(rawOgImage),
    '{{ogImageFull}}': escAttr(ogImageFull),
    '{{ogType}}': escAttr(ogType),
    '{{ogLocale}}': escAttr(config.og?.locale || 'en_US'),
    // JSON-LD internals: JSON-escaped, not attribute-escaped (see escJson)
    '{{siteNameJson}}': escJson(siteName),
    '{{siteUrlJson}}': escJson(siteUrl),
    '{{siteDescriptionJson}}': escJson(config.site.description),
    // Conditional schema.org founder for the Organization block (config.author);
    // expands to '' or a comma-led "founder": {...} fragment.
    '{{authorJson}}': escJson(config.author?.name)
      ? ',\n  "founder": { "@type": "Person", "name": "' + escJson(config.author.name) + '"'
        + (config.author.url ? ', "url": "' + escJson(config.author.url) + '"' : '') + ' }'
      : '',
  };

  // Custom JSON-LD hook (config.jsonLd, issue #25): three accepted shapes -
  //   single object, array of objects (legacy, every page), or the scoped
  //   map form keyed by page-slug globs ('/' exact, '/blog/*' one segment,
  //   '/guides/**' the tree). The scoped form lands per page: global first,
  //   then every matching scoped block in specificity order (exact >
  //   literal-heavy > '**'). missing-only is untouched: pages shipping
  //   their own JSON-LD get nothing here, scoped or not. All blocks ship
  //   through the same serialization ('<' neutralized) as the legacy form.
  let customJsonLd = '';
  if (config.jsonLd !== undefined) {
    const jc = config.jsonLd;
    const isScopedMap = !Array.isArray(jc) && jc && typeof jc === 'object'
      && Object.keys(jc).length > 0
      && Object.keys(jc).every((k) => /(^\/|^\*$|^\*\*$|\*)/.test(k));
    if (isScopedMap) {
      const keys = Object.keys(jc).sort((a, b) => globSpecificity(b) - globSpecificity(a));
      for (const key of keys) {
        if (!slugMatchesGlob(key, page.slug)) continue;
        const blocks = Array.isArray(jc[key]) ? jc[key] : [jc[key]];
        if (!blocks.length || blocks.some((b) => !b || typeof b !== 'object' || Array.isArray(b))) {
          console.log('[freestruct] config warning: jsonLd "' + key + '" must map to an LD+JSON object or a list of them; block skipped');
          continue;
        }
        for (const block of blocks) {
          const serialized = JSON.stringify(block).replace(/</g, '\\u003c');
          customJsonLd += '\n<script type="application/ld+json">\n' + serialized + '\n</script>\n';
        }
      }
    } else {
      const blocks = Array.isArray(jc) ? jc : [jc];
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
          console.log('[freestruct] config warning: jsonLd[' + i + '] is not an object; block skipped');
          continue;
        }
        const serialized = JSON.stringify(block).replace(/</g, '\\u003c');
        customJsonLd += '\n<script type="application/ld+json">\n' + serialized + '\n</script>\n';
      }
    }
  }

  let seo = template;
  for (const [k, v] of Object.entries(replacements)) seo = seo.split(k).join(v);
  if (customJsonLd) seo += customJsonLd;
  // image tags ship only when an og image exists (config-level or per-page)
  if (!ogImageFull) {
    seo = seo.replace(/^[^\n]*<meta (property="og:image"|name="twitter:image")[^\n]*>\n?/gim, '');
  }
  // Twitter identity tags ship only when a handle is configured: without this
  // filter the template's {{twitterUsername}} resolves to '' and every page
  // gets <meta name="twitter:site" content="">. No handle -> no tags; card
  // type and twitter:title still inject.
  if (!config.twitter?.username) {
    seo = seo.replace(/^[^\n]*<meta name="twitter:(site|creator)"[^\n]*>\n?/gim, '');
  }
  seo = seo.replace(/<!--[\s\S]*?-->/g, '');

  // Remove existing freestruct-build tag (always refresh)
  html = html.replace(/<meta[^>]*name="freestruct-build"[^>]*>/gi, '');

  // Only inject SEO if page doesn't have it from SSG/frontmatter
  const hasOg = hasSeoType(html, 'og');
  const hasTwitter = hasSeoType(html, 'twitter');
  const hasJsonLd = hasSeoType(html, 'jsonld');
  const hasCanonical = hasSeoType(html, 'canonical');

  let seoInjection = '';
  // FIX (was 0.4.x wart): plain description meta now really reaches bare pages
  if (!hasSeoType(html, 'description')) {
    const descMatch = seo.match(/<meta name="description"[^>]*>/i);
    if (descMatch) seoInjection += '\n' + descMatch[0];
  }
  if (!hasOg) {
    const ogMatch = seo.match(/<meta property="og:[^"]*"[^>]*>/gi);
    if (ogMatch) seoInjection += '\n' + ogMatch.join('\n');
    // issue #20: the structured og.image object form also emits its
    // companions; only when the shipped image IS the config object - a
    // per-page override ships its own image and replaces the set wholesale.
    if (ogImageFull && companionsSource && !hasPerpageOgImage) {
      const companions = [];
      if (companionsSource.width !== undefined && companionsSource.width !== '') companions.push('<meta property="og:image:width" content="' + escAttr(companionsSource.width) + '">');
      if (companionsSource.height !== undefined && companionsSource.height !== '') companions.push('<meta property="og:image:height" content="' + escAttr(companionsSource.height) + '">');
      if (companionsSource.alt !== undefined && companionsSource.alt !== '') companions.push('<meta property="og:image:alt" content="' + escAttr(companionsSource.alt) + '">');
      if (companions.length) seoInjection += '\n' + companions.join('\n');
    }
    // article:* companions for per-page article facts
    const articleTags = [];
    if (overrides?.publishedTime) articleTags.push('<meta property="article:published_time" content="' + escAttr(overrides.publishedTime) + '">');
    if (overrides?.author) articleTags.push('<meta property="article:author" content="' + escAttr(overrides.author) + '">');
    if (overrides?.section) articleTags.push('<meta property="article:section" content="' + escAttr(overrides.section) + '">');
    if (articleTags.length) seoInjection += '\n' + articleTags.join('\n');
  } else if (overrides && [overrides.ogType, overrides.ogImage, overrides.publishedTime, overrides.author, overrides.section].some(v => v !== undefined)) {
    pageWarn(page, 'page ships its own Open Graph tags; og/author per-page overrides were not applied');
  }
  if (!hasTwitter) {
    const twMatch = seo.match(/<meta name="twitter:[^"]*"[^>]*>/gi);
    if (twMatch) seoInjection += '\n' + twMatch.join('\n');
  } else if (overrides && overrides.twitterCard !== undefined) {
    pageWarn(page, 'page ships its own Twitter tags; the twitterCard override was not applied');
  }
  if (overrides && overrides.description !== undefined && hasSeoType(html, 'description')) {
    pageWarn(page, 'page has its own description meta; the description override was not applied');
  }
  if (!hasJsonLd) {
    const ldMatch = seo.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi);
    if (ldMatch) seoInjection += '\n' + ldMatch.join('\n');
  }
  if (!hasCanonical) {
    const canMatch = seo.match(/<link rel="canonical"[^>]*>/);
    if (canMatch) seoInjection += '\n' + canMatch[0];
  }

  const versionTag = '<meta name="freestruct-build" content="' + buildHash + '">';
  // Marker goes FIRST so the entire generated tail (seo block, later snippet
  // and late-pass insertions land downstream of it) is one strippable region
  // for computeBuildHash's stable view (scan.js) across reruns.
  // Sequence 3, spot 2 (issue #24): seoInjection is config/page-carried, so
  // it rides a FUNCTION replacer - in string form any $& / $1..9 inside the
  // injected head would be treated as replacement syntax and rewrite the page.
  html = html.replace(/<\/head>/i, () => '<!-- freestruct -->\n' + seoInjection + '\n' + versionTag + '\n</head>');

  // Custom snippet passes: comments stripped, advertised placeholders
  // ({{siteName}}, {{siteUrl}}, {{buildHash}}, ...) substituted - FIX for
  // issue #10: 0.4.x advertised placeholder substitution but never did it.
  function readSnippet(name) {
    const snippetPath = path.join(snippetDir, name);
    if (!fs.existsSync(snippetPath)) return null;
    let snippet = fs.readFileSync(snippetPath, 'utf8');
    for (const [k, v] of Object.entries(replacements)) snippet = snippet.split(k).join(v);
    return snippet.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Snippet bodies (issue #24): snippet/config-carried text always rides
  // function replacers - a literal $ sequence in a snippet must print
  // literally, never interfere with the surrounding document.
  const header = readSnippet('inject-header.html');
  if (header) html = html.replace(/<\/head>/i, () => header + '\n</head>');

  // Custom body-start injection after <body>
  const bodyStart = readSnippet('inject-body-start.html');
  if (bodyStart) html = html.replace(/<body[^>]*>/i, (m) => m + bodyStart);

  // Custom footer injection before </body>
  const footer = readSnippet('inject-footer.html');
  if (footer) html = html.replace(/<\/body>/i, () => footer + '\n</body>');

  if (config.minify) html = minifyHtml(html);

  page.html = html;
  fs.writeFileSync(page.file, html);
}

/** Reading time (~200 wpm), based on the body word count. */
export function addReadingTime(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<meta[^>]*name="reading-time"[^>]*>/gi, '');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return;

  const text = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const minutes = Math.max(1, Math.ceil(words.length / 200));

  html = html.replace(/<\/head>/i, `<meta name="reading-time" content="${minutes} min read">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/** Last-modified ISO timestamp meta. */
export function addLastModified(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<meta[^>]*name="last-modified"[^>]*>/gi, '');

  const now = new Date().toISOString();
  html = html.replace(/<\/head>/i, `<meta name="last-modified" content="${now}">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/** Add loading="lazy" to images without it. */
export function addLazyLoading(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/(<img[^>]*(?<!loading)=)[^>]*>/gi, (match) => {
    if (match.includes('loading=')) return match;
    return match.replace(/>$/, ' loading="lazy">');
  });
  fs.writeFileSync(filePath, html);
}
