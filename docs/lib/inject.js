// freestruct SEO injection - runs post-build
// Frame-agnostic: works with any SSG, just configure output dir
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OUTPUT_DIR = process.argv[2] || 'docs/_site'; // override: node inject.js _site
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';

function inject() {
  console.log('🔍 freestruct: Loading config...');
  
  // Load config
  let config;
  try {
    config = yaml.load(fs.readFileSync(SSR_CONFIG, 'utf8'));
  } catch (e) {
    console.error(`Error: ${SSR_CONFIG} not found`);
    process.exit(1);
  }
  
  // Override output dir from config
  const outputDir = config.outputDir || OUTPUT_DIR;
  
  // Preserve existing meta (default: true)
  const preserve = config.preserveExistingMeta ?? true;
  
  // Load template
  let template;
  try {
    template = fs.readFileSync(TEMPLATE, 'utf8');
  } catch (e) {
    console.error(`Error: ${TEMPLATE} not found`);
    process.exit(1);
  }
  
  // Process HTML files
  const files = getHtmlFiles(outputDir);
  console.log(`📄 Found ${files.length} HTML files`);
  
  for (const file of files) {
    injectFile(file, config, template, outputDir, preserve);
  }

  // Generate sitemap if enabled
  if (config.generateSitemap !== false) {
    generateSitemap(files, config, outputDir);
  }

  // Generate 404 if enabled
  if (config.generate404 !== false) {
    generate404(config, outputDir);
  }

  console.log('✅ freestruct: SEO injected');
}

function getHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getHtmlFiles(fullPath));
    } else if (item.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function injectFile(filePath, config, template, outputDir, preserve) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Extract page info from HTML
  const pageTitle = extractTitle(html) || config.site.name;
  const pageDescription = extractDescription(html) || config.site.description;
  let pageUrl = '/' + path.relative(outputDir, filePath).replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  
  // Strip basePath if configured
  if (config.basePath) {
    pageUrl = pageUrl.replace(new RegExp('^' + config.basePath), '') || '/';
  }
  
  const canonicalUrl = config.site.url + pageUrl;
  
  // Build replacements
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
  
  // Apply replacements to template
  let seo = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    seo = seo.split(placeholder).join(value);
  }
  
  // Remove comments
  seo = seo.replace(/<!--[\s\S]*?-->/g, '');
  
  // Inject into <head>
  let injection;
  if (preserve) {
    injection = injectMissingSeo(html, seo);
  } else {
    removeExistingSeo(html);
    injection = seo;
  }
  
  // Add source comment and inject
  html = html.replace(/<\/head>/i, injection + '\n<!-- injected by freestruct: https://github.com/dhaupin/freestruct -->\n</head>');
  
  fs.writeFileSync(filePath, html);
}

// Selective injection - only add missing tags
function injectMissingSeo(html, seo) {
  const existing = getExistingTags(html);
  let tags = '';
  for (const line of seo.split('\n')) {
    if (!line.trim()) continue;
    if (line.includes('name="description"') && existing.has('description')) continue;
    if (line.includes('property="og:') && existing.has(line.match(/property="([^"]+)/)?.[1])) continue;
    if (line.includes('name="twitter:') && existing.has(line.match(/name="([^"]+)/)?.[1])) continue;
    if (line.includes('rel="canonical"') && existing.has('canonical')) continue;
    tags += line + '\n';
  }
  return tags;  // Return just the tags, not html.replace()
}

function getExistingTags(html) {
  const tags = new Set();
  for (const m of html.matchAll(/<meta[^>]*name="([^"]+)"[^>]*>/gi)) tags.add(m[1]);
  for (const m of html.matchAll(/<meta[^>]*property="([^"]+)"[^>]*>/gi)) tags.add(m[1]);
  if (html.includes('rel="canonical"')) tags.add('canonical');
  return tags;
}

// Remove existing SEO tags
function removeExistingSeo(html) {
  html = html.replace(/<meta[^>]*name="description"[^>]*>/gi, '');
  html = html.replace(/<link[^>]*rel="canonical"[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*property="og:[^"]+"[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*name="twitter:[^"]+"[^>]*>/gi, '');
  return html;
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].split(' | ')[0] : null;
}

function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]+)"/i);
  return match ? match[1] : null;
}

// Generate sitemap.xml
function generateSitemap(files, config, outputDir) {
  let urls = '';
  
  for (const file of files) {
    const pageUrl = '/' + path.relative(outputDir, file).replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    
    // Skip 404 page (both generated and any existing)
    if (pageUrl === '/404' || pageUrl === '/404.html') continue;
    
    // Strip basePath if configured
    let cleanUrl = pageUrl;
    if (config.basePath) {
      cleanUrl = pageUrl.replace(new RegExp('^' + config.basePath), '') || '/';
    }
    
    const fullUrl = config.site.url + cleanUrl;
    urls += `  <url>
    <loc>${fullUrl}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap);
  console.log('📄 freestruct: sitemap.xml generated');
}

// Generate 404.html
function generate404(config, outputDir) {
  const pageUrl = config.site.url;
  
  // Use custom 404 template if it exists in output dir
  const custom404Path = path.join(outputDir, '404.html');
  if (fs.existsSync(custom404Path)) {
    console.log('📄 freestruct: using custom 404.html');
    return;
  }
  
  const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 - Page Not Found | ${config.site.name}</title>
  <meta name="description" content="Page not found">
  <meta name="robots" content="noindex, nofollow">
  <meta property="og:title" content="404 - Page Not Found">
  <meta property="og:description" content="Page not found">
  <meta property="og:url" content="${pageUrl}/404.html">
  <meta property="og:type" content="website">
  <link rel="canonical" href="${pageUrl}/404.html">
  <!-- injected by freestruct: https://github.com/dhaupin/freestruct -->
</head>
<body>
  <div style="text-align:center;padding:4rem;font-family:system-ui,sans-serif;">
    <h1 style="font-size:4rem;margin:0;">404</h1>
    <p style="font-size:1.5rem;">Page not found</p>
    <p><a href="/" style="color:#2563eb;">← Go home</a></p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, '404.html'), notFound);
  console.log('📄 freestruct: 404.html generated');
}

module.exports = { inject };

if (require.main === module) {
  inject();
}
