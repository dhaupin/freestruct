# Changelog

All notable changes to freestruct are documented here.

## [Unreleased]

### Added
- **Frame-agnostic SEO injection** - Works with any SSG (Jekyll, Hugo, Docusaurus, etc.)
- **ssr-config.yml** - Centralized config for all SEO meta, OG, Twitter, JSON-LD
- **inject-brand.html** - Template with `{{placeholder}}` syntax for post-build injection
- **lib/inject.js** - Node.js tool that reads config + template and injects into built HTML
- **outputDir** - Configurable per SSG (Jekyll: `_site`, Hugo: `public`, etc.)
- **preserveExistingMeta** - Option to keep existing meta tags instead of removing
- **Per-page config** - Page-specific SEO via `<!-- freestruct: {} -->` comment
- **GitHub Actions workflow** - CI/CD with freestruct integrated

### Changed
- SEO now injected post-build, not at SSG build time
- Layouts no longer need includes - just `<!-- freestruct SEO -->` marker
- No Jekyll plugins required for SEO

### Fixed
- Links now use `relative_url` for correct baseurl
- Build errors from missing `seo.html` include resolved

---

## [0.1.0] - 2026-04-24

### Added
- Initial freestruct Jekyll theme
- Minimal CSS with CSS variables
- Built-in SEO via jekyll-seo-tag
- Sitemap generation
- Responsive layout
- Pagefind search integration
