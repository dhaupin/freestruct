// freestruct SEO injection - runs post-build
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Config
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';
const OUTPUT_DIR = 'docs/_site';

function inject() {
  console.log('🔍 freestruct: Loading config...');
  
  // Load config
  let config;
  try {
    const configPath = path.join(process.cwd(), SSR_CONFIG);
    config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`Error: ${SSR_CONFIG} not found`);
    process.exit(1);
  }
  
  // Load template
  let template;
  try {
    const templatePath = path.join(process.cwd(), TEMPLATE);
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (e) {
    console.error(`Error: ${TEMPLATE} not found`);
    process.exit(1);
  }
  
  // Process HTML files
  const files = getHtmlFiles(OUTPUT_DIR);
  console.log(`📄 Found ${files.length} HTML files`);
  
  for (const file of files) {
    injectFile(file, config, template);
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

function injectFile(filePath, config, template) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Extract page info from HTML
  const pageTitle = extractTitle(html) || config.site.name;
  const pageDescription = extractDescription(html) || config.site.description;
  const pageUrl = '/' + path.relative(OUTPUT_DIR, filePath).replace(/^docs\/_site\//, '').replace(/\/index\.html$/, '/').replace(/\.html$/, '');
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
  if (html.includes('<!-- freestruct SEO -->')) {
    html = html.replace(/<!-- freestruct SEO -->[\s\S]*?<!-- \/freestruct SEO -->/, seo);
  } else {
    html = html.replace(/<\/head>/i, seo + '\n</head>');
  }
  
  fs.writeFileSync(filePath, html);
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
