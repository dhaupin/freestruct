---
title: First run
description: Install freestruct, build your site, inject, and verify - four commands with the receipt at each step.
nav_order: 17
permalink: /playbooks/first-run/
---

# First run: install, build, inject, verify

The shortest path from a built site to a SEO-grade tree. Freestruct is a layer - it runs AFTER your SSG finishes, on the output folder.

```bash
# 1. install (dev dependency; the runtime ships js-yaml)
npm install --save-dev freestruct

# 2. build your site (your SSG, any flavor)
jekyll build            # or: hugo, docusaurus build, vitepress build, ...

# 3. inject - reads freestruct.config.yml, writes into the output tree
npx freestruct docs/_site

# 4. verify the baked output independently (exit 0 clean / 1 findings)
npx freestruct audit docs/_site
```

What you get after step 3: every page carries complete meta, Open Graph, Twitter and JSON-LD (missing-only - your own tags win), plus a real `sitemap.xml`, `robots.txt`, an RSS `feed.xml`, a noindex `404.html`, and cache-busted asset URLs.

Step 4 is the independent check: `audit` re-reads the tree freestruct just wrote and verifies head hygiene and the sitemap/robots/404-noindex contract. It touches nothing - safe to run in CI as its own step.

<div class="playbook-next">
<p><strong>Next:</strong> <a href="/playbooks/link-triage/">Link triage</a> - what to do when <code>--strict</code> fails the build.</p>
</div>
