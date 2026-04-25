# Changelog

All notable changes to freestruct are documented here.

## [Unreleased]

### Added
- **Cache Busting** - Built-in CDN-agnostic cache invalidation:
  - Automatic build hash generation (SHA1 of config + timestamp)
  - Injects `<meta name="freestruct-build">` into every page
  - Adds `?v={hash}` to canonical URLs
  - **Purge hooks** - Run any shell command post-build:
    ```yaml
    cacheBusting:
      purge:
        - name: cloudflare
          command: curl -X DELETE "https://api.cloudflare.com/..." -H "Authorization: Bearer $TOKEN"
        - name: fastly  
          command: fastly-purge $SERVICE_ID $KEY $SITE_URL
    ```
  - **Agnostic** - Works with ANY CDN or caching system
  - Hash always generated (can disable via `hash: false`)
  - Available env vars: `$SITE_URL`, `$BUILD_HASH`, `$OUTPUT_DIR`

### Fixed
- Mobile nav CSS inside `<style>` block (was outside `</html>`)
- Mobile hamburger menu toggle works

### Changed
- inject.js generates SHA1 build hash per build
- All HTML includes `<meta name="freestruct-build">` and canonical with `?v=`
- Purge hooks now execute (run shell commands from config)
- outputDir: CLI arg overrides config (for CI/CD flexibility)

---

## [0.1.1] - 2026-04-24

### Added
- **Frame-agnostic SEO injection** - Works with any SSG (Jekyll, Hugo, Docusaurus, etc.)
- **ssr-config.yml** - Centralized config for all SEO meta, OG, Twitter, JSON-LD
- **inject-brand.html** - Template with `{{placeholder}}` syntax for post-build injection
- **lib/inject.js** - Node.js tool that reads config + template and injects into built HTML
- **outputDir** - Configurable per SSG (Jekyll: `_site`, Hugo: `public`, etc.)
- **preserveExistingMeta** - Keep or selectively inject meta tags instead of removing
- **Per-page config** - Page-specific SEO via `<!-- freestruct: {} -->` comment
- **Selective injection** - In preserve mode, injects only missing tags to avoid duplicates
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
