# Changelog

All notable changes to freestruct are documented here.

---

## [0.2.0] - 2026-04-25

### Added
- **Complete marketing landing page** - Pain-focused messaging, comparison tables, clear CTAs
- **Getting Started rewrite** - TL;DR first, step-by-step instructions, SSG-specific examples
- **Full cache busting system** - SHA1 hash injected into every page + canonical URL
- **CDN purge hooks** - Run any shell command after build (CloudFlare, Fastly, etc)
- **Auto-sitemap generation** - Creates sitemap.xml with all pages automatically
- **404.html generation** - SEO-optimized 404 if missing
- **Security hardening** - All user inputs sanitized, hash always hex-safe

### Changed
- inject.js generates SHA1 build hash per build
- All HTML includes `<meta name="freestruct-build">` and canonical with `?v=`
- Purge hooks now execute (run shell commands from config)
- outputDir: CLI arg overrides config (for CI/CD flexibility)
- SEO template includes full Open Graph + Twitter Cards + JSON-LD

### Fixed
- outputDir priority: CLI arg now takes precedence over config file
- Empty directory crash: Only generate sitemap/404 if HTML files exist
- Broken regex in canonical URL (was causing build failure)
- Double-slash in URLs when site.url has trailing slash
- Undefined config crash (added null safety everywhere)
- sed regex special characters in URLs properly escaped

---

## [0.1.1] - 2026-04-24

### Fixed
- Mobile nav CSS inside `<style>` block (was outside `</html>`)
- Mobile hamburger menu toggle works

---

## [0.1.0] - 2026-04-24

### Added
- Initial freestruct release
- Basic SEO meta injection
- jekyll-seo-tag integration
- Minimal responsive layout
