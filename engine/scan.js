// engine/scan.js - output tree walk + page model (Phase 1.1)
// Every page freestruct touches is modeled once here: file path, alias-relative
// slug, 404 flag, and the pre-injection HTML snapshot the SEO gate needs.

import fs from 'fs';
import path from 'path';

/** Recursively list HTML files under dir (exists-checked). */
export function getHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...getHtmlFiles(fp));
    else if (item.name.endsWith('.html')) files.push(fp);
  }
  return files;
}

/**
 * Canonical slug for a file relative to the output root.
 *   index.html       -> '/'
 *   guide/index.html -> '/guide/'
 *   a&b.html         -> '/a&b'
 */
export function slugFor(rel) {
  let p = String(rel).replace(/\\/g, '/');
  if (p === '/index.html' || p === 'index.html') return '/';
  p = '/' + p;
  p = p
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '');
  return p;
}

/** 404.html at root or any directory level is the 404 pipeline's business. */
export function is404File(rel) {
  const p = String(rel).replace(/\\/g, '/');
  return p === '404.html' || p.endsWith('/404.html');
}

/** Robots noindex detection on (possibly injected) HTML. */
export function htmlIsNoindex(html) {
  const m = html.match(/<meta[^>]*name=["']robots["'][^>]*>/i);
  return Boolean(m && /noindex/i.test(m[0]));
}

/** Strip any existing robots meta (404 pages get ours, un-duplicated). */
export function stripRobotsMeta(html) {
  return html.replace(/<meta[^>]*name=["']robots["'][^>]*>/i, '');
}

/** Extract SEO candidates from raw page HTML. (kept from 0.3.x semantics) */
export function extractTitle(html) {
  const m = html.match(/<meta name="title" content="([^"]+)"/i);
  if (m) return m[1];
  const t = html.match(/<title>([^<]+)<\/title>/i);
  return t ? t[1].split(' | ')[0] : null;
}

export function extractDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]+)"/i);
  return m ? m[1] : null;
}

/**
 * Does the page already import SEO of the given type from SSG/frontmatter?
 * Used by the missing-only injection gate ('description' added in Phase 1: a
 * plain <meta name="description"> counts as covered).
 */
export function hasSeoType(html, type) {
  if (type === 'og') {
    return html.includes('property="og:title"') || html.includes('property="og:description"');
  }
  if (type === 'twitter') {
    return html.includes('name="twitter:card"') || html.includes('name="twitter:title"');
  }
  if (type === 'jsonld') {
    return html.includes('application/ld+json');
  }
  if (type === 'canonical') {
    return html.includes('rel="canonical"');
  }
  if (type === 'description') {
    return /<meta[^>]*name=["']description["']/.test(html);
  }
  return false;
}

/**
 * Snapshot every page once, before freestruct writes anything.
 * mtime is captured HERE so sitemap lastmod / RSS pubDate reflect the last
 * real content change (the SSG build), not freestruct's own decoration writes.
 */
export function buildPages(files, outputDir) {
  const pages = [];
  for (const file of files) {
    const rel = path.relative(outputDir, file);
    const html = fs.readFileSync(file, 'utf8');
    pages.push({
      file,
      rel,
      slug: slugFor(rel),
      is404: is404File(rel),
      html,
      mtime: fs.statSync(file).mtime,
      title: extractTitle(html),
      description: extractDescription(html),
    });
  }
  return pages;
}
