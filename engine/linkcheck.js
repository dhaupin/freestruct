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
export function checkLinks(files, outputDir, basePath = '') {
  const broken = [];

  // basePath is the URL path prefix the output tree is SERVED under (same
  // semantics urls.js owns for canonical/sitemap). A root-absolute href on a
  // baseurl'd site carries that prefix ("/myrepo/guides/cli"), but inside the
  // output tree the prefix is not a directory - resolving it literally turned
  // every nav link into a miss and failed --strict for every baseurl'd site
  // (issue #32). Strip the EXACT prefix before resolving; an href carrying a
  // DIFFERENT prefix stays broken (the strip must match the configured
  // basePath, not "any leading segment").
  const prefix = basePath
    ? ('/' + String(basePath).replace(/^\/+/, '')).replace(/\/+$/, '')
    : '';

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

    // Both quote styles (bug fix): the old /href="..."/ only saw
    // double-quoted hrefs, so a single-quoted broken link (`href='/gone/'`,
    // valid HTML) sailed through --strict. The backreference keeps the pair
    // consistent; the fragment is stripped from the checked target either way.
    // Case-insensitive (HTML attribute names are): an upper-case `HREF=`
    // (valid markup) was skipped entirely, so a broken link shipped green.
    const linkRegex = /href=(["'])([^"'#]+)(?:#[^"']*)?\1/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[2];

      // Skip external, absolute-protocol, and ANY scheme-shaped target
      // (data:, javascript:, tel:, mailto:, ...): schemes are not routes.
      if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('//')) continue;

      // Root-relative hrefs (the whole nav menu: "/guides/cli") resolve
      // against the OUTPUT ROOT - path.join(baseDir, '/x') APPENDS, it never
      // resets, which turned every menu link on a nested page into a miss
      // (the CI --strict run caught it). Relative hrefs stay page-relative.
      // A root-absolute href that carries the configured basePath has that
      // prefix stripped first (issue #32); one with a different prefix keeps
      // it and resolves (correctly) as broken.
      let target = link;
      // A query string is not part of the route: '/guide?foo=bar' serves the
      // same page as '/guide'. Resolving the raw value looked for a file
      // literally named 'guide?foo=bar' and reported a valid link broken
      // (failing --strict on any site whose nav carries query params, e.g. a
      // utm-tagged or search-fed link). Strip it before resolving.
      const q = target.indexOf('?');
      if (q !== -1) target = target.slice(0, q);
      if (target.startsWith('/') && prefix && (target === prefix || target.startsWith(prefix + '/'))) {
        target = target.slice(prefix.length) || '/';
      }
      const absPath = target.startsWith('/')
        ? path.join(outputDir, target)
        : path.join(baseDir, target);
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
