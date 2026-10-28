# AGENTS.md: Freestruct

Engineering history and the house rules, written for an AI agent (or human) picking this repo up cold. Read before touching anything. Every rule here was debugged against real runs; nothing is theoretical.

**Also read:** [DEPLOY.md](DEPLOY.md) before touching anything release- or CI-shaped (Pages pipeline, npm runbook, cache discipline). The rendered [engineering-decisions page](https://freestruct.creadev.org/engineering-decisions) (`docs/AGENTS.md` in-tree) carries the same knowledge as docs prose. [labs/prd-freestruct.md](labs/prd-freestruct.md) is the rehaul PRD (phases, warts, decisions); [labs/TASKS.md](labs/TASKS.md) is the pass log.

---

## What this repo is

**Freestruct** is a framework-agnostic post-build SEO layer for static doc sites. It runs AFTER any SSG finishes - no plugins, no coupling to the SSG. It reads the built output HTML and injects what every page still misses: SEO/OG/JSON-LD metadata, `sitemap.xml`, `robots.txt`, `feed.xml`, a noindex `404.html`, cache-busted assets, and internal-link validation.

### Philosophies (do not drift)

- **No SSG dependencies** - works with any static site generator
- **No SSG plugins** - a pure post-build layer on the output tree
- **One command** - `node bin/freestruct.mjs` (or `npx freestruct`) after the SSG builds
- **Config-first, no magic** - unknown/retired keys warn loudly; fatal errors have exit codes
- **Honesty over promises** - features here are documented only when the code does them; the docs-audit truthfulness gate fails on the reverse

---

## House structure (prestruct-shape, owner-directed)

| Path        | What it is                                                            |
|-------------|-----------------------------------------------------------------------|
| `engine/`   | The shipped runtime: `inject.js` orchestrator + the thirteen lib modules |
| `engine/_freestruct/` | Canonical packaged templates (the ONLY place to edit them)   |
| `bin/freestruct.mjs`  | Thin CLI shim consumers install (`npm run build` style entry) |
| `init/`     | Consumer scaffold kit (starter config + template copies, version-stamped) |
| `docs/`     | The docs site, and the worked example itself: Jekyll + Freestruct + Pagefind |
| `packs/`    | The crashtest extension surface (one pack: `freestruct-docs-shapes`)   |
| `scripts/`  | CI/tooling: template sync, docs audit, tarball e2e, pack selftest, language gate |
| `test/`     | `node test/run.js` - the fixture battery (133 pins) + version truth     |
| `labs/`     | PRD + pass log: where plans and history live                          |
| `horcrux/`  | The stone (brain snapshot, refresh convention in the PRD)              |

**Generated-copy rule:** `docs/_freestruct/` and `init/docs/_freestruct/` are synced copies of `engine/_freestruct/`. Never hand-edit them; edit canonical, then `npm run sync` (CI forbids drift via `npm run sync:check`).

---

## Getting started (contributor wake-up)

Cold-start order:

1. Read this file (scope + rules).
2. `labs/prd-freestruct.md` - phases and decisions. Work belongs to a phase.
3. `labs/TASKS.md` - pass log. Record what you did and what the next pass picks up.
4. Agents: the stone in `horcrux/` is the project-history snapshot (boot convention documented in the PRD section 4; the password lives in the filename).
5. Pull requests: same review posture as the docs guides describe ([contributing guide](https://freestruct.creadev.org/contributing/style)).

**Setup (Node >= 20):**

```bash
npm install
npm test            # the battery
```

**Gates before every push (CI runs the same set):**

```bash
npm test                     # battery: fixtures + version truth + pack shape
npm run lint:docs            # docs audit: frontmatter/links/nav/style/truthfulness/language/codefmt
npm run sync:check           # engine -> init -> docs template copies in lockstep
npm run packs:selftest       # pack teeth (needs a dhaupin/crashtest checkout)
npm run e2e                  # tarball e2e: fresh install quick start through the bin shim
```

---

## Working rules the gates pin down

- **Version pin:** everything ships under **1.2.0** (bumped from the 1.1.0 post-stable surface on 2026-10-28, carrying the post-queue engine sweep; the 1.1.0 bump landed 2026-10-25 from the 1.0.0 first stable, superseding the earlier 0.6.0 freeze and the 0.9.0 pin; `labs/TASKS.md` VERSION POLICY has the trail; the battery pin enforces one number everywhere). The manual npm bootstrap is done; tags are still owner-gated - the whole runbook is in [DEPLOY.md](DEPLOY.md).
- **Engine changes go in `engine/` only.** The templates move via `npm run sync`; guide-facing CLI truth moves via the battery's truthfulness gate. README/config/config-reference are regenerated TOGETHER.
- **Comment format (gated):** every engine source opens with `// engine/<file>.js - <one-line purpose in English>` (a shebang may sit on line 1; the header follows). Sections are `// ---------- name ----------` banners; the why rides above the code, not after it. `npm run lint:docs` fails on drift.
- **Docs prose is English-only, hyphen-only (no em/en dashes), no emoji, no trailing whitespace, table rows end with pipes** - the docs audit enforces all of it (language + style gates; ported from the vant/prestruct gate family). Inline code spans are literals, not prose: quote glyphs inside backticks when a rule has to show them.
- **Consumer-facing claims are battery-pinned.** If a doc/README/config example promises a key or flag, a pin asserts the code does it (`truthfulness` gate + `test/run.js`).
- **CI is the verifier for anything Jekyll-shaped.** No Ruby lives in this workspace; the Pages build (and its `--strict` + crashtest dogfood) is the real verifier, coordinated through the workflows in [DEPLOY.md](DEPLOY.md).

---

## Key decisions already locked (do not relitigate)

- ESM + `node >= 20` (owner call at rehaul start)
- Config name: `freestruct.config.yml`, legacy `ssr-config.yml` read back-compat
- `searchIndex` opt-in (no competing index by default; noindex honored everywhere)
- Escaped-or-fail for generated XML (control characters abort the build loudly)
- Templates ship with the package; init/ is the scaffold kit
- Missing-only injection (existing tags are never overwritten)
- `--strict` graduates the report-only classes to failures; default runs stay report-only (the strictness ladder, locked in the PRD)
- One homepage framework: Jekyll for THIS repo's docs, any SSG for consumers

---

## Related

- [README.md](README.md) - the product story: install, config, features
- [DEPLOY.md](DEPLOY.md) - publishing truth: Pages pipeline + npm runbook
- [the config guides](https://freestruct.creadev.org/guides/freestruct-config) - the config contract, consumer-facing
- [packs/README.md](packs/README.md) - the crashtest pack surface
- [docs/AGENTS.md](docs/AGENTS.md) - the engineering-decisions page as a docs site page
