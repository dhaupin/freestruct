# Changelog

All notable changes to freestruct will be documented here.

## [0.2.3] - 2026-04-25

### Added
- **Asset cache busting**: Automatic `?v={hash}` appended to CSS, JS, and image assets on every build. Works with any SSG - just scans output HTML and adds query params. Configurable via `cacheBusting.assetQueryParam` (default: true).
- **hashInCanonicalUrl option**: Added `cacheBusting.hashInCanonicalUrl` to optionally add `?v={hash}` to canonical URLs (default: false).

### Fixed
- Canonical URLs no longer have `?v=` by default - was causing issues with some setups.

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