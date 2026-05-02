---
title: Dynamic Navigation
description: Auto-generate navigation from docs folder structure
---

Freestruct can auto-generate your site navigation from the docs folder structure. No manual nav config needed - just add files and folders.

## How It Works

The navigation generator reads your docs folder structure:
- Files in the root become links under "Docs"
- Folders become collapsible sections
- Files inside folders become links in that section

## Configuration

Add to `_config.yml`:

```yaml
# Section titles (folder name => display title)
nav_sections:
  guides: "Guides"
  contributing: "Contributing"

# Section order (lower = first)
nav_order:
  getting-started: 1
  guides: 2
  contributing: 3
```

## Per-Page Options

Add to page frontmatter to control nav:

```yaml
---
title: My Page
nav_order: 1  # Sort order (default: 999)
nav: false     # Hide from nav
---
```

## File Structure Example

```
docs/
├── getting-started.md     # → Docs section
├── configuration.md     # → Docs section
├── guides/
│   ├── setup.md       # → Guides > Setup
│   ├── api.md        # → Guides > API
│   └── advanced.md    # → Guides > Advanced
└── contributing/
    ├── style.md      # → Contributing > Style
    └── code.md       # → Contributing > Code
```

Results in:

```
Docs
├── Getting Started
└── Configuration
Guides
├── Setup
├── API
└── Advanced
Contributing
├── Style
└── Code
```

## Related

- [Configuration](/configuration)
- [Template Guide](/guides/template)