// engine/scan.js - output tree walk + page model (Phase 1.1)
// Every page freestruct touches is modeled once here: file path, alias-relative
// slug, 404 flag, and the pre-injection HTML snapshot the SEO gate needs.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/** Recursively list HTML files under dir (exists-checked). */
export function getHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...getHtmlFiles(fp));
    // Case-insensitive .html/.htm (Pass 26.10): a consumer SSG that emits
    // .HTM or upper-case extensions is a page like any other - the old
    // suffix test silently dropped it from every artifact.
    else if (/\.html?$/i.test(item.name)) files.push(fp);
  }
  return files;
}

/** Canonical slug for a file relative to the output root.
 *   index.html       -> '/'
 *   guide/index.html -> '/guide/'
 *   a&b.html         -> '/a&b'
 *   legacy.htm       -> '/legacy' (case-insensitive .html/.htm)
 */
export function slugFor(rel) {
  let p = String(rel).replace(/\\/g, '/');
  if (/^\/?index\.html?$/i.test(p)) return '/';
  p = '/' + p;
  p = p
    .replace(/\/index\.html?$/i, '/')
    .replace(/\.html?$/i, '');
  return p;
}

/** 404.html at root or any directory level is the 404 pipeline's business. */
export function is404File(rel) {
  const p = String(rel).replace(/\\/g, '/');
  return /(^|\/)404\.html?$/i.test(p);
}

/** Robots noindex detection on (possibly injected) HTML. */
export function htmlIsNoindex(html) {
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  return Boolean(m && /noindex/i.test(m[0]));
}

/** Strip any existing robots meta (404 pages get ours, un-duplicated). */
export function stripRobotsMeta(html) {
  return html.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, '');
}

/**
 * Decode the HTML entities an SSG routinely writes into <title>/meta content
 * (&amp; &lt; &gt; &quot; &#39;). Without this, an entity-encoded source fact
 * flowed verbatim into the generated artifacts: the feed re-escaped the
 * already-escaped '&amp;' into '&amp;amp;' (double-encoded text a reader
 * sees as '&amp;'), and search.json/llms.txt carried raw entities into
 * plain-text/JSON contexts that render them literally.
 */
// Common named entities (the ones that realistically appear in titles and
// descriptions) plus numeric forms. A title carrying '&#8217;' or '&mdash;'
// was left literal by the old five-entry map, so the feed double-escaped it
// ('&amp;#8217;', which renders as the literal entity text) and the length
// graders counted the markup instead of the character.
const NAMED_ENTITIES = {
  lt: '<', gt: '>', quot: '"', apos: "'", amp: '&',
  nbsp: '\u00a0', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0',
  times: '\u00d7', laquo: '\u00ab', raquo: '\u00bb', middot: '\u00b7',
  bull: '\u2022', euro: '\u20ac', pound: '\u00a3', yen: '\u00a5',
  cent: '\u00a2', sect: '\u00a7', para: '\u00b6', dagger: '\u2020',
  plusmn: '\u00b1', frac12: '\u00bd', frac14: '\u00bc', frac34: '\u00be',
};

export function decodeEntities(value) {
  return String(value == null ? '' : value)
    // Numeric forms first: decimal '&#8217;' and hex '&#x2019;'. Doing these
    // before the named pass keeps single-pass semantics ('&amp;#65;' stays
    // the literal '&#65;' after the amp pass, never '<').
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => {
      const cp = parseInt(hex, 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&#(\d+);/g, (m, dec) => {
      const cp = parseInt(dec, 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : m;
    });
}

// Quoted-attribute reader (same shape audit.js owns): the closing quote must
// MATCH the opening one, so a value holding the other quote kind (an
// apostrophe in a description) is read whole instead of truncated at it.
function attrValue(tag, attr) {
  const quoted = tag.match(new RegExp(`\\b${attr}=(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted) return quoted[2];
  const bare = tag.match(new RegExp(`\\b${attr}=([^\\s>]+)`, 'i'));
  return bare ? bare[1] : null;
}

/**
 * Extract SEO candidates from raw page HTML. Attribute-ORDER tolerant and
 * quote-agnostic (Pass 26.21): the old fixed `name="title" content="..."`
 * shape missed a reordered or single-quoted meta, so the page silently fell
 * back to the site-level value. Values are entity-decoded so downstream
 * artifacts (feed/search/llms) receive plain text, not raw entities.
 */
export function extractTitle(html) {
  const meta = html.match(/<meta\b[^>]*\bname=["']title["'][^>]*>/i);
  if (meta) {
    const v = attrValue(meta[0], 'content');
    if (v) return decodeEntities(v);
  }
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return t ? decodeEntities(t[1]).split(' | ')[0] : null;
}

export function extractDescription(html) {
  const meta = html.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i);
  if (!meta) return null;
  const v = attrValue(meta[0], 'content');
  return v ? decodeEntities(v) : null;
}

/**
 * Does the page already import SEO of the given type from SSG/frontmatter?
 * Used by the missing-only injection gate ('description' added in Phase 1: a
 * plain <meta name="description"> counts as covered).
 *
 * Every probe is TAG-ANCHORED (Pass 26.12): substring matches fire on the
 * page's own PROSE too - a docs page that quotes 'application/ld+json' in
 * a code span silenced its own structured-data injection, exactly the
 * configuration-reference page. Markup quotes markup: anchors, never
 * discussion.
 */
export function hasSeoType(html, type) {
  if (type === 'og') {
    return /<meta[^>]+property=["']og:(title|description)["']/i.test(html);
  }
  if (type === 'twitter') {
    return /<meta[^>]+name=["']twitter:(card|title)["']/i.test(html);
  }
  if (type === 'jsonld') {
    return /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  }
  if (type === 'canonical') {
    return /<link[^>]+rel=["']canonical["']/i.test(html);
  }
  if (type === 'description') {
    // Case-insensitive like every branch above: an SSG/author emitting an
    // upper- or mixed-case meta (<META NAME="description" ...>, valid HTML)
    // missed this gate, so freestruct injected a SECOND description and its
    // own audit then failed the page for the duplicate it caused.
    return /<meta[^>]*name=["']description["']/i.test(html);
  }
  return false;
}

/**
 * Visible text of an HTML fragment: script/style bodies and comments drop
 * first, then every tag, whitespace collapses, and entities decode. Shared by
 * the search index and the reading-time estimator - both count page prose, and
 * both were inflated by raw JS/CSS when each stripped tags alone.
 */
export function htmlToText(html) {
  return decodeEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script\s*>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style\s*>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * Snapshot every page once, before freestruct writes anything.
 * mtime is captured HERE so sitemap lastmod / RSS pubDate reflect the last
 * real content change (the SSG build), not freestruct's own decoration writes.
 */
export function buildPages(files, outputDir) {
  const pages = [];
  for (const file of files) {
    const rel = path.relative(outputDir, file);
    const html = fs.readFileSync(file, 'utf8');
    pages.push({
      file,
      rel,
      slug: slugFor(rel),
      is404: is404File(rel),
      html,
      mtime: fs.statSync(file).mtime,
      title: extractTitle(html),
      description: extractDescription(html),
    });
  }
  return pages;
}

/**
 * Deterministic content hash (ported principle from prestruct's deploy-id
 * audit: a timestamp-seeded hash churns ?v= asset params and CDN caches on
 * every run even when nothing changed). Derived from config + the sorted
 * pre-injection page content, so identical content always yields an
 * identical hash regardless of build time or machine.
 *
 * Everything this tool itself rewrites between runs is stripped or excluded
 * before hashing: the regenerated last-modified/reading-time/freestruct-build
 * metas, the previous ?v= bust params, and the whole head region after the
 * freestruct marker (that region holds the custom header snippet, whose
 * substituted {{buildHash}} would make the hash self-referential).
 * blurred lines, accepted consequences:
 *  - robots metas are excluded too: the 404 pipeline strip-and-reappears it
 *    at a different position each run (404 is tool-owned anyway); a noindex
 *    toggle on a user page will therefore not change the bust hash, and the
 *    page is not crawled either way.
 *  - a body/footer snippet that embeds {{buildHash}} self-references; that
 *    is documented as a no-go, not hacked around in the regex.
 */
export function computeBuildHash(config, pages) {
  const h = crypto.createHash('sha1');
  h.update(JSON.stringify(config || {}));
  // 404 pages sit outside the hash entirely: freestruct generates the missing
  // one mid-run (so run 1 and run 2 would otherwise disagree on page count),
  // and a noindex 404 is never crawled regardless.
  const stable = (html) => html
    .replace(/<meta[^>]*name="(freestruct-build|last-modified|reading-time|robots)"[^>]*>/gi, '')
    .replace(/<!-- freestruct -->[\s\S]*?(?=<\/head>)/i, '')
    // Body-start/footer snippets (marker-wrapped by seo.js) are the tool's own
    // output; strip them too or a rerun's body text differs from run 1 and the
    // content-derived hash churns every pass.
    .replace(/<!-- freestruct:snippet -->[\s\S]*?<!-- \/freestruct:snippet -->/gi, '')
    // The tableWrap pass (seo.js addTableWrap) wraps each outermost table in a
    // tool-owned div AFTER the hash is computed, so a rerun's page content
    // carries the wrapper the first run did not - without this strip the
    // content-derived hash churned on every pass for any site with a table.
    .replace(/<div class="fs-table-wrap"[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/div>/gi, '$1')
    .replace(/[?&]v=[0-9a-f]{8}/g, '')
    .replace(/ loading="lazy"/g, '');
  for (const page of pages.filter(p => !p.is404).sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))) {
    h.update(page.rel);
    h.update(stable(page.html));
  }
  return h.digest('hex').slice(0, 8);
}
