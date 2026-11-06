---
version: 1.3.0
permalink: /discussions/announcing-freestruct-v1.3.0/
layout: default
title: "Announcing freestruct v1.3.0"
description: The v1.3.0 Discussions release post, per the Creadev family release-post convention
---

# freestruct v1.3.0

freestruct is a post-build SEO layer for static doc sites. v1.3.0 is everything since the v1.2.0 tag: the security round that hardened the one lane that dials a network, the family docs-lane consolidation that made this repo the single reusable lane, and the prestruct-pin guard that keeps the family floor mechanical. Every fix is battery-pinned; the battery grew 173 -> 192. This post ships with the v1.3.0 tag:

```bash
npm i -D freestruct
```

## What landed

**The external audit lane refuses a private host before any socket (SSRF guard).** The opt-in `--external` pass fetches the URLs a baked tree names, and a baked tree can be attacker-influenced (a CMS field, a scraped page, a dependency's demo HTML). Left open, that made the lane a server-side request forgery primitive: a link to `http://169.254.169.254/...` (cloud metadata), `http://127.0.0.1:<port>/` (a co-located service), or an internal `http://10.0.0.5/` would make the run probe a host the tree's author cannot reach directly, and report the status back in the findings. A new `engine/hostpolicy.js` classifies each URL's host **literal** - a network-free, deterministic call - and `engine/audit.js` refuses a private, loopback, link-local, unique-local, or otherwise non-public address **before any probe**. The classifier covers every spelling a parser accepts (dotted quad, bare 32-bit integer, octal, hex, short dotted forms, IPv6, IPv4-mapped IPv6) plus the reserved names `localhost`/`*.local`, so the shorthand encodings a naive four-octet check misses (`2130706433`, `0177.0.0.1`, `0x7f.0.0.1`, `127.1`) are caught too. A refused URL is a WARN finding, never a silent skip, and it does not count as `checked`.

**The external lane re-checks the host on every redirect hop (redirect SSRF guard).** The literal guard checks the URL the lane is handed - not where the server points it. The probe used `redirect: 'follow'`, so a public URL (say `https://attacker.example/`) could answer `302 Location: http://169.254.169.254/latest/meta-data/` and the runtime would open the socket to the metadata IP before the guard ever saw the target. `headCheck` now follows redirects manually, one hop at a time, resolving each `Location` against the current hop and re-running the host check on every hop; a hop that lands on a private host is a final refusal (reported by name, never retried, so a retry cannot re-open the socket), and `MAX_REDIRECTS` (5) bounds the chain.

**The docs lane is now THE one docs lane.** Every repo that builds docs calls this file; the forks are gone. `coreforge`'s `docs-build.yml` and `govstruct`'s copy were the same runbook under a second name, and the two had already drifted (ruby 3.2 vs 3.4, pagefind `latest` scrape vs npm pin). The lane absorbed the superset of every fork's receipts: `pagefind-version: latest` resolves through the hardened scrape, `crashtest-ref` is opt-in, `strict`/`freestruct-version`/`freestruct-cmd` are exposed so a consumer needs no local fork, and the install is lock-aware. All ten family repos call this one lane at the same pinned SHA.

**A prestruct-pin floor guard, and pins never float.** A new guard refuses any `prestruct` declaration below the family floor (`^1.2.0`, the release that closes the hooks seam), and every GitHub Action `uses:` in the workflows names a 40-hex commit SHA (tag kept in the trailing comment), never a floating `@v4`/`@v1`.

**The release ladder's `verify` job waits for `release`.** `verify` declares `needs: [publish, release]` (was a bare `needs: publish`), closing a race where it ran CONCURRENTLY with the release mint: on a fresh cut the registry read replicas had not settled and the tarball was not yet attached, so a publish that in fact succeeded failed red and needed a manual re-run (first seen on the packstruct 1.1.0 cut). The release-attach poll widened 120s -> 300s and the registry poll 120s -> 360s, and the release-lane receipt (`test/run.js`) pins the dependency so a regression fails by name.

## Quality layer

The fixture battery grew 173 -> 192, one red-checked pin per fix. The SSRF legs are hermetic (a classifier table plus a no-socket refusal; the redirect leg drives a real loopback redirect server), so the guard is proven without ever dialing a private address. Every fix was reproduced first, then corrected, then re-pinned. CI runs the full gate set on every push and pull request - the battery, the docs audit, template sync lockstep, the tarball e2e, the crashtest pack selftest, and a live docs deploy that dogfoods freestruct against its own freshly built site.

## Links

- Repo and docs: https://github.com/dhaupin/freestruct / https://freestruct.creadev.org
- Config reference: https://freestruct.creadev.org/guides/freestruct-config
- CLI reference: https://freestruct.creadev.org/guides/cli
- Changelog: https://github.com/dhaupin/freestruct/blob/main/CHANGELOG.md
- Issues: https://github.com/dhaupin/freestruct/issues
