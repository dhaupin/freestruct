// engine/audit.js - the `freestruct audit` subcommand (issue #18)
// Post-build verification that the SEO injection ACTUALLY landed, page by
// page, plus site-level artifact checks - with an exit code for CI.
// Ported from the donated zero-dep audit script (prestruct#34, MIT-compatible)
// and remapped onto freestruct's own contract:
//   - meta extraction is attribute-order tolerant (per the donor's notes)
//   - og:image / twitter:image / twitter:site/creator are config-gated in
//     this engine (missing-only), so their absence is a WARN, not a FAIL
//   - the FAIL og/twitter class is the SHARED core (og:title/og:description,
//     twitter:card/twitter:title); the rest of the injected set rides WARN
//     because missing-only means SSG-tagged pages legitimately keep a
//     partial set (post-injection the audit cannot tell SSG-owned heads
//     apart, so partial-set coherence is report-grade)
//   - the SVG og:image trap stays a FAIL here (audit-grade; the run-warning
//     ladder from issue #20 is the pre-build enforcement point)
//   - the 404 check is the noindex contract only (issue #11's shape)
//   - external http(s) links: opt-in via --external (SEO-gap pass) - the
//     baked tree is audited for the network, not the default audit; HEAD
//     with a GET retry (some CDNs refuse HEAD), resolution failures and
//     HTTP >= 400 come back as WARN rows (report-grade: bots get 403/429)

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

// FAIL class = the tags core to the engine's own contract. The REST of the
// injected set (og:url/type/site_name/locale, twitter:description) rides as
// WARN because missing-only means SSG-tagged pages LEGITIMATELY keep a
// partial set - fail-failing those would punish contract-abiding output.
const OG_CORE = ['og:title', 'og:description'];
const OG_SET = ['og:url', 'og:type', 'og:site_name', 'og:locale'];
const TW_CORE = ['twitter:card', 'twitter:title'];
const TW_SET = ['twitter:description', 'twitter:image', 'twitter:site', 'twitter:creator'];
// LocalBusiness recommended fields per the donated script (schema.org).
const LB_RECOMMENDED = ['name', 'url', 'image', 'logo', 'telephone', 'priceRange', 'openingHoursSpecification', 'geo', 'sameAs'];

// ---------- scans ----------

/** Attribute-order tolerant meta extraction: hits aligned multi-space output. */
function grabMeta(head, attrHasKey, name) {
  const keyRe = new RegExp(`<meta[^>]${attrHasKey}=["']${name}["'][^>]*>`, 'i');
  const tag = head.match(keyRe);
  if (!tag) return null;
  const content = tag[0].match(/content=["']([^"']*)["']/i);
  return content ? content[1] : null;
}

function grabCanonical(head) {
  const link = head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)
    || head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  if (!link) return null;
  const href = link[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

/** Count every occurrence of a head shape - the duplicate-class probe. */
function countHead(head, re) {
  return (head.match(re) || []).length;
}

function walkHtml(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walkHtml(p));
    else if (/\.html?$/i.test(name)) out.push(p);
  }
  return out;
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}

/** Head-referenced URL -> on-disk path under the output dir, or null. */
function urlToDisk(urlValue, { outputDir, config }) {
  if (!urlValue) return null;
  let pathName = urlValue.split(/[?#]/)[0];
  if (/^https?:\/\//i.test(pathName)) {
    try {
      const u = new URL(pathName);
      const site = config?.site?.url ? new URL(config.site.url) : null;
      // Only site-local files can exist in the output tree.
      if (site && u.host !== site.host) return null;
      pathName = u.pathname + u.search;
    } catch (e) { return null; }
  } else if (/^\/\//.test(pathName)) {
    return null;
  }
  if (pathName.startsWith('/')) {
    if (config?.basePath && pathName.startsWith(config.basePath)) {
      pathName = pathName.slice(config.basePath.length);
    }
    return path.join(outputDir, pathName.replace(/^\//, ''));
  }
  return null;
}

// ---------- the audit ----------

/**
 * Audit a baked output directory. Returns { fails, warns, pages, sitemapLocs }.
 * Prints a human report by default, or a JSON digest with `json: true`;
 * `capture: true` (used when external checks ride along in json mode) skips
 * printing and hands the caller the raw result.
 * NEVER exits: the caller owns the exit code (0 clean / 1 findings).
 */
export function auditOutput({ outputDir, config, json = false, capture = false }) {
  const fails = [];
  const warns = [];
  const fail = (page, msg) => fails.push({ page, msg });
  const warn = (page, msg) => warns.push({ page, msg });

  // File-at-path hardening (Pass 26.13): a file at the outputDir path passes
  // existsSync, and walkHtml's readdirSync would arrive here uncaught.
  if (!existsSync(outputDir) || !statSync(outputDir).isDirectory()) {
    if (json) console.log(JSON.stringify({ ok: false, error: 'output dir not found: ' + outputDir }));
    else console.error('[freestruct] audit: no "' + outputDir + '" directory - run the build first.');
    return { fails: [{ page: 'outputDir', msg: 'missing' }], warns, pages: 0, sitemapLocs: 0 };
  }

  const pages = walkHtml(outputDir);
  let sitemapLocs = 0;

  for (const filePath of pages) {
    let rel;
    try { rel = path.relative(outputDir, filePath); } catch (e) { rel = filePath; }
    const html = readFileSync(filePath, 'utf8');
    const head = html.split('</head>')[0];
    const label = rel.replace(/\\/g, '/');

    if (/(^|\/)404\.html?$/i.test(label)) {
      const robots = grabMeta(head, 'name', 'robots') || '';
      if (!/noindex/i.test(robots)) fail(label, '404 page missing its noindex robots directive');
      continue;
    }

    const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch || !titleMatch[1].trim()) fail(label, 'missing <title>');
    else {
      const t = stripTags(titleMatch[1]).length;
      if (t > 65) warn(label, 'title ' + t + ' chars (> 65, may truncate)');
      if (t < 10) warn(label, 'title ' + t + ' chars (suspiciously short)');
    }

    const desc = grabMeta(head, 'name', 'description');
    if (!desc) fail(label, 'missing meta description');
    else if (desc.length < 70 || desc.length > 165) {
      warn(label, 'description ' + desc.length + ' chars (outside 70-165, may truncate)');
    }

    const canonical = grabCanonical(head);
    if (!canonical || canonical === '') fail(label, 'missing canonical link');
    else if (!/^https?:\/\//i.test(canonical)) fail(label, 'canonical not absolute: ' + canonical);

    // Duplicate tags ride the FAIL class: missing-only injection never
    // adds a tag the page already carries, so any duplicate in a baked
    // head is a page/SSG edit gone wrong (Pass 26.11). Attribute-order
    // tolerant, same as the missing checks.
    for (const dup of [
      ['duplicate canonical link (a page ships exactly one)', /<link[^>]+rel=["']canonical["']/gi],
      ['duplicate meta description', /<meta[^>]+name=["']description["']/gi],
      ['multiple <title> elements', /<title[^>]*>/gi],
      ['duplicate og:title', /<meta[^>]+property=["']og:title["']/gi],
    ]) {
      if (countHead(head, dup[1]) > 1) fail(label, dup[0]);
    }

    for (const prop of OG_CORE) {
      if (!grabMeta(head, 'property', prop)) fail(label, 'missing ' + prop);
    }
    for (const prop of OG_SET) {
      if (!grabMeta(head, 'property', prop)) {
        warn(label, prop + ' absent (part of the engine-injected set; SSG-owned partial sets keep contract)');
      }
    }
    if (!grabMeta(head, 'property', 'og:image')) {
      warn(label, 'og:image absent (no og.image configured? add one for share previews)');
    }
    for (const name of TW_CORE) {
      if (!grabMeta(head, 'name', name)) fail(label, 'missing ' + name);
    }
    for (const name of TW_SET) {
      // Symmetry with the engine's own late pass (seo.js): without a
      // configured handle the injector ships neither twitter:site nor
      // twitter:creator, so the audit grades those absences only when the
      // handle exists. The 'config-gated' wording in the warning now holds.
      if ((name === 'twitter:site' || name === 'twitter:creator') && !config.twitter?.username) continue;
      if (!grabMeta(head, 'name', name)) {
        warn(label, name + ' absent (config-gated or SSG-owned partial set; add a twitter username / og.image as needed)');
      }
    }

    const ogImage = grabMeta(head, 'property', 'og:image');
    if (ogImage && /\.svg(\?|#|$)/i.test(ogImage)) {
      fail(label, 'og:image is SVG (' + ogImage + ') - most social scrapers cannot render it; ship a raster PNG/JPG');
    }
    if (ogImage && !grabMeta(head, 'property', 'og:image:width')) {
      warn(label, 'og:image:width/height/alt absent (the og.image object form supplies them)');
    }
    if (ogImage && urlToDisk(ogImage, { outputDir, config }) && !existsSync(urlToDisk(ogImage, { outputDir, config }))) {
      // Report-grade on purpose (issue #18 sketch: 'worth having'): an og
      // image can legitimately be emitted on an SSG-side pass or a same-host
      // CDN, so a hard FAIL would punish valid setups; the JSON digest
      // carries it for teams who want to harden it in CI.
      warn(label, 'og:image points at ' + ogImage + ' which does not exist on disk');
    }

    const ldBlocks = [...html.matchAll(/<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    if (!ldBlocks.length) warn(label, 'no JSON-LD structured data');
    for (const block of ldBlocks) {
      let parsed;
      try { parsed = JSON.parse(block[1]); } catch (e) {
        fail(label, 'invalid JSON-LD: ' + e.message);
        continue;
      }
      const nodes = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        if (!node['@type']) { warn(label, 'JSON-LD node without @type'); continue; }
        const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
        if (types.includes('LocalBusiness')) {
          const missing = LB_RECOMMENDED.filter(f => !(f in node));
          if (missing.length) warn(label, 'LocalBusiness missing recommended: ' + missing.join(', '));
        }
        // schema-carried logo/image files: same exists-on-disk check as og:image
        for (const key of ['logo', 'image']) {
          const v = node[key];
          const target = urlToDisk(typeof v === 'string' ? v : null, { outputDir, config });
          if (target && !existsSync(target)) {
            warn(label, 'JSON-LD ' + key + ' points at ' + v + ' which does not exist on disk');
          }
        }
      }
    }

    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
    const h1Texts = h1s.map(m => stripTags(m[1])).filter(Boolean);
    if (!h1Texts.length) warn(label, 'no non-empty <h1>');
    else if (h1Texts.length > 1) warn(label, h1Texts.length + ' <h1> elements (prefer one)');
  }

  // ---------- site-level artifacts ----------

  const sitemapPath = path.join(outputDir, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    fail('sitemap.xml', 'missing');
  } else {
    const s = readFileSync(sitemapPath, 'utf8');
    sitemapLocs = (s.match(/<loc>/g) || []).length;
    if (sitemapLocs === 0) fail('sitemap.xml', 'no <loc> entries');
    if (!s.includes('<lastmod>')) warn('sitemap.xml', 'no <lastmod> dates (engine runs always add them; hand-stripped?)');
  }

  const robotsPath = path.join(outputDir, 'robots.txt');
  if (!existsSync(robotsPath)) {
    fail('robots.txt', 'missing');
  } else {
    const r = readFileSync(robotsPath, 'utf8');
    if (!/Sitemap:/i.test(r)) fail('robots.txt', 'no Sitemap: pointer');
  }

  // ---------- report ----------

  if (capture) {
    return { fails, warns, pages: pages.length, sitemapLocs };
  }
  if (json) {
    console.log(JSON.stringify({ ok: fails.length === 0, pages: pages.length, fails, warns }));
  } else {
    console.log('[freestruct] SEO audit: ' + pages.length + ' baked page(s) checked, sitemap.xml has ' + sitemapLocs + ' <loc> entries');
    for (const f of fails) console.log('  FAIL ' + f.page + ': ' + f.msg);
    for (const w of warns) console.log('  WARN ' + w.page + ': ' + w.msg);
    if (fails.length === 0) {
      console.log('[freestruct] audit: 0 failures, ' + warns.length + ' warning(s) - clean');
    } else {
      console.log('[freestruct] audit: ' + fails.length + ' failure(s), ' + warns.length + ' warning(s) - exiting 1');
    }
  }
  return { fails, warns, pages: pages.length, sitemapLocs };
}

// ---------- external links (opt-in, SEO-gap pass) ----------

const EXTERNAL_LIMIT = 50;

/** Collect external http(s) href URLs from the baked pages, deduped, with referencing pages. */
function collectExternalLinks({ outputDir, pages }) {
  const byUrl = new Map();
  for (const filePath of pages) {
    let rel;
    try { rel = path.relative(outputDir, filePath).replace(/\\/g, '/'); } catch (e) { rel = filePath; }
    const html = readFileSync(filePath, 'utf8');
    for (const m of html.matchAll(/href\s*=\s*["'](https?:\/\/[^"'\s]+)["']/gi)) {
      const url = m[1].replace(/&amp;/g, '&');
      if (!byUrl.has(url)) byUrl.set(url, []);
      byUrl.get(url).push(rel);
    }
  }
  return byUrl;
}

/** HEAD with a GET retry (some CDNs refuse HEAD); returns the problem string or null. */
async function headCheck(url) {
  const tryOnce = async (method) => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'freestruct-audit (+https://github.com/dhaupin/freestruct)' },
    });
    return res.status >= 400 ? 'HTTP ' + res.status + (res.statusText ? ' ' + res.statusText : '') : null;
  };
  try {
    return await tryOnce('HEAD');
  } catch (headErr) {
    try {
      return await tryOnce('GET');
    } catch (getErr) {
      const cause = (getErr && getErr.cause && getErr.cause.code) ? getErr.cause.code : getErr.message;
      return 'unreachable (' + cause + ')';
    }
  }
}

/**
 * External-link audit (opt-in): dedupe the tree's external hrefs, HEAD-check
 * up to EXTERNAL_LIMIT unique URLs, report every failure as a WARN row
 * (report-grade by design: bots get 403/429 legitimately). NEVER exits.
 */
export async function auditExternalLinks({ outputDir, json = false }) {
  const empty = { warns: [], checked: 0 };
  if (!existsSync(outputDir)) return empty;
  const pages = walkHtml(outputDir);
  const byUrl = collectExternalLinks({ outputDir, pages });
  if (byUrl.size === 0) return empty;
  const capped = [...byUrl.keys()].slice(0, EXTERNAL_LIMIT);
  const results = await Promise.all(capped.map(async (url) => [url, await headCheck(url)]));
  const warns = [];
  for (const [url, problem] of results) {
    if (!problem) continue;
    const referencing = byUrl.get(url);
    const label = referencing.length > 1
      ? referencing[0] + ' (+' + (referencing.length - 1) + ' more page(s))'
      : referencing[0];
    warns.push({ page: label, msg: 'external link ' + url + ': ' + problem });
  }
  if (byUrl.size > EXTERNAL_LIMIT) {
    warns.push({ page: 'external', msg: 'checked only the first ' + EXTERNAL_LIMIT + ' unique external urls of ' + byUrl.size });
  }
  if (!json && warns.length > 0) {
    console.log('[freestruct] external link check: ' + capped.length + ' unique url(s) probed');
    for (const w of warns) console.log('  WARN ' + w.page + ': ' + w.msg);
  }
  return { warns, checked: capped.length };
}
