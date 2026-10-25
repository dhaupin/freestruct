// engine/ogimage.js - per-page OG image generation (issue #22)
// Post-render OG-image generation: read each page's title/description (the
// engine already extracts both), render a branded 1200x630 image per page
// from a consumer-authored SVG template, write it into the output tree, and
// hand the per-page source to the SEO pipeline so og/twitter tags wire to
// it (missing-only intact: pages with their own og:image, or a per-page
// ogImage override, keep theirs).
//
// Rasterization honesty (the pitch's own 'hard part'): PNG cannot be made
// in pure Node. The rasterizer is the OPTIONAL npm package
// @resvg/resvg-js - loaded lazily with createRequire and loud-skipped when
// it is not installed (the run never breaks and never ships a half
// feature). Pure-Node output shape: SVG rendering is deterministic (same
// page meta -> same bytes; the build hash stays content-derived). Fonts:
// system fonts are unreliable in build sandboxes, so ogImageGeneration.font
// loads a TTF/OTF buffer straight into the rasterizer.
//
// Config shape (configDir-relative paths):
//   ogImageGeneration:
//     template: og-template.svg   # 1200x630 SVG with {{ogTitle}} /
//                                 # {{ogDescription}} / {{ogUrl}}
//     font: ./brand/brand-bold.ttf  # optional
//     width: 1200                  # optional; must be 1200x630 ratio-safe
//     height: 630                  # optional

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { escXml } from './xmllike.js';
import { pageUrlFor } from './urls.js';

const _require = createRequire(import.meta.url);

/** Directory-slug for the image filename: '/' and nested paths flatten. */
function imageSlug(page) {
  return page.slug.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'index';
}

/** Lazily resolve the optional rasterizer CLASS; null when not installed. */
function resolveRasterizer() {
  try {
    const mod = _require('@resvg/resvg-js');
    // CJS shape: { default?: Resvg, Resvg } ; ESM default handled too.
    const ctor = mod.Resvg || mod.default || mod;
    return (typeof ctor === 'function') ? ctor : null;
  } catch (e) {
    return null;
  }
}

/**
 * Validate + resolve the generation block. Returns null when it is not
 * configured; every disqualifying shape logs a loud single warning (config
 * diagnostics already handled key-name mistakes).
 */
export function resolveOgImageGeneration(config, configDir) {
  const gen = config.ogImageGeneration;
  if (gen === undefined || gen === null || gen === false) return null;
  if (typeof gen !== 'object' || Array.isArray(gen)) {
    console.log('[freestruct] config warning: ogImageGeneration must be a { template, font?, width?, height? } object');
    return null;
  }
  if (typeof gen.template !== 'string' || gen.template === '') {
    console.log('[freestruct] config warning: ogImageGeneration.template missing - no og image generation');
    return null;
  }
  const templatePath = path.resolve(configDir, gen.template);
  if (!fs.existsSync(templatePath)) {
    console.log('[freestruct] config warning: ogImageGeneration.template "'
      + gen.template + '" not found at ' + templatePath + ' - no og image generation');
    return null;
  }
  const width = Number(gen.width ?? 1200);
  const height = Number(gen.height ?? 630);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    console.log('[freestruct] config warning: ogImageGeneration width/height must be positive numbers - no og image generation');
    return null;
  }
  const fontPath = gen.font ? path.resolve(configDir, gen.font) : null;
  if (gen.font && (!fontPath || !fs.existsSync(fontPath))) {
    console.log('[freestruct] config warning: ogImageGeneration.font "'
      + gen.font + '" not found - the rasterizer will fall back to system fonts (unreliable in build sandboxes)');
    return null;
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const fontBytes = fontPath ? fs.readFileSync(fontPath) : null;
  if (/<text/i.test(template) && !fontBytes) {
    console.log('[freestruct] ogimage: template carries <text> but no font is configured - add ogImageGeneration.font so build sandboxes without system fonts do not drop titles');
  }
  return { template, templatePath, fontPath, fontBytes, width, height };
}

/**
 * Render one per-page image and hand back the tag-ready facts.
 * Returns null when the rasterizer is not installed (loud skip by caller)
 * or the SVG renders to no bytes.
 */
export function renderPageOgImage(generation, page, config, outputDir) {
  const Resvg = resolveRasterizer();
  if (!Resvg) {
    if (!renderPageOgImage._skippedLoudly) {
      renderPageOgImage._skippedLoudly = true;
      console.log('[freestruct] ogimage: @resvg/resvg-js is not installed - generation skips loudly'
        + ' (pure-Node cannot rasterize; install it with: npm install --save-dev @resvg/resvg-js)');
    }
    return null;
  }

  const pageUrl = pageUrlFor(config, page.slug);
  const displayTitle = page.title || page.rel || 'Preview';
  let svg = generation.template
    .split('{{ogTitle}}').join(escXml(displayTitle))
    .split('{{ogDescription}}').join(escXml(page.description || ''))
    .split('{{ogUrl}}').join(escXml(pageUrl));

  const fontBuffers = generation.fontBytes ? [generation.fontBytes] : undefined;
  let png;
  try {
    const rendered = new Resvg(svg, {
      fitTo: { mode: 'width', value: generation.width },
      font: fontBuffers ? { fontBuffers, loadSystemFonts: false } : { loadSystemFonts: false },
    });
    png = rendered.render().asPng();
  } catch (e) {
    console.log('[freestruct] ogimage: page ' + page.rel + ' failed to rasterize: ' + e.message);
    return null;
  }

  const name = imageSlug(page);
  const genDir = path.join(outputDir, 'og');
  if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
  const file = path.join(genDir, name + '.png');
  fs.writeFileSync(file, png);

  return {
    file,
    src: '/og/' + name + '.png',
    width: generation.width,
    height: generation.height,
    alt: displayTitle + ' - page preview image',
  };
}
