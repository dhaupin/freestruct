// freestruct lib/notfound.js - the 404 pipeline (Phase 1.4)
// FIX (freestruct issue #11): generated AND custom 404 pages now get the full
// SEO pipeline via the same injectPage call every normal page uses, plus a
// robots noindex meta. The CHANGELOG's long-claimed noindex finally ships.

import fs from 'fs';
import path from 'path';
import { injectPage } from './seo.js';

/** Generate the fallback 404 page (search form + links), then run it through the SEO pipeline. */
export function generate404(config, outputDir, buildHash, template, snippetDir) {
  const file = path.join(outputDir, '404.html');
  const siteUrl = config.site.url || 'https://example.com';
  const siteName = config.site.name || 'Site';

  const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 - Page Not Found | ${siteName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
    h1 { font-size: 4rem; margin: 0; color: #333; }
    p { font-size: 1.2rem; color: #666; margin: 20px 0; }
    .search { margin: 30px 0; }
    .search input { width: 70%; padding: 12px; font-size: 1rem; border: 1px solid #ddd; border-radius: 4px; }
    .search button { padding: 12px 20px; font-size: 1rem; background: #333; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    .links { margin-top: 40px; }
    .links a { color: #0066cc; margin: 0 15px; }
  </style>
</head>
<body>
  <h1>404</h1>
  <p>Page not found</p>
  <p>The page you're looking for doesn't exist or was moved.</p>
  <div class="search">
    <form action="${siteUrl}/" method="get">
      <input type="text" name="s" placeholder="Search docs...">
      <button type="submit">Search</button>
    </form>
  </div>
  <div class="links">
    <a href="${siteUrl}/">Home</a>
    <a href="${siteUrl}/docs/">Docs</a>
  </div>
</body>
</html>`;

  fs.writeFileSync(file, notFound);
  console.log('404.html generated');
  return file;
}

/**
 * Bring any 404 page (generated or user-supplied) into the full pipeline:
 * injectPage for SEO + an explicit noindex robots meta. Returns the page
 * model so the orchestrator's late passes treat it like every other page.
 */
export function pipeline404(page, context) {
  let html = fs.readFileSync(page.file, 'utf8');
  // drop any pre-existing robots meta so ours is the single source of truth
  html = html.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, '');
  html = html.replace(/<\/head>/i, '<meta name="robots" content="noindex, nofollow">\n</head>');
  fs.writeFileSync(page.file, html);
  page.html = html;

  injectPage(page, context);
  return page;
}
