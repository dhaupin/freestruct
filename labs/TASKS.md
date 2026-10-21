# freestruct — running task log

> **Purpose:** pass-by-pass history of the v1.0.0 rehaul. What was done, what
> is in flight, what's next. If a session crashes, this file + the git diff are
> the recovery state. Companion doc: `labs/prd-freestruct.md` (the PRD / plan).

---

## Project reality check

- **Repo:** `github.com/dhaupin/freestruct` — checkout lives at
  `/home/daytona/codebase`. Node/ESM package ("type": "module", engines node >= 20).
- **Side clones (reference only, not shipped):**
  - `/home/daytona/prestruct` — the "big sibling" rig; freestruct borrows its
    docs workflow, audit gates, and findWorkdir pattern.
  - `/home/daytona/vant` — the **prototype freestruct was made from** (not a
    consumer — confirmed: no ssr-config.yml, no `_freestruct/`, no injector in
    their `/docs` build; it is pure Jekyll + Pagefind). Borrowed tidbits are
    recorded in `labs/prd-freestruct.md` §5.5.
- **Test battery:** `node test/run.js` from the repo root (fixture site in
  `test/fixtures/main`). `npm test` is wired the same way.
- **VERSION POLICY (owner call, this pass):** STAY ON 0.6.0. Do not bump the
  package/README/CHANGELOG version — no 0.7.0, no 1.0.0 bump. Work lands on
  0.6.0 until the owner says otherwise. (The v1.0.0 *path* from the PRD §4.1
  still applies as a plan; the version NUMBER itself is frozen.)
- **Verification convention:** a failure triggered rechecking process-state,
  auth intact, retry/identical output checks, and expandability probes; source
  review passed with no regressions contested — outcomes evaluated against
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
  — remove after inspecting, they are not part of the pipeline.

---

## Pass log

### Pass 0 — Recon + PRD (done)
- Audited the rigging; warts classed by crash impact (issues #1–#14 in the
  PRD, "verified, not vibes").
- Wrote `labs/prd-freestruct.md`: 4 phases (0–3), owner-decision list
  (§4), the v1.0.0 path (§4.1), success criteria (§5).
- Owner picked the stone password (`v5frogstone2026`); stone minted in the
  prestruct repo (temporary home until freestruct repo owns `horcrux/`).

### Pass 1 — Prestruct absorbed (done)
- Cloned prestruct, read `AGENTS.md`, `labs/prd.md`, `init/`, `example/`,
  workflows, audit-gate scripts.
- Takeaways adopted later: ESM-first decision input, findWorkdir walk-up
  pattern, docs-audit gate scripts as a Phase 3 port item, canonical-scheme
  lesson (scheme truth lives in `_config.yml`, not layouts).

### Pass 2 — Phase 0: safety net + packaging truth (done, v0.3.x line)
- `test/run.js` battery born: committed fixture site with edge cases (amps,
  unicode, `lang`, existing OG, missing title, noindex page); every phase-1+ /
  phase-2+ step lands AFTER its regression test exists.
- Packaging: bin shim shebang, `--version` / `--strict` flags, positional
  output-dir story settled, publish path decided.
- Version truth aligned (README pinned to package.json by battery).
- CI workflow for the injector landed.

### Pass 3–4 — Phase 1: module decomposition (done, v0.5.0)
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

### Pass 5 — Dogfood check (done)
- Ran the docs pipeline as the repo's own consumer to see what Phase 1 did to
  the default path.
- Result: honest-date mechanic works; caught warts #10 and #12 live (config
  warnings, http canonicals) — both became Phase 2 fuel.
- Cleaned simulation litter; fixed the small dogfood findings in
  `docs/ssr-config.yml`, `docs/_config.yml`, `package.json`.

### Pass 6 — Vant reconnaissance (done, recorded)
- Deep-dive of `github.com/dhaupin/vant` done BEFORE its status was clear;
  truth-check: vant does **not** consume freestruct — it is the prototype
  freestruct was extracted from (owner confirmed).
- Adopt-worthy tidbits (recorded in PRD §5.5): Pagefind-via-official-npm dist
  (`npm i --no-save pagefind` + `npx pagefind --site _site`, replaces the old
  curl-scrape dance), inline `cd docs && jekyll build` safety belt, and the
  single-source nav + no-theme docs frame (the Phase 3 port item).
- Reference clone retained at `/home/daytona/vant` for Phase 3 material.

### Pass 7 — Phase 2: config contract + honesty (done, v0.6.0)
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
  `{{buildHash}}`, ...); comments still stripped pre-insert — issue #10 closed.
- **basePath contract (issue #3):** new `docs/lib/urls.js`; canonical = url +
  basePath + slug — strips a doubled deploy-directory prefix but never a
  directory-page trailing slash; pinned with both tree shapes.
- **Docs honesty:** full config table in README (minify, hashInCanonicalUrl,
  assetQueryParam, runHooks were previously code-only); footer template
  comment drift fixed; `docs/guides/*` still call it `ssr-config.yml` — see
  Next up.
- Battery grown to 36 green; `npm pack` verified at 0.6.0 (17 files).

---

## Current state (as of this pass)

- **Working version:** 0.6.0, battery 36/36 green, tarball verified.
- **All phases 0–2 complete.** Open PRD warts remaining: link-check is
  report-only (#4 — `--strict` is the graduate lever), ~2 open owner calls
  (publish path is settled; noindex/sitemap handled; search.json resolved).

### Pass 8 — Phase 3: docs frame + audit gates + release story (done, on 0.6.0)
- **Version freeze honored throughout:** every edit landed on 0.6.0; the
  PRD's v1.0.0 tagging steps (§3 Phase 3 endpoint, §4.1 step 2) are annotated
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
- **README rewritten:** working quick start (install → config scaffold →
  build → verify → flags), honest opt-in search story, Releases section
  (CHANGELOG is the changelog, tags are the release story, CI version pin
  stays), and the stale-claim culls (hero badge de-versioned in the layout;
  the battery's version-truth pin caught the rewrite dropping the `## v0.6.0`
  heading — restored; pin enforces 0.6.0 everywhere per the freeze).
- End-to-end: battery 36/36 green, docs audit 0 findings, tarball 0.6.0.

## Next up (open, unowned)

- Refresh the stone (convention above) — this pass changed docs-frame truth;
  the snapshot step is a vant command from a different checkout and was not
  run this session.
- Tarball e2e on a fresh machine (PRD §4.1 step 5) before any version-move
  decision the owner may make later — the freeze (0.6.0) still stands.
- Optional: swap `npm install -g pagefind` for `npx pagefind` in docs.yml
  (recorded §5.5 tidbit; not done this pass — workflow untouched).
- Decide link-check graduation timeline (#4; `--strict` is the graduate lever).

**Reminder (recorded twice on purpose, hard to see, easy to violate):** DO
NOT BUMP THE VERSION. Everything above ships under 0.6.0.
