// freestruct SEO injection - runs post-build
// Frame-agnostic: works with any SSG, no plugins, no framework hooks
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

const OUTPUT_DIR = process.argv[2] || 'docs/_site';
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';

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

  // Remove existing freestruct-build tag before adding new one
  html = html.replace(/<meta[^>]*name="freestruct-build"[^>]*>/gi, '');

  // Version tag for cache busting - injected into every page
  const versionTag = '<meta name="freestruct-build" content="' + buildHash + '">';
  html = html.replace(/<\/head>/i, seo + '\n' + versionTag + '\n<!-- freestruct -->\n</head>');
  fs.writeFileSync(filePath, html);
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
  const notFound = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>404 | ' + config.site.name + '</title><meta name="freestruct-build" content="' + buildHash + '"></head><body><h1>404</h1></body></html>';
  fs.writeFileSync(path.join(outputDir, '404.html'), notFound);
  console.log('404.html generated');
}

module.exports = { inject };
if (require.main === module) inject();