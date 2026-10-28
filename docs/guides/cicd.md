---
title: CI/CD
description: Deploy Freestruct with GitHub Actions
nav_order: 6
---

Freestruct integrates with any CI/CD. Here's how with GitHub Actions.

## GitHub Actions

Add to your existing workflow:

<!-- TRUTH-KNOB: yaml below is a GitHub Actions workflow, not a Freestruct config -->
```yaml
name: Build and Deploy

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install freestruct
        run: npm install --save-dev freestruct

      - name: Build docs
        run: npm run docs  # your SSG build command

      - name: Run freestruct
        run: npx freestruct docs/_site

      - name: Upload build
        uses: actions/upload-artifact@v4
        with:
          name: docs-build
          path: docs/_site
```

---

## Full Example

<!-- TRUTH-KNOB: yaml below is a GitHub Actions workflow, not a Freestruct config -->
```yaml
name: Build

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Jekyll
        run: bundle exec jekyll build

      - name: Run freestruct
        run: npx freestruct _site

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: _site
          path: _site

      - name: Deploy (main only)
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./_site
```

---

## Environment Variables

For private sites, use secrets:

```yaml
- name: Run freestruct
  run: npx freestruct
  env:
    SITE_URL: ${{ secrets.SITE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
```

Access in config:

```yaml
site:
  url: $SITE_URL
```

---

## Other CI/CD

### Netlify

Add to `netlify.toml`:

```toml
[build]
  command = "your-ssg-build && npx freestruct docs/_site"
  publish = "docs/_site"
```

### Vercel

Add to `vercel.json`:

```json
{
  "buildCommand": "your-ssg-build && npx freestruct",
  "outputDirectory": "docs/_site"
}
```

### GitLab CI

<!-- TRUTH-KNOB: yaml below is a GitLab CI config, not a Freestruct config -->
```yaml
build:
  script:
    - npm install --save-dev freestruct
    - your-ssg-build
    - npx freestruct docs/_site
  artifacts:
    paths:
      - docs/_site/
```

---

## Testing in CI

Test without deploying:

```bash
# Build + inject to temp folder
mkdir -p /tmp/test-build
cp -r docs/_site/* /tmp/test-build/
npx freestruct /tmp/test-build

# Check output
grep freestruct-build /tmp/test-build/index.html
```

And verify the result with the built-in checker instead of ad-hoc greps:

```bash
# Exit 0 clean, exit 1 names every gap (heads, 404 noindex, sitemap/robots)
npx freestruct audit

# Machine digest for CI annotations / scriptable gates
npx freestruct audit --json

# Also HEAD-check up to 50 unique external hrefs (needs a live network;
# dead links are WARN rows, not build failures)
npx freestruct audit --external
```

A stronger default for the PR build: `npx freestruct --strict` at build time (broken links and SVG og:image fail with exit 1 - the same ladder the docs CI on this repo dogfoods), then `npx freestruct audit` on the result.

After the deploy lands, the search-engine notify step is one command:

```bash
# Post-deploy: POST the baked sitemap to api.indexnow.org
npx freestruct indexnow            # 200/202 = accepted
npx freestruct indexnow --dry-run  # build-time shape check, no network
```

The key file ships into the output during the run, so only the submission is a post-deploy concern (keyLocation must resolve live).

---

## Common Issues

### Missing js-yaml

The Freestruct npm package ships `js-yaml` as its own dependency, so a package install never needs a manual entry. Only a repo checkout does:

```bash
# repo checkout only:
# ensure package.json has:
"js-yaml": "^4.1.0"
```

Using `npx freestruct` without a local install? npx fetches the package with its dependency the first time (`npx --yes freestruct` skips the prompt).

### Wrong output path

Always match your SSG output:

```yaml
# Jekyll
npx freestruct docs/_site

# Hugo
npx freestruct public

# Docusaurus
npx freestruct build
```

## Related

- [Cache Busting FAQ](/guides/cache-busting-faq) - CDN freshness questions that show up in pipelines
- [Troubleshooting](/guides/troubleshooting) - When a step fails, start here
- [Freestruct.config Reference](/guides/freestruct-config) - outputDir and purge hook options