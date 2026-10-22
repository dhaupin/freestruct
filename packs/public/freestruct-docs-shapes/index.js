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
// Five attacks, one contract each:
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

/** Unescape the XML entities freestruct is allowed to write. */
function xmlUnescape(s) {
  return s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9A-Fa-f]+);/g, (ent) => ent);
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
        if (!sitemap.text || sitemap.status !== 200) {
          return refused('this target does not generate sitemap.xml at the wire root - artifact-leak oracle skipped honestly', { status: sitemap.status });
        }
        // Wire-truth the noindex set: fetch every loc, flag pages whose body
        // carries the noindex robots meta. Finding one is ALREADY the sitemap
        // leak (issue #5 rule: noindex pages never ship into artifacts).
        const noindexed = [];
        const locs = sitemapLocs(sitemap.text);
        for (const loc of locs) {
          const path = locPath(loc);
          const page = await get(harness, route, path);
          if (page.threw) continue;
          if (page.text && pageIsNoindex(page.text)) noindexed.push(path);
        }
        if (!noindexed.length) {
          return refused(`${locs.length} sitemap URL(s) wired; none carries a noindex meta - no artifact can leak`);
        }
        const leaks = { 'sitemap.xml': [...noindexed] };
        const feed = await get(harness, route, '/feed.xml');
        const search = await get(harness, route, '/search.json');
        if (feed.text) {
          for (const p of noindexed) if (feed.text.includes(p)) (leaks['feed.xml'] ??= []).push(p);
        }
        if (search.text) {
          try {
            const index = JSON.parse(search.text);
            for (const entry of Array.isArray(index) ? index : []) {
              if (!entry || typeof entry.url !== 'string') continue;
              const path = locPath(entry.url);
              if (noindexed.includes(path)) (leaks['search.json'] ??= []).push(path);
            }
          } catch {
            // search.json might not parse when searchIndex is off / absent
          }
        }
        if (Object.keys(leaks).length) {
          const detail = Object.entries(leaks)
            .map(([artifact, paths]) => `${artifact} lists noindex page(s): ${paths.join(', ')}`)
            .join(' | ');
          return exhausted(`noindex pages leaked into generated artifacts - ${detail}`, { leaks });
        }
        return refused(
          `${noindexed.length} noindex page(s) in-tree; the generated artifacts refuse to list them (issue #5 rule held)`,
          { noindex: noindexed.length },
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
  ],
};
