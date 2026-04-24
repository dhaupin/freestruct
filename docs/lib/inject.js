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
  if (html.includes('<!-- freestruct SEO -->')) {
    injection = seo;
  } else if (preserve) {
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

module.exports = { inject };

if (require.main === module) {
  inject();
}
