# Contributing to freestruct

## Concept

freestruct is a framework-agnostic SEO layer for static doc sites. It should:

- Work with any SSG (Jekyll, Hugo, Docusaurus, MkDocs, VitePress)
- Have minimal dependencies (just Node)
- Be configurable via a simple config file
- Do one thing well (SEO layer) vs trying to be everything

## Core Principles

1. **Adapter pattern** - Each SSG gets an adapter. freestruct doesn't care how pages are generated, just that it can read the output and enhance it.

2. **Single responsibility** - SEO layer only. Don't try to build a doc theme or full SSG. Leave that to existing tools.

3. **CI-friendly** - Designed for GitHub Actions / CI pipelines. Not a dev server.

## Architecture Thoughts

```
freestruct/
├── cli.js              # Entry point
├── config.js           # Config loading + validation
├── adapters/          # SSG-specific adapters
│   ├── jekyll.js
│   ├── hugo.js
│   └── index.js
├── plugins/           # SEO features
│   ├── meta.js        # Inject meta tags
│   ├── search.js      # Pagefind integration
│   ├── sitemap.js     # Generate sitemap
│   └── audit.js       # SEO audit tool
└── utils/
    ├── dom.js         # HTML parsing
    └── path.js        # URL handling
```

## Questions to Answer

- Config format: JS, YAML, or JSON?
- Should it modify source files or output files?
- Plugin system for extensibility?
- CLI only or library API too?
- Which SSG to target first?

## How to Help

Open an issue with:
- Use cases you want to support
- Pain points you've hit with doc SEO
- Questions or concerns about the approach

## License

See [LICENSE](LICENSE)