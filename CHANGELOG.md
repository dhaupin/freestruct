# Changelog

All notable changes to freestruct will be documented here.

## [0.3.3] - 2026-04-25

### Added (Massive expansion - 80+ new tools)
**Batch output generators** (80+)
- batchPass1-12: b1-b12.json
- bigBatch: 58-feature list → big-batch.json
- moarPass1-12: moar1-moar12.json
- ultraPass1-10: u1-u10.json
- megaPass1-10: mega1-mega10.json
- hyperPass1-10: h1-h10.json
- omegaPass1-10: o1-o10.json
- deltaPass1-10: d1-d10.json

**Content analysis** (12 new)
- headingsTree: Nested → headings-tree.json
- fullToc: Table data → full-toc.json
- extractLists: ul/ol → lists.json
- extractQuotes: blockquote → quotes.json
- rawBlocks: pre/code → raw-blocks.json
- externalResources: CDN/fonts → external-resources.json
- robotsMeta: noindex → robots-meta.json
- documentMap: All docs → document-map.json
- extractFavicons: icon refs → favicons.json
- viewportMeta: Mobile → viewport.json
- langAttrs: html lang → lang-attrs.json

### Stats
- **2311 lines, 181 functions, 99+ outputs, 0 dependencies**

### Docs
- FEATURES.md: Full feature list documented

## [0.3.2] - 2026-04-25

### Added (8 rounds = 48 new tools)
**Config generators** (36 new)
- docVersion, extractEmails, localeConfig, extractCssClasses, darkModeConfig, analyticsConfig
- pwaConfig, ogConfig, footerLinks, socialLinks, navbarConfig, extractVideos
- mermaidConfig, diagramConfig, extractMath, chartConfig, highlightConfig, extractEndpoints
- sidebarConfig, tocConfig, extractScripts, extractStyles, paginationConfig, searchUx
- docsetConfig, algoliaConfig, pagefindConfig, mermaidThemes, codegroupConfig, tabsConfig
- adsConfig, commentConfig, feedbackConfig, donateConfig, announcementConfig, calloutsConfig
- badgeConfig, cardConfig, menuConfig, modalConfig, tooltipConfig, copyButtonConfig
- versionDropdown, languagePicker, themePicker, manifestRefs, sitemapIndex, buildManifest

### Stats
- **2218 lines, 106 functions, 88 outputs, 0 dependencies**

### Agent Tools (8 new)
- **extractApis**: Extract functions/classes from source → apis.json
- **chunkForRag**: Split docs by headings for LLM → rag-chunks.json
- **linkSourceToDocs**: Map source → docs → source-links.json
- **extractExamples**: Parse @example from JSDoc → examples.json
- **generateSidebar**: Auto nav from file structure → sidebar.json
- **injectHeadingIds**: Add id= to h1-h6 for anchors
- **extractTypes**: JSDoc @param/@returns → types.json
- **getGitModified**: git log → git-modified.json
- **indexLinks**: Internal link map → internal-links.json
- **generateSitemapPriority**: Priority by depth → sitemap-priorities.xml
- **generateToc**: Markdown headings → toc.json
- **seoScore**: Per-page SEO → seo-score.json
- **extractFrontmatter**: YAML frontmatter → frontmatter.json
- **detectLanguages**: Code block stats → languages.json
- **wordStats**: Per-page word counts → word-stats.json
- **findOrphans**: Unlinked pages → orphans.json
- **breadcrumbs**: Path-based → breadcrumbs.json

### Feature Tools (6 new)
- **structuredData**: JSON-LD → structured-data.json
- **hreflangs**: i18n → hreflangs.json
- **extractFaq**: Q&A → faq.json
- **metaSummary**: All meta → meta-summary.json
- **duplicateTitles**: Alerts → duplicates.json
- **extractImages**: <img> → images.json
- **extractAllLinks**: Internal/external → all-links.json
- **missingAlt**: img w/o alt → missing-alt.json
- **viewTransitions**: SPA config → view-transitions.json
- **extractKeywords**: Content → keywords.json
- **depthScore**: URL depth → depth-score.json
- **validateUrls**: HTTP refs → url-valid.json

### UX Tools (6 new)
- **readingProgress**: Scroll config → reading-progress.json
- **codeStats**: Code lines → code-stats.json
- **clipboardConfig**: Copy btn → clipboard-config.json
- **extractAnchors**: IDs → anchors.json
- **searchConfig**: Client config → search-config.json
- **emptySections**: Empty pages → empty-sections.json
- **lastUpdated**: Timestamps → last-updated.json
- **twitterHandles**: → twitter-handles.json
- **printConfig**: → print-config.json
- **editLinks**: → edit-links.json
- **extractDates**: YYYY-MM-DD → dates.json
- **copyYear**: Year → year.json

### Configuration
- 27 feature flags added to ssr-config.yml (all on by default)
- All toggleable: `searchIndex: false`, `extractApis: false`, etc.

### Stats
- **1545 lines, 58 functions, 45 outputs, 0 dependencies**

## [0.3.0] - 2026-04-25

### Added
- **RSS Feed**: Generates feed.xml with all pages. Configure via `generateFeed: true` (on by default).
- **Reading Time**: Injects estimated read time into each page (`<meta name="reading-time">`). Configure via `readingTime: true`.
- **Last Modified**: Injects build timestamp (`<meta name="last-modified">`). Configure via `lastModified: true`.
- **Lazy Loading**: Auto-adds `loading="lazy"` to images. Configure via `lazyLoad: true`.
- **Link Check**: Validates internal links, warns on broken ones. Configure via `linkCheck: true`.
- **Search Index**: Generates search.json for client-side search. Configure via `searchIndex: true`.

### Agent Tools
- **Extract APIs**: Generates apis.json from source code (functions, classes).
- **Chunk for RAG**: Generates rag-chunks.json split by headings for LLM.
- **Link Source to Docs**: Generates source-links.json mapping.

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