---
title: Getting Started
description: Get Freestruct running in 5 minutes
nav_order: 1
---

This guide walks you through setting up Freestruct. If you hit any snags, the [FAQ](/guides/cache-busting-faq) might help.

## TL;DR

```bash
# 1. Install (the freestruct npm package)
npm install --save-dev freestruct

# 2. Build your site (your SSG, any flavor)
jekyll build   # or hugo, docusaurus build, etc

# 3. Inject SEO
npx freestruct

# 4. Deploy
# That's it. Every page now has perfect SEO.
```

## Prerequisites

- **Node.js 20+** - Run `node --version` to check (Freestruct is ESM and requires Node 20 or newer)
- **A static site generator** - Jekyll, Hugo, Docusaurus, anything
- **Terminal access** - Command line, not GUI

Don't have Node? Install it from [nodejs.org](https://nodejs.org) or via homebrew: `brew install node`.

## Step 1: Install Freestruct

```bash
npm install --save-dev freestruct
```

That's it. The npm package ships everything it needs at runtime,
including its one dependency (`js-yaml`) - npm installs it automatically
with the package. You only install dependencies by hand when running the
engine from a repo checkout.

## Step 2: Create Your Config

Create `docs/freestruct.config.yml` with this minimum setup:

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

## Step 3: Run Freestruct

After your SSG builds:

```bash
# Full build for Jekyll
jekyll build && npx freestruct
```

For other SSGs, just swap the build command:

```bash
# Hugo
hugo && npx freestruct public

# Docusaurus
docusaurus build && npx freestruct build

# MkDocs
mkdocs build && npx freestruct site

# VitePress
vitepress build && npx freestruct .vitepress/dist
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

If you see those tags, you're ready to ship.

## Step 5: Automate with CI/CD

Add this to your GitHub Actions workflow:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '20'

- name: Install freestruct
  run: npm install --save-dev freestruct

- name: Build site + inject SEO
  run: |
    jekyll build
    npx freestruct
```

Or add to your `package.json`:

```json
{
  "scripts": {
    "build": "jekyll build && npx freestruct"
  }
}
```

## What If It Doesn't Work?

1. **Check the hash** - View page source, look for `freestruct-build`
2. **Verify outputDir** - Does it match your SSG's output folder?
3. **Check config** - Run `cat docs/freestruct.config.yml` and verify `site.name` and `site.url` on first run; Freestruct prints `[freestruct] config warning` lines for any key it does not recognize
4. **See the [FAQ](/guides/cache-busting-faq)** - We documented every weird edge case

## Related

- [Configuration](/configuration) - All available options
- [Cache Busting Guide](/guides/cache-busting) - Why the hash matters
- [FAQ](/guides/cache-busting-faq) - Pain points and solutions
- [CI/CD Recipes](/guides/cicd) - Automating the deploy pipeline
- [Troubleshooting](/guides/troubleshooting) - When a step fails
