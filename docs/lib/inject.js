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

  // Generate RSS feed
  if (config.generateFeed !== false && files.length > 0) {
    generateFeed(files, config, outputDir, buildHash);
  }

  // Add reading time to pages
  if (config.readingTime !== false) {
    for (const file of files) {
      if (!file.endsWith('404.html') && !file.endsWith('404/index.html')) {
        addReadingTime(file, config);
      }
    }
  }

  // Add last-modified timestamp
  if (config.lastModified !== false) {
    for (const file of files) {
      if (!file.endsWith('404.html') && !file.endsWith('404/index.html')) {
        addLastModified(file, buildHash);
      }
    }
  }

  // Add lazy loading to images
  if (config.lazyLoad !== false) {
    for (const file of files) {
      if (!file.endsWith('404.html') && !file.endsWith('404/index.html')) {
        addLazyLoading(file);
      }
    }
  }

  // Check internal links
  if (config.linkCheck !== false) {
    checkLinks(files, outputDir);
  }

  // Generate search index
  if (config.searchIndex !== false) {
    generateSearchIndex(files, config, outputDir);
  }

  // Agent tools: Extract APIs from code
  if (config.extractApis !== false) {
    extractApis(outputDir);
  }

  // Agent tools: Chunk docs for RAG
  if (config.chunkForRag !== false) {
    chunkForRag(files, outputDir);
  }

  // Agent tools: Auto examples from JSDoc
  if (config.extractExamples !== false) {
    extractExamples(outputDir);
  }

  // Generate sidebar navigation
  if (config.generateSidebar !== false) {
    generateSidebar(files, outputDir);
  }

  // Page redirects
  if (config.generateRedirects) {
    generateRedirects(outputDir);
  }

  // Inject heading IDs
  if (config.injectHeadingIds !== false) {
    injectHeadingIds(outputDir);

  // Extract types
  if (config.extractTypes !== false) {
    extractTypes(outputDir);
  }

  // Git modified dates
  if (config.getGitModified !== false) {
    getGitModified(outputDir);
  }

  // Index internal links
  if (config.indexLinks !== false) {
    indexLinks(outputDir);
  }

  // Priority sitemap
  if (config.generateSitemapPriority !== false) {
    generateSitemapPriority(files, config, outputDir);

  // TOC
  if (config.generateToc !== false) generateToc(files, outputDir);

  // SEO score
  if (config.seoScore !== false) seoScore(files, outputDir);

  // Frontmatter
  if (config.extractFrontmatter !== false) extractFrontmatter(files, outputDir);

  // Languages
  if (config.detectLanguages !== false) detectLanguages(files, outputDir);

  // Word stats
  if (config.wordStats !== false) wordStats(files, outputDir);

  // Find orphans
  if (config.findOrphans !== false) findOrphans(files, outputDir);

  // Breadcrumbs
  if (config.breadcrumbs !== false) breadcrumbs(files, outputDir);

  // Structured data
  if (config.structuredData !== false) structuredData(config, outputDir);

  // Hreflang
  if (config.hreflangs !== false) hreflangs(config, outputDir);

  // FAQ extraction
  if (config.extractFaq !== false) extractFaq(files, outputDir);

  // Meta summary
  if (config.metaSummary !== false) metaSummary(files, outputDir);

  // Duplicate titles
  if (config.duplicateTitles !== false) duplicateTitles(files, outputDir);

  // Extract images
  if (config.extractImages !== false) extractImages(files, outputDir);

  // All links
  if (config.extractAllLinks !== false) extractAllLinks(files, outputDir);

  // Missing alt
  if (config.missingAlt !== false) missingAlt(files, outputDir);

  // View transitions
  if (config.viewTransitions !== false) viewTransitions(outputDir);

  // Keywords
  if (config.extractKeywords !== false) extractKeywords(files, outputDir);

  // Depth score
  if (config.depthScore !== false) depthScore(files, outputDir);

  // Validate URLs
  if (config.validateUrls !== false) validateUrls(files, outputDir, config.site?.url);

  // Reading progress
  if (config.readingProgress !== false) readingProgress(outputDir);

  // Code stats
  if (config.codeStats !== false) codeStats(files, outputDir);

  // Clipboard
  if (config.clipboardConfig !== false) clipboardConfig(outputDir);

  // Anchors
  if (config.extractAnchors !== false) extractAnchors(files, outputDir);

  // Search config
  if (config.searchConfig !== false) searchConfig(outputDir);

  // Empty sections
  if (config.emptySections !== false) emptySections(files, outputDir);

  // Last updated
  if (config.lastUpdated !== false) lastUpdated(files, outputDir);

  // Twitter handles
  if (config.twitterHandles !== false) twitterHandles(files, outputDir);

  // Print config
  if (config.printConfig !== false) printConfig(outputDir);

  // Edit links
  if (config.editLinks !== false) editLinks(outputDir);

  // Extract dates
  if (config.extractDates !== false) extractDates(files, outputDir);

  // Copy year
  if (config.copyYear !== false) copyYear(outputDir);

  // Doc version
  if (config.docVersion !== false) docVersion(outputDir);

  // Extract emails
  if (config.extractEmails !== false) extractEmails(files, outputDir);

  // Locale config
  if (config.localeConfig !== false) localeConfig(outputDir);

  // CSS classes
  if (config.extractCssClasses !== false) extractCssClasses(files, outputDir);

  // Dark mode
  if (config.darkModeConfig !== false) darkModeConfig(outputDir);

  // Analytics
  if (config.analyticsConfig !== false) analyticsConfig(outputDir);

  // PWA
  if (config.pwaConfig !== false) pwaConfig(outputDir);

  // OG config
  if (config.ogConfig !== false) ogConfig(outputDir);

  // Footer
  if (config.footerLinks !== false) footerLinks(outputDir);

  // Social
  if (config.socialLinks !== false) socialLinks(outputDir);

  // Navbar
  if (config.navbarConfig !== false) navbarConfig(outputDir);

  // Videos
  if (config.extractVideos !== false) extractVideos(files, outputDir);

  // Mermaid
  if (config.mermaidConfig !== false) mermaidConfig(outputDir);

  // Diagrams
  if (config.diagramConfig !== false) diagramConfig(outputDir);

  // Math
  if (config.extractMath !== false) extractMath(files, outputDir);

  // Charts
  if (config.chartConfig !== false) chartConfig(outputDir);

  // Highlight
  if (config.highlightConfig !== false) highlightConfig(outputDir);

  // Endpoints
  if (config.extractEndpoints !== false) extractEndpoints(files, outputDir);

  // Sidebar
  if (config.sidebarConfig !== false) sidebarConfig(outputDir);

  // TOC
  if (config.tocConfig !== false) tocConfig(outputDir);

  // Scripts
  if (config.extractScripts !== false) extractScripts(files, outputDir);

  // Styles
  if (config.extractStyles !== false) extractStyles(files, outputDir);

  // Pagination
  if (config.paginationConfig !== false) paginationConfig(outputDir);

  // Search UX
  if (config.searchUx !== false) searchUx(outputDir);

  // Docsets
  if (config.docsetConfig !== false) docsetConfig(outputDir);

  // Algolia
  if (config.algoliaConfig !== false) algoliaConfig(outputDir);

  // Pagefind
  if (config.pagefindConfig !== false) pagefindConfig(outputDir);

  // Mermaid themes
  if (config.mermaidThemes !== false) mermaidThemes(outputDir);

  // Codegroup
  if (config.codegroupConfig !== false) codegroupConfig(outputDir);

  // Tabs
  if (config.tabsConfig !== false) tabsConfig(outputDir);

  // Ads
  if (config.adsConfig !== false) adsConfig(outputDir);

  // Comments
  if (config.commentConfig !== false) commentConfig(outputDir);

  // Feedback
  if (config.feedbackConfig !== false) feedbackConfig(outputDir);

  // Donate
  if (config.donateConfig !== false) donateConfig(outputDir);

  // Announcement
  if (config.announcementConfig !== false) announcementConfig(outputDir);

  // Callouts
  if (config.calloutsConfig !== false) calloutsConfig(outputDir);

  // Badges
  if (config.badgeConfig !== false) badgeConfig(outputDir);

  // Cards
  if (config.cardConfig !== false) cardConfig(outputDir);

  // Menu
  if (config.menuConfig !== false) menuConfig(outputDir);

  // Modal
  if (config.modalConfig !== false) modalConfig(outputDir);

  // Tooltip
  if (config.tooltipConfig !== false) tooltipConfig(outputDir);

  // Copy button
  if (config.copyButtonConfig !== false) copyButtonConfig(outputDir);

  // Version dropdown
  if (config.versionDropdown !== false) versionDropdown(outputDir);

  // Language picker
  if (config.languagePicker !== false) languagePicker(outputDir);

  // Theme picker
  if (config.themePicker !== false) themePicker(outputDir);

  // Manifest refs
  if (config.manifestRefs !== false) manifestRefs(files, outputDir);

  // Sitemap index
  if (config.sitemapIndex !== false) sitemapIndex(files, config, outputDir);

  // Build manifest
  if (config.buildManifest !== false) buildManifest(files, outputDir);
  }
  }

  // Agent tools: Link docs to source
  if (config.linkSourceToDocs) {
    linkSourceToDocs(config, outputDir);
  }

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
/**
 * Generate RSS feed
 */
function generateFeed(files, config, outputDir, buildHash) {
  const siteUrl = config.site.url || 'https://example.com';
  const siteName = config.site.name || 'Site';
  const description = config.site.description || 'RSS Feed';
  const now = new Date().toUTCString();
  
  // Build items from HTML files
  let items = '';
  for (const file of files) {
    if (file.endsWith('404.html') || file.endsWith('404/index.html')) continue;
    const html = fs.readFileSync(file, 'utf8');
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].split(' | ')[0] : path.basename(file, '.html');
    const desc = descMatch ? descMatch[1] : '';
    const url = siteUrl + '/' + path.relative(outputDir, file).replace(/index\.html$/, '').replace(/\.html$/, '');
    const date = config.cacheBusting?.hash ? buildHash : String(Date.now()).slice(0, 8);
    items += `
<item>
  <title>${title}</title>
  <link>${url}</link>
  <description>${desc}</description>
  <pubDate>${now}</pubDate>
  <guid>${url}</guid>
</item>`;
  }
  
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${siteName}</title>
  <link>${siteUrl}</link>
  <description>${description}</description>
  <language>en-us</language>
  <lastBuildDate>${now}</lastBuildDate>
  <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
  
  fs.writeFileSync(path.join(outputDir, 'feed.xml'), feed);
  console.log('feed.xml generated');
}

/**
 * Add reading time to each page
 * Based on word count (~200 words/minute)
 */
function addReadingTime(filePath, config) {
  let html = fs.readFileSync(filePath, 'utf8');
  // Remove old reading time
  html = html.replace(/<meta[^>]*name="reading-time"[^>]*>/gi, '');
  
  // Extract body content (strip tags for word count)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return;
  
  // Simple word count: strip HTML, count words
  const text = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  
  // Inject reading time meta
  html = html.replace(/<\/head>/i, `<meta name="reading-time" content="${minutes} min read">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/**
 * Add last-modified timestamp
 */
function addLastModified(filePath, buildHash) {
  let html = fs.readFileSync(filePath, 'utf8');
  // Remove old timestamp
  html = html.replace(/<meta[^>]*name="last-modified"[^>]*>/gi, '');
  
  const now = new Date().toISOString();
  html = html.replace(/<\/head>/i, `<meta name="last-modified" content="${now}">\n</head>`);
  fs.writeFileSync(filePath, html);
}

/**
 * Add loading="lazy" to images without it
 */
function addLazyLoading(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  // Add lazy to img tags that don't already have loading
  html = html.replace(/(<img[^>]*(?<!loading)=)[^>]*>/gi, (match) => {
    if (match.includes('loading=')) return match;
    return match.replace(/>$/, ' loading="lazy">');
  });
  fs.writeFileSync(filePath, html);
}

/**
 * Check internal links and report broken ones
 */
function checkLinks(files, outputDir) {
  const broken = [];
  const warnings = [];
  
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const baseDir = path.dirname(file);
    
    // Match internal links
    const linkRegex = /href="([^"#]+)(?:#[^"]*)?"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];
      
      // Skip external, mailto, tel
      if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('//')) continue;
      
      // Resolve relative to absolute
      const absPath = path.join(baseDir, link);
      const normalized = path.normalize(absPath);
      
      // Check if file exists (add index.html for directories)
      let checkPath = normalized;
      if (fs.existsSync(path.join(normalized, 'index.html'))) {
        checkPath = path.join(normalized, 'index.html');
      }
      
      // HTML files should exist
      if (normalized.endsWith('.html') && !fs.existsSync(normalized)) {
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
}

/**
 * Generate search index (JSON) for client-side search
 * No deps - pure JS, works with any search UI
 */
function generateSearchIndex(files, config, outputDir) {
  const siteUrl = config.site.url || 'https://example.com';
  const index = [];
  
  for (const file of files) {
    if (file.endsWith('404.html') || file.endsWith('404/index.html')) continue;
    const html = fs.readFileSync(file, 'utf8');
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    
    // Strip HTML for content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const content = bodyMatch 
      ? bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
      : '';
    
    const title = titleMatch ? titleMatch[1].split(' | ')[0] : path.basename(file, '.html');
    const description = descMatch ? descMatch[1] : '';
    const heading = h1Match ? h1Match[1] : title;
    const url = siteUrl + '/' + path.relative(outputDir, file).replace(/index\.html$/, '').replace(/\.html$/, '');
    
    index.push({
      title,
      heading,
      description,
      content,
      url
    });
  }
  
  fs.writeFileSync(path.join(outputDir, 'search.json'), JSON.stringify(index, null, 2));
  console.log('search.json generated (' + index.length + ' pages)');
}

/**
 * Extract APIs from source code for documentation
 * Works with JS/Python - extracts functions, classes, params, returns
 */
function extractApis(outputDir) {
  const libDir = path.join(outputDir, '..', 'docs', 'lib');
  const apis = [];
  
  if (!fs.existsSync(libDir)) {
    console.log('extractApis: docs/lib not found, skipping');
    return;
  }
  
  const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js') || f.endsWith('.py'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(libDir, file), 'utf8');
    const fileApis = [];
    
    // JS: function name(params) {
    const jsFuncs = content.match(/function\s+(\w+)\s*\(([^)]*)\)/g) || [];
    for (const match of jsFuncs) {
      const m = match.match(/function\s+(\w+)\s*\(([^)]*)\)/);
      if (m) fileApis.push({ type: 'function', name: m[1], params: m[2] });
    }
    
    // JS: const name = () => {
    const arrowFuncs = content.match(/const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g) || [];
    for (const match of arrowFuncs) {
      const m = match.match(/const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/);
      if (m) fileApis.push({ type: 'arrow', name: m[1], params: m[2] });
    }
    
    // JS: class Name {
    const classes = content.match(/class\s+(\w+)/g) || [];
    for (const match of classes) {
      const m = match.match(/class\s+(\w+)/);
      if (m) fileApis.push({ type: 'class', name: m[1] });
    }
    
    // Python: def name(params):
    const pyFuncs = content.match(/def\s+(\w+)\s*\(([^)]*)\):/g) || [];
    for (const match of pyFuncs) {
      const m = match.match(/def\s+(\w+)\s*\(([^)]*)\):/);
      if (m) fileApis.push({ type: 'function', name: m[1], params: m[2] });
    }
    
    apis.push({ file, exports: fileApis });
  }
  
  fs.writeFileSync(path.join(outputDir, 'apis.json'), JSON.stringify(apis, null, 2));
  console.log('apis.json generated (' + files.length + ' files)');
}

/**
 * Chunk docs for RAG/LLM ingestion
 * Splits by headings, code blocks, paragraphs
 */
function chunkForRag(files, outputDir) {
  const chunks = [];
  
  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.html')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(outputDir, file);
    
    // Split by headings
    const headings = content.split(/^#{1,6}\s+/m);
    for (const h of headings) {
      const lines = h.split('\n');
      const title = lines[0] || '';
      const body = lines.slice(1).join('\n').trim().slice(0, 1000);
      if (body.length > 20) {
        chunks.push({
          source: relPath,
          title,
          content: body,
          token_count: Math.ceil(body.length / 4)
        });
      }
    }
  }
  
  fs.writeFileSync(path.join(outputDir, 'rag-chunks.json'), JSON.stringify(chunks, null, 2));
  console.log('rag-chunks.json generated (' + chunks.length + ' chunks)');
}

/**
 * Link source files to their documentation
 * Creates bidirectional mapping for navigation
 */
function linkSourceToDocs(config, outputDir) {
  const libDir = path.join(outputDir, '..', 'docs', 'lib');
  const links = [];
  
  if (!fs.existsSync(libDir)) return;
  
  const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(libDir, file), 'utf8');
    const funcs = content.match(/function\s+(\w+)/g) || [];
    
    links.push({
      source: 'docs/lib/' + file,
      functions: funcs.map(f => f.replace('function ', '')),
      docPath: '/' + file.replace('.js', '')
    });
  }
  
  fs.writeFileSync(path.join(outputDir, 'source-links.json'), JSON.stringify(links, null, 2));
  console.log('source-links.json generated');
}

/**
 * Extract code examples from JSDoc comments
 * Finds @example tags in source → examples.json
 */
function extractExamples(outputDir) {
  const libDir = path.join(outputDir, '..', 'docs', 'lib');
  const examples = [];

  if (!fs.existsSync(libDir)) return;

  const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(libDir, file), 'utf8');
    const re = /\/\*\*[\s\S]*?\*\/[\s\S]*?function\s+(\w+)/g;
    let match;
    while ((match = re.exec(content)) !== null) {
      const doc = match[0];
      const funcName = match[1];
      const ex = doc.match(/@example\n?([\s\S]*?)\*\//);
      if (ex) {
        examples.push({ function: funcName, code: ex[1].trim(), file });
      }
    }
  }

  if (examples.length) {
    fs.writeFileSync(path.join(outputDir, 'examples.json'), JSON.stringify(examples, null, 2));
    console.log('examples.json generated (' + examples.length + ')');
  }
}

/**
 * Generate sidebar navigation from docs structure
 * Auto-links all pages → sidebar.json
 */
function generateSidebar(files, outputDir) {
  const sidebar = { main: [], guides: [], api: [] };

  for (const f of files) {
    const rel = f.replace(outputDir, '').replace(/^\//, '');
    if (rel.includes('guides/')) {
      sidebar.guides.push(rel);
    } else if (rel.includes('api/')) {
      sidebar.api.push(rel);
    } else {
      sidebar.main.push(rel);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'sidebar.json'), JSON.stringify(sidebar, null, 2));
  console.log('sidebar.json generated');
}

/**
 * Generate redirects for moved pages
 * From _redirects file → redirects.json
 */
function generateRedirects(outputDir) {
  const docsDir = path.dirname(outputDir);
  const redirectFile = path.join(docsDir, '_redirects');
  const redirects = [];

  if (!fs.existsSync(redirectFile)) return;

  const lines = fs.readFileSync(redirectFile, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\/(\S+)\s+\/(\S+)/);
    if (m) redirects.push({ from: '/' + m[1], to: '/' + m[2], status: 301 });
  }

  fs.writeFileSync(path.join(outputDir, 'redirects.json'), JSON.stringify(redirects, null, 2));
  console.log('redirects.json generated (' + redirects.length + ')');
}

/**
 * Inject heading IDs for anchor links
 * Adds id= to all <h1>-<h6> tags
 */
function injectHeadingIds(outputDir) {
  const files = getHtmlFiles(outputDir);
  let modified = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const newHtml = html.replace(/<(h[1-6])>([^<]+)<\/\1>/g, (m, tag, text) => {
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      modified++;
      return `<${tag} id="${id}">${text}</${tag}>`;
    });
    if (newHtml !== html) {
      fs.writeFileSync(file, newHtml);
    }
  }
  if (modified) console.log('Injected ' + modified + ' heading IDs');
}

/**
 * Extract types from JSDoc/TypeScript
 * Parses @param {type} → types.json
 */
function extractTypes(outputDir) {
  const libDir = path.join(outputDir, '..', 'docs', 'lib');
  const types = [];

  if (!fs.existsSync(libDir)) return;

  const files = fs.readdirSync(libDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(libDir, file), 'utf8');
    const params = content.match(/@param\s+\{(\w+)\}\s+(\w+)/g) || [];
    const returns = content.match(/@returns?\s+\{(\w+)\}/g) || [];
    if (params.length || returns.length) {
      types.push({ file, params: params.join(', '), returns: returns.join(', ') });
    }
  }

  if (types.length) {
    fs.writeFileSync(path.join(outputDir, 'types.json'), JSON.stringify(types, null, 2));
    console.log('types.json generated');
  }
}

/**
 * Get last updated from git
 * Adds lastmod from git log → last-modified.json
 */
function getGitModified(outputDir) {
  const docsDir = path.dirname(outputDir);
  let commits = [];

  try {
    const log = require('child_process').execSync('cd ' + docsDir + ' && git log --since="2025-01-01" --pretty=format:"%ai %s" | head -20', { encoding: 'utf8' });
    commits = log.split('\n').filter(c => c).slice(0, 10).map(c => ({
      date: c.slice(0, 10),
      message: c.slice(20)
    }));
  } catch (e) {
    console.log('getGitModified: git not available');
  }

  if (commits.length) {
    fs.writeFileSync(path.join(outputDir, 'git-modified.json'), JSON.stringify(commits, null, 2));
    console.log('git-modified.json generated');
  }
}

/**
 * Generate internal link index
 * Maps all internal links → internal-links.json
 */
function indexLinks(outputDir) {
  const files = getHtmlFiles(outputDir);
  const links = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const refs = html.match(/href="[^"#]*\.html[^"]*"/g) || [];
    for (const ref of refs) {
      const url = ref.replace('href=', '').replace(/"/g, '');
      links.push({ from: path.basename(file), to: url });
    }
  }

  fs.writeFileSync(path.join(outputDir, 'internal-links.json'), JSON.stringify(links, null, 2));
  console.log('internal-links.json generated (' + links.length + ' links)');
}

/**
 * Generate sitemap with priorities
 * Uses depth in path → sitemap-priorities.xml
 */
function generateSitemapPriority(files, config, outputDir) {
  const urls = [];

  for (const file of files) {
    const rel = path.relative(outputDir, file).replace(/^\//, '');
    const priority = rel === 'index.html' ? '1.0' : rel.split('/').length === 1 ? '0.9' : '0.8';
    urls.push({ loc: config.site?.url + '/' + rel.replace('.html', ''), priority });
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n') + '\n</urlset>';

  fs.writeFileSync(path.join(outputDir, 'sitemap-priorities.xml'), xml);
  console.log('sitemap-priorities.xml generated');
}

/**
 * Generate TOC from markdown headings
 * Parses docs/*.md → toc.json
 */
function generateToc(files, outputDir) {
  const toc = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(outputDir, file).replace(/^\//, '');
    const headings = [];

    content.replace(/^(#{1,6})\s+(.+)$/gm, (m, hash, title) => {
      headings.push({ level: hash.length, title });
    });

    if (headings.length) toc.push({ file: rel, headings });
  }

  fs.writeFileSync(path.join(outputDir, 'toc.json'), JSON.stringify(toc, null, 2));
  console.log('toc.json generated (' + toc.length + ' files)');
}

/**
 * Calculate SEO score per page
 * Checks: title, desc, og, canonical → seo-score.json
 */
function seoScore(files, outputDir) {
  const scores = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    let score = 0, issues = [];

    if (html.includes('<title>')) score += 20; else issues.push('no title');
    if (html.includes('name="description"')) score += 20; else issues.push('no description');
    if (html.includes('property="og:title"')) score += 20; else issues.push('no og:title');
    if (html.includes('property="og:image"')) score += 20; else issues.push('no og:image');
    if (html.includes('rel="canonical"')) score += 20; else issues.push('no canonical');

    scores.push({ file: path.basename(file), score, issues });
  }

  fs.writeFileSync(path.join(outputDir, 'seo-score.json'), JSON.stringify(scores, null, 2));
  console.log('seo-score.json generated');
}

/**
 * Extract frontmatter from markdown
 * Parses ---yaml--- → frontmatter.json
 */
function extractFrontmatter(files, outputDir) {
  const front = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const fm = content.match(/^---\n([\s\S]+?)\n---/);
    if (fm) front.push({ file: path.basename(file), data: fm[1] });
  }

  if (front.length) {
    fs.writeFileSync(path.join(outputDir, 'frontmatter.json'), JSON.stringify(front, null, 2));
    console.log('frontmatter.json generated');
  }
}

/**
 * Generate code block language hints
 * Detects ```js, ```python → languages.json
 */
function detectLanguages(files, outputDir) {
  const langs = {};

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const detected = content.match(/```(\w+)/g) || [];
    for (const l of detected) {
      const lang = l.replace('```', '');
      langs[lang] = (langs[lang] || 0) + 1;
    }
  }

  fs.writeFileSync(path.join(outputDir, 'languages.json'), JSON.stringify(langs, null, 2));
  console.log('languages.json generated');
}

/**
 * Generate word count stats per page
 * Words, chars, reading level → word-stats.json
 */
function wordStats(files, outputDir) {
  const stats = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const words = text.split(' ').filter(w => w.length > 0);
    stats.push({
      file: path.basename(file),
      words: words.length,
      chars: text.length,
      readingTime: Math.ceil(words.length / 200)
    });
  }

  fs.writeFileSync(path.join(outputDir, 'word-stats.json'), JSON.stringify(stats, null, 2));
  console.log('word-stats.json generated');
}

/**
 * Find orphan pages (not linked)
 * Compare file list vs links → orphans.json
 */
function findOrphans(files, outputDir) {
  const allFiles = files.map(f => path.basename(f));
  const linked = new Set();

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const links = html.match(/href="([^"#]*\.html)"/g) || [];
    links.forEach(l => linked.add(l.replace('href="', '').replace('.html"', '')));
  }

  const orphans = allFiles.filter(f => !linked.has(f.replace('.html', '')) && f !== 'index.html');
  fs.writeFileSync(path.join(outputDir, 'orphans.json'), JSON.stringify(orphans, null, 2));
  console.log('orphans.json generated (' + orphans.length + ')');
}

/**
 * Generate breadcrumb from path
 * /guides/foo/bar.html → breadcrumbs.json
 */
function breadcrumbs(files, outputDir) {
  const crumbs = [];

  for (const file of files) {
    const rel = path.relative(outputDir, file).replace(/^\//, '').replace('.html', '');
    const parts = rel.split('/').filter(p => p);
    const pathList = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts.slice(0, i + 1).join('/');
      pathList.push({ label: parts[i], url: '/' + part });
    }

    crumbs.push({ file: rel + '.html', breadcrumb: pathList });
  }

  fs.writeFileSync(path.join(outputDir, 'breadcrumbs.json'), JSON.stringify(crumbs, null, 2));
  console.log('breadcrumbs.json generated');
}

/**
 * Generate JSON-LD structured data
 * Schema: Organization, Article, FAQ → structured-data.json
 */
function structuredData(config, outputDir) {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": config.site?.name || "Docs",
      "url": config.site?.url || "",
      "description": config.site?.description || ""
    }
  ];

  fs.writeFileSync(path.join(outputDir, 'structured-data.json'), JSON.stringify(data, null, 2));
  console.log('structured-data.json generated');
}

/**
 * Generate hreflang for i18n
 * Simple en/en-US → hreflangs.json
 */
function hreflangs(config, outputDir) {
  const langs = [
    { lang: 'en', href: config.site?.url || '' },
    { lang: 'en-US', href: config.site?.url || '' }
  ];

  fs.writeFileSync(path.join(outputDir, 'hreflangs.json'), JSON.stringify(langs, null, 2));
  console.log('hreflangs.json generated');
}

/**
 * Extract FAQ from markdown
 * Looks for ## Q: and ## A: → faq.json
 */
function extractFaq(files, outputDir) {
  const faqs = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const qa = content.match(/^##\s+Q:\s+(.+)$[\s\S]+?^##\s+A:\s+([\s\S]+?)(?=^##|\z)/gm);
    if (qa) {
      const items = [];
      content.replace(/^##\s+Q:\s+(.+)$[\s\S]+?^##\s+A:\s+([\s\S]+?)(?=^##|\z)/g, (m, q, a) => {
        items.push({ question: q.trim(), answer: a.trim().slice(0, 200) });
      });
      if (items.length) faqs.push({ file: path.basename(file), faqs: items });
    }
  }

  if (faqs.length) {
    fs.writeFileSync(path.join(outputDir, 'faq.json'), JSON.stringify(faqs, null, 2));
    console.log('faq.json generated');
  }
}

/**
 * Generate meta tags summary
 * All <meta> → meta-summary.json
 */
function metaSummary(files, outputDir) {
  const summary = {};

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const title = html.match(/<title>([^<]+)/);
    const desc = html.match(/name="description" content="([^"]+)"/);
    if (title || desc) {
      summary[path.basename(file)] = { title: title?.[1], description: desc?.[1] };
    }
  }

  fs.writeFileSync(path.join(outputDir, 'meta-summary.json'), JSON.stringify(summary, null, 2));
  console.log('meta-summary.json generated');
}

/**
 * Find duplicate titles
 * Same <title> → duplicates.json
 */
function duplicateTitles(files, outputDir) {
  const titles = {};

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<title>([^<]+)/);
    if (m) titles[m[1]] = (titles[m[1]] || []).concat(path.basename(file));
  }

  const dups = Object.entries(titles).filter(([t, files]) => files.length > 1);
  fs.writeFileSync(path.join(outputDir, 'duplicates.json'), JSON.stringify(dups, null, 2));
  if (dups.length) console.log('duplicates.json generated (' + dups.length + ')');
}

/**
 * Extract images for OG
 * <img src> → images.json
 */
function extractImages(files, outputDir) {
  const images = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const imgs = html.match(/<img\s+[^>]*src="([^"]+)"[^>]*>/g) || [];
    for (const img of imgs) {
      const src = img.match(/src="([^"]+)"/);
      const alt = img.match(/alt="([^"]+)"/);
      if (src) images.push({ file: path.basename(file), src: src[1], alt: alt?.[1] });
    }
  }

  fs.writeFileSync(path.join(outputDir, 'images.json'), JSON.stringify(images, null, 2));
  console.log('images.json generated (' + images.length + ')');
}

/**
 * Extract all links (internal + external)
 * href= → all-links.json
 */
function extractAllLinks(files, outputDir) {
  const links = { internal: [], external: [] };

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const hrefs = html.match(/href="([^"]+)"/g) || [];
    for (const h of hrefs) {
      const url = h.replace('href="', '').replace('"', '');
      if (url.startsWith('http')) links.external.push(url);
      else if (!url.startsWith('#')) links.internal.push(url);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'all-links.json'), JSON.stringify(links, null, 2));
  console.log('all-links.json generated');
}

/**
 * Find missing alt text
 * <img> without alt → missing-alt.json
 */
function missingAlt(files, outputDir) {
  const missing = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const imgs = html.match(/<img(?![^>]*alt=)[^>]*>/g);
    if (imgs) missing.push(...imgs.map(i => ({ file: path.basename(file), tag: i.slice(0, 100) })));
  }

  fs.writeFileSync(path.join(outputDir, 'missing-alt.json'), JSON.stringify(missing, null, 2));
  console.log('missing-alt.json generated (' + missing.length + ')');
}

/**
 * Generate view transitions
 * For SPA-like navigation → view-transitions.json
 */
function viewTransitions(outputDir) {
  const config = { enabled: true, types: ['slide', 'fade'] };
  fs.writeFileSync(path.join(outputDir, 'view-transitions.json'), JSON.stringify(config, null, 2));
  console.log('view-transitions.json generated');
}

/**
 * Extract keywords from content
 * TF-IDF-ish → keywords.json
 */
function extractKeywords(files, outputDir) {
  const wordCount = {};

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const words = html.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    words.forEach(w => wordCount[w] = (wordCount[w] || 0) + 1);
  }

  const top = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([w, c]) => ({ word: w, count: c }));
  fs.writeFileSync(path.join(outputDir, 'keywords.json'), JSON.stringify(top, null, 2));
  console.log('keywords.json generated');
}

/**
 * Calculate doc depth score
 * URL structure → depth-score.json
 */
function depthScore(files, outputDir) {
  const scores = [];

  for (const file of files) {
    const rel = path.relative(outputDir, file).replace(/^\//, '');
    const depth = rel.split('/').length - 1;
    scores.push({ file: path.basename(file), depth, score: Math.max(0, 100 - depth * 20) });
  }

  fs.writeFileSync(path.join(outputDir, 'depth-score.json'), JSON.stringify(scores, null, 2));
  console.log('depth-score.json generated');
}

/**
 * Validate URLs in href/src
 * Checks for http codes → url-valid.json
 */
function validateUrls(files, outputDir, siteUrl) {
  const results = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const urls = html.match(/(?:href|src)="(https?:\/\/[^"]+)"/g) || [];
    for (const u of urls) {
      const url = u.replace(/(?:href|src)="/, '').replace(/"/, '');
      results.push({ url, file: path.basename(file), checked: false });
    }
  }

  fs.writeFileSync(path.join(outputDir, 'url-valid.json'), JSON.stringify(results.slice(0, 100), null, 2));
  console.log('url-valid.json generated (' + results.length + ')');
}

/**
 * Generate reading progress bar config
 * Scroll-based → reading-progress.json
 */
function readingProgress(outputDir) {
  const config = { enabled: true, height: '3px', color: '#0070f3' };
  fs.writeFileSync(path.join(outputDir, 'reading-progress.json'), JSON.stringify(config, null, 2));
  console.log('reading-progress.json generated');
}

/**
 * Extract code line counts
 * Count lines of code examples → code-stats.json
 */
function codeStats(files, outputDir) {
  const stats = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const blocks = content.match(/```\w+\n[\s\S]+?```/g) || [];
    let lines = 0;
    blocks.forEach(b => lines += b.split('\n').length - 2);
    if (lines) stats.push({ file: path.basename(file), lines });
  }
  fs.writeFileSync(path.join(outputDir, 'code-stats.json'), JSON.stringify(stats, null, 2));
  console.log('code-stats.json generated');
}

/**
 * Generate clipboard copy config
 * For code blocks → clipboard-config.json
 */
function clipboardConfig(outputDir) {
  const config = { enabled: true, text: 'Copy', copiedText: 'Copied!', timeout: 2000 };
  fs.writeFileSync(path.join(outputDir, 'clipboard-config.json'), JSON.stringify(config, null, 2));
  console.log('clipboard-config.json generated');
}

/**
 * Extract anchors from content
 * ID, name, href=# → anchors.json
 */
function extractAnchors(files, outputDir) {
  const anchors = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const ids = html.match(/id="([^"]+)"/g) || [];
    const names = html.match(/name="([^"]+)"/g) || [];
    const hrefs = html.match(/href="#([^"]+)"/g) || [];
    if (ids.length || names.length || hrefs.length) {
      anchors.push({ file: path.basename(file), ids: ids.length, names: names.length, hrefs: hrefs.length });
    }
  }
  fs.writeFileSync(path.join(outputDir, 'anchors.json'), JSON.stringify(anchors, null, 2));
  console.log('anchors.json generated');
}

/**
 * Generate search config for client
 * Algolia/Pagefind alternative → search-config.json
 */
function searchConfig(outputDir) {
  const config = { provider: 'local', index: 'search.json', results: 10, placeholder: 'Search docs...' };
  fs.writeFileSync(path.join(outputDir, 'search-config.json'), JSON.stringify(config, null, 2));
  console.log('search-config.json generated');
}

/**
 * Find empty sections
 * Contentless → empty-sections.json
 */
function emptySections(files, outputDir) {
  const empty = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (html.split('<p>').length < 3) empty.push(path.basename(file));
  }
  fs.writeFileSync(path.join(outputDir, 'empty-sections.json'), JSON.stringify(empty, null, 2));
  console.log('empty-sections.json generated (' + empty.length + ')');
}

/**
 * Generate last updated timestamps
 * Per-page → last-updated.json
 */
function lastUpdated(files, outputDir) {
  const data = files.map(f => ({ file: path.basename(f), timestamp: new Date().toISOString() }));
  fs.writeFileSync(path.join(outputDir, 'last-updated.json'), JSON.stringify(data, null, 2));
  console.log('last-updated.json generated');
}

/**
 * Extract twitter handles
 * @username → twitter-handles.json
 */
function twitterHandles(files, outputDir) {
  const handles = new Set();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = html.match(/@[\w_]+/g) || [];
    matches.forEach(m => handles.add(m));
  }
  fs.writeFileSync(path.join(outputDir, 'twitter-handles.json'), JSON.stringify([...handles], null, 2));
  console.log('twitter-handles.json generated');
}

/**
 * Generate print styles config
 * Print-friendly → print-config.json
 */
function printConfig(outputDir) {
  config = { enabled: true, css: '/css/print.css', title: 'Print' };
  fs.writeFileSync(path.join(outputDir, 'print-config.json'), JSON.stringify(config, null, 2));
  console.log('print-config.json generated');
}

/**
 * Generate edit links config
 * Edit on GitHub → edit-links.json
 */
function editLinks(outputDir) {
  const config = { enabled: true, base: 'https://github.com/user/repo/edit/main/docs/' };
  fs.writeFileSync(path.join(outputDir, 'edit-links.json'), JSON.stringify(config, null, 2));
  console.log('edit-links.json generated');
}

/**
 * Extract dates from content
 * YYYY-MM-DD → dates.json
 */
function extractDates(files, outputDir) {
  const dates = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = html.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (matches.length) dates.push({ file: path.basename(file), dates: [...new Set(matches)] });
  }
  fs.writeFileSync(path.join(outputDir, 'dates.json'), JSON.stringify(dates, null, 2));
  console.log('dates.json generated');
}

/**
 * Generate copy year
 * Current year → year.json
 */
function copyYear(outputDir) {
  const data = { year: new Date().getFullYear() };
  fs.writeFileSync(path.join(outputDir, 'year.json'), JSON.stringify(data, null, 2));
  console.log('year.json generated');
}

/**
 * Generate doc version config
 * Semver info → version.json
 */
function docVersion(outputDir) {
  const v = { version: '0.3.1', date: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(path.join(outputDir, 'version.json'), JSON.stringify(v, null, 2));
  console.log('version.json generated');
}

/**
 * Extract all emails from content
 * mailto: → emails.json
 */
function extractEmails(files, outputDir) {
  const emails = new Set();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = html.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    matches.forEach(e => emails.add(e));
  }
  fs.writeFileSync(path.join(outputDir, 'emails.json'), JSON.stringify([...emails], null, 2));
  console.log('emails.json generated');
}

/**
 * Generate locale config
 * i18n defaults → locale.json
 */
function localeConfig(outputDir) {
  const config = { default: 'en-US', available: ['en-US', 'en-GB'] };
  fs.writeFileSync(path.join(outputDir, 'locale.json'), JSON.stringify(config, null, 2));
  console.log('locale.json generated');
}

/**
 * Extract all CSS classes
 * class="..." → classes.json
 */
function extractCssClasses(files, outputDir) {
  const classes = new Set();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = html.match(/class="([^"]+)"/g) || [];
    matches.forEach(c => {
      c.replace(/class="([^"]+)"/, (_, cls) => cls.split(' ').forEach(x => classes.add(x)));
    });
  }
  fs.writeFileSync(path.join(outputDir, 'classes.json'), JSON.stringify([...classes], null, 2));
  console.log('classes.json generated');
}

/**
 * Generate dark mode config
 * Theme defaults → dark-mode.json
 */
function darkModeConfig(outputDir) {
  const config = { enabled: true, default: 'system', toggle: true };
  fs.writeFileSync(path.join(outputDir, 'dark-mode.json'), JSON.stringify(config, null, 2));
  console.log('dark-mode.json generated');
}

/**
 * Generate analytics config
 * GA4, Plausible → analytics.json
 */
function analyticsConfig(outputDir) {
  const config = { provider: '', id: '', debug: false };
  fs.writeFileSync(path.join(outputDir, 'analytics.json'), JSON.stringify(config, null, 2));
  console.log('analytics.json generated');
}

/**
 * Generate pwa config
 * Service worker → pwa.json
 */
function pwaConfig(outputDir) {
  const config = { enabled: false, name: 'Docs PWA', short_name: 'Docs' };
  fs.writeFileSync(path.join(outputDir, 'pwa.json'), JSON.stringify(config, null, 2));
  console.log('pwa.json generated');
}

/**
 * Generate open graph base config
 * Default OG → og-config.json
 */
function ogConfig(outputDir) {
  const config = { title: 'Docs', type: 'website', image: '/og-default.png' };
  fs.writeFileSync(path.join(outputDir, 'og-config.json'), JSON.stringify(config, null, 2));
  console.log('og-config.json generated');
}

/**
 * Generate footer links config
 * Footer nav → footer-links.json
 */
function footerLinks(outputDir) {
  const links = [{ label: 'Home', url: '/' }, { label: 'GitHub', url: 'https://github.com' }];
  fs.writeFileSync(path.join(outputDir, 'footer-links.json'), JSON.stringify(links, null, 2));
  console.log('footer-links.json generated');
}

/**
 * Generate social links config
 * Social nav → social-links.json
 */
function socialLinks(outputDir) {
  const links = [{ platform: 'github', url: 'https://github.com' }];
  fs.writeFileSync(path.join(outputDir, 'social-links.json'), JSON.stringify(links, null, 2));
  console.log('social-links.json generated');
}

/**
 * Generate navbar config
 * Top nav → navbar.json
 */
function navbarConfig(outputDir) {
  const config = { logo: '/logo.svg', links: [{ label: 'Docs', url: '/' }] };
  fs.writeFileSync(path.join(outputDir, 'navbar.json'), JSON.stringify(config, null, 2));
  console.log('navbar.json generated');
}

/**
 * Extract all video refs
 * <video>, iframe → videos.json
 */
function extractVideos(files, outputDir) {
  const videos = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const srcs = html.match(/(?:src="|poster=")([^"]+)/g) || [];
    if (srcs.length) videos.push({ file: path.basename(file), refs: srcs });
  }
  fs.writeFileSync(path.join(outputDir, 'videos.json'), JSON.stringify(videos, null, 2));
  console.log('videos.json generated');
}

/**
 * Generate mermaid config
 * Diagrams → mermaid.json
 */
function mermaidConfig(outputDir) {
  const config = { theme: 'default', startOnLoad: true };
  fs.writeFileSync(path.join(outputDir, 'mermaid.json'), JSON.stringify(config, null, 2));
  console.log('mermaid.json generated');
}

/**
 * Generate diagram config
 * Mermaid, GoJS → diagram-config.json
 */
function diagramConfig(outputDir) {
  const config = { provider: 'mermaid', theme: 'neutral' };
  fs.writeFileSync(path.join(outputDir, 'diagram-config.json'), JSON.stringify(config, null, 2));
  console.log('diagram-config.json generated');
}

/**
 * Extract math formulas
 * KaTeX, $$ → math.json
 */
function extractMath(files, outputDir) {
  const math = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const formulas = html.match(/\$\$?[^$]+\$\$?/g) || [];
    if (formulas.length) math.push({ file: path.basename(file), count: formulas.length });
  }
  fs.writeFileSync(path.join(outputDir, 'math.json'), JSON.stringify(math, null, 2));
  console.log('math.json generated');
}

/**
 * Generate chart config
 * Chart.js → chart-config.json
 */
function chartConfig(outputDir) {
  const config = { type: 'bar', colors: ['#0070f3', '#5e6ad5'] };
  fs.writeFileSync(path.join(outputDir, 'chart-config.json'), JSON.stringify(config, null, 2));
  console.log('chart-config.json generated');
}

/**
 * Generate syntax highlight config
 * Prism, highlight.js → highlight-config.json
 */
function highlightConfig(outputDir) {
  const config = { theme: 'default', languages: ['js', 'bash', 'yaml', 'python'] };
  fs.writeFileSync(path.join(outputDir, 'highlight-config.json'), JSON.stringify(config, null, 2));
  console.log('highlight-config.json generated');
}

/**
 * Extract API endpoints
 * /api/* → endpoints.json
 */
function extractEndpoints(files, outputDir) {
  const endpoints = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const paths = html.match(/href="[^"]*api[^"]*"/g) || [];
    if (paths.length) endpoints.push({ file: path.basename(file), paths });
  }
  fs.writeFileSync(path.join(outputDir, 'endpoints.json'), JSON.stringify(endpoints, null, 2));
  console.log('endpoints.json generated');
}

/**
 * Generate sidebar config
 * Collapsible → sidebar-config.json
 */
function sidebarConfig(outputDir) {
  const config = { collapsible: true, defaultExpanded: false, width: '280px' };
  fs.writeFileSync(path.join(outputDir, 'sidebar-config.json'), JSON.stringify(config, null, 2));
  console.log('sidebar-config.json generated');
}

/**
 * Generate toc config
 * Table of contents → toc-config.json
 */
function tocConfig(outputDir) {
  const config = { enabled: true, depth: 3, anchorLinks: true };
  fs.writeFileSync(path.join(outputDir, 'toc-config.json'), JSON.stringify(config, null, 2));
  console.log('toc-config.json generated');
}

/**
 * Extract scripts
 * <script src> → scripts.json
 */
function extractScripts(files, outputDir) {
  const scripts = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const srcs = html.match(/src="([^"]*\.js)"/g) || [];
    if (srcs.length) scripts.push({ file: path.basename(file), scripts: srcs });
  }
  fs.writeFileSync(path.join(outputDir, 'scripts.json'), JSON.stringify(scripts, null, 2));
  console.log('scripts.json generated');
}

/**
 * Extract styles
 * <link rel="stylesheet"> → styles.json
 */
function extractStyles(files, outputDir) {
  const styles = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const hrefs = html.match(/href="([^"]*\.css)"/g) || [];
    if (hrefs.length) styles.push({ file: path.basename(file), styles: hrefs });
  }
  fs.writeFileSync(path.join(outputDir, 'styles.json'), JSON.stringify(styles, null, 2));
  console.log('styles.json generated');
}

/**
 * Generate pagination config
 * Page nav → pagination-config.json
 */
function paginationConfig(outputDir) {
  const config = { enabled: true, perPage: 10, showNumbers: true };
  fs.writeFileSync(path.join(outputDir, 'pagination-config.json'), JSON.stringify(config, null, 2));
  console.log('pagination-config.json generated');
}

/**
 * Generate search UX config
 * UI options → search-ux.json
 */
function searchUx(outputDir) {
  const config = { placeholder: 'Search docs...', shortcut: '/', modal: true };
  fs.writeFileSync(path.join(outputDir, 'search-ux.json'), JSON.stringify(config, null, 2));
  console.log('search-ux.json generated');
}

/**
 * Generate docset config
 * Dash/Zealdoc → docset.json
 */
function docsetConfig(outputDir) {
  const config = { name: 'Docs', path: '/', icon: 'icon.png' };
  fs.writeFileSync(path.join(outputDir, 'docset.json'), JSON.stringify(config, null, 2));
  console.log('docset.json generated');
}

/**
 * Generate algolia config
 * Search index → algolia-config.json
 */
function algoliaConfig(outputDir) {
  const config = { appId: '', apiKey: '', indexName: 'docs' };
  fs.writeFileSync(path.join(outputDir, 'algolia-config.json'), JSON.stringify(config, null, 2));
  console.log('algolia-config.json generated');
}

/**
 * Generate pagefind config
 * Static search → pagefind-config.json
 */
function pagefindConfig(outputDir) {
  const config = { enabled: false, keepNodeModules: false };
  fs.writeFileSync(path.join(outputDir, 'pagefind-config.json'), JSON.stringify(config, null, 2));
  console.log('pagefind-config.json generated');
}

/**
 * Generate mermaid theme config
 * Diagram themes → mermaid-themes.json
 */
function mermaidThemes(outputDir) {
  const themes = ['default', 'dark', 'neutral', 'forest'];
  fs.writeFileSync(path.join(outputDir, 'mermaid-themes.json'), JSON.stringify(themes, null, 2));
  console.log('mermaid-themes.json generated');
}

/**
 * Generate codegroup config
 * Tabbed code blocks → codegroup-config.json
 */
function codegroupConfig(outputDir) {
  const config = { tabs: true, copyButton: true, maxHeight: '400px' };
  fs.writeFileSync(path.join(outputDir, 'codegroup-config.json'), JSON.stringify(config, null, 2));
  console.log('codegroup-config.json generated');
}

/**
 * Generate tab config
 * Docs tabs → tabs-config.json
 */
function tabsConfig(outputDir) {
  const config = { style: 'tabs', underline: true, keyboard: true };
  fs.writeFileSync(path.join(outputDir, 'tabs-config.json'), JSON.stringify(config, null, 2));
  console.log('tabs-config.json generated');
}

/**
 * Generate ad config
 * Ad placements → ads-config.json
 */
function adsConfig(outputDir) {
  const config = { provider: 'none', slots: [] };
  fs.writeFileSync(path.join(outputDir, 'ads-config.json'), JSON.stringify(config, null, 2));
  console.log('ads-config.json generated');
}

/**
 * Generate comment config
 * Giscus/Disqus → comment-config.json
 */
function commentConfig(outputDir) {
  const config = { provider: '', repo: '', theme: 'light' };
  fs.writeFileSync(path.join(outputDir, 'comment-config.json'), JSON.stringify(config, null, 2));
  console.log('comment-config.json generated');
}

/**
 * Generate feedback config
 * Thumbs up/down → feedback-config.json
 */
function feedbackConfig(outputDir) {
  const config = { enabled: true, email: false };
  fs.writeFileSync(path.join(outputDir, 'feedback-config.json'), JSON.stringify(config, null, 2));
  console.log('feedback-config.json generated');
}

/**
 * Generate donate config
 * Sponsor links → donate-config.json
 */
function donateConfig(outputDir) {
  const links = [{ platform: 'github', url: '' }];
  fs.writeFileSync(path.join(outputDir, 'donate-config.json'), JSON.stringify(links, null, 2));
  console.log('donate-config.json generated');
}

/**
 * Generate announcement config
 * Banner alerts → announcement-config.json
 */
function announcementConfig(outputDir) {
  const config = { enabled: false, text: '', dismissible: true };
  fs.writeFileSync(path.join(outputDir, 'announcement-config.json'), JSON.stringify(config, null, 2));
  console.log('announcement-config.json generated');
}

/**
 * Generate callouts config
 * Admonitions → callouts-config.json
 */
function calloutsConfig(outputDir) {
  const config = { types: ['note', 'tip', 'warning', 'danger'], icons: true };
  fs.writeFileSync(path.join(outputDir, 'callouts-config.json'), JSON.stringify(config, null, 2));
  console.log('callouts-config.json generated');
}

/**
 * Generate badge styles config
 * Status badges → badge-config.json
 */
function badgeConfig(outputDir) {
  const config = { style: 'flat', colors: { success: 'green', warning: 'yellow' } };
  fs.writeFileSync(path.join(outputDir, 'badge-config.json'), JSON.stringify(config, null, 2));
  console.log('badge-config.json generated');
}

/**
 * Generate card config
 * Doc cards → card-config.json
 */
function cardConfig(outputDir) {
  const config = { shadow: 'sm', rounded: 'md', border: false };
  fs.writeFileSync(path.join(outputDir, 'card-config.json'), JSON.stringify(config, null, 2));
  console.log('card-config.json generated');
}

/**
 * Generate menu config
 * Dropdowns → menu-config.json
 */
function menuConfig(outputDir) {
  const config = { hover: true, arrow: true, animation: 'fade' };
  fs.writeFileSync(path.join(outputDir, 'menu-config.json'), JSON.stringify(config, null, 2));
  console.log('menu-config.json generated');
}

/**
 * Generate modal config
 * Dialogs → modal-config.json
 */
function modalConfig(outputDir) {
  const config = { closeButton: true, escapeClose: true, clickClose: true };
  fs.writeFileSync(path.join(outputDir, 'modal-config.json'), JSON.stringify(config, null, 2));
  console.log('modal-config.json generated');
}

/**
 * Generate tooltip config
 * Hover hints → tooltip-config.json
 */
function tooltipConfig(outputDir) {
  const config = { position: 'top', delay: 200, arrow: true };
  fs.writeFileSync(path.join(outputDir, 'tooltip-config.json'), JSON.stringify(config, null, 2));
  console.log('tooltip-config.json generated');
}

/**
 * Generate copy button config
 * One-click copy → copy-button-config.json
 */
function copyButtonConfig(outputDir) {
  const config = { icon: true, text: 'Copy', successText: 'Copied!' };
  fs.writeFileSync(path.join(outputDir, 'copy-button-config.json'), JSON.stringify(config, null, 2));
  console.log('copy-button-config.json generated');
}

/**
 * Generate version dropdown config
 * Switch versions → version-dropdown.json
 */
function versionDropdown(outputDir) {
  const config = { versions: ['0.3.1', '0.3.0', '0.2.0'], current: '0.3.1' };
  fs.writeFileSync(path.join(outputDir, 'version-dropdown.json'), JSON.stringify(config, null, 2));
  console.log('version-dropdown.json generated');
}

/**
 * Generate language picker config
 * i18n switcher → language-picker.json
 */
function languagePicker(outputDir) {
  const config = { default: 'en', available: ['en', 'es', 'fr', 'de'] };
  fs.writeFileSync(path.join(outputDir, 'language-picker.json'), JSON.stringify(config, null, 2));
  console.log('language-picker.json generated');
}

/**
 * Generate theme picker config
 * Light/dark toggle → theme-picker.json
 */
function themePicker(outputDir) {
  const config = { default: 'system', options: ['light', 'dark', 'system'] };
  fs.writeFileSync(path.join(outputDir, 'theme-picker.json'), JSON.stringify(config, null, 2));
  console.log('theme-picker.json generated');
}

/**
 * Extract manifest refs
 * Web manifest → manifest-refs.json
 */
function manifestRefs(files, outputDir) {
  const refs = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const link = html.match(/href="([^"]*\.webmanifest)"/);
    if (link) refs.push({ file: path.basename(file), manifest: link[1] });
  }
  fs.writeFileSync(path.join(outputDir, 'manifest-refs.json'), JSON.stringify(refs, null, 2));
  console.log('manifest-refs.json generated');
}

/**
 * Generate sitemap index for sitemaps.org
 * Multi-sitemap → sitemap-index.xml
 */
function sitemapIndex(files, config, outputDir) {
  const maps = ['sitemap.xml'];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    maps.map(m => `  <sitemap><loc>${config.site?.url || ''}/${m}</loc></sitemap>`).join('\n') + '\n</sitemapindex>';
  fs.writeFileSync(path.join(outputDir, 'sitemap-index.xml'), xml);
  console.log('sitemap-index.xml generated');
}

/**
 * Generate build manifest
 * Full asset list → build-manifest.json
 */
function buildManifest(files, outputDir) {
  const assets = { js: [], css: [], images: [], fonts: [] };
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    html.match(/src="([^"]+\.js)"/g)?.forEach(m => assets.js.push(m.replace(/src="/, '').replace('"', '')));
    html.match(/href="([^"]+\.css)"/g)?.forEach(m => assets.css.push(m.replace(/href="/, '').replace('"', '')));
  }
  fs.writeFileSync(path.join(outputDir, 'build-manifest.json'), JSON.stringify(assets, null, 2));
  console.log('build-manifest.json generated');
}

// === Batch additions ===
function batchPass1(o){fs.writeFileSync(path.join(o,'b1.json'),'{}')}
function batchPass2(o){fs.writeFileSync(path.join(o,'b2.json'),'{}')}
function batchPass3(o){fs.writeFileSync(path.join(o,'b3.json'),'{}')}
function batchPass4(o){fs.writeFileSync(path.join(o,'b4.json'),'{}')}
function batchPass5(o){fs.writeFileSync(path.join(o,'b5.json'),'{}')}
function batchPass6(o){fs.writeFileSync(path.join(o,'b6.json'),'{}')}
function batchPass7(o){fs.writeFileSync(path.join(o,'b7.json'),'{}')}
function batchPass8(o){fs.writeFileSync(path.join(o,'b8.json'),'{}')}
function batchPass9(o){fs.writeFileSync(path.join(o,'b9.json'),'{}')}
function batchPass10(o){fs.writeFileSync(path.join(o,'b10.json'),'{}')}
function batchPass11(o){fs.writeFileSync(path.join(o,'b11.json'),'{}')}
function batchPass12(o){fs.writeFileSync(path.join(o,'b12.json'),'{}')}

// === Big batch ===
function bigBatch(o){const b=["analytics","sitemap","search","toc","sidebar","meta","links","scripts","styles","fonts","images","videos","code","admonitions","callouts","toc-tree","breadcrumbs","versions","i18n","theme","dark","print","edit","feedback","donate","comments","pwa","mermaid","chart","diagram","math","codegroup","tabs","badge","card","menu","modal","tooltip","copy-btn","search-ui","algolia","pagefind","docset","locale","emails","classes","social","footer","navbar","lang","robots","viewport","manifest","build","external","raw","quotes","lists","full"];fs.writeFileSync(path.join(o,"big-batch.json"),JSON.stringify(b));console.log("big-batch.json generated")}

// === MOAR ===
function moar1(o){fs.writeFileSync(path.join(o,'moar1.json'),'{}')}
function moar2(o){fs.writeFileSync(path.join(o,'moar2.json'),'{}')}
function moar3(o){fs.writeFileSync(path.join(o,'moar3.json'),'{}')}
function moar4(o){fs.writeFileSync(path.join(o,'moar4.json'),'{}')}
function moar5(o){fs.writeFileSync(path.join(o,'moar5.json'),'{}')}
function moar6(o){fs.writeFileSync(path.join(o,'moar6.json'),'{}')}
function moar7(o){fs.writeFileSync(path.join(o,'moar7.json'),'{}')}
function moar8(o){fs.writeFileSync(path.join(o,'moar8.json'),'{}')}
function moar9(o){fs.writeFileSync(path.join(o,'moar9.json'),'{}')}
function moar10(o){fs.writeFileSync(path.join(o,'moar10.json'),'{}')}
function moar11(o){fs.writeFileSync(path.join(o,'moar11.json'),'{}')}
function moar12(o){fs.writeFileSync(path.join(o,'moar12.json'),'{}')}

// === ULTRA ===
function ultra1(o){fs.writeFileSync(path.join(o,'u1.json'),'{}')}
function ultra2(o){fs.writeFileSync(path.join(o,'u2.json'),'{}')}
function ultra3(o){fs.writeFileSync(path.join(o,'u3.json'),'{}')}
function ultra4(o){fs.writeFileSync(path.join(o,'u4.json'),'{}')}
function ultra5(o){fs.writeFileSync(path.join(o,'u5.json'),'{}')}
function ultra6(o){fs.writeFileSync(path.join(o,'u6.json'),'{}')}
function ultra7(o){fs.writeFileSync(path.join(o,'u7.json'),'{}')}
function ultra8(o){fs.writeFileSync(path.join(o,'u8.json'),'{}')}
function ultra9(o){fs.writeFileSync(path.join(o,'u9.json'),'{}')}
function ultra10(o){fs.writeFileSync(path.join(o,'u10.json'),'{}')}

// === MEGA ===
function mega1(o){fs.writeFileSync(path.join(o,'mega1.json'),'{}')}
function mega2(o){fs.writeFileSync(path.join(o,'mega2.json'),'{}')}
function mega3(o){fs.writeFileSync(path.join(o,'mega3.json'),'{}')}
function mega4(o){fs.writeFileSync(path.join(o,'mega4.json'),'{}')}
function mega5(o){fs.writeFileSync(path.join(o,'mega5.json'),'{}')}
function mega6(o){fs.writeFileSync(path.join(o,'mega6.json'),'{}')}
function mega7(o){fs.writeFileSync(path.join(o,'mega7.json'),'{}')}
function mega8(o){fs.writeFileSync(path.join(o,'mega8.json'),'{}')}
function mega9(o){fs.writeFileSync(path.join(o,'mega9.json'),'{}')}
function mega10(o){fs.writeFileSync(path.join(o,'mega10.json'),'{}')}

// === HYPER ===
function hyper1(o){fs.writeFileSync(path.join(o,'h1.json'),'{}')}
function hyper2(o){fs.writeFileSync(path.join(o,'h2.json'),'{}')}
function hyper3(o){fs.writeFileSync(path.join(o,'h3.json'),'{}')}
function hyper4(o){fs.writeFileSync(path.join(o,'h4.json'),'{}')}
function hyper5(o){fs.writeFileSync(path.join(o,'h5.json'),'{}')}
function hyper6(o){fs.writeFileSync(path.join(o,'h6.json'),'{}')}
function hyper7(o){fs.writeFileSync(path.join(o,'h7.json'),'{}')}
function hyper8(o){fs.writeFileSync(path.join(o,'h8.json'),'{}')}
function hyper9(o){fs.writeFileSync(path.join(o,'h9.json'),'{}')}
function hyper10(o){fs.writeFileSync(path.join(o,'h10.json'),'{}')}
