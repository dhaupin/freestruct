# Changelog

All notable changes to freestruct will be documented here.

## [1.1.0] - 2026-10-25

The first post-stable release: the all-items issue sweep (#17-#24 plus the
#25 follow-on only here by owner direction) and the CI tooling that came
with it, plus the SEO-gap pass landed inside this same untagged version.
Every item below is battery-pinned; the battery grew 49 -> 109.

The SEO-gap pass (eight additions, all opt-in, missing-only, pinned):

- Feed autodiscovery: every injected head carries the
  `rel="alternate" type="application/rss+xml"` link; page-owned
  alternates win
- SearchAction: `search.url` replaces the hardcoded `?s=` potentialAction
  default (no config = a bare WebSite block); a URL without the
  `{search_term_string}` placeholder warns and ships nothing
- Auto BreadcrumbList (`breadcrumb: true`): trail from the URL tree, root
  gets none, manual JSON-LD pages untouched
- Per-page article JSON-LD (`article.scoped`): typed Article /
  TechArticle / NewsArticle from the page facts
- Site verification metas (`verification`): engine-owned provider name
  spellings, unknown providers warn
- hreflang alternates (`locales`): slug-stem swaps across locale trees,
  including x-default from a configured root-document pattern
- `llms.txt` emission (`llms: true`): the AI-consumable docs summary over
  the sitemap/feed page set, missing-only
- `freestruct audit --external`: opt-in HEAD-check (GET retry) of up to
  50 unique external hrefs, warn-grade, json-digest merged

- `freestruct audit`: independent baked-output verification - per-page head
  hygiene (attribute-order-tolerant, missing-only-aware FAIL/WARN mapping),
  the 404 noindex contract, sitemap/robots checks, `--json` digest, exit 0
  clean / 1 findings / 3 missing dir (#18)
- `hooks.postBuild`: general post-build hook seam behind the `runHooks`
  gate - 30s timeout, `$`-placeholders + `FREESTRUCT_SITE_URL` /
  `FREESTRUCT_BUILD_HASH` / `FREESTRUCT_OUTPUT_DIR` env on the child, a
  nonzero exit fails the build with the new documented exit code 4 (#21)
- IndexNow: key-file emission during the run (the keyLocation ownership
  proof; generate-once-and-persist `indexnow-key.txt`), and the
  `freestruct indexnow [--dry-run]` post-deploy submission (post-deploy:
  keyLocation must resolve live) (#19)
- Structured `og.image`: `{ src, width, height, alt, allowSvg }` with
  `og:image:width`/`height`/`alt` companions, string form untouched, the
  SVG blank-card trap warns on every run and fails under `--strict` (#20)
- Per-page OG-image generation: `ogImageGeneration` renders a branded
  1200x630 PNG per page from a consumer SVG template through the optional
  `@resvg/resvg-js` rasterizer (loud skip when absent; sandbox-safe font
  buffers; deterministic bytes; missing-only intact) (#22)
- Slug-glob scoped config: `jsonLd` map form (exact, `*` one segment,
  `**` a sub-tree) and `og.scoped` image variants, most-specific-first,
  malformed entries warn honestly (a list-valued scoped variant ships NO
  image, never synthesized garbage) (#25 + follow-on)
- Latent hardening: config/page-carried values ride function replacers
  everywhere (the `$`-expansion class is dead); `escapeReplacement`
  contracts documented (#24)
- Docs hygiene: the dead prism line-numbers pair removed from the docs
  layout (#17); the announcement draft unwrapped + renamed to
  `announcing-freestruct-v1.0.0.md` (#23)
- CI: packstruct manifest lint joined the push/PR battery beside the
  crashtest pack selftest (pinned-sha installs, cache-owned)
- Final hardening: the audit grades `twitter:site`/`twitter:creator`
  absence only when a handle is configured (symmetry with the injector's
  own no-handle-ships-nothing rule), and the injector refuses to walk an
  SSG SOURCE tree (config file, `_layouts/` or template staging inside
  the output dir) - the wrong-positional class that stamped build meta
  into committed template copies now aborts loudly with exit 3 and the
  fix spelled out; staged-dirs-only sentinels (a built _site legitimately
  carries the config file, so that marker never gates) (#18 + Pass 26.15)
- Family sweep: the link checker resolves root-absolute hrefs against the
  configured `basePath` (a baseurl'd site's nav no longer fails `--strict`),
  config-gated audit absences collapse to one line each with a page count,
  and the release gate is composed - `npm run check` plus a `prepublishOnly`
  hook, with `packs:selftest` degrading to a named skip when no crashtest
  checkout is present (#32, #28, #37, #29)

## [1.0.0] - 2026-10-22

First stable release. The manual npm bootstrap put the package on npm; from
here on, every release publishes from a version tag with provenance
(`.github/workflows/publish.yml` + the Trusted Publisher entry). One truth
number: `1.0.0` agrees across package.json, README, this changelog and
`init/VERSION`, battery-pinned.

This release carries the rehaul-era stack promoted as [0.9.0] plus the
prestruct SEO port wave (attribute escaping, og/twitter card parity,
`author` -> JSON-LD founder, per-page override comments, custom `jsonLd`,
deterministic content hash, the `validate`/`init`/`help` CLI subcommands,
the `FREESTRUCT_URL` env override) and the CI/toolchain bump
(Node-24-compatible action majors, Jekyll 4.4, Ruby 3.4, js-yaml 5.5,
pagefind 1.5.2, prismjs 1.30). Full detail in the entries below.

## [0.9.0] - 2026-10-22

Owner version call: 0.9.0 is the release-truth number for the rehaul-era
stack that accumulated under the 0.6.0 freeze. Nothing in this section is a
new behavior change - it is the promotion of the committed truth:

- Version truth swept repo-wide to 0.9.0 (package.json, README, CHANGELOG
  top entry, `init/VERSION`, the battery's agreement pin, and the release
  runbook example tag); every artifact now names one number.
- Post-0.6.0 work that rides this number: the prestruct-shaped house
  structure (`engine/` + `init/` + `bin/` shim + template sync gate), the
  crashtest pack surface (`packs/`, dogfooded in CI), the tarball-e2e and
  pack-selftest CI gates, the `--strict` graduation into the docs CI (its
  harvest fixed three production 404s), the docs-audit gate family
  (frontmatter/links/nav/style/truthfulness/English-only language/
  engine-header codefmt), the README/AGENTS/DEPLOY meta rewrite, and the
  full audit close-outs (stale claims culled, dead exports retired,
  purge-hook canary pins).

### Added (SEO port wave from prestruct, rides the 0.9.0 number)

- Deterministic, content-derived build hash (prestruct's deploy-id audit
  ported): identical content now yields an identical `freestruct-build` meta
  and `?v=` asset params instead of churning CDN caches on every run; the
  generated head tail, the generated 404 page, late-pass metas and lazy-load
  attributes are excluded from the hash so reruns stay stable
- CLI subcommands mirroring prestruct's surface: `freestruct validate`
  (config-only preflight, exit 1 on fatal errors, no output touched),
  `freestruct init [dir]` (scaffolds the init kit into `<dir>/docs`, never
  clobbers) and `freestruct help` (with the `--help` flag alias)
- `FREESTRUCT_URL` env override implemented (previously documented but never
  honored): replaces `site.url` before every canonical/sitemap/feed consumer,
  announced loudly in the run output
- HTML-attribute escaping for every injected og/twitter/canonical value and
  JSON-safe literals inside the generated JSON-LD (a raw `<` in a value
  renders as `\u003c` and can no longer close the script tag early)
- `og:image` ship-when-set parity: no image configured means no `og:image`
  and no `twitter:image` tag at all (a bare tag pointing at the site root is
  a broken card); `twitter:description` now accompanies `twitter:title`
- `author` config key: ships a schema.org `Person` under `"founder"` on the
  Organization JSON-LD block (previously documented but never implemented)
- Per-page data comments (`<!-- freestruct: {...} -->`) implemented: title,
  description, ogType, ogImage, twitterCard, plus `article:published_time` /
  `article:author` / `article:section` companions (also previously documented
  but never implemented); unknown keys and malformed JSON warn loudly,
  missing-only stays the law
- `jsonLd` config key: a custom JSON-LD object (or array of objects) appended
  to the injected structured data, gated by the same missing-only rule; a
  non-object entry is skipped with a loud config warning

### Changed (toolchain + CI bump, rides the 0.9.0 number)

- GitHub Actions on Node-24-compatible majors (GitHub removed the Node 20
  action runtime on 2026-09-23): checkout v7, setup-node v7, cache v6,
  upload-pages-artifact v5, deploy-pages v5; docs/test CI project node 20 -> 22
- Jekyll 4.3 -> 4.4, Ruby 3.3 -> 3.4 in docs CI; Gemfile trimmed of
  `jekyll-seo-tag` + `jekyll-sitemap` (listed but never loaded by config)
- `js-yaml` 4 -> 5.5.0 (ESM named-import migration, battery-verified);
  pagefind CI pin 1.5.0 -> 1.5.2 (installer cache key bumped); prismjs
  CDN 1.29 -> 1.30
- Release packaging validated dry: `npm pack` tarball is exactly the 25-file
  files whitelist (bin + engine + init + LICENSE/README/package.json); the
  GitHub release source tar mirrors the tracked tree (the battery fixture's
  pre-built `_site` ships by design - it is the battery's input state)
- `docs/discussions/announcing-v1.0.0.md` draft added (the prestruct-style
  Discussions post, ready for the tag)

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
  doubling it when the output tree nests the deploy directory. A follow-on
  audit pass found the same class hiding in three more spots now also under
  the contract: the `robots.txt` sitemap pointer, the RSS channel link and
  `atom:link` self-reference, and the generated 404's home link (its old
  hard-coded text/`links` guess never resolves on any layout).
- **Snippet placeholders actually substitute (issue #10)**: custom snippets
  (`inject-header.html`, `inject-body-start.html`, `inject-footer.html`) now
  get `{{siteName}}`/`{{siteUrl}}`/`{{buildHash}}`/... replaced, matching what
  the docs always claimed; comments still stripped before injection.
- **Template comment drift (issue #10)**: `inject-footer.html` no longer
  claims it is injected after `</body>` (code injects before).

### Batteries
- New pins: renamed-config discovery, legacy back-compat, diagnostics
  warnings, `--tolerant`, exit codes, basePath one-prefix semantics (both
  tree shapes), opt-in search - plus (pass 16) the two purge-hook canaries
  that gave the shell-command surface zero-trust coverage (disabled-by-
  default proof + truthful substitution proof, battery now 41 pins), and
  the basePath pin grew robots/feed/404-pointer assertions. `scan.js`'s
  robots-meta stripper now has its one intended caller (the 404 pipeline
  had been duplicating its regex).

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
  gone. (Now pinned `pagefind@1.5.0` and cache-guarded by version after
  step telemetry showed a 355s cold binary resolution on runners.)
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
- First real `--strict` CI run harvested and green: `docs.yml` itself was
  unparseable YAML (unquoted `cd:` / `--strict:` inside step names), which
  had silently disabled the Pages verifier for two pushes - workflow files
  are now battery-pinned to parse, and strict mode's first catch (three
  production-404 links in the style guide, two of them pretty-permalink
  `.html`-suffix mistakes, one pointing outside the built tree) is fixed.

### Crashtest pack surface (owner-directed)
- **`packs/` is now a shipped repo surface** (`packs/README.md` covers
  crashtest, the one-surface pack model, and links; adoption is one `packs:`   line) with the first pack: **`freestruct-docs-shapes` 0.1.1** (0.1.1:
   the noindex oracles tightened to true content-shape after a docs page
   that legitimately DISCUSSES noindex false-positived EXPLOITED in the
   live dogfood - a shape lesson, recorded in the source) - five
  zero-dependency, zero-socket attacks over a freestruct-built docs tree as
  served by any static host: hostile-traversal-404, gen404-noindex-canary
  (#11 contract), noindex-artifact-leak (#5 rule), canonical-query-poison,
  sitemap-xml-shape-canary (#9 escape class).
- Dogfood wiring: `labs/static-site-target.js` (GitHub Pages-class static
  host double) + root `crashtest.config.js` (`SITE_ROOT`, default
  `docs/_site`); docs CI runs the campaign against the built tree after
  the strict step (EXPLOITED rows fail the Pages build).
- `scripts/packs-selftest.cjs` proves the teeth both ways: the hardened
  build holds every attack as REFUSED, a deliberately regressed tree trips
  every planted oracle. The pack surface is battery-pinned (39/39).

### Docs + repo surface (owner-directed)
- **README completely rewritten** around the verified quick start, with the
  full crosslink surface: the docs site (freestruct.creadev.org), the
  Creadev docs system, the family sites (prestruct.creadev.org,
  docs.creadev.org/prestruct, crashtest), and the agent/ops meta files.
- **AGENTS.md + DEPLOY.md added at the repo root**, crosslinked with each
  other and the README: house rules, gates, phase discipline (AGENTS) and
  the Pages pipeline + npm release runbook + cache discipline (DEPLOY).
- **Docs-audit gates extended (cherry-picked from the vant/prestruct gate
  family):** the English-only language gate (`scripts/check-language.cjs`,
  longest-Unicode-script-run detection with URL/import exemption) and the
  vant voice/style checks (no em/en dashes in prose with CHANGELOG exempt,
  tabs, table-row shape, inline-code-as-data posture). A new codefmt gate
  pins every engine source header to `// engine/<file>.js - <purpose>` so
  comments tell the reader where they are after any move.
- **Repo hygiene:** `.gitignore` modernized (build outputs, env files, tool
  caches, crashtest run artifacts, editor noise) and `.ignore` added so
  search-space stays clean beyond git's own interest.

### House structure (prestruct-pattern, owner-directed)
- **`engine/`** is the shipped runtime (`engine/inject.js` + the eight lib
  modules, previously `docs/lib/`); `main`/`exports` point at it; the CLI is
  a thin `bin/freestruct.mjs` shim (prestruct's `bin/cli.mjs` pattern).
- **`engine/_freestruct/`** is the canonical packaged template set;
  `docs/_freestruct/` (the example site) and **`init/`** (new consumer
  scaffold kit: `VERSION`, `README`, starter config, template copies) hold
  synced copies. `scripts/sync-templates.mjs check` is a CI drift gate
  (the W1 engine-drift lesson, encoded).
- `/docs` stays the example (no new example folder); Jekyll no longer copies
  source code into `_site` (the `docs/lib` leak is gone).
- `files` whitelist is `bin/`, `engine/`, `init/` (with `node_modules` and
  dist exclusions); the package now also `exports ./init/*` so the kit is
  consumable via `cp -r node_modules/freestruct/init/docs .`.
- no compat shims for old paths: the package was never published, and there
  are no external consumers yet; the version freeze (0.6.0) stays.

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
- [x] Build hash updates correctly on each run (different hash each build)
- [x] Assets get same hash as meta tag (consistent across page)
- [x] Old `?v=` params properly stripped (even `?v=old` gets replaced)
- [x] Canonical URL replaced correctly (no duplicates)
- [x] sitemap.xml generates correctly
- [x] 404.html gets fresh hash with search form

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