# freestruct

**Post-build SEO layer for static doc sites.**

Build your docs with any SSG - Jekyll, Hugo, Docusaurus, MkDocs, VitePress. Run freestruct after build for full SEO coverage: meta, canonical, sitemap, feed, 404, cache busting, and validated internal links.

---

## Quick Start

freestruct runs **after** your static site generator, straight into the build output. One dependency (`js-yaml`). No SSG plugin, no template edits.

### 1. Install

```bash
npm install --save-dev freestruct
```

### 2. Create the config

`docs/freestruct.config.yml` next to your docs folder (legacy name
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

`site.name` and `site.url` are required; everything else has a working default (see the Configuration table below).

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

If any of those fail, freestruct tells you why: config errors, a missing
template, and an empty output dir each fail loudly with their own exit code
(`1` config, `2` template, `3` output dir; `--tolerant` downgrades fatals to
exit 0 for CI tolerance).

### Useful flags

```bash
npx freestruct --version        # installed version
npx freestruct --strict         # fail (nonzero) on broken links / noindex leakage
npx freestruct --tolerant       # report everything, never fail the CI build
npx freestruct path/to/output   # explicit output dir override
```

---

## Features

### SEO

- Injects missing title, description, canonical, Open Graph, Twitter cards, and JSON-LD (missing-only: existing tags are left alone)
- Honest canonical URLs including sub-path (basePath) installs
- Tagged with a `freestruct-build` marker comment

### Search

- **Opt-in** `search.json` (set `searchIndex: true`) for client-side search; default runs generate nothing - bring your own Pagefind/index

### Sitemap & more

- Auto-generated `sitemap.xml` (real per-file `lastmod`), `robots.txt`, `feed.xml` (RSS)
- Auto-generated `404.html` with noindex + full SEO treatment when missing

### Performance

- Cache-busting: asset query params (`?v={hash}`), optional canonical hash
- Lazy loading on images, reading time + last-modified meta

### DX

- Config schema with loud `[freestruct] config warning` diagnostics; unknown and retired keys never die silently
- Link validation (report-only by default, `--strict` to make fatal)
- Signature-style post-render HTML hooks (guide: Post-Render Hooks)

---

## Configuration

Full key list (unknown or retired keys produce warnings, not silence):

| Key | Default | Meaning |
|-----|---------|---------|
| `site.name` | - (required) | Site name; composes page titles |
| `site.url` | - (required) | Canonical origin; URLs build from this |
| `site.description` | - | Fallback description for pages without one |
| `basePath` | *(unset)* | URL path prefix the output tree is served under; canonical/sitemap/feed/search URLs get exactly this prefix (no doubling if the tree nests it) |
| `outputDir` | `docs/_site` | Build output directory (or pass it as a CLI arg) |
| `generateSitemap` | `true` | Generate `sitemap.xml` |
| `generateRobots` | `true` | Generate `robots.txt` |
| `generateFeed` | `true` | Generate `feed.xml` (RSS) |
| `generate404` | `true` | Generate `404.html` when missing |
| `readingTime` | `true` | Inject `<meta name="reading-time">` |
| `lastModified` | `true` | Inject `<meta name="last-modified">` |
| `lazyLoad` | `true` | Add `loading="lazy"` to images |
| `linkCheck` | `true` | Validate internal links (report-only; `--strict` makes them fatal) |
| `searchIndex` | `false` | **Opt-in**: generate `search.json` for client-side search |
| `minify` | `false` | Experimental HTML minifier (preserves `pre`/`script`/`style`/`textarea`) |
| `runHooks` | `false` | Gateway: only `true` lets `cacheBusting.purge` commands execute |
| `cacheBusting.assetQueryParam` | `true` | Append `?v={buildHash}` to linked assets |
| `cacheBusting.hashInCanonicalUrl` | `false` | Append `?v={buildHash}` to canonical URLs |
| `cacheBusting.purge` | *(unset)* | Purge hook list (name + command); disabled without `runHooks: true` |

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

Use only trusted commands. Disabled by default.

---

## Releases

- Versions live in one place: `package.json`, pinned in CI against the
  README/CHANGELOG truth. Single source, no drift.
- CHANGELOG.md is the changelog; releases are tagged (`v*`) and CHANGELOG-truthful or they don't ship.
- Current release: **0.6.0** (version frozen on this number).
- See CHANGELOG.md for the full history.

## v0.6.0

- Config renamed to `freestruct.config.yml` with legacy read; schema-checked with loud diagnostics
- `searchIndex` opt-in; FAST_FAIL exit codes + `--tolerant`; snippet placeholder substitution; basePath contract for sub-path installs
- Docs: full config reference table, single-source nav (`_data/nav.yml`), docs-audit gates in CI, quick start verified end to end

---

## Related

- [prestruct](https://github.com/dhaupin/prestruct) - React SSG for Cloudflare Pages (freestruct's docs frame sibling)
- [vant](https://github.com/dhaupin/vant) - the prototype freestruct was extracted from
- [crashtest](https://crashtest.creadev.org) - adversarial QA for agent-built apps; freestruct ships its own pack (see `packs/README.md`)
