# Changelog

All notable changes to freestruct will be documented here.

## [0.6.0] - 2026-10-21

Phase 2 of the v1.0.0 rehaul (PRD: labs/prd-freestruct.md) - the config
contract becomes honest: schema-checked, diagnosed, opinionated defaults.

### Changed
- **Config name**: `docs/freestruct.config.yml` is the primary config name;
  the legacy `docs/ssr-config.yml` is still read for back-compat (discovery
  walks up looking for the new name first, then the old one).
- **Config schema + diagnostics**: unknown top-level/nested keys, and flags
  that exist but no longer do anything (`preserveExistingMeta`,
  `cacheBusting.hash`), produce loud `[freestruct] config warning: ...`
  lines. Nothing in a config file dies silently anymore.
- **`search.json` is opt-in** (owner call, issue #13 policy): only generated
  when `searchIndex: true`. Default runs no longer ship a competing search
  index alongside whatever the site already uses.
- **FAST_FAIL exit codes**: 1 config fatal, 2 template missing, 3 output dir
  missing; new `--tolerant` flag downgrades fatal config errors to exit 0
  (CI tolerance mode, opt-in).
- **README config reference**: every key documented in one table (previous
  state: flags like `minify`, `hashInCanonicalUrl`, `assetQueryParam`,
  `runHooks` existed in code but nowhere in docs).

### Fixed
- **Sub-path installs (issue #3, crashtest class)**: `basePath` is now the
  canonical-prefix contract - canonical/sitemap/feed/search URLs become
  `site.url + basePath + relative slug`, never stripping the prefix and never
  doubling it when the output tree nests the deploy directory.
- **Snippet placeholders actually substitute (issue #10)**: custom snippets
  (`inject-header.html`, `inject-body-start.html`, `inject-footer.html`) now
  get `{{siteName}}`/`{{siteUrl}}`/`{{buildHash}}`/... replaced, matching what
  the docs always claimed; comments still stripped before injection.
- **Template comment drift (issue #10)**: `inject-footer.html` no longer
  claims it is injected after `</body>` (code injects before).

### Batteries
- New pins: renamed-config discovery, legacy back-compat, diagnostics
  warnings, `--tolerant`, exit codes, basePath one-prefix semantics (both
  tree shapes), opt-in search.

### Docs (Phase 3 frame port + Phase 4 hardening)
- Single-source nav: `docs/_data/nav.yml` is now THE menu layer (top nav and
  sidebar both render `site.data.nav`); `_plugins/nav_generator.rb` and the
  `generateNav`/`nav_sections`/`nav_order` config knobs are deleted (the
  retired-key diagnostics still catch stragglers).
- Docs-audit gates ported from prestruct (`scripts/run-docs-audit.cjs`, wired
  into test.yml CI): frontmatter, links, nav symmetry, style, and
  truthfulness (docs-promised CLI flags and config keys must exist).
- Real docs warts caught by the first audit run are fixed: a missing fence
  closer in the config reference that had silently flipped parity for the
  whole file, CDN purge examples that showed top-level `purge:` (invalid
  nested shape), a `hash: true` example of a retired key, stale
  `ssr-config.yml` references across guides renamed to
  `freestruct.config.yml`, emoji in prose, untagged code fences, and a
  broken layout link in the style guide.
- README rewritten around a working quick start (install - config - build -
  verify - flags), an honest opt-in search story, and a Releases section;
  version pinned (0.6.0, frozen per owner call).
- Pagefind indexing in the docs workflow moved to the official npm dist
  (`npm install --no-save pagefind` + `npx pagefind`); the global install is
  gone.
- Link-check graduated: the docs CI now runs the injector with `--strict`,
  so broken internal links fail the GitHub Pages build (report-only stayed
  the default for consumers).
- **Tarball e2e is a committed CI gate** (`scripts/e2e-install.cjs`, wired
  into both test.yml and publish.yml): packs the real tarball, installs it
  fresh, and drives the README quick start through the bin shim.
- Two fresh-install bugs it caught (both invisible in repo-shape runs):
  template resolution now falls back to the package-shipped `_freestruct/`
  directory instead of exiting 2 on every consumer install, and the
  main-module guard is symlink-safe so the npm-installed `freestruct`
  command actually runs instead of exiting 0 silently.
- The battery version pin now enforces exactly 0.6.0 (owner freeze) across
  package.json, README, and CHANGELOG.

## [0.5.0] - 2026-10-21

Phase 1 of the v1.0.0 rehaul (PRD: labs/prd-freestruct.md) - runtime decision
lands, the monolith dies, and the behavior-changing wart classes get fixed.

### Changed
- **ESM runtime**: package is now `"type": "module"`, engines `node >= 20`
  (owner-ratified decision).
- **Module decomposition**: the 577-line `inject.js` monolith is now eight
  focused modules - `config.js`, `scan.js`, `seo.js`, `xmllike.js`,
  `notfound.js`, `linkcheck.js`, `search.js`, `hooks.js` - with a single CLI
  orchestrator (`docs/lib/inject.js`) that composes named steps.
- **Root resolution**: the config is discovered by walking UP from the cwd
  (running from a repo subdir works); templates/snippets resolve next to the
  config file; the output dir defaults to `<configDir>/_site`.

### Fixed
- **XML correctness class (issue #9)**: sitemap/RSS values are XML-escaped
  through one shared helper; sitemap entries carry a real per-page
  `<lastmod>` (the page's own mtime, not the build time); RSS `pubDate` comes
  from each page's mtime instead of one shared build stamp.
- **noindex honored by default (issue #5, owner call)**: pages carrying a
  noindex robots meta no longer ship into sitemap.xml, feed.xml, or
  search.json. `--strict` retains a tripwire against future leak classes.
- **404 pipeline (issue #11)**: generated 404s get the full SEO injection
  (canonical, OG, JSON-LD, description) plus the noindex meta the CHANGELOG
  has claimed since 0.2.2; user-supplied 404.html files get the same
  treatment instead of a build-tag-only pass; 404 pages feed the late passes
  (reading-time/last-modified/lazy-load) consistently; they remain excluded
  from sitemap/feed/search.
- **Plain description meta**: bare pages now actually receive the template's
  `<meta name="description">` (0.4.x silently dropped it).
- **Root page slugs**: the root `index.html` has canonical/og:url/sitemap loc
  `/` (was the pageUrl precedence wart `/index`); search.json URLs are built
  from scanned slugs, ending the `noindex.html` -> `/no` mangling.
- **CLI/flag wiring**: `--strict` and the positional output-dir override no
  longer collide (was `process.argv[2]` raw-flag capture).

### Wart flips
The battery's Phase 0 wart pins for the above behaviors were consciously
flipped to their fixed expectations in the same change. Remaining wart pins
(link-check report-only #4, snippet placeholder substitution #10, sitemap
basePath handling #3) are Phase 2 work and are still pinned as-is.

## [0.4.0] - 2026-10-21

Phase 0 of the v1.0.0 rehaul (PRD: labs/prd-freestruct.md) - regression-proof
the current behavior, make packaging truthful. **Default behavior is
unchanged**; the battery pins it, warts included, so Phase 1 refactors cannot
silently regress metadata.

### Added
- **Test battery**: `npm test` now runs a real asserting battery
  (`test/run.js`, Node 20 built-in test runner) against a committed fixture
  site - SEO injection, missing-only gating, sitemap/robots/feed/search.json,
  the 404 pipeline (generated + custom), reading-time/last-modified/lazy-load,
  link check, feature-flag-off run, error-path exits, and CLI flags. Known
  bugs are pinned as WART assertions (see issues #4, #5, #9, #10, #11).
- **`--version` flag**: prints the package.json version; works with no config
  present (part of issue #2/#6 packaging truth).
- **`--strict` flag**: opt-in strictness - broken internal links and noindex
  pages leaking into sitemap/feed/search.json now exit 1 (issue #4 posture;
  default runs stay report-only).
- **Shebang** on `docs/lib/inject.js` so `npx freestruct` can work (issue #2).
- **CI workflows**: test battery on every push/PR; dormant `publish.yml`
  (npm Trusted Publisher on `v*` tags, per the prestruct runbook) and
  `release.yml` (GitHub releases alongside npm publishes).
- **Version truth gate**: the battery pins README == package.json == CHANGELOG
  versions and parses the README config example as YAML (issues #7, #8).

### Changed
- Engines bumped to Node >= 20 (the pre-ESM step of the runtime decision).

### Wart pins (current behavior, deliberate)
- Root page canonical/og:url/sitemap loc keep a trailing `/index` slug
  (`pageUrl` precedence bug).
- Search index URLs mangle any page whose filename ends in `index.html`
  (`noindex.html` -> `.../no`).
- `noindex` pages ship into sitemap/feed/search.json (issue #5).
- XML feeds/sitemaps are assembled without escaping (issue #9) - the
  fixture's raw-ampersand title pins it.
- Broken links report but exit 0 (issue #4); strict mode opts out.

## [0.3.2] - 2026-05-02

### Added
- **Dynamic Navigation**: Auto-generates nav from docs folder structure. Folders become collapsible sections, files become links. Configure via `nav_sections` and `nav_order` in `_config.yml`.
- **generateNav**: Add config to disable dynamic nav. Set `generateNav: false` to use SSG menu instead (full non-SSG build).
- **Navigation Guide**: New docs/guides/navigation.md covering nav config, sorting, and SSG menu passthrough.
- **Error Handling**: Added validation for config file, YAML parsing, `site` section, output directory, and template file. Exits with clear errors on misconfiguration.
- **Security**: `runHooks` flag - purge hooks disabled by default, must set `runHooks: true` to enable.

### Fixed
- **Purge Hooks**: Code was executing `execSync` but logging "disabled for safety" - inconsistent. Now properly disabled by default.
- **Vant Reference**: Fixed layout comment from "Vant docs" to "Freestruct docs".

### Docs
- Added [Dynamic Navigation](/guides/dynamic-nav) guide
- Updated [ssr-config.yml Reference](/guides/ssr-config) with cacheBusting and runHooks options
- Updated [Cache Busting](/guides/cache-busting) with runHooks documentation
- Updated README Security section with runHooks flag

## [0.3.1] - 2026-05-02

### Added
- **Gap-filling SEO**: freestruct now detects existing SEO from SSG/frontmatter and only injects missing pieces. Avoids duplicating OG, Twitter, JSON-LD, or canonical tags.
- **Frontmatter title**: Extracts title from `<meta name="title">` first (rendered from frontmatter), falls back to `<title>` tag.
- **Description fallback**: Falls back to site config if page has no description (prevents "undefined").

### Fixed
- Description could show as "undefined" when page had no meta description.

### Changed
- Test script now creates output directory automatically.

## [0.3.0] - 2026-04-25

### Added
- **RSS Feed**: Generates feed.xml with all pages. Configure via `generateFeed: true` (on by default).
- **Reading Time**: Injects estimated read time into each page (`<meta name="reading-time">`). Configure via `readingTime: true`.
- **Last Modified**: Injects build timestamp (`<meta name="last-modified">`). Configure via `lastModified: true`.
- **Lazy Loading**: Auto-adds `loading="lazy"` to images. Configure via `lazyLoad: true`.
- **Link Check**: Validates internal links, warns on broken ones. Configure via `linkCheck: true`.
- **Search Index**: Generates search.json for client-side search. Configure via `searchIndex: true`.

### Security
- **Purge Hooks**: Added warning in docs. Commands in `ssr-config.yml` execute via `execSync`. Only run trusted commands.

## [0.2.4] - 2026-04-25

### Added
- **Auto 404 page**: Generates helpful 404.html with search form, links to home/docs, and styled message when no custom 404 exists.
- **Robots.txt**: Auto-generates robots.txt with sitemap reference. Configure via `generateRobots: true` in config.
- **Minify HTML**: Optional HTML minifier (experimental, off by default). Conservative - preserves pre/script/style/textarea content.
- **Custom injection hooks**: Auto-load include files if they exist:
  - `docs/_freestruct/inject-header.html` - before `</head>`
  - `docs/_freestruct/inject-body-start.html` - after `<body>`
  - `docs/_freestruct/inject-footer.html` - before `</body>`
  - Location changed from `_includes` to `_freestruct` to avoid SSG collisions
  - Supports placeholders: `{{siteName}}`, `{{siteUrl}}`, `{{buildHash}}`

### Fixed
- **Asset cache busting consistency**: Fixed bug where assets got stale hash from previous builds. Now properly strips existing `?v=` query params before adding fresh hash. Meta tag and assets always use the same current build hash.
- **Canonical URL injection**: Fixed duplicate canonical tags by removing existing canonical before injecting new one. Each build now has exactly one correct canonical URL.
- **404.html regeneration**: Now properly removes old freestruct-build meta tags when regenerating 404.html.

### Testing Verified
- ✅ Build hash updates correctly on each run (different hash each build)
- ✅ Assets get same hash as meta tag (consistent across page)
- ✅ Old `?v=` params properly stripped (even `?v=old` gets replaced)
- ✅ Canonical URL replaced correctly (no duplicates)
- ✅ sitemap.xml generates correctly
- ✅ 404.html gets fresh hash with search form

## [0.2.3] - 2026-04-25

### Added
- **Asset cache busting**: Automatic `?v={hash}` appended to CSS, JS, images, fonts, icons, wasm, json on every build. Works with any SSG - just scans output HTML and adds query params. Configurable via `cacheBusting.assetQueryParam` (default: true).
- **hashInCanonicalUrl option**: Added `cacheBusting.hashInCanonicalUrl` to optionally add `?v={hash}` to canonical URLs (default: false).
- **Extended asset support**: Now busts fonts (woff, woff2, ttf, otf), icons (ico), and other assets (wasm, json).

### Fixed
- Canonical URLs no longer have `?v=` by default - was causing issues with some setups.

### Docs
- Added "CDN Cache Headers" section with recommended settings for CloudFlare and CloudFront

## [0.2.2] - 2026-04-24

### Added
- **Sitemap generation**: `generateSitemap` option creates `sitemap.xml` automatically (frame-agnostic, no SSG plugins needed)
- **404 page generation**: `generate404` option creates `404.html` with SEO meta tags + noindex
- **Custom 404 support**: If `404.html` exists in output dir, use it instead of generating

### Fixed
- 404.html includes `<meta name="robots" content="noindex, nofollow">` to prevent indexing
- Sitemap excludes 404 page

## [0.2.1] - 2026-04-24

### Fixed
- `injectMissingSeo` return type - was returning full HTML causing duplication
- Update URLs for freestruct.creadev.org deployment

### Added
- `basePath` config option to strip subpath from canonical URLs (e.g., `/freestruct`)

### Changed
- Site URL updated to http://freestruct.creadev.org

## [0.2.0] - 2026-04-24

### Fixed
- Broken `inject.js` refactors causing runtime errors
- Source attribution in injected HTML

### Added
- `preserveExistingMeta` option (default: true) - selectively injects only missing tags
- `injectMissingSeo()` - filters tags that already exist on page
- `removeExistingSeo()` - removes existing SEO before clean injection
- Source comment in injected HTML: `<!-- injected by freestruct: https://github.com/dhaupin/freestruct -->`

### Changed
- Reset inject.js to stable baseline version
- Removed unused `process.argv` require

## [0.1.0] - 2026-04-23

### Added
- Frame-agnostic SEO injection for SSG doc sites
- `outputDir` configurable per SSG (Jekyll, Hugo, Docusaurus, etc.)
- Per-page config via `<!-- freestruct: {...} -->` comments
- `preserveExistingMeta` option for selective injection
- Template-based SEO injection