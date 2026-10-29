// engine/indexnow.js - IndexNow key-file emission + submission (issue #19)
// IndexNow is a one-POST notify protocol (Bing + Seznam + Yandex), and this
// engine is the component that already owns the sitemap, so the fit is
// natural: key file into the output dir (the keyLocation contract), a
// `freestruct indexnow` subcommand that reads the baked sitemap.xml and
// POSTs the URL list. Honesty contract: submission only makes sense AFTER
// the output is deployed live (keyLocation must resolve) - docs say so; the
// command surfaces HTTP status codes in its output; --dry-run prints the
// request body without touching the network for CI.

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { decodeEntities } from './scan.js';

export const INDEXNOW_API = 'https://api.indexnow.org/indexnow';
const KEYFILE_HIDDEN = ['indexnow-key.txt'];

// ---------- key resolution ----------

/** 32 lowercase hex chars is the documented IndexNow key shape. */
export function isValidIndexNowKey(key) {
  return typeof key === 'string' && /^[a-f0-9]{32}$/.test(key);
}

/**
 * Resolve the IndexNow key for a run.
 *   indexNow.key (config, 32-hex)   wins
 *   indexNow: true                  reads configDir/indexnow-key.txt, or
 *                                   generates one and PERSISTS it (generate-
 *                                   once: the same key across runs keeps the
 *                                   keyLocation stable at the search engines)
 * Rotating? Change the config key or delete indexnow-key.txt - loudly logged.
 * Returns { key, source } or null when IndexNow is not configured.
 */
export function resolveIndexNowKey(config, configDir) {
  const cfg = config.indexNow;
  if (cfg === undefined || cfg === null || cfg === false) return null;
  if (typeof cfg === 'string' || typeof cfg === 'object') {
    const key = typeof cfg === 'string' ? cfg : cfg.key;
    if (key !== undefined && key !== null) {
      if (!isValidIndexNowKey(key)) return null; // config diagnostics already warned
      return { key, source: 'config' };
    }
  }
  const persistPath = path.join(configDir, 'indexnow-key.txt');
  if (fs.existsSync(persistPath)) {
    const key = fs.readFileSync(persistPath, 'utf8').trim();
    if (isValidIndexNowKey(key)) return { key, source: 'persisted (' + KEYFILE_HIDDEN[0] + ')' };
  }
  const key = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(persistPath, key + '\n', 'utf8');
  console.log('[freestruct] indexnow: generated a new key and persisted it to ' + persistPath
    + ' (generate-once: commit this file so the keyLocation stays stable across runs)');
  return { key, source: 'generated' };
}

/** Emit <key>.txt into the output dir (the keyLocation file search engines probe). */
export function emitIndexNowKeyFile(key, outputDir) {
  const keyFile = path.join(outputDir, key + '.txt');
  fs.writeFileSync(keyFile, key + '\n', 'utf8');
  console.log('[freestruct] indexnow: key file written: ' + key + '.txt (deploy it live - keyLocation must resolve)');
  return keyFile;
}

// ---------- submission ----------

/** Read the baked sitemap.xml and return its URL list (null when absent/empty). */
export function readSitemapUrls(outputDir) {
  const sitemapPath = path.join(outputDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return null;
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  // The sitemap's <loc> values are XML-escaped by the writer (& -> &amp;), so
  // they must decode back to the real URL before submission - posting the
  // escaped form asks the engines to crawl a URL that does not exist.
  const urls = (sitemap.match(/<loc>([\s\S]*?)<\/loc>/g) || [])
    .map(e => decodeEntities(e.replace(/<\/?loc>/g, '').trim()))
    .filter(Boolean);
  return urls.length > 0 ? urls : null;
}

/**
 * POST the sitemap URL list to api.indexnow.org. Returns the HTTP status so
 * the caller can surface it (202 = accepted). `dryRun` skips the network.
 */
export async function submitIndexNow({ config, configDir, outputDir, dryRun }) {
  const resolved = resolveIndexNowKey(config, configDir);
  if (!resolved) {
    console.log('[freestruct] indexnow: not configured (set indexNow in the config)');
    return { ok: false, status: null, reason: 'not-configured' };
  }
  if (!isValidIndexNowKey(config.indexNow?.key) && (config.indexNow === undefined)) {
    console.log('[freestruct] indexnow: no key resolved');
    return { ok: false, status: null, reason: 'no-key' };
  }

  const urls = readSitemapUrls(outputDir);
  if (!urls) {
    console.log('[freestruct] indexnow: no sitemap.xml with <loc> entries in ' + outputDir
      + ' - run freestruct first (indexnow reads the baked sitemap)');
    return { ok: false, status: null, reason: 'no-sitemap' };
  }

  let host;
  try { host = new URL(config.site.url).host; } catch (e) {
    console.log('[freestruct] indexnow: site.url is not parseable - cannot derive host');
    return { ok: false, status: null, reason: 'bad-site-url' };
  }

  const payload = {
    host,
    key: resolved.key,
    urlList: urls,
    keyLocation: config.site.url.replace(/\/$/, '') + '/' + resolved.key + '.txt',
  };

  console.log('[freestruct] indexnow: submitting ' + urls.length + ' URL(s) to ' + INDEXNOW_API
    + ' (key source: ' + resolved.source + ')');
  if (dryRun) {
    console.log('[freestruct] indexnow: --dry-run, request body:');
    console.log(JSON.stringify(payload, null, 2));
    return { ok: true, status: 'dry-run', reason: 'dry-run' };
  }

  let res;
  try {
    res = await fetch(INDEXNOW_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('[freestruct] indexnow: request failed: ' + e.message);
    return { ok: false, status: null, reason: 'network-error' };
  }

  console.log('[freestruct] indexnow: HTTP ' + res.status
    + (res.status === 200 || res.status === 202 ? ' (accepted)' : ' (NOT accepted - the engines surface failures; check key file live deployment)'));
  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text().catch(() => '');
    if (body) console.log('[freestruct] indexnow: response: ' + body.slice(0, 300));
  }
  return { ok: res.status === 200 || res.status === 202, status: res.status, reason: 'http' };
}
