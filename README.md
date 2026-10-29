# Freestruct

**The post-build SEO layer for static doc sites.**

Build your docs with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress, Astro, Eleventy. Then run Freestruct over the output: complete SEO metadata (title, description, canonical, Open Graph, Twitter, JSON-LD), `sitemap.xml` with real per-page `lastmod`, `robots.txt` with the right sitemap pointer, an RSS `feed.xml` with honest per-page dates, a `404.html` that carries noindex, cache-busted assets, and internal-link validation. One dependency (`js-yaml`), no SSG plugin, no template edits.

Part of the [Creadev](https://creadev.org) doc-system family - the same docs frame and engineering conventions as its siblings (see Project family below).

---

## Quick start

Freestruct runs **after** your SSG, straight into the build output.

### 1. Install

```bash
npm install --save-dev freestruct
```

### 2. Create the config

Create `docs/freestruct.config.yml` next to your docs folder (the legacy name `docs/ssr-config.yml` is still read; discovery walks upward from your cwd):

```yaml
# docs/freestruct.config.yml
site:
  name: My Docs
  url: https://example.com/docs
  description: My documentation
twitter:
  username: "@handle"
og:
  image: /og-default.png
```

`site.name` and `site.url` are required; everything else has a working default (the full reference is the [Configuration](#configuration) table below, and the [config guide](https://freestruct.creadev.org/guides/freestruct-config) goes key by key).

### 3. Build, then inject

```bash
# your SSG build first
jekyll build            # or hugo, mkdocs, docusaurus build, ...

# then freestruct
npx freestruct          # discovers config + output dir automatically
```

Or wire both into one script:

```json
// package.json
{
  "scripts": {
    "build": "jekyll build && freestruct"
  }
}
```

### 4. Verify

```bash
# The injected pages carry canonical + og meta and a build marker
grep -l 'rel="canonical"' docs/_site/*.html

# Cache-busting marker
grep -o 'freestruct-build' docs/_site/index.html

# Generated artifacts
ls docs/_site/{sitemap.xml,robots.txt,feed.xml,404.html}
```

If any of those fail, Freestruct tells you why: config errors, a missing template, an empty output dir, and a failing `hooks.postBuild` command each fail loudly with their own exit code (`1` config, `2` template, `3` output dir, `4` hook failure; `--tolerant` downgrades fatals to exit 0 for CI tolerance).

### Useful flags and subcommands

```bash
npx freestruct --version        # installed version
npx freestruct --strict         # fail (nonzero) on broken internal links
                                # (noindex pages are structurally excluded from
                                # artifacts and wire-guarded by the crashtest pack)
npx freestruct --tolerant       # report everything, never fail the CI build
npx freestruct path/to/output   # explicit output dir override
npx freestruct validate         # config-only preflight; exit 1 on fatal errors
npx freestruct init             # scaffold the starter kit into ./docs
                                # (npx freestruct init mydir -> mydir/docs;
                                #  existing files are never clobbered)
npx freestruct audit            # verify the baked output (heads + sitemap/
                                # robots/404-noindex); --json for CI digest;
                                # --external also probes up to 50 unique
                                # external hrefs (warn-grade, needs network);
                                # exit 1 on FAIL findings (issue #18)
```

---

## Features

### SEO

- Injects missing title, description, canonical, Open Graph, Twitter cards, and JSON-LD (missing-only: existing tags are left alone)
- Feed autodiscovery: every injected head carries the `rel="alternate" type="application/rss+xml"` link (a page-owned one wins, missing-only) so feed readers find feed.xml without knowing the URL
- Attribute-safe everywhere: og/twitter values are HTML-escaped, JSON-LD literals are JSON-escaped (a raw `<` cannot close the script tag), `og:image`/`twitter:image` ship only when an image is configured, and an optional `author` key rides the Organization JSON-LD as a schema.org founder
- `search`, `breadcrumb`, `article`, `verification` and `locales`: the SearchAction target for the WebSite JSON-LD (no more hardcoded `?s=` default), auto BreadcrumbList from the URL tree, scoped per-page `Article`/`TechArticle`/`NewsArticle` blocks, provider-keyed site verification metas, and hreflang stem-swap alternates for multilingual trees - all opt-in, missing-only, and loudly diagnostic (see the Discovery Options in the config reference)
- `llms: true` emits the AI-consumable `llms.txt` summary over the same indexable page set sitemap and feed honor (noindex stays honored; an existing file is never overwritten)
- `og.image` takes the back-compat string form or the structured `{ src, width, height, alt }` object form, which also emits the `og:image:width`/`height`/`alt` companions; SVG sources warn loudly on every run (most scrapers cannot render them), `allowSvg: true` accepts one explicitly, and `--strict` fails the build until it is answered
- Page-level tuning survives the build: a `<!-- freestruct: {...} -->` comment overrides title/description/ogType/ogImage/twitterCard and adds `article:published_time`/`author`/`section`; custom `jsonLd` objects append structured data
- Honest canonical URLs including sub-path (`basePath`) installs - the same contract holds for the `sitemap.xml` locs, `robots.txt` sitemap pointer, the RSS channel/self links, and the generated 404's home link
- Tagged with a `freestruct-build` marker comment

### Search

- **Opt-in** `search.json` (set `searchIndex: true`); default runs generate nothing - bring your own indexer (Pagefind/Algolia), the search guide covers the wiring

### Sitemap, robots, feed & 404

- `sitemap.xml`: encoded URLs, real per-file `lastmod` (page mtime, not build time), noindex pages excluded
- `robots.txt`: `User-agent: *` + `Allow: /` + a basePath-aware sitemap pointer
- `feed.xml` (RSS): escaped titles/descriptions, per-page `pubDate` from each page's own mtime, basePath-aware channel/self links
- `404.html`: generated when missing, gets the full SEO pipeline + explicit noindex; a user-supplied 404 gets the same treatment

### Performance

- Cache-busting: asset query params (`?v={hash}`), optional canonical hash
- Lazy loading on images, reading time + last-modified meta

### DX

- Config schema with loud `[freestruct] config warning` diagnostics; unknown and retired keys never die silently
- Link validation (report-only by default, `--strict` to make fatal - our own docs CI runs `--strict` so a broken internal link fails the Pages build before it ships)
- `freestruct audit` verifies the baked output independently - per-page head hygiene, the 404 noindex contract, sitemap/robots sanity - with an exit code for CI (`0` clean, `1` findings, `--json` digest for annotations); it reads only the output dir, so it checks any SSG's build with freestruct applied
- IndexNow support (issue #19): freestruct is the component that already owns the sitemap, so the key file (the keyLocation ownership proof) ships into the output during the run and `freestruct indexnow` POSTs the baked URL list to api.indexnow.org afterwards - deploy first (keyLocation must resolve), submission is the post-deploy step, and `--dry-run` prints the request body for CI
- Slug-glob scoped config (issue #25): `jsonLd` accepts the legacy object/list forms or a map keyed by page-slug globs (`/` exact, `/blog/*` one segment, `/guides/**` a sub-tree) so page-specific schema lands only where it is meant to; `og.scoped` does the same for og image variants with the most specific match winning. Missing-only holds everywhere, malformed entries warn loudly and skip only themselves
- Per-page OG image generation (issue #22): freestruct already extracts each page's title/description, so it can render a branded 1200x630 PNG per page from a consumer SVG template (`{{ogTitle}}`/`{{ogDescription}}`/ `{{ogUrl}}` placeholders) and wire og/twitter to it - missing-only keeps pages with their own og set. Rasterization is honest: PNG needs a real rasterizer, so the optional `@resvg/resvg-js` package is loaded lazily and the run stays green with a loud skip when it is not installed
- Post-render hooks with purge-command safety (disabled by default; see [Security](#security))

---

## Configuration

Full key list (unknown or retired keys produce warnings, not silence):

| Key                                    | Default        | Meaning                                                                                              |
|----------------------------------------|----------------|------------------------------------------------------------------------------------------------------|
| `site.name`                            | - (required)   | Site name; composes page titles                                                                       |
| `site.url`                             | - (required)   | Canonical origin; URLs build from this                                                                |
| `site.description`                     | -              | Fallback description for pages without one                                                            |
| `author`                               | *(unset)*      | Author identity; ships as schema.org founder on the Organization JSON-LD                              |
| `jsonLd`                               | *(unset)*      | Custom JSON-LD object(s) appended to the injected structured data                                     |
| `basePath`                             | *(unset)*      | URL path prefix the output tree is served under; all generated URLs get exactly this prefix           |
| `outputDir`                            | `docs/_site`   | Build output directory (or pass it as a CLI arg)                                                      |
| `generateSitemap`                      | `true`         | Generate `sitemap.xml`                                                                               |
| `generateRobots`                       | `true`         | Generate `robots.txt`                                                                                |
| `generateFeed`                         | `true`         | Generate `feed.xml` (RSS)                                                                            |
| `generate404`                          | `true`         | Generate `404.html` when missing                                                                     |
| `readingTime`                          | `true`         | Inject `<meta name="reading-time">`                                                                  |
| `lastModified`                         | `true`         | Inject `<meta name="last-modified">`                                                                 |
| `lazyLoad`                             | `true`         | Add `loading="lazy"` to images                                                                        |
| `tableWrap`                            | `true`         | Wrap wide `<table>`s in a scroll container so they never pin the page width (mobile-safe by construction) |
| `linkCheck`                            | `true`         | Validate internal links (report-only; `--strict` makes them fatal)                                    |
| `searchIndex`                          | `false`        | **Opt-in**: generate `search.json` for client-side search                                             |
| `minify`                               | `false`        | Experimental HTML minifier (preserves `pre`/`script`/`style`/`textarea`)                              |
| `runHooks`                             | `false`        | Gateway: only `true` lets `cacheBusting.purge` and `hooks.postBuild` commands execute                 |
| `hooks.postBuild`                      | *(unset)*      | Post-build command list chaining after the pass; disabled without `runHooks: true`; nonzero exit fails the build (exit 4) |
| `indexNow`                             | *(unset)*      | IndexNow notify support: `true` (generate-once-and-persist key) or `{ key: "<32-hex>" }`; ships `<key>.txt` into the output and enables the `freestruct indexnow` post-deploy submission |
| `ogImageGeneration`                    | *(unset)*      | Per-page OG image generation (`{ template, font?, width?, height? }`): renders a branded 1200x630 PNG per page from a consumer SVG template; needs the optional `@resvg/resvg-js` dev package (loud skip without it) |
| `cacheBusting.assetQueryParam`         | `true`         | Append `?v={buildHash}` to linked assets                                                              |
| `cacheBusting.hashInCanonicalUrl`      | `false`        | Append `?v={buildHash}` to canonical URLs                                                             |
| `cacheBusting.purge`                   | *(unset)*      | Purge hook list (name + command); disabled without `runHooks: true`                                   |

The docs ([freestruct.creadev.org](https://freestruct.creadev.org)) carry the key-by-key guides: the [config reference](https://freestruct.creadev.org/guides/freestruct-config), [cache busting](https://freestruct.creadev.org/guides/cache-busting), [custom injection](https://freestruct.creadev.org/guides/custom-injection), [CLI reference](https://freestruct.creadev.org/guides/cli), [post-render hooks](https://freestruct.creadev.org/guides/post-render-hooks), [CI/CD](https://freestruct.creadev.org/guides/cicd) and [troubleshooting](https://freestruct.creadev.org/guides/troubleshooting).

---

## Security

Purge hooks run shell commands via `execSync`. Enable explicitly in config:

```yaml
# In freestruct.config.yml
runHooks: true  # must be set to enable
cacheBusting:
  purge:
    - name: cloudflare
      command: "cf-cli purge $SITE_URL"
```

Use only trusted commands. Disabled by default. Available variables: `$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR` (as env vars on the child: `FREESTRUCT_SITE_URL`, `FREESTRUCT_BUILD_HASH`, `FREESTRUCT_OUTPUT_DIR`).

The same gateway covers the general postBuild seam - commands that chain after the entire pass (custom schema injection, audits, IndexNow submissions). A nonzero hook exit is a build failure (exit code 4):

```yaml
# In freestruct.config.yml
runHooks: true
hooks:
  postBuild:
    - node scripts/faq-schema.mjs
    - npm run seo:audit
```

Purge errors are reported and the build continues (a failed CDN purge is not a bad sitemap); postBuild failures fail the build on purpose - chain only trusted commands there too.

---

## Scaffolding + the crashtest pack

Two shipped surfaces beyond the engine:

- **`init/`** - the consumer scaffold kit: a commented starter config, template copies, and a README ("copy + go"). Version-stamped on `package.json`; `npx freestruct` resolves templates user-staged first, package fallback second.
- **`packs/`** - Freestruct's [crashtest](https://crashtest.creadev.org) pack surface: `freestruct-docs-shapes` attacks a built docs tree the way a static host serves it (traversal refusal, 404 noindex, noindex artifact leaks, canonical query poisoning, XML shape). See [packs/README.md](packs/README.md). The docs CI runs it against every Pages build.

---

## Releases

- Versions live in one place: `package.json`, pinned in CI against the README/CHANGELOG truth. Single source, no drift.
- `CHANGELOG.md` is the changelog; releases are tagged (`v*`) and CHANGELOG-truthful or they don't ship.
- Current release: **1.2.0** (everything since the v1.1.0 tag: the family sweep, the docs/tooling wave, the post-queue engine sweep, and the issue #41 version-truth census leg; see `labs/TASKS.md` for the version policy).
- Deployment truth lives in [DEPLOY.md](DEPLOY.md): the GitHub Pages pipeline (this repo's own docs site deploys through it) and the npm release runbook.

## v1.2.0

Everything since the v1.1.0 tag: the family sweep and the docs/tooling wave, then the post-queue engine sweep - with the GitHub issue queue fully closed (#1-#40), the engine corners the queue-era waves never probed got nine real fixes, each with a battery pin (121 -> 130), plus the issue #41 version-truth census leg (130 -> 132), the issue #43 count census (132 -> 133), the post-merge staging pass (133 -> 134), and the repo-wide gap walk (134 -> 140):

- Rerun hygiene - body-start/footer snippets are marker-wrapped and a rerun drops the previous copy before re-adding it, so a second pass no longer stacks snippets or churns the content-derived build hash
- Verbatim-block-aware `minifyHtml` - `<pre class="...">`/`<script>`/`<style>`/`<textarea>` content (attribute forms included) survives byte-for-byte, so code fences and inline JS with `//` comments are never collapsed
- Cache-bust fix - asset extensions match as a case-insensitive SET, so `.cs`/`.tt`/`.j` are no longer busted and uppercase `.PNG` now is
- Link checking - single-quoted `href` links are checked too, so `--strict` catches a single-quoted broken link
- Purge hooks - `FREESTRUCT_SITE_URL` / `FREESTRUCT_BUILD_HASH` / `FREESTRUCT_OUTPUT_DIR` now reach the child, matching `hooks.postBuild` and the docs
- Lazy-load fix - self-closing `<img ... />` stays well-formed instead of getting a dangling `/ loading="lazy"`
- Audit fixes - `grabMeta` tolerates a leading attribute (no more false `missing meta description`), and `urlToDisk` normalizes a slash-less `basePath`
- Audit quote fix - `grabMeta`/`grabCanonical` read a quoted attribute up to its matching quote, so a description holding an apostrophe ("this repo's docs") is measured at full length instead of truncated at the apostrophe
- Docs h1 gate - the docs audit now fails any living page without exactly one top-level `# ` heading; seven pages that opened on `##` or prose (a rig-adoption regression) gained their missing h1
- CLI - `-h` now aliases `--help` instead of riding as the positional output dir
- Version truth - a census leg derives the version from `package.json` and refuses every living surface that hand-copied the current one (README line, AGENTS/CONTRIBUTING/DEPLOY pins, the pass-log reminder, the `release.yml` tag example, `init/VERSION`)
- Count census - the same trick for the hand-copied counts: the homepage battery size and the engine module counts are derived from source and refused when they drift (issue #43)
- Doc truthfulness - the cache-busting FAQ/config reference drop the retired `cacheBusting.hash` and the canonical-by-default claim, and new environment + packs reference pages fill the gaps
- basePath links - root-absolute hrefs carrying the configured `basePath` resolve against the tree, so a baseurl'd site passes `--strict`
- Release gate - `npm run check` composes the battery + docs audit + pack selftest, and `prepublishOnly` runs it, so a dirty tree cannot publish
- Audit signal - config-gated absences (`og:image` / `twitter:image` not configured) print once with an affected-page count instead of once per page
- Table guard - a default-on `tableWrap` pass wraps wide tables in a scroll container so every downstream site is mobile-safe by construction
- Init kit - the starter config seeds the family JSON-LD identity, so scaffolded ports ship founder + maintainer from birth
- Docs - the playbooks leg (one recipe per runbook, indexed and in the nav), the rootless local docs-preview recipe, the full rouge token vocabulary, and the retired 72-column hard-wrap (living prose flows, `scripts/unwrap-prose.cjs` keeps it that way)
- CI - the Pages runbook promoted to a reusable `workflow_call` lane (`docs-lane.yml`) with `docs.yml` a thin caller, every `actions/cache` step pinned to one major, and the phone-publish lane (`scripts/ship-from-download.cjs`)
- Entity truth - `extractTitle`/`extractDescription` are attribute-order and quote tolerant and decode HTML entities, so a reordered/single-quoted meta is read (no silent site-default fallback) and the feed no longer double-encodes (`&amp;amp;`), while search.json/llms.txt carry plain text instead of raw entities
- Minify text fix - a line break inside text collapses to a space instead of a joiner, so `Hello\nworld` no longer fuses into `Helloworld`
- Cache-bust parity - single-quoted `href`/`src` assets get `?v=` too, matching the link checker's both-quote handling
- Audit containment - a site-local `og:image`/JSON-LD `logo`/`image` that escapes the output tree is named as escaping instead of being probed off-tree and read back as present
- Audit noindex exemption - a `robots noindex` page (a redirect stub, a thank-you page) is exempt from the content-quality classes (description length, h1 shape, JSON-LD absence) that grade indexable content, while the structural classes still apply

## v1.1.0

The first post-stable release, carried by the all-items issue sweep (#17-#25 plus the #25 follow-on) and the CI tooling that came with it:

- `freestruct audit` - independent baked-output verification (per-page head hygiene, the 404 noindex contract, sitemap/robots) with `--json` for CI
- `hooks.postBuild` - the general post-build hook seam (exit code 4, `FREESTRUCT_*` env on hook children)
- IndexNow - key-file emission + the `freestruct indexnow` post-deploy submission (`--dry-run` for CI)
- Scoped config - slug-glob map forms for `jsonLd` and `og.scoped`
- Structured `og.image` - `{ src, width, height, alt, allowSvg }` with the companion tags and the SVG warn/strict ladder
- Per-page OG-image generation - `ogImageGeneration` through the optional `@resvg/resvg-js` rasterizer
- Latent hardening - every config/page-carried substitute now rides function replacers ($-expansion cannot corrupt output), plus the docs-layout dead-CSS removal
- CI - packstruct manifest lint joined the push/PR battery alongside the crashtest pack selftest; the battery grew 49 -> 75 -> 103 pins

## v1.0.0

First stable release. It carries the full rehaul-era stack (accumulated under the 0.6.0 freeze, promoted truthfully as 0.9.0), the prestruct port wave, and the toolchain maturity landed on 2026-10-22:

- Config renamed to `freestruct.config.yml` with legacy read; schema-checked with loud diagnostics; FAST_FAIL exit codes + `--tolerant`
- Module decomposition: the engine is `engine/` (one orchestrator + nine modules) with `bin/` shim and shipped templates; `init/` is the consumer scaffold kit; template copies provably in sync via CI
- `searchIndex` opt-in; noindex honored across sitemap/feed/search/404; basePath contract across every generated URL (canonical, sitemap, feed, robots pointer, 404 home link)
- Honest XML: escaped values, per-page `lastmod`, per-page RSS dates; escaped-or-fail on un-escapable content
- Docs: single-source nav, audit gates wired to CI (style, truthfulness, English-only language gate, engine comment format), the docs CI itself runs `--strict` plus the crashtest pack dogfood
- Release truth: tarball e2e CI gate + hard publish gate; version pinned
- crashtest pack surface (`packs/public/freestruct-docs-shapes`) with CI teeth on every push and the Pages build
- Port wave from prestruct: attribute-escaped injection, og/twitter image parity, `author` + JSON-LD founder, per-page override comments, custom `jsonLd`, deterministic build hash, CLI subcommands (`validate`/`init`/ `help`), `FREESTRUCT_URL` env override
- Toolchain: Node-24-compatible GH action majors, Jekyll 4.4 + Ruby 3.4, js-yaml 5.5, packaging validated dry (npm tarball + GitHub source tar)

---

## Project family

Freestruct is one member of the Creadev doc-system family. The family shares conventions and a docs frame, but each project is separate and complimentary - freestruct imports nothing from its siblings.

- [Freestruct docs](https://freestruct.creadev.org) - the docs site built from this repo (`docs/` is itself the worked example: Jekyll + Freestruct + Pagefind)
- [docs.creadev.org](https://docs.creadev.org) - the Creadev docs system hub
- [prestruct](https://github.com/dhaupin/prestruct) / [prestruct.creadev.org](https://prestruct.creadev.org) - a separate, complimentary project: a React SSG for Cloudflare Pages that shares the docs frame and conventions (and some gates' patterns) with freestruct, but installs, builds and ships nothing together with it
- [prestruct docs](https://docs.creadev.org/prestruct) - the prestruct docs layer on the shared system
- [crashtest](https://crashtest.creadev.org) - adversarial QA for agent-built apps; Freestruct ships and CI-runs its own pack
- [vant](https://github.com/dhaupin/vant) - the prototype Freestruct was extracted from
- **The workshop** - [Creadev.org](https://creadev.org) (freestruct is made by Rook @ Creadev.org - the same home as the docs and site surfaces above)

For agents: [AGENTS.md](AGENTS.md) is the orientation file (scope, house rules, gates). Humans and agents are welcome equally - see [CONTRIBUTING.md](CONTRIBUTING.md).
