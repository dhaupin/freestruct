// freestruct SEO injection - runs post-build
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OUTPUT_DIR = process.argv[2] || 'docs/_site';
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';

function inject() {
  console.log('freestruct: Loading config...');
  
  let config;
  try {
    config = yaml.load(fs.readFileSync(SSR_CONFIG, 'utf8'));
  } catch (e) {
    console.error('Error: ssr-config.yml not found');
    process.exit(1);
  }
  
  const outputDir = config.outputDir || OUTPUT_DIR;
  
  let template;
  try {
    template = fs.readFileSync(TEMPLATE, 'utf8');
  } catch (e) {
    console.error('Error: inject-brand.html not found');
    process.exit(1);
  }
  
  const files = getHtmlFiles(outputDir);
  console.log('freestruct: Injecting ' + files.length + ' files...');
  
  for (const file of files) {
    injectFile(file, config, template, outputDir);
  }
  
  console.log('freestruct: SEO injected');
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

function injectFile(filePath, config, template, outputDir) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  const pageData = extractPageData(html, config);
  
  const preserve = config.preserveExistingMeta || false;
  const replacements = {
    '{{pageTitle}}': pageData.title,
    '{{pageDescription}}': pageData.description,
    '{{pageUrl}}': pageData.url,
    '{{canonicalUrl}}': pageData.canonical,
    '{{siteUrl}}': config.site.url,
    '{{siteName}}': config.site.name,
    '{{siteDescription}}': config.site.description,
    '{{twitterUsername}}': config.twitter?.username || '',
    '{{twitterCard}}': pageData.twitterCard || config.twitter?.card || 'summary',
    '{{ogImage}}': pageData.ogImage || config.og?.image || '',
    '{{ogType}}': pageData.ogType || config.og?.type || 'website',
    '{{ogLocale}}': config.og?.locale || 'en_US',
    '{{pagePublishedTime}}': pageData.publishedTime || '',
    '{{pageAuthor}}': pageData.author || config.author?.name || '',
    '{{pageSection}}': pageData.section || '',
  };
  
  let seo = template;
  for (const key in replacements) {
    seo = seo.split(key).join(replacements[key]);
  }
  
  seo = seo.replace(/<!--[\s\S]*?-->/g, '');
  
  // Handle SEO tags based on preserveExistingMeta
  if (preserve) {
    // Preserve mode: only inject missing tags
    html = html.replace(/<\/head>/i, injectMissingSeo(html, seo.trim()) + '\n</head>');
  } else {
    // Default: remove existing and inject all
    html = removeExistingSeo(html);
    html = html.replace(/<\/head>/i, seo.trim() + '\n</head>');
  }
  
  fs.writeFileSync(filePath, html);
}

function extractPageData(html, config) {
  const title = extractTitle(html) || config.site.name;
  const description = extractDescription(html) || config.site.description;
  const pagePath = extractPath(html) || 'index';
  const pageUrl = config.site.url + pagePath;
  
  const pageConfig = extractPageConfig(html);
  
  return {
    title: pageConfig.title || title + ' | ' + config.site.name,
    description: pageConfig.description || description,
    url: pageUrl,
    canonical: pageUrl,
    ogImage: pageConfig.ogImage,
    ogType: pageConfig.ogType,
    twitterCard: pageConfig.twitterCard,
    publishedTime: pageConfig.publishedTime,
    author: pageConfig.author,
    section: pageConfig.section,
  };
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1] : null;
}

function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]+)"/i);
  return match ? match[1] : null;
}

function extractPath(html) {
  const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i);
  if (canonicalMatch) {
    return canonicalMatch[1].replace(/^https?:\/\/[^\/]+/, '');
  }
  return null;
}

function extractPageConfig(html) {
  const match = html.match(/<!--\s*freestruct:\s*(\{[^}]+\})\s*-->/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {}
  }
  return {};
}

function removeExistingSeo(html) {

// Selective injection - only add missing tags (for preserve mode)
function injectMissingSeo(html, seo) {
  const existingTags = extractExistingTags(html);
  let result = '';
  
  // Parse each line of SEO
  const seoLines = seo.split('\n').filter(l => l.trim());
  
  for (const line of seoLines) {
    // Check if this tag type already exists
    if (!tagExists(line, existingTags)) {
      result += line + '\n';
    }
  }
  
  return result;
}

function extractExistingTags(html) {
  const tags = new Set();
  // Extract name属性
  const nameMatch = html.matchAll(/<meta[^>]*name="([^"]+)"[^>]*>/gi);
  for (const m of nameMatch) tags.add(m[1]);
  // Extract property
  const propMatch = html.matchAll(/<meta[^>]*property="([^"]+)"[^>]*>/gi);
  for (const m of propMatch) tags.add(m[1]);
  // Extract twitter:*
  const twMatch = html.matchAll(/<meta[^>]*name="(twitter:[^"]+)"[^>]*>/gi);
  for (const m of twMatch) tags.add(m[1]);
  // Extract link rel="canonical"
  if (html.includes('rel="canonical"')) tags.add('canonical');
  // Extract og:site_name
  if (html.includes('og:site_name')) tags.add('og:site_name');
  
  return tags;
}

function tagExists(line, existingTags) {
  if (line.includes('name="description"') && existingTags.has('description')) return true;
  if (line.includes('property="og:') && existingTags.has(line.match(/property="([^"]+)/)[1])) return true;
  if (line.includes('name="twitter:') && existingTags.has(line.match(/name="([^"]+)/)[1])) return true;
  if (line.includes('rel="canonical"') && existingTags.has('canonical')) return true;
  if (line.includes('property="og:site_name"') && existingTags.has('og:site_name')) return true;
  if (line.includes('application/ld+json') && html.includes('application/ld+json')) return true; // simplified
  return false;
}
  const tagsToRemove = [
    /<meta[^>]*name="description"[^>]*>/gi,
    /<link[^>]*rel="canonical"[^>]*>/gi,
    /<meta[^>]*property="og:title"[^>]*>/gi,
    /<meta[^>]*property="og:description"[^>]*>/gi,
    /<meta[^>]*property="og:url"[^>]*>/gi,
    /<meta[^>]*property="og:site_name"[^>]*>/gi,
    /<meta[^>]*property="og:type"[^>]*>/gi,
    /<meta[^>]*property="og:locale"[^>]*>/gi,
    /<meta[^>]*property="og:image"[^>]*>/gi,
    /<meta[^>]*name="twitter:card"[^>]*>/gi,
    /<meta[^>]*name="twitter:title"[^>]*>/gi,
    /<meta[^>]*name="twitter:description"[^>]*>/gi,
    /<meta[^>]*name="twitter:site"[^>]*>/gi,
    /<meta[^>]*name="twitter:creator"[^>]*>/gi,
    /<meta[^>]*name="author"[^>]*>/gi,
    /<meta[^>]*name="article:published_time"[^>]*>/gi,
    /<meta[^>]*name="article:section"[^>]*>/gi,
    /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
  ];
  
  let cleaned = html;
  for (const tag of tagsToRemove) {
    cleaned = cleaned.replace(tag, '');
  }
  
  return cleaned;
}

module.exports = { inject };

if (require.main === module) {
  inject();
}
