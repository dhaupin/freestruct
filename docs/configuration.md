---
title: Configuration
description: Full configuration reference for freestruct
---

## Site Config

```yaml
title: My Docs
description: Documentation for My Project
url: https://example.com
```

## Search

```yaml
search:
  provider: pagefind
```

Options:
- `pagefind` - Built-in client-side search
- `algolia` - Algolia DocSearch (requires API keys)

## Navigation

```yaml
nav:
  - title: Home
    url: /
  - title: Guide
    items:
      - title: Getting Started
        url: /getting-started
      - title: Configuration
        url: /configuration
  - title: GitHub
    url: https://github.com/example/repo
    external: true
```

## Theme

Override theme files by creating them in your docs folder:

```
docs/
├── _layouts/
│   ├── default.html
│   └── page.html
├── _includes/
│   └── header.html
└── assets/
    └── main.scss
```

## SEO

freestruct automatically adds:
- Canonical URLs
- Open Graph tags
- Twitter cards
- JSON-LD structured data
- sitemap.xml
- robots.txt

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FREESTRUCT_BASE_URL` | Set base URL for deployment |