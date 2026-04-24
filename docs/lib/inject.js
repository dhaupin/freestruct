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
  
  // Remove existing SEO tags to avoid conflicts
  html = removeExistingSeo(html);
  
  // Inject before </head>
  html = html.replace(/<\/head>/i, seo.trim() + '\n</head>');
  
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
