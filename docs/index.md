---
layout: landing
title: Freestruct - post-build SEO for static doc sites
description: One command after any SSG builds - every page of your docs gets full SEO meta, a real sitemap, an RSS feed, a noindex 404 and cache-busted assets.
nav_order: 0
---

<div class="lp" markdown="1">

<div class="lp-hero" markdown="1">
<span class="lp-eyebrow">Post-build SEO layer</span>

# Your docs deserve real SEO. <span class="lp-grad">One command after the build.</span>

<p class="lp-lede">Freestruct runs after any static site generator - Jekyll, Hugo, Astro, you name it - and finishes the SEO every page still needs: complete meta, a real <code>sitemap.xml</code>, <code>robots.txt</code>, an RSS feed, a noindex <code>404.html</code>, cache-busted assets and validated links. Your build stays untouched. No plugins, no template edits.</p>

<div class="lp-cta">
<a class="lp-btn lp-btn-primary" href="/getting-started">Get started</a>
<a class="lp-btn lp-btn-ghost" href="https://github.com/dhaupin/freestruct" target="_blank" rel="noopener">View on GitHub</a>
</div>

<div class="lp-install"><span class="lp-prompt">$</span><code>npm i -D freestruct &amp;&amp; npx freestruct</code></div>
</div>

<div class="lp-ssgs">
<span class="lp-ssg">Jekyll</span>
<span class="lp-ssg">Hugo</span>
<span class="lp-ssg">Docusaurus</span>
<span class="lp-ssg">MkDocs</span>
<span class="lp-ssg">VitePress</span>
<span class="lp-ssg">Astro</span>
<span class="lp-ssg">Eleventy</span>
<span class="lp-ssg">any HTML output</span>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">How it fits</div>
## Your SSG builds. Freestruct finishes.

<p class="lp-sub">A pure post-build layer - it reads the built HTML and writes SEO into it. No plugin to install into your generator, no template to touch, nothing to keep in sync with an SSG upgrade.</p>

<div class="lp-pipe">
<div class="lp-stage">
<span class="lp-n">01</span>
<h4>Any SSG</h4>
<p>Jekyll, Hugo, Docusaurus, VitePress, MkDocs, Astro, Eleventy - your build, untouched.</p>
</div>
<div class="lp-stage">
<span class="lp-n">02</span>
<h4>Built tree</h4>
<p>Plain HTML files in <code>_site</code>, <code>public</code>, <code>build</code> - whatever your SSG emits.</p>
</div>
<div class="lp-stage lp-stage-accent">
<span class="lp-n">03</span>
<h4>Freestruct</h4>
<p><code>npx freestruct</code> - one command, zero plugins, config discovered automatically.</p>
</div>
<div class="lp-stage">
<span class="lp-n">04</span>
<h4>SEO-grade tree</h4>
<p>Meta, artifacts and validated links, fresh on every run and ready to deploy.</p>
</div>
</div>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">What lands on every page</div>
## Everything a page is still missing, nothing it already has

<p class="lp-sub">Injection is missing-only: what you already set stays yours. Nothing overwritten, nothing guessed.</p>

<div class="lp-grid">
<div class="lp-card" markdown="1">
### Meta + canonical

Full search-engine armor - title, description, a self canonical, plus Open Graph, Twitter and JSON-LD blocks - added only where a page is missing them, so your own settings always win.
</div>
<div class="lp-card" markdown="1">
### `sitemap.xml`

Every page, one entry, real per-page `<lastmod>` dates crawlers can trust - properly escaped XML.
</div>
<div class="lp-card" markdown="1">
### `robots.txt`

Waves crawlers in and hands them your sitemap. The pointer stays correct even on sub-path installs.
</div>
<div class="lp-card" markdown="1">
### RSS feed

A feed readers actually subscribe to: escaped titles, per-page `pubDate`, honest per-page dates.
</div>
<div class="lp-card" markdown="1">
### A noindex 404

Dead ends resolve to a 404 that search engines skip. Generated when your tree lacks one; a 404 you ship is finished, not overwritten.
</div>
<div class="lp-card" markdown="1">
### Cache-busted assets

Every asset URL carries the content-derived build hash, so a CDN that keys on URL or content refetches when your assets change - with optional purge hooks for edge caches that ignore both.
</div>
<div class="lp-card" markdown="1">
### Sub-path friendly URLs

Canonical, sitemap, feed and 404 links carry `site.url + basePath` exactly once, so sub-path installs just work.
</div>
<div class="lp-card" markdown="1">
### Link validation

Every internal link is checked on every run - and with `--strict` a broken one fails the build. `freestruct audit` verifies the same truth independently on the baked output.
</div>
<div class="lp-card" markdown="1">
### Scoped config

`jsonLd` and `og.scoped` take slug globs (`/faq` exact, `/blog/*` one segment, `/guides/**` a sub-tree), so page-specific schema and per-directory image variants stay config-side.
</div>
<div class="lp-card" markdown="1">
### Per-page OG images

`ogImageGeneration` renders a branded 1200x630 PNG per page from your SVG template, wired under missing-only.
</div>
<div class="lp-card" markdown="1">
### Discovery extras

Opt-in keys that finish the modern head: `search`, `breadcrumb`, `article.scoped`, `verification`, `locales` and `llms`. All missing-only, all pinned.
</div>
<div class="lp-card" markdown="1">
### Loud diagnostics

A named cause and an exit code that says which step failed (`1` config, `2` template, `3` output dir, `4` hook failure), never a mystery crash. `--tolerant` keeps experiments soft.
</div>
</div>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">It generates HTML too</div>
## Artifacts, not just tags

<p class="lp-sub">Freestruct also writes complete HTML and machine-readable output you can serve as-is.</p>

<div class="lp-grid">
<div class="lp-card" markdown="1">
### A noindex `404.html`

Generated when your built tree lacks one. Your own 404 is respected and finished - never overwritten.
</div>
<div class="lp-card" markdown="1">
### Real artifacts

`sitemap.xml`, `robots.txt` and `feed.xml` written as files your host serves directly.
</div>
<div class="lp-card" markdown="1">
### Packaged templates

The meta/canonical block, Open Graph, Twitter and JSON-LD segments - ready as-is or as a starting point. Stage a copy in `docs/_freestruct/` and it always wins.
</div>
<div class="lp-card" markdown="1">
### The `init/` scaffold kit

A commented starter config plus template copies, version-stamped to your install. Copy and go:

```bash
npm install --save-dev freestruct
cp -r node_modules/freestruct/init/docs .
```
</div>
</div>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">Quick start</div>
## Four steps to a finished tree

<div class="lp-grid">
<div class="lp-card" markdown="1">
### 1. Build like always

Your SSG stays untouched; whatever it emits is the input.

```bash
jekyll build   # or hugo, mkdocs build, ...
```
</div>
<div class="lp-card" markdown="1">
### 2. Add one config

Site name plus URL; options are optional. Unknown or retired keys warn loudly.

```yaml
site:
  name: My Docs
  url: https://example.com/docs
```
</div>
<div class="lp-card" markdown="1">
### 3. Run Freestruct

Config and output dir are discovered automatically.

```bash
npx freestruct
```
</div>
<div class="lp-card" markdown="1">
### 4. Verify

The independent audit checks the baked output and names every gap.

```bash
npx freestruct audit
```
</div>
</div>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">Why a layer</div>
## With Freestruct vs doing it by hand

<table class="lp-table">
<thead>
<tr><th>With Freestruct</th><th>Doing it by hand</th></tr>
</thead>
<tbody>
<tr><td>Write 4 lines of config once</td><td>Edit every page template</td></tr>
<tr><td>Run one command after build</td><td>Maintain a plugin per SSG forever</td></tr>
<tr><td>Switch SSGs without changing the SEO plan</td><td>Re-implement meta + sitemap each time</td></tr>
<tr><td>Trust a CI that attacks its own output</td><td>Hope nothing regresses</td></tr>
</tbody>
</table>
</div>

<div class="lp-section" markdown="1">
<div class="lp-kicker">For agents too</div>
## Agent-hardened and CI-proven

<p class="lp-sub">The boring trust facts are pinned by a 169-test battery and run on every push.</p>

<div class="lp-grid">
<div class="lp-card" markdown="1">
### Named exit codes

`exit 0` quietly means the tree finished; `1 / 2 / 3 / 4` name exactly which step failed (config, template, output dir, hook failure).
</div>
<div class="lp-card" markdown="1">
### Proven fresh install

The tarball e2e proves real pack, real install, real quick start on every run.
</div>
<div class="lp-card" markdown="1">
### Attacked on purpose

An adversarial crashtest pack attacks our own built docs in CI on every push.
</div>
<div class="lp-card" markdown="1">
### Docs that hold up

Broken-links-as-failures is how our own Pages deploy runs, and `AGENTS.md` orients a coding agent in one file.
</div>
</div>
</div>

<div class="lp-band" markdown="1">
## Ship docs search engines can actually see

<p>Install, add two config lines, run one command. Your built tree comes out with the SEO every page was missing.</p>

<div class="lp-cta">
<a class="lp-btn lp-btn-primary" href="/getting-started">Get started</a>
<a class="lp-btn lp-btn-ghost" href="/guides/freestruct-config">Config reference</a>
<a class="lp-btn lp-btn-ghost" href="/guides/cli">CLI reference</a>
</div>
</div>

</div>
