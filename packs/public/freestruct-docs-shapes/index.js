// packs/public/freestruct-docs-shapes/index.js - the freestruct static-docs lane.
//
// Freestruct's output lives on dumb static hosts (GitHub Pages, Netlify, any
// web root). So the pack attacks the FACTS freestruct writes into the built
// tree - reachable through any honest static serving of it - and stays silent
// about transport semantics that belong to the host (caching, compression).
//
// Cross-repo pack doctrine (prestruct-proxy precedent): NO imports from
// crashtest's internals. Plain verdict records, honest skips - a shape the
// run root cannot support is a REFUSED posture note, never a fake verdict.
//
// Eight attacks, one contract each:
//
//   hostile-traversal-404    encoded traversal shapes resist tree escapes and
//                            answer clean 4xx; artifact responses are
//                            query-independent (byte-identical under
//                            hostile query strings). Fuzz floor applies:
//                            never 5xx/throw.
//   gen404-noindex-canary    the free 404 shape freestruct generates carries
//                            `robots: noindex` and the host answers 404 for
//                            a missing path (issue #11 contract).
//   noindex-artifact-leak    noindex-flagged pages never appear in any
//                            generated artifact: a noindex URL listed by
//                            sitemap.xml IS the leak (issue #5), and
//                            search.json/feed.xml must stay clean too.
//   canonical-query-poison   canonical links are query-independent; hostile
//                            tracking/echo params must never appear inside
//                            the canonical a page advertises.
//   sitemap-xml-shape-canary sitemap.xml / feed.xml parse as XML: no raw
//                            unescaped & or < in loc/items (issue #9 class),
//                            loc values absolute URLs.
//
// Vocabulary (ctx / moduleCtx['freestruct-docs-shapes']):
//   route      route name of the static host handler (default: 'site')
//   probeName  path stem used by the 404 canary (default: fixed)
//   pages      optional page inventory (paths) for the noindex oracles: a
//              static host cannot enumerate pages freestruct deliberately
//              left OUT of every artifact, so a run root that wants the
//              generated-extras oracle to cover unlisted noindex pages
//              declares them here. Absent, the oracles fall back to the
//              union of every artifact-listed URL (which still catches any
//              real leak - a leaked page IS listed by definition).

const DEFAULT_ROUTE = 'site';
const CANARY_PROBE = '/freestruct-crashtest-canary-missing';

/** Hostile path shapes a static host must refuse regardless of grammar. */
const TRAVERSAL_SHAPES = [
  '/../package.json',
  '/..%2fpackage.json',
  '/..%5cpackage.json',
  '/%2e%2e/package.json',
  '/%2e%2e%2fpackage.json',
  '/%252e%252e%252fpackage.json',
  '/../.env',
  '/..%2f.env',
  '/..%00/package.json',
  '/%2e%2e/%2e%2e/package.json',
];

/** Hostile query canaries appended to artifact + page requests. */
const QUERY_FUZZ = [
  '?utm_source=crashtest',
  '?x=%22%3E%3Cscript%3E',
  '?x=<script>alert(1)</script>',
  '?x=%00',
];

// Cross-repo pack doctrine: inline verdict helpers (no crashtest imports).
const exhausted = (detail, extra = {}) => ({ verdict: 'EXPLOITED', detail, ...extra });
const refused = (detail, extra = {}) => ({ verdict: 'REFUSED', detail, ...extra });

function routeOf(ctx) { return (ctx && ctx.route) || DEFAULT_ROUTE; }

/** Truthful GET: returns { status, text, threw } without throwing. */
async function get(harness, route, url) {
  const rec = await harness.run(route, { method: 'GET', url });
  if (rec.threw) return { status: null, text: '', threw: rec.error };
  let text = '';
  try { text = await rec.response.text(); } catch { /* empty-body shapes */ }
  return { status: rec.status, text, threw: null };
}

/** Extract sitemap <loc> values. */
function sitemapLocs(xml) {
  const out = [];
  const re = /<loc>([\s\S]*?)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

/** Decode the XML entities freestruct writes into loc/item text. The old
 * shape was a no-op (it matched and returned the entity unchanged), so a
 * slug carrying `&` (`/a&amp;b`) never decoded to `/a&b` and resolved to the
 * 404 page on the wire - a false noindex "leak" on every ampersand page. */
function xmlUnescape(s) {
  return String(s).replace(/&(amp|lt|gt|quot|apos|#x?[0-9A-Fa-f]+);/g, (ent, body) => {
    if (body === 'amp') return '&';
    if (body === 'lt') return '<';
    if (body === 'gt') return '>';
    if (body === 'quot') return '"';
    if (body === 'apos') return "'";
    const code = body[0] === '#' && (body[1] === 'x' || body[1] === 'X')
      ? parseInt(body.slice(2), 16)
      : parseInt(body.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : ent;
  });
}

/** Path part of a sitemap loc (absolute URLs land as /path here). */
function locPath(loc) {
  try {
    const u = new URL(xmlUnescape(loc));
    return u.pathname || '/';
  } catch {
    return loc.startsWith('/') ? loc : `/${loc}`;
  }
}

/**
 * Every URL each generated artifact LISTS (as paths). The noindex oracles
 * must enumerate from ALL of them, not just sitemap.xml: a noindex page is
 * absent from the sitemap BY DESIGN (issue #5), so deriving the candidate
 * set from the sitemap alone made the feed/search legs dead code and let a
 * feed-only (or search-only) leak ship undetected.
 */
async function artifactPaths(harness, route) {
  const paths = new Set();
  const sitemap = await get(harness, route, '/sitemap.xml');
  if (sitemap.text && sitemap.status === 200) {
    for (const loc of sitemapLocs(sitemap.text)) paths.add(locPath(loc));
  }
  const feed = await get(harness, route, '/feed.xml');
  if (feed.text && feed.status === 200) {
    for (const m of feed.text.matchAll(/<link>([^<]+)<\/link>/g)) paths.add(locPath(m[1].trim()));
  }
  const search = await get(harness, route, '/search.json');
  if (search.text && search.status === 200) {
    try {
      const index = JSON.parse(search.text);
      for (const entry of Array.isArray(index) ? index : []) {
        if (entry && typeof entry.url === 'string') paths.add(locPath(entry.url));
      }
    } catch { /* not JSON - other oracles own that */ }
  }
  const llms = await get(harness, route, '/llms.txt');
  if (llms.text && llms.status === 200) {
    for (const m of llms.text.matchAll(/\]\(([^)\s]+)\)/g)) paths.add(locPath(m[1]));
  }
  return [...paths];
}

/** Declared page inventory (ctx.pages), normalized to leading-slash paths. */
function declaredPaths(ctx) {
  const raw = Array.isArray(ctx.pages) ? ctx.pages : [];
  return raw
    .filter((p) => typeof p === 'string' && p)
    .map((p) => (p.startsWith('/') ? p : `/${p}`));
}

/** RAW unescaped ampersand: any & not opening a legal XML entity. */
const RAW_AMP = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9A-Fa-f]+;)/;

/**
 * Content-SHAPE noindex oracle. The doctrine says content-shape, and the
 * first release violated it: the oracle searched page BODIES for the word
 * 'noindex', so a docs page that legitimately DISCUSSES noindex
 * (docs/AGENTS.md's quirk list) false-positived EXPLOITED in CI. A page is
 * noindex only when it CARRIES a robots meta that declares it:
 *   <meta name="robots" content="... noindex ...">  (attribute order free)
 */
function pageIsNoindex(html) {
  const metas = String(html).match(/<meta[^>]*name=["']robots["'][^>]*>/gi) || [];
  return metas.some((m) => /noindex/i.test(m));
}

export default {
  name: 'freestruct-docs-shapes',
  description: 'static-host wire truths for freestruct-built docs trees: traversal refusal, generated-404 noindex, noindex artifact leaks, query-independent canonicals, XML artifact shape (zero dependencies, zero sockets)',

  attacks: [
    {
      name: 'hostile-traversal-404',
      description: 'encoded traversal shapes answer clean 4xx (never 2xx with escaped-tree content, never 5xx/throw); artifact responses are query-independent under hostile query strings',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const escapes = [];
        const crashes = [];
        for (const shape of TRAVERSAL_SHAPES) {
          const rec = await harness.run(route, { method: 'GET', url: shape });
          if (rec.threw) { crashes.push(shape); continue; }
          let text = '';
          try { text = await rec.response.text(); } catch { /* nothing */ }
          if (rec.status >= 500) { crashes.push(shape); continue; }
          if (rec.status >= 200 && rec.status < 300) {
            // A 2xx on a traversal shape is only a finding when the body
            // carries escaped-tree material (package.json / .env shapes).
            if (/."version"\s*:/.test(text) || /^[A-Za-z0-9_]{1,64}=\S/m.test(text)) {
              escapes.push(`${shape} -> 2xx with outside-tree content`);
            }
          }
        }
        if (escapes.length || crashes.length) {
          return exhausted(
            `traversal containment broken: ${[...escapes, ...crashes].join(' | ')}`,
            { shapes: [...escapes, ...crashes].slice(0, 8) },
          );
        }
        // Query-independence: artifacts must answer byte-identical bodies
        // with and without hostile query strings (a static host never
        // contents a file with the query).
        const artifacts = [];
        for (const artifact of ['/sitemap.xml', '/feed.xml', '/robots.txt']) {
          const plain = await get(harness, route, artifact);
          if (!plain.text) continue; // target does not generate it - honest
          for (const q of QUERY_FUZZ) {
            const fuzzed = await get(harness, route, `${artifact}${q}`);
            if (fuzzed.threw) crashes.push(`${artifact}${q} (throw)`);
            else if (fuzzed.status >= 500) crashes.push(`${artifact}${q} -> 5xx`);
            else if (fuzzed.text !== plain.text) escapes.push(`${artifact}${q} -> query-shaped body`);
            artifacts.push(artifact);
          }
        }
        if (escapes.length || crashes.length) {
          return exhausted(
            `artifact query-independence broken: ${[...escapes, ...crashes].join(' | ')}`,
            { shapes: [...escapes, ...crashes].slice(0, 8) },
          );
        }
        return refused(
          `${TRAVERSAL_SHAPES.length} traversal shapes held (clean 4xx, no escape bodies, no 5xx); artifact bodies byte-identical across ${QUERY_FUZZ.length * artifacts.length} hostile-query fetches`,
          { shapes: TRAVERSAL_SHAPES.length, artifacts: artifacts.length },
        );
      },
    },

    {
      name: 'gen404-noindex-canary',
      description: 'a missing path answers 404 and the error body carries the freestruct noindex meta (issue #11 contract); a 200 on a missing path or a noindex-less 404 is a regression',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const probe = `${CANARY_PROBE}`;
        const rec = await get(harness, route, probe);
        if (rec.threw) {
          return exhausted(`404 canary shape crashed the host: ${rec.threw?.name || 'throw'}`);
        }
        if (rec.status >= 200 && rec.status < 300) {
          return exhausted(`missing path "${probe}" answered 200 - a soft 404 is indexable dead weight`);
        }
        if (rec.status !== 404) {
          return refused(`missing path answered ${rec.status} (not 200, not 404) - host posture note; freestruct contract not provable at this wire`, { status: rec.status });
        }
        if (!pageIsNoindex(rec.text)) {
          return exhausted(
            `404 body for "${probe}" ships no robots-noindex meta - the generated-404 contract (issue #11) regressed on this host's error page`,
          );
        }
        return refused(`404 canary held: clean 404 status + robots-noindex meta present on the error body (issue #11 contract held)`, { status: 404 });
      },
    },

    {
      name: 'noindex-artifact-leak',
      description: 'noindex-flagged pages stay out of the generated artifacts - a noindex page listed by sitemap.xml is itself the leak (issue #5), and search.json / feed.xml must never list one either: cross-artifact oracle over the real built tree',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const sitemap = await get(harness, route, '/sitemap.xml');
        const feed = await get(harness, route, '/feed.xml');
        const search = await get(harness, route, '/search.json');
        const llms = await get(harness, route, '/llms.txt');
        const artifacts = { 'sitemap.xml': sitemap, 'feed.xml': feed, 'search.json': search, 'llms.txt': llms };
        if (Object.values(artifacts).every((a) => !a.text || a.status !== 200)) {
          return refused('this target generates no sitemap/feed/search/llms artifact - artifact-leak oracle skipped honestly');
        }
        // Candidate pages: every URL any artifact lists, plus any inventory
        // the run root declares. Enumerating from the sitemap ALONE was the
        // bug - a noindex page is absent from the sitemap by design, so the
        // feed/search legs never saw a candidate and a feed-only leak shipped.
        const candidates = new Set([...await artifactPaths(harness, route), ...declaredPaths(ctx)]);
        const noindexed = new Set();
        for (const path of candidates) {
          const page = await get(harness, route, path);
          if (page.threw || !page.text) continue;
          if (pageIsNoindex(page.text)) noindexed.add(path);
        }
        if (!noindexed.size) {
          return refused(`${candidates.size} artifact-listed URL(s) wired; none carries a noindex meta - no artifact can leak`);
        }
        // Cross-artifact oracle: which artifacts list a page the wire says is
        // noindex? The sitemap listing one IS the leak (issue #5); the feed
        // and search index listing one are the same rule, one rule three
        // outputs. Every artifact's OWN URL list is the evidence.
        const leaks = {};
        const sitemapPaths = new Set(sitemap.text && sitemap.status === 200 ? sitemapLocs(sitemap.text).map(locPath) : []);
        const feedPaths = new Set(feed.text && feed.status === 200
          ? [...feed.text.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => locPath(m[1].trim())) : []);
        const searchPaths = new Set();
        if (search.text && search.status === 200) {
          try {
            const index = JSON.parse(search.text);
            for (const entry of Array.isArray(index) ? index : []) {
              if (entry && typeof entry.url === 'string') searchPaths.add(locPath(entry.url));
            }
          } catch { /* not JSON - shape oracle owns that */ }
        }
        for (const path of noindexed) {
          if (sitemapPaths.has(path)) (leaks['sitemap.xml'] ??= []).push(path);
          if (feedPaths.has(path)) (leaks['feed.xml'] ??= []).push(path);
          if (searchPaths.has(path)) (leaks['search.json'] ??= []).push(path);
          if (llms.text && llms.status === 200 && (llms.text.includes(path) || llms.text.includes(path.replace(/^\//, '')))) {
            (leaks['llms.txt'] ??= []).push(path);
          }
        }
        if (Object.keys(leaks).length) {
          const detail = Object.entries(leaks)
            .map(([artifact, paths]) => `${artifact} lists noindex page(s): ${paths.join(', ')}`)
            .join(' | ');
          return exhausted(`noindex pages leaked into generated artifacts - ${detail}`, { leaks });
        }
        return refused(
          `${noindexed.size} noindex page(s) wire-detected; the generated artifacts refuse to list them (issue #5 rule held)`,
          { noindex: noindexed.size },
        );
      },
    },

    {
      name: 'canonical-query-poison',
      description: "canonical links are query-independent: no hostile tracking/echo parameter ever appears inside the canonical a page advertises (query-shaped canonicals poison the site's index identity)",
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const sitemap = await get(harness, route, '/sitemap.xml');
        let paths = [];
        if (sitemap.text && sitemap.status === 200) {
          paths = sitemapLocs(sitemap.text).map(locPath);
        } else {
          paths = ['/'];
        }
        const poisoned = [];
        const missingCanonical = [];
        for (const path of paths) {
          const nom = await get(harness, route, path);
          if (nom.threw || nom.status !== 200) continue;
          const canonical = (nom.text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
          if (!canonical) { missingCanonical.push(path); continue; }
          for (const q of QUERY_FUZZ) {
            const fuzzed = await get(harness, route, `${path.startsWith('//') ? '' : ''}${path}${q}`);
            if (fuzzed.threw || fuzzed.status !== 200) continue;
            const canary = (fuzzed.text.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
            if (canary && canary !== canonical) {
              poisoned.push(`${path}${q} -> ${canary}`);
            }
          }
        }
        if (poisoned.length) {
          return exhausted(
            `canonical is query-shaped: ${poisoned[0]} (+${poisoned.length - 1} more) - hostile parameters must never survive into the canonical`,
            { entries: poisoned.slice(0, 6) },
          );
        }
        return refused(
          `${paths.length} page(s) canonical-verified across ${QUERY_FUZZ.length} hostile query shapes${missingCanonical.length ? ` (${missingCanonical.length} page(s) ship no canonical - posture note)` : ''}`,
          { pages: paths.length, poisoned: 0 },
        );
      },
    },

    {
      name: 'sitemap-xml-shape-canary',
      description: 'sitemap.xml and feed.xml parse as XML: no raw unescaped & or < should appear inside loc/items (issue #9 regression class), loc values absolute',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const breaks = [];
        for (const artifact of ['/sitemap.xml', '/feed.xml']) {
          const rec = await get(harness, route, artifact);
          if (rec.threw || !rec.text || rec.status !== 200) continue;
          const xml = rec.text;
          // Raw & in text/attribute slots: the classic regex-assembled XML
          // break that made issue #9's titles and ampersands poison indexes.
          if (RAW_AMP.test(xml)) breaks.push(`${artifact}: raw unescaped &`);
          // Loc absolutes: every <loc> must be an absolute URL when present.
          for (const loc of sitemapLocs(xml)) {
            if (!/^https?:\/\//i.test(loc)) breaks.push(`${artifact}: relative <loc> "${loc}"`);
          }
        }
        if (breaks.length) {
          return exhausted(
            `XML shape broken: ${breaks.join(' | ')} - raw unescaped values ship to every indexer that reads them`,
            { artifacts: breaks.slice(0, 6) },
          );
        }
        return refused('sitemap.xml / feed.xml shapes held: escaped entities, absolute loc values (nothing to poison)');
      },
    },

    {
      name: 'ldjson-close-canary',
      description: 'every JSON-LD block in a served page head parses as JSON and carries no raw `</` inside the block text (the script-close class: a consumer value ending up unescaped into an LD block would close injected script tags early and smuggle in markup)',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        // Same wire-truthed page set the canary-poison attack uses.
        const sitemap = await get(harness, route, '/sitemap.xml');
        let paths = [];
        if (sitemap.text && sitemap.status === 200) {
          paths = sitemapLocs(sitemap.text).map(locPath);
        } else {
          paths = ['/'];
        }
        const blocked = [];
        let scriptsScanned = 0;
        for (const path of paths) {
          const page = await get(harness, route, path);
          if (page.threw || !page.text || page.status !== 200) continue;
          const blocks = [...page.text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
          scriptsScanned += blocks.length;
          for (const block of blocks) {
            const raw = block[1] ?? '';
            if (/<\//.test(raw)) {
              blocked.push(`${path}: raw </ inside a JSON-LD block body`);
              continue;
            }
            try { JSON.parse(raw); } catch (e) {
              blocked.push(`${path}: an LD+JSON block does not parse (${e.message})`);
            }
          }
        }
        if (blocked.length) {
          return exhausted(
            `JSON-LD script-close/parse contract broken: ${blocked.slice(0, 4).join(' | ')}${blocked.length > 4 ? ` (+${blocked.length - 4} more)` : ''}`,
            { findings: blocked.length, blocks: scriptsScanned },
          );
        }
        return refused(
          `${paths.length} page(s) wired; ${scriptsScanned} JSON-LD block(s) scanned: all parse, none carries a raw </ (script-close class held)`,
          { pages: paths.length, blocks: scriptsScanned },
        );
      },
    },

    {
      name: 'noindex-extras-leak',
      description: 'pages the crawler was told to skip (robots-noindex bodies and the 404 page) never carry the GENERATED extras freestruct adds beyond its core head set: hreflang alternates, feed autodiscovery links, site-verification metas, and the generated typed-article/breadcrumb JSON-LD blocks (their compact engine-serialized @type shape) stay off skipped pages - the core injected set including the template\'s built-in Organization/WebSite blocks stays contractual on the 404 (issue #11 full pipeline)',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        // Wire-truth the skipped set: enumerate every URL any artifact lists
        // plus the declared inventory, then flag the bodies that carry the
        // robots meta. (Sitemap-only enumeration missed noindex pages absent
        // from the sitemap by design - see the artifact-leak attack.)
        const candidates = new Set([...await artifactPaths(harness, route), ...declaredPaths(ctx)]);
        // Engine-shape fingerprints for the GENERATED extras: the generated
        // article/breadcrumb blocks are JSON.stringify-serialized (`"@type":"..."`
        // compact, no space), while the template's core Organization/WebSite
        // blocks are template-spaced - so bare ld blocks on a skipped page
        // read as the core set, and compact typed ones read as extras.
        const leakMarkers = /(\"@type\":\"(Article|TechArticle|NewsArticle|BreadcrumbList)\")|\shreflang=|google-site-verification|msvalidate\.01|yandexVerification|pinterest-site-verification|application\/rss\+xml/i;
        const leaks = [];
        let skipped = 0;
        for (const path of candidates) {
          const page = await get(harness, route, path);
          if (page.threw || !page.text || page.status !== 200) continue;
          if (!pageIsNoindex(page.text)) continue;
          skipped++;
          if (leakMarkers.test(page.text)) leaks.push(path);
        }
        // The generated-or-adopted 404 joins the skipped set by contract.
        const nf404 = await get(harness, route, '/404.html');
        if (!nf404.threw && nf404.text && nf404.status === 200 && pageIsNoindex(nf404.text)) {
          skipped++;
          if (leakMarkers.test(nf404.text)) leaks.push('/404.html');
        }
        if (leaks.length) {
          return exhausted(
            `generated extras shipped onto skipped pages: ${leaks.join(', ')} - the noindex exclusion class must hold for every generated head addition`,
            { skipped },
          );
        }
        if (!skipped) {
          return refused('no robots-noindex page is wire-detectable at this target - the generated-extras oracle has nothing to attack', { skipped: 0 });
        }
        return refused(
          `${skipped} skipped page(s) (robots-noindex + 404 body): no generated extras riding on them (typed article/breadcrumb blocks, hreflang, verification metas, feed alternates)`,
          { skipped },
        );
      },
    },

    {
      name: 'llms-shape-leak',
      description: 'when the target generates llms.txt it lists the same page set sitemap.xml honors: a noindex URL inside it is the issue #5 leak class again, and every `## Docs` list entry must stay one line (flattened titles, closed on the same line)',
      async run(harness, ctx = {}) {
        const route = routeOf(ctx);
        const llms = await get(harness, route, '/llms.txt');
        if (llms.threw || llms.status !== 200 || !llms.text) {
          return refused('this target does not generate llms.txt at the wire root - shape oracle skipped honestly', { status: llms.status });
        }
        const text = llms.text;
        const finding = [];
        // noindex wire-truth, same oracle as the artifact-leak attack.
        const candidates = new Set([...await artifactPaths(harness, route), ...declaredPaths(ctx)]);
        for (const path of candidates) {
          const page = await get(harness, route, path);
          if (page.threw || !page.text || page.status !== 200 || !pageIsNoindex(page.text)) continue;
          const pageName = path.replace(/^\//, '');
          if (text.includes(path) || text.includes(pageName)) finding.push(`llms.txt lists the noindex page ${path}`);
        }
        // Entry shape: every `## Docs` list line opens, closes and flattens
        // on one line; bare `- [` without a close bracket is EXACTLY what the
        // newline-split class produces.
        for (const line of text.split('\n')) {
          if (/^-\s*\[/.test(line) && !/^\s*-\s*\[[^\]]*\]\([^)]*\)/.test(line)) {
            finding.push(`llms.txt entry not closed on one line: "${line.slice(0, 48)}"`);
          }
        }
        if (!/^\n*#/m.test(text)) finding.push('llms.txt ships no heading at all (never the summary contract, whether generated or hand-rolled)');
        if (/\r/.test(text)) finding.push('llms.txt carries CR bytes (the flattening contract warns on newlines that must not split entries)');
        if (finding.length) {
          return exhausted(`llms.txt contract broken: ${finding.slice(0, 4).join(' | ')}`, { findings: finding.length });
        }
        return refused(
          `llms.txt held: heading present, every entry single-line, none of ${candidates.size} wired page(s) is a leak`,
          { entries: (text.match(/^\s*-\s*\[/gm) || []).length },
        );
      },
    },
  ],
};
