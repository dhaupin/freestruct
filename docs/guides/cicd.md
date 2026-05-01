---
title: CI/CD
description: Deploy Freestruct with GitHub Actions
---

Freestruct integrates with any CI/CD. Here's how with GitHub Actions.

## GitHub Actions

Add to your existing workflow:

```yaml
name: Build and Deploy

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install deps
        run: npm install

      - name: Build docs
        run: npm run docs  # your SSG build command

      - name: Run freestruct
        run: node docs/lib/inject.js docs/_site

      - name: Upload build
        uses: actions/upload-artifact@v4
        with:
          name: docs-build
          path: docs/_site
```

---

## Full Example

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
        run: node docs/lib/inject.js _site

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
  run: node docs/lib/inject.js
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
  command = "your-ssg-build && node docs/lib/inject.js docs/_site"
  publish = "docs/_site"
```

### Vercel

Add to `vercel.json`:

```json
{
  "buildCommand": "your-ssg-build && node docs/lib/inject.js",
  "outputDirectory": "docs/_site"
}
```

### GitLab CI

```yaml
build:
  script:
    - npm install
    - your-ssg-build
    - node docs/lib/inject.js docs/_site
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
node docs/lib/inject.js /tmp/test-build

# Check output
grep freestruct-build /tmp/test-build/index.html
```

---

## Common Issues

### Missing js-yaml

```bash
# Ensure package.json has:
"js-yaml": "^4.0.0"
```

### Wrong output path

Always match your SSG output:

```yaml
# Jekyll
node docs/lib/inject.js docs/_site

# Hugo
node docs/lib/inject.js public

# Docusaurus  
node docs/lib/inject.js build
```