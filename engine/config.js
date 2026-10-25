// engine/config.js - config discovery, schema and validation (Phase 2)
// Discovery order (owner-ratified rename): freestruct.config.yml first, with
// back-compat reads of the old ssr-config.yml name.
// Config-first, no magic: unknown flags and retired flags produce loud
// [freestruct] diagnostics; fatal errors exit (CLI may opt out via --tolerant).

import fs from 'fs';
import path from 'path';
import { load as yamlLoad } from 'js-yaml';

export class ConfigError extends Error {}

export const CONFIG_NEW = ['freestruct.config.yml'];
export const CONFIG_LEGACY = ['ssr-config.yml'];

// Every flag freestruct understands. Phase 2 contract: documented, schema-
// checked, warn-and-continue on the unknown; nothing dies silently in config
// files with 'docs said I could do this'.
export const KNOWN_CONFIG_KEYS = Object.freeze([
  'site', 'twitter', 'og', 'author', 'jsonLd', 'basePath', 'outputDir', 'minify', 'runHooks',
  'generateSitemap', 'generateFeed', 'generate404', 'generateRobots',
  'readingTime', 'lastModified', 'lazyLoad', 'linkCheck', 'searchIndex',
  'cacheBusting', 'hooks', 'indexNow', 'ogImageGeneration',
  'search', 'breadcrumb', 'verification', 'llms', 'locales', 'article',
]);

// Flags that EXISTED and no longer do anything. We warn loudly, never guess.
export const RETIRED_CONFIG_KEYS = Object.freeze([
  { key: 'preserveExistingMeta', note: 'freestruct only ever injects what is missing (missing-only gate is unconditional); remove this key' },
  { key: 'generateNav', note: 'nav generation lives in your SSG or the docs frame, not freestruct; remove this key' },
]);

export const RETIRED_CACHE_KEYS = Object.freeze([
  { key: 'hash', note: 'dead since 0.4.x (hash is always generated); remove this key' },
]);

/** Which top-level and nested keys are known, for diagnostics. */
const KNOWN_CACHE_KEYS = ['assetQueryParam', 'hashInCanonicalUrl', 'purge'];

/** Walk upward from cwd looking for freestruct.config.yml (then ssr-config.yml). */
export function findConfigPath(cwd = process.cwd()) {
  let dir = path.resolve(cwd);
  for (;;) {
    for (const name of [...CONFIG_NEW, ...CONFIG_LEGACY]) {
      const candidate = path.join(dir, 'docs', name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Collect human-readable diagnostics (warnings) for a parsed config. */
export function collectConfigDiagnostics(config, configName) {
  const warnings = [];
  const labels = { others: configName || 'config' };

  for (const key of Object.keys(config)) {
    if (KNOWN_CONFIG_KEYS.includes(key)) continue;
    const retired = RETIRED_CONFIG_KEYS.find(r => r.key === key);
    if (retired) {
      warnings.push(`retired config key "${key}" has no effect: ${retired.note}`);
    } else {
      warnings.push(`unknown config key "${key}" (typo? see the config reference in README.md)`);
    }
  }

  if (config.cacheBusting && typeof config.cacheBusting === 'object') {
    for (const key of Object.keys(config.cacheBusting)) {
      if (KNOWN_CACHE_KEYS.includes(key)) continue;
      const retired = RETIRED_CACHE_KEYS.find(r => r.key === key);
      if (retired) {
        warnings.push(`retired cacheBusting.${key} has no effect: ${retired.note}`);
      } else {
        warnings.push(`unknown cacheBusting key "${key}"`);
      }
    }
  }

  if (config.site) {
    if (config.site.name === undefined) warnings.push('site.name missing - page titles will compose without a site name');
    if (config.site.url === undefined) warnings.push('site.url missing - canonical/sitemap/feed urls will be broken');
  }

  // og.image shape (issue #20): the back-compat string form is always fine;
  // the object form accepts { src, width, height, alt, allowSvg }. Wrong
  // shapes warn loudly here and the engine keeps its behavior honest (no
  // image ships when src is not a usable string).
  const ogImageShape = config.og?.image;
  if (ogImageShape && typeof ogImageShape === 'string' && ogImageShape !== ''
      && /\.svg$/i.test(ogImageShape.split(/[?#]/)[0])) {
    warnings.push('og.image src "' + ogImageShape + '" is an SVG: most social scrapers cannot render it and the share preview blanks (ship a raster image, or switch to the object form { src: ..., allowSvg: true } to accept it)');
  }
  if (ogImageShape !== undefined && ogImageShape !== null && typeof ogImageShape === 'object') {
    if (Array.isArray(ogImageShape)) {
      warnings.push('og.image must be a string or a { src, width, height, alt } object, not an array - no image ships');
    } else {
      if (typeof ogImageShape.src !== 'string' || ogImageShape.src === '') {
        warnings.push('og.image object is missing a string src - no image ships (the plain string form still works)');
      } else if (/\.svg$/i.test(String(ogImageShape.src).split(/[?#]/)[0])
          && ogImageShape.allowSvg !== true) {
        warnings.push('og.image src "' + ogImageShape.src + '" is an SVG: most social scrapers cannot render it and the share preview blanks (ship a raster image, or set allowSvg: true to accept it)');
      }
      const KNOWN_OGIMAGE_KEYS = ['src', 'width', 'height', 'alt', 'allowSvg'];
      const unknownOg = Object.keys(ogImageShape).filter(k => !KNOWN_OGIMAGE_KEYS.includes(k));
      if (unknownOg.length > 0) {
        warnings.push('unknown og.image companion key(s): "' + unknownOg.join('", "') + '" (known: ' + KNOWN_OGIMAGE_KEYS.join(', ') + ')');
      }
      if (ogImageShape.width !== undefined && ogImageShape.width !== '') {
        const w = Number(ogImageShape.width);
        if (!Number.isFinite(w) || w <= 0) warnings.push('og.image.width must be a positive number - it will be dropped');
      }
      if (ogImageShape.height !== undefined && ogImageShape.height !== '') {
        const h = Number(ogImageShape.height);
        if (!Number.isFinite(h) || h <= 0) warnings.push('og.image.height must be a positive number - it will be dropped');
      }
      if (ogImageShape.alt !== undefined && typeof ogImageShape.alt !== 'string' && typeof ogImageShape.alt !== 'number') {
        warnings.push('og.image.alt must be a string or number - it will be dropped');
      }
      if (ogImageShape.allowSvg !== undefined && typeof ogImageShape.allowSvg !== 'boolean') {
        warnings.push('og.image.allowSvg must be a boolean');
      }
    }
  }

  // hooks shape (issue #21): hooks is an object keyed by hook seam; each
  // seam takes one string command or a list of them. Unknown seams and
  // non-string entries warn loudly here, and the runner treats both
  // honestly (non-strings are skipped, unknown seams have no runner).
  if (config.hooks !== undefined && (typeof config.hooks !== 'object' || config.hooks === null || Array.isArray(config.hooks))) {
    warnings.push('hooks must be a { postBuild: [...] } object, not ' + (Array.isArray(config.hooks) ? 'an array' : typeof config.hooks));
  } else if (config.hooks) {
    const KNOWN_HOOK_SEAMS = ['postBuild'];
    for (const seam of Object.keys(config.hooks)) {
      if (KNOWN_HOOK_SEAMS.includes(seam)) continue;
      warnings.push('unknown hooks seam "' + seam + '" (known: ' + KNOWN_HOOK_SEAMS.join(', ') + ')');
    }
    const postBuild = config.hooks.postBuild;
    if (postBuild !== undefined && !Array.isArray(postBuild) && typeof postBuild !== 'string') {
      warnings.push('hooks.postBuild must be a string command or a list of string commands');
    } else if (Array.isArray(postBuild)) {
      for (const entry of postBuild) {
        if (typeof entry !== 'string' || entry === '') {
          warnings.push('every hooks.postBuild entry must be a non-empty string command');
          break;
        }
      }
    }
  }

  // indexNow shape (issue #19): true (generate-once-and-persist) or
  // { key: '<32-hex>' }. A wrong-shaped key warns here and the indexnow
  // subcommand refuses it too - no silently-dead submission command.
  if (config.indexNow !== undefined && config.indexNow !== null && config.indexNow !== false) {
    if (config.indexNow === true) {
      // generate-once-and-persist path: shape is fine
    } else if (typeof config.indexNow === 'string' || typeof config.indexNow === 'object') {
      const key = typeof config.indexNow === 'string' ? config.indexNow : config.indexNow.key;
      if (!/^[a-f0-9]{32}$/.test(String(key || ''))) {
        warnings.push('indexNow key must be 32 lowercase hex chars (the IndexNow key contract) - the key file will not ship');
      }
      if (typeof config.indexNow === 'object') {
        const unknownIdx = Object.keys(config.indexNow).filter(k => k !== 'key');
        if (unknownIdx.length > 0) {
          warnings.push('unknown indexNow key(s): "' + unknownIdx.join('", "') + '"');
        }
      }
    } else {
      warnings.push('indexNow must be true or { key: "<32-hex>" }');
    }
  }

  // ogImageGeneration shape (issue #22): a { template, font?, width?,
  // height? } object. Runtime resolution (engine/ogimage.js) warns on
  // missing templates; here we catch the key-level shape mistakes.
  if (config.ogImageGeneration !== undefined && (typeof config.ogImageGeneration !== 'object' || config.ogImageGeneration === null || Array.isArray(config.ogImageGeneration))) {
    warnings.push('ogImageGeneration must be a { template, font, width, height } object, not ' + (Array.isArray(config.ogImageGeneration) ? 'an array' : typeof config.ogImageGeneration));
  }

  // jsonLd map shape (issue #25): the legacy forms are a single object or a
  // list; the scoped map form keys every entry by a slug glob whose value is
  // an LD+JSON object or a list of them. Wrong shapes warn loudly; the
  // runner skips bad values per block rather than dropping the global set.
  if (config.jsonLd !== undefined && !Array.isArray(config.jsonLd) && config.jsonLd !== null) {
    if (typeof config.jsonLd !== 'object') {
      warnings.push('jsonLd must be an LD+JSON object, a list of them, or a slug-glob map of them');
    } else if (Object.keys(config.jsonLd).length > 0) {
      const pathish = (k) => /^\//.test(k) || k === '*' || k === '**' || k.includes('*');
      const keys = Object.keys(config.jsonLd);
      const allPathish = keys.every(pathish);
      const anyPathish = keys.some(pathish);
      if (allPathish) {
        // scoped map: validate each value's shape up front
        for (const key of keys) {
          const v = config.jsonLd[key];
          const blocks = Array.isArray(v) ? v : [v];
          if (blocks.length === 0 || blocks.some((b) => !b || typeof b !== 'object' || Array.isArray(b))) {
            warnings.push('jsonLd "' + key + '" must map to an LD+JSON object or a list of them');
          }
        }
      } else if (anyPathish) {
        warnings.push('jsonLd mixes slug-glob keys with schema-object keys - either use the scoped map form (every key a glob) or the legacy object form; the run skips no block but reads it as a legacy object');
      }
    }
  }

  // og.scoped shape (issue #25 follow-on): a slug-glob map whose values take
  // the og.image shapes (string, or the structured object form).
  if (config.og?.scoped !== undefined && (typeof config.og.scoped !== 'object' || config.og.scoped === null || Array.isArray(config.og.scoped))) {
    warnings.push('og.scoped must be a slug-glob map of og.image values (string or { src, width, height, alt, allowSvg }), not ' + (Array.isArray(config.og.scoped) ? 'an array' : typeof config.og.scoped));
  } else if (config.og?.scoped && typeof config.og.scoped === 'object') {
    for (const [key, v] of Object.entries(config.og.scoped)) {
      if (!/^\//.test(key) && key !== '*' && !key.includes('*')) {
        warnings.push('og.scoped keys must be slug globs (starting with "/", optionally with * / **) - skipping "' + key + '"');
      }
      if (v === null || Array.isArray(v) || (typeof v !== 'string' && typeof v !== 'object')) {
        warnings.push('og.scoped "' + key + '" must be an og image string or a { src, width, height, alt, allowSvg } object (a list of images is not a variant - one page matches one image) - no image ships from this key');
      }
    }
  }

  // Per-page JSON-LD type override shape (SEO-gap pass): a slug-glob map
  // keyed like og.scoped; the page-level value decides WHAT article type a
  // page gets when it does not already carry LD+JSON.
  if (config.article?.scoped !== undefined && (typeof config.article.scoped !== 'object' || config.article.scoped === null || Array.isArray(config.article.scoped))) {
    warnings.push('article.scoped must be a slug-glob map of LD+JSON type strings ("Article", "TechArticle", "NewsArticle"), not ' + (Array.isArray(config.article.scoped) ? 'an array' : typeof config.article.scoped));
  } else if (config.article?.scoped && typeof config.article.scoped === 'object') {
    for (const [key, v] of Object.entries(config.article.scoped)) {
      if (!/^\//.test(key) && !key.includes('*')) {
        warnings.push('article.scoped keys must be slug globs (starting with "/", optionally with * / **) - skipping "' + key + '"');
      }
      if (!['Article', 'TechArticle', 'NewsArticle'].includes(String(v))) {
        warnings.push('article.scoped "' + key + '" must be "Article", "TechArticle" or "NewsArticle" (got "' + String(v) + '") - the page gets no article type');
      }
    }
  }

  // search shape (SEO-gap pass): { url: ... } - the SearchAction target.
  // The {search_term_string} placeholder in the URL is the schema.org
  // contract; anything else turns the potentialAction block into a broken
  // search target, so the shape diagnostic warns below.
  if (config.search !== undefined && config.search !== null && (typeof config.search !== 'object' || Array.isArray(config.search))) {
    warnings.push('search must be a { url: "..." } object');
  } else if (config.search?.url !== undefined) {
    if (typeof config.search.url !== 'string' || config.search.url === '') {
      warnings.push('search.url must be a non-empty string URL with a {search_term_string} placeholder');
    } else if (!config.search.url.includes('{search_term_string}')) {
      warnings.push('search.url must contain the {search_term_string} placeholder or the SearchAction block is a broken search target - omitted');
    }
  }

  // breadcrumb shape (SEO-gap pass): true opts the page into auto-built
  // BreadcrumbList LD+JSON from the page's own position in the URL tree.
  if (config.breadcrumb !== undefined && typeof config.breadcrumb !== 'boolean') {
    warnings.push('breadcrumb must be true (auto BreadcrumbList from URL structure)');
  }

  // verification shape (SEO-gap pass): map of provider -> content value.
  if (config.verification !== undefined && config.verification !== null && (typeof config.verification !== 'object' || Array.isArray(config.verification))) {
    warnings.push('verification must be an object of provider -> verification-string (google, bing, yandex, pinterest)');
  } else if (config.verification) {
    const KNOWN_VERIFICATION_PROVIDERS = ['google', 'bing', 'yandex', 'pinterest'];
    for (const [provider, v] of Object.entries(config.verification)) {
      if (!KNOWN_VERIFICATION_PROVIDERS.includes(provider)) {
        warnings.push('unknown verification provider "' + provider + '" (known: ' + KNOWN_VERIFICATION_PROVIDERS.join(', ') + ') - no meta ships for it');
      } else if (typeof v !== 'string' || v === '') {
        warnings.push('verification.' + provider + ' must be a non-empty string verification code - no meta ships for it');
      }
    }
  }

  // llms shape (SEO-gap pass): true opts the run into emitting llms.txt in
  // the output dir (the AI-consumable docs summary convention).
  if (config.llms !== undefined && typeof config.llms !== 'boolean') {
    warnings.push('llms must be true (emit llms.txt in the output dir)');
  }

  // locales shape (SEO-gap pass): map of slug glob -> language code. Pages
  // that match a pattern get hreflang alternates pointing at its siblings.
  if (config.locales !== undefined && config.locales !== null && (typeof config.locales !== 'object' || Array.isArray(config.locales))) {
    warnings.push('locales must be a map of slug glob -> language code (e.g. "/de/**: de"), not ' + (Array.isArray(config.locales) ? 'an array' : typeof config.locales));
  } else if (config.locales && typeof config.locales === 'object') {
    for (const [pattern, lang] of Object.entries(config.locales)) {
      if (typeof lang !== 'string' || lang === '') {
        warnings.push('locales "' + pattern + '" must map to a non-empty language code string');
      }
    }
  }

  for (const w of warnings) {
    console.log('[freestruct] config warning: ' + w);
  }
  return warnings;
}

/**
 * Load + validate the config. Throws ConfigError with consumer-facing
 * messages (the CLI prints and exits; --tolerant may downgrade).
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    throw new ConfigError(`Config not found: docs/freestruct.config.yml (legacy docs/ssr-config.yml also accepted; searched upward from ${cwd})`);
  }

  let parsed;
  try {
    parsed = yamlLoad(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    throw new ConfigError('Config parse error: ' + e.message);
  }

  if (!parsed || !parsed.site) {
    throw new ConfigError('Invalid config: must have site section');
  }
  if (!parsed.site.url || !parsed.site.name) {
    throw new ConfigError('Invalid config: site.url and site.name are required');
  }

  // Documented env override (ssr-config.md "Environment Overrides"):
  // FREESTRUCT_URL replaces site.url for staging-style CI runs. Announced,
  // never silent, and it lands before every canonical/sitemap/feed consumer.
  if (process.env.FREESTRUCT_URL) {
    console.log('[freestruct] env override: site.url -> ' + process.env.FREESTRUCT_URL);
    parsed.site.url = process.env.FREESTRUCT_URL;
  }

  const configName = path.basename(configPath);
  collectConfigDiagnostics(parsed, configName);

  return {
    config: parsed,
    configPath,
    configName,
    configDir: path.dirname(configPath),
  };
}
