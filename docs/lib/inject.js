// freestruct SEO injection - runs post-build
// Frame-agnostic: works with any SSG, just configure output dir
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Config
const OUTPUT_DIR = process.argv[2] || 'docs/_site';
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';

function inject() {
  console.log('🔍 freestruct: Loading config...');
  console.log('   cwd:', process.cwd());
  
  // Load config
  let config;
  try {
    config = yaml.load(fs.readFileSync(SSR_CONFIG, 'utf8'));
    console.log('   config loaded OK');
  } catch (e) {
    console.error(`Error: ${SSR_CONFIG} not found`);
    console.error('   tried:', path.join(process.cwd(), SSR_CONFIG));
    process.exit(1);
  }
  
  // Override output dir from config
  const outputDir = config.outputDir || OUTPUT_DIR;
  console.log('   output dir:', outputDir);
  
  // Load template
  let template;
  try {
    template = fs.readFileSync(TEMPLATE, 'utf8');
    console.log('   template loaded OK');
  } catch (e) {
    console.error(`Error: ${TEMPLATE} not found`);
    process.exit(1);
  }
  
  // Process HTML files
  const files = getHtmlFiles(outputDir);
  console.log(`📄 Found ${files.length} HTML files`);
  
  if (files.length === 0) {
    console.error('No HTML files found in', outputDir);
    console.error('Dir exists:', fs.existsSync(outputDir));
    if (fs.existsSync(outputDir)) {
      console.error('Contents:', fs.readdirSync(outputDir));
    }
    // Don't exit - might just be running before Jekyll builds
  }
  
  for (const file of files) {
    console.log('   injecting:', file);
    injectFile(file, config, template, outputDir);
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

function injectFile(filePath, config, template, outputDir) {
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Extract page info from HTML
  const pageTitle = extractTitle(html) || config.site.name;
  const pageDescription = extractDescription(html) || config.site.description;
  const pageUrl = '/' + path.relative(outputDir, filePath).replace(/\/index\.html$/, '/').replace(/\.html$/, '');
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
  
  // Inject before </head>
  const seoBlock = seo.trim();
  const headMatch = html.match(/<\/head>/i);
  if (headMatch) {
    html = html.replace(/<\/head>/i, seoBlock + '\n</head>');
    console.log('      injected', seoBlock.length, 'chars');
  } else {
    console.error('      no </head> found!');
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
