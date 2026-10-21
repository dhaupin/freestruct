// freestruct lib/seo.js - meta/OG/Twitter/JSON-LD injection + late passes (Phase 1.1)
// Same observable behavior as 0.4.x with one deliberate fix:
//  - the template's plain <meta name="description"> is now actually injected
//    for pages without one (it was silently dropped in 0.4.x).
// Late passes (reading-time / last-modified / lazy-load) are exported here and
// fed by the orchestrator, 404 pages included (PRD 1.4 consistency).

import fs from 'fs';
import path from 'path';
import { hasSeoType } from './scan.js';
import { pageUrlFor } from './urls.js';

function minifyHtml(html) {
  // Conservative HTML minifier - removes unnecessary whitespace
  // Preserves content inside <pre>, <textarea>, <script>, <style> tags
  let inBlock = false;
  let result = '';
  let i = 0;
  while (i < html.length) {
    if (html.slice(i, i + 5) === '<pre>') inBlock = true;
    else if (html.slice(i, i + 10) === '<textarea') inBlock = true;
    else if (html.slice(i, i + 8) === '<script>') inBlock = true;
    else if (html.slice(i, i + 7) === '<style>') inBlock = true;
    else if (html.slice(i, i + 6) === '</pre>') inBlock = false;
    else if (html.slice(i, i + 11) === '</textarea>') inBlock = false;
    else if (html.slice(i, i + 9) === '</script>') inBlock = false;
    else if (html.slice(i, i + 8) === '</style>') inBlock = false;

    if (inBlock) result += html[i];
    else if (html[i] === '\n' || html[i] === '\r' || html[i] === '\t') { /* skip */ }
    else result += html[i];
    i++;
  }
  return result
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inject the SEO pipeline into one page (written to disk).
 * Missing-only semantics against the PRE-INJECTION snapshot (page.html):
 * pages that ship their own OG/Twitter/JSON-LD/canonical/description keep them.
 */
export function injectPage(page, { config, template, buildHash, snippetDir }) {
  let html = page.html;
  const siteName = config.site.name;
  const pageTitle = (page.title || siteName) + ' | ' + siteName;
  const pageDescription = (page.description !== undefined && page.description !== null)
    ? page.description
    : config.site.description;
  const canonicalUrl = pageUrlFor(config, page.slug)
    + (config.cacheBusting?.hashInCanonicalUrl === true ? '?v=' + buildHash : '');

  // Add cache-busting query param to assets (css, js, images, fonts, ...)
  if (config.cacheBusting?.assetQueryParam !== false) {
    const assetExts = '.css.js.png.jpg.jpeg.gif.svg.webp.ico.woff.woff2.ttf.otf.wasm.json';
    html = html.replace(/(href|src)="([^"]+)"/gi,
      (match, attr, url) => {
        const cleanUrl = url.replace(/\?v=[^"]*/, '');
        const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.'));
        if (assetExts.includes(ext)) {
          return attr + '="' + cleanUrl + '?v=' + buildHash + '"';
        }
        return match;
      });
  }

  const replacements = {
    '{{pageTitle}}': pageTitle,
    '{{pageDescription}}': pageDescription || config.site.description,
    '{{pageUrl}}': canonicalUrl,
    '{{canonicalUrl}}': canonicalUrl,
    '{{siteUrl}}': config.site.url,
    '{{siteName}}': siteName,
    '{{siteDescription}}': config.site.description,
    '{{buildHash}}': buildHash,
    '{{twitterUsername}}': config.twitter?.username || '',
    '{{twitterCard}}': config.twitter?.card || 'summary',
    '{{ogImage}}': config.og?.image || '',
    '{{ogType}}': config.og?.type || 'website',
    '{{ogLocale}}': config.og?.locale || 'en_US',
  };

  let seo = template;
  for (const [k, v] of Object.entries(replacements)) seo = seo.split(k).join(v);
  seo = seo.replace(/<!--[\s\S]*?-->/g, '');

  // Remove existing freestruct-build tag (always refresh)
  html = html.replace(/<meta[^>]*name="freestruct-build"[^>]*>/gi, '');

  // Only inject SEO if page doesn't have it from SSG/frontmatter
  const hasOg = hasSeoType(html, 'og');
  const hasTwitter = hasSeoType(html, 'twitter');
  const hasJsonLd = hasSeoType(html, 'jsonld');
  const hasCanonical = hasSeoType(html, 'canonical');

  let seoInjection = '';
  // FIX (was 0.4.x wart): plain description meta now really reaches bare pages
  if (!hasSeoType(html, 'description')) {
    const descMatch = seo.match(/<meta name="description"[^>]*>/i);
    if (descMatch) seoInjection += '\n' + descMatch[0];
  }
  if (!hasOg) {
    const ogMatch = seo.match(/<meta property="og:[^"]*"[^>]*>/gi);
    if (ogMatch) seoInjection += '\n' + ogMatch.join('\n');
  }
  if (!hasTwitter) {
    const twMatch = seo.match(/<meta name="twitter:[^"]*"[^>]*>/gi);
    if (twMatch) seoInjection += '\n' + twMatch.join('\n');
  }
  if (!hasJsonLd) {
    const ldMatch = seo.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi);
    if (ldMatch) seoInjection += '\n' + ldMatch.join('\n');
  }
  if (!hasCanonical) {
    const canMatch = seo.match(/<link rel="canonical"[^>]*>/);
    if (canMatch) seoInjection += '\n' + canMatch[0];
  }

  const versionTag = '<meta name="freestruct-build" content="' + buildHash + '">';
  html = html.replace(/<\/head>/i, seoInjection + '\n' + versionTag + '\n<!-- freestruct -->\n</head>');

  // Custom snippet passes: comments stripped, advertised placeholders
  // ({{siteName}}, {{siteUrl}}, {{buildHash}}, ...) substituted - FIX for
  // issue #10: 0.4.x advertised placeholder substitution but never did it.
  function readSnippet(name) {
    const snippetPath = path.join(snippetDir, name);
    if (!fs.existsSync(snippetPath)) return null;
    let snippet = fs.readFileSync(snippetPath, 'utf8');
    for (const [k, v] of Object.entries(replacements)) snippet = snippet.split(k).join(v);
    return snippet.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Custom header injection before </head>
  const header = readSnippet('inject-header.html');
  if (header) html = html.replace(/<\/head>/i, header + '\n</head>');

  // Custom body-start injection after <body>
  const bodyStart = readSnippet('inject-body-start.html');
  if (bodyStart) html = html.replace(/<body[^>]*>/i, '$&' + bodyStart);

  // Custom footer injection before </body>
  const footer = readSnippet('inject-footer.html');
  if (footer) html = html.replace(/<\/body>/i, footer + '\n</body>');

  if (config.minify) html = minifyHtml(html);

  page.html = html;
  fs.writeFileSync(page.file, html);
}

/** Reading time (~200 wpm), based on the body word count. */
export function addReadingTime(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<meta[^>]*name="reading-time"[^>]*>/gi, '');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return;

  const text = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const minutes = Math.max(1, Math.ceil(words.length / 200));

  html = html.replace(/<\/head>/i, `<meta name="reading-time" content="${minutes} min read">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/** Last-modified ISO timestamp meta. */
export function addLastModified(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<meta[^>]*name="last-modified"[^>]*>/gi, '');

  const now = new Date().toISOString();
  html = html.replace(/<\/head>/i, `<meta name="last-modified" content="${now}">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/** Add loading="lazy" to images without it. */
export function addLazyLoading(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/(<img[^>]*(?<!loading)=)[^>]*>/gi, (match) => {
    if (match.includes('loading=')) return match;
    return match.replace(/>$/, ' loading="lazy">');
  });
  fs.writeFileSync(filePath, html);
}
