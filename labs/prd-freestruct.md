# PRD: freestruct (the post-build SEO layer)

**Status:** v0.2 - current (2026-10-29) · Owner: dhaupin
**Role:** product - the post-build SEO engine. It injects complete SEO metadata over any SSG's output tree.
**Package:** `freestruct` @ 1.2.0 (node >=20). npm latest is 1.1.0; 1.2.0 is committed and pending the tag.
**Core law:** one command after the build; every generated artifact is escaped or the build fails loudly.
**Family:** the five arms are **govstruct** (govern), **packstruct** (spec),
**crashtest** (attack), **eyestruct** (watch), **poststruct** (audit). The forges
are **monoforge** (the repo stamp) and **coreforge** (the site rig); **railyard**
is the composer. freestruct is a **product** governed by the suite: it is the
after-build leg of the SEO trio (prestruct before, freestruct after, poststruct
checks what shipped). The interop law: no host imports a sibling to check a
sibling; it invokes the sibling's public CLI.

---

## 1. One-line pitch

Freestruct is a post-build SEO layer for static doc sites: build with any SSG,
run one command, get complete SEO/OG/JSON-LD metadata, sitemap, robots, RSS,
404, search index, and cache-busting across the output tree. One dependency
(`js-yaml`), no SSG plugin, no template edits.

## 2. The family trio

freestruct is one leg of the family's SEO contract:

| leg | when | what it does |
|---|---|---|
| **prestruct** | before the build | renders every route to static SEO-HTML, injects meta |
| **freestruct** | after any SSG | injects complete SEO metadata over the built tree |
| **poststruct** | after everything | audits what actually shipped; FAIL findings exit non-zero |

freestruct is the SSG-agnostic leg: it runs over Jekyll, Hugo, Docusaurus,
MkDocs, VitePress, Astro, or Eleventy output. It owns metadata being
Pagefind-friendly (canonical, noindex) and does not ship a competing search
index unless a user opts in.

## 3. What shipped (the rehaul, verified against the tree at HEAD)

The rehaul is complete. The old `docs/lib/inject.js` CommonJS monolith is gone;
the engine is decomposed into testable modules:

| module | concern |
|---|---|
| `engine/config.js` | config discovery (`freestruct.config.yml`, then legacy `ssr-config.yml`), validation, structured `[freestruct]` diagnostics |
| `engine/scan.js` | tree walk plus page model |
| `engine/seo.js` | meta/OG/Twitter/JSON-LD injection (missing-only) |
| `engine/xmllike.js` | escaping plus sitemap plus RSS |
| `engine/notfound.js` | the 404 pipeline |
| `engine/linkcheck.js` | internal-link validation (report-only by default, `--strict` fatal) |
| `engine/search.js` | the opt-in `search.json` |
| `engine/llms.js` | the opt-in `llms.txt` summary |
| `engine/indexnow.js` | the IndexNow key file plus submission |
| `engine/ogimage.js` | per-page OG image generation (optional rasterizer) |
| `engine/hooks.js` | post-render hooks with purge-command safety |
| `engine/urls.js` | basePath-aware canonical/sitemap/feed URL construction |
| `engine/audit.js` | the independent `freestruct audit` verifier |

The engine composes into one export surface: `inject(options)` built of named
steps. Paths resolve from explicit roots (CLI arg, then config, then a cwd
walk-up), never raw `process.cwd()`.

## 4. The CLI surface

```
freestruct            # discover config + output dir, inject over the tree
freestruct init       # scaffold the config
freestruct validate   # config schema diagnostics
freestruct audit      # verify baked output independently (exit code for CI, --json digest)
freestruct path       # print the resolved config + output roots
freestruct indexnow   # POST the baked URL list to api.indexnow.org (--dry-run prints the body)
```

Flags: `--strict` (broken links and noindex leaks become fatal), `--tolerant`,
`--version`.

## 5. The shipped feature set

- Injects missing title, description, canonical, Open Graph, Twitter cards, and
  JSON-LD (missing-only: existing tags are left alone).
- Feed autodiscovery: every injected head carries the RSS alternate link.
- Attribute-safe everywhere: og/twitter values HTML-escaped, JSON-LD literals
  JSON-escaped, og/twitter images ship only when configured.
- Opt-in discovery blocks: `search`, `breadcrumb`, `article`, `verification`,
  `locales` - all missing-only and loudly diagnostic.
- `llms: true` emits the AI-consumable `llms.txt` summary over the same
  indexable page set sitemap and feed honor (noindex stays honored).
- `og.image` string or structured `{ src, width, height, alt }` object form,
  which emits the companion tags; SVG sources warn loudly, `--strict` fails
  until answered.
- Page-level tuning survives the build: a `<!-- freestruct: {...} -->` comment
  overrides title/description/ogType/ogImage/twitterCard and adds article meta.
- Honest canonical URLs including sub-path (`basePath`) installs, held for the
  sitemap locs, robots sitemap pointer, RSS links, and the 404 home link.
- `sitemap.xml`: encoded URLs, real per-file `lastmod` (page mtime, not build
  time), noindex pages excluded.
- `robots.txt`: `User-agent: *` plus `Allow: /` plus a basePath-aware sitemap
  pointer.
- `feed.xml` (RSS): escaped titles/descriptions, per-page `pubDate` from each
  page's own mtime, basePath-aware channel/self links.
- `404.html`: generated when missing, gets the full SEO pipeline plus explicit
  noindex; a user-supplied 404 gets the same treatment.
- Cache-busting (asset query params), lazy loading, reading time.
- Config schema with loud diagnostics; unknown and retired keys never die
  silently.
- Link validation (report-only by default, `--strict` fatal; the docs CI runs
  `--strict`).
- `freestruct audit` verifies baked output independently.
- IndexNow support (issue #19): the key file ships during the run; submission
  is the post-deploy step.
- Slug-glob scoped config (issue #25): `jsonLd` and `og.scoped` accept a map
  keyed by page-slug globs, most specific match wins.
- Per-page OG image generation (issue #22): renders a branded 1200x630 PNG from
  a consumer SVG template; the optional rasterizer loads lazily and the run
  stays green with a loud skip when it is not installed.

## 6. The pack

freestruct ships `packs/public/freestruct-docs-shapes` under the packstruct
`check` profile - the audit shapes for its own docs output. The interop law
holds: the pack invokes sibling CLIs, never imports sibling internals.

## 7. The rehaul ledger (the warts, all closed)

The 2026-10-20 rehaul PRD read the old tree and named twelve warts. All are
closed:

| # | wart (as read) | closed by |
|---|---|---|
| F1 | one 577-LOC CommonJS monolith | the module decomposition (section 3) |
| F2 | path assumptions are cwd-shaped | explicit root resolution (CLI, config, walk-up) |
| F3 | the npm quickstart cannot work as written | bin shim, `files` whitelist, package-resolved templates |
| F4 | no tests exist | the fixture-site battery plus the tarball e2e |
| F5 | XML correctness class (unescaped sitemap/RSS) | the shared escape helper plus real per-file lastmod |
| F6 | config/template contract gaps | document-or-remove; the README example YAML is parsed by a test |
| F7 | 404 pipeline inconsistencies | the generated 404 gets the full pipeline plus noindex |
| F8 | own site disbelieves itself (http vs https) | scheme truth pinned in `_config.yml` |
| F9 | report-only behavior is the default posture | `--strict`; noindex honored by default |
| F10 | version/release story is unverifiable | tags plus releases plus npm plus README all agree |
| F11 | README config example is invalid YAML | regenerated together with the schema, parsed in a test |
| F12 | search.json overlaps Pagefind | kept as opt-in (`searchIndex: true`); docs stay Pagefind-only |

## 8. Release truth

- **Version is truth-checked.** The battery pins the version across
  `package.json`, the README, and the CHANGELOG, so a release cannot leave one
  behind.
- **Tarball e2e in CI.** `scripts/e2e-install.cjs` packs the real tarball,
  installs into a throwaway project, runs the README quick start through the bin
  shim, and asserts the artifacts. It is wired into `test.yml` and is a hard
  gate in `publish.yml`.
- **Publish ladder.** Bootstrap manual publish once (npm OIDC cannot create a
  package), then the Trusted Publisher fires on `v*` tags with provenance.
- **Dormant by default.** The publish workflow is merged and inert until a tag.

## 9. Non-goals

- **No SSG plugin.** freestruct runs over output, never inside a generator.
- **No competing search index by default.** Pagefind owns the docs search; the
  built-in index is opt-in.
- **No silent green.** `--strict` turns report-only classes fatal.
- **No unescaped XML.** A value that still produces invalid XML is a loud build
  error, not a bad sitemap.

## 10. Working rules

- Every phase row needs a `TASKS.md` pass entry when it moves.
- Behavior parity is asserted by the fixture battery at each step.
- Consumer scaffolding comes from the package, never from the consumer's cwd.
- The docs site passes the same audit gates prestruct and vant pass.
