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
  'cacheBusting',
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
