# PRD: Freestruct rehaul (stone handoff)

**Status:** Planning (pre-rehaul). Authored 2026-10-20 from a full code read.
**Authors:** prestruct agent session, on behalf of the owner.
**Reads first:** freestruct README.md, CHANGELOG.md, issue tracker (#2-#8),
docs/lib/inject.js, package.json.
**Temp location note:** this PRD is the last piece still living in the
prestruct repo's /horcrux folder as a handoff mailbox. The brain itself
(identity/goals/start/progress/lessons) already moved into the vant install
at models/private/freestruct/, and its public stone
(freestruct-p_v5frogstone2026.svg) sits beside this file. The PRD belongs in
the freestruct repo the moment the rehaul starts.

---

## 1. Product one-liner

Freestruct is a post-build SEO layer for static doc sites: build with any SSG,
run one command, get complete SEO/OG/JSON-LD metadata, sitemap, robots, RSS,
404, search index, and cache-busting across the output tree.

---

## 2. Where the rigging is wacky (verified, not vibes)

| # | Wart | Evidence | Tracker |
|---|------|----------|---------|
| F1 | **One 577-LOC CommonJS monolith** is the entire product: `docs/lib/inject.js` holds SEO injection, sitemap, robots, RSS, 404, link check, search index, hooks. CHANGELOG 0.3.1 exists as a "gap-filling" release because the 0.3.0 refactor regressed metadata - the churn rate a monolith produces. | file stats + changelog | new work |
| F2 | **Path assumptions are cwd-shaped**: config, brand template, and optional snippet files are read from `<process.cwd()>/docs/...`; default output `docs/_site`. Run it from anywhere else and features die silently (or config-not-found exits). | inject.js | (#6 adjacent) |
| F3 | **The npm quickstart cannot work as written**: bin shim lacks a shebang and the name is unpublished; `files` whitelist ships lib + templates but the consumer's CWD must still supply `docs/ssr-config.yml` + `_freestruct/` templates, which `npm install` does not scaffold. | package.json, issue #2, registry 404 | #2 #6 |
| F4 | **No tests exist.** `npm test` is a non-asserting smoke run; the CHANGELOG's "Testing Verified" sections have no mechanical counterpart. Every release is a manual-eyeball release. | repo tree | new work |
| F5 | **XML correctness class**: sitemap entries and RSS items are regex-assembled without XML escaping (a title containing `&`/`<` ships invalid XML); sitemap never emits `lastmod`; RSS gives every page the same build timestamp and treats every HTML page as a feed-worthy article. | inject.js | new (report filed) |
| F6 | **Config/template contract gaps**: `cacheBusting.hash` is consulted only to build an unused local variable; `minify` exists in code and neither config nor README; the footer snippet is inserted BEFORE `</body>` while its template comment says "after"; advertised placeholder substitution in custom snippets never happens. | inject.js, inject-footer.html | new (report filed) |
| F7 | **404 pipeline inconsistencies**: the generated 404 page lacks the `noindex` the CHANGELOG claims it has; a user-supplied `404.html` gets only limited cleanup + build tag, not the SEO pipeline; the generated 404 is not added to the later reading-time/lazy-load/search passes. | inject.js, CHANGELOG | new (report filed) |
| F8 | **Own site disbelieves itself**: Jekyll `_config.yml` uses `http://freestruct.creadev.org` while `ssr-config.yml` uses https; the injector preserves an existing canonical, so the live site can ship an http:// canonical. | both configs | new (report filed) |
| F9 | **Report-only behavior is the default posture**: link check reports but never fails; noindex pages still ship into sitemap/RSS/search.json. Silent-green builds are the norm, unless flags most users do not know exist exist. | inject.js, #4, #5 | #4 #5 |
| F10 | **Version/release story is unverifiable**: README says v0.3.0, package.json/CHANGELOG say 0.3.2, no tags, no releases, no npm presence. | README/package.json | #7 |
| F11 | **README config example is invalid YAML** (nested `site:`/`og:`/`twitter:` children float at root level). | README | #8 |
| F12 | **search.json overlaps Pagefind**: freestruct writes its own search index while its own docs workflow indexes with Pagefind and ignores search.json - two search stories, one site, one of them dead output. | docs.yml workflow | new (report filed) |

### Decisions to lock EARLY (candidate list, owner-ratified)

Mirroring the prestruct pattern of "locked, documented, do-not-revisit":

- Config-first, no magic: one config file (`freestruct.config.yml` or keep
  the ssr-config.yml name), validated with structured diagnostics, exit 1 on
  fatal errors (opt-out flag for CI tolerance).
- Paths resolve from explicit roots (CLI arg > config > cwd walk-up), never
  raw process.cwd().
- Escaped-or-fail: all generated XML escapes values via a shared helper; a
  value that still produces invalid XML is a loud build error, not a bad
  sitemap.
- Strictness is graduated but real: `--strict` turns report-only classes
  (link check, noindex leaks) into build failures; CI recipes use it, casual
  runs do not need to.
- One search story: freestruct owns metadata being Pagefind-friendly
  (canonical, noindex) and does NOT ship a competing index unless a user
  opts in.
- Templates ship WITH the package (or are scaffolded by init/copy-the-example),
  never resolved from the consumer's CWD by accident.

---

## 3. Phases

### Phase 0 - Safety net + packaging truth (first PR)

Goal: regression-proof the current behavior and make the README honest.
No behavior changes yet.

| Task | Notes |
|------|-------|
| 0.1 Fixture-site test battery | A committed fixture site (handful of HTML files with deliberate edge cases: amps, unicode, `lang` attributes, existing OG, missing title, noindex page). Feature-by-feature assertions on the output tree. `npm test` becomes a real gate. |
| 0.2 Packaging fix per #2/#6 | Shebang on the bin shim, decide publish path (npm once, or documented GitHub install), `npx freestruct --version` and `--strict` flags, positional-vs-config output dir story settled. |
| 0.3 Version truth per #7 | Tag v0.3.2 (or bump by policy), align README, create the release. CI check pinning README version string to package.json. |
| 0.4 CI workflow for the injector | GitHub Actions job: build fixture -> run inject.js -> run the battery -> (opt) `--strict` demo. |

### Phase 1 - Module decomposition (the big one)

Goal: same observable behavior, maintainable shape.

| Task | Notes |
|------|-------|
| 1.1 Split inject.js | Target modules: `lib/config.js` (load/validate), `lib/scan.js` (tree walk + page model), `lib/seo.js` (meta/OG/JSON-LD injection), `lib/xmllike.js` (escaping + sitemap + RSS), `lib/notfound.js`, `lib/linkcheck.js`, `lib/search.js`, `lib/hooks.js`. One export surface: `inject(options)` composed of named steps. |
| 1.2 Path/root resolution | Config discovered by walking up from cwd (prestruct findWorkdir pattern); templates resolved relative to the PACKAGE when not user-staged; output dir from CLI arg > config > docs/_site. |
| 1.3 XML class fix (F5) | Shared escape helper; sitemap gains real `lastmod` (per-file mtime, not build time); RSS gets honest items (either page-level dates or doc-section opt-in). |
| 1.4 404 pipeline (F7) | Generated 404 gets full SEO pipeline + noindex; custom 404s get the same treatment as everything else; all draws feed the late passes consistently. |
| 1.5 Strictness profile (F9) | `--strict`: nonzero exit on broken links + noindex leakage. Default run keeps today's report-only posture. |

Every step 1.1-1.5 lands AFTER its regression test exists (Phase 0 makes that
possible). Behavior parity is asserted by the fixture battery each step.

### Phase 2 - Config contract + honesty

- Config schema: known flags, unknown-flag warnings, structured `[freestruct]`
  diagnostics, FAST_FAIL exit codes.
- Document-or-remove every flag (F6 list); README + config example regenerated
  TOGETHER (and the README example YAML actually parsed by a test, per #8).
- Template comment drift fixed (footer placement); placeholder substitution
  either implemented or removed from docs.
- noindex: sitemap/search/feed honor it by default (owner call per #5).

### Phase 3 - Docs frame + release story

- Port the prestruct/vant docs setup: custom layout, `_data/nav.yml` as the
  freestruct menu layer, `_plugins/nav_generator.rb` EITHER fixed (generator
  writes `site.data.nav` or layout reads config) or deleted; docs-audit suite
  (frontmatter/links/style/language/truthfulness/fiction-signatures gates)
  ported and wired into CI.
- README rewritten around a WORKING quick start (install -> config scaffold ->
  build -> verify), stale claims culled (home.html `v0.2.0` badge), releases
  flow documented (tags publish, CHANGELOG is the changelog).
- Decide search.json's fate (F12): opt-in feature with updated docs, or
  retired in favor of the Pagefind story on the docs site.

---

## 4. Open questions (owner calls)

1. **Publish path:** npm (needs a first manual publish + OIDC later) vs
   documented GitHub-source install? (Unblocks #2.)
2. **Module runtime:** stay CommonJS (Node >=14 constraint) or move ESM?
   Prestruct went ESM-first (`"type": "module"`). Recommend ESM + Node >=18.
3. **Config filename:** keep `ssr-config.yml` (competitor-echo name) or rename
   `freestruct.config.yml` with a back-compat read?
4. **noindex in sitemap/RSS:** strict-honor by default, or flag-gated?
   (#5 owner call.)
5. **search.json:** keep as opt-in or delete? (F12 / filed report.)
6. **Stone password:** ~~owner picks~~ RESOLVED: owner picked
   `v5frogstone2026` (separator-free boot convention). The stone is minted
   and shipped: `horcrux/freestruct-p_v5frogstone2026.svg` in the prestruct
   repo (temporary location until the freestruct repo exists as the stone's
   home). Refresh it at pass end:

   ```
   cd /home/daytona/vant && node bin/vant.js snapshot --brain freestruct \
     --output models/public/freestruct/boot/freestruct-p_v5frogstone2026.svg \
     --password v5frogstone2026
   ```

   then copy the file to the repo horcrux/ (same name).

---

## 4.1 Path to v1.0.0 (approach steps)

v1.0.0 is the REHAUL release, not the next patch. The prestruct path is the
playbook, and its two owner-gate lessons transfer directly:

1. **Finish Phases 0-2 first.** v1.0.0 earns "1" by semantics: real test
   battery in CI, module decomposition, honest config contract. A version
   number cannot make a monolith either of those.
2. **Version truth in front, not behind:** tag the rehaul release as
   `v1.0.0` the moment Phase 2 lands, with README/package.json/CHANGELOG
   aligned by a CI pin (prestruct's test pin: root == template == stamp).
   No more "README says 0.3.0, package.json says 0.3.2, nothing tag-able."
3. **First publish is manual, exactly once.** npm OIDC/Trusted Publisher
   cannot create a package; the bootstrap publish from a dev machine carries
   no provenance (adding publishConfig.provenance: true breaks it - the
   sigstore cert requires a CI identity). Prestruct published this exact
   runbook: .github/workflows/publish.yml header in dhaupin/prestruct.
4. **Then the Trusted-Publisher entry** (user dhaupin, repo freestruct,
   workflow name). After it, every `v*` tag publishes with provenance
   automatically; the runbook also gates "no tag until the engine is
   proven by real installs."
5. **Tarball e2e before the tag.** Fresh-machine install test (real npm
   pack/install morphology, not repo runs) is the honest proof the quick
   start works - prestruct's e2e caught bugs repo-shape tests cannot see
   (CLI flag pass-through, npm-pack disk state, node_modules leakage).
6. **Dormant-by-default release posture.** Ship the publish workflow merged
   and inert (fires on v* tags only) so the owner-gate is a tag, not a
   merge. No publish without the Phase 2 contract being green in CI.

Conceptual readiness (doc truth, error taxonomy, docs-audit gates ported in
Phase 3) rides along so the docs site passes the same gates at v1.0.0.

---

## 5. Success criteria

- `npm test` in CI: fixture battery green; every artifact (sitemap.xml,
  feed.xml, robots.txt, 404, search.json, escaped output) byte-asserted.
- Fresh-machine install follows the README and produces a complete output
  tree from a real SSG build (verified by the installed package, not repo runs).
- inject.js is no longer a 577-line god-file: testable modules, explicit
  roots, zero cwd surprises.
- The docs site passes the same audit gates prestruct and vant pass.
- The age of unverifiable versions ends: tags + releases + README all agree.

---

## 6. Cross-references

- Body of defect ledger: freestruct issues #2-#8 (six already filed,
  plus the new-field reports from this session).
- The prestruct rehaul playbook this PRD mirrors: prestruct labs/prd.md,
  AGENTS.md (lessons), and the ported docs-audit suite (scripts/check-*.cjs
  in the prestruct repo - copy targets for Phase 3).
- Canonical brain: vant install models/private/freestruct/ (identity, goals,
  start, progress, lessons) - updated at pass end and encoded into the
  public stone horcrux/freestruct-p_v5frogstone2026.svg.
- Publish-path precedent + release runbook prestruct shipped first:
  dhaupin/prestruct .github/workflows/publish.yml (manual bootstrap ->
  Trusted Publisher -> tag-driven publishes).
