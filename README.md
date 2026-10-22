# Freestruct

**The post-build SEO layer for static doc sites.**

Build your docs with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress, Astro, Eleventy.
Then run Freestruct over the output: complete SEO metadata (title, description, canonical,
Open Graph, Twitter, JSON-LD), `sitemap.xml` with real per-page `lastmod`, `robots.txt`
with the right sitemap pointer, an RSS `feed.xml` with honest per-page dates, a `404.html`
that carries noindex, cache-busted assets, and internal-link validation. One dependency
(`js-yaml`), no SSG plugin, no template edits.

Part of the [Creadev](https://creadev.org) doc-system family - the same docs frame and
engineering conventions as its siblings (see Project family below).

---

## Quick start

Freestruct runs **after** your SSG, straight into the build output.

### 1. Install

```bash
npm install --save-dev freestruct
```

### 2. Create the config

Create `docs/freestruct.config.yml` next to your docs folder (the legacy name
`docs/ssr-config.yml` is still read; discovery walks upward from your cwd):

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

`site.name` and `site.url` are required; everything else has a working default
(the full reference is the [Configuration](#configuration) table below, and the
[config guide](https://freestruct.creadev.org/guides/freestruct-config) goes key by key).

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

If any of those fail, Freestruct tells you why: config errors, a missing
template, and an empty output dir each fail loudly with their own exit code
(`1` config, `2` template, `3` output dir; `--tolerant` downgrades fatals to
exit 0 for CI tolerance).

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
```

---

## Features

### SEO

- Injects missing title, description, canonical, Open Graph, Twitter cards, and
  JSON-LD (missing-only: existing tags are left alone)
- Attribute-safe everywhere: og/twitter values are HTML-escaped, JSON-LD
  literals are JSON-escaped (a raw `<` cannot close the script tag),
  `og:image`/`twitter:image` ship only when an image is configured, and an
  optional `author` key rides the Organization JSON-LD as a schema.org founder
- Page-level tuning survives the build: a `<!-- freestruct: {...} -->` comment
  overrides title/description/ogType/ogImage/twitterCard and adds
  `article:published_time`/`author`/`section`; custom `jsonLd` objects append
  structured data
- Honest canonical URLs including sub-path (`basePath`) installs - the same
  contract holds for the `sitemap.xml` locs, `robots.txt` sitemap pointer, the
  RSS channel/self links, and the generated 404's home link
- Tagged with a `freestruct-build` marker comment

### Search

- **Opt-in** `search.json` (set `searchIndex: true`); default runs generate
  nothing - bring your own indexer (Pagefind/Algolia), the search guide covers
  the wiring

### Sitemap, robots, feed & 404

- `sitemap.xml`: encoded URLs, real per-file `lastmod` (page mtime, not build
  time), noindex pages excluded
- `robots.txt`: `User-agent: *` + `Allow: /` + a basePath-aware sitemap pointer
- `feed.xml` (RSS): escaped titles/descriptions, per-page `pubDate` from each
  page's own mtime, basePath-aware channel/self links
- `404.html`: generated when missing, gets the full SEO pipeline + explicit
  noindex; a user-supplied 404 gets the same treatment

### Performance

- Cache-busting: asset query params (`?v={hash}`), optional canonical hash
- Lazy loading on images, reading time + last-modified meta

### DX

- Config schema with loud `[freestruct] config warning` diagnostics; unknown
  and retired keys never die silently
- Link validation (report-only by default, `--strict` to make fatal - our own
  docs CI runs `--strict` and it has already caught three production 404s)
- Post-render hooks with purge-command safety (disabled by default; see
  [Security](#security))

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
| `linkCheck`                            | `true`         | Validate internal links (report-only; `--strict` makes them fatal)                                    |
| `searchIndex`                          | `false`        | **Opt-in**: generate `search.json` for client-side search                                             |
| `minify`                               | `false`        | Experimental HTML minifier (preserves `pre`/`script`/`style`/`textarea`)                              |
| `runHooks`                             | `false`        | Gateway: only `true` lets `cacheBusting.purge` commands execute                                       |
| `cacheBusting.assetQueryParam`         | `true`         | Append `?v={buildHash}` to linked assets                                                              |
| `cacheBusting.hashInCanonicalUrl`      | `false`        | Append `?v={buildHash}` to canonical URLs                                                             |
| `cacheBusting.purge`                   | *(unset)*      | Purge hook list (name + command); disabled without `runHooks: true`                                   |

The docs ([freestruct.creadev.org](https://freestruct.creadev.org)) carry the
key-by-key guides: the [config reference](https://freestruct.creadev.org/guides/freestruct-config),
[cache busting](https://freestruct.creadev.org/guides/cache-busting), [custom
injection](https://freestruct.creadev.org/guides/custom-injection),
[CLI reference](https://freestruct.creadev.org/guides/cli),
[post-render hooks](https://freestruct.creadev.org/guides/post-render-hooks),
[CI/CD](https://freestruct.creadev.org/guides/cicd) and
[troubleshooting](https://freestruct.creadev.org/guides/troubleshooting).

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

Use only trusted commands. Disabled by default. Available variables:
`$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR`.

---

## Scaffolding + the crashtest pack

Two shipped surfaces beyond the engine:

- **`init/`** - the consumer scaffold kit: a commented starter config,
  template copies, and a README ("copy + go"). Version-stamped on
  `package.json`; `npx freestruct` resolves templates user-staged first,
  package fallback second.
- **`packs/`** - Freestruct's [crashtest](https://crashtest.creadev.org) pack
  surface: `freestruct-docs-shapes` attacks a built docs tree the way a
  static host serves it (traversal refusal, 404 noindex, noindex artifact
  leaks, canonical query poisoning, XML shape). See
  [packs/README.md](packs/README.md). The docs CI runs it against every
  Pages build.

---

## Releases

- Versions live in one place: `package.json`, pinned in CI against the
  README/CHANGELOG truth. Single source, no drift.
- `CHANGELOG.md` is the changelog; releases are tagged (`v*`) and
  CHANGELOG-truthful or they don't ship.
- Current release: **0.9.0** (the owner's version call, 2026-10-22; see
  `labs/TASKS.md` for the version policy).
- Deployment truth lives in [DEPLOY.md](DEPLOY.md): the GitHub Pages pipeline
  (this repo's own docs site deploys through it) and the npm release runbook.

## v0.9.0

This number carries the full rehaul-era stack, accumulated under the 0.6.0
freeze and released as one truthful number by owner call:

- Config renamed to `freestruct.config.yml` with legacy read; schema-checked
  with loud diagnostics; FAST_FAIL exit codes + `--tolerant`
- Module decomposition: the engine is `engine/` (one orchestrator + eight
  modules) with `bin/` shim and shipped templates; `init/` is the consumer
  scaffold kit; template copies provably in sync via CI
- `searchIndex` opt-in; noindex honored across sitemap/feed/search/404;
  basePath contract across every generated URL (canonical, sitemap, feed,
  robots pointer, 404 home link)
- Honest XML: escaped values, per-page `lastmod`, per-page RSS dates;
  escaped-or-fail on un-escapable content
- Docs: single-source nav, audit gates wired to CI (style, truthfulness,
  English-only language gate, engine comment format), the docs CI itself
  runs `--strict` plus the crashtest pack dogfood
- Release truth: tarball e2e CI gate + hard publish gate; version pinned
- crashtest pack surface (`packs/public/freestruct-docs-shapes`) with CI
  teeth on every push and the Pages build

---

## Project family

Freestruct is one member of the Creadev doc-system family. The family shares
conventions and a docs frame, but each project is separate and
complimentary - freestruct imports nothing from its siblings.

- [Freestruct docs](https://freestruct.creadev.org) - the docs site built from
  this repo (`docs/` is itself the worked example: Jekyll + Freestruct + Pagefind)
- [docs.creadev.org](https://docs.creadev.org) - the Creadev docs system hub
- [prestruct](https://github.com/dhaupin/prestruct) /
  [prestruct.creadev.org](https://prestruct.creadev.org) - a separate,
  complimentary project: a React SSG for Cloudflare Pages that shares the
  docs frame and conventions (and some gates' patterns) with freestruct, but
  installs, builds and ships nothing together with it
- [prestruct docs](https://docs.creadev.org/prestruct) - the prestruct docs
  layer on the shared system
- [crashtest](https://crashtest.creadev.org) - adversarial QA for agent-built
  apps; Freestruct ships and CI-runs its own pack
- [vant](https://github.com/dhaupin/vant) - the prototype Freestruct was
  extracted from

For agents: [AGENTS.md](AGENTS.md) is the orientation file (scope, house
rules, gates). Humans and agents are welcome equally - see
[CONTRIBUTING.md](CONTRIBUTING.md).
