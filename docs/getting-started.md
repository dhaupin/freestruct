---
title: Getting Started
description: Get Freestruct running in 5 minutes
---

This guide walks you through setting up freestruct. If you hit any snags, the [FAQ](/guides/cache-busting-faq) might help.

## TL;DR

```bash
# 1. Install
npm install

# 2. Build your site (your SSG, any flavor)
jekyll build   # or hugo, docusaurus build, etc

# 3. Inject SEO
node docs/lib/inject.js

# 4. Deploy
# That's it. Every page now has perfect SEO.
```

## Prerequisites

- **Node.js 18+** - Run `node --version` to check
- **A static site generator** - Jekyll, Hugo, Docusaurus, anything
- **Terminal access** - Command line, not GUI

Don't have Node? Install it from [nodejs.org](https://nodejs.org) or via homebrew: `brew install node`.

## Step 1: Install Dependencies

```bash
cd your-docs-folder
npm install js-yaml
```

That's it. Freestruct has zero runtime dependencies. `js-yaml` is the only thing it needs.

## Step 2: Create Your Config

Create `docs/ssr-config.yml` with this minimum setup:

```yaml
# Where your SSG outputs files
outputDir: _site      # Jekyll
# outputDir: public   # Hugo
# outputDir: build    # Docusaurus

# Your site info - shows up in search results + social
site:
  url: https://yoursite.com
  name: Your Site Name
  description: What your site does (this shows in Google)

# Optional: Twitter card info
twitter:
  username: "@yourhandle"
  card: summary   # summary, summary_large_image, app, or player

# Optional: Open Graph image
og:
  image: /assets/og-image.png
```

**Don't skip the description** - it's what people see in Google results.

## Step 3: Run freestruct

After your SSG builds:

```bash
# Full build for Jekyll
jekyll build && node docs/lib/inject.js
```

For other SSGs, just swap the build command:

```bash
# Hugo
hugo && node docs/lib/inject.js public

# Docusaurus
docusaurus build && node docs/lib/inject.js build

# MkDocs
mkdocs build && node docs/lib/inject.js site

# VitePress
vitepress build && node docs/lib/inject.js .vitepress/dist
```

## Step 4: Verify It Works

Open any generated HTML file. You should see in the `<head>`:

```html
<meta name="description" content="What your site does">
<link rel="canonical" href="https://yoursite.com/?v=abc123">
<meta property="og:title" content="Page Title | Your Site Name">
<meta name="twitter:card" content="summary">
<meta name="freestruct-build" content="abc123">
```

If you see those tags, you're golden. 🎉

## Step 5: Automate with CI/CD

Add this to your GitHub Actions workflow:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '20'

- name: Install dependencies
  run: npm install js-yaml

- name: Build site + inject SEO
  run: |
    jekyll build
    node docs/lib/inject.js
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "build": "jekyll build && node docs/lib/inject.js"
  }
}
```

## What If It Doesn't Work?

1. **Check the hash** - View page source, look for `freestruct-build`
2. **Verify outputDir** - Does it match your SSG's output folder?
3. **Check config** - Run `node -e "console.log(require('js-yaml').load(require('fs').readFileSync('docs/ssr-config.yml')))"` to debug
4. **See the [FAQ](/guides/cache-busting-faq)** - We documented every weird edge case

## Next Steps

- [Configuration](/configuration) - All available options
- [Cache Busting Guide](/guides/cache-busting) - Why the hash matters
- [FAQ](/guides/cache-busting-faq) - Pain points and solutions
