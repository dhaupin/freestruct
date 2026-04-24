# Changelog

All notable changes to freestruct will be documented here.

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