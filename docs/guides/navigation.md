---
title: Navigation
description: Configure site navigation - dynamic from folder structure or SSG-defined
nav_order: 3
---

Freestruct can auto-generate navigation from your docs folder structure, or use your SSG's built-in menu.

## How It Works

By default, Freestruct reads your `docs/` folder structure:

```
docs/
├── getting-started.md     → Link in "Docs" section
├── guides/
│   ├── setup.md       → Link under "Guides" folder
│   └── api.md
```

And generates navigation like:

```
Docs
├── Getting Started
Guides
├── Setup
└── API
```

## Configuration

Add to `_config.yml`:

```yaml
# Enable/disable dynamic nav (default: true)
generateNav: true   # auto-generate from folder structure
generateNav: false # use SSG's built-in menu
```

## Section Titles

Map folder names to display titles:

```yaml
nav_sections:
  guides: "Guides"
  contributing: "Contributing"
  api: "API Reference"
```

## Sort Order

### Config Level

Control section order:

```yaml
nav_order:
  index: 0
  getting-started: 1
  configuration: 2
  guides: 10
  contributing: 20
```

### Page Level

Control per-page order via frontmatter:

```yaml
---
title: Getting Started
nav_order: 1
---
```

Sort values: Lower numbers appear first. Default is `999` if not set.

## Disabling for SSG Menu

Set `generateNav: false` to let your SSG handle navigation:

```yaml
# _config.yml
generateNav: false
```

This passes through `site.data.menu` or your SSG's native menu structure. Works with:
- Jekyll's `navigation` data in `_data/`
- Hugo's menu configuration
- Docusaurus sidebars
- Any SSG with built-in menu

## Disabling Per-Page

Hide specific pages from nav:

```yaml
---
title: Changelog
nav: false
---
```

## Related

- [Dynamic Navigation](/guides/dynamic-nav)
- [ssr-config.yml Reference](/guides/ssr-config)