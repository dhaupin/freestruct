// engine/llms.js - llms.txt emission (the SEO-gap pass, config.llms)
// The AI-consumable docs-summary convention (llmstxt.org shape): one H1, a
// blockquote tagline, then a Docs section listing every indexable page's
// title, absolute URL and description. Natural to this engine: the scan
// pass already carries every page's slug/title/description and the run
// already owns the indexable (non-noindex) page set - zero new scanning.
// Generated-only: never overwrites, same contract as sitemap/feed/robots.

import fs from 'fs';
import path from 'path';
import { pageUrlFor } from './urls.js';

/**
 * One line of plain text, whatever it was given: a newline (or CR) inside a
 * title/description would split a list entry into two, silently corrupting
 * the summary's shape, and an XML-era control character would ride into the
 * plain-text file as garbage. Bad bytes drop, whitespace collapses.
 */
function oneline(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * A markdown link LABEL: `[` and `]` inside it would close the label early,
 * so the emitted link renders as broken text (a title like 'Foo] bar' or a
 * '[preview]' tag produced '- [Foo] bar](url)' - the URL spilled into the
 * prose and the link broke). Escape the brackets, and the backslash itself,
 * so the label always renders as the literal title.
 */
function mdLabel(value) {
  return oneline(value).replace(/([\\\[\]])/g, '\\$1');
}

/**
 * Write llms.txt into the output dir. Pages only: indexable = non-404,
 * non-noindex (the same gate sitemap/feed honor, so noindex stays honored
 * everywhere). Missing-only: an existing llms.txt (hand-rolled or
 * SSG-written) is never touched.
 */
export function generateLlms(indexablePages, config, outputDir) {
  const target = path.join(outputDir, 'llms.txt');
  if (fs.existsSync(target)) {
    console.log('[freestruct] llms.txt exists - leaving it untouched');
    return null;
  }
  const lines = [];
  lines.push('# ' + oneline(config.site.name));
  if (config.site.description) lines.push('', '> ' + oneline(config.site.description));
  lines.push('', '## Docs', '');
  for (const page of indexablePages) {
    const url = pageUrlFor(config, page.slug);
    const title = mdLabel(page.title || page.slug);
    const desc = page.description ? ': ' + oneline(page.description) : '';
    lines.push('- [' + title + '](' + url + ')' + desc);
  }
  fs.writeFileSync(target, lines.join('\n') + '\n');
  const count = indexablePages.length;
  console.log('[freestruct] llms.txt: emitted for ' + count + ' page(s)');
  return target;
}
