---
layout: home
title: freestruct
description: Frame-agnostic SEO layer for static doc sites. Configure once, inject everywhere.
---

## What is freestruct?

freestruct is a **post-build SEO injection layer** for static site generators. Configure your site meta, OG tags, Twitter cards, and JSON-LD schema once in `ssr-config.yml` — freestruct injects them into every page.

No matter which SSG you use (Jekyll, Hugo, Docusaurus, MkDocs, VitePress), freestruct works the same way.

## How it works

```
your-ssg build → freestruct inject → deploy
```

1. Your SSG builds HTML files
2. freestruct reads `ssr-config.yml` + `inject-brand.html`
3. Injects SEO meta tags into every page's `<head>`

## Key features

<div class="features-grid">
<div class="feature-card">

**Frame-agnostic**

Works with any SSG. Just configure your output directory.

</div>
<div class="feature-card">

**Single config**

All SEO in `ssr-config.yml`. No touching templates.

</div>
<div class="feature-card">

**Full SEO**

Open Graph, Twitter Cards, JSON-LD schema auto-generated.

</div>
<div class="feature-card">

**Zero dependencies**

No plugin required. Pure post-build injection.

</div>
</div>

## Supported SSGs

- **Jekyll** → output: `_site`
- **Hugo** → output: `public`
- **Docusaurus** → output: `build`
- **VitePress** → output: `.vitepress/dist`
- **MkDocs** → output: `site`

## Quick start

```bash
npm install
jekyll build && node docs/lib/inject.js
```

See [Getting Started](/getting-started) for full setup.
