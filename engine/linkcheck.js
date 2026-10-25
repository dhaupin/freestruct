// engine/linkcheck.js - internal link validation (Phase 1.1 split)
// Report-only by default; --strict (see bin) consumes the returned broken list.

import fs from 'fs';
import path from 'path';

/**
 * Check internal links across every page. Returns [{file, link}] for broken
 * targets and prints the human-readable report (same output as 0.4.x).
 *
 * Two route shapes (Pass 26.10 - the old check acknowledged only literal
 * files): a target WITH an .html/.htm extension is checked as the file;
 * an extension-less (pretty-URL) target resolves through the same route
 * model the walker owns - directory index first (index.html / index.htm),
 * then the .html/.htm sibling file. Assets stay out of the checker's
 * purview (see the shape test above the flags).
 */
export function checkLinks(files, outputDir) {
  const broken = [];

  for (const file of files) {
    // Payload stripping (Pass 26.14): inline JS template strings
    // ("<a href=" + url + ">" shapes) are NOT links; rouge-fenced code
    // TEACHES link shapes (the style guide's <a href="guides/foo">) -
    // neither is a route. Scan the document with script, style, pre and
    // code payloads removed (real nav hrefs never live in any of them).
    const html = fs.readFileSync(file, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<pre[\s\S]*?<\/pre>/gi, '')
      .replace(/<code[\s\S]*?<\/code>/gi, '');
    const baseDir = path.dirname(file);

    const linkRegex = /href="([^"#]+)(?:#[^"]*)?"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];

      // Skip external, absolute-protocol, and ANY scheme-shaped target
      // (data:, javascript:, tel:, mailto:, ...): schemes are not routes.
      if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('//')) continue;

      // Root-relative hrefs (the whole nav menu: "/guides/cli") resolve
      // against the OUTPUT ROOT - path.join(baseDir, '/x') APPENDS, it never
      // resets, which turned every menu link on a nested page into a miss
      // (the CI --strict run caught it). Relative hrefs stay page-relative.
      const absPath = link.startsWith('/')
        ? path.join(outputDir, link)
        : path.join(baseDir, link);
      const normalized = path.normalize(absPath);

      // Targeted file link: extension decides the check shape (case-
      // insensitive .html/.htm - Pass 26.10, mixed-case SSG output is a
      // page like any other).
      if (/\.html?$/i.test(normalized)) {
        if (!fs.existsSync(normalized)) {
          broken.push({ file: path.relative(outputDir, file), link });
        }
        continue;
      }

      // Pretty-URL link: resolve like the route model - directory index
      // first, then the .html/.htm sibling. Asset-like targets (their last
      // segment carries an extension that is not a page route: .css, .js,
      // .png, .json, ...) are the host's business and stay out of the
      // link checker.
      const lastSegment = normalized.split(path.sep).pop() || '';
      if (lastSegment.includes('.')) continue;

      const dirIndex = fs.existsSync(path.join(normalized, 'index.html'))
        || fs.existsSync(path.join(normalized, 'index.htm'));
      const prettySibling = fs.existsSync(path.join(normalized + '.html'))
        || fs.existsSync(path.join(normalized + '.htm'));
      if (!dirIndex && !prettySibling) {
        broken.push({ file: path.relative(outputDir, file), link });
      }
    }
  }

  if (broken.length > 0) {
    console.log('Link check: ' + broken.length + ' broken links found');
    for (const b of broken.slice(0, 10)) {
      console.log('  BROKEN: ' + b.file + ' -> ' + b.link);
    }
  } else {
    console.log('Link check: All links OK');
  }
  return broken;
}
