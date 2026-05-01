---
title: Example Page Template
description: Copy this template when creating new docs pages. Shows all supported frontmatter and section structure.
---

<!-- This is the complete template for Freestruct docs. Copy it when creating new pages. -->

## Frontmatter

Every page starts with YAML frontmatter:

```yaml
---
title: Page Title
description: 1-2 sentence description for SEO and indexing
---
```

### Required Fields

| Field | Description |
|-------|-------------|
| `title` | Page title (used in nav, browser tab) |
| `description` | Short description for SEO meta tag |

### Optional Fields

| Field | Description |
|-------|-------------|
| `layout` | Layout template (default: `default`) |
| `permalink` | Custom URL path |

## Page Structure

Use these sections in order:

```markdown
## Overview

Brief intro - what this page covers and who it's for.

## Main Section

Core content.

### Subsection

More detailed content if needed.

## Related

- [Related Page](/path) - Brief description
```

## Code Blocks

Use fenced code blocks with language labels:

<pre><code>```yaml
key: value
```</code></pre>

Renders as:

```yaml
key: value
```

## Tables

Use markdown tables for structured data:

```markdown
| Header | Header |
|--------|--------|
| Cell   | Cell   |
```

## Writing Style

- Use **Title Case** for page titles: "Getting Started"
- Use **lowercase** for CLI/code: `npm install freestruct`
- Use **Sentence case** for buttons and links
- Keep paragraphs short (under 3-4 sentences)
- Use lists for steps or options

## Related

- [Voice & Style Guide](/contributing/style) - Writing conventions
- [ssr-config.yml Reference](/guides/ssr-config) - Configuration options
