// engine/linkcheck.js - internal link validation (Phase 1.1 split)
// Report-only by default; --strict (see bin) consumes the returned broken list.

import fs from 'fs';
import path from 'path';

/**
 * Check internal links across every page. Returns [{file, link}] for broken
 * targets and prints the human-readable report (same output as 0.4.x).
 */
export function checkLinks(files, outputDir) {
  const broken = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const baseDir = path.dirname(file);

    const linkRegex = /href="([^"#]+)(?:#[^"]*)?"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1];

      // Skip external, mailto, tel
      if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('//')) continue;

      const absPath = path.join(baseDir, link);
      const normalized = path.normalize(absPath);

      let checkPath = normalized;
      if (fs.existsSync(path.join(normalized, 'index.html'))) {
        checkPath = path.join(normalized, 'index.html');
      }

      if (normalized.endsWith('.html') && !fs.existsSync(normalized)) {
        broken.push({ file: path.relative(outputDir, file), link });
      }
    }
  }

  if (broken.length > 0) {
    console.log('Link check: ' + broken.length + ' broken links found');
    for (const b of broken.slice(0, 10)) {
      console.log('  BROKEN: ' + b.file + ' -> ' + b.link);
    }
  } else {
    console.log('Link check: All links OK');
  }
  return broken;
}
