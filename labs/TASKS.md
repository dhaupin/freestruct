# freestruct - running task log

> **Purpose:** pass-by-pass history of the v1.0.0 rehaul. What was done, what
> is in flight, what's next. If a session crashes, this file + the git diff are
> the recovery state. Companion doc: `labs/prd-freestruct.md` (the PRD / plan).

---

## Project reality check

- **Repo:** `github.com/dhaupin/freestruct` - checkout lives at `/home/daytona/codebase`. Node/ESM package ("type": "module", engines node >= 20).
- **Side clones (reference only, not shipped):**
  - `/home/daytona/prestruct` - the "big sibling" rig; freestruct borrows its docs workflow, audit gates, and findWorkdir pattern.
  - `/home/daytona/vant` - the **prototype freestruct was made from** (not a consumer - confirmed: no ssr-config.yml, no `_freestruct/`, no injector in their `/docs` build; it is pure Jekyll + Pagefind). Borrowed tidbits are recorded in `labs/prd-freestruct.md` section 5.5.
- **Test battery:** `node test/run.js` from the repo root (fixture site in `test/fixtures/main`). `npm test` is wired the same way.
- **VERSION POLICY (owner call, this pass):** STAY ON 0.6.0. Do not bump the package/README/CHANGELOG version - no 0.7.0, no 1.0.0 bump. Work lands on 0.6.0 until the owner says otherwise. (The v1.0.0 *path* from the PRD section 4.1 still applies as a plan; the version NUMBER itself is frozen.)
- **Verification convention:** a failure triggered rechecking process-state, auth intact, retry/identical output checks, and expandability probes; source review passed with no regressions contested - outcomes evaluated against working-tree state, never comfy assumptions.
- **Stone convention (owner-ratified):** at pass end, refresh the boot model and copy it into the repo:
  ```
  cd /home/daytona/vant && node bin/vant.js snapshot --brain freestruct \
    --output models/public/freestruct/boot/freestruct-p_v5frogstone2026.svg \
    --password v5frogstone2026
  ```
  then copy the SVG into the repo `horcrux/` (same name).
- **Local simulation litter to remember:** Jekyll-shaped dry runs of the docs pipeline (from the dogfood check in pass 5) drop `docs/_case/styles/*.html`
  - remove after inspecting, they are not part of the pipeline.

---

## Pass log

### Pass 0 - Recon + PRD (done)
- Audited the rigging; warts classed by crash impact (issues #1-#14 in the PRD, "verified, not vibes").
- Wrote `labs/prd-freestruct.md`: 4 phases (0-3), owner-decision list (section 4), the v1.0.0 path (section 4.1), success criteria (section 5).
- Owner picked the stone password (`v5frogstone2026`); stone minted in the prestruct repo (temporary home until freestruct repo owns `horcrux/`).

### Pass 1 - Prestruct absorbed (done)
- Cloned prestruct, read `AGENTS.md`, `labs/prd.md`, `init/`, `example/`, workflows, audit-gate scripts.
- Takeaways adopted later: ESM-first decision input, findWorkdir walk-up pattern, docs-audit gate scripts as a Phase 3 port item, canonical-scheme lesson (scheme truth lives in `_config.yml`, not layouts).

### Pass 2 - Phase 0: safety net + packaging truth (done, v0.3.x line)
- `test/run.js` battery born: committed fixture site with edge cases (amps, unicode, `lang`, existing OG, missing title, noindex page); every phase-1+ / phase-2+ step lands AFTER its regression test exists.
- Packaging: bin shim shebang, `--version` / `--strict` flags, positional output-dir story settled, publish path decided.
- Version truth aligned (README pinned to package.json by battery).
- CI workflow for the injector landed.

### Pass 3-4 - Phase 1: module decomposition (done, v0.5.0)
- **Runtime:** ESM, node >= 20 (owner ratification).
- **The monolith died:** 577-line `inject.js` split into `config.js`, `scan.js`, `seo.js`, `xmllike.js`, `notfound.js`, `linkcheck.js`, `search.js`, `hooks.js`; `inject.js` remains as CLI orchestrator composing named steps.
- **Root resolution:** config discovered walking UP from cwd (subdir runs work); templates/snippets resolve next to the config file; output dir defaults to `<configDir>/_site`.
- **XML class fix (F5):** shared escape helper; sitemap gets real per-file `lastmod` (mtime, not build time); RSS gets honest dates.
- **404 pipeline (F7):** generated 404 gets full SEO + noindex, and feeds the late passes like any other page (caught a `title: null` regression live).
- **`--strict` (F9):** nonzero exit on broken links + noindex leakage; default stays report-only.
- Each step landed after its regression pin; battery green each time.

### Pass 5 - Dogfood check (done)
- Ran the docs pipeline as the repo's own consumer to see what Phase 1 did to the default path.
- Result: honest-date mechanic works; caught warts #10 and #12 live (config warnings, http canonicals) - both became Phase 2 fuel.
- Cleaned simulation litter; fixed the small dogfood findings in `docs/ssr-config.yml`, `docs/_config.yml`, `package.json`.

### Pass 6 - Vant reconnaissance (done, recorded)
- Deep-dive of `github.com/dhaupin/vant` done BEFORE its status was clear; truth-check: vant does **not** consume freestruct - it is the prototype freestruct was extracted from (owner confirmed).
- Adopt-worthy tidbits (recorded in PRD section 5.5): Pagefind-via-official-npm dist (`npm i --no-save pagefind` + `npx pagefind --site _site`, replaces the old curl-scrape dance), inline `cd docs && jekyll build` safety belt, and the single-source nav + no-theme docs frame (the Phase 3 port item).
- Reference clone retained at `/home/daytona/vant` for Phase 3 material.

### Pass 7 - Phase 2: config contract + honesty (done, v0.6.0)
- **Config rename with back-compat:** `freestruct.config.yml` primary (walk-up discovery), legacy `ssr-config.yml` still read; repo's own config renamed.
- **Schema + structured diagnostics:** unknown keys and retired flags (`preserveExistingMeta`, `generateNav`, `cacheBusting.hash`) emit loud `[freestruct] config warning: ...` lines.
- **`search.json` opt-in** (owner call): only with `searchIndex: true`; docs site stays Pagefind-only.
- **FAST_FAIL exit codes:** 1 config fatal, 2 template missing, 3 output dir missing; `--tolerant` downgrades fatals to exit 0 for CI.
- **Snippet placeholder substitution ships** (`{{siteName}}`, `{{siteUrl}}`, `{{buildHash}}`, ...); comments still stripped pre-insert - issue #10 closed.
- **basePath contract (issue #3):** new `docs/lib/urls.js`; canonical = url + basePath + slug - strips a doubled deploy-directory prefix but never a directory-page trailing slash; pinned with both tree shapes.
- **Docs honesty:** full config table in README (minify, hashInCanonicalUrl, assetQueryParam, runHooks were previously code-only); footer template comment drift fixed; `docs/guides/*` still call it `ssr-config.yml` - see Next up.
- Battery grown to 36 green; `npm pack` verified at 0.6.0 (17 files).

---

## Current state (as of this pass)

- **Working version:** 0.6.0, battery 36/36 green, tarball verified.
- **All phases 0-2 complete.** Open PRD warts remaining: link-check is report-only (#4 - `--strict` is the graduate lever), ~2 open owner calls (publish path is settled; noindex/sitemap handled; search.json resolved).

### Pass 8 - Phase 3: docs frame + audit gates + release story (done, on 0.6.0)
- **Version freeze honored throughout:** every edit landed on 0.6.0; the PRD's v1.0.0 tagging steps (section 3 Phase 3 endpoint, section 4.1 step 2) are annotated as superseded by the owner call. Tarball re-verified (17 files).
- **Nav layer resolved (PRD option: delete the generator):** new `docs/_data/nav.yml` single-source menu (prestruct shape, `site.data.nav` consumed by both header and sidebar); `_plugins/nav_generator.rb` and `docs/guides/dynamic-nav.md` deleted; `_config.yml` nav knobs removed; `navigation.md` rewritten to document the data-file layer honestly.
- **Docs-audit gates ported and wired into CI:** one runner, `scripts/run-docs-audit.cjs` (frontmatter / links / nav symmetry / style / truthfulness over CLI flags + config keys), stepped into `.github/ workflows/test.yml` after the battery.
- **First audit run caught real warts** (the port paying for itself immediately): one missing closer in `guides/ssr-config.md` had flipped fence parity for the entire reference page; CDN purge examples showed invalid top-level `purge:`; a retired `hash: true` example; stale `ssr-config.yml` references across 12 files (swept to the new name, legacy mentions kept deliberately); emoji in prose; untagged fences; a broken layout link; `description` missing in two frontmatters. All fixed; gates clean.
- **README rewritten:** working quick start (install -> config scaffold -> build -> verify -> flags), honest opt-in search story, Releases section (CHANGELOG is the changelog, tags are the release story, CI version pin stays), and the stale-claim culls (hero badge de-versioned in the layout; the battery's version-truth pin caught the rewrite dropping the `## v0.6.0` heading - restored; pin enforces 0.6.0 everywhere per the freeze).
- End-to-end: battery 36/36 green, docs audit 0 findings, tarball 0.6.0.

### Pass 9 - GitHub push + follow-on items + Phase 4 start (in progress, on 0.6.0)
- **Pushed everything:** 54-file rehaul commit landed on `main` (66cc52f..759d0a4) via Freebuff's managed credential; includes Phase 1-3 code, TASKS log, and the refreshed stone.
- **Pagefind-via-npm swap (section 5.5 tidbit 1):** docs.yml now does `npm install --no-save pagefind` + `npx pagefind --site docs/_site`; the `npm install -g` global is gone.
- **Link-check graduated (#4):** the `--strict` lever is adopted in our own docs CI - broken internal links now FAIL the GitHub Pages build (semantics verified in inject.js before adoption: noindex leak gate stays report-only).
- **Tarball e2e made a committed, CI-gated proof (Phase 4 item):** `scripts/e2e-install.cjs` packs the REAL tarball, installs it into a throwaway project, runs the README quick start through the bin shim, and asserts artifacts + injections + exit shapes. First CI-enabled run caught TWO real fresh-install bugs repo runs hiding in the harness could never see:
  1. template resolution didn't fall back to the package-shipped `docs/_freestruct/` (exit 2 on every fresh install) - fixed with the user-staged-first/package-fallback chain + battery pins (FREESTRUCT_SKIP_PACKAGE_FALLBACK seam for the staged-only pins);
  2. the main-module guard compared raw argv paths, so npm's symlinked .bin shim ran silently (exit 0, no work) - fixed with a realpath-vs-realpath comparison; battery back to green (37 pins now). Wired into test.yml (every push) and as a hard publish gate in publish.yml (the runbook's own "no tag until the tarball is proven" rule).
- **Version pin tightened to the freeze:** the battery's version-truth pin now enforces exactly 0.6.0 in package.json + README + CHANGELOG until the owner says otherwise.
- **Jekyll-leg safety belt (section 5.5 tidbit 2):** docs.yml build step inlines `cd docs &&` instead of trusting step-level working-directory.

### Pass 10 - prestruct-shaped house structure: engine/ + init/ + bin/ (done, on 0.6.0)
- **Owner approved the prestruct-derived house structure.** Study: prestruct ships `engine/` (runtime), `init/` (consumer scaffold kit, version-stamped, shipped in `files`), `example/` (dogfood site), `bin/cli.mjs` (thin CLI), and syncs engine-vs-kit copies in CI (the W1 engine-drift lesson, which bit their published qc.test, encoded as a `sync:check` CI step).
- Mapping executed: `docs/lib/*.js` -> **`engine/`** (8 modules + orchestrator, `main`/`exports` point there); canonical packaged templates -> **`engine/_freestruct/`** (fixed a `'../_freestruct/'` vs `'./_freestruct/'` sibling-path bug the battery's fallback pin caught immediately); **`/docs` stays the example** (staged template copies restored via sync, so the dogfood build exercises the recommended consumer shape); **`init/`** scaffold kit created (VERSION + README + starter config + template copies, exported and shipped); **`bin/freestruct.mjs`** thin CLI entry; **`scripts/sync-templates.mjs check`** wired into test.yml.
- Consumers' guide commands moved to `npx freestruct`; repo/CI invocations moved to `node bin/freestruct.mjs`; `printVersion()` fixed for the new depth (`../package.json`); battery's packaging pin updated to assert the house structure (bin/engine/init whitelist + bin + main targets).
- Side benefit realized: Jekyll previously copied `docs/lib/*.js` into `_site/lib/` (source code shipping in the docs artifact); the move eliminates that leakage.
- No compat shims for old paths: the package was never npm-published, and vant (the prototype) is not a consumer - breaking internal paths now is free; the freeze (0.6.0) stays.
- End-to-end: battery 37/37, sync-check lockstep, docs audit clean, tarball e2e proven (bin/engine/init all in the 0.6.0 tarball).

### Pass 11 - strict harvest: docs workflow unbreak + 3 real 404s + stone (done, on 0.6.0)
- **First real GitHub Pages `--strict` harvest (Phase 4 candidate, done):** the last two pushes' docs runs were failing at 0s and nobody had looked: docs.yml itself was UNPARSEABLE YAML - two step names carried unquoted `cd:` / `--strict:` (plain-scalar `: ` kills the file), so the "0s failure" was GitHub refusing the workflow, not a build failure. Classical CI-verifier lesson: `test.yml` proved the engine green while the Pages pipeline silently never ran. Annotations moved into step comments; all four workflow files now battery-pinned to parse-check locally (js-yaml in CI too, next push onward).
- **Strict mode's first real catch (3 production 404s, all in `contributing/style.md`):** two root-absolute `.html` links that pretty permalinks make wrong (`/configuration.html`, `/getting-started.html` - real URLs are `/configuration`, `/getting-started`), one relative link into the source tree (`../ _layouts/default.html`) that does not exist in the built output. Swept the docs tree: no other links in either broken class. These were shipping 404s in production since the rehaul.
- **Site truth note:** the docs site uses `permalink: pretty`; consumers don't have this constraint (their SSG decides), but OUR dogfood links must address the parked URLs the layout actually serves.
- **Stone refreshed at pass end** (convention, deferred twice - now done): vant snapshot re-run; horizon `horcrux/freestruct-p_v5frogstone2026.svg` updated, sha256 `6dd67eca...d449ef` verified against the vant output.
- Version freeze untouched: everything above ships under 0.6.0.

### Pass 12 - crashtest pack surface: packs/ + freestruct-docs-shapes + dogfood (done, on 0.6.0)
- **Owner-directed:** a `packs/` folder in the freestruct repo, a README explaining crashtest + packs (crashtest.creadev.org, docs.creadev.org/ crashtest, creadev.org), the pack list, then the pack itself - and a real run against freestruct to see what falls out.
- **`packs/README.md`** covers crashtest (in-process adversarial QA, honest verdicts), the one-surface pack model (`packs/public/<name>/pack.json` + scenario-contract entry; adoption = one `packs:` line), and the house rule (pack manifests carry their own semver).
- **`packs/public/freestruct-docs-shapes/`** (0.1.0, five attacks, zero deps, zero sockets): hostile-traversal-404 (traversal shapes + artifact query-independence), gen404-noindex-canary (issue #11 contract), noindex-artifact-leak (issue #5: a noindex page listed by sitemap IS the leak; search.json/feed.xml too), canonical-query-poison, and sitemap-xml-shape-canary (issue #9 escape class). Cross-repo doctrine honored: no crashtest imports, inline verdict helpers, honest skips (prestruct-proxy precedent).
- **Run root:** `labs/static-site-target.js` models the GitHub Pages class of static host (pretty-permalink/.html/dir resolution, 404 + generated body, containment refusal); `crashtest.config.js` at the repo root wires it with `SITE_ROOT` (default `docs/_site`) and adopts our packs.
- **Teeth proof (`scripts/packs-selftest.cjs`):** commits the two-sided proof - the hardened build holds (5/5 REFUSED, 35/35 with the library skips) and a deliberately regressed tree trips every planted oracle (404-noindex loss, sitemap/feed/search noindex leak, raw ampersand, traversal escapes). First draft earned two honest fixes: the leak oracle now treats sitemap listing itself as the leak, and the ledger reader keys attacks by row id (no `attack` field - receipt-driven).
- **CI dogfood + testing hook (follow-up same pass):** docs.yml runs `npx crashtest run` after the strict step (EXPLOITED rows fail the Pages build), and test.yml gained the pack selftest as a HARD gate on every push/PR - teeth proven both ways in CI, no crashtest checkout needed (`CRASHTEST_BIN=node_modules/crashtest/bin/crashtest.js`). Both workflows pin the install to the crashtest main sha `dc80a7c7...` - never a mutable latest (the vant predeploy lesson). Rehearsed locally via the exact command shape first; one honest fix on the way: the selftest resolves CRASHTEST_BIN against the CALLING cwd (a relative path vanished once the campaign spawned from a temp cwd). `npm run packs:selftest` is the local entrypoint.
- **Battery pin:** the pack surface is battery-pinned (packs/README ships, manifest schemaVersion 1 + name/dir match, entry importable and scenario-contract-shaped) - 39/39 now.
- Run artifacts are gitignored everywhere (`labs/crashledger.json`, `hardening.md`, `run-meta.json`) - campaign ledgers belong beside the config that produced them, not in the tree.
- Version freeze untouched: everything above ships under 0.6.0.

### Pass 13 - issue sweep: the two live fixes + receipts closure of the queue (done, on 0.6.0)
- **#15 FIXED** (f9fb526): the static `<script src>` pagefind preload was dead code (doSearch() does the dynamic `await import` per query) and was exactly what threw `import.meta outside a module` on every page under pagefind 1.5.x. Removed, plus the dead `pfModule` stub; layout comment records the contract (pagefind loads lazily, ESM only).
- **#16 FIXED** (f9fb526) honestly: the flagged `--ink-light` token lives in crashtest's vendored copy of the layout (already fixed there to #94867a = 5.25:1) and ships NOWHERE in the freestruct tree - but the same failure class did exist in OUR theme: the code-block language label #888 on #1f2937 = 4.14:1 -> now #9ca3af = 5.78:1 (WCAG 2.x luminance math, computed, with the receipt in the CSS comment).
- **Receipts sweep done: #2-#16 all CLOSED with per-issue receipts** - battery pin numbers, CHANGELOG/PRD phase references, pack/wire guards named, and the two CI-verified commits cited for #15/#16. The tracker now matches the repo truth: freestruct's queue is EMPTY.
- CI verification: test green + Pages deploy green on f9fb526 (the first-run crashtest dogfood step is slower than the presets - future pushes should stay near ~2min with npm's cache warm).
- Version freeze untouched: everything ships under 0.6.0.

### Pass 14 - CI tempo: measured, then cached (done, on 0.6.0)
- **Q from the owner: does freestruct actually work? Speed up the CI? Answered with run-step telemetry, not vibes.** The tmp-install proof is scripts/e2e-install.cjs - real `npm pack` -> throwaway install -> README quick start through the bin shim - CI-gated on EVERY push (and hard-gated in publish.yml); it caught two real fresh-install bugs and is green on the current commits.
- **The bottleneck was never pagefind** (1s install + 1s index in the previous run's telemetry): step timings showed `Crashtest the built docs` at 422s and `Install freestruct deps` at 301s. Log line that named the cause: `npm install github:crashtest#<sha>` = "added 1 package in 7m" cold on a runner, while the campaign itself ran in ~1s (353 requests).
- **Fixes (9717caf + this pass):** crashtest's github install is now cached `node_modules/crashtest` keyed by the pinned gate sha in BOTH workflows (misses-only install; direct bin call, no npx dependency on .bin state); docs.yml gained `npm ci` + setup-node `cache: npm` (was a plain `npm install`); and pagefind - which became the new 355s sink (its npm package resolves a platform binary cold) - got the same treatment: `pagefind@1.5.0` pinned, cached by version, bin called directly. Bump a pin = new cache key = fresh install, honestly.
- CI runs after the change: test + Deploy Docs green on the pushed head.
- Version freeze untouched: everything ships under 0.6.0.

### Pass 15 - readme/meta surface rewrite + repo hygiene + artifact audit + gate cherry-picks (done, on 0.6.0)
- **Owner call:** redo README completely, add root AGENTS.md + DEPLOY.md crosslinked together and with the README; refresh .gitignore; add .ignore for search hygiene; verify sitemap/robots/404 handling; cherry-pick the vant/prestruct docs-lint gates; make code comments consistent.
- **Artifact audit first, and it found real bugs the pins had missed:** robots.txt's sitemap pointer and the RSS channel/atom self links ignored basePath (the #3 class in different artifacts - pointers 404 on sub-path installs), and the generated 404 carried a hard-coded raw-site.url home link plus a guessy `/docs/` link. All moved onto the pageUrlFor contract (robots pointer, feed channel/self, 404 form + home link); the basePath pin grew assertions for each (robots, feed self-link, 404 home link, and a no-doubling check on both). The 404's generated page no longer ships a link to a path that never exists.
- **README rewritten** around the quick start with the full crosslink surface (docs site, docs system, family sites, meta files); `## v0.6.0` block restored after the first battery run flagged its removal (the version pin working as designed).
- **AGENTS.md + DEPLOY.md landed at root:** house rules/structure/gates and the release truth (Pages pipeline, npm runbook, measured-cache discipline). docs/AGENTS.md stays the rendered engineering-decisions page; the root file is the orientation file linking to it.
- **Gates cherry-picked from vant:** English-only language gate as `scripts/check-language.cjs` (script-block longest-run detection, URL/ import/base64 exemption, fence/inline-code/frontmatter exemption) wired into the docs audit runner as the `language` gate; the vant voice checks (em/en dash rule with CHANGELOG exempt, tabs, table-row shape) folded into `style` with inline-code-as-data posture; new `codefmt` gate pins engine source headers to `// engine/<file>.js - <purpose>` (the format that would have caught the whole rehaul leaving eleven headers saying `freestruct lib/...` behind).
- **Comment format normalized:** all eleven engine headers rewritten to name their own path; section banner style unchanged (already uniform); bin/scripts carry the same shebang-plus-purpose shape. The format is now AGENTS.md policy, machine-checked by `codefmt`.
- **Hygiene:** .gitignore rebuilt (build outputs, env files, npm cache, crashtest artifacts, editor noise); `.ignore` added for ripgrep-family search scoping (machine artifacts only).
- **End-to-end:** audit all seven gates clean (language PASS over 23 prose files), battery 39/39, and the whole set rides the same CI.
- Version freeze untouched: everything ships under 0.6.0.

### Pass 16 - coverage gap audit + dead-code cleanup (done, on 0.6.0)
- **Owner question:** missing tests/probes/gates? untested-but-should-be parts? rogue/dead code? Audited against the pin wall rather than opinion.
- **The gap was real and it was the worst possible one:** `engine/hooks.js`
  - the only engine code that EXECUTES SHELL COMMANDS - had zero battery coverage. Two canary pins added (39 -> 41): disabled-by-default (a configured purge canary NEVER runs without runHooks; genuinely executable proof), and runHooks:true executes with truthful $SITE_URL/$BUILD_HASH/$OUTPUT_DIR substitution (the marker file content is asserted field by field against the printed build hash). The first draft of the pin pair caught paper-only helpers (FIXTURE_YAML_BASE) before they shipped - the wall works.
- **Dead-code verdict:** `scan.js::stripRobotsMeta` had NO caller, and `notfound.js::pipeline404` carried the identical regex inline (a ** comment even said 'un-duplicated' while duplicating). Fixed by pointing the pipeline at the scan.js helper - one regex, one owner, zero dead exports. Everything else on the engine export surface proved live (checked callers across engine/test/scripts/bin).
- **Stale-claims cleanup, receipts-checked:** docs/AGENTS.md's Important quirks said purge hooks were 'commented out in inject.js' (false since Phase 1.1) and 'preserveExistingMeta default: true' (retired key) while the battery proves 404s DO get canonicals now - all rewritten with the current truth and pin references. CONTRIBUTING.md still sketched a pre-rehaul architecture (adapters/ + plugins/ tree that never existed, open questions all since answered) - rewritten honestly for the shipped engine/ shape with the scope discipline and CI gates inlined. release.yml example tag updated v0.4.0 -> v0.6.0 to match the current release era.
- **What the audit found ALREADY covered:** every engine module's behavior rides behavior pins (the module names do not appear in test/run.js, but each module's contract is asserted by name through the workflow pins); minify/hashInCanonical/assetQueryParam have pins (2 config-flag pins); -- strict link/noindex semantics pinned; bin shim covered by e2e + shebang pin + library-API guard realpath comment. Remaining honest gap after this pass: none load-bearing - future pins grow with features.
- **End-to-end:** audit 7/7 gates clean, battery 41/41, sync lockstep, tarball e2e proven, pack teeth proven, workflows parse.
- **The CI dogfood found one more - and it was OURS, twice over:** the live Pages build went red with `noindex-artifact-leak: EXPLOITED` on /engineering-decisions. Truth chain: no noindex exists anywhere on that page (frontmatter clean, layout emits none) - the pack's noindex oracles searched page BODIES for the WORD, and docs/AGENTS.md legitimately discusses noindex, so the oracle false-positived. Broke the pack's own content-shape doctrine (0.1.0 -> 0.1.1): both oracles now require the robots META that declares noindex (attribute order free); documented in-source with the failure story. Selftest teeth re-proven both ways; battery unchanged (fixture pages genuinely noindex).
- Version freeze untouched: everything ships under 0.6.0.

### Pass 17 - version truth swept to 0.9.0 (owner call, done on 0.9.0)
- **OWNER CALL supersedes the freeze:** the version number moves 0.6.0 -> 0.9.0. The structural freeze policy was doing its job (one number everywhere behind a CI pin); the owner chose to promote that truth. Sweep executed over the AUDIT's live-truth set: package.json, README (release line + the `## v0.9.0` heading the battery pin reads), CHANGELOG (new top `[0.9.0]` entry - the promotion rollup - with the [0.6.0] entry left verbatim as history), `init/VERSION`, the battery pin itself, CONTRIBUTING.md / AGENTS.md / DEPLOY.md policy text, and the release.yml example tag. Historical notes in TASKS/PRD/CHANGELOG during the freeze stay verbatim - that is what 0.6.0-era passes shipped under, and rewriting logs would falsify the record it exists to keep.
- The pin wall now enforces exactly 0.9.0 everywhere until the owner moves it again.
- Version truth: package.json == README heading == CHANGELOG top entry == 0.9.0, battery-pinned.

### Pass 18 - audit + SEO pass + prestruct port wave + CLI (done, on 0.9.0)
- **Docs audit:** every page carries complete frontmatter; nav_order normalized 0-14 to the nav.yml listing order; seven missing Related blocks written and crosslink resolution machine-verified (zero unresolved).
- **SEO pass on the live site:** the twitter handle placeholder left the dogfood config (the engine now skips `twitter:site`/`creator` without one); `style.md` permalink normalized; the og:image pointed at a live 404 - `docs/og-image.png` generated (1200x630, pure-Node PNG writer, no deps).
- **Prestruct port wave (CHANGELOG section):** attribute-escaping for all injected values, JSON-safe JSON-LD literals, `og:image`/`twitter:image` ship-when-set, `twitter:description`, `author` -> JSON-LD founder, per-page `<!-- freestruct: {} -->` overrides (previously documented, never implemented), custom `jsonLd` hook. The dogfood config now carries author (Creadev.org) + jsonLd (dhaupin) and dropped two retired keys.
- **Deterministic build hash:** content-derived (prestruct deploy-id audit ported); the generated head tail, generated 404, late-pass metas and `loading=lazy` are excluded from the hashed view so reruns stay stable.
- **CLI:** `validate` / `init [dir]` / `help` (+ the `--help` alias); dispatch is module-level because the bin shim imports `runInject` - the first cut put the dispatch behind `invokedAsMain` and the tarball e2e caught it live.
- `FREESTRUCT_URL` env override implemented (documented, never honored before); **Docs:** new CLI Reference page (nav + frontmatter + Related), links from getting-started/README, hash + env-override docs made honest.
- Battery 36 -> 49 green; sync:check, lint:docs (all 7 gates) and the tarball e2e all clean.

### Pass 19 - config reference rename with a live redirect (done, on 0.9.0)
- The Freestruct.config.yml Reference page dropped its legacy ssr-config slug: `docs/guides/ssr-config.md` -> `docs/guides/freestruct-config.md`, nav entry and every crosslink swept (docs pages, nav.yml, README, AGENTS); no remaining `guides/ssr-config` references.
- Old URL keeps resolving: a noindex redirect stub at `docs/guides/ssr-config/index.html` (meta refresh + JS fallback to the new URL, canonical pointed at the new location, noindex so the engine filters the stub out of sitemap/feed - verified through the real engine). GH Pages 301s the no-slash variant into the stub.
- Battery 49/49 + lint:docs gates + tarball e2e clean; CI green and the live URL shapes curl-verified (200 stub / 301 / 200 new canonical).

### Pass 20 - toolchain/CI bump + release validation + v1.0.0 draft (done, on 0.9.0)
- **No width rule anywhere:** the suspected 72-char prose cap does not exist in the freestruct gate family (checked style/language/audit scripts and prestruct's) - nothing to remove.
- **CI on Node-24-compatible action majors** (GitHub retired the Node 20 action runtime 2026-09-23): checkout v7, setup-node v7, cache v6, upload-pages-artifact v5, deploy-pages v5; docs/test project node 20 -> 22.
- **Docs stack:** Jekyll Gemfile 4.3 -> 4.4, Ruby 3.3 -> 3.4, Gemfile trimmed of never-loaded jekyll-seo-tag/jekyll-sitemap; prismjs CDN 1.29 -> 1.30; pagefind CI pin 1.5.0 -> 1.5.2 (cache key bumped).
- **js-yaml 4 -> 5.5.0:** v5 dropped the default ESM export - imports moved to named `load` (engine/config.js + test/run.js); battery-verified.
- **Release wiring verified:** publish.yml (npm publish on v* tags, tarball e2e gates the publish) + release.yml (GitHub Release from the same tag, notes extracted from CHANGELOG.md, tag==package.json pin check). Both dormant until the owner cuts the first tag after the npm bootstrap.
- **Dry-run packaging validated:** npm tarball = exactly the 25-file files whitelist; GitHub source tar mirrors the tracked tree (fixture built `_site` present by design - it is the battery's input state).
- **docs/discussions/announcing-v1.0.0.md** added, prestruct's announcement frame: a copy-pasteable Discussions post draft for when v1.0.0 is cut.

### Pass 21 - version sweep to 1.0.0 (owner call, done on 1.0.0)
- The owner completed the one-time manual npm bootstrap; the package is on npm. Per owner call the version truth moves 0.9.0 -> 1.0.0 across the four agreement spots (package.json, README release line + `## v1.0.0` heading, CHANGELOG top entry, `init/VERSION`) plus the runbook example tag (release.yml), DEPLOY/CONTRIBUTING/AGENTS pin wording, the v1.0.0 section intro (first stable - carries the rehaul stack, the port wave and the toolchain pass), and the TASKS reminder.
- Announcement draft at docs/discussions/announcing-v1.0.0.md updated: the bootstrap is done, only the tag remains before the post goes into Discussions.
- **NO TAG cut by instruction** - the owner gates it; publish.yml + release.yml fire from v1.0.0 when it lands.
- Battery version pin green at 1.0.0; sync:check, lint:docs and the tarball e2e clean before the push.

## Next up (open, unowned)

State of this list as of Pass 20 (truth-up over the stale entries below it in the pass log, which are history): the repo side of the v1.0.0 path is closed. What remains is owner action plus one bookkeeping sweep.

- The two live findings are DONE, the ledger just lagged: #15 (pagefind 1.5.x static preload) is fixed by design - `docs/_layouts/default.html` loads Pagefind as a dynamic ESM import inside the search modal only, with no static `<script src>` preload, and the live site serves exactly that; #16 (`--ink-light` WCAG) is moot in the current tree - no `--ink` token exists in `docs/assets` or the layouts anymore (if it is ever reintroduced, the `#94867a` AA-passing shape is already proven in crashtest's copy).
- Issue queue is CLEAN (verified against the tracker, not the old ledger text): #2-#16 are all CLOSED (the owner closed them on 2026-10-22; #1 was never filed - it lived in the PRD's internal numbering only). This pass attached the sweep receipts: each of #2-#14 now carries a closing comment naming its fix (engine module / battery pin / CI gate) so the closure is traceable, not vibes.
- **Before the npm release, owner actions only (PRD 4.1 steps 3-4):**
  1. One-time manual bootstrap publish from a dev machine (`npm publish; OIDC cannot create a brand-new package; do not set publishConfig.provenance for it).
  2. npmjs.com -> freestruct -> Settings -> Trusted Publisher (user dhaupin, repo freestruct, workflow publish.yml).
  3. Owner cuts the first tag (`git tag v1.0.0 && git push origin main --follow-tags`); publish.yml + release.yml fire from there, and the announcement draft at `docs/discussions/announcing-v1.0.0.md` is ready for the Discussions post.
- No repo-side gate remains open on the freestruct side: battery (49 pins), docs audit (7 gates), template sync, tarball e2e, crashtest pack selftest
  + docs dogfood and the version-truth pin are all CI-green on main.

**Reminder (current truth):** the pin wall enforces 1.2.0 everywhere - the post-queue engine sweep, owner bump applied 2026-10-28 (the 1.1.0 post-stable surface landed 2026-10-25, the 1.0.0 first-stable 2026-10-22). The manual npm bootstrap is done; the tag is the only remaining owner gate.

### Pass 22 - the issue sweep, all eight open items (done, on 1.0.0)

Scope: every open issue at the time of the pass, phased smallest-first. Receipts:

- **#17** - dead `prism-line-numbers.min.css` CDN link + the orphan `.line-numbers` support CSS removed from `docs/_layouts/default.html` (both no-op removals, verified in the built docs).
- **#24** - every config/page-carried value now rides FUNCTION replacers: `engine/hooks.js` purge substitution (shared `substitutePlaceholders` helper) and the three `engine/seo.js` insertion spots (`</head>` head injection, header/body-start/footer snippets). Three battery pins pin the class dead (`$&`/`$1`/`$'` in purge urls, snippet bodies, and `site.name` all print literally).
- **#23** - the announcement file IS the post now (family convention, crashtest-amended format; frontmatter contract kept, wrapper block removed) + the direct Creadev.org workshop backlink in the root README.
- **#20** - structured `og.image` object form `{ src, width, height, alt, allowSvg }` with og:image companions; string form untouched (back-compat); the SVG blank-card trap warns on every run (config-level in `config.js`, per-page in `seo.js`), `allowSvg: true` accepts it, `--strict` graduates the class to a build failure. Four pins; config-guide + README updated.
- **#21** - general `hooks.postBuild` seam in `engine/hooks.js` (same runHooks gate, 30s timeout, `$`-placeholders + `FREESTRUCT_*` env on the child); a nonzero hook exit fails the build with the new exit code 4 (documented in cli.md + README). Four pins; shape diagnostics in config.js name unknown seams and non-string entries.
- **#18** - `freestruct audit` subcommand, ported from the donated prestruct#34 script into `engine/audit.js`: per-page head hygiene (core og/twitter FAIL class + set-coherence WARN because missing-only means SSG-owned partial sets are legitimate), 404 noindex contract, sitemap and robots checks, `--json` digest, exit 0/1 (3 for a missing dir; asset-existence checks are report-grade WARN by design). Three pins including a clean run audits clean + doctored output fails.
- **#19** - IndexNow: `engine/indexnow.js` (key resolution generate-once and persist, `<key>.txt` emitted per run, sitemap reader, submission POST), `freestruct indexnow [--dry-run] [outputDir]` subcommand, config shape diagnostics (32-hex key contract). Four network-free pins; cli.md
  + config guide + README document the post-deploy semantics.
- **#22** - per-page OG image generation: `engine/ogimage.js` renders per page from a consumer SVG template (`{{ogTitle}}`/`{{ogDescription}}`/ `{{ogUrl}}`, XML-escaped), rasterizes through the OPTIONAL `@resvg/resvg-js` package (devDependency, consumers opt in; loud skip when absent - pure Node cannot rasterize), wires og/twitter + #20 companions under missing-only (pages with their own og set keep it wholesale; noindex pages get no share preview). Three pins; config guide gained the Image Generation Options section.

Counters: battery 49 -> 69 pins (all green), engine modules 9 -> 12 (audit/ogimage/indexnow join; hooks.js grew the general seam). Gates re-run at the end of the pass: battery, lint:docs, sync:check, e2e. Next pass picks up: none of #17-#24 remain; the issue queue is empty and the version is owner-gated as ever.

### Pass 24 - version sweep to 1.1.0 (owner call, done on 1.1.0)

Preceded by the pass-23.5 edge hunt: ran crashtest (pack selftest against the pinned checkout) and packstruct (manifest lint + deep module census) locally, then probed the new seams for edges. One real bug found and fixed: an array-valued `og.scoped` variant slipped past the config shape diagnostic (arrays pass the `typeof object` check) and the runner would have shipped a garbage comma-joined `og:image`. Now the diagnostic names the value class, the runner resolves wrong-shaped variants to NO image, and a pin keeps the honest-absence behavior. Battery 74 -> 75.

Then the bump, consciously flipped per the owner call, same ritual as the 1.0.0 sweep: package.json + package-lock, `init/VERSION`, README (release line + the new `## v1.1.0` section above the `## v1.0.0` one), CHANGELOG new top entry, the battery pin (test name + message), DEPLOY (pin wording
+ battery count 49 -> 75), CONTRIBUTING + AGENTS pin wording, release.yml tag example, and this reminder line. Next pass picks up: the owner tag (`git tag v1.1.0 && git push origin v1.1.0`) - publish + release fire from the tag, proven on 1.0.0.

### Pass 23 - scoped jsonLd (#25) + og.scoped follow-on (done, on 1.0.0)

Split out of #19's tail per the filer's own request; filed as #25 with a battery-pin sketch and built in the same pass.

- **The matcher:** `engine/urls.js` grew `slugMatchesGlob` + `globSpecificity` - slug-keyed glob language (`/` exact root, `/faq` exact page, `/blog/*` one segment, `/guides/**` the sub-tree itself and below, `**` anywhere). Specificity ranks exact > literal-heavy glob > `**`; pins caught two matcher bugs before they shipped (the `/**` normalization trap and a stale helper name).
- **Scoped jsonLd (#25):** the #25 map form keys blocks by slug glob in `seo.js` - legacy single-object/array untouched; every matching key ships, most specific first; missing-only holds (own-LD pages get nothing, scoped included); malformed entries warn and skip only themselves; config.js shape diagnostics name the mixed-keys mistake. Four pins per the #25 sketch.
- **og.scoped (follow-on, closed inside #25's commit):** image variants keyed by the same glob language; the MOST SPECIFIC match wins (images are singular), the global `og.image` is the fallback, per-page overrides and #22 generated images still rank ahead; structured variant values ride the #20 companions; the allowSvg ladder follows the winning descriptor. One pin.
- Docs: config guide (jsonLd scoped section + og.scoped), README feature bullet. Counters: battery 69 -> 74 pins.
- Also this pass: the v1.0.0 announcement draft is unwrapped (the family ~72-char hand-wrap made every paste-to-Discussions re-flow read like poetry; one flowing line per paragraph now, fences untouched, and the audit passes with zero findings on the unwrapped file) and renamed to `docs/discussions/announcing-freestruct-v1.0.0.md` for cross-repo clarity (permalink and nav entry follow; the prestruct#48 convention pull proposes unwrapping family-wide). Earlier TASKS/CHANGELOG path references stay verbatim - they describe the tagged v1.0.0 state.

### Pass 25 - the SEO-gap pass lands (done)

All eight gaps from the post-1.1.0 audit table, one landing, all opt-in config, all missing-only, all pinned:

- Feed autodiscovery: the injected head carries the rss alternate link (`generateFeed` gate honored, page-owned alternates win). Pins: 2.
- SearchAction: `search.url` drives the WebSite block's potentialAction seam (`{{searchActionJson}}` - the hardcoded `?s=` default is GONE, a latent consumer-facing bug in itself); a placeholder-less URL warns at load and ships no block. Pins: 2.
- Auto BreadcrumbList: `breadcrumb: true` builds the trail from the URL tree (root ships none; manual JSON-LD pages stay silent).
- Per-page article JSON-LD: `article.scoped` (same glob semantics) emits typed Article/TechArticle/NewsArticle from the page facts; invalid types warn and ship nothing.
- Site verification metas: `verification` provider map, engine-owned name spellings (`msvalidate.01` for Bing etc.), unknown providers warn.
- hreflang alternates: `locales` glob-to-language map, stem swaps in both directions, x-default from a configured root-document pattern; pages carrying any hreflang stay silent. Documented as a stem-swap calculation, not a file inventory.
- `llms.txt` (`llms: true`): new `engine/llms.js`, reads the same indexable page set sitemap/feed honor, missing-only.
- `freestruct audit --external`: opt-in HEAD-with-GET-retry check of up to 50 unique external hrefs, warn-grade; json digest merges the rows.
- Also fixed in passing: the `--external` work exposed a dispatch subtlety - an async cmdAudit could let a full inject pass execute on an audit invocation; runInject now refuses subcommand args outright.
-  Docs: config guide gains the Discovery Options section (search, breadcrumb, article, verification, locales, llms; llms also filed under the generate options family in spirit), README bullets + audit flags line, CHANGELOG 1.1.0 entry extended (the version is untagged, so the pass rides inside it), battery count mentions 75 -> 86. Counters: battery 75 -> 86 pins.

### Pass 26 - docs staleness sweep + bug/edge/vuln hunt over the new surface (done)

Docs: cli.md audit section (+ --external contract), cicd.md flag list, README/DEPLOY/lander battery counts. All seven lint:docs gates clean.

The hunt found two REAL bugs, both fixed and pinned (battery +3):

- **Noindex-page junk class**: the generated extras (breadcrumb, article JSON-LD, the feed alternate, verification metas, hreflang alternates) landed on noindex pages - the 404 first (it is processed through the full pipeline by issue #11 contract, so the extras grep was a fresh angle), and then the same class on robots-noindex regular pages. Now `injectPage` gates ALL generated extras on `page.is404 || htmlIsNoindex(html)` - the exact exclusion class sitemap/feed/search/llms already honor - while the core injected set (canonical, og, twitter, description) stays contractual on the 404. Pin 1 asserts both the exclusions AND that the regular pages keep the full set.
- **llms.txt line corruption**: a title (or description) carrying an embedded newline split a list entry into two lines, silently corrupting the summary's shape. `oneline()` flattens \r/\n to single spaces; pin 2 asserts the one-entry shape for a newlined title.

The fuzz found the rest clean (all escape/seam contracts held):

- SearchAction target with a quote + tag payload: every `'` -> `\"`, every `<` -> `\u003c`; zero raw tag-opens ship (pin 3). The only first-run miss was the shell grep's `[^}]*` footgun, not the engine.
- verification meta with a quote + tag payload: attribute-escaped correctly (`&quot;` ... `&lt;script&gt;`).
- per-page hostile author into the article block: `\u003c/script>` cannot close the script (the raw `>` inside JSON script text is inert; only `<` opens tags).
- hreflang with overlapping glob patterns ('**' + '/de/**'): no self-referencing or duplicate alternates; x-default only from a distinct root-document pattern.
- audit --external scheme cap (http/https only), fetch targeting (redirects cannot leave http), 8s timeout, 50-URL cap: acceptable by design; warn-grade and opt-in are the posture guards.

### Pass 26.5 - the pack coverage extension (done, same session)

Owner question: "do we need more crashtest attacks to cover it all?" - coverage audit said yes, three wire-truth gaps against the shipped surface. Three new pack attacks + three planted regressions, selftest wired (hardened 8/8 REFUSED, vulnerable 7/7 trip):

- `ldjson-close-canary`: every JSON-LD block in a served head parses and carries no raw `</` in its text - the script-close class (the per-page hostile author is the planted shape) escapes end-to-end to the wire.
- `noindex-extras-leak`: skipped pages (robots-noindex + the 404 body) carry none of the GENERATED extras - keyed on the extras' engine fingerprints (the compact `"@type":"..."` serialization of the generated article/breadcrumb blocks, hreflang, verification metas, the feed alternate). First draft banned bare `application/ld+json` and EXPLOITED the hardened tree: the 404's core Organization/WebSite template blocks are the issue #11 full-pipeline contract, not extras - the pack oracle now encodes that boundary exactly (its engine-shape fingerprint is the lane precedent, per canonical-query-poison).
- `llms-shape-leak`: when the tree generates llms.txt it honors the sitemap page set (noindex never listed) and every entry stays one line (the newline-split class from pass 26 is a trip case).
- Selftest fixture opt-ins: breadcrumb, verification, article.scoped, llms + hostile-payload canary pages. The vulnerable plants: (5) the `\u003c` neutralization drop, (6) extras back onto skipped pages, (7) llms leak + split entry.
- Packs README attack inventory updated (5 -> 8 attacks). Counters: battery unchanged at 89 pins (the pack attacks live at the wire, not in the battery); pack claims in packs/README now truth-aligned.

### Pass 26.7 - the pre-tag manual gate (done, same session)

One more pass before the tag; findings + fixes + pins (battery +2, 89 -> 91):

- Count-truth stragglers: CHANGELOG said `49 -> 75 -> 86` (it is 89) and AGENTS.md still said `39 pins` from an earlier era - both updated to the live number.
- Integration probe (basePath + hreflang + breadcrumb + article + search
  + llms together): all pairings hold - alternates, trail items and the typed block all carry the sub-path prefix; SearchAction intact; all gates green on the combined run.
- Verification dedupe was attribute-ORDER blind (a page-owned `content-first` meta escaped the missing-only gate); now order tolerant, pinned.
- llms `oneline()` additionally strips control bytes (defense in depth - unreachable today, see below).
- Boundary discovery: a control byte in a page fact never reaches llms - the escaped-or-fail XML contract aborts the build LOUDLY at feed generation first (U+0000 names the value class and the field). That order of consumption is now pinned as the contract, not papered over.

### Pass 26.8 - rendered-site audit + release-post plumbing + docs truth sweep (done, same session, post-26.7)

The rendered-site walk found one real bug; the truth walk found six stale spots. Fixes + gates:

- **Release posts shipped as downloads, not pages.** `layout: none` + extensionless permalinks made Jekyll emit two headless fragments that Pages served as `application/octet-stream`; CI's `Found 17 HTML files` proves freestruct never saw them - zero injection, absent from sitemap/feed/llms. Fix per the crashtest family convention: `layout: default` + trailing-slash permalinks (artifact lands as dir/index.html). The temporary `release.html` shim is deleted.
- `docs/discussions/index.md` added - the family release-post index (crashtest's tree is the reference): one file per release, the file IS the announcement, and the trailing-slash rule spelled out. The v1.1.0 row stays tag-pending (fiction-by-promotion is a rule, not advice).
- **Dogfood:** docs config now carries `breadcrumb: true` + `llms: true` (Pagefind owns search here, so no `search` key -> no SearchAction; the empty `basePath:` key was dropped).
- **Docs truth sweep (six stale spots):** the cache-busting FAQ still described the timestamp hash + the retired `cacheBusting.hash: false` switch + "different hash every deploy"; the cache-busting guide debug step; the config reference documented three retired keys as live (`generateNav`, `preserveExistingMeta`, `cacheBusting.hash`) and `searchIndex` as default-on; troubleshooting recommended retired `preserveExistingMeta` and the long-gone `docs/lib/inject.js` path; docs/AGENTS.md's hash snippet predated the deterministic hash. All rewritten to engine truth (battery 91, content-derived, opt-in searchIndex, retired-keys note).
- Post hygiene: the v1.1.0 announcement no longer claims to be on npm before the tag ("this post ships with the tag" phrasing), battery count aligned at 91.
- Gates: battery 91/91, all seven docs-audit gates clean, template sync lockstep, packs selftest teeth (8 attacks held, planted regressions trip), tarball e2e fresh-install proof, config validate.

### Pass 26.9 - breadcrumb gate fix + count-truth alignment (done, same session, post-26.8)

The dogfood pass (26.8) exposed the engine bug live; engine fix + pins (battery 91 -> 93):

- **Gate bug (engine/seo.js):** the article/breadcrumb extras gate carried `config.jsonLd === undefined` - ANY global custom jsonLd in the config silently killed breadcrumb AND article on every page (nothing pinned it; both rendered docs describe skips in terms of a page's own structured data). The docs site itself was bit: `breadcrumb: true` + the maintainer Person block -> no BreadcrumbList anywhere, on wire.
- Restructured: page-owned ld+json suppresses the generated extras (missing-only, as pinned); config-level jsonLd - global list or scoped map - coexists with the trail; article keeps the documented scoped skip via pageReceivesScopedJsonLd (mixed/legacy key shapes read as the global form, mirroring config.js).
- Two pins: breadcrumb coexists with a global config jsonLd (the docs-site shape) while a page-owned ld+json still suppresses it; and article skips a scoped-jsonLd receiver while shipping elsewhere.
- Count-truth stragglers aligned at 93: README trail (`49 -> 75 -> 93`), AGENTS.md house table, the v1.1.0 announcement (91 -> 93).
- Config reference: breadcrumb + article sections now state the coexistence contract and skip classes explicitly.
- Gates: battery 93/93, all seven docs-audit gates clean, template sync lockstep, packs selftest teeth (engine touched), tarball e2e, validate.

### Pass 26.10 - extension-class + linkcheck-route walk (done, same session, post-26.9)

The next hunt class - what the tree walk and the link checker silently drop. Findings + fixes (battery 93 -> 95):

- **Extension-class blind spot (fixed):** `getHtmlFiles` matched a case-sensitive `.html` suffix - `.HTM`, `legacy.htm` (Hugo alt-styles, Windows exports) were invisible to the WHOLE pipeline (find -> inject -> sitemap -> feed -> llms -> linkcheck). Now case-insensitive across scan (walk + slug strip + 404 detect), linkcheck, audit walk + 404 label, and the `basename(page.file, '.html')` fallbacks in search/ xmllike. Pinned: mixed-case and .htm join injection + sitemap with extension-stripped slugs.
- **Linkcheck route shapes (fixed):** the checker only validated literal file targets - extension-less INTERNAL hrefs (the pretty-URL shape real consumer pages carry) silently passed. Now: extension targets checked as files (page extensions), pretty-URL targets resolve through the walker's route model (dir index first, then .html/.htm sibling); asset targets (non-page-extension last segment) stay out of the checker's purview. Pinned: dir index + .htm sibling resolve, real misses report, the stylesheet href stays out.
- Honest non-edges: empty scoped-map shapes (`locales: {}`, `jsonLd: {}`, `article.scoped: {}`, plus `verification: {}`) are no-ops with exit 0 - no crash, no fake artifacts. Hostile filenames (`a&b.html`, `q%2Fmark.html`, `have space.html`) escape correctly in sitemap/feed XML; the audit returns clean on the tree.
- Count truths aligned at 95: README trail, AGENTS house table, CHANGELOG 1.1.0 line, the v1.1.0 announcement.
- Gates: battery 95/95, docs audit, sync lockstep, packs selftest (engine touched), tarball e2e, validate.

### Pass 26.11 - audit duplicate-class + CLI/encoding walk (done, same session, post-26.10)

The encoding + reporting surface. One real gap found and fixed (battery 95 -> 96):

- **Honest boundaries confirmed:** a BOM'd config loads fine (js-yaml eats the byte order mark); `audit some/dir --json` positional-after- flags parses (the earlier exit-0 reading was probe pipe pollution - missing dir is exit 3, findings exit 1, clean exit 0, all as documented).
- **Audit duplicate class (fixed):** the audit asked only "is it present?", never "is it alone?" - a doctored page carrying TWO canonicals + TWO og:title reported only the missing companions. Missing-only injection cannot duplicate, so a duplicate in a baked head is always consumer-caused: duplicate canonical / meta description / og:title and multiple `<title>` now ride the FAIL class (attribute-order tolerant). Pinned: the doctored page names all four and exits 1.
- Count truths aligned at 96: README trail, AGENTS house table, CHANGELOG 1.1.0 line, the v1.1.0 announcement.
- Gates: battery 96/96, docs audit, sync lockstep, packs selftest (engine touched), tarball e2e, validate.

### Pass 26.12 - real-tree audit walk + the tag-anchored missing-only gate (done, same session, post-26.11)

The audit ran against the REAL docs artifact pulled from CI (pages artifact of the green deploy) - 0 failures, 83 warnings, exit 0. The walk found one more engine-class bug and three site polish items:

- **Tag-anchored missing-only gate (fixed):** `hasSeoType` matched on raw substrings, so a page PROSE-quoting 'application/ld+json' silenced the structured-data injection - the config-reference page itself was bit (the page teaching JSON-LD shipped none because its code spans quote the string). All probes now anchor to real markup (`<meta property=og:title>`, `<script type=application/ld+json>`, `<link rel=canonical>`, `<meta name=twitter:card>`). Pinned: a page quoting all four strings in code spans still gets every injected group (battery 96 -> 97).
- **Honest audit verdicts reconfirmed:** missing dir exit 3, findings exit 1 (both re-probed pipe-free), clean exit 0, `--json` digest consistent with the human report.
- **Site polish from the audit's own findings:** home description trimmed 207 -> 158 chars; the two `# content-h1` pages (navigation, post-render-hooks) demoted so the layout h1 stays unique. The `.html` artifact siblings (Jekyll slash-less permalinks) and the ssr-config redirect stub (no h1, WARN-only) are documented shapes, not defects.
- **Count truths aligned at 97:** README trail, AGENTS house table, CHANGELOG 1.1.0 line, announcement.
- Gates: battery 97/97, docs audit, sync lockstep, packs selftest (engine touched), tarball e2e, validate.

### Pass 26.13 - the untouched-paths walk (done, same session, post-26.12)

Every engine corner the recent waves had NOT probed. Three real findings, all fixed (battery 97 -> 99):

- **basePath double-slash (fixed):** a consumer basePath carrying its own trailing slash joined onto lead-slash slugs as `/myproject//` - doubled through canonical, og:url, sitemap, feed, hreflang (`_norm` kept the trailing slash; only `site.url` normalized it). `pageUrlFor` now strips consumer basePath trailing slashes (slug trailing slashes stay - a directory page's slash is canonical). Pinned: slash-y basePath -> single-slash canonical + feed alternate, no doubled junction in the sitemap.
- **outputDir-is-a-file crash (fixed):** all three commands + the audit accepted a FILE at the outputDir path (`existsSync`), then the tree walk crashed with an uncaught ENOTDIR stack. All four check sites now require a directory -> named `Output directory is not a directory` fatal + exit 3 (the documented OUTPUT exit class).
- **Headless-.html run-side diagnostics (fixed):** a tree fragment with no `</head>` took zero head injection (every surface anchors on the head close), silently. `injectPage` now names it on the run (`no </head> found - the whole head-injection surface skips this page`); the page stays indexable missing-only, no guesses. Pinned.
- **Honest boundaries:** zero-byte .html joins the pipeline fine; indexnow without the config key prints named guidance (no crash); empty scoped-map shapes stay no-ops (26.10 recheck).
- **CI consistency:** one workflow still pinned `setup-node@v4` while the rest rode `@v7` (publish.yml - the tag-published leg); aligned.
- Gates: battery 99/99, docs audit, sync lockstep, packs selftest (unsafe-corner engine surface touched), tarball e2e, validate.

### Pass 26.14 - the CI-caught route bug (done, same session, post-26.13)

The push's own `--strict` CI run caught the walk's residual bug (battery 99 -> 100) - the pin wall working as designed:

- **Absolute hrefs resolved against the WRONG root:** `path.join(baseDir, '/guides/cli')` APPENDS rather than resets, so the whole layout menu (root-relative hrefs on nested pages) turned into misses and the strict run flagged every menu link BROKEN. The 26.10 route-shapes pin passed only because its probe pages sat at the ROOT - the nested-page class needed CI to expose it. Resolution rule now: leading-slash hrefs resolve against the OUTPUT ROOT, relative ones stay page-relative. Pinned: a nested page's root link + a scripted chrome string + a data: URI all get the right treatment.
- **Script/style stripping + scheme skip:** inline JS template strings ("href=' + url + '") are not links; data:, javascript: and any scheme-shaped target is not a route. Scanned markdown = document minus script/style payloads.
- Trail aligned at 100: README, AGENTS house table, CHANGELOG, the v1.1.0 announcement.
- Ships the same push as the flowforge rig adoption (next pass).

### Pass 26.15 - the post-rig walk (done, same session, post-26.14)

The walk over everything after the flowforge rig theme adoption; the battery grew 100 -> 102:

- **Flowforge rig adopted (the theme swap itself):** docs/_layouts kept the rig shape (fixed header, slide-out sidebar, pagefind modal, light/dark tokens) with freestruct identity; the rig's baked SEO head is trimmed so canonical/OG/JSON-LD stay the engine's missing-only output. Old partial/SCSS theme retired (-1595 lines), icon.svg added. Ruby 3.4/bigdecimal Gemfile fix rode along so CI's bundle exec holds.
- **Audit twitter grade cools when no handle is configured:** the injector already ships neither twitter:site nor twitter:creator without `config.twitter.username` (seo.js late pass), but the audit warned about the absence anyway - repeat noise for teams without a twitter presence. Those two grades now gate on the same condition; pinned by symmetry only (the docs audit remains 0 twitter rows).
- **Source-tree guard (the real bug of the pass):** a wrong positional (`node bin/freestruct.mjs --strict docs` with `docs/` treated as the output root) made the engine walk the SSG SOURCE tree and stamp build meta into committed template copies, layout HTML and stray pages, in place, silently - recovered here via git restore + npm run sync, and the shape is now refused BEFORE any file is touched: `_layouts/` or `_freestruct/` staging inside the output dir aborts with exit 3 and the fix (point at `docs/_site`) spelled out. Sentinels are the staging dirs ONLY - CI then caught the over-fire (a Jekyll `_site` legitimately carries the copied config file), so config-file markers never gate. Pinned: staging trip, config-carrying built tree still injects, marker-free trees still inject.
- **Live-site re-verification post-swap:** sitemap/robots/feed/llms/404 200s, 19-item feed, breadcrumb JSON-LD on a guide page, 404 noindex, reading-time + last-modified + lazy-load metas, pagefind bundle, and the audit --external probe (30 URLs, only npmjs's bot-wall 403 - a known-crawler shape, not a dead link).
- Trail aligned at 102: README trail, AGENTS house table, CHANGELOG 1.1.0 line + hardening bullet.
- Gates: battery 102/102, docs audit, sync lockstep, validate.

### Pass 26.16 - the typo'd-flag class (done, same session, post-26.15)

The full-surface walk's remaining finding; battery 102 -> 103:

- **Unknown dash-word flags rode as output dirs (fixed):** `freestruct --definitely-not-a-flag` was accepted as a positional override and the full pass ran wherever the default resolved - exit 0, Build hash printed, everything. Dash-shaped args outside the known set now fail with `unknown flag(s) ... - run freestruct --help`, exit 1 (the config-fatal class; subcommands keep their own validation). Pinned: the typo trips loudly, the known-flag path stays green.
- **Version truth verified:** package.json, init/VERSION, README's current-release line, the CHANGELOG heading and the v1.1.0 announcement all agree at 1.1.0 (battery pin + manual grep).
- **Upstream report:** the 26.15/26.16 quiet-mistake classes filed as dhaupin/prestruct#54 (source-tree poisoning + flag-as-positional, with the fix shapes and pin pointers).
- Trail aligned at 103: AGENTS house table, README trail, CHANGELOG 1.1.0 line; the announcement's quality layer updated (103 pins + the two closed classes).
- Gates: battery 103/103, docs audit, sync lockstep, packs selftest, tarball e2e.

### Pass 26.17 - the family-sweep queue (done, same session, post-26.16)

The open queue's real bugs and gate work, worked top-down; battery 103 -> 121:

- **linkcheck ignored basePath (fixed, #32):** the highest-value family bug. `engine/linkcheck.js` resolved root-absolute hrefs against the output ROOT with no `basePath` awareness, so a Jekyll `baseurl`'d site (gistory/eyestruct shape) failed `--strict` with a BROKEN row for every nav link - the same bug class urls.js solved for canonical/sitemap, on the link-check surface. `checkLinks` now takes `basePath`, strips the EXACT configured prefix from a root-absolute target before resolving (`inject.js` threads `config.basePath` through), and leaves an href carrying a DIFFERENT prefix resolving (correctly) as broken. Reproduced offline first (2 broken links on a `/myrepo` site), then pinned both ways: a prefixed nav resolves and `--strict` passes; a foreign prefix stays broken.
- **config-gated audit noise (fixed, #28):** `og:image`/`twitter:image` absences are config-shaped, not page-shaped - they printed once per page (80 lines at 40 pages). They now collect into one line each at run end with an affected-page count (`WARN config: og:image not configured - N page(s) affected`); page-shaped classes (title/description length, JSON-LD absence, h1 sanity, partial-set coherence) still repeat. Pinned: one config row, correct count, no per-page rows, digest carries it. Edge (self-review catch): with `og.scoped`/`ogImageGeneration` the config DOES supply an image, just not for every page - the line then reads "og:image absent on N page(s)" instead of the false "not configured" (pinned both states).
- **release gate composed (fixed, #37):** `"check": "npm test && npm run lint:docs && npm run packs:selftest"` + `"prepublishOnly": "npm run check"`, mirroring the eyestruct precedent; `publish.yml` runs the composed gate explicitly (the publish step re-triggers it), keeping the heavyweight `e2e` leg as the CI-side gate. To keep a local publish from needing a github-tarball install, `packs:selftest` now degrades to a NAMED skip (exit 0) when no crashtest checkout is present and looks for a repo-relative `node_modules/crashtest` too - while `CRASHTEST_BIN` set-but-missing stays loud (exit 2). CI always installs crashtest, so the teeth still run there; pinned both shapes.
- **straggler pin (fixed, #29):** `docs.yml` pagefind cache moved `actions/cache@v4` -> `@v6`, matching every other cache step.
- **table guard (fixed, #35):** the engine gains a `tableWrap` late pass (default-on) that wraps every outermost `<table>` in a `.fs-table-wrap` scroll container with the overflow properties inline, so a wide docs table scrolls inside its own box instead of pinning the whole page to the table's min-content width (the live phone capture: a wide table clipped the H1 and the brand nav). Depth-aware (nested tables wrap once), idempotent (a table already inside a `.table-wrap`-style div is skipped, so runs never stack), and a no-op on table-less pages (no rewrite, no build-hash flip). `tableWrap: false` opts out. Pinned: wrapper shape + inline style, the delimited-segment skip (class `printable` does not count), nested-once, idempotency, and the opt-out.
- **init kit identity seed (fixed, #33):** the starter config scaffolded `site:` only, so ports that copied the kit shipped with no founder or maintainer JSON-LD until someone hand-added the blocks (every identity leg filed family-side was the same rediscovery). The starter now seeds the family identity: the Creadev.org founder `author` block plus a maintainer Person `jsonLd` entry (placeholder handle + jobTitle). Pinned by running the kit config verbatim through the battery: schema-clean (no unknown-key warn), founder Person present, maintainer name/jobTitle present.
- **local docs preview recipe (fixed, #36):** the docs Jekyll stack ran only in CI, so docs tokens were verified by live curl after push and every strict iteration waited on the Pages build. The rootless recipe (prebuilt ruby-builder toolchain under `$HOME`, shimmed binstubs, `LD_LIBRARY_PATH` + `RUBYLIB` for the moved prefix, scratch-copy build, strict run, local server) is recorded in DEPLOY.md, with `.gitignore` belt-and-suspenders (`docs/.bundle/`, `docs/vendor/`, `docs/.jekyll-cache/`; `Gemfile.lock` stays tracked). Receipts: `labs/receipts/docs-preview-{dark,light}.png` (verified end to end on Debian 13: bundle 35 gems, jekyll build, freestruct strict "All links OK").
- **prose flows, the hard-wrap habit retired (fixed, #39):** `scripts/unwrap-prose.cjs` (copied from eyestruct@3adda1d, two bugs fixed against this repo) joins hard-wrapped paragraphs and list items without touching frontmatter, fences, tables, headings, or blank-line boundaries. Two fixes the copied file needed here: frontmatter opens ONLY at line 1 (labs/TASKS.md carries a bare `---` rule at line 7 that the original read as an open fence, silently disabling the whole document), and a list marker counts even when indented (the original flattened nested bullets into their parent paragraph). Applied across the living surfaces - the three discussions posts + index, README, AGENTS, CHANGELOG, labs/TASKS, labs/prd - so prose flows and future agents do not reinstate the 72-column habit. Battery pin added (111 -> 112) covering join, nested-list preservation, fence/frontmatter safety, and the later-rule regression.
- **phone publish lane adopted (fixed, #38):** `scripts/ship-from-download.cjs` (copied as-is from eyestruct@9744c76; it has zero repo imports, so the copy is the whole integration) stages a GitHub-zip-extracted tree into the Termux home, runs `npm ci`/`npm install`, then `npm publish` with the repo's own `prepublishOnly` gate riding unchanged. The token rides `NPM_TOKEN` (`NPM_SHIP_TOKEN` fallback) or `--token-file`, expands from env into a staged one-line `.npmrc` that is unlinked in a finally - never in argv, on disk, or in the log - and `--clean` removes only the staged root on every exit. Five behavior pins (battery 112 -> 117) drive it through the runner seam (no npm, no network): token provenance, the `.npmrc` placeholder shape, named refusals (exit 2, nothing staged), `--clean` scope + retry closure, and the export names. The init-kit rider (seeding the lane into new ports) is left for a separate call.
- **docs highlighting (fixed, #30):** the layout's rouge token block covered only six token families, so bash/js fences rendered half-painted. The block now spans the full common vocabulary; the fence-language half was already satisfied (all 121 fences tagged). Now battery-pinned: the token block must style the common families (nb/nf/nv/s*/c*/k*/nt/gp), so a future layout edit cannot quietly re-monochrome the fences.
- **straggler pin (fixed, #29) and the cache-major guard:** `docs.yml`'s pagefind cache moved `actions/cache@v4` -> `@v6` in the earlier sweep; the battery now holds it (every `actions/cache` step across `.github/workflows/*.yml` rides ONE major, v6+), so the drift that filed #29 cannot return.
- **playbooks leg (fixed, #34):** the docs carried guides (concepts) and discussions (release posts) but no runbook layer - the family-scaffold shape eyestruct uses for "the commands an agent runs." New `docs/playbooks/` leg: an index table plus eight recipes (first run, link triage, baked-output audit, config validation, release gate, phone publish, docs preview, pin bump), each a single-file page with a `/playbooks/` permalink and a `.playbook-next` footer. Nav section + layout style added. Battery pin (117 -> 118) holds the shape: index present, every recipe carries title/description/permalink, every permalink has an index row, and the nav lists the leg.
- **reusable docs lane (fixed, #31):** the Pages runbook was a per-repo one-off; the rig has already hand-copied it three-plus times and the copies drifted on exactly the axes that matter (ruby, pagefind, freestruct source). Promoted to `.github/workflows/docs-lane.yml` - `on: workflow_call` with eight inputs (`docs-path`, `output-dir`, `ruby-version`, `node-version`, `pagefind-version`, `crashtest-ref`, `freestruct-cmd`, `strict`), defaults matching this repo so freestruct dogfoods it with no inputs. `docs.yml` is now a thin caller (`uses: ./.../docs-lane.yml`, no steps) - the push path is the same run. Both receipts survive: pagefind cached in BOTH scopes, every install pinned. Battery pin (120 -> 121) holds the lane is workflow_call, all eight inputs exist, both pagefind scopes cache, the installs stay pinned, and the caller carries no inlined steps. Cross-repo note filed against flowforge#9 (the family asks for a reusable lane; this is freestruct's canonical one).
- Trail aligned at 121: README trail + config table, AGENTS house table, CHANGELOG 1.1.0 line, the announcement's quality layer, DEPLOY's battery line + prepublish note, the CLI guide's audit section (the collapse rule), and the config guide's `tableWrap` section.
- Gates: battery 121/121, docs audit, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e.

### Pass 26.18 - the post-queue engine sweep (done, same session, post-26.17)

The issue queue is fully closed (#1-#40), so this pass hunted the engine corners the queue-era waves never probed. Nine real fixes landed, each with a red-checked pin (battery 121 -> 130):

- **Rerun snippet stacking + build-hash churn (fixed):** `inject-body-start.html` and `inject-footer.html` were appended raw on every pass with no marker, so a rerun stacked a second copy and - because the body text then differed - churned the content-derived `freestruct-build` hash every run (defeating the deterministic-hash contract). Both snippets are now wrapped in `<!-- freestruct:snippet -->` markers, `stripInjectedRegions()` drops the previous copy at the top of `injectPage`, and `computeBuildHash`'s `stable()` strips the same region so run 1 = run 2 = run 3. Pinned: one copy each of body/footer/head after three runs + a stable hash.
- **`minifyHtml` clobbered verbatim blocks (fixed):** the old scanner only recognized BARE `<pre>`/`<script>`/`<style>`/`<textarea>` open tags, so `<pre class="highlight">` was not a block - its indentation collapsed and inline JS with a `//` comment flattened onto one line (commenting out the rest of the script). Rewritten as a verbatim-block-aware pass: block CONTENT (attribute forms included) survives byte-for-byte, whitespace outside blocks still collapses. Pinned: `pre class="..."` content preserved, inline-script newlines preserved, inter-tag whitespace removed.
- **Cache-bust substring match (fixed):** `assetExts.includes(ext)` was a SUBSTRING test, so `/x.cs` (`.cs` is inside `.css`), `/x.tt` (`.ttf`) and `/x.j` (`.js`) all got a bogus `?v=`, while a genuine `/img.PNG` was missed (case-sensitive). Now a case-insensitive extension SET. Pinned both ways.
- **Single-quoted hrefs invisible to linkcheck (fixed):** the checker's regex only matched `href="..."`, so a single-quoted broken link (`href='/gone/'`, valid HTML) sailed through `--strict`. Now both quote styles (backreference). Pinned: single- and double-quoted breaks both reported, `--strict` fails, a resolvable single-quoted link stays clean.
- **Purge hooks missing the documented env (fixed):** README and the hooks guide both promise `FREESTRUCT_SITE_URL` / `FREESTRUCT_BUILD_HASH` / `FREESTRUCT_OUTPUT_DIR` on hook children, but `runPurgeHooks` called `execSync` without `env` (only `hooks.postBuild` passed it). Now both pass `hookEnv(...)`. Pinned: the three vars reach a purge child.
- **`addLazyLoading` mangled self-closing images (fixed):** the append used `/>$/`, so `<img ... />` became `<img ... / loading="lazy">` (malformed). The attribute now lands before the close. Pinned: `<img/>` and `<img />` both repaired to `<img ... loading="lazy">`.
- **Audit `grabMeta` false FAIL (fixed):** the regex used `<meta[^>]` - exactly ONE character before the keyed attribute - so `<meta charset="utf-8" name="description" ...>` (valid) was a false `FAIL missing meta description`. Now `<meta\b[^>]*\b...`. Pinned: a leading-attribute description meta audits clean.
- **Audit `urlToDisk` basePath normalization (fixed, mirrors #32):** a `basePath` without its leading slash (`myproject`) was not stripped from the og:image on-disk resolve, so a present image false-warned as missing. Normalized like `urls.js`. Pinned.
- **`-h` rode as an output dir (fixed):** `-h` was listed in `KNOWN_DEFAULT_DASHES` (so it passed the unknown-flag guard) but never handled, so it became the positional output dir and the run died with "Output directory not found: .../-h". `-h` now aliases `--help`. Pinned: `-h` exits 0 with help; a real typo'd flag still fails.
- **Version bump to 1.2.0 (owner call):** the sweep ships as its own release, not folded into the untagged 1.1.0. Flipped everywhere in the same ritual as the 1.1.0 sweep: package.json + package-lock, `init/VERSION`, README (current-release line + a new `## v1.2.0` section above `## v1.1.0`), CHANGELOG new top entry, the battery pin (test name + message), AGENTS pin wording, DEPLOY (both pin lines), CONTRIBUTING pin wording, `release.yml` tag example, `docs/freestruct.config.yml` comment, and this reminder line. New `docs/discussions/announcing-freestruct-v1.2.0.md` (tag-pending, per the fiction-by-promotion rule), a row in the discussions index, and a nav entry; the stale v1.1.0 "tag pending" row corrected to "2026-10-25 on npm" (the tag landed and npm has it).
- **`unwrap-prose.cjs` corrupted indented code and HTML blocks (fixed):** running the unwrap tool across the docs to kill the remaining 72-column wraps exposed a real tool bug - a 4-space INDENTED code block (`packs/README.md`'s `packs/public/... -> ...` layout example) and a multi-line HTML block (`<div class="playbook-next">` footers) were both treated as prose, so their lines got joined onto one. The tool now treats a 4+ space line (not a list marker/table row) and a `<`-starting block (to the next blank line) as verbatim. Pinned in the #39 unwrap test: indented code and an HTML block both survive unjoined.
- **Version-truth census (fixed, #41):** package.json is THE single version source; a living surface that hand-copies the current version is a hand-synced second truth, and hand-sync dies quietly (the release-day stale-README catch is the one-mortem). New battery leg derives the version from package.json and refuses every living surface that drifted - README current-release line, the AGENTS/CONTRIBUTING/DEPLOY pin lines, the `labs/TASKS.md` reminder, the `release.yml` tag example, and the `init/VERSION` stamp (freestruct's side truth; it ships no second package.json). Range pins (`^1.0.0`), dated era rows (CHANGELOG sections, the release posts, dated pass-log entries) and other packages' versions stay out of scope by design. A broken claim regex fails loudly instead of degrading to a green pass. Red-checked: a stale README line fails the leg.
- **CHANGELOG scope correction:** everything landed since the v1.1.0 tag (the family sweep + docs/tooling wave: basePath linkcheck, the composed release gate, the audit collapse, init-kit identity, the playbooks leg, the reusable docs lane, the table guard, the phone-publish lane, prose unwrap, the rouge vocabulary, cache-major pinning) moved out of the frozen [1.1.0] section and into [1.2.0] - [1.1.0] now matches its tagged content exactly (battery 49 -> 103), and README's `## v1.1.0` section was trimmed to the same frozen scope.
- Trail aligned at 132: README trail + config table, AGENTS house table, DEPLOY battery line, CHANGELOG 1.2.0 entry, the v1.2.0 announcement.
- Gates: battery 132/132, docs audit, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, validate.

### Pass 26.19 - the docs-truth + count-census pass (done, same session, post-26.18)

Two streams: retire the fiction the docs still carried, and answer eyestruct#43's heads-up with the count-census rule it asked freestruct to inherit. Battery 132 -> 133.

- **Count census (fixed, eyestruct#43 rule 2):** the issue asked freestruct to inherit the family's "counts on audited pages must be derived from source, never hand-copied" rule. New battery leg (`count census: living count claims are derived from source`) derives the homepage battery size from `test/run.js`'s own `test(` count and the AGENTS/CONTRIBUTING engine module count from the `engine/*.js` file count, then refuses any drift. Word-form counts (`thirteen`) are parsed too. Historical prose ("grew 49 -> 75 -> 103 pins") never matches because the claim regexes are anchored to the fact sentence; a broken claim regex fails loudly instead of going green. Red-checked: the homepage's stale `132-test` failed the leg before the fix.
- **Stale engine module count (fixed):** `AGENTS.md` and `CONTRIBUTING.md` both said "eight modules" - true at 1.0.0, wrong since (the engine is now 14 JS files = `inject.js` + 13 modules). Both moved to "thirteen", now held by the count census. README's v1.0.0-era line said "eight modules" too; corrected to "nine" (the v1.0.0 tag shipped nine lib modules, verified against `git ls-tree v1.0.0 engine/`).
- **Cache-busting FAQ fiction (fixed):** the page claimed canonical URLs carry `?v=` by default ("the HTML is different, CDNs must re-fetch, browser cache is bypassed via query params") and "every commit automatically busts caches, no manual purge needed". The default buster is asset `?v=` query params; canonical `?v=` is opt-in via `cacheBusting.hashInCanonicalUrl: true`. Both claims reframed honestly (content-derived hash + asset URLs; aggressive edge caches still want a purge).
- **Homepage cache claim (fixed):** the lander said "every asset URL carries a fresh per-build hash, so CDNs always serve the latest version". The hash is content-derived (identical content = identical hash by design), so the card now says a URL/content-keyed CDN refetches when assets change, and edge caches that ignore both still want a purge hook.
- **Navigation guide fiction (fixed):** it cited a `header.html` include that does not exist (`docs/_includes/` is absent) and a top nav that does not exist. Corrected to the single `default.html` layout rendering `site.data.nav` into the sidebar; frontmatter description updated to match. Walk-back found the same phantom `_includes/header.html` cited in `docs/_data/nav.yml` (the shape comment) and `docs/AGENTS.md` (the search "why this pattern" bullet) plus a stale "its includes live under `_includes/`" line in `docs/contributing/style.md` - all three corrected to name `default.html` as the single self-contained frame.
- **CLI guide gap (fixed):** the help section and flag table omitted the `-h` alias (added in the 1.2.0 sweep) - both now document it.
- **`validate` gate correction:** the recorded gate battery names `validate`, but the repo has no such npm script (the side command is `npx freestruct validate`, and `npm run check` is the composed gate). Noted here so the next pass stops chasing it; the real local gate set is `test`, `lint:docs`, `sync:check`, `packs:selftest` (CI-only teeth), `e2e`, plus `npm run build` (Jekyll + inject).
- **Trail aligned at 133:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the v1.2.0 announcement's quality layer, and the homepage count.
- Gates: battery 133/133, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject, 32 HTML files, "All links OK").
- Next pass: cut the v1.2.0 tag (owner-gated), then continue the count-census rollout to any other living surface that names a derived number.


### Pass 26.20 - the staging pass: two engine-audit bugs + the h1 dogfood gate (done, same session, post-26.19)

Owner merged PR #42, then asked for branch hygiene (nothing on other branches needed in main; all stale branches deleted; a new `staging` working branch), then a fresh look at what to add or fix. The issue queue is fully closed (#1-#43), so this pass audited the repo's own baked docs output (`freestruct audit docs/_site`) and found two real engine bugs plus a docs regression the audit had been silently tolerating. Battery 133 -> 134.

- **Audit `grabMeta`/`grabCanonical` truncated a quoted attribute at the OTHER quote kind (fixed):** the value regex `["']([^"']*)["']` stopped at the first `'` OR `"`, so any value holding the other quote was cut short - `docs/playbooks/docs-preview`'s description ("...this repo's Jekyll docs...") measured 25 chars instead of 120, and the audit false-warned `description 25 chars (outside 70-165)`. New `attrValue()` helper reads to the MATCHING quote via a backreference (`(["'])([\s\S]*?)\1`) with an unquoted fallback. Pinned: an apostrophe-bearing description audits with no length warning. This is the same class as the earlier leading-attribute bug (Pass 26.18) - the audit's quote handling was naive in two directions.
- **Seven docs pages shipped with NO h1 (fixed, regression):** the flowforge rig adoption (`4e1facc`, "docs(core): adopt the flowforge rig layout") rewrote `_layouts/page.html` into a passthrough and dropped the `<h1>{{ page.title }}</h1>` header the old page layout rendered. That is fine for pages whose markdown body opens with `# `, but seven pages open with `##` or prose - `configuration.md`, `contributing/issues.md`, `getting-started.md`, `guides/cache-busting.md`, `guides/cache-busting-faq.md`, `guides/cicd.md`, `guides/freestruct-config.md` - so each baked page carried zero `<h1>` elements. Each gained a real top-level `# ` heading (matching its frontmatter title). The `docs/contributing/style.md` note ("Index needs h1 from frontmatter title or content") was stale - corrected to state the layout is a passthrough and the page's own `# ` is the only h1.
- **New docs-audit rule: exactly one h1 per living page (added):** folded into the `style` gate (frontmatter-aware, fence-aware; README exempt as it is not a rendered page). The rule fails a page with zero or more-than-one h1, so the rig-adoption regression cannot recur. Red-checked: demoting a page's `#` to `##` fails the gate with `no h1`.
- **Dogfood audit driven to clean:** the same audit also flagged 11 pages whose frontmatter descriptions fell outside the SEO 70-165 band. Each description was expanded to be accurate and in-band (the FAQ's apparent 56-char shortfall was the apostrophe bug above, not a real gap). After the fixes the baked-tree audit is `0 failures, 2 warnings` - both remaining are the deliberate `guides/ssr-config` redirect stub (noindex, no h1, short description), a documented shape.
- **Trail aligned at 134:** README trail + v1.2.0 section (two new bullets), CHANGELOG 1.2.0 entry (two new bullets + the h1-gate bullet), the v1.2.0 announcement's quality layer, and the derived count surfaces (AGENTS/CONTRIBUTING/DEPLOY/homepage) via the count census.
- Gates: battery 134/134, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject, 32 HTML files, "All links OK") + `freestruct audit docs/_site` (0 failures, 2 stub-only warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet), and consider whether the `ssr-config` redirect stub should be excluded from the audit's h1/description classes (it is a non-content stub, so the two standing warnings are cosmetic).

### Pass 26.21 - the repo-wide gap walk: five engine fixes (done, same session, post-26.20)

Owner asked for "another walk looking for gaps, edges, bugs, fiction, vulns across the entire repo." The queue is closed (#1-#43) and the audit is clean, so this pass re-read every engine module, script, workflow, template, and pack against the house contracts and probed each suspect empirically with scratch harnesses before touching code. Six real bugs surfaced, each fixed with a red-checked battery pin. Battery 134 -> 140.

- **Entity double-encoding in the feed (fixed):** `generateFeed` read the raw `<title>`/`<meta name="description">` match and passed it to `assertXmlSafe`, which escapes `&`. An SSG that entity-encodes its own output (Hugo, Jekyll with smart escaping) hands freestruct `&amp;`, so the feed re-escaped it into `&amp;amp;` - a reader sees the literal `&amp;`. Latent on THIS site (Jekyll emits a raw `&`), but a whole class of consumers gets a corrupted feed. Same root cause hit `search.json` (raw `&amp;` in JSON renders literally) and `llms.txt`. Fix: a shared `decodeEntities()` in `scan.js`; the feed now decodes then escapes once, search.json/llms carry plain text. Pinned: `&amp;` in a source title yields `&amp;` (not `&amp;amp;`) in the feed and a plain `&` in search.json.
- **Meta extraction missed a reordered or single-quoted meta (fixed):** `extractTitle`/`extractDescription` matched one literal shape (`name="title" content="..."`, double quotes, fixed order), so `<meta content='...' name='description'>` (valid) was not seen and the page silently fell back to the SITE description - a wrong og:description/twitter:description on every such page. Now attribute-order and quote tolerant via a shared `attrValue()` (the same backreference reader `audit.js` gained in 26.20). Pinned: a reordered single-quoted description is read and the site default does not leak into the page's og:description.
- **`minifyHtml` fused words across a line break (fixed):** the whitespace pass did `[ \t]*\n[ \t]* -> ''`, so `<p>Hello\nworld</p>` became `<p>Helloworld</p>` - silent text corruption on any `minify: true` site. A break inside text is a separator; it now collapses to a single space, and the `>\s+<` rule still removes the ones between tags. Pinned: wrapped paragraph text keeps its spaces, never `Helloworld`.
- **Cache-busting skipped single-quoted assets (fixed):** the rewrite matched `href="..."`/`src="..."` double-quote only, so a valid single-quoted `/css/site.css` never got its `?v=` and could go stale at the edge after a content change. Both quote styles now rewrite (preserving the quote), the same both-quote posture the link checker got in the 1.2.0 sweep. Pinned: single-quoted css/js/png all get `?v=`.
- **Audit on-disk check could resolve outside the output tree (fixed, hardening):** `urlToDisk` joined the output dir with the raw path, so a site-local `og:image` (or JSON-LD `logo`/`image`) shaped like `/../../../../etc/hostname` resolved off-tree and `existsSync` read back any host file as "present" - a false pass AND an off-tree probe. Refactored to `sitePathInfo()` returning `{ resolved, inside }`; an escaping path is now named (`which escapes the output directory`) instead of probed. Pinned: an out-of-tree og:image is reported as escaping.
- **Audit graded noindex stubs as if they should rank (fixed):** the per-page content-quality classes (description length band, h1 shape, JSON-LD absence) ran on EVERY non-404 page, including a `robots noindex` redirect stub whose whole point is to stay out of the index. The repo's own `guides/ssr-config` stub therefore carried two standing cosmetic warnings forever, and any consumer's stub/thank-you page got the same noise. A noindex page is now exempt from those three classes (the structural classes - title/canonical presence, duplicates, absolute canonical - still apply). The dogfood audit is now `0 failures, 0 warnings` for the first time. Pinned: a noindex stub is quiet on all three, and the SAME shape without noindex is graded (control).
- **Walk coverage (checked, no bug):** `slugMatchesGlob`/`globSpecificity` edge cases, `linkcheck` traversal handling (reports broken, never reads off-tree), `addLazyLoading` on `data-x="loading"` / `loading`-substring filenames (no false positives), the `--strict` ladder, the `ssr-config` redirect stub shape, dead code (`urlToDisk` now removed; `KEYFILE_HIDDEN`, `slugForHomePage` live), and `new RegExp`-from-data in the extractors (constant attribute names, no injection). (Correction, Pass 26.25: this row originally claimed `generate404` with quote/amp-bearing site names was "escaped" - it was NOT; the probe was not actually run then. It is escaped now.)
- **Trail aligned at 140:** README trail + v1.2.0 section (four new bullets), CHANGELOG 1.2.0 entry (four new bullets), and the derived count surfaces (AGENTS/CONTRIBUTING/DEPLOY/homepage) via the count census.
- Gates: battery 140/140, docs audit (7 gates clean), sync lockstep, packs selftest (teeth proven with a real crashtest checkout: 8 attacks, all REFUSED, every planted regression trips), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings - the noindex exemption cleared the two standing stub warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.22 - the second repo-wide walk: four engine fixes (done, same session, post-26.21)

Owner asked to push the 26.21 walk and "do another pass/walk." Same posture: re-read every engine module and script against the house contracts, probe each suspect with a scratch harness before touching code. Four more real bugs surfaced, each fixed with a red-checked battery pin. Battery 140 -> 144.

- **Internal-link checker treated a query string as part of the route (fixed):** `checkLinks` stripped the fragment (`#...`) but not the query, so `href="/guide?utm_source=x"` resolved against a path literally named `guide?utm_source=x` and was reported broken. Any site whose nav carries a query param (a utm-tagged or search-fed link) therefore failed `--strict`. The query is stripped before resolution (`target.slice(0, target.indexOf('?'))`); a genuinely missing target is still reported, with its query intact in the message. Pinned: three valid query-bearing links are not flagged, a real miss is, and `--strict` fails on the real break only.
- **Cache busting missed assets that already carried a query or fragment (fixed):** the extension was computed from the RAW value, so `style.css?foo=bar` yielded `'.css?foo=bar'` and `legacy.css#iefix` yielded `'.css#iefix'` - neither matched the asset set, so the asset was never busted and could go stale at the edge after a content change. The extension is now read off the PATH (fragment and query split off first); the injected `v=` joins any existing query with `&`, a previous freestruct `v=` is dropped, and the fragment is preserved. `computeBuildHash`'s stable view strips `[?&]v=` now (was `?v=` only) so reruns stay content-derived. Pinned: query/fragment assets get a single correctly-placed `v=`.
- **Cache busting rewrote asset links SHOWN in a docs page (fixed):** a `<pre><code>&lt;link href="/style.css"&gt;</code></pre>` example is markup-in-prose, not a live asset reference, but the global href/src rewrite busted it anyway - turning the example into fiction on any docs page that teaches a link shape (this repo's own docs are exactly that). Any `href=`/`src=` literal inside a `<script>` body hit the same class. Protected regions (`<pre>`/`<code>`/`<textarea>`/`<style>` blocks and script BODIES, with a live `<script src>` opening tag still busted) are now masked during the pass and restored, the same payload-stripping doctrine `linkcheck` owns. Pinned: examples survive, live attributes bust, and a rerun stays idempotent.
- **A disabled purge-hook config reported only its first hook (fixed):** the `runHooks: false` branch `return`ed INSIDE the loop, so a multi-hook config printed one `Purge hook X: running...` line and silently hid the rest - the operator could not see what a later `runHooks: true` would execute. `runPostBuildHooks` carried the identical `return` shape, hiding every `hooks.postBuild` entry after the first. Both loops `continue` now, reporting every configured entry. Pinned: three configured purge hooks all print when disabled.
- **Walk coverage (checked, no bug):** `pageUrlFor`/`slugMatchesGlob`/`globSpecificity` edge cases (basePath slash forms, directory vs file slugs, `*` vs `**`, specificity ordering), `addLazyLoading` on self-closing/attribute-order/spaced img shapes, the minifier's protected-block handling, `ogimage` shape validation, `indexnow` key resolution/validation, `config.js` diagnostics for every scoped shape, the bin shim, and the pack's eight attacks.
- **Trail aligned at 144:** README trail + v1.2.0 section (four new bullets), CHANGELOG 1.2.0 entry (four new bullets), and the derived count surfaces (AGENTS/CONTRIBUTING/DEPLOY/homepage) via the count census.
- Gates: battery 144/144, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.23 - the third probe: table-wrap hash churn (done, same session, post-26.22)

Continuing the same walk into the late passes, a rerun-idempotency probe over the real bin (not the unit seams) surfaced a fifth bug:

- **The default-on `tableWrap` pass churned the content-derived build hash (fixed):** `addTableWrap` runs in the LATE pass block, after `computeBuildHash` has already hashed the page snapshot. Run 1 therefore hashes the bare `<table>`; run 2 scans the page with the `fs-table-wrap` div run 1 wrote, so the stable view differs and the hash flips - on a completely unchanged site. Because the hash drives every asset `?v=` and the canonical bust param, every rerun busted the CDN cache for a table-bearing site, the exact churn the timestamp-free hash exists to prevent. `computeBuildHash`'s stable view now strips the tool-owned `<div class="fs-table-wrap" ...>...</div>` wrapper before hashing (nested tables verified stable too). Pinned: a table page's hash holds across reruns and the wrapper stays single. (The docs site itself carries tables, but `minify` is off there and the docs rebuild regenerates the tree, so it never showed at the dogfood.)
- **Walk coverage (checked, no bug):** rerun idempotency under `minify: true` (stable after the first pass, as designed - minify is lossy, off by default), nested-table wrapping, the reading-time/last-modified late passes (their metas are stripped by the stable view), and `generate404` under rerun.
- **Trail aligned at 145:** README trail + v1.2.0 section (one new bullet), CHANGELOG 1.2.0 entry (one new bullet), the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 145/145, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.24 - the search-index text pass (done, same session, post-26.23)

The same walk turned to `search.js`, the one opt-in artifact whose whole payload is page text:

- **`search.json` shipped raw markup into the index (fixed):** the content pass stripped tags with `replace(/<[^>]+>/g, ' ')` only, so an inline `<script>` body (JS source) and a `<style>` body (CSS rules) flowed into the indexed text - not page content, and a token leak into a consumer-visible JSON that any front-end search UI would surface. The heading pass was worse: it returned the h1's inner HTML verbatim, so a heading with inline markup (`<h1>Title <em>x</em></h1>`) landed in the index with its `<em>`/`<code>` tags intact (rendered as literal text or stripped unpredictably downstream). A shared `readableText` helper drops script/style bodies and comments, strips every tag, and decodes entities; both `content` and `heading` route through it. Pinned: a page with an inline script/style and a marked-up h1 indexes only its visible prose and a tag-free heading.
- **Walk coverage (checked, no bug):** `llms.js` (titles/descriptions come from the entity-decoded extractors and `oneline` flattens newlines - no markup can reach it), the feed body (title/description only), the sitemap (urls + lastmod), and `decodeEntities` coverage of named/numeric/apostrophe forms.
- **Trail aligned at 146:** README trail + v1.2.0 section (one new bullet), CHANGELOG 1.2.0 entry (one new bullet), the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 146/146, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.25 - the 404 template probe (done, same session, post-26.24)

The walk then probed the generated 404 template's interpolation:

- **The generated `404.html` interpolated the raw site name unescaped (fixed):** `generate404` dropped `config.site.name` straight into the `<title>` and body text, and `pageUrlFor(config, '/')` into the search form's `action` and the Home `href`. A name carrying `"` broke the title attribute; a name carrying `<script>` shipped live markup into the error page - an XSS surface for any consumer whose `site.name` came from untrusted config (a CMS field, an env-derived value). Both now ride the shared `escAttr` escaper, the same one every `inject-brand` placeholder already uses. `escAttr` was module-private; it is exported now. Pinned: a `<script>`-bearing site name is escaped, never live.
- **Correction to Pass 26.21:** that pass's "walk coverage" row claimed `generate404` with quote/amp-bearing site names was "checked, escaped" - the probe was not actually run, and the claim was false. The row is annotated in place (the house rule is honesty over promises; a stale "checked, no bug" line is the same sin as a doc that promises what the code does not do).
- **Walk coverage (checked, no bug):** `xmllike.js` control-char loud-fail path (`assertXmlSafe` throws on U+0000-U+001F minus tab/newline), the sitemap/robots/feed escaping, the custom-404 pipeline (`stripRobotsMeta` single-owner), and `pipeline404`'s noindex insertion.
- **Trail aligned at 147:** README trail + v1.2.0 section (one new bullet), CHANGELOG 1.2.0 entry (one new bullet), the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 147/147, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.26 - the prose-count probe (done, same session, post-26.25)

The search-index fix exposed the same root shape one module over:

- **The `reading-time` meta counted script/style/comment text as prose (fixed):** `addReadingTime` stripped tags with `replace(/<[^>]+>/g, ' ')` only, so a page carrying a 600-word inline `<script>` (or a large `<style>` block, or a long HTML comment) reported an inflated estimate - a five-word page read as "4 min read". The docs site's own pages carry inline bundles and styles, so the advertised number was fiction there too. The fix consolidated the text view: `scan.js` now exports `htmlToText` (drop script/style bodies and comments, strip tags, collapse whitespace, decode entities) and BOTH the search index and the reading-time estimator read through it - one definition, one behavior, so the two can never drift apart again. Pinned: a page with a 600-word inline script/style/comment still reads "1 min read".
- **Walk coverage (checked, no bug):** `addLastModified` (single meta, refreshed), `addLazyLoading` interaction with the reading-time pass ordering, `escJson` (JSON-string + `<` neutralized), and the `searchActionJson` seam (only ships with `{search_term_string}`).
- **Trail aligned at 148:** README trail + v1.2.0 section (one new bullet), CHANGELOG 1.2.0 entry (one new bullet), the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 148/148, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.27 - the indexnow round-trip probe (done, same session, post-26.26)

The entity path had one more consumer the earlier passes never traced:

- **`indexnow` posted XML-escaped URLs (fixed):** `readSitemapUrls` pulled `<loc>` values straight from the baked sitemap, where `xmllike.js` has escaped `&` to `&amp;` (the issue #9 correctness fix). Submission then POSTed the escaped string verbatim, so a URL containing an ampersand (a common case - query-string paths, `&`-bearing slugs) was sent to Bing/Seznam/Yandex as `.../a&amp;b`, a URL that does not resolve - the engines would index nothing or error. The values now decode back to the real URL (`decodeEntities` from `scan.js`, the same helper the feed/search already share) before submission. Pinned: an `&amp;`-bearing `<loc>` decodes to `&` in the dry-run payload and the escaped form never ships.
- **Walk coverage (checked, no bug):** `ogimage.js` SVG placeholder escaping (`escXml` on title/description/url - no raw `&`/`<` into the SVG), the rasterizer-missing loud skip (once per run), the deterministic-bytes claim (content-derived hash stays stable), `resolveIndexNowKey` shapes (config string, `{key}`, persisted file, generate-once), and the `keyLocation` composition.
- **Battery note:** this pass EXTENDED the existing indexnow dry-run pin rather than adding one (the pin count stays 148 - the census derives from `test(...)` call count, so an added assertion inside an existing test is free).
- Gates: battery 148/148, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.28 - the llms.txt label probe (done, same session, post-26.27)

- **`llms.txt` emitted raw markdown link labels (fixed):** the emitter built `- [` + oneline(title) + `](url)`, so a page title carrying a markdown bracket closed the label early: a title `Foo] bar` produced `- [Foo] bar](https://...)` - the tail of the title and the URL spilled into the prose as literal text, and the link itself broke. A `[preview]`-style tag has the same effect. `llms.js` now escapes `[`, `]` and the backslash in the label (`mdLabel`); the description stays plain prose. Pinned: a `Foo] bar` title emits `- [Foo\] bar](url)` and the raw label never ships.
- **Walk coverage (checked, no bug):** `oneline` control-byte stripping and newline flattening (already pinned by the earlier newline pass-hunt), the missing-only `llms.txt` skip, and the indexable (non-404, non-noindex) page gate.
- **Trail aligned at 149:** README trail + v1.2.0 section (one new bullet), CHANGELOG 1.2.0 entry (one new bullet), the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 149/149, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.29 - the entity decoder probe (done, same session, post-26.28)

- **The shared entity decoder understood only five named entities (fixed):** `decodeEntities` in `scan.js` mapped `lt`/`gt`/`quot`/`amp`/`apos`(and `#39`) and nothing else. An SSG that emits typographic characters as entities - a smart quote (`&#8217;`), an em dash (`&mdash;`), a copyright sign (`&copy;`) - handed freestruct the literal entity text, and every consumer inherited the miss:
  - the **feed** re-escaped the `&` into `&amp;#8217;` (which a reader sees verbatim as `&#8217;`, never the character) - a real regression of the "escapes exactly once" contract for any entity beyond the five;
  - the **audit** graded title/description length on the RAW markup: an 80-character description written as 400 characters of `&amp;` runs, or a 60-character title written as numeric entities, warned "> 65" / "outside 70-165" on text that renders well inside the band.
  The decoder now resolves decimal (`&#8217;`), hex (`&#x2019;`) and a common named set, single-pass (numeric first, so `&amp;#65;` stays the literal `&#65;`). `audit.js` length graders measure the decoded text (`decodedLength`, plus `decodeEntities` on the description); `stripTags` no longer needs its ad-hoc `&amp;` swap.
- **Walk coverage (checked, no bug):** `search.json`/`llms.txt` inherit the wider decode for free (they share the helper); `ogimage.js` uses `escXml` (unchanged); the five-entity back-compat path (`&amp;`-only sources) still decodes identically.
- **Pins:** a new pass-hunt pin (numeric + named entities decode; the feed never carries `&amp;#8217;`/`&amp;mdash;`; search.json carries the decoded characters) and a new audit pin (an entity-heavy title/description is not graded on its markup length). Battery 149 -> 151.
- **Trail aligned at 151:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 151/151, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.30 - the indexnow keyLocation probe (done, same session, post-26.29)

- **`indexnow` keyLocation ignored `basePath` (fixed):** the payload named `keyLocation` as `site.url` + '/' + `<key>.txt`. The key file is emitted into the output ROOT (`emitIndexNowKeyFile`), which a sub-path install serves under the prefix - so the engines probed the domain root (a 404), could not verify the key, and refused the submission. It now rides the same `pageUrlFor` contract the sitemap/robots pointer use (the #3 bug class). Pinned: a `basePath: /myproject` install names `.../myproject/<key>.txt`.
- **Walk coverage (checked, no bug):** `emitIndexNowKeyFile` writes to the output root (correct - `pageUrlFor(config, key+'.txt')` resolves to the same served path), `resolveIndexNowKey` shapes, the no-sitemap refusal, and the escaped-`<loc>` decode (pass 26.27).
- **Trail aligned at 152:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 152/152, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.31 - the og:image basePath probe (done, same session, post-26.30)

- **`og:image` (and `twitter:image`) ignored `basePath` (fixed):** `ogImageFull` joined a site-local image src as `site.url + src` (`seo.js`). The image is a root asset served under the prefix, so on a sub-path install the share card pointed at the domain root (a 404) and the preview blanked - the same #3 class the sitemap/feed/robots/404 pointers already fixed. It now rides `pageUrlFor(config, src)`, matching the audit's own on-disk check, which already strips `basePath` before resolving (so the audit and the tag disagreed on the same page). Absolute `http(s)`/protocol-relative values still pass through untouched. Pinned: the basePath case now asserts `og:image` carries `/help/`.
- **Walk coverage (checked, no bug):** per-page `ogImage` overrides join the same way (now consistent), the `ogImageGeneration` per-page PNG src (`/og/<slug>.png`) now joins basePath-aware too, and `escAttr`/companions unchanged.
- **Trail aligned at 152** (assertions added inside the existing basePath pin; no battery count change).
- Gates: battery 152/152, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.32 - the case-insensitive attribute probe (done, same session, post-26.31)

- **Two case-sensitivity bugs (fixed), both the same shape: an HTML attribute regex that was the one member of its family missing the `/i` flag.** HTML attribute NAMES are case-insensitive, so upper- or mixed-case markup is valid and real.
  - `hasSeoType(html, 'description')` (`scan.js`) tested `/<meta[^>]*name=["']description["']/` with no `/i` while every sibling branch (`og`, `twitter`, `jsonld`, `canonical`) had it. An SSG/author writing `<META NAME="description" ...>` slipped the missing-only gate, so freestruct injected a SECOND description - and its own audit then FAILed the page for the duplicate the engine caused (engine-caused FAIL, the worst kind). Now `/i`.
  - The link checker's `href` matcher (`linkcheck.js`) was `/href=(["'])([^"'#]+)(?:#[^"']*)?\1/g`, no `/i` - the one `href` regex in the engine without it. An upper-case `<A HREF="/broken/">` was skipped entirely, so a broken internal link shipped green under `--strict`. Now `/gi`.
- **Probes:** `/tmp/w35.mjs`, `/tmp/w36.mjs` (caps description -> 2 metas, audit FAIL "duplicate meta description"), `/tmp/w37.mjs` (caps HREF -> broken link unreported, `--strict` passed). Both fixed, both re-probed clean.
- **Pins:** `missing-only: an UPPER-CASE description meta still suppresses injection` and `linkcheck: an UPPER-CASE HREF is checked too`. Battery 152 -> 154.
- **Walk coverage (checked, no bug):** the remaining `href`/`src` readers (`seo.js` cache-bust `(href|src)=` is `/gi`; `audit.js` `grabMeta`/`grabCanonical`/`<loc>` are `/i`) already carry the flag; the `<loc>` counter and `Sitemap:` probe are intentionally shape-only.
- **Trail aligned at 154:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 154/154, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.33 - the lazy-load duplicate-guard probe (done, same session, post-26.32)

- **`addLazyLoading` duplicated an existing `loading` attribute (fixed):** the guard was `match.includes('loading=')` - lowercase, no whitespace tolerance. HTML attribute names are case-insensitive and `loading = "eager"` is valid, so `<img src=... LOADING="eager">` (or `loading = "eager"`) failed the guard and the pass appended a SECOND `loading="lazy"` - invalid duplicate attribute on the element, and the author's eager hint silently lost. Guard is now `/loading\s*=/i`. Probed with `/tmp/w38.mjs` before/after (a `LOADING="eager"` img gained a second attribute; now it does not).
- **Pins:** `lazy-loading: an existing LOADING attribute (any case) is not duplicated` (both a caps attribute and a whitespace-padded one; asserts exactly one `loading` per img). Battery 154 -> 155.
- **Walk coverage (checked, no bug):** the rest of the attribute-name readers carry `/i` (`stripRobotsMeta`, `htmlIsNoindex`, `hasSeoType`'s other branches, the cache-bust `(href|src)=` `/gi`, audit's `grabMeta`/`grabCanonical`); the table-wrap class probe (`\bclass`, tableish token test) is `/i`; the minifier block regex is `/gi`.
- **Trail aligned at 155:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 155/155, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.34 - the 404 noindex rerun probe (done, same session, post-26.33)

- **A second `freestruct` run dropped the 404 `noindex` (fixed):** `pipeline404` inserted `<meta name="robots" content="noindex, nofollow">` BEFORE calling `injectPage`, i.e. just before `</head>`. On run 1 the page had no `<!-- freestruct -->` marker yet, so the meta sat after `</head>`'s predecessor with nothing between it and the close tag. On run 2 `injectPage`'s rerun hygiene (`stripInjectedRegions`) deletes everything from the `<!-- freestruct -->` marker to `</head>` - and the run-1 noindex now lived INSIDE that span (the marker from run 1 precedes it), so it was stripped and never re-added. The audit then failed the 404 it had passed on run 1 ("404 page missing its noindex robots directive"). The dogfood is what caught it: `npm run build` then a second `freestruct` run (the local e2e rhythm) flips clean -> 1 failure.
- **Fix:** `pipeline404` now runs `injectPage` FIRST, then strips any robots meta and re-asserts the noindex past the strip (one robots meta, single owner, stable across reruns).
- **Pins:** `404 noindex survives a rerun` (runs twice, asserts exactly one noindex). Battery 155 -> 156.
- **Walk coverage (checked, no bug):** other pre-injection writes that must survive the strip - the generated 404's own body/head (regenerated each run, not stripped), custom-404 bodies (outside the marker span), and the late passes (reading-time/last-modified/lazy-load) which run AFTER injection and anchor on `</head>`.
- **Trail aligned at 156:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 156/156, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings, and the audit stays clean across three consecutive `freestruct` reruns).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.35 - the mtime drift probe (done, same session, post-26.34)

- **feed `pubDate` / sitemap `lastmod` drifted on every rerun (fixed):** both derive from the page mtime captured pre-injection in `buildPages` (the issue #9 honest-date contract: "the date the page last actually changed, not the build time"). But freestruct REWRITES every page it decorates (injection + the late passes), so the NEXT run's `buildPages` snapshot captured freestruct's own write as the page mtime - the dates churned every run with no content change, and a redeploy re-stamped the whole feed (a reader sees every post as freshly updated). Caught by a whole-tree byte-diff between two consecutive runs (`diff -rq` on the docs output): 33 pages + feed.xml drifted, all on the timestamp lines. Fix: after the late passes, restore each page's pre-injection mtime (`fs.utimesSync(page.file, page.mtime, page.mtime)`), so the dates are stable across reruns and still advance when the SSG rebuilds the page. The generated 404 is skipped (freestruct owns it; it never reaches the feed/sitemap).
- **Pins:** `feed.xml: pubDate/lastmod stay put across a rerun` (stamps a page to a fixed past date, runs twice, asserts both the feed pubDate and the sitemap lastmod are identical and carry the pre-run date). Battery 156 -> 157.
- **Walk coverage (checked, no bug):** `last-modified` meta embedding "now" is documented behavior (a live deploy stamp), not a drift bug - it is the only remaining per-run byte difference, and it is excluded from the content-derived hash (scan.js `stable`). The build hash itself was already rerun-stable (asserted elsewhere).
- **Trail aligned at 157:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 157/157, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings; the only per-run byte difference is the documented `last-modified` stamp).
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

### Pass 26.36 - the staging-flow CI fix (issue #44)

- **Issue #44 (dhaupin, enhancement): CI verified `main` only, and the deploy was ungated.** `test.yml` triggered on `push`/`pull_request` for `main` alone, so none of the staging pushes in the recent walk ran CI (the gap flagged at the end of Pass 26.35 - the last four fixes were verified locally only). `docs.yml` was `main`-only too, and `docs-lane.yml`'s `deploy` job (line 131, `actions/deploy-pages@v5`) carried no ref guard.
- **The trap (#44, and poststruct#32 as the reference):** once `staging` is in a trigger list, the trigger no longer keeps staging content out of production - the deploy job itself has to. Adding `staging` to the docs trigger WITHOUT the guard would publish to production on every staging commit.
- **The fix, three parts:**
  1. `test.yml`: `push` + `pull_request` branches are now `[main, staging]`, so the battery verifies staging work where it lands.
  2. `docs.yml`: same trigger widening, plus a `pull_request` event (it had none), so the docs lane is exercised on staging.
  3. `docs-lane.yml`: the `deploy` job now carries `if: github.ref == 'refs/heads/main'`. This is the load-bearing guard, and it lives in the REUSABLE lane (not the caller) on purpose: every rig project that calls the lane inherits it and cannot publish staging by accident. `docs.yml` stays a thin caller with no guard of its own.
- **Pins:** three battery tests under the new `staging flow` section - one asserts both workflows trigger on `main` AND `staging` for push + PR; one asserts the lane's `deploy.if` is exactly `github.ref == 'refs/heads/main'` and that the caller does not re-implement it; one asserts the promotion fast-forward (`git push origin origin/main:staging`) is documented in AGENTS.md. Battery 157 -> 160.
- **Docs:** AGENTS.md gains a `Git flow (staging is permanent)` section (the branch model, the guard-lives-in-the-lane rule, and the post-promotion fast-forward); DEPLOY.md's overview table, a new `Branch flow (staging -> main)` promotion runbook, and the Pages section record the staging trigger and the deploy guard; CONTRIBUTING carries the same rules.
- **Trail aligned at 160:** README trail + v1.2.0 section, CHANGELOG 1.2.0 entry, the announcement prose, and the derived count surfaces via the count census.
- Gates: battery 160/160, docs audit (7 gates clean), sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run build` (Jekyll + inject) + `freestruct audit docs/_site` (0 failures, 0 warnings). CI is the real verifier for the trigger change - pushing this to `staging` started `test` and `docs`, with `docs`'s deploy job SKIPPED (run `40816588630`: build 13/13 steps success, deploy skipped - the #44 proof).
- **The fourth point (owner, same day):** the pattern grew a fourth rule after the issue was filed - after every promotion, fast-forward `staging` to `main` (`git push origin origin/main:staging`). A merge-commit promotion puts a commit on `main` that `staging` lacks, so the two drift by one every promotion even when the flow is followed exactly. It is mechanical, not a mistake, and the sync is a required step; documented in AGENTS.md (with a pin) and the DEPLOY promotion runbook.
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

---

### Pass 26.37 - the prestruct port pass (four hardenings the sibling landed first)

The owner asked what prestruct had landed recently that freestruct should carry. I diffed prestruct's last ~40 commits against freestruct's surface and found four real gaps (the rest were already present or handled by the engine - e.g. prestruct's mobile table CSS is redundant with freestruct's `tableWrap`, which already wraps tables in `.fs-table-wrap`).

1. **`npm run gate` aggregate.** freestruct's `check` was `test && lint:docs && packs:selftest`, and `prepublishOnly` ran `check` - so a local `npm publish` from a template-drifted tree shipped the drift, because `sync:check` ran in CI only. New `gate` = `sync:check && check`; `prepublishOnly` now runs `gate`. This is the clearest win: it closes a real publish hole.
2. **`scripts/unwrap-prose.cjs` merge.** The two copies had diverged in OPPOSITE directions - freestruct hardened indented code and HTML blocks; prestruct hardened thematic breaks (`---`/`***`/`___` flush), frontmatter detection (a `key: value` probe), and `module.exports` for tests. Merged both: a rule with no blank lines now flushes instead of joining (`para\n---\npara` no longer becomes `para --- para`), a bare top-of-file rule is not mistaken for frontmatter, and the module is require-able - while keeping freestruct's indented-code and HTML-block verbatim handling.
3. **`scripts/check-fiction-signatures.cjs` (the claims gate, `npm run lint:claims`).** freestruct had no equivalent. Fails when a living surface presents a retired key (`ssr-config.yml`, `preserveExistingMeta`, `generateNav`, `cacheBusting.hash`) or a non-existent command (`npm run validate`) as current. A negation regex and a `FICTION-OK:` waiver keep lesson-telling prose (which is the gate working) out of the findings; the same allow-list discipline as the docs audit (AGENTS, labs/, CHANGELOG, vendored trees). Wired into `check` and `test.yml`. Verified both ways in the battery: clean on the shipped tree, and a retired key presented as live trips it.
4. **Mobile table CSS guard** in `docs/_layouts/default.html` (`display:block` + `overflow-x:auto` + `table td code { white-space:nowrap }`) - belt-and-braces for a tree that opts out of the engine's `tableWrap`.

- **Pins:** two more battery tests (160 -> 162) - one asserts every thematic-break form flushes and frontmatter probes correctly; one asserts the claims gate ships, is wired into `check` + CI, passes clean, and catches a fiction.
- **Docs:** AGENTS/CONTRIBUTING gate lists name `npm run gate` + `lint:claims`; DEPLOY, README, the release-gate playbook, and the CHANGELOG 1.2.0 entry record the composed gate and the claims gate; count surfaces derived to 162 via the census.
- Gates: battery 162/162, docs audit (7 gates clean), claims gate clean, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run gate` (the new aggregate) exit 0.
- Not ported: prestruct's "build ends in the audit" (its `build` fails on FAIL-class audit findings). freestruct deliberately keeps `audit` a SEPARATE subcommand (exit 0 run-ok vs 1 audit-findings) and governs report classes with `--strict`/`--tolerant`; making the bare run end in a failing audit is a product-contract decision, flagged to the owner rather than ported.
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

---

### Pass 26.38 - the docs-audit runner convergence (light first step for prestruct#75)

The owner asked which audit style was better and whether the two repos could share one. Answer: there are two audits per repo. The **runtime** audit (`engine/audit.js`) is already one shared contract - prestruct's own header says so ("the family keeps ONE audit contract ... stays freestruct-compatible"). The **docs** audit is where they diverge: freestruct runs ONE consolidated runner (`scripts/run-docs-audit.cjs`, 7 gates); prestruct runs six `check-docs-*.cjs` files chained with `&&`. freestruct's consolidated shape is the newer, stronger pattern (one findings list, one report, one exit, per-gate selection). Filed prestruct#75 to converge on it, and took the light first step here so the shape is proven before prestruct adopts it.

- **`scripts/lib/docs-audit.cjs` (new, 119 lines).** The shared runner: discovery (`discoverFiles`), the generic markdown/url helpers (`fmBlock`, `urlKey`, `pageUrl`), the findings list, the per-gate count line, and gate selection. Driven by a caller-supplied `{ root, docsDir, readme, navFile, gates, names, urlFor, log }`. **Boundary:** it NEVER prints the final report and NEVER exits - the caller owns voice and exit code, so freestruct's report-only-by-default contract is not baked into the shared module (pinned: the lib source carries no `process.exit` and no freestruct report string).
- **`scripts/run-docs-audit.cjs` (422 -> 385 lines).** Now freestruct's gate SET over the shared runner. The seven gates are plain `(ctx) => void` functions that read `ctx.files`/`ctx.collect`/`ctx.resolveUrl` - none re-implements the walker or the exit. Identical output and exit codes (0 clean, 1 findings, 2 unknown gate).
- **Why this shape is shareable:** a second caller drives the same runner with a different gate set and its own log sink (pinned in the battery) - prestruct would keep its own gate vocabulary (`prestruct <verb>` vs `freestruct <verb>`), globs and allow-lists, and only adopt the runner.
- **Not converged (deliberate, documented in prestruct#75):** the runtime audit (already one remapped contract) and the build wiring (prestruct chains `audit-if-configured.cjs` into the build; freestruct keeps `audit` a separate subcommand with the `--strict`/`--tolerant` ladder - a product-contract choice per repo).
- **Pin:** two more battery tests (162 -> 164) - one asserts the runner ships as a standalone module, exports the shared helpers, carries no exit/report voice, is required by the caller, drives a foreign gate set, and throws on an unknown gate so the caller decides the exit; the second (the owner's independence rule) asserts the shared runner requires node builtins only, freestruct carries no prestruct dependency in any field, and no shipped surface imports the sibling at runtime - a consumer may have one repo without the other, so the runner is vendored (a copied file), never a cross-repo import.
- **Independence (owner rule):** the convergence must not make one repo import the other. The shared runner is a vendored copy (builtins only: `fs`/`path`), and the new pin holds that plus the absence of any prestruct dependency. Audits run with neither sibling installed.
- Gates: battery 164/164, docs audit (7 gates clean), claims gate clean, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run gate` exit 0.
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet); prestruct adopts the runner once this lands (tracked at prestruct#75).

---

### Pass 26.39 - the cache-bust same-origin + srcset pass (owner-directed, three real defects)

The owner asked how freestruct's cache busting compares to prestruct's, then to fix what the comparison surfaced. Probing the REAL CLI against fixture sites (the reproduce-first discipline) found three defects in the `<script src>`/`<img src>`/`<link href>` asset matcher, none pinned or documented:

1. **Off-site assets were busted.** `https://cdn.other.com/logo.svg` and `https://unpkg.com/lib@1/dist/lib.js` gained `?v={hash}`. freestruct cannot invalidate another origin's cache, and a CDN that keys on the query string can even MISS its cache on the new URL. Fix: same-origin only - absolute/protocol-relative references bust only when the host is the configured `site.url` origin; root-relative always busts.
2. **Signed URLs were corrupted.** An S3 presigned link `...?X-Amz-Signature=deadbeef` became `...?X-Amz-Signature=deadbeef&v={hash}`, breaking the signature so the asset 403s. Fix: the same same-origin gate skips it (an off-site URL is never touched, so its query is preserved byte-for-byte).
3. **`srcset` was never busted.** `<img srcset="/i/a.png 1x, /i/a@2x.png 2x">` and `<picture><source srcset=...>` passed through untouched, so on any responsive-image site the primary (largest) candidate stayed stale at the edge while `src` moved on. Fix: a spec-shaped srcset splitter busts every candidate on `<img>`, `<picture><source>` and `<link imagesrcset>`, keeping descriptors and rejoining with the canonical `, `. A naive comma split was tried first and CORRUPTED a `data:` URI (its payload carries commas) - the battery pin caught it, and the parser now follows the HTML spec's whitespace/separator loop.

- **`engine/seo.js`:** the matcher grew `parseAssetRef`/`isSameOrigin`/`bustAssetRef` and a `parseSrcset` splitter; the single `href|src` rewrite and a new `srcset` rewrite both route through `bustAssetRef`, so the same-origin rule is enforced in ONE place for every attribute. `data:`/`blob:`/`mailto:`/`tel:` and fragment-only refs are skipped at parse time.
- **Pins:** two more battery tests (164 -> 166) - one asserts off-site assets (third-party CDN, protocol-relative, off-site script) are untouched, a signed URL keeps its exact query, `data:`/`blob:` are untouched, and same-origin absolute/protocol-relative/root-relative still bust; the other asserts every `srcset` candidate is busted on `<img>` and `<picture><source>`, a mixed srcset busts only the same-origin candidate, a `data:` candidate is untouched, a descriptor-less candidate busts, and a rerun does not stack `v=`.
- **Docs:** the cache-busting guide gains a "Same-origin only" subsection and a supported-assets note on srcset; the FAQ gains "Does it bust third-party or signed URLs?".
- Gates: battery 166/166, docs audit (7 gates clean), claims gate clean, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run gate` exit 0.
- Next pass: cut the v1.2.0 tag (owner-gated - the user said NOT yet).

---

### Pass 26.40 - the release-walk pre-tag hardening sweep (owner-directed)

The owner asked for a hunt over **every feature** for bugs, gaps, edges, vulns and fiction before cutting v1.2.0. Method: reproduce-first against the REAL CLI on scratch trees (`/tmp/fs-probe*`), one probe per feature surface, each confirmed defect red-checked then pinned. Nine probes came back CLEAN (noindex honored across sitemap/feed/search/llms; escaping of hostile config values through og/twitter/JSON-LD/verification/404; tableWrap; per-page overrides + warnings; `ogImageGeneration` shape warnings; head-anchor skips; rerun idempotency; same-origin cache busting; `lastModified` = wall-clock as documented, not fiction). Five defects confirmed and fixed, battery 166 -> 170:

1. **Comments-only snippet templates injected empty regions.** The shipped `inject-body-start.html` / `inject-footer.html` are comments-only (placeholders + examples). Stripping comments left whitespace, which the engine wrapped in the `<!-- freestruct:snippet -->` markers on EVERY page (the footer's dozen blank lines with it) - visible in the repo's own baked `docs/_site`. A snippet that strips to whitespace is now treated as absent (`readSnippet`).
2. **Empty description tags on a description-less page.** With no `site.description` and no page description, the injected head carried `content=""` for `name=description` / `og:description` / `twitter:description` - a present-but-empty description is worse to a crawler than none, and the engine's own audit then FAILed the page it had just decorated. Those lines are omitted when no description source exists.
3. **Breadcrumb leaf URL vs canonical.** The auto `BreadcrumbList` leaf used the segment-join URL (`/guide`) while the page canonical is `/guide/` for a directory page, so the trail's last item 404'd against the canonical. The leaf now uses the page's own slug (matching its canonical); intermediate segments keep the join.
4. **Duplicate tags from a partial og/twitter set.** The missing-only gate is group-level (`og:title`/`og:description`; `twitter:card`/`twitter:title`), so a page shipping only its own `og:url` left the group gate false and the whole config set injected - a DUPLICATE `og:url` (the audit counts only `og:title`, so it shipped green). Each candidate tag is now filtered per-tag against the page's own head; the `og:image` companions and `article:*` tags follow the same rule.
5. **Audit/engine contradiction on partial sets.** The audit's FAIL core class failed a partial-set page's missing companions even though the engine backs off the whole group by design (SSG-owned partial sets, which the audit documents as report-grade for the non-core members). The FAIL now fires only when the page carries NO tag of the set at all - the "engine failed to inject on a bare page" case the class exists for - and warns otherwise. `og:description` / `twitter:title` / `twitter:card` joined the duplicate probe so a future engine regression there still fails.

- **`engine/seo.js`:** `readSnippet` treats a comments-only snippet as absent; the injected head drops the description lines when `!pageDescription`; the breadcrumb leaf rides `page.slug`; the og/twitter candidate tags are filtered per-tag via `pageHasMeta`.
- **`engine/audit.js`:** the og/twitter core class is page-set-aware (`ogAny`/`twAny`); three duplicate-head probes added.
- **Pins:** four more battery tests (166 -> 170). Living count claims updated 166 -> 170 (`docs/index.md`, `AGENTS.md`, `CONTRIBUTING.md`, `DEPLOY.md`).
- **Docs:** one CHANGELOG row; the release-line pin chain in README + CHANGELOG extended to 166 -> 170.
- Gates: battery 170/170, docs audit (7 gates clean), claims gate clean, sync lockstep, packs selftest (skip locally, teeth in CI), tarball e2e, `npm run gate` exit 0.
- Next pass: continue the walk if the owner wants more surface (the CLI subcommand arg parsing and the `packs/` crashtest surface were not re-walked this pass); cut the v1.2.0 tag (owner-gated - NOT yet).
