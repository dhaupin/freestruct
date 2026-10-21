---
title: Navigation
description: How the docs menu works - one data file, rendered by one partial
nav_order: 3
---

# Navigation

Freestruct's docs menu is a **single data file**: `docs/_data/nav.yml`. The
`header.html` include and the `default.html` sidebar both render the same
`site.data.nav` structure, so the top nav and the sidebar can never drift
apart.

## The Shape

```yaml
# docs/_data/nav.yml
- title: Start
  items:
    - title: Home
      url: /
    - title: Getting Started
      url: /getting-started

- title: Guides
  items:
    - title: Cache Busting
      url: /guides/cache-busting
```

- Top-level entries are **sections** (rendered as groups/sidebar headings).
- Each item is `{ title, url }`. URLs are deployment paths without `.html`,
  which Jekyll's `relative_url` filter resolves correctly under any baseurl.
- A page exists in the menu **only if it is listed here**. Nav membership is
  explicit, not an accident of folder structure.

## Why Not Auto-Generated?

An earlier build auto-collected nav from the folder tree with a Jekyll
generator (`_plugins/nav_generator.rb`). It was removed:

- It grew every config knob it needed to survive (`generateNav`,
  `nav_sections`, `nav_order` map) - noise a no-op feature shouldn't cost.
- It made nav *implicit*, so a page could appear in the menu just by existing
  in the wrong folder.
- The single-file version is easier to audit: one linter can check that every
  URL in the file resolves, and that every listed page carries complete
  frontmatter.

## Adding a Page

1. Create the markdown file with complete frontmatter
   (`title`, `description`, `nav_order`, plus `permalink` if the path needs
   to be explicit).
2. Add its entry to `docs/_data/nav.yml` under the right section.
3. The audit gate verifies both halves match before anything deploys.

## Using Your Own SSG Menu

Jekyll builds this frame, but freestruct itself never touches your nav - the
injection layer only writes post-build SEO/URL/output artifacts into the
rendered HTML. If you run freestruct over your own site, your existing menu
is untouched.

## Related

- [Freestruct.config Reference](/guides/ssr-config)
- [Template](/guides/template)
