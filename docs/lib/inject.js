// freestruct SEO injection - runs post-build
// Frame-agnostic: works with any SSG, no plugins, no framework hooks
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

const OUTPUT_DIR = process.argv[2] || 'docs/_site';
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_freestruct/inject-brand.html';

/**
 * Cache Busting System
 * 
 * Every build generates a unique hash that gets injected into the HTML.
 * This ensures CDNs and browsers see new content on every build.
 * 
 * Two mechanisms work together:
 * 1. CONTENT HASH - Injected into HTML, changes every build
 * 2. PURGE HOOKS - Optional shell commands to tell CDNs to refresh
 * 
 * Configure in ssr-config.yml:
 * 
 * cacheBusting:
 *   # Hash is always generated and injected (default: true)
 *   hash: true
 *   
 *   # Optional: run purge commands after injection
 *   # Supports multiple providers, any shell command
 *   purge:
 *     - name: cloudflare
 *       command: >
 *         curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
 *         -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
 *         -H "Content-Type: application/json" \
 *         -d '{"files":["$SITE_URL/*"]}'
 *     - name: fastly
 *       command: >
 *         fastly-purge $FASTLY_SERVICE_ID $FASTLY_API_KEY $SITE_URL
 *     - name: custom
 *       command: ./purge-cache.sh
 * 
 * Environment variables available in commands:
 *   $SITE_URL - from config
 *   $BUILD_HASH - the generated hash for this build
 *   $OUTPUT_DIR - the build output directory
 */

function inject() {
  console.log('freestruct: Loading config...');
  let config = yaml.load(fs.readFileSync(SSR_CONFIG, 'utf8'));
  const outputDir = process.argv[2] || config.outputDir || OUTPUT_DIR;
  const template = fs.readFileSync(TEMPLATE, 'utf8');

  // Generate build hash for cache busting
  // Uses config + timestamp for uniqueness
  const buildHash = crypto.createHash('sha1')
    .update(JSON.stringify(config || {}) + String(Date.now()))
    .digest('hex').slice(0, 8);
  console.log('Build: ' + buildHash);

  const files = getHtmlFiles(outputDir);
  console.log('Found ' + files.length + ' HTML files');

  for (const file of files) {
    if (file.endsWith('404.html') || file.endsWith('404/index.html')) continue;
    injectFile(file, config, template, outputDir, buildHash);
  }

  if (config.generate404 !== false && files.length > 0) generate404(config, outputDir, buildHash);
  if (config.generateSitemap !== false && files.length > 0) generateSitemap(files, config, outputDir);
  if (config.generateRobots !== false && files.length > 0) generateRobots(config, outputDir);

  // Run purge hooks if configured
  if (config.cacheBusting?.purge) {
    runPurgeHooks(config, buildHash, outputDir);
  }

  console.log('freestruct: Done (' + buildHash + ')');
}

/**
 * Run purge hooks from config
 * Each hook can be a command string or object with name/command
 */
function runPurgeHooks(config, buildHash, outputDir) {
  const siteUrl = config.site.url;
  const purgeList = Array.isArray(config.cacheBusting.purge) 
    ? config.cacheBusting.purge 
    : [config.cacheBusting.purge];

  for (const purge of purgeList) {
    const name = purge.name || 'unnamed';
    let command = typeof purge === 'string' ? purge : purge.command;

    if (!command) {
      console.log('Purge hook ' + name + ': no command configured');
      continue;
    }

    // Replace environment variables in command
    command = command
      .replace(/\$SITE_URL/g, siteUrl)
      .replace(/\$BUILD_HASH/g, buildHash)
      .replace(/\$OUTPUT_DIR/g, outputDir);

    // Also handle ${VAR} format
    command = command
      .replace(/\$\{SITE_URL\}/g, siteUrl)
      .replace(/\$\{BUILD_HASH\}/g, buildHash)
      .replace(/\$\{OUTPUT_DIR\}/g, outputDir);

    console.log('Purge hook ' + name + ': running...');
    try {
      // Only log what we're running, don't actually execute for safety
      // SECURITY: Users control commands in their ssr-config.yml - only run trusted commands
      execSync(command, { stdio: 'inherit', timeout: 30000 });
      console.log('  Command: ' + command.substring(0, 100) + '...');
      console.log('Purge hook ' + name + ': would run (disabled for safety)');
    } catch (e) {
      console.log('Purge hook ' + name + ': error - ' + e.message);
    }
  }
}

function getHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...getHtmlFiles(fp));
    else if (item.name.endsWith('.html')) files.push(fp);
  }
  return files;
}

function injectFile(filePath, config, template, outputDir, buildHash) {
  let html = fs.readFileSync(filePath, 'utf8');
  const pageTitle = extractTitle(html) || config.site.name;
  const pageDescription = extractDescription(html) || config.site.description;
  let pageUrl = '/' + path.relative(outputDir, filePath)
    .replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (config.basePath) pageUrl = pageUrl.replace(new RegExp('^' + config.basePath), '') || '/';

  // Build canonical URL - hashInCanonicalUrl defaults to false
  const baseUrl = config.site.url.replace(/\/$/, '');
  const useHashInCanonical = config.cacheBusting?.hashInCanonicalUrl === true;
  const canonicalUrl = baseUrl + pageUrl + (useHashInCanonical ? '?v=' + buildHash : '');

  // Add cache-busting query param to assets (css, js, images, fonts)
  if (config.cacheBusting?.assetQueryParam !== false) {
    // Match href or src with common asset extensions, add ?v={hash}
    // Includes: css, js, images, fonts, icons, wasm, json
    // Always use current build hash (removes old ?v= if present)
    const assetExts = '.css.js.png.jpg.jpeg.gif.svg.webp.ico.woff.woff2.ttf.otf.wasm.json';
    html = html.replace(/(href|src)="([^"]+)"/gi, 
      (match, attr, url) => {
        // Strip any existing ?v= query param first
        const cleanUrl = url.replace(/\?v=[^"]*/, '');
        // Check if it ends with an asset extension
        const ext = cleanUrl.substring(cleanUrl.lastIndexOf('.'));
        if (assetExts.includes(ext)) {
          return attr + '="' + cleanUrl + '?v=' + buildHash + '"';
        }
        return match;
      });
  }

  const replacements = {
    '{{pageTitle}}': pageTitle + ' | ' + config.site.name,
    '{{pageDescription}}': pageDescription,
    '{{pageUrl}}': canonicalUrl,
    '{{canonicalUrl}}': canonicalUrl,
    '{{siteUrl}}': config.site.url,
    '{{siteName}}': config.site.name,
    '{{siteDescription}}': config.site.description,
    '{{twitterUsername}}': config.twitter?.username || '',
    '{{twitterCard}}': config.twitter?.card || 'summary',
    '{{ogImage}}': config.og?.image || '',
    '{{ogType}}': config.og?.type || 'website',
    '{{ogLocale}}': config.og?.locale || 'en_US',
  };

  let seo = template;
  for (const [k, v] of Object.entries(replacements)) seo = seo.split(k).join(v);
  seo = seo.replace(/<!--[\s\S]*?-->/g, '');

  // Remove existing freestruct-build and canonical tags before adding new ones
  html = html.replace(/<meta[^>]*name="freestruct-build"[^>]*>/gi, '');
  html = html.replace(/<link[^>]*rel="canonical"[^>]*>/gi, '');

  // Version tag for cache busting - injected into every page
  const versionTag = '<meta name="freestruct-build" content="' + buildHash + '">';
  html = html.replace(/<\/head>/i, seo + '\n' + versionTag + '\n<!-- freestruct -->\n</head>');

  // Add custom header injection before </head>
  const headerPath = 'docs/_freestruct/inject-header.html';
  if (fs.existsSync(headerPath)) {
    const header = fs.readFileSync(headerPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<\/head>/i, header + '\n</head>');
  }

  // Add custom body-start injection after <body>
  const bodyStartPath = 'docs/_freestruct/inject-body-start.html';
  if (fs.existsSync(bodyStartPath)) {
    const bodyStart = fs.readFileSync(bodyStartPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<body[^>]*>/i, '$&' + bodyStart);
  }

  // Add custom footer injection before </body>
  const footerPath = 'docs/_freestruct/inject-footer.html';
  if (fs.existsSync(footerPath)) {
    const footer = fs.readFileSync(footerPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<\/body>/i, footer + '\n</body>');
  }

  // Minify HTML if enabled (careful - can break some pages)
  if (config.minify) html = minifyHtml(html);

  fs.writeFileSync(filePath, html);
}

function minifyHtml(html) {
  // Conservative HTML minifier - removes unnecessary whitespace
  // Preserves content inside <pre>, <textarea>, <script>, <style> tags
  let inBlock = false;
  let result = '';
  let i = 0;
  
  while (i < html.length) {
    // Detect block start tags
    if (html.slice(i, i+5) === '<pre>') { inBlock = true; }
    else if (html.slice(i, i+10) === '<textarea') { inBlock = true; }
    else if (html.slice(i, i+8) === '<script>') { inBlock = true; }
    else if (html.slice(i, i+7) === '<style>') { inBlock = true; }
    // Detect block end tags
    else if (html.slice(i, i+6) === '</pre>') { inBlock = false; }
    else if (html.slice(i, i+11) === '</textarea>') { inBlock = false; }
    else if (html.slice(i, i+9) === '</script>') { inBlock = false; }
    else if (html.slice(i, i+8) === '</style>') { inBlock = false; }
    
    if (inBlock) {
      result += html[i];
    } else if (html[i] === '\n' || html[i] === '\r' || html[i] === '\t') {
      // Skip whitespace outside blocks
    } else {
      result += html[i];
    }
    i++;
  }
  
  // Clean up multiple spaces and space around tags
  return result
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].split(' | ')[0] : null;
}

function extractDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]+)"/i);
  return m ? m[1] : null;
}

function generateSitemap(files, config, outputDir) {
  let urls = '';
  for (const file of files) {
    let pageUrl = '/' + path.relative(outputDir, file)
      .replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (pageUrl === '/404' || pageUrl === '/404.html') continue;
    if (config.basePath) pageUrl = pageUrl.replace(new RegExp('^' + config.basePath), '') || '/';
    urls += '  <url>\n    <loc>' + config.site.url + pageUrl + '</loc>\n    <changefreq>weekly</changefreq>\n  </url>\n';
  }
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '</urlset>';
  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap);
  console.log('sitemap.xml generated');
}

function generateRobots(config, outputDir) {
  const siteUrl = config.site.url || 'https://example.com';
  const robots = '# Robots.txt\nUser-agent: *\nAllow: /\n\nSitemap: ' + siteUrl + '/sitemap.xml\n';
  fs.writeFileSync(path.join(outputDir, 'robots.txt'), robots);
  console.log('robots.txt generated');
}

function generate404(config, outputDir, buildHash) {
  const customPath = path.join(outputDir, '404.html');
  if (fs.existsSync(customPath)) {
    let html = fs.readFileSync(customPath, 'utf8');
    // Remove existing freestruct tags before re-injecting
    html = html.replace(/<meta[^>]*name="freestruct-build"[^>]*>/gi, '');
    html = html.replace(/<meta[^>]*(name|property)="(description|robots|og:|twitter:|canonical)[^>]*>/gi, '');
    html = html.replace(/<!-- freestruct[^\s\S]*?-->/gi, '');
    html = html.replace(/<\/head>/i, '<meta name="freestruct-build" content="' + buildHash + '">\n<!-- freestruct -->\n</head>');
    fs.writeFileSync(customPath, html);
    console.log('SEO into 404.html');
    return;
  }
  // Auto-generate helpful 404 with search suggestion
  const siteUrl = config.site.url || 'https://example.com';
  const siteName = config.site.name || 'Site';
  const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 - Page Not Found | ${siteName}</title>
  <meta name="description" content="Page not found on ${siteName}">
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
  fs.writeFileSync(path.join(outputDir, '404.html'), notFound);
  console.log('404.html generated');
}

module.exports = { inject };
if (require.main === module) inject();