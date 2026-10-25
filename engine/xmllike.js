// engine/xmllike.js - escaping + sitemap + robots + RSS (Phase 1.3)
// THE XML CORRECTNESS CLASS FIX (freestruct issue #9):
//  - every generated XML value goes through escXml
//  - sitemap gains a real <lastmod> per page (pre-injection mtime, i.e. the
//    date the page content last actually changed, not the build time)
//  - RSS pubDate comes from each page's own mtime, not one shared build stamp

import fs from 'fs';
import path from 'path';
import { pageUrlFor } from './urls.js';

/** Escape a value for XML text/attribute contexts. */
export function escXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Loud-fail contract (PRD: a value that still produces invalid XML is a build
 * error, not a bad sitemap): escaping fixables &, <, >, "; characters that
 * cannot appear in XML at all (control chars) abort the build loudly.
 */
export function assertXmlSafe(value, field) {
  const text = String(value);
  const bad = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  if (bad) {
    throw new Error('XML safety: value for ' + field + ' contains control character U+'
      + bad[0].charCodeAt(0).toString(16).padStart(4, '0') + ' which cannot be escaped - refusing to write invalid XML');
  }
  return escXml(text);
}

/** W3C date (YYYY-MM-DD) from a page's own pre-injection mtime. */
function lastmodFor(page) {
  return page.mtime.toISOString().slice(0, 10);
}

/**
 * Sitemap with real per-page lastmod. Noindex pages are filtered upstream
 * (owner decision: noindex honored by default, freestruct issue #5).
 */
export function generateSitemap(pages, config, outputDir) {
  let urls = '';
  for (const page of pages) {
    urls += '  <url>\n'
      + '    <loc>' + assertXmlSafe(pageUrlFor(config, page.slug), 'sitemap loc') + '</loc>\n'
      + '    <lastmod>' + assertXmlSafe(lastmodFor(page), 'sitemap lastmod') + '</lastmod>\n'
      + '    <changefreq>weekly</changefreq>\n'
      + '  </url>\n';
  }
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls
    + '</urlset>';
  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap);
  console.log('sitemap.xml generated');
}

/**
 * robots.txt with a sitemap pointer. The pointer is basePath-aware
 * ('sitemap' artifacts follow the pageUrlFor contract - a raw site.url +
 * '/sitemap.xml' points at a 404 on sub-path installs, the #3 bug class).
 */
export function generateRobots(config, outputDir) {
  const sitemapUrl = pageUrlFor(config, 'sitemap.xml');
  const robots = '# Robots.txt\nUser-agent: *\nAllow: /\n\nSitemap: ' + sitemapUrl + '\n';
  fs.writeFileSync(path.join(outputDir, 'robots.txt'), robots);
  console.log('robots.txt generated');
}

/**
 * RSS with honest per-page pubDate (the date the page last changed, per its
 * pre-injection mtime). channel.lastBuildDate stays the run stamp.
 */
export function generateFeed(pages, config, outputDir) {
  const siteUrl = pageUrlFor(config, '/');
  const siteName = config.site.name || 'Site';
  const description = config.site.description || 'RSS Feed';
  const feedUrl = pageUrlFor(config, 'feed.xml');
  const now = new Date().toUTCString();

  let items = '';
  for (const page of pages) {
    const html = fs.readFileSync(page.file, 'utf8');
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].split(' | ')[0] : path.basename(page.file).replace(/\.html?$/i, '');
    const desc = descMatch ? descMatch[1] : '';
    const pageUrl = pageUrlFor(config, page.slug);
    const pubDate = page.mtime.toUTCString();
    items += '\n<item>\n'
      + '  <title>' + assertXmlSafe(title, 'feed title') + '</title>\n'
      + '  <link>' + assertXmlSafe(pageUrl, 'feed link') + '</link>\n'
      + '  <description>' + assertXmlSafe(desc, 'feed description') + '</description>\n'
      + '  <pubDate>' + assertXmlSafe(pubDate, 'feed pubDate') + '</pubDate>\n'
      + '  <guid>' + assertXmlSafe(pageUrl, 'feed guid') + '</guid>\n'
      + '</item>';
  }

  const feed = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`
    + `<channel>\n`
    + `  <title>${assertXmlSafe(siteName, 'feed channel title')}</title>\n`
    + `  <link>${assertXmlSafe(siteUrl, 'feed channel link')}</link>\n`
    + `  <description>${assertXmlSafe(description, 'feed channel description')}</description>\n`
    + `  <language>en-us</language>\n`
    + `  <lastBuildDate>${assertXmlSafe(now, 'feed lastBuildDate')}</lastBuildDate>\n`
    + `  <atom:link href="${assertXmlSafe(feedUrl, 'feed atom link')}" rel="self" type="application/rss+xml"/>\n`
    + `${items}\n`
    + `</channel>\n`
    + `</rss>`;

  fs.writeFileSync(path.join(outputDir, 'feed.xml'), feed);
  console.log('feed.xml generated');
}
