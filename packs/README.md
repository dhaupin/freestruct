# Freestruct packs - the crashtest extension surface

This directory hosts Freestruct's contribution to [crashtest](https://crashtest.creadev.org),
the adversarial-audit engine built by [Creadev](https://creadev.org). Full
documentation and the pack reference live at
[docs.creadev.org/crashtest](https://docs.creadev.org/crashtest).

## What is crashtest?

Crashtest is an offline attack harness: it loads *scenario modules* (bundles of
named attacks with honest verdict semantics - REFUSED / EXPLOITED / BOUNDED,
never fake results), drives them through an in-process transport against a
run root, and reports a written campaign ledger with receipts. "Zero
dependencies, zero sockets" is the doctoring rule: dependencies get doubles,
the code under attack stays real.

Each run is driven by a `crashtest.config.js` (declares the target's routes +
fake env) and exits nonzero on any EXPLOITED row - findings are loud, not
narratives.

## What are packs?

Packs are crashtest's extension surface: scenario modules a project authors
ONCE and reuses across run roots. Layout (created by `crashtest init`,
discovered by `crashtest run` / `crashtest packs`):

    packs/public/<name>/pack.json + files   -> shipped / shared, tracked
    packs/local/<name>/pack.json + files    -> machine-private, gitignored

A `pack.json` (schemaVersion 1) names the pack, describes it in one line, and
points at an ESM `entry` whose default export satisfies the scenario module
contract (`{ name, description, attacks[] }`, each attack an honest
`run(harness, ctx)` returning exactly one verdict). A broken pack fails the
run loudly - a broken pack is a config error, never a silent gap.

Adoption is one line in a crashtest config:

    packs: ['/abs/path/to/Freestruct/packs']

## Packs shipped here

### `freestruct-docs-shapes` (packs/public/freestruct-docs-shapes/)

Static-host wire truths for Freestruct-built docs trees. Freestruct's output
lives on dumb static hosts (GitHub Pages et al.), so the pack attacks the
*facts Freestruct writes into the tree*, reachable through any static
serving of it:

- **hostile-traversal-404** - encoded traversal shapes (`..%2f`,
  `%2e%2e%2f`, double-encodings, null-byte tails) must refuse cleanly from a
  static host: 4xx answers, never a 2xx that leaks file content from outside
  the tree, never 500/throw (the fuzz floor). Artifact requests with hostile
  query strings must answer byte-identical bodies.
- **gen404-noindex-canary** - the 404 path Freestruct generates carries the
  `robots: noindex` meta by contract (issue #11); a static host that answers
  200 on missing paths or serves an error page missing the noindex is a
  regression.
- **noindex-artifact-leak** - every noindex-flagged page in the tree must
  stay out of `sitemap.xml`, `search.json`, and `feed.xml` (the issue #5
  rule: one rule, three outputs). Cross-artifact oracle over the real built
  tree.
- **canonical-query-poison** - canonical links must be query-independent:
  hostile tracking/echo params (`?utm_source=...&x=%22`) must never show up
  inside the canonical a page advertises to search engines.
- **sitemap-xml-shape-canary** - `sitemap.xml` / `feed.xml` must parse as
  XML: no raw unescaped `&` or `<` inside `<loc>`/items (the issue #9
  regression class), loc values absolute.
- **ldjson-close-canary** - every JSON-LD block in a served head parses,
  and none carries a raw `</` in its text (the script-close class: the
  `\u003c` neutralization must hold end-to-end on the wire).
- **noindex-extras-leak** - skipped pages (robots-noindex bodies and the
  404) never carry the generated extras freestruct adds beyond the core
  set: JSON-LD blocks, hreflang alternates, feed autodiscovery links and
  site-verification metas.
- **llms-shape-leak** - when llms.txt generates, it lists the same page
  set sitemap honors (a noindex URL is the issue #5 class again) and every
  list entry stays one line.

Zero dependencies, zero sockets; works against any static run root - the
Freestruct repo dogfoods via its own `crashtest.config.js` at the repo root
(`SITE_ROOT` defaults to `docs/_site`, the built docs tree).

Teeth-proof: `node scripts/packs-selftest.cjs` stages a hardened build (must
hold - zero EXPLOITED) and a deliberately regressed tree that trips every
planted oracle (404 noindex loss, sitemap noindex leak, raw XML ampersand,
traversal containment dropped). GitHub docs CI runs the pack against the
built tree on every push (`.github/workflows/docs.yml`).

## House convention

Pack manifests carry their own semver - never bump them for Freestruct
CLI-level releases. See crashtest's AGENTS.md ("Common commands") for the
runbook; the prestruct repo (`packs/public/prestruct-proxy`) is the closest
cross-repo precedent for this exact model.
