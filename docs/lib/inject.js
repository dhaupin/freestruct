// freestruct SEO injection - runs post-build
// Adds build hash for CDN cache busting
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const https = require('https');

const OUTPUT_DIR = process.argv[2] || 'docs/_site';
const SSR_CONFIG = 'docs/ssr-config.yml';
const TEMPLATE = 'docs/_includes/inject-brand.html';

// CloudFlare API cache purge
async function purgeCloudFlare(config) {
  if (config.cacheBusting?.provider !== 'cloudflare') return;
  if (!config.cacheBusting?.apiToken || !config.cacheBusting?.zoneId) {
    console.log('CloudFlare: missing apiToken or zoneId');
    return;
  }
  const data = JSON.stringify({ files: [config.site.url + '/*'] });
  const opts = {
    hostname: 'api.cloudflare.com',
    path: '/client/v4/zones/' + config.cacheBusting.zoneId + '/purge_cache',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.cacheBusting.apiToken,
      'Content-Length': data.length,
    },
  };
  return new Promise((resolve) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(res.statusCode === 200 ? 'CloudFlare purged' : 'CF failed: ' + body);
        resolve();
      });
    });
    req.on('error', e => { console.log('CF error:', e.message); resolve(); });
    req.write(data);
    req.end();
  });
}

function inject() {
  console.log('freestruct: Loading config...');
  let config = yaml.load(fs.readFileSync(SSR_CONFIG, 'utf8'));
  const outputDir = config.outputDir || OUTPUT_DIR;
  const template = fs.readFileSync(TEMPLATE, 'utf8');

  // Build hash for cache busting
  const buildHash = crypto.createHash('sha1')
    .update(JSON.stringify(config) + Date.now())
    .digest('hex').slice(0, 8);
  console.log('Build: ' + buildHash);

  const files = getHtmlFiles(outputDir);
  console.log('Found ' + files.length + ' HTML files');

  for (const file of files) {
    if (file.endsWith('404.html') || file.endsWith('404/index.html')) continue;
    injectFile(file, config, template, outputDir, buildHash);
  }

  if (config.generate404 !== false) generate404(config, outputDir, buildHash);
  if (config.generateSitemap !== false) generateSitemap(files, config, outputDir);
  if (config.cacheBusting?.provider === 'cloudflare') purgeCloudFlare(config);

  console.log('freestruct: Done (' + buildHash + ')');
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
  const canonicalUrl = config.site.url + pageUrl;

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

  // Version tag for cache invalidation
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