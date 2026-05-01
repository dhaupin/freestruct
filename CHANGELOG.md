# Changelog

All notable changes to freestruct will be documented here.

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