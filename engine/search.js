// engine/search.js - search.json generation (Phase 1.1 split)
// OPT-IN feature (owner decision): only generated when config.searchIndex is
// explicitly true. FIXES from the 0.4.x state:
//  - noindex pages are excluded (owner: noindex honored by default, issue #5)
//  - URLs come from scan.js slugs, so 'noindex.html' no longer becomes /no
//    and the root page is indexed under '/', not '/index'

import fs from 'fs';
import path from 'path';
import { pageUrlFor } from './urls.js';

export function generateSearchIndex(pages, config, outputDir) {
  const index = [];

  for (const page of pages) {
    if (page.slug === '/404') continue;
    // Fresh raw HTML for the content pass (pre-injection snapshot excludes
    // what freestruct itself writes, but post-injection is what a browser
    // would search; raw file content at this point is the injected page).
    const html = fs.readFileSync(page.file, 'utf8');

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch
      ? bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      : '';

    const title = titleMatch ? titleMatch[1].split(' | ')[0] : path.basename(page.file).replace(/\.html?$/i, '');
    const description = descMatch ? descMatch[1] : '';
    const heading = h1Match ? h1Match[1] : title;
    const url = pageUrlFor(config, page.slug);

    index.push({ title, heading, description, content, url });
  }

  fs.writeFileSync(path.join(outputDir, 'search.json'), JSON.stringify(index, null, 2));
  console.log('search.json generated (' + index.length + ' pages)');
}
