# Changelog

All notable changes to freestruct docs are documented here.

## [Unreleased]

### Added
- PageFind search integration with custom modal UI
- Search opens via click or Cmd/Ctrl+K

### Fixed
- Search module path: `/freestruct/pagefind/pagefind.js` (not `/pagefind/...`)
- Use ES module dynamic import + `await pagefind.init()` pattern

### Removed
- Unused `_theme/` folder (dead code)
- Stale theme comments in config

---

## [0.1.0] - 2026-04-24

### Added
- Initial freestruct Jekyll theme
- Minimal CSS with CSS variables
- Built-in SEO via jekyll-seo-tag
- Sitemap generation
- Responsive layout