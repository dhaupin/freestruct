---
title: Example Page Template
description: Copy this template when creating new docs pages - it shows all supported frontmatter fields, section structure and the heading style this site audits for.
nav_order: 9
---

<!-- # Example Page Template

This is the complete template for Freestruct docs. Copy it when creating new pages. -->

## Frontmatter

Every page starts with YAML frontmatter:

<!-- TRUTH-KNOB: yaml below is a Jekyll frontmatter sample, not a Freestruct config -->
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

When you need to show a fence literally, indent the whole sample by four spaces so the parser does not open it:

    ```yaml
    key: value
    ```

Inline literal fences have the same shape in any markdown renderer. Do not wrap fences in `<pre><code>` HTML - raw markdown inside HTML tags is not parsed consistently across SSGs.

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
- [Freestruct.config.yml Reference](/guides/freestruct-config) - Configuration options
