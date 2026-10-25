# freestruct - running task log

> **Purpose:** pass-by-pass history of the v1.0.0 rehaul. What was done, what
> is in flight, what's next. If a session crashes, this file + the git diff are
> the recovery state. Companion doc: `labs/prd-freestruct.md` (the PRD / plan).

---

## Project reality check

- **Repo:** `github.com/dhaupin/freestruct` - checkout lives at
  `/home/daytona/codebase`. Node/ESM package ("type": "module", engines node >= 20).
- **Side clones (reference only, not shipped):**
  - `/home/daytona/prestruct` - the "big sibling" rig; freestruct borrows its
    docs workflow, audit gates, and findWorkdir pattern.
  - `/home/daytona/vant` - the **prototype freestruct was made from** (not a
    consumer - confirmed: no ssr-config.yml, no `_freestruct/`, no injector in
    their `/docs` build; it is pure Jekyll + Pagefind). Borrowed tidbits are
    recorded in `labs/prd-freestruct.md` section 5.5.
- **Test battery:** `node test/run.js` from the repo root (fixture site in
  `test/fixtures/main`). `npm test` is wired the same way.
- **VERSION POLICY (owner call, this pass):** STAY ON 0.6.0. Do not bump the
  package/README/CHANGELOG version - no 0.7.0, no 1.0.0 bump. Work lands on
  0.6.0 until the owner says otherwise. (The v1.0.0 *path* from the PRD section 4.1
  still applies as a plan; the version NUMBER itself is frozen.)
- **Verification convention:** a failure triggered rechecking process-state,
  auth intact, retry/identical output checks, and expandability probes; source
  review passed with no regressions contested - outcomes evaluated against
  working-tree state, never comfy assumptions.
- **Stone convention (owner-ratified):** at pass end, refresh the boot model
  and copy it into the repo:
  ```
  cd /home/daytona/vant && node bin/vant.js snapshot --brain freestruct \
    --output models/public/freestruct/boot/freestruct-p_v5frogstone2026.svg \
    --password v5frogstone2026
  ```
  then copy the SVG into the repo `horcrux/` (same name).
- **Local simulation litter to remember:** Jekyll-shaped dry runs of the docs
  pipeline (from the dogfood check in pass 5) drop `docs/_case/styles/*.html`
  - remove after inspecting, they are not part of the pipeline.

---

## Pass log

### Pass 0 - Recon + PRD (done)
- Audited the rigging; warts classed by crash impact (issues #1-#14 in the
  PRD, "verified, not vibes").
- Wrote `labs/prd-freestruct.md`: 4 phases (0-3), owner-decision list
  (section 4), the v1.0.0 path (section 4.1), success criteria (section 5).
- Owner picked the stone password (`v5frogstone2026`); stone minted in the
  prestruct repo (temporary home until freestruct repo owns `horcrux/`).

### Pass 1 - Prestruct absorbed (done)
- Cloned prestruct, read `AGENTS.md`, `labs/prd.md`, `init/`, `example/`,
  workflows, audit-gate scripts.
- Takeaways adopted later: ESM-first decision input, findWorkdir walk-up
  pattern, docs-audit gate scripts as a Phase 3 port item, canonical-scheme
  lesson (scheme truth lives in `_config.yml`, not layouts).

### Pass 2 - Phase 0: safety net + packaging truth (done, v0.3.x line)
- `test/run.js` battery born: committed fixture site with edge cases (amps,
  unicode, `lang`, existing OG, missing title, noindex page); every phase-1+ /
  phase-2+ step lands AFTER its regression test exists.
- Packaging: bin shim shebang, `--version` / `--strict` flags, positional
  output-dir story settled, publish path decided.
- Version truth aligned (README pinned to package.json by battery).
- CI workflow for the injector landed.

### Pass 3-4 - Phase 1: module decomposition (done, v0.5.0)
- **Runtime:** ESM, node >= 20 (owner ratification).
- **The monolith died:** 577-line `inject.js` split into `config.js`,
  `scan.js`, `seo.js`, `xmllike.js`, `notfound.js`, `linkcheck.js`,
  `search.js`, `hooks.js`; `inject.js` remains as CLI orchestrator composing
  named steps.
- **Root resolution:** config discovered walking UP from cwd (subdir runs
  work); templates/snippets resolve next to the config file; output dir
  defaults to `<configDir>/_site`.
- **XML class fix (F5):** shared escape helper; sitemap gets real per-file
  `lastmod` (mtime, not build time); RSS gets honest dates.
- **404 pipeline (F7):** generated 404 gets full SEO + noindex, and feeds the
  late passes like any other page (caught a `title: null` regression live).
- **`--strict` (F9):** nonzero exit on broken links + noindex leakage; default
  stays report-only.
- Each step landed after its regression pin; battery green each time.

### Pass 5 - Dogfood check (done)
- Ran the docs pipeline as the repo's own consumer to see what Phase 1 did to
  the default path.
- Result: honest-date mechanic works; caught warts #10 and #12 live (config
  warnings, http canonicals) - both became Phase 2 fuel.
- Cleaned simulation litter; fixed the small dogfood findings in
  `docs/ssr-config.yml`, `docs/_config.yml`, `package.json`.

### Pass 6 - Vant reconnaissance (done, recorded)
- Deep-dive of `github.com/dhaupin/vant` done BEFORE its status was clear;
  truth-check: vant does **not** consume freestruct - it is the prototype
  freestruct was extracted from (owner confirmed).
- Adopt-worthy tidbits (recorded in PRD section 5.5): Pagefind-via-official-npm dist
  (`npm i --no-save pagefind` + `npx pagefind --site _site`, replaces the old
  curl-scrape dance), inline `cd docs && jekyll build` safety belt, and the
  single-source nav + no-theme docs frame (the Phase 3 port item).
- Reference clone retained at `/home/daytona/vant` for Phase 3 material.

### Pass 7 - Phase 2: config contract + honesty (done, v0.6.0)
- **Config rename with back-compat:** `freestruct.config.yml` primary (walk-up
  discovery), legacy `ssr-config.yml` still read; repo's own config renamed.
- **Schema + structured diagnostics:** unknown keys and retired flags
  (`preserveExistingMeta`, `generateNav`, `cacheBusting.hash`) emit loud
  `[freestruct] config warning: ...` lines.
- **`search.json` opt-in** (owner call): only with `searchIndex: true`;
  docs site stays Pagefind-only.
- **FAST_FAIL exit codes:** 1 config fatal, 2 template missing, 3 output dir
  missing; `--tolerant` downgrades fatals to exit 0 for CI.
- **Snippet placeholder substitution ships** (`{{siteName}}`, `{{siteUrl}}`,
  `{{buildHash}}`, ...); comments still stripped pre-insert - issue #10 closed.
- **basePath contract (issue #3):** new `docs/lib/urls.js`; canonical = url +
  basePath + slug - strips a doubled deploy-directory prefix but never a
  directory-page trailing slash; pinned with both tree shapes.
- **Docs honesty:** full config table in README (minify, hashInCanonicalUrl,
  assetQueryParam, runHooks were previously code-only); footer template
  comment drift fixed; `docs/guides/*` still call it `ssr-config.yml` - see
  Next up.
- Battery grown to 36 green; `npm pack` verified at 0.6.0 (17 files).

---

## Current state (as of this pass)

- **Working version:** 0.6.0, battery 36/36 green, tarball verified.
- **All phases 0-2 complete.** Open PRD warts remaining: link-check is
  report-only (#4 - `--strict` is the graduate lever), ~2 open owner calls
  (publish path is settled; noindex/sitemap handled; search.json resolved).

### Pass 8 - Phase 3: docs frame + audit gates + release story (done, on 0.6.0)
- **Version freeze honored throughout:** every edit landed on 0.6.0; the
  PRD's v1.0.0 tagging steps (section 3 Phase 3 endpoint, section 4.1 step 2) are annotated
  as superseded by the owner call. Tarball re-verified (17 files).
- **Nav layer resolved (PRD option: delete the generator):** new
  `docs/_data/nav.yml` single-source menu (prestruct shape, `site.data.nav`
  consumed by both header and sidebar); `_plugins/nav_generator.rb` and
  `docs/guides/dynamic-nav.md` deleted; `_config.yml` nav knobs removed;
  `navigation.md` rewritten to document the data-file layer honestly.
- **Docs-audit gates ported and wired into CI:** one runner,
  `scripts/run-docs-audit.cjs` (frontmatter / links / nav symmetry / style /
  truthfulness over CLI flags + config keys), stepped into `.github/
  workflows/test.yml` after the battery.
- **First audit run caught real warts** (the port paying for itself
  immediately): one missing closer in `guides/ssr-config.md` had flipped
  fence parity for the entire reference page; CDN purge examples showed
  invalid top-level `purge:`; a retired `hash: true` example; stale
  `ssr-config.yml` references across 12 files (swept to the new name, legacy
  mentions kept deliberately); emoji in prose; untagged fences; a broken
  layout link; `description` missing in two frontmatters. All fixed; gates
  clean.
- **README rewritten:** working quick start (install -> config scaffold ->
  build -> verify -> flags), honest opt-in search story, Releases section
  (CHANGELOG is the changelog, tags are the release story, CI version pin
  stays), and the stale-claim culls (hero badge de-versioned in the layout;
  the battery's version-truth pin caught the rewrite dropping the `## v0.6.0`
  heading - restored; pin enforces 0.6.0 everywhere per the freeze).
- End-to-end: battery 36/36 green, docs audit 0 findings, tarball 0.6.0.

### Pass 9 - GitHub push + follow-on items + Phase 4 start (in progress, on 0.6.0)
- **Pushed everything:** 54-file rehaul commit landed on `main`
  (66cc52f..759d0a4) via Freebuff's managed credential; includes Phase 1-3
  code, TASKS log, and the refreshed stone.
- **Pagefind-via-npm swap (section 5.5 tidbit 1):** docs.yml now does
  `npm install --no-save pagefind` + `npx pagefind --site docs/_site`; the
  `npm install -g` global is gone.
- **Link-check graduated (#4):** the `--strict` lever is adopted in our own
  docs CI - broken internal links now FAIL the GitHub Pages build (semantics
  verified in inject.js before adoption: noindex leak gate stays report-only).
- **Tarball e2e made a committed, CI-gated proof (Phase 4 item):**
  `scripts/e2e-install.cjs` packs the REAL tarball, installs it into a
  throwaway project, runs the README quick start through the bin shim, and
  asserts artifacts + injections + exit shapes. First CI-enabled run caught
  TWO real fresh-install bugs repo runs hiding in the harness could never
  see:
  1. template resolution didn't fall back to the package-shipped
     `docs/_freestruct/` (exit 2 on every fresh install) - fixed with the
     user-staged-first/package-fallback chain + battery pins
     (FREESTRUCT_SKIP_PACKAGE_FALLBACK seam for the staged-only pins);
  2. the main-module guard compared raw argv paths, so npm's symlinked .bin
     shim ran silently (exit 0, no work) - fixed with a realpath-vs-realpath
     comparison; battery back to green (37 pins now).
  Wired into test.yml (every push) and as a hard publish gate in
  publish.yml (the runbook's own "no tag until the tarball is proven" rule).
- **Version pin tightened to the freeze:** the battery's version-truth pin
  now enforces exactly 0.6.0 in package.json + README + CHANGELOG until the
  owner says otherwise.
- **Jekyll-leg safety belt (section 5.5 tidbit 2):** docs.yml build step inlines
  `cd docs &&` instead of trusting step-level working-directory.

### Pass 10 - prestruct-shaped house structure: engine/ + init/ + bin/ (done, on 0.6.0)
- **Owner approved the prestruct-derived house structure.** Study: prestruct
  ships `engine/` (runtime), `init/` (consumer scaffold kit, version-stamped,
  shipped in `files`), `example/` (dogfood site), `bin/cli.mjs` (thin CLI),
  and syncs engine-vs-kit copies in CI (the W1 engine-drift lesson, which
  bit their published qc.test, encoded as a `sync:check` CI step).
- Mapping executed: `docs/lib/*.js` -> **`engine/`** (8 modules + orchestrator,
  `main`/`exports` point there); canonical packaged templates ->
  **`engine/_freestruct/`** (fixed a `'../_freestruct/'` vs `'./_freestruct/'`
  sibling-path bug the battery's fallback pin caught immediately);
  **`/docs` stays the example** (staged template copies restored via sync,
  so the dogfood build exercises the recommended consumer shape);
  **`init/`** scaffold kit created (VERSION + README + starter config +
  template copies, exported and shipped); **`bin/freestruct.mjs`** thin CLI
  entry; **`scripts/sync-templates.mjs check`** wired into test.yml.
- Consumers' guide commands moved to `npx freestruct`; repo/CI invocations
  moved to `node bin/freestruct.mjs`; `printVersion()` fixed for the new
  depth (`../package.json`); battery's packaging pin updated to assert the
  house structure (bin/engine/init whitelist + bin + main targets).
- Side benefit realized: Jekyll previously copied `docs/lib/*.js` into
  `_site/lib/` (source code shipping in the docs artifact); the move
  eliminates that leakage.
- No compat shims for old paths: the package was never npm-published, and
  vant (the prototype) is not a consumer - breaking internal paths now is
  free; the freeze (0.6.0) stays.
- End-to-end: battery 37/37, sync-check lockstep, docs audit clean,
  tarball e2e proven (bin/engine/init all in the 0.6.0 tarball).

### Pass 11 - strict harvest: docs workflow unbreak + 3 real 404s + stone (done, on 0.6.0)
- **First real GitHub Pages `--strict` harvest (Phase 4 candidate, done):**
  the last two pushes' docs runs were failing at 0s and nobody had looked:
  docs.yml itself was UNPARSEABLE YAML - two step names carried unquoted
  `cd:` / `--strict:` (plain-scalar `: ` kills the file), so the "0s
  failure" was GitHub refusing the workflow, not a build failure. Classical
  CI-verifier lesson: `test.yml` proved the engine green while the Pages
  pipeline silently never ran. Annotations moved into step comments; all
  four workflow files now battery-pinned to parse-check locally
  (js-yaml in CI too, next push onward).
- **Strict mode's first real catch (3 production 404s, all in
  `contributing/style.md`):** two root-absolute `.html` links that pretty
  permalinks make wrong (`/configuration.html`, `/getting-started.html` -
  real URLs are `/configuration`, `/getting-started`), one relative link
  into the source tree (`../ _layouts/default.html`) that does not exist in
  the built output. Swept the docs tree: no other links in either broken
  class. These were shipping 404s in production since the rehaul.
- **Site truth note:** the docs site uses `permalink: pretty`; consumers
  don't have this constraint (their SSG decides), but OUR dogfood links must
  address the parked URLs the layout actually serves.
- **Stone refreshed at pass end** (convention, deferred twice - now done):
  vant snapshot re-run; horizon `horcrux/freestruct-p_v5frogstone2026.svg`
  updated, sha256 `6dd67eca...d449ef` verified against the vant output.
- Version freeze untouched: everything above ships under 0.6.0.

### Pass 12 - crashtest pack surface: packs/ + freestruct-docs-shapes + dogfood (done, on 0.6.0)
- **Owner-directed:** a `packs/` folder in the freestruct repo, a README
  explaining crashtest + packs (crashtest.creadev.org, docs.creadev.org/
  crashtest, creadev.org), the pack list, then the pack itself - and a real
  run against freestruct to see what falls out.
- **`packs/README.md`** covers crashtest (in-process adversarial QA, honest
  verdicts), the one-surface pack model (`packs/public/<name>/pack.json` +
  scenario-contract entry; adoption = one `packs:` line), and the house
  rule (pack manifests carry their own semver).
- **`packs/public/freestruct-docs-shapes/`** (0.1.0, five attacks, zero
  deps, zero sockets): hostile-traversal-404 (traversal shapes + artifact
  query-independence), gen404-noindex-canary (issue #11 contract),
  noindex-artifact-leak (issue #5: a noindex page listed by sitemap IS the
  leak; search.json/feed.xml too), canonical-query-poison, and
  sitemap-xml-shape-canary (issue #9 escape class). Cross-repo doctrine
  honored: no crashtest imports, inline verdict helpers, honest skips
  (prestruct-proxy precedent).
- **Run root:** `labs/static-site-target.js` models the GitHub Pages class
  of static host (pretty-permalink/.html/dir resolution, 404 + generated
  body, containment refusal); `crashtest.config.js` at the repo root wires
  it with `SITE_ROOT` (default `docs/_site`) and adopts our packs.
- **Teeth proof (`scripts/packs-selftest.cjs`):** commits the two-sided
  proof - the hardened build holds (5/5 REFUSED, 35/35 with the library
  skips) and a deliberately regressed tree trips every planted oracle
  (404-noindex loss, sitemap/feed/search noindex leak, raw ampersand,
  traversal escapes). First draft earned two honest fixes: the leak
  oracle now treats sitemap listing itself as the leak, and the ledger
  reader keys attacks by row id (no `attack` field - receipt-driven).
- **CI dogfood + testing hook (follow-up same pass):** docs.yml runs
  `npx crashtest run` after the strict step (EXPLOITED rows fail the Pages
  build), and test.yml gained the pack selftest as a HARD gate on every
  push/PR - teeth proven both ways in CI, no crashtest checkout needed
  (`CRASHTEST_BIN=node_modules/crashtest/bin/crashtest.js`). Both
  workflows pin the install to the crashtest main sha `dc80a7c7...` -
  never a mutable latest (the vant predeploy lesson). Rehearsed locally
  via the exact command shape first; one honest fix on the way: the
  selftest resolves CRASHTEST_BIN against the CALLING cwd (a relative
  path vanished once the campaign spawned from a temp cwd). `npm run
  packs:selftest` is the local entrypoint.
- **Battery pin:** the pack surface is battery-pinned (packs/README ships,
  manifest schemaVersion 1 + name/dir match, entry importable and
  scenario-contract-shaped) - 39/39 now.
- Run artifacts are gitignored everywhere (`labs/crashledger.json`,
  `hardening.md`, `run-meta.json`) - campaign ledgers belong beside the
  config that produced them, not in the tree.
- Version freeze untouched: everything above ships under 0.6.0.

### Pass 13 - issue sweep: the two live fixes + receipts closure of the queue (done, on 0.6.0)
- **#15 FIXED** (f9fb526): the static `<script src>` pagefind preload was
  dead code (doSearch() does the dynamic `await import` per query) and was
  exactly what threw `import.meta outside a module` on every page under
  pagefind 1.5.x. Removed, plus the dead `pfModule` stub; layout comment
  records the contract (pagefind loads lazily, ESM only).
- **#16 FIXED** (f9fb526) honestly: the flagged `--ink-light` token lives
  in crashtest's vendored copy of the layout (already fixed there to
  #94867a = 5.25:1) and ships NOWHERE in the freestruct tree - but the
  same failure class did exist in OUR theme: the code-block language label
  #888 on #1f2937 = 4.14:1 -> now #9ca3af = 5.78:1 (WCAG 2.x luminance math,
  computed, with the receipt in the CSS comment).
- **Receipts sweep done: #2-#16 all CLOSED with per-issue receipts** -
  battery pin numbers, CHANGELOG/PRD phase references, pack/wire guards
  named, and the two CI-verified commits cited for #15/#16. The tracker
  now matches the repo truth: freestruct's queue is EMPTY.
- CI verification: test green + Pages deploy green on f9fb526 (the
  first-run crashtest dogfood step is slower than the presets - future
  pushes should stay near ~2min with npm's cache warm).
- Version freeze untouched: everything ships under 0.6.0.

### Pass 14 - CI tempo: measured, then cached (done, on 0.6.0)
- **Q from the owner: does freestruct actually work? Speed up the CI?
  Answered with run-step telemetry, not vibes.** The tmp-install proof is
  scripts/e2e-install.cjs - real `npm pack` -> throwaway install ->
  README quick start through the bin shim - CI-gated on EVERY push (and
  hard-gated in publish.yml); it caught two real fresh-install bugs and
  is green on the current commits.
- **The bottleneck was never pagefind** (1s install + 1s index in the
  previous run's telemetry): step timings showed `Crashtest the built
  docs` at 422s and `Install freestruct deps` at 301s. Log line that
  named the cause: `npm install github:crashtest#<sha>` = "added 1
  package in 7m" cold on a runner, while the campaign itself ran in ~1s
  (353 requests).
- **Fixes (9717caf + this pass):** crashtest's github install is now
  cached `node_modules/crashtest` keyed by the pinned gate sha in BOTH
  workflows (misses-only install; direct bin call, no npx dependency on
  .bin state); docs.yml gained `npm ci` + setup-node `cache: npm` (was
  a plain `npm install`); and pagefind - which became the new 355s sink
  (its npm package resolves a platform binary cold) - got the same
  treatment: `pagefind@1.5.0` pinned, cached by version, bin called
  directly. Bump a pin = new cache key = fresh install, honestly.
- CI runs after the change: test + Deploy Docs green on the pushed head.
- Version freeze untouched: everything ships under 0.6.0.

### Pass 15 - readme/meta surface rewrite + repo hygiene + artifact audit + gate cherry-picks (done, on 0.6.0)
- **Owner call:** redo README completely, add root AGENTS.md + DEPLOY.md
  crosslinked together and with the README; refresh .gitignore; add .ignore
  for search hygiene; verify sitemap/robots/404 handling; cherry-pick the
  vant/prestruct docs-lint gates; make code comments consistent.
- **Artifact audit first, and it found real bugs the pins had missed:**
  robots.txt's sitemap pointer and the RSS channel/atom self links ignored
  basePath (the #3 class in different artifacts - pointers 404 on sub-path
  installs), and the generated 404 carried a hard-coded raw-site.url home
  link plus a guessy `/docs/` link. All moved onto the pageUrlFor contract
  (robots pointer, feed channel/self, 404 form + home link); the basePath
  pin grew assertions for each (robots, feed self-link, 404 home link, and
  a no-doubling check on both). The 404's generated page no longer ships a
  link to a path that never exists.
- **README rewritten** around the quick start with the full crosslink
  surface (docs site, docs system, family sites, meta files); `## v0.6.0`
  block restored after the first battery run flagged its removal (the
  version pin working as designed).
- **AGENTS.md + DEPLOY.md landed at root:** house rules/structure/gates and
  the release truth (Pages pipeline, npm runbook, measured-cache
discipline). docs/AGENTS.md stays the rendered engineering-decisions page;
  the root file is the orientation file linking to it.
- **Gates cherry-picked from vant:** English-only language gate as
  `scripts/check-language.cjs` (script-block longest-run detection, URL/
  import/base64 exemption, fence/inline-code/frontmatter exemption) wired
  into the docs audit runner as the `language` gate; the vant voice checks
  (em/en dash rule with CHANGELOG exempt, tabs, table-row shape) folded
  into `style` with inline-code-as-data posture; new `codefmt` gate pins
  engine source headers to `// engine/<file>.js - <purpose>` (the format
  that would have caught the whole rehaul leaving eleven headers saying
  `freestruct lib/...` behind).
- **Comment format normalized:** all eleven engine headers rewritten to
  name their own path; section banner style unchanged (already uniform);
  bin/scripts carry the same shebang-plus-purpose shape. The format is now
  AGENTS.md policy, machine-checked by `codefmt`.
- **Hygiene:** .gitignore rebuilt (build outputs, env files, npm cache,
  crashtest artifacts, editor noise); `.ignore` added for ripgrep-family
  search scoping (machine artifacts only).
- **End-to-end:** audit all seven gates clean (language PASS over 23 prose
  files), battery 39/39, and the whole set rides the same CI.
- Version freeze untouched: everything ships under 0.6.0.

### Pass 16 - coverage gap audit + dead-code cleanup (done, on 0.6.0)
- **Owner question:** missing tests/probes/gates? untested-but-should-be
  parts? rogue/dead code? Audited against the pin wall rather than opinion.
- **The gap was real and it was the worst possible one:** `engine/hooks.js`
  - the only engine code that EXECUTES SHELL COMMANDS - had zero battery
  coverage. Two canary pins added (39 -> 41): disabled-by-default (a
  configured purge canary NEVER runs without runHooks; genuinely
  executable proof), and runHooks:true executes with truthful
  $SITE_URL/$BUILD_HASH/$OUTPUT_DIR substitution (the marker file content
  is asserted field by field against the printed build hash). The
  first draft of the pin pair caught paper-only helpers (FIXTURE_YAML_BASE)
  before they shipped - the wall works.
- **Dead-code verdict:** `scan.js::stripRobotsMeta` had NO caller, and
  `notfound.js::pipeline404` carried the identical regex inline (a **
  comment even said 'un-duplicated' while duplicating). Fixed by pointing
  the pipeline at the scan.js helper - one regex, one owner, zero dead
  exports. Everything else on the engine export surface proved live
  (checked callers across engine/test/scripts/bin).
- **Stale-claims cleanup, receipts-checked:** docs/AGENTS.md's Important
  quirks said purge hooks were 'commented out in inject.js' (false since
  Phase 1.1) and 'preserveExistingMeta default: true' (retired key) while
  the battery proves 404s DO get canonicals now - all rewritten with the
  current truth and pin references. CONTRIBUTING.md still sketched a
  pre-rehaul architecture (adapters/ + plugins/ tree that never existed,
  open questions all since answered) - rewritten honestly for the shipped
  engine/ shape with the scope discipline and CI gates inlined. release.yml
  example tag updated v0.4.0 -> v0.6.0 to match the current release era.
- **What the audit found ALREADY covered:** every engine module's behavior
  rides behavior pins (the module names do not appear in test/run.js, but
  each module's contract is asserted by name through the workflow pins);
  minify/hashInCanonical/assetQueryParam have pins (2 config-flag pins); --
  strict link/noindex semantics pinned; bin shim covered by e2e + shebang
  pin + library-API guard realpath comment. Remaining honest gap after this
  pass: none load-bearing - future pins grow with features.
- **End-to-end:** audit 7/7 gates clean, battery 41/41, sync lockstep,
  tarball e2e proven, pack teeth proven, workflows parse.
- **The CI dogfood found one more - and it was OURS, twice over:** the live
  Pages build went red with `noindex-artifact-leak: EXPLOITED` on
  /engineering-decisions. Truth chain: no noindex exists anywhere on that
  page (frontmatter clean, layout emits none) - the pack's noindex
  oracles searched page BODIES for the WORD, and docs/AGENTS.md
  legitimately discusses noindex, so the oracle false-positived. Broke
  the pack's own content-shape doctrine (0.1.0 -> 0.1.1): both oracles now
  require the robots META that declares noindex (attribute order free);
  documented in-source with the failure story. Selftest teeth re-proven
  both ways; battery unchanged (fixture pages genuinely noindex).
- Version freeze untouched: everything ships under 0.6.0.

### Pass 17 - version truth swept to 0.9.0 (owner call, done on 0.9.0)
- **OWNER CALL supersedes the freeze:** the version number moves
  0.6.0 -> 0.9.0. The structural freeze policy was doing its job (one
  number everywhere behind a CI pin); the owner chose to promote that
  truth. Sweep executed over the AUDIT's live-truth set: package.json,
  README (release line + the `## v0.9.0` heading the battery pin reads),
  CHANGELOG (new top `[0.9.0]` entry - the promotion rollup - with the
  [0.6.0] entry left verbatim as history), `init/VERSION`, the battery pin
  itself, CONTRIBUTING.md / AGENTS.md / DEPLOY.md policy text, and the
  release.yml example tag. Historical notes in TASKS/PRD/CHANGELOG during
  the freeze stay verbatim - that is what 0.6.0-era passes shipped under,
  and rewriting logs would falsify the record it exists to keep.
- The pin wall now enforces exactly 0.9.0 everywhere until the owner moves
  it again.
- Version truth: package.json == README heading == CHANGELOG top entry ==
  0.9.0, battery-pinned.

### Pass 18 - audit + SEO pass + prestruct port wave + CLI (done, on 0.9.0)
- **Docs audit:** every page carries complete frontmatter; nav_order
  normalized 0-14 to the nav.yml listing order; seven missing Related
  blocks written and crosslink resolution machine-verified (zero unresolved).
- **SEO pass on the live site:** the twitter handle placeholder left the
  dogfood config (the engine now skips `twitter:site`/`creator` without one);
  `style.md` permalink normalized; the og:image pointed at a live 404 -
  `docs/og-image.png` generated (1200x630, pure-Node PNG writer, no deps).
- **Prestruct port wave (CHANGELOG section):** attribute-escaping for all
  injected values, JSON-safe JSON-LD literals, `og:image`/`twitter:image`
  ship-when-set, `twitter:description`, `author` -> JSON-LD founder,
  per-page `<!-- freestruct: {} -->` overrides (previously documented, never
  implemented), custom `jsonLd` hook. The dogfood config now carries author
  (Creadev.org) + jsonLd (dhaupin) and dropped two retired keys.
- **Deterministic build hash:** content-derived (prestruct deploy-id audit
  ported); the generated head tail, generated 404, late-pass metas and
  `loading=lazy` are excluded from the hashed view so reruns stay stable.
- **CLI:** `validate` / `init [dir]` / `help` (+ the `--help` alias);
  dispatch is module-level because the bin shim imports `runInject` - the
  first cut put the dispatch behind `invokedAsMain` and the tarball e2e
  caught it live.
- `FREESTRUCT_URL` env override implemented (documented, never honored before);
  **Docs:** new CLI Reference page (nav + frontmatter + Related), links from
  getting-started/README, hash + env-override docs made honest.
- Battery 36 -> 49 green; sync:check, lint:docs (all 7 gates) and the
  tarball e2e all clean.

### Pass 19 - config reference rename with a live redirect (done, on 0.9.0)
- The Freestruct.config.yml Reference page dropped its legacy ssr-config
  slug: `docs/guides/ssr-config.md` -> `docs/guides/freestruct-config.md`,
  nav entry and every crosslink swept (docs pages, nav.yml, README, AGENTS);
  no remaining `guides/ssr-config` references.
- Old URL keeps resolving: a noindex redirect stub at
  `docs/guides/ssr-config/index.html` (meta refresh + JS fallback to the new
  URL, canonical pointed at the new location, noindex so the engine filters
  the stub out of sitemap/feed - verified through the real engine). GH
  Pages 301s the no-slash variant into the stub.
- Battery 49/49 + lint:docs gates + tarball e2e clean; CI green and the live
  URL shapes curl-verified (200 stub / 301 / 200 new canonical).

### Pass 20 - toolchain/CI bump + release validation + v1.0.0 draft (done, on 0.9.0)
- **No width rule anywhere:** the suspected 72-char prose cap does not exist
  in the freestruct gate family (checked style/language/audit scripts and
  prestruct's) - nothing to remove.
- **CI on Node-24-compatible action majors** (GitHub retired the Node 20
  action runtime 2026-09-23): checkout v7, setup-node v7, cache v6,
  upload-pages-artifact v5, deploy-pages v5; docs/test project node 20 -> 22.
- **Docs stack:** Jekyll Gemfile 4.3 -> 4.4, Ruby 3.3 -> 3.4, Gemfile trimmed
  of never-loaded jekyll-seo-tag/jekyll-sitemap; prismjs CDN 1.29 -> 1.30;
  pagefind CI pin 1.5.0 -> 1.5.2 (cache key bumped).
- **js-yaml 4 -> 5.5.0:** v5 dropped the default ESM export - imports moved
  to named `load` (engine/config.js + test/run.js); battery-verified.
- **Release wiring verified:** publish.yml (npm publish on v* tags, tarball
  e2e gates the publish) + release.yml (GitHub Release from the same tag,
  notes extracted from CHANGELOG.md, tag==package.json pin check). Both
  dormant until the owner cuts the first tag after the npm bootstrap.
- **Dry-run packaging validated:** npm tarball = exactly the 25-file files
  whitelist; GitHub source tar mirrors the tracked tree (fixture built `_site`
  present by design - it is the battery's input state).
- **docs/discussions/announcing-v1.0.0.md** added, prestruct's announcement
  frame: a copy-pasteable Discussions post draft for when v1.0.0 is cut.

### Pass 21 - version sweep to 1.0.0 (owner call, done on 1.0.0)
- The owner completed the one-time manual npm bootstrap; the package is on
  npm. Per owner call the version truth moves 0.9.0 -> 1.0.0 across the
  four agreement spots (package.json, README release line + `## v1.0.0`
  heading, CHANGELOG top entry, `init/VERSION`) plus the runbook example
  tag (release.yml), DEPLOY/CONTRIBUTING/AGENTS pin wording, the v1.0.0
  section intro (first stable - carries the rehaul stack, the port wave
  and the toolchain pass), and the TASKS reminder.
- Announcement draft at docs/discussions/announcing-v1.0.0.md updated: the
  bootstrap is done, only the tag remains before the post goes into
  Discussions.
- **NO TAG cut by instruction** - the owner gates it; publish.yml +
  release.yml fire from v1.0.0 when it lands.
- Battery version pin green at 1.0.0; sync:check, lint:docs and the tarball
  e2e clean before the push.

## Next up (open, unowned)

State of this list as of Pass 20 (truth-up over the stale entries below it
in the pass log, which are history): the repo side of the v1.0.0 path is
closed. What remains is owner action plus one bookkeeping sweep.

- The two live findings are DONE, the ledger just lagged: #15 (pagefind 1.5.x
  static preload) is fixed by design - `docs/_layouts/default.html` loads
  Pagefind as a dynamic ESM import inside the search modal only, with no
  static `<script src>` preload, and the live site serves exactly that; #16
  (`--ink-light` WCAG) is moot in the current tree - no `--ink` token exists
  in `docs/assets` or the layouts anymore (if it is ever reintroduced, the
  `#94867a` AA-passing shape is already proven in crashtest's copy).
- Issue queue is CLEAN (verified against the tracker, not the old ledger
  text): #2-#16 are all CLOSED (the owner closed them on 2026-10-22; #1 was
  never filed - it lived in the PRD's internal numbering only). This pass
  attached the sweep receipts: each of #2-#14 now carries a closing comment
  naming its fix (engine module / battery pin / CI gate) so the closure is
  traceable, not vibes.
- **Before the npm release, owner actions only (PRD 4.1 steps 3-4):**
  1. One-time manual bootstrap publish from a dev machine (`npm publish;
     OIDC cannot create a brand-new package; do not set
     publishConfig.provenance for it).
  2. npmjs.com -> freestruct -> Settings -> Trusted Publisher (user dhaupin,
     repo freestruct, workflow publish.yml).
  3. Owner cuts the first tag (`git tag v1.0.0 && git push origin main
     --follow-tags`); publish.yml + release.yml fire from there, and the
     announcement draft at `docs/discussions/announcing-v1.0.0.md` is ready
     for the Discussions post.
- No repo-side gate remains open on the freestruct side: battery (49 pins),
  docs audit (7 gates), template sync, tarball e2e, crashtest pack selftest
  + docs dogfood and the version-truth pin are all CI-green on main.

**Reminder (current truth):** the pin wall enforces 1.1.0 everywhere - the
first post-stable surface, owner sweep applied 2026-10-25 (the 1.0.0
first-stable landed 2026-10-22). The manual npm
bootstrap is done; the tag is the only remaining owner gate.

### Pass 22 - the issue sweep, all eight open items (done, on 1.0.0)

Scope: every open issue at the time of the pass, phased smallest-first.
Receipts:

- **#17** - dead `prism-line-numbers.min.css` CDN link + the orphan
  `.line-numbers` support CSS removed from `docs/_layouts/default.html`
  (both no-op removals, verified in the built docs).
- **#24** - every config/page-carried value now rides FUNCTION replacers:
  `engine/hooks.js` purge substitution (shared
  `substitutePlaceholders` helper) and the three `engine/seo.js`
  insertion spots (`</head>` head injection, header/body-start/footer
  snippets). Three battery pins pin the class dead (`$&`/`$1`/`$'` in
  purge urls, snippet bodies, and `site.name` all print literally).
- **#23** - the announcement file IS the post now (family convention,
  crashtest-amended format; frontmatter contract kept, wrapper block
  removed) + the direct Creadev.org workshop backlink in the root README.
- **#20** - structured `og.image` object form `{ src, width, height, alt,
  allowSvg }` with og:image companions; string form untouched
  (back-compat); the SVG blank-card trap warns on every run
  (config-level in `config.js`, per-page in `seo.js`), `allowSvg: true`
  accepts it, `--strict` graduates the class to a build failure. Four
  pins; config-guide + README updated.
- **#21** - general `hooks.postBuild` seam in `engine/hooks.js` (same
  runHooks gate, 30s timeout, `$`-placeholders + `FREESTRUCT_*` env on the
  child); a nonzero hook exit fails the build with the new exit code 4
  (documented in cli.md + README). Four pins; shape diagnostics in
  config.js name unknown seams and non-string entries.
- **#18** - `freestruct audit` subcommand, ported from the donated
  prestruct#34 script into `engine/audit.js`: per-page head hygiene (core
  og/twitter FAIL class + set-coherence WARN because missing-only means
  SSG-owned partial sets are legitimate), 404 noindex contract, sitemap
  and robots checks, `--json` digest, exit 0/1 (3 for a missing dir;
  asset-existence checks are report-grade WARN by design). Three pins
  including a clean run audits clean + doctored output fails.
- **#19** - IndexNow: `engine/indexnow.js` (key resolution generate-once
  and persist, `<key>.txt` emitted per run, sitemap reader, submission
  POST), `freestruct indexnow [--dry-run] [outputDir]` subcommand, config
  shape diagnostics (32-hex key contract). Four network-free pins; cli.md
  + config guide + README document the post-deploy semantics.
- **#22** - per-page OG image generation: `engine/ogimage.js` renders per
  page from a consumer SVG template (`{{ogTitle}}`/`{{ogDescription}}`/
  `{{ogUrl}}`, XML-escaped), rasterizes through the OPTIONAL
  `@resvg/resvg-js` package (devDependency, consumers opt in; loud skip
  when absent - pure Node cannot rasterize), wires og/twitter + #20
  companions under missing-only (pages with their own og set keep it
  wholesale; noindex pages get no share preview). Three pins; config
  guide gained the Image Generation Options section.

Counters: battery 49 -> 69 pins (all green), engine modules 9 -> 12
(audit/ogimage/indexnow join; hooks.js grew the general seam). Gates
re-run at the end of the pass: battery, lint:docs, sync:check, e2e.
Next pass picks up: none of #17-#24 remain; the issue queue is empty and
the version is owner-gated as ever.

### Pass 24 - version sweep to 1.1.0 (owner call, done on 1.1.0)

Preceded by the pass-23.5 edge hunt: ran crashtest (pack selftest against
the pinned checkout) and packstruct (manifest lint + deep module census)
locally, then probed the new seams for edges. One real bug found and fixed:
an array-valued `og.scoped` variant slipped past the config shape
diagnostic (arrays pass the `typeof object` check) and the runner would
have shipped a garbage comma-joined `og:image`. Now the diagnostic names
the value class, the runner resolves wrong-shaped variants to NO image,
and a pin keeps the honest-absence behavior. Battery 74 -> 75.

Then the bump, consciously flipped per the owner call, same ritual as the
1.0.0 sweep: package.json + package-lock, `init/VERSION`, README (release
line + the new `## v1.1.0` section above the `## v1.0.0` one), CHANGELOG
new top entry, the battery pin (test name + message), DEPLOY (pin wording
+ battery count 49 -> 75), CONTRIBUTING + AGENTS pin wording, release.yml
tag example, and this reminder line. Next pass picks up: the owner tag
(`git tag v1.1.0 && git push origin v1.1.0`) - publish + release fire
from the tag, proven on 1.0.0.

### Pass 23 - scoped jsonLd (#25) + og.scoped follow-on (done, on 1.0.0)

Split out of #19's tail per the filer's own request; filed as #25 with a
battery-pin sketch and built in the same pass.

- **The matcher:** `engine/urls.js` grew `slugMatchesGlob` +
  `globSpecificity` - slug-keyed glob language (`/` exact root, `/faq`
  exact page, `/blog/*` one segment, `/guides/**` the sub-tree itself and
  below, `**` anywhere). Specificity ranks exact > literal-heavy glob >
  `**`; pins caught two matcher bugs before they shipped (the `/**`
  normalization trap and a stale helper name).
- **Scoped jsonLd (#25):** the #25 map form keys blocks by slug glob in
  `seo.js` - legacy single-object/array untouched; every matching key
  ships, most specific first; missing-only holds (own-LD pages get
  nothing, scoped included); malformed entries warn and skip only
  themselves; config.js shape diagnostics name the mixed-keys mistake.
  Four pins per the #25 sketch.
- **og.scoped (follow-on, closed inside #25's commit):** image variants
  keyed by the same glob language; the MOST SPECIFIC match wins (images
  are singular), the global `og.image` is the fallback, per-page
  overrides and #22 generated images still rank ahead; structured
  variant values ride the #20 companions; the allowSvg ladder follows
  the winning descriptor. One pin.
- Docs: config guide (jsonLd scoped section + og.scoped), README feature
  bullet. Counters: battery 69 -> 74 pins.
- Also this pass: the v1.0.0 announcement draft is unwrapped (the family
  ~72-char hand-wrap made every paste-to-Discussions re-flow read like
  poetry; one flowing line per paragraph now, fences untouched, and the
  audit passes with zero findings on the unwrapped file) and renamed to
  `docs/discussions/announcing-freestruct-v1.0.0.md` for cross-repo
  clarity (permalink and nav entry follow; the prestruct#48 convention
  pull proposes unwrapping family-wide). Earlier TASKS/CHANGELOG path
  references stay verbatim - they describe the tagged v1.0.0 state.

### Pass 25 - the SEO-gap pass lands (done)

All eight gaps from the post-1.1.0 audit table, one landing, all opt-in
config, all missing-only, all pinned:

- Feed autodiscovery: the injected head carries the rss alternate link
  (`generateFeed` gate honored, page-owned alternates win). Pins: 2.
- SearchAction: `search.url` drives the WebSite block's potentialAction
  seam (`{{searchActionJson}}` - the hardcoded `?s=` default is GONE, a
  latent consumer-facing bug in itself); a placeholder-less URL warns at
  load and ships no block. Pins: 2.
- Auto BreadcrumbList: `breadcrumb: true` builds the trail from the URL
  tree (root ships none; manual JSON-LD pages stay silent).
- Per-page article JSON-LD: `article.scoped` (same glob semantics) emits
  typed Article/TechArticle/NewsArticle from the page facts; invalid
  types warn and ship nothing.
- Site verification metas: `verification` provider map, engine-owned
  name spellings (`msvalidate.01` for Bing etc.), unknown providers
  warn.
- hreflang alternates: `locales` glob-to-language map, stem swaps in
  both directions, x-default from a configured root-document pattern;
  pages carrying any hreflang stay silent. Documented as a stem-swap
  calculation, not a file inventory.
- `llms.txt` (`llms: true`): new `engine/llms.js`, reads the same
  indexable page set sitemap/feed honor, missing-only.
- `freestruct audit --external`: opt-in HEAD-with-GET-retry check of up
  to 50 unique external hrefs, warn-grade; json digest merges the rows.
- Also fixed in passing: the `--external` work exposed a dispatch
  subtlety - an async cmdAudit could let a full inject pass execute on
  an audit invocation; runInject now refuses subcommand args outright.
-  Docs: config guide gains the Discovery Options section (search,
  breadcrumb, article, verification, locales, llms; llms also filed
  under the generate options family in spirit), README bullets + audit
  flags line, CHANGELOG 1.1.0 entry extended (the version is untagged,
  so the pass rides inside it), battery count mentions 75 -> 86.
  Counters: battery 75 -> 86 pins.

### Pass 26 - docs staleness sweep + bug/edge/vuln hunt over the new surface (done)

Docs: cli.md audit section (+ --external contract), cicd.md flag list,
README/DEPLOY/lander battery counts. All seven lint:docs gates clean.

The hunt found two REAL bugs, both fixed and pinned (battery +3):

- **Noindex-page junk class**: the generated extras (breadcrumb,
  article JSON-LD, the feed alternate, verification metas, hreflang
  alternates) landed on noindex pages - the 404 first (it is processed
  through the full pipeline by issue #11 contract, so the extras grep
  was a fresh angle), and then the same class on robots-noindex regular
  pages. Now `injectPage` gates ALL generated extras on
  `page.is404 || htmlIsNoindex(html)` - the exact exclusion class
  sitemap/feed/search/llms already honor - while the core injected set
  (canonical, og, twitter, description) stays contractual on the 404.
  Pin 1 asserts both the exclusions AND that the regular pages keep
  the full set.
- **llms.txt line corruption**: a title (or description) carrying an
  embedded newline split a list entry into two lines, silently
  corrupting the summary's shape. `oneline()` flattens \r/\n to single
  spaces; pin 2 asserts the one-entry shape for a newlined title.

The fuzz found the rest clean (all escape/seam contracts held):

- SearchAction target with a quote + tag payload: every `'` -> `\"`,
  every `<` -> `\u003c`; zero raw tag-opens ship (pin 3). The only
  first-run miss was the shell grep's `[^}]*` footgun, not the engine.
- verification meta with a quote + tag payload: attribute-escaped
  correctly (`&quot;` ... `&lt;script&gt;`).
- per-page hostile author into the article block: `\u003c/script>`
  cannot close the script (the raw `>` inside JSON script text is
  inert; only `<` opens tags).
- hreflang with overlapping glob patterns ('**' + '/de/**'): no
  self-referencing or duplicate alternates; x-default only from a
  distinct root-document pattern.
- audit --external scheme cap (http/https only), fetch targeting
  (redirects cannot leave http), 8s timeout, 50-URL cap: acceptable by
  design; warn-grade and opt-in are the posture guards.

### Pass 26.5 - the pack coverage extension (done, same session)

Owner question: "do we need more crashtest attacks to cover it all?" -
coverage audit said yes, three wire-truth gaps against the shipped
surface. Three new pack attacks + three planted regressions, selftest
wired (hardened 8/8 REFUSED, vulnerable 7/7 trip):

- `ldjson-close-canary`: every JSON-LD block in a served head parses
  and carries no raw `</` in its text - the script-close class (the
  per-page hostile author is the planted shape) escapes end-to-end to
  the wire.
- `noindex-extras-leak`: skipped pages (robots-noindex + the 404 body)
  carry none of the GENERATED extras - keyed on the extras' engine
  fingerprints (the compact `"@type":"..."` serialization of the
  generated article/breadcrumb blocks, hreflang, verification metas,
  the feed alternate). First draft banned bare `application/ld+json`
  and EXPLOITED the hardened tree: the 404's core Organization/WebSite
  template blocks are the issue #11 full-pipeline contract, not extras -
  the pack oracle now encodes that boundary exactly (its engine-shape
  fingerprint is the lane precedent, per canonical-query-poison).
- `llms-shape-leak`: when the tree generates llms.txt it honors the
  sitemap page set (noindex never listed) and every entry stays one
  line (the newline-split class from pass 26 is a trip case).
- Selftest fixture opt-ins: breadcrumb, verification, article.scoped,
  llms + hostile-payload canary pages. The vulnerable plants: (5) the
  `\u003c` neutralization drop, (6) extras back onto skipped pages,
  (7) llms leak + split entry.
- Packs README attack inventory updated (5 -> 8 attacks). Counters:
  battery unchanged at 89 pins (the pack attacks live at the wire, not
  in the battery); pack claims in packs/README now truth-aligned.

