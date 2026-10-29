# Contributing to Freestruct

Thanks for looking at Freestruct. The contribution path is the same for humans and agents; this file is the short version, [AGENTS.md](AGENTS.md) carries the full house rules.

## What Freestruct is (scope discipline)

Freestruct is a **post-build SEO layer for static doc sites**. It runs after any SSG (Jekyll, Hugo, Docusaurus MkDocs, VitePress, Astro, Eleventy) has built the output tree, reads the built HTML, and injects what pages still miss: SEO/OG/Twitter/JSON-LD metadata, `sitemap.xml`, `robots.txt`, `feed.xml`, a noindex `404.html`, cache-busted assets, and internal-link validation.

**In scope:** anything that improves the built-tree pass (injection, artifact generation, link checking, hooks, config contract).

**Out of scope:** being an SSG, a build tool, or a dev server; bundling a claim-competing search index (bring your own indexer; `search.json` is opt-in); touching SSG source files instead of the built output.

Electrically honest design rules that PRs must keep:

- **Missing-only injection** - existing tags are never overwritten
- **Config-first, no magic** - unknown/retired keys warn loudly; fatal errors exit 1/2/3 by kind
- **Escaped-or-fail XML** - generated XML either escapes everything or the build refuses loudly
- **basePath is one contract** - every generated URL (canonical, sitemap loc, robots pointer, feed links, 404 home link) goes through `pageUrlFor`
- **The version is pinned at 1.2.0** (bumped from the 1.1.0 post-stable surface on 2026-10-28) until the owner moves it again

Where to change things: the runtime lives in `engine/` (one orchestrator + thirteen modules; see the [engineering-decisions page](https://freestruct.creadev.org/engineering-decisions)), templates are canonical at `engine/_freestruct/`, and the consumer scaffold kit is `init/`. `docs/` is both the documented site and the worked example.

## Before you open a PR

CI runs the same commands locally, so test like CI:

```bash
npm install
npm run gate                 # sync:check + check (the composed local gate; prepublishOnly runs it)
npm test                     # the battery (170 pins)
npm run lint:docs            # docs audit: 7 gates incl. English-only prose
npm run lint:claims          # claims gate: retired-as-current fiction signatures
npm run sync:check           # template copies in lockstep
npm run e2e                  # tarball e2e (fresh-install quick start)
```

`npm run packs:selftest` additionally proves the crashtest pack's teeth (needs a local dhaupin/crashtest checkout).

Branch flow: `staging` is the permanent integration branch. Branch off it, open the PR against `staging`, merge there; `staging` -> `main` is the only promotion path, and CI verifies both branches. After every promotion, fast-forward `staging` to `main` (`git push origin origin/main:staging`) - a merge-commit promotion drifts the two by one every time, so the sync is a required step, not a cleanup. The Pages deploy job is gated to `main`, so a `staging` build verifies the lane without publishing (see [AGENTS.md](AGENTS.md), the Git flow section).

Docs prose rules are enforced, not suggested: English-only, hyphens (no em/en dashes), no emoji outside CODE, table rows end with pipes, and every engine source opens with `// engine/<file>.js - <purpose>`.

## Reporting issues

Open an issue with the actual behavior: the version, the config (redact URLs if needed), the exit code, and the artifact diffs you expected. If it only reproduces on a specific SSG, include the built HTML page (pre and post Freestruct).

## License

See [LICENSE](LICENSE).
