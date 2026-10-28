---
title: Baked-output audit
description: Run freestruct audit against the shipped tree - per-page head hygiene and the sitemap/robots/404 contract, with --json for CI.
nav_order: 19
permalink: /playbooks/baked-output-audit/
---

# Baked-output audit

`audit` is the independent check: it re-reads the output tree freestruct (or
any SSG) produced and verifies the shipped facts, without touching anything.
Exit 0 clean, exit 1 with findings.

```bash
# human-readable report
npx freestruct audit docs/_site

# machine digest for CI (parses with the warns merged)
npx freestruct audit --json docs/_site

# also HEAD-check up to 50 unique external hrefs (warn-grade, needs network)
npx freestruct audit --external docs/_site
```

What it verifies on the baked output: per-page head hygiene (title,
description, canonical, OG/Twitter/JSON-LD presence as configured) and the
sitemap/robots/404-noindex contract. Config-gated absences (for example
`og:image` or `twitter:image` when they are not configured) collapse to one
line each with an affected-page count - not a repeated row per page.

Unknown audit flags fail loudly rather than riding as a positional argument,
so a typo cannot silently audit the wrong tree.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/config-validation/">Config validation</a> - prove the config before the run.</p>
</div>
