// labs/static-site-target.js - crashtest run root for freestruct-built docs.
//
// The double doctrine (crashtest's fixtures/site precedent): the real
// component under attack is the freestruct-generated tree; the only fake is
// the transport. This handler models ONE honest static host shape - the
// GitHub Pages class of server - and nothing more:
//
//   - path resolution: exact file, dir/index.html, path + '.html' (pretty
//     permalinks are all the same page to a static host)
//   - missing files answer 404, body = the site's own generated 404.html
//     (fallback body when the tree ships none)
//   - percent-decoded paths containing traversal/null bytes refuse (4xx) -
//     a containment model every real static host owns
//   - query strings never participate in resolution (static truth)
//
// The pack attacks freestruct's OWN SATISFACTORY FACTS through this shape:
// if the tree is wrong (missing noindex, leaked noindex page, raw XML), the
// wire shows it no matter whose server stands in front.

import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.rss': 'application/rss+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
};

/**
 * Build a context.handlers.shaped static-host handler for one built tree.
 * @param {string} rootDir the built output tree (docs/_site or a fixture)
 * @returns {(ctx: { request: Request }) => Promise<Response>}
 */
export function makeSiteHandler(rootDir) {
  const showError = async () => {
    let errFile = '';
    try {
      errFile = await readFile(join(rootDir, '404.html'), 'utf8');
    } catch { /* tree ships no error page */ }
    return new Response(errFile || 'Not Found', {
      status: 404,
      headers: errFile
        ? { 'content-type': TYPES['.html'] }
        : { 'content-type': 'text/plain; charset=utf-8' },
    });
  };
  const fourX = (code, text) => new Response(text, { status: code, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  return async ({ request }) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return fourX(405, 'method not allowed on a static host');
    }
    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return fourX(400, 'malformed percent-encoding');
    }
    if (pathname.includes('\0')) return fourX(400, 'null byte in path');

    // Containment (static truth): split on BOTH separators (the danger-side
    // model - a backslash stays a segment break), and any '..' segment is a
    // miss, never an escape out of the served root.
    const segs = pathname.split(/[/\\]/);
    if (segs.includes('..')) return showError();
    const parts = segs.filter((s) => s !== '' && s !== '.');

    const candidates = [];
    if (parts.length === 0) candidates.push('index.html');
    else candidates.push(parts.join('/'), `${parts.join('/')}/index.html`, `${parts.join('/')}.html`);
    for (const cand of candidates) {
      const full = join(rootDir, ...cand.split('/'));
      try {
        const st = await stat(full);
        if (st.isFile()) {
          const type = TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream';
          return new Response(await readFile(full), {
            status: 200,
            headers: { 'content-type': type },
          });
        }
        if (st.isDirectory()) {
          try {
            const idx = await readFile(join(full, 'index.html'), 'utf8');
            return new Response(idx, { status: 200, headers: { 'content-type': TYPES['.html'] } });
          } catch { /* fall through to next candidate */ }
        }
      } catch { /* candidate miss - keep walking */ }
    }
    return showError();
  };
}
