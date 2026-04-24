---
title: Getting Started
description: Install and configure freestruct for your doc site
---

## Installation

```bash
npm install freestruct
```

## Configuration

Create a `_config.yml` in your docs folder:

```yaml
title: My Docs
description: Documentation for My Project

search:
  provider: pagefind
```

## Build Script

Add to `package.json`:

```json
{
  "scripts": {
    "build": "jekyll build && freestruct build"
  }
}
```

## Running Locally

```bash
bundle exec jekyll serve
```

Then build with freestruct separately:

```bash
freestruct build
```

## Project Structure

```
docs/
├── _config.yml      # Jekyll config
├── index.md         # Homepage
├── getting-started.md
├── _theme/          # Optional overrides
│   ├── _layouts/
│   ├── _includes/
│   └── assets/
└── pagefind/        # Generated search index
```

## Next Steps

- [Configuration](/configuration) - Full config options
- [Search](/search) - Search setup and customization