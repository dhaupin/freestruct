---
title: Getting Started
description: Install and configure freestruct for your doc site
---

## Prerequisites

- Node.js 18+
- Your SSG (Jekyll, Hugo, Docusaurus, etc.)

## Installation

```bash
npm install
```

## Configuration

Create `ssr-config.yml` in your docs root:

```yaml
# Output directory from your SSG build
outputDir: _site  # Jekyll
# outputDir: public          # Hugo
# outputDir: build           # Docusaurus

site:
  url: https://yoursite.com
  name: Your Site Name
  description: Your site description

twitter:
  username: "@yourhandle"
  card: summary

og:
  image: /assets/og-image.png
  locale: en_US
  type: website
```

## Add injection marker

In your layout's `<head>`, add:

```html
<!-- freestruct SEO -->
</head>
```

freestruct will inject SEO meta tags between the marker and `</head>`.

## Build

```bash
# Jekyll example
jekyll build && node docs/lib/inject.js

# Hugo example
hugo && node docs/lib/inject.js public
```

Or add to `package.json`:

```json
{
  "scripts": {
    "build": "jekyll build && node docs/lib/inject.js",
    "build:hugo": "hugo && node docs/lib/inject.js"
  }
}
```

## GitHub Actions

```yaml
- name: Build Jekyll
  run: bundle exec jekyll build

- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '20'

- name: Run freestruct
  run: npm install && node docs/lib/inject.js
```

## Next steps

- [Configuration](/configuration) - Full config reference
- [ssr-config.yml](/ssr-config) - All available options
