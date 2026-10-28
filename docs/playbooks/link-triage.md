---
title: Link triage
description: A --strict build failure - read the report, fix the link, re-run until the tree is clean.
nav_order: 18
permalink: /playbooks/link-triage/
---

# Link triage: a `--strict` failure

Default runs are report-only: broken internal links are printed and the build still exits 0. `--strict` graduates them to failures - the strictness ladder in the config contract.

```bash
# the failure (exit 1): every broken internal link is listed
npx freestruct docs/_site --strict

# fix the source pages, rebuild, re-run
jekyll build && npx freestruct docs/_site --strict
```

Read the report top-down. Each row names the page and the href that did not resolve. Two common shapes:

- **A pretty-URL route** - the checker resolves directory-index and `.htm` sibling shapes, so `/guide/` and `/guide/index.html` both resolve to the page that owns them.
- **A root-absolute href on a baseurl'd site** - the checker resolves root-absolute hrefs against the configured `basePath`, so a menu link like `/guides/cli` on a sub-path install is matched to the page, not flagged.

If a run must stay green while a real dead link is still being chased, use `--tolerant` for CI tolerance (fatal config errors log and exit 0) - but fix the link, do not lean on the flag.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/baked-output-audit/">Baked-output audit</a> - verify the shipped tree independently.</p>
</div>
