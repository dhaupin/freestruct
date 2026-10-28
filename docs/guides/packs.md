---
title: Packs
description: The crashtest extension surface - what the freestruct-docs-shapes pack attacks, and how to run it against your own built tree.
nav_order: 26
---

# Packs

Freestruct ships a [crashtest](https://crashtest.creadev.org) pack: an adversarial-audit scenario module that attacks a Freestruct-built tree the way a dumb static host serves it. This page is the consumer-facing summary; the full reference lives at [docs.creadev.org/crashtest](https://docs.creadev.org/crashtest) and in [packs/README.md](https://github.com/dhaupin/freestruct/blob/main/packs/README.md).

## What crashtest is

Crashtest is an offline attack harness. It loads scenario modules (bundles of named attacks with honest verdict semantics - REFUSED / EXPLOITED / BOUNDED, never fake results), drives them through an in-process transport against a run root, and reports a written campaign ledger with receipts. "Zero dependencies, zero sockets" is the rule: dependencies get doubles, the code under attack stays real. A run exits nonzero on any EXPLOITED row - findings are loud, not narratives.

## What a pack is

Packs are crashtest's extension surface: scenario modules a project authors once and reuses across run roots. Layout (created by `crashtest init`, discovered by `crashtest run`):

```text
packs/public/<name>/pack.json + files   -> shipped / shared, tracked
packs/local/<name>/pack.json + files    -> machine-private, gitignored
```

A `pack.json` (schemaVersion 1) names the pack and points at an ESM `entry` whose default export satisfies the scenario module contract (`{ name, description, attacks[] }`). A broken pack fails the run loudly - a broken pack is a config error, never a silent gap. Adoption is one line in a crashtest config:

```js
packs: ['/abs/path/to/freestruct/packs']
```

## The shipped pack: `freestruct-docs-shapes`

Freestruct's output lives on static hosts (GitHub Pages and friends), so the pack attacks the facts Freestruct writes into the tree, reachable through any static serving of it:

| Attack | What it proves |
|--------|----------------|
| `hostile-traversal-404` | Encoded traversal shapes (`..%2f`, `%2e%2e%2f`, double-encodings, null-byte tails) refuse cleanly: 4xx answers, never a 2xx that leaks file content, never 500/throw. |
| `gen404-noindex-canary` | The generated 404 carries the `robots: noindex` meta by contract (issue #11). |
| `noindex-artifact-leak` | Every noindex page stays out of `sitemap.xml`, `search.json` and `feed.xml` (issue #5: one rule, three outputs). |
| `canonical-query-poison` | Canonical links are query-independent - hostile tracking/echo params never show up in the advertised canonical. |
| `sitemap-xml-shape-canary` | `sitemap.xml` / `feed.xml` parse as XML: no raw unescaped `&` or `<` inside `<loc>`/items (issue #9), loc values absolute. |
| `ldjson-close-canary` | Every JSON-LD block parses, and none carries a raw `</` in its text (the script-close class: `\u003c` neutralization holds end-to-end). |
| `noindex-extras-leak` | Skipped pages never carry generated extras beyond the core set: JSON-LD, hreflang, feed autodiscovery, verification metas. |
| `llms-shape-leak` | When `llms.txt` generates, it lists the same page set sitemap honors, one line per entry. |

## Running it

The Freestruct repo dogfoods the pack against its own built docs through the root `crashtest.config.js` (`SITE_ROOT` defaults to `docs/_site`):

```bash
# from the freestruct repo root, after the docs tree is built
npx crashtest run

# point it at any built tree
SITE_ROOT=/tmp/fx/_site npx crashtest run --config crashtest.config.js
```

Teeth-proof: `node scripts/packs-selftest.cjs` stages a hardened build (must hold - zero EXPLOITED) and a deliberately regressed tree that trips every planted oracle. GitHub docs CI runs the pack against the built tree on every push.

## House convention

Pack manifests carry their own semver - never bump them for Freestruct CLI-level releases.

## Related

- [Engineering Decisions](/engineering-decisions) - the crashtest dogfood in context
- [CI/CD](/guides/cicd) - where the pack runs in the pipeline
- [Release gate](/playbooks/release-gate/) - the pack selftest in the gate set
