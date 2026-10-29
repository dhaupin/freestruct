// engine/search.js - search.json generation (Phase 1.1 split)
// OPT-IN feature (owner decision): only generated when config.searchIndex is
// explicitly true. FIXES from the 0.4.x state:
//  - noindex pages are excluded (owner: noindex honored by default, issue #5)
//  - URLs come from scan.js slugs, so 'noindex.html' no longer becomes /no
//    and the root page is indexed under '/', not '/index'

import fs from 'fs';
import path from 'path';
import { pageUrlFor } from './urls.js';
import { extractTitle, extractDescription, decodeEntities } from './scan.js';

// Readable text of an HTML fragment: script/style bodies and comments are
// dropped before tags, then entities decode. The old body pass stripped tags
// only, so an inline <script> or <style> shipped its raw body into the index
// (JS source and CSS rules are not page text), and the h1 pass returned the
// raw inner HTML, so a heading with markup ('<h1>Title <em>x</em></h1>')
// landed in the index with its tags intact.
function readableText(html) {
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

export function generateSearchIndex(pages, config, outputDir) {
  const index = [];

  for (const page of pages) {
    if (page.slug === '/404') continue;
    // Fresh raw HTML for the content pass (pre-injection snapshot excludes
    // what freestruct itself writes, but post-injection is what a browser
    // would search; raw file content at this point is the injected page).
    const html = fs.readFileSync(page.file, 'utf8');

    // Entity-decoded, tag-free extraction (Pass 26.21 / 26.24): search.json is
    // JSON consumed by JS, where '&amp;' renders literally as '&amp;' and a
    // stray '<em>' renders as nothing - decode entities and drop every tag
    // (script/style bodies included) so the index carries plain page text.
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch ? readableText(bodyMatch[1]).slice(0, 500) : '';

    const title = extractTitle(html) || path.basename(page.file).replace(/\.html?$/i, '');
    const description = extractDescription(html) || '';
    const heading = h1Match ? readableText(h1Match[1]) : title;
    const url = pageUrlFor(config, page.slug);

    index.push({ title, heading, description, content, url });
  }

  fs.writeFileSync(path.join(outputDir, 'search.json'), JSON.stringify(index, null, 2));
  console.log('search.json generated (' + index.length + ' pages)');
}
